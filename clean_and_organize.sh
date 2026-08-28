echo "🧹 Removing unused/redundant codebase archives..."
rm -rf codebase_archives/ *_codebase.txt 2>/dev/null || true

echo "📦 Optimizing project layout..."
mkdir -p lib/handlers api public views templates

echo "✓ Cleanup complete!"
