#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "============================================="
echo "   Gym Rep Counter - Dev Rebuild Script      "
echo "============================================="

echo "1. Configuring Apple Developer Team ID..."
node scripts/set-team-id.js

echo "2. Linking native modules (pod install)..."
# Ensures native modules added to package.json (e.g. expo-clipboard) are actually
# compiled into the binary. xcodebuild does NOT do this on its own, so skipping it
# leaves the app crashing/failing when JS calls a native module that isn't linked.
(cd ios && pod install)

echo "3. Building iOS App for Device (Release Mode)..."
# We use xcodebuild directly to pass -allowProvisioningUpdates which fixes signing issues
xcodebuild -workspace ios/repcounterapp.xcworkspace \
  -scheme repcounterapp \
  -configuration Release \
  -destination 'id=00008130-000215120A8B803A' \
  -allowProvisioningUpdates \
  -derivedDataPath build

echo "4. Installing app to iPhone..."
# Install and launch the newly built release app using devicectl (supports Wi-Fi natively)
xcrun devicectl device install app --device 00008130-000215120A8B803A build/Build/Products/Release-iphoneos/repcounterapp.app || echo "Failed to install."
xcrun devicectl device process launch --device 00008130-000215120A8B803A com.ganganimaulik.repcounterapp || echo "Failed to launch, but installed."

echo "============================================="
echo "Build complete! You can now unplug your phone"
echo "and use the app without your laptop."
echo "============================================="
