"use client";

import { useT } from "@/lib/language-context";

interface SyncButtonProps {
  loading: boolean;
  onSync: () => void;
  onReclassify: () => void;
  onBackfillMedia: () => void;
  onFetchLinkPreviews: () => void;
  onBackfillArticles: () => void;
  disabled: boolean;
  authDisabled: boolean;
}

export default function SyncButton({
  loading,
  onSync,
  onReclassify,
  onBackfillMedia,
  onFetchLinkPreviews,
  onBackfillArticles,
  disabled,
  authDisabled,
}: SyncButtonProps) {
  const { t } = useT();
  return (
    <div className="flex gap-2">
      <button
        onClick={onSync}
        disabled={disabled || loading}
        className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white dark:border-gray-900 border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
            {t("syncing")}
          </>
        ) : (
          t("sync")
        )}
      </button>
      <button
        onClick={onReclassify}
        disabled={loading}
        className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("reclassify")}
      </button>
      <button
        onClick={onBackfillMedia}
        disabled={loading}
        title={t("backfillMediaHint")}
        className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("backfillMedia")}
      </button>
      <button
        onClick={onFetchLinkPreviews}
        disabled={loading}
        title={t("fetchLinksHint")}
        className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("fetchLinks")}
      </button>
      <button
        onClick={onBackfillArticles}
        disabled={loading || authDisabled}
        title={t("backfillArticlesHint")}
        className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("backfillArticles")}
      </button>
    </div>
  );
}
