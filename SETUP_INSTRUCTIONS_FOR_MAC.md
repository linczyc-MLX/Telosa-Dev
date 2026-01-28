# 🚀 Complete Setup Instructions for Your Mac

## 📋 Overview
You need to:
1. **Create Cloudflare API Token** (5 minutes)
2. **Add 3 GitHub Secrets** (3 minutes)
3. **Push the workflow file** (2 minutes)
4. **Test automatic deployment** (watch it work!)

After this one-time setup, every `git push` will automatically deploy to **https://archive.telosa.dev** (static URL).

---

## ✅ STEP 1: Create Cloudflare API Token

### 1.1 Go to Token Creation Page
**URL:** https://dash.cloudflare.com/profile/api-tokens

### 1.2 Create Token
1. Click **"Create Token"** button
2. Use the **"Edit Cloudflare Workers"** template
3. Click **"Continue to summary"**
4. Click **"Create Token"**
5. **COPY THE TOKEN** (it looks like: `abc123def456ghi789...`)
6. Save it in a notes app temporarily

---

## ✅ STEP 2: Get Your Account ID

### 2.1 Option A: From Dashboard URL (Easiest)
1. Go to: https://dash.cloudflare.com
2. Click **"Workers & Pages"** in the left sidebar
3. Look at the URL bar:
   ```
   https://dash.cloudflare.com/YOUR-ACCOUNT-ID-HERE/workers-and-pages
                               ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
   ```
4. Copy the 32-character string (looks like: `1234567890abcdef1234567890abcdef`)

### 2.2 Option B: Using Terminal (Alternative)
Open Terminal and run:
```bash
# On Your Mac Terminal:
cd ~/Telosa-Dev

# Set token temporarily
export CLOUDFLARE_API_TOKEN="paste-your-token-here"

# Get Account ID
npx wrangler whoami
```

**Expected output:**
```
┌─────────────────────┬──────────────────────────────────┐
│ Account Name        │ Account ID                       │
├─────────────────────┼──────────────────────────────────┤
│ Your Account        │ 1234567890abcdef1234567890abcdef │
└─────────────────────┴──────────────────────────────────┘
```

Copy the **Account ID** from the table.

---

## ✅ STEP 3: Add GitHub Secrets

### 3.1 Go to GitHub Secrets Page
**URL:** https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions

### 3.2 Add Secret #1: CLOUDFLARE_API_TOKEN
1. Click **"New repository secret"**
2. Name: `CLOUDFLARE_API_TOKEN`
3. Value: Paste the token from Step 1 (e.g., `abc123def456ghi789...`)
4. Click **"Add secret"**

### 3.3 Add Secret #2: CLOUDFLARE_ACCOUNT_ID
1. Click **"New repository secret"**
2. Name: `CLOUDFLARE_ACCOUNT_ID`
3. Value: Paste the Account ID from Step 2 (e.g., `1234567890abcdef1234567890abcdef`)
4. Click **"Add secret"**

### 3.4 Add Secret #3: IONOS_FTP_PASSWORD
1. Click **"New repository secret"**
2. Name: `IONOS_FTP_PASSWORD`
3. Value: `Sc7W8p` (from your IONOS screenshot)
4. Click **"Add secret"**

### 3.5 Verify All Three Secrets
You should now see three secrets:
- ✅ CLOUDFLARE_API_TOKEN
- ✅ CLOUDFLARE_ACCOUNT_ID
- ✅ IONOS_FTP_PASSWORD

---

## ✅ STEP 4: Enable GitHub Actions

### 4.1 Go to Actions Settings
**URL:** https://github.com/linczyc-MLX/Telosa-Dev/settings/actions

### 4.2 Enable Workflows
1. Under **"Actions permissions"**, select:
   - ✅ **"Allow all actions and reusable workflows"**
2. Click **"Save"**

---

## ✅ STEP 5: Push Workflow File (On Your Mac)

### 5.1 Open Terminal
```bash
# Navigate to your project
cd ~/Telosa-Dev

# Pull latest code
git pull origin main

# Check if workflow file exists
ls -la .github/workflows/deploy.yml
```

### 5.2 If File Exists (Should Say "Found")
```bash
# Add and commit the workflow
git add .github/workflows/deploy.yml .github/workflows/ DEPLOYMENT_SETUP.md CLOUDFLARE_TOKEN_GUIDE.md SETUP_INSTRUCTIONS_FOR_MAC.md

# Commit
git commit -m "Add automatic deployment to Cloudflare Pages and IONOS FTP"

# Push (this will trigger the deployment!)
git push origin main
```

### 5.3 If File Doesn't Exist
The workflow file should already be in your repo. If not, run:
```bash
# Create directory
mkdir -p .github/workflows

# Download the workflow file from GitHub
# Or manually create it (I'll show you the content below)
```

**If you need to create it manually**, save this as `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloudflare Pages and IONOS FTP

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    name: Build Project
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 1

  deploy-cloudflare:
    needs: build
    runs-on: ubuntu-latest
    name: Deploy to Cloudflare Pages (Testing)
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=telosa-p4p

  deploy-ftp:
    needs: build
    runs-on: ubuntu-latest
    name: Deploy to IONOS FTP (Production - archive.telosa.dev)
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Deploy to IONOS FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: home148422849.1and1-data.host
          username: acc419969703
          password: ${{ secrets.IONOS_FTP_PASSWORD }}
          port: 990
          protocol: ftps
          local-dir: ./dist/
          server-dir: /
          dangerous-clean-slate: false
          exclude: |
            **/.git*
            **/.git*/**
            **/node_modules/**
```

---

## ✅ STEP 6: Watch It Work!

### 6.1 Monitor GitHub Actions
**URL:** https://github.com/linczyc-MLX/Telosa-Dev/actions

You should see a workflow running with three jobs:
1. 🔨 **Build** - Compiling your project
2. ☁️ **Deploy to Cloudflare Pages** - Testing URL
3. 📤 **Deploy to IONOS FTP** - Production URL

### 6.2 Wait for Completion (2-3 minutes)
- ✅ Green checkmark = Success!
- ❌ Red X = Check the logs (click on the failed job)

### 6.3 Test Your Site
**Production URL (Static):** https://archive.telosa.dev

### 6.4 Share with Team
From now on, your team **ALWAYS** uses:
```
https://archive.telosa.dev
```

This URL **NEVER changes**! 🎉

---

## 🔄 Daily Workflow (After Setup)

### On Your Mac:
```bash
cd ~/Telosa-Dev

# Make changes to your code
# (edit files, fix bugs, add features)

# Commit and push
git add .
git commit -m "Your commit message"
git push origin main
```

### What Happens Automatically:
1. GitHub Actions starts
2. Builds your project
3. Deploys to Cloudflare Pages (testing URL changes)
4. Deploys to IONOS FTP (**https://archive.telosa.dev** - production, never changes)
5. You get an email notification when done

### URLs:
- **Production (Share with team):** https://archive.telosa.dev
- **Testing (You only):** Check GitHub Actions for latest URL

---

## 🆘 Troubleshooting

### Problem: "Workflow file not found"
**Solution:** The workflow file needs to be pushed from your Mac (GitHub App lacks permissions).
```bash
cd ~/Telosa-Dev
git pull origin main
git add .github/workflows/deploy.yml
git commit -m "Add deployment workflow"
git push origin main
```

### Problem: "Invalid Cloudflare token"
**Solution:** 
1. Create a new token: https://dash.cloudflare.com/profile/api-tokens
2. Update GitHub secret: https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions
3. Re-run the failed workflow

### Problem: "IONOS FTP connection failed"
**Solution:** Verify credentials:
- Server: `home148422849.1and1-data.host`
- Username: `acc419969703`
- Password: `Sc7W8p`
- Port: `990` (FTPS)

### Problem: "Can't find Account ID"
**Solution:**
1. Go to: https://dash.cloudflare.com
2. Click **"Workers & Pages"**
3. Copy the ID from the URL bar

### Problem: "GitHub Actions not running"
**Solution:**
1. Check Actions are enabled: https://github.com/linczyc-MLX/Telosa-Dev/settings/actions
2. Select **"Allow all actions and reusable workflows"**
3. Click **"Save"**

---

## 📞 Quick Reference

### Important URLs
- **Production Site:** https://archive.telosa.dev
- **GitHub Repo:** https://github.com/linczyc-MLX/Telosa-Dev
- **GitHub Actions:** https://github.com/linczyc-MLX/Telosa-Dev/actions
- **GitHub Secrets:** https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **Cloudflare Tokens:** https://dash.cloudflare.com/profile/api-tokens

### IONOS FTP Details
- **Server:** home148422849.1and1-data.host
- **Port:** 990 (FTPS)
- **Username:** acc419969703
- **Password:** Sc7W8p
- **Domain:** https://archive.telosa.dev

### GitHub Secrets Needed
1. `CLOUDFLARE_API_TOKEN` - From Cloudflare dashboard
2. `CLOUDFLARE_ACCOUNT_ID` - From Cloudflare dashboard URL
3. `IONOS_FTP_PASSWORD` - `Sc7W8p`

---

## ✅ Success Checklist

Use this checklist to track your progress:

- [ ] Created Cloudflare API Token
- [ ] Got Cloudflare Account ID
- [ ] Added CLOUDFLARE_API_TOKEN to GitHub Secrets
- [ ] Added CLOUDFLARE_ACCOUNT_ID to GitHub Secrets
- [ ] Added IONOS_FTP_PASSWORD to GitHub Secrets
- [ ] Enabled GitHub Actions (Allow all actions)
- [ ] Pulled latest code: `git pull origin main`
- [ ] Pushed workflow file: `git push origin main`
- [ ] Watched GitHub Actions run successfully
- [ ] Tested https://archive.telosa.dev
- [ ] Shared production URL with team

---

## 🎉 You're Done!

Once all checkboxes above are complete, you have:

✅ **Automatic deployments** on every `git push`  
✅ **Static production URL** that never changes  
✅ **Testing URLs** on Cloudflare Pages  
✅ **No manual builds** required  
✅ **Team can use** https://archive.telosa.dev  

**Share this URL with your 50 team members:** https://archive.telosa.dev 🚀

---

## 📚 Additional Resources

- **Full Token Guide:** See `CLOUDFLARE_TOKEN_GUIDE.md`
- **Deployment Details:** See `DEPLOYMENT_SETUP.md`
- **Code Documentation:** See `README.md`

---

**Need Help?** Open an issue on GitHub or check the GitHub Actions logs for error messages.
