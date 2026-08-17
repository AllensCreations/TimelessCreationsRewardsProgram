#!/bin/bash
echo "🚀 Staging all changes..."
git add .

echo "📦 Enter your commit message (or press enter for default):"
read commit_msg

if [ -z "$commit_msg" ]; then
  commit_msg="feat: update dashboard, pusher, and receipt card generation"
fi

git commit -m "$commit_msg"
git push origin main

echo "🎉 Successfully pushed to GitHub!"
