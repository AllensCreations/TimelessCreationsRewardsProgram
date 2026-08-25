#!/bin/bash

# ==========================================
# CONFIGURATION (Optional Hardcoded Credentials)
# ==========================================
GITHUB_USER="AllensCreations"
GITHUB_TOKEN="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" # Put your Personal Access Token here if desired, or leave blank to use git credentials
DEFAULT_REPO="PollsPartyBotV2"

echo "📂 Working Directory: $(pwd)"
echo "🚀 Staging all changes..."
git add .

# Check if git remote is already configured, otherwise configure it dynamically
if ! git remote get-url origin &>/dev/null; then
  echo "📦 No remote repository found for this folder."
  echo "Enter your GitHub repository name (e.g., PollsPartyBotV2) [Default: $DEFAULT_REPO]:"
  read input_repo
  
  if [ -z "$input_repo" ]; then
    input_repo="$DEFAULT_REPO"
  fi

  if [ -n "$GITHUB_TOKEN" ]; then
    REMOTE_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${input_repo}.git"
  else
    REMOTE_URL="https://github.com/${GITHUB_USER}/${input_repo}.git"
  fi

  git remote add origin "$REMOTE_URL"
  echo "🔗 Linked remote origin to: github.com/${GITHUB_USER}/${input_repo}"
fi

echo "📦 Enter your commit message (or press enter for default):"
read commit_msg

if [ -z "$commit_msg" ]; then
  commit_msg="feat: update dashboard, pusher, and receipt card generation"
fi

git commit -m "$commit_msg"

echo "⬆️ Pushing to GitHub..."
git push origin main

echo "🎉 Successfully pushed to GitHub!"
read -p "Press Enter to close..."
