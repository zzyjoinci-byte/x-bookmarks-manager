#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/android-env.sh

npx expo prebuild --platform android

cd android
./gradlew app:assembleRelease \
  -x lint \
  -x test \
  --configure-on-demand \
  --build-cache \
  -PreactNativeArchitectures=arm64-v8a \
  -Dkotlin.compiler.execution.strategy=in-process \
  --no-daemon \
  --console=plain

adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am force-stop com.zzyjoinci.xbookmarks
adb shell am start -n com.zzyjoinci.xbookmarks/.MainActivity
