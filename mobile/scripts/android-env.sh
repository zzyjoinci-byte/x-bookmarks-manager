#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -d /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ]]; then
    export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
  elif [[ -d /usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ]]; then
    export JAVA_HOME=/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
  fi
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -d /opt/homebrew/share/android-commandlinetools ]]; then
    export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
  elif [[ -d "$HOME/Library/Android/sdk" ]]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  fi
fi

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
export PATH="${JAVA_HOME:-}/bin:${ANDROID_HOME:-}/platform-tools:${ANDROID_HOME:-}/emulator:${ANDROID_HOME:-}/cmdline-tools/latest/bin:$PATH"

if ! command -v java >/dev/null 2>&1; then
  echo "Java runtime not found. Install OpenJDK 17 or set JAVA_HOME." >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Install Android SDK platform-tools or set ANDROID_HOME." >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found. Install Node.js/npm." >&2
  exit 1
fi
