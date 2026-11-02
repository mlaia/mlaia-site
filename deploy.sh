#!/bin/bash
# Deploy script — run from the mlaia-site directory
# Usage: cd ~/Desktop/mlaia-site && bash deploy.sh

set -e

echo "Cleaning up git lock files and stale state..."
find .git -name "*.lock" -delete 2>/dev/null || true
find .git -name "*.lock.bak" -delete 2>/dev/null || true

# Abort any in-progress rebase
git rebase --abort 2>/dev/null || true

echo "Setting git identity..."
git config user.email "yochai@mlaia.com"
git config user.name "Yochai Edlitz"

# Reset to the pre-commit state (our file changes are already on disk)
echo "Resetting to origin/main..."
git fetch origin
git reset --hard origin/main

echo "Staging all changes..."
git add -A

echo "Checking for changes..."
if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

echo "Committing..."
git commit -m "Deploy 7 blog posts, sync blog index, add blog section to homepage, update sitemap and llms.txt

- Deploy full versions of 7 blog posts (replacing redirect stubs):
  blog-rag-production, blog-sovereign-ai-onprem, blog-voice-ai-production,
  blog-slm-onprem-israel, blog-ai-agents-pilot-to-production,
  blog-agents-production, blog-llms
- Add blog cards to blog.html for all 7 new posts
- Add From Our Blog section to index.html with 3 newest posts
- Add sitemap.xml entries for all 7 new posts
- Update llms.txt: add 7 missing blog posts, fix contact email to yochai@mlaia.com"

echo "Pushing to origin/main..."
git push origin main

echo ""
echo "Done! All changes deployed to main."

# Clean up this script
rm -f deploy.sh
