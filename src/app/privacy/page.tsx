export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">BookmarkFold Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-600">Last updated: May 31, 2026</p>

        <section className="mt-8 space-y-4">
          <p>
            BookmarkFold helps you organize bookmarks saved from your X account.
            The app uses X OAuth to access your bookmarks only after you sign in.
          </p>
          <p>
            We store your X account identifier, username, OAuth tokens, bookmark
            content, bookmark categories, and related metadata in our cloud
            database so the Android app can sync and display your saved posts.
          </p>
          <p>
            OAuth tokens are stored only on the server. The mobile app stores an
            app session token locally using Android encrypted storage.
          </p>
          <p>
            We do not sell your personal data. Data is used to provide login,
            bookmark sync, categorization, and reading features.
          </p>
          <p>
            To request deletion of your account data, contact the project owner
            through the support channel listed in the app store listing.
          </p>
        </section>
      </div>
    </main>
  );
}
