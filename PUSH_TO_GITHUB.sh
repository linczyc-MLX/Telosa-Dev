#!/bin/bash

# Script to push all documentation to GitHub from your Mac
# Run this on your Mac: bash PUSH_TO_GITHUB.sh

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   📤 Pushing Documentation to GitHub                          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Navigate to project
cd ~/Telosa-Dev || exit 1

echo "📂 Current directory: $(pwd)"
echo ""

# Check current status
echo "🔍 Checking git status..."
git status
echo ""

# Pull latest changes
echo "⬇️  Pulling latest changes from GitHub..."
git pull origin main
echo ""

# Show what will be pushed
echo "📋 Files ready to push:"
git log origin/main..HEAD --oneline
echo ""

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║   ✅ SUCCESS! Documentation pushed to GitHub                  ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📚 New files available on GitHub:"
    echo "   • TELOSA_DEV_COMPREHENSIVE_DOCUMENTATION.md (72KB)"
    echo "   • CLOUDFLARE_TOKEN_GUIDE.md"
    echo "   • SETUP_INSTRUCTIONS_FOR_MAC.md"
    echo "   • QUICK_START.md"
    echo ""
    echo "🔗 View on GitHub:"
    echo "   https://github.com/linczyc-MLX/Telosa-Dev"
else
    echo ""
    echo "❌ Push failed. Please check your GitHub authentication."
    echo ""
    echo "Troubleshooting:"
    echo "1. Make sure you're logged in to GitHub"
    echo "2. Check your SSH keys or HTTPS credentials"
    echo "3. Try: git config credential.helper store"
fi
