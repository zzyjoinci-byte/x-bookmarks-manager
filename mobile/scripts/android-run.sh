#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/android-env.sh

npx expo run:android
