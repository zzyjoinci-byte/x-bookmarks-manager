#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm run typecheck
npx expo-doctor
npx expo config --type public --json >/tmp/bookmarkfold-expo-config.json

node <<'NODE'
const fs = require("node:fs");
const config = JSON.parse(fs.readFileSync("/tmp/bookmarkfold-expo-config.json", "utf8"));
const expo = config.expo || config;
const required = {
  name: expo.name,
  slug: expo.slug,
  scheme: expo.scheme,
  androidPackage: expo.android?.package,
  iosBundleIdentifier: expo.ios?.bundleIdentifier,
};

for (const [key, value] of Object.entries(required)) {
  if (!value) {
    throw new Error(`Missing Expo config value: ${key}`);
  }
}

console.log("Expo config OK", required);
NODE
