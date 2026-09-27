#!/usr/bin/env bash
# Builds Ngopu for the iOS Simulator and zips it for tapflow's App Center (macOS + Xcode only).
# Output: build/ngopu-ios-sim.app.zip
set -euo pipefail
cd "$(dirname "$0")/.."

npm run cap:sync

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/ios-sim \
  CODE_SIGNING_ALLOWED=NO \
  build

APP="build/ios-sim/Build/Products/Debug-iphonesimulator/App.app"
rm -f build/ngopu-ios-sim.app.zip
ditto -c -k --sequesterRsrc --keepParent "$APP" build/ngopu-ios-sim.app.zip
echo "Ready: build/ngopu-ios-sim.app.zip (upload it in tapflow's App Center)"
