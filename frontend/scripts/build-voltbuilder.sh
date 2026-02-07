#!/bin/bash
# Build script for VoltBuilder iOS & Android deployment
# Creates TWO zip packages ready for upload to volt.build:
#   - iOS: includes Capacitor ios/ project directory
#   - Android: pure Cordova structure with www/ (required for icon generation)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$FRONTEND_DIR")"

cd "$FRONTEND_DIR"

echo "=== Warmly VoltBuilder Build Script (iOS + Android) ==="
echo ""

# Step 0: Auto-increment build number
echo "[0/6] Incrementing build number..."
CURRENT_BUILD=$(grep -o '"build": "[0-9]*"' voltbuilder.json | grep -o '[0-9]*')
NEW_BUILD=$((CURRENT_BUILD + 1))
sed -i "s/\"build\": \"$CURRENT_BUILD\"/\"build\": \"$NEW_BUILD\"/" voltbuilder.json
sed -i "s/\"buildNumber\": \"$CURRENT_BUILD\"/\"buildNumber\": \"$NEW_BUILD\"/" voltbuilder.json
sed -i "s/\"versionCode\": \"$CURRENT_BUILD\"/\"versionCode\": \"$NEW_BUILD\"/" voltbuilder.json
# Also update ios-CFBundleVersion and android-versionCode in config.xml
sed -i "s/ios-CFBundleVersion=\"[0-9]*\"/ios-CFBundleVersion=\"$NEW_BUILD\"/" config.xml
sed -i "s/android-versionCode=\"[0-9]*\"/android-versionCode=\"$NEW_BUILD\"/" config.xml
# Update CURRENT_PROJECT_VERSION in Xcode project
if [ -f "ios/App/App.xcodeproj/project.pbxproj" ]; then
    sed -i "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $NEW_BUILD;/g" ios/App/App.xcodeproj/project.pbxproj
fi
echo "  Build number: $CURRENT_BUILD -> $NEW_BUILD"

# Step 1: Check for required files
echo "[1/6] Checking required files..."

if [ ! -f "voltbuilder.json" ]; then
    echo "Error: voltbuilder.json not found"
    exit 1
fi

if [ ! -f "config.xml" ]; then
    echo "Error: config.xml not found"
    exit 1
fi

# Check for at least one icon
if [ ! -f "public/icons/icon-1024.png" ]; then
    echo "Warning: App icons not found. Run ./scripts/generate-icons.sh first."
fi

echo "  Required configuration files found."

# Step 2: Install dependencies if needed
echo ""
echo "[2/6] Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install
else
    echo "  Dependencies already installed."
fi

# Step 3: Build the frontend
echo ""
echo "[3/6] Building frontend..."
npm run build

if [ ! -d "dist" ]; then
    echo "Error: Build failed - dist directory not created"
    exit 1
fi

# Step 4: Copy icons to dist
echo ""
echo "[4/6] Copying assets to dist..."
if [ -d "public/icons" ]; then
    cp -r public/icons dist/
    echo "  Icons copied."
else
    echo "  Warning: No icons to copy."
fi

# Step 5: Sync iOS platform
echo ""
echo "[5/6] Syncing iOS platform..."

if [ ! -d "ios" ]; then
    echo "  Adding iOS platform..."
    ./node_modules/.bin/cap add ios 2>/dev/null || true
fi
if [ -d "ios" ]; then
    ./node_modules/.bin/cap sync ios
    echo "  iOS project synced."
    # Copy app icon to Xcode assets
    if [ -f "public/icons/icon-1024.png" ] && [ -d "ios/App/App/Assets.xcassets/AppIcon.appiconset" ]; then
        cp public/icons/icon-1024.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
    fi
fi

# Step 6: Create VoltBuilder packages
echo ""
echo "[6/6] Creating VoltBuilder packages..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create certificates directory and copy certificates
mkdir -p certificates

# iOS certificates - check both project root and certificates/ subdirectory
if [ -f "$PROJECT_DIR/ios_distribution.p12" ]; then
    cp "$PROJECT_DIR/ios_distribution.p12" certificates/
    echo "  Including iOS distribution certificate."
elif [ -f "$PROJECT_DIR/certificates/ios_distribution.p12" ]; then
    cp "$PROJECT_DIR/certificates/ios_distribution.p12" certificates/
    echo "  Including iOS distribution certificate."
else
    echo "  Warning: ios_distribution.p12 not found"
fi

if [ -f "$PROJECT_DIR/MyWarmly_App_profile.mobileprovision" ]; then
    cp "$PROJECT_DIR/MyWarmly_App_profile.mobileprovision" certificates/
    echo "  Including iOS provisioning profile."
elif [ -f "$PROJECT_DIR/certificates/MyWarmly_App_profile.mobileprovision" ]; then
    cp "$PROJECT_DIR/certificates/MyWarmly_App_profile.mobileprovision" certificates/
    echo "  Including iOS provisioning profile."
else
    echo "  Warning: MyWarmly_App_profile.mobileprovision not found"
fi

# Android keystore - check both project root and certificates/ subdirectory
if [ -f "$PROJECT_DIR/android.p12" ]; then
    cp "$PROJECT_DIR/android.p12" certificates/
    echo "  Including Android keystore."
elif [ -f "$PROJECT_DIR/certificates/android.p12" ]; then
    cp "$PROJECT_DIR/certificates/android.p12" certificates/
    echo "  Including Android keystore."
else
    echo "  Warning: android.p12 not found"
fi

# --- iOS Package (Capacitor structure with ios/ directory) ---
IOS_PACKAGE_NAME="warmly-ios-${TIMESTAMP}.zip"
IOS_PACKAGE_PATH="$PROJECT_DIR/$IOS_PACKAGE_NAME"

IOS_ZIP_CONTENTS=(
    voltbuilder.json
    config.xml
    dist/
    certificates/
    resources/
)

if [ -d "ios" ]; then
    IOS_ZIP_CONTENTS+=(ios/)
fi

if [ -f "capacitor.config.json" ]; then
    IOS_ZIP_CONTENTS+=(capacitor.config.json)
fi

zip -r "$IOS_PACKAGE_PATH" \
    "${IOS_ZIP_CONTENTS[@]}" \
    -x "*.DS_Store" \
    -x "__MACOSX/*" \
    -x "ios/App/Pods/*" \
    -x "*.xcworkspace/xcuserdata/*"

echo "  iOS package created: $IOS_PACKAGE_NAME"

# --- Android Package (pure Cordova structure with www/) ---
ANDROID_PACKAGE_NAME="warmly-android-${TIMESTAMP}.zip"
ANDROID_PACKAGE_PATH="$PROJECT_DIR/$ANDROID_PACKAGE_NAME"

# Create temporary www/ directory (Cordova standard)
rm -rf /tmp/warmly-android-build
mkdir -p /tmp/warmly-android-build
cp -r dist/* /tmp/warmly-android-build/

# Build the Android zip with www/ instead of dist/
# We need to create this from a temp directory to get the www/ structure
ANDROID_STAGING="/tmp/warmly-android-staging"
rm -rf "$ANDROID_STAGING"
mkdir -p "$ANDROID_STAGING"
cp -r dist "$ANDROID_STAGING/www"
cp voltbuilder.json "$ANDROID_STAGING/"
cp config.xml "$ANDROID_STAGING/"
cp -r resources "$ANDROID_STAGING/"
cp -r certificates "$ANDROID_STAGING/"

cd "$ANDROID_STAGING"
zip -r "$ANDROID_PACKAGE_PATH" \
    voltbuilder.json \
    config.xml \
    www/ \
    certificates/ \
    resources/ \
    -x "*.DS_Store" \
    -x "__MACOSX/*"

cd "$FRONTEND_DIR"
rm -rf "$ANDROID_STAGING" /tmp/warmly-android-build

echo "  Android package created: $ANDROID_PACKAGE_NAME"

# Clean up
rm -rf certificates

echo ""
echo "=== Build Complete ==="
echo ""
echo "Packages created:"
echo "  iOS:     $PROJECT_DIR/$IOS_PACKAGE_NAME"
echo "  Android: $PROJECT_DIR/$ANDROID_PACKAGE_NAME"
echo ""
echo "Next steps:"
echo "  1. Go to https://volt.build"
echo "  2. Upload iOS package for iOS build"
echo "  3. Upload Android package for Android build"
