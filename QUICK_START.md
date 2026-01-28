# 🎯 QUICK START - 5 Steps to Deploy

## ⚡ What You'll Get
After this 10-minute setup, every `git push` automatically deploys to:
- **Production:** https://archive.telosa.dev (NEVER CHANGES!)
- **Testing:** Cloudflare Pages URL (changes per deploy)

---

## 📋 Setup Steps

### 1️⃣ Create Cloudflare API Token (2 min)
**URL:** https://dash.cloudflare.com/profile/api-tokens
1. Click "Create Token"
2. Use "Edit Cloudflare Workers" template
3. Click "Create Token"
4. **COPY THE TOKEN** (shown only once!)

### 2️⃣ Get Account ID (1 min)
**URL:** https://dash.cloudflare.com
1. Click "Workers & Pages" in sidebar
2. Look at URL bar: `https://dash.cloudflare.com/YOUR-ACCOUNT-ID/workers-and-pages`
3. **COPY THE 32-CHARACTER ID**

### 3️⃣ Add 3 GitHub Secrets (3 min)
**URL:** https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions

Click "New repository secret" for each:

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_API_TOKEN` | Token from Step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | ID from Step 2 |
| `IONOS_FTP_PASSWORD` | `Sc7W8p` |

### 4️⃣ Enable GitHub Actions (1 min)
**URL:** https://github.com/linczyc-MLX/Telosa-Dev/settings/actions
1. Select "Allow all actions and reusable workflows"
2. Click "Save"

### 5️⃣ Push from Mac (3 min)
**On your Mac Terminal:**
```bash
cd ~/Telosa-Dev
git pull origin main
git add .github/workflows/deploy.yml DEPLOYMENT_SETUP.md CLOUDFLARE_TOKEN_GUIDE.md SETUP_INSTRUCTIONS_FOR_MAC.md
git commit -m "Add automatic deployment"
git push origin main
```

---

## ✅ Verify It Works
**Watch:** https://github.com/linczyc-MLX/Telosa-Dev/actions  
**Test:** https://archive.telosa.dev  
**Share with team:** https://archive.telosa.dev 🎉

---

## 🔄 Daily Usage (After Setup)
```bash
cd ~/Telosa-Dev
# Make code changes
git add .
git commit -m "Fix bugs"
git push origin main
# ✨ AUTOMATIC DEPLOYMENT HAPPENS! ✨
```

**Team always uses:** https://archive.telosa.dev

---

## 🆘 Problems?

### "Can't push workflow file"
This is normal! Workflow must be pushed from Mac (not sandbox).

### "Invalid token"
Create new token: https://dash.cloudflare.com/profile/api-tokens  
Update secret: https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions

### "Can't find Account ID"
Go to: https://dash.cloudflare.com → Workers & Pages  
Copy ID from URL bar

### "Actions not running"
Enable actions: https://github.com/linczyc-MLX/Telosa-Dev/settings/actions  
Select "Allow all actions"

---

## 📚 Full Documentation

- **This Quick Start:** `QUICK_START.md`
- **Complete Mac Instructions:** `SETUP_INSTRUCTIONS_FOR_MAC.md`
- **Token Details:** `CLOUDFLARE_TOKEN_GUIDE.md`
- **Deployment Info:** `DEPLOYMENT_SETUP.md`

---

## 🎉 Success!

Once setup is complete:
- ✅ Production URL: https://archive.telosa.dev (NEVER CHANGES)
- ✅ Automatic deployments on `git push`
- ✅ No more manual builds
- ✅ Share one URL with all 50 team members

**The problem of constantly changing URLs is SOLVED!** 🚀
