"use client";

import { useState, useEffect } from "react";
import SyncButton from "@/components/SyncButton";
import CategoryFilter from "@/components/CategoryFilter";
import BookmarkCard from "@/components/BookmarkCard";
import CategoryManager from "@/components/CategoryManager";
import BookmarkDetail from "@/components/BookmarkDetail";
import type { LinkPreviewLike } from "@/lib/bookmark-shape";
import { useT } from "@/lib/language-context";

interface Bookmark {
  id: string;
  text: string;
  author_id: string;
  author_name: string;
  author_username: string;
  created_at: string;
  category: string;
  media_urls: string;
  local_media?: string;
  bookmarked_at: string;
  raw_json?: string;
}

export default function Home() {
  const { t, lang, setLang } = useT();
  const [authenticated, setAuthenticated] = useState(false);
  const [authUrl, setAuthUrl] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | null>(null);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreviewLike>>({});
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Sync state with what the blocking script in layout.tsx already applied.
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  useEffect(() => {
    loadBookmarks();

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      setSyncMessage(t("authSuccess"));
      setAuthenticated(true);
      setAuthUrl("");
      window.history.replaceState({}, "", "/");
      return;
    }
    if (params.get("error")) {
      setError(t("authError", { err: params.get("error") || "" }));
      window.history.replaceState({}, "", "/");
    }

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuth() {
    const res = await fetch("/api/auth/status");
    const data = await res.json();
    setAuthenticated(data.authenticated);
  }

  async function handleGetAuthUrl() {
    const res = await fetch("/api/auth/login");
    const data = await res.json();
    if (data.url) {
      setAuthUrl(data.url);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setAuthUrl("");
  }

  async function loadBookmarks(category?: string) {
    const params = category && category !== "all" ? `?category=${encodeURIComponent(category)}` : "";
    const res = await fetch(`/api/bookmarks${params}`);
    const data = await res.json();
    setBookmarks(data.bookmarks || []);
    setCounts(data.counts || {});
    setAllCategories(data.allCategories || []);
    setLinkPreviews(data.linkPreviews || {});
  }

  async function handleSync() {
    setLoading(true);
    setError("");
    setSyncMessage("");
    try {
      const res = await fetch("/api/bookmarks", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("syncFailed"));
        return;
      }
      setBookmarks(data.bookmarks || []);
      setCounts(data.counts || {});
      setAllCategories(data.allCategories || []);
      setLinkPreviews(data.linkPreviews || {});
      setSyncMessage(
        t("syncMessage", {
          synced: data.synced,
          apiCalls: data.apiCalls,
          early: data.stoppedEarly ? t("syncEarly") : "",
        })
      );
      setSelectedCategory("all");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleBackfillMedia() {
    setLoading(true);
    setError("");
    setSyncMessage("");
    try {
      const res = await fetch("/api/bookmarks/backfill-media", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("backfillMediaFailed"));
        return;
      }
      setSyncMessage(
        t("backfillMediaMessage", {
          n: data.bookmarksUpdated,
          files: data.downloaded,
          failed: data.failed,
        })
      );
      await loadBookmarks(selectedCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleReclassify() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/classify", { method: "POST" });
      const data = await res.json();
      setBookmarks(data.bookmarks || []);
      setCounts(data.counts || {});
      setLinkPreviews(data.linkPreviews || {});
      setSyncMessage(t("reclassifyMessage", { count: data.reclassified }));
      setSelectedCategory("all");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleBackfillArticles() {
    setLoading(true);
    setError("");
    setSyncMessage(t("backfillArticlesWorking"));
    try {
      const res = await fetch("/api/bookmarks/backfill-articles", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("backfillArticlesFailed"));
        return;
      }
      setSyncMessage(
        t("backfillArticlesMessage", {
          a: data.withArticle,
          u: data.updated,
          calls: data.apiCalls,
          m: data.missing,
        })
      );
      await loadBookmarks(selectedCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchLinkPreviews() {
    setLoading(true);
    setError("");
    setSyncMessage(t("fetchLinksWorking"));
    try {
      const res = await fetch("/api/links/backfill", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("fetchLinksFailed"));
        return;
      }
      setSyncMessage(
        t("fetchLinksMessage", {
          ok: data.ok,
          failed: data.failed,
          fetched: data.fetched,
          total: data.totalUrls,
        })
      );
      await loadBookmarks(selectedCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCategorySelect(cat: string) {
    setSelectedCategory(cat);
    await loadBookmarks(cat);
  }

  async function handleCategoryChange(id: string, category: string) {
    await fetch("/api/bookmarks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category }),
    });
    await loadBookmarks(selectedCategory);
  }

  const displayCategories = Object.keys(counts).sort((a, b) => {
    if (a === "uncategorized") return 1;
    if (b === "uncategorized") return -1;
    return (counts[b] || 0) - (counts[a] || 0);
  });

  const selectedBookmark = bookmarks.find((b) => b.id === selectedBookmarkId) || null;
  const detailOpen = !!selectedBookmark;
  // Reserve space for the detail drawer so cards slide left instead of being covered.
  const shiftClass = detailOpen ? "md:pr-[520px] lg:pr-[580px]" : "";

  return (
    <div className="min-h-screen">
      <header className={`bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 transition-[padding] duration-200 ${shiftClass}`}>
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("appTitle")}</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLang(lang === "en" ? "zh" : "en")}
                title={t("toggleLang")}
                className="h-9 px-2.5 flex items-center justify-center border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-medium"
                aria-label="Toggle language"
              >
                {lang === "en" ? "中" : "EN"}
              </button>
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? t("toggleThemeLight") : t("toggleThemeDark")}
                className="w-9 h-9 flex items-center justify-center border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setShowCategoryManager(true)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t("manageRules")}
              </button>
              <SyncButton
                loading={loading}
                onSync={handleSync}
                onReclassify={handleReclassify}
                onBackfillMedia={handleBackfillMedia}
                onFetchLinkPreviews={handleFetchLinkPreviews}
                onBackfillArticles={handleBackfillArticles}
                disabled={!authenticated}
                authDisabled={!authenticated}
              />
              {authenticated ? (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {t("connected")}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-200 dark:border-red-900/60 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    {t("logout")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGetAuthUrl}
                  className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200"
                >
                  {t("authorize")}
                </button>
              )}
            </div>
          </div>

          {authUrl && !authenticated && (
            <div className="mt-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300 mb-2 font-medium">
                {t("authPromptIntro")}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={authUrl}
                  className="flex-1 px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-900 rounded-lg font-mono select-all text-gray-800 dark:text-gray-200"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(authUrl)}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                >
                  {t("copy")}
                </button>
                <a
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm border border-blue-300 dark:border-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950 whitespace-nowrap"
                >
                  {t("open")}
                </a>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                {t("authRedirectNote")}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {syncMessage && (
            <div className="mt-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 rounded-lg px-3 py-2">
              {syncMessage}
            </div>
          )}
        </div>
      </header>

      <main className={`w-full px-6 py-6 transition-[padding] duration-200 ${shiftClass}`}>
        {displayCategories.length > 0 && (
          <div className="mb-6">
            <CategoryFilter
              categories={displayCategories}
              counts={counts}
              selected={selectedCategory}
              onSelect={handleCategorySelect}
            />
          </div>
        )}

        {bookmarks.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">
            <p className="text-lg mb-2">{t("emptyNoBookmarks")}</p>
            <p className="text-sm">
              {authenticated ? t("emptyNeedSync") : t("emptyNeedAuth")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 justify-start grid-cols-[repeat(auto-fill,400px)]">
            {bookmarks.map((bm) => (
              <BookmarkCard
                key={bm.id}
                id={bm.id}
                text={bm.text}
                authorName={bm.author_name}
                authorUsername={bm.author_username}
                createdAt={bm.created_at}
                category={bm.category}
                mediaUrls={bm.media_urls}
                localMedia={bm.local_media}
                categories={allCategories}
                onCategoryChange={handleCategoryChange}
                onOpen={() => setSelectedBookmarkId(bm.id)}
              />
            ))}
          </div>
        )}
      </main>

      <CategoryManager
        open={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        onRulesChange={() => loadBookmarks(selectedCategory)}
      />

      <BookmarkDetail
        bookmark={selectedBookmark}
        categories={allCategories}
        linkPreviews={linkPreviews}
        onClose={() => setSelectedBookmarkId(null)}
        onCategoryChange={handleCategoryChange}
      />
    </div>
  );
}
