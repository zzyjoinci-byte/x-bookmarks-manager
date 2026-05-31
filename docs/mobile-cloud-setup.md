# BookmarkFold Mobile Cloud Setup

This project now supports a cloud-backed mobile API for Android first, with iOS able to reuse the same endpoints later.

## 1. Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Copy the project URL and service role key into Vercel environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The service role key must stay server-side only. Do not put it in the Android app.

## 2. X Developer Portal

Configure OAuth 2.0 with:

```bash
X_CLIENT_ID=your_x_client_id
X_REDIRECT_URI=https://your-vercel-domain.vercel.app/api/auth/callback
MOBILE_APP_REDIRECT_URI=bookmarkfold://auth
```

Required scopes:

```text
bookmark.read tweet.read users.read offline.access
```

## 3. Vercel

Deploy the Next.js app with the same environment variables. The mobile API lives under:

```text
/api/mobile/auth/start
/api/mobile/auth/exchange
/api/mobile/auth/me
/api/mobile/auth/logout
/api/mobile/bookmarks
/api/mobile/bookmarks/:id
/api/mobile/sync
/api/mobile/classify
```

## 4. Android

Open `android/` in Android Studio. Set the Gradle properties for your deployed API URL:

```bash
gradle assembleDebug -PAPI_BASE_URL=https://your-vercel-domain.vercel.app/ -PPRIVACY_POLICY_URL=https://your-domain/privacy
```

If you build from Android Studio, add the same values as Gradle properties or replace the defaults in `android/app/build.gradle.kts` for local testing.

The app handles the `bookmarkfold://auth` deep link and stores the session token in encrypted shared preferences.

## 5. Release Notes

- v1 does not migrate local SQLite data.
- v1 syncs fresh data from X into Supabase.
- v1 stores X OAuth tokens only in the cloud backend.
- v1 stores X media URLs, not copied media files.
- v1 includes the legal link surface needed for Google Play privacy disclosure, but you still need to host the actual privacy policy URL.
