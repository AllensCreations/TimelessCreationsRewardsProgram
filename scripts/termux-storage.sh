#!/bin/bash

# 1. Only ask for storage permission if the storage folder isn't linked yet
if [ ! -d ~/storage ]; then
    echo "Requesting storage access..."
    termux-setup-storage
    sleep 2
fi

# 2. Grab the latest commit hash for the filename
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null)

if [ -z "$COMMIT_HASH" ]; then
    FILENAME="codebase_bundle.txt"
    echo "No Git commits found. Using default name: $FILENAME"
else
    FILENAME="${COMMIT_HASH}_codebase.txt"
    echo "Using commit hash for filename: $FILENAME"
fi

# 3. Bundle the repository
echo "Bundling your repository..."
find . -type f \( -name "*.js" -o -name "*.html" -o -name "*.json" -o -name "*.sql" -o -name "*.sh" -o -name "*.md" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -exec sh -c 'echo -e "\n\n=== FILE: $1 ===\n"; cat "$1"' _ {} \; > "$FILENAME"

# 4. Create an organized folder and copy without asking y/n
TARGET_DIR=~/storage/downloads/CodeBundles
mkdir -p "$TARGET_DIR"

echo "Copying to organized folder..."
# The backslash bypasses any 'cp' aliases to prevent y/n prompts, and -f forces the overwrite
\cp -f "$FILENAME" "$TARGET_DIR/"

echo "Success! File safely tucked away in: $TARGET_DIR/$FILENAME"
