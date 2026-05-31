# BookmarkFold Mobile

Expo React Native client for BookmarkFold. This is the shared Android/iOS mobile codebase.

## Development

```bash
cd mobile
npm run android
```

`npm run android` creates/runs a development build, which is required for the `bookmarkfold://auth` OAuth callback scheme.

If the first Android build appears stuck in Kotlin/Gradle, use the deterministic build path:

```bash
cd mobile
npm run android:build
npm run android:reinstall
npm run start
```

If `adb install` reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the emulator still has the old Kotlin debug app installed. `npm run android:reinstall` removes that emulator copy and installs the Expo debug build.

The Android helper scripts set `JAVA_HOME`, `ANDROID_HOME`, and `PATH` for the Homebrew SDK/JDK layout used on this machine, so they also work from non-login shells.

Optional API override:

```bash
EXPO_PUBLIC_API_BASE_URL=https://x-bookmarks-manager.vercel.app npm run android
```

The default API base is `https://x-bookmarks-manager.vercel.app`.

## OAuth

The app uses `bookmarkfold://auth` as the mobile callback. X OAuth still redirects to the cloud callback:

```text
https://x-bookmarks-manager.vercel.app/api/auth/callback
```

The cloud callback exchanges the X token server-side, creates a one-time mobile login code, and redirects back to `bookmarkfold://auth?code=...`.

## Checks

```bash
npm run typecheck
npx expo-doctor
```

## EAS builds

After signing in to Expo/EAS and connecting the project:

```bash
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
```

Use `preview` for installable APK/internal testing and `production` for Google Play AAB.
