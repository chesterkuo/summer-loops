#!/bin/bash
# Generate iOS app icons from source image
# Usage: ./scripts/generate-icons.sh [source-image]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$FRONTEND_DIR/public/icons"

# Source image (default: icon-1024.png in icons directory)
SOURCE="${1:-$ICONS_DIR/icon-1024.png}"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source image not found: $SOURCE"
    echo "Please provide a 1024x1024 PNG image as the source."
    exit 1
fi

echo "Generating iOS app icons from: $SOURCE"

# Create icons directory if it doesn't exist
mkdir -p "$ICONS_DIR"

# Required iOS icon sizes
SIZES=(40 58 60 76 80 87 120 152 167 180 512 1024)

for SIZE in "${SIZES[@]}"; do
    OUTPUT="$ICONS_DIR/icon-${SIZE}.png"
    echo "  Creating ${SIZE}x${SIZE}..."
    convert "$SOURCE" -resize ${SIZE}x${SIZE} "$OUTPUT"
done

echo "Done! Generated ${#SIZES[@]} icon files in $ICONS_DIR"
ls -la "$ICONS_DIR"
