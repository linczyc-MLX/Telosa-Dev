# Cloudflare API Token Setup Guide

## ⚠️ Important: No Existing Token Found
Your Mac doesn't have a saved Cloudflare token at `~/.wrangler/config/default.toml`.
This is normal! You'll need to create a NEW token.

---

## 🔑 Step 1: Create Cloudflare API Token

### Go to Cloudflare Dashboard:
**URL:** https://dash.cloudflare.com/profile/api-tokens

### Click "Create Token"

### Choose Template:
- **Option A (Recommended):** Use **"Edit Cloudflare Workers"** template
- **Option B:** Create Custom Token with these permissions:
  ```
  ✅ Account - Cloudflare Pages: Edit
  ✅ Account - Workers R2 Storage: Edit  
  ✅ Account - D1: Edit
  ✅ Account - Account Settings: Read
  ```

### Set Account Resources:
- Select: **"Include - Your Account Name"**

### Create Token:
1. Click **"Continue to summary"**
2. Click **"Create Token"**
3. **COPY THE TOKEN IMMEDIATELY** (shown only once!)
4. It will look like: `abc123def456ghi789jkl012mno345pqr567stu890`

---

## 🆔 Step 2: Get Your Account ID

### Method 1: From Dashboard URL
1. Go to: https://dash.cloudflare.com
2. Click on **"Workers & Pages"** in the sidebar
3. Look at the URL bar:
   ```
   https://dash.cloudflare.com/YOUR-ACCOUNT-ID/workers-and-pages
   ```
4. Copy the 32-character hex string (YOUR-ACCOUNT-ID)
   - Example: `1234567890abcdef1234567890abcdef`

### Method 2: Using Wrangler (On Your Mac)
```bash
# Set the token temporarily
export CLOUDFLARE_API_TOKEN="paste-your-token-here"

# Check your account
npx wrangler whoami
```

**Expected Output:**
```
Getting User settings...
👋 You are logged in with an API Token, associated with the email 'your-email@example.com'.

┌────────────────────────────────────┬──────────────────────────────────┐
│ Account Name                       │ Account ID                       │
├────────────────────────────────────┼──────────────────────────────────┤
│ Your Account Name                  │ 1234567890abcdef1234567890abcdef │
└────────────────────────────────────┴──────────────────────────────────┘
```

**Copy the Account ID** (32-character hex string)

---

## 🔐 Step 3: Add GitHub Secrets

### Go to GitHub Secrets:
**URL:** https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions

### Add THREE secrets:

#### 1. CLOUDFLARE_API_TOKEN
- Name: `CLOUDFLARE_API_TOKEN`
- Value: `abc123def456ghi789jkl012mno345pqr567stu890` (your token from Step 1)
- Click **"Add secret"**

#### 2. CLOUDFLARE_ACCOUNT_ID  
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Value: `1234567890abcdef1234567890abcdef` (your Account ID from Step 2)
- Click **"Add secret"**

#### 3. IONOS_FTP_PASSWORD
- Name: `IONOS_FTP_PASSWORD`
- Value: `Sc7W8p` (from your IONOS screenshot)
- Click **"Add secret"**

---

## ✅ Step 4: Enable GitHub Actions

### Go to Actions Settings:
**URL:** https://github.com/linczyc-MLX/Telosa-Dev/settings/actions

### Enable Workflows:
1. Select: **"Allow all actions and reusable workflows"**
2. Click **"Save"**

---

## 🚀 Step 5: Push Deployment Workflow (On Your Mac)

```bash
# Navigate to your project
cd ~/Telosa-Dev

# Pull latest code (includes deploy.yml)
git pull origin main

# Verify the workflow file exists
ls -la .github/workflows/deploy.yml

# If it doesn't exist, create it manually:
mkdir -p .github/workflows

# Then add deploy.yml with the workflow content
# (I'll provide this separately)

# Commit and push
git add .github/workflows/deploy.yml DEPLOYMENT_SETUP.md
git commit -m "Add automatic deployment workflow"
git push origin main
```

---

## 🎯 Step 6: Monitor Deployment

### Watch GitHub Actions:
**URL:** https://github.com/linczyc-MLX/Telosa-Dev/actions

### You should see:
- ✅ Build job (npm install, npm run build)
- ✅ Cloudflare Pages deploy (testing URL)
- ✅ IONOS FTP deploy (production URL)

### Production URLs:
- **Production (Static):** https://archive.telosa.dev
- **Testing (Changes):** https://RANDOM-ID.telosa-p4p.pages.dev

---

## 🔄 From Now On:

Every time you run:
```bash
git push origin main
```

GitHub Actions will automatically:
1. **Build** your project
2. **Deploy to Cloudflare Pages** (for testing)
3. **Deploy to IONOS FTP** (production at https://archive.telosa.dev)

**Your team always uses:** https://archive.telosa.dev  
**You test changes at:** The latest Cloudflare Pages URL

---

## 🆘 Troubleshooting

### Token doesn't work?
```bash
# Test manually on Mac
export CLOUDFLARE_API_TOKEN="your-token-here"
npx wrangler whoami
```

### Can't find Account ID?
- Go to: https://dash.cloudflare.com/YOUR-ACCOUNT-ID/workers-and-pages
- The Account ID is in the URL bar

### GitHub Actions failing?
1. Check secrets are added: https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions
2. Check Actions are enabled: https://github.com/linczyc-MLX/Telosa-Dev/settings/actions
3. View error logs: https://github.com/linczyc-MLX/Telosa-Dev/actions

### IONOS FTP not deploying?
- Verify FTP password: `Sc7W8p`
- Verify FTP server: `home148422849.1and1-data.host`
- Verify FTP port: `990` (FTPS)
- Verify username: `acc419969703`

---

## 📋 Quick Checklist

- [ ] Create Cloudflare API Token
- [ ] Get Account ID from `npx wrangler whoami`
- [ ] Add CLOUDFLARE_API_TOKEN to GitHub Secrets
- [ ] Add CLOUDFLARE_ACCOUNT_ID to GitHub Secrets  
- [ ] Add IONOS_FTP_PASSWORD to GitHub Secrets
- [ ] Enable GitHub Actions (Allow all actions)
- [ ] Pull latest code on Mac: `git pull origin main`
- [ ] Push to trigger deployment: `git push origin main`
- [ ] Monitor at: https://github.com/linczyc-MLX/Telosa-Dev/actions
- [ ] Test production site: https://archive.telosa.dev
- [ ] Share production URL with team

---

## 🎉 Success!

Once setup is complete, you'll have:
- ✅ **Stable production URL:** https://archive.telosa.dev (never changes!)
- ✅ **Testing URLs:** Cloudflare Pages (changes per deploy)
- ✅ **Automatic deployments** on every `git push`
- ✅ **No manual builds** required

Share **https://archive.telosa.dev** with your 50 team members! 🚀
