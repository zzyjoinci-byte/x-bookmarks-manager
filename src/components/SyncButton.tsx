"use client";

interface SyncButtonProps {
  loading: boolean;
  onSync: () => void;
  onReclassify: () => void;
  disabled: boolean;
}

export default function SyncButton({ loading, onSync, onReclassify, disabled }: SyncButtonProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onSync}
        disabled={disabled || loading}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Syncing...
          </>
        ) : (
          "Sync Bookmarks"
        )}
      </button>
      <button
        onClick={onReclassify}
        disabled={loading}
        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Re-classify All
      </button>
    </div>
  );
}
