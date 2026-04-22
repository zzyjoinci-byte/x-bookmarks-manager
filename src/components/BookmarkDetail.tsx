"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  type BookmarkShape,
  type LinkPreviewLike,
  parseRawTweet,
  parseJsonArray,
  resolveImageSrc,
  getFullText,
  extractExternalLinks,
  buildShortLinkMap,
} from "@/lib/bookmark-shape";
import { categoryColorClass, categoryDotClass } from "@/lib/category-colors";
import { useT } from "@/lib/language-context";

interface BookmarkDetailProps {
  bookmark: BookmarkShape | null;
  categories: string[];
  linkPreviews: Record<string, LinkPreviewLike>;
  onClose: () => void;
  onCategoryChange: (id: string, category: string) => void;
}

function formatDateTime(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TextSegment =
  | { kind: "text"; value: string }
  | { kind: "link"; href: string; label: string };

function renderSegments(
  text: string,
  shortLinks: Record<string, { expanded: string; display: string }>
): TextSegment[] {
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const parts: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    const found = match[0];
    const mapped = shortLinks[found];
    if (mapped) {
      parts.push({ kind: "link", href: mapped.expanded, label: mapped.display });
    } else {
      parts.push({ kind: "link", href: found, label: found });
    }
    lastIndex = match.index + found.length;
  }
  if (lastIndex < text.length) parts.push({ kind: "text", value: text.slice(lastIndex) });
  return parts;
}

export default function BookmarkDetail({
  bookmark,
  categories,
  linkPreviews,
  onClose,
  onCategoryChange,
}: BookmarkDetailProps) {
  const { t, lang, categoryLabel } = useT();
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedExcerpts, setExpandedExcerpts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!bookmark) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [bookmark, onClose]);

  useEffect(() => {
    setShowDropdown(false);
    setExpandedExcerpts({});
  }, [bookmark?.id]);

  const raw = useMemo(() => parseRawTweet(bookmark?.raw_json), [bookmark?.raw_json]);
  const shortLinks = useMemo(
    () => buildShortLinkMap(raw, linkPreviews, bookmark?.text),
    [raw, linkPreviews, bookmark?.text]
  );
  const links = useMemo(
    () => extractExternalLinks(raw, linkPreviews, bookmark?.text),
    [raw, linkPreviews, bookmark?.text]
  );
  const images = useMemo(() => parseJsonArray(bookmark?.media_urls), [bookmark?.media_urls]);
  const localImages = useMemo(() => parseJsonArray(bookmark?.local_media), [bookmark?.local_media]);

  if (!mounted || !bookmark) return null;

  const fullText = getFullText(bookmark);
  const segments = renderSegments(fullText, shortLinks);
  const metrics = raw.public_metrics;
  const article = raw.article;
  const articleBody = article?.plain_text || "";
  const articleSegments = articleBody ? renderSegments(articleBody, shortLinks) : [];
  // Collect referenced tweets that carry additional long-form content. The
  // bookmarked tweet is often just a quote-reply ("good article!") while the
  // real body lives on the referenced tweet.
  const referencedContent = (raw._referenced || [])
    .map((r) => {
      const body = r.article?.plain_text || r.note_tweet?.text || "";
      const title = r.article?.title;
      if (!body && !title) return null;
      return {
        id: r.id || "",
        title,
        body,
        author: r._author,
        isArticle: !!r.article?.plain_text,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const allOptions = [...categories.filter((c) => c !== "uncategorized"), "uncategorized"];

  return createPortal(
    <aside
      className="fixed top-0 right-0 h-full w-full md:w-[520px] lg:w-[580px] bg-white dark:bg-gray-950 shadow-2xl flex flex-col z-40 border-l border-gray-200 dark:border-gray-800 animate-[slideIn_0.2s_ease-out]"
      role="complementary"
      aria-label="书签详情"
    >
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{t("bookmarkDetails")}</h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://x.com/${bookmark.author_username}/status/${bookmark.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-2.5 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              {t("viewOnX")} ↗
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
              aria-label={t("close")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{bookmark.author_name}</div>
                <a
                  href={`https://x.com/${bookmark.author_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  @{bookmark.author_username}
                </a>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {formatDateTime(bookmark.created_at, locale)}
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowDropdown((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${categoryColorClass(
                  bookmark.category
                )} hover:opacity-80`}
              >
                {categoryLabel(bookmark.category)}
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showDropdown && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto z-10">
                  {allOptions.map((c) => {
                    const isActive = c === bookmark.category;
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          if (c !== bookmark.category) onCategoryChange(bookmark.id, c);
                          setShowDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                          isActive ? "bg-gray-50 dark:bg-gray-800 font-semibold" : ""
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${categoryDotClass(c)}`} />
                        <span>{categoryLabel(c)}</span>
                        {isActive && (
                          <svg className="w-3.5 h-3.5 ml-auto text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[15px] leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
              {segments.map((seg, i) =>
                seg.kind === "text" ? (
                  <span key={i}>{seg.value}</span>
                ) : (
                  <a
                    key={i}
                    href={seg.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {seg.label}
                  </a>
                )
              )}
            </p>

            {article && (articleBody || article.title) && (
              <section className="border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide bg-amber-100 dark:bg-amber-900/50 rounded-full px-2 py-0.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {t("xArticle")}
                  </span>
                </div>
                {article.title && (
                  <h2 className="text-lg font-bold leading-snug text-gray-900 dark:text-gray-50">
                    {article.title}
                  </h2>
                )}
                {articleBody ? (
                  <div className="text-[14px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {articleSegments.map((seg, i) =>
                      seg.kind === "text" ? (
                        <span key={i}>{seg.value}</span>
                      ) : (
                        <a
                          key={i}
                          href={seg.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {seg.label}
                        </a>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {t("noArticleYet")}
                  </p>
                )}
              </section>
            )}

            {referencedContent.map((ref) => {
              const refSegments = renderSegments(ref.body, shortLinks);
              const label = ref.isArticle ? t("quotedArticle") : t("quotedTweet");
              return (
                <section
                  key={ref.id}
                  className="border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide bg-amber-100 dark:bg-amber-900/50 rounded-full px-2 py-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      {label}
                    </span>
                    {ref.author?.username && ref.id && (
                      <a
                        href={`https://x.com/${ref.author.username}/status/${ref.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                      >
                        {ref.author.name || ref.author.username} · @{ref.author.username} ↗
                      </a>
                    )}
                  </div>
                  {ref.title && (
                    <h2 className="text-lg font-bold leading-snug text-gray-900 dark:text-gray-50">
                      {ref.title}
                    </h2>
                  )}
                  {ref.body && (
                    <div className="text-[14px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                      {refSegments.map((seg, i) =>
                        seg.kind === "text" ? (
                          <span key={i}>{seg.value}</span>
                        ) : (
                          <a
                            key={i}
                            href={seg.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                          >
                            {seg.label}
                          </a>
                        )
                      )}
                    </div>
                  )}
                </section>
              );
            })}

            {images.length > 0 && (
              <div className="space-y-2">
                {images.map((url, i) => (
                  <a
                    key={i}
                    href={resolveImageSrc(url, localImages[i])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={resolveImageSrc(url, localImages[i])}
                      alt=""
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-800 object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
                {localImages.length > 0 && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {t("localizedMedia", { local: localImages.length, total: images.length })}
                  </p>
                )}
              </div>
            )}

            {links.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t("externalLinks")}
                </h3>
                {links.map((link) => {
                  const hasRichData = !!(link.title || link.description || link.image || link.excerpt);
                  const excerptExpanded = expandedExcerpts[link.url];
                  return (
                    <div
                      key={link.url}
                      className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:bg-gray-50 dark:hover:bg-gray-900"
                      >
                        {link.image && (
                          <img
                            src={link.image}
                            alt=""
                            className="w-full h-40 object-cover bg-gray-100 dark:bg-gray-800"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <div className="p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            {link.siteName && (
                              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                                {link.siteName}
                              </span>
                            )}
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                              {link.displayUrl}
                            </span>
                          </div>
                          {link.title && (
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                              {link.title}
                            </div>
                          )}
                          {link.description && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">
                              {link.description}
                            </div>
                          )}
                          {!hasRichData && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {t("noPreview")}
                            </div>
                          )}
                        </div>
                      </a>
                      {link.excerpt && link.excerpt !== link.description && (
                        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedExcerpts((m) => ({ ...m, [link.url]: !m[link.url] }));
                            }}
                            className="text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 mb-1 flex items-center gap-1"
                          >
                            <svg
                              className={`w-3 h-3 transition-transform ${excerptExpanded ? "rotate-90" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {t("articleExcerpt")}
                          </button>
                          {excerptExpanded && (
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                              {link.excerpt}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {metrics && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3">
                {typeof metrics.like_count === "number" && (
                  <span>❤ {metrics.like_count.toLocaleString()}</span>
                )}
                {typeof metrics.reply_count === "number" && (
                  <span>💬 {metrics.reply_count.toLocaleString()}</span>
                )}
                {typeof metrics.retweet_count === "number" && (
                  <span>🔁 {metrics.retweet_count.toLocaleString()}</span>
                )}
                {typeof metrics.quote_count === "number" && (
                  <span>❝ {metrics.quote_count.toLocaleString()}</span>
                )}
                {typeof metrics.bookmark_count === "number" && (
                  <span>🔖 {metrics.bookmark_count.toLocaleString()}</span>
                )}
              </div>
            )}

            <div className="text-[11px] text-gray-400 dark:text-gray-500 pt-2">
              {t("savedOn", { date: formatDateTime(bookmark.bookmarked_at, locale) })}
            </div>
          </div>
        </div>
    </aside>,
    document.body
  );
}
