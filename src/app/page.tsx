"use client";

import { useState, useEffect } from "react";
import SyncButton from "@/components/SyncButton";
import CategoryFilter from "@/components/CategoryFilter";
import BookmarkCard from "@/components/BookmarkCard";
import CategoryManager from "@/components/CategoryManager";

interface Bookmark {
  id: string;
  text: string;
  author_id: string;
  author_name: string;
  author_username: string;
  created_at: string;
  category: string;
  media_urls: string;
  bookmarked_at: string;
}

export default function Home() {
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

  useEffect(() => {
    loadBookmarks();

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      setSyncMessage("Authorization successful! You can now sync bookmarks.");
      setAuthenticated(true);
      setAuthUrl("");
      window.history.replaceState({}, "", "/");
      return;
    }
    if (params.get("error")) {
      setError(`Auth error: ${params.get("error")}`);
      window.history.replaceState({}, "", "/");
    }

    checkAuth();
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
  }

  async function handleSync() {
    setLoading(true);
    setError("");
    setSyncMessage("");
    try {
      const res = await fetch("/api/bookmarks", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sync failed");
        return;
      }
      setBookmarks(data.bookmarks || []);
      setCounts(data.counts || {});
      setAllCategories(data.allCategories || []);
      const earlyMsg = data.stoppedEarly ? " (stopped early, all caught up)" : "";
      setSyncMessage(`Synced ${data.synced} new bookmarks, ${data.apiCalls} API call(s)${earlyMsg}`);
      setSelectedCategory("all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
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
      setSyncMessage(`Re-classified ${data.reclassified} bookmarks`);
      setSelectedCategory("all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
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

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">X Bookmarks Manager</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCategoryManager(true)}
                className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Manage Rules
              </button>
              <SyncButton
                loading={loading}
                onSync={handleSync}
                onReclassify={handleReclassify}
                disabled={!authenticated}
              />
              {authenticated ? (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Connected
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGetAuthUrl}
                  className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800"
                >
                  Authorize with X
                </button>
              )}
            </div>
          </div>

          {authUrl && !authenticated && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-2 font-medium">
                Please open this link in a browser where you are already logged into X:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={authUrl}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-blue-300 rounded-lg font-mono select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(authUrl)}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                >
                  Copy
                </button>
                <a
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 whitespace-nowrap"
                >
                  Open
                </a>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                After you authorize, you will be redirected back here automatically.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {syncMessage && (
            <div className="mt-3 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
              {syncMessage}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
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
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">No bookmarks yet</p>
            <p className="text-sm">
              {authenticated
                ? 'Click "Sync Bookmarks" to fetch your bookmarks from X.'
                : 'Click "Authorize with X" to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                categories={allCategories}
                onCategoryChange={handleCategoryChange}
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
    </div>
  );
}
