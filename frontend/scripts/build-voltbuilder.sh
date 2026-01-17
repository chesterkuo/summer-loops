#!/bin/bash
# Build script for VoltBuilder iOS deployment
# Creates a zip package ready for upload to volt.build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$FRONTEND_DIR")"

cd "$FRONTEND_DIR"

echo "=== Warmly VoltBuilder Build Script ==="
echo ""

# Step 0: Auto-increment build number
echo "[0/6] Incrementing build number..."
CURRENT_BUILD=$(grep -o '"build": "[0-9]*"' voltbuilder.json | grep -o '[0-9]*')
NEW_BUILD=$((CURRENT_BUILD + 1))
sed -i "s/\"build\": \"$CURRENT_BUILD\"/\"build\": \"$NEW_BUILD\"/" voltbuilder.json
sed -i "s/\"buildNumber\": \"$CURRENT_BUILD\"/\"buildNumber\": \"$NEW_BUILD\"/" voltbuilder.json
echo "  Build number: $CURRENT_BUILD -> $NEW_BUILD"

# Step 1: Check for required files
echo "[1/6] Checking required files..."

if [ ! -f "voltbuilder.json" ]; then
    echo "Error: voltbuilder.json not found"
    exit 1
fi

if [ ! -f "capacitor.config.json" ]; then
    echo "Error: capacitor.config.json not found"
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

# Step 5: Sync iOS project
echo ""
echo "[5/6] Syncing iOS project..."
if [ ! -d "ios" ]; then
    echo "  Adding iOS platform..."
    ./node_modules/.bin/cap add ios
fi
./node_modules/.bin/cap sync ios
echo "  iOS project synced."

# Copy app icon to Xcode assets
cp public/icons/icon-1024.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png

# Step 6: Create VoltBuilder package
echo ""
echo "[6/6] Creating VoltBuilder package..."

PACKAGE_NAME="warmly-voltbuilder-$(date +%Y%m%d-%H%M%S).zip"
PACKAGE_PATH="$PROJECT_DIR/$PACKAGE_NAME"

# Create VoltBuilder-specific package.json (no TypeScript build)
cat > package.voltbuilder.json << 'PKGJSON'
{
  "name": "warmly-mobile",
  "version": "1.0.0",
  "description": "Warmly - Personal CRM",
  "scripts": {
    "build": "echo 'Build handled by Vite'"
  },
  "dependencies": {
    "@capacitor/android": "^7.4.4",
    "@capacitor/core": "^7.4.4",
    "@capacitor/ios": "^7.4.4",
    "@capacitor/splash-screen": "^7.0.3",
    "@capacitor/status-bar": "^7.0.3"
  },
  "devDependencies": {
    "@capacitor/cli": "^7.4.4"
  }
}
PKGJSON

# Create certificates directory and copy certificates
mkdir -p certificates
if [ -f "$PROJECT_DIR/certificates/ios_distribution.p12" ]; then
    cp "$PROJECT_DIR/certificates/ios_distribution.p12" certificates/
    echo "  Including iOS distribution certificate."
fi
if [ -f "$PROJECT_DIR/certificates/MyWarmly_App_profile.mobileprovision" ]; then
    cp "$PROJECT_DIR/certificates/MyWarmly_App_profile.mobileprovision" certificates/
    echo "  Including provisioning profile."
fi

# Create the zip with required structure (matching reference project)
# Use VoltBuilder-specific package.json
zip -r "$PACKAGE_PATH" \
    voltbuilder.json \
    capacitor.config.json \
    config.xml \
    dist/ \
    ios/ \
    certificates/ \
    -x "*.DS_Store" \
    -x "__MACOSX/*" \
    -x "ios/App/Pods/*" \
    -x "*.xcworkspace/xcuserdata/*"

# Add the VoltBuilder package.json (renamed from package.voltbuilder.json)
zip -j "$PACKAGE_PATH" package.voltbuilder.json
# Rename inside zip
printf "@ package.voltbuilder.json\n@=package.json\n" | zipnote -w "$PACKAGE_PATH"

# Clean up
rm -rf certificates package.voltbuilder.json

echo ""
echo "=== Build Complete ==="
echo ""
echo "Package created: $PACKAGE_PATH"
echo ""
echo "Next steps:"
echo "  1. Go to https://volt.build"
echo "  2. Upload the package: $PACKAGE_NAME"
echo "  3. Build and download the .ipa file"
