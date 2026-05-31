#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/android-env.sh

npx expo prebuild --platform android

cd android
./gradlew app:assembleDebug \
  -x lint \
  -x test \
  --configure-on-demand \
  --build-cache \
  -PreactNativeDevServerPort=8081 \
  -PreactNativeArchitectures=arm64-v8a \
  -Dkotlin.compiler.execution.strategy=in-process \
  --no-daemon \
  --console=plain
