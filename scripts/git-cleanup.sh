#!/bin/bash
# Git Cleanup Script - Lugn & Trygg
# Run this script to fix common git issues
# Usage: bash scripts/git-cleanup.sh (Linux/macOS) or bash scripts/git-cleanup.sh (Git Bash on Windows)

set -e

echo "🧹 Git Cleanup Script - Lugn & Trygg"
echo "====================================="

# 1. Remove all stale worktrees
echo ""
echo "1️⃣  Removing stale worktrees..."
git worktree prune --verbose

# 2. Remove any lock files
echo ""
echo "2️⃣  Removing lock files..."
rm -f .git/index.lock 2>/dev/null || true
rm -f .git/worktrees/*/index.lock 2>/dev/null || true
find .git/worktrees -name "index.lock" -delete 2>/dev/null || true
echo "   ✅ Lock files removed"

# 3. Check for corrupted worktrees
echo ""
echo "3️⃣  Checking for corrupted worktrees..."
WORKTREES=$(git worktree list 2>/dev/null || echo "")
if [ -n "$WORKTREES" ]; then
    echo "   Active worktrees:"
    echo "$WORKTREES" | while read -r line; do
        echo "   - $line"
    done
else
    echo "   ✅ No worktrees found"
fi

# 4. Verify repository health
echo ""
echo "4️⃣  Verifying repository health..."
git fsck --no-dangling 2>/dev/null || echo "   ⚠️  Some issues found (usually harmless)"

# 5. Check current status
echo ""
echo "5️⃣  Current git status:"
git status --short

# 6. Check if we're behind/ahead of remote
echo ""
echo "6️⃣  Remote sync status:"
git fetch --quiet 2>/dev/null || true
git status -uno 2>/dev/null | head -3

echo ""
echo "====================================="
echo "✅ Cleanup complete!"
echo ""
echo "💡 Tips to prevent future issues:"
echo "   - Always commit changes before switching branches"
echo "   - Use 'git stash' for temporary changes"
echo "   - Run this script if git shows lock errors"
echo "   - Avoid using worktrees unless necessary"
