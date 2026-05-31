#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/android-env.sh

APK="android/app/build/outputs/apk/debug/app-debug.apk"

if [[ ! -f "$APK" ]]; then
  echo "Missing $APK. Run npm run android:build first." >&2
  exit 1
fi

adb uninstall com.zzyjoinci.xbookmarks >/dev/null 2>&1 || true
adb install "$APK"
