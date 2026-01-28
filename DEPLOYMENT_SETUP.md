# Deployment Setup Instructions

This repository is configured to automatically deploy to TWO locations on every push to `main`:

1. **Cloudflare Pages** (Testing) - Gets a new URL each deploy
2. **IONOS FTP Server** (Production) - Always accessible at **archive.telosa.dev**

## 🔐 Required GitHub Secrets

You need to add these secrets to your GitHub repository:

### Go to: https://github.com/linczyc-MLX/Telosa-Dev/settings/secrets/actions

Click **"New repository secret"** and add each of these:

### 1. CLOUDFLARE_API_TOKEN
- **Value**: Your Cloudflare API token (already used for manual deployments)
- **How to get it**: 
  - Go to Cloudflare Dashboard → My Profile → API Tokens
  - Use the existing token or create a new one with these permissions:
    - Account - Cloudflare Pages: Edit
    - Account - D1: Edit
    - Account - Workers R2 Storage: Edit

### 2. CLOUDFLARE_ACCOUNT_ID
- **Value**: Your Cloudflare Account ID
- **How to get it**:
  - Go to Cloudflare Dashboard → Workers & Pages
  - Look at the URL or sidebar for your Account ID
  - Format: `1234567890abcdef1234567890abcdef` (32 characters)

### 3. IONOS_FTP_PASSWORD
- **Value**: `(The password for this access)` 
- **Note**: This is the password shown in your IONOS FTP account screenshot
- **Security**: Never commit this password to the repository!

---

## 📋 FTP Server Details (Already configured in workflow)

```
Server: home148422849.1and1-data.host
Port: 990
Protocol: FTPS
Username: acc419969703
Production URL: https://archive.telosa.dev
```

---

## 🚀 How It Works

After you add the secrets and push to GitHub:

1. **Automatic Build**: GitHub Actions builds the project
2. **Deploy to Cloudflare**: Creates test URL (changes each deploy)
3. **Deploy to IONOS FTP**: Updates **archive.telosa.dev** (always the same URL!)

### Your team always uses:
```
https://archive.telosa.dev
```

No more changing URLs! 🎉

---

## 🧪 Testing the Setup

1. Add all three secrets to GitHub
2. Push any change to `main` branch:
   ```bash
   git add .
   git commit -m "Test deployment"
   git push origin main
   ```
3. Go to: https://github.com/linczyc-MLX/Telosa-Dev/actions
4. Watch the deployment progress
5. After ~2-3 minutes, check: https://archive.telosa.dev

---

## 🔧 Manual Deployment (if needed)

If automatic deployment fails, you can still deploy manually:

### To Cloudflare Pages:
```bash
npm run build
npx wrangler pages deploy dist --project-name telosa-p4p
```

### To IONOS FTP:
Use an FTP client like FileZilla with the credentials above.

---

## 📝 Deployment Logs

Check deployment status at:
https://github.com/linczyc-MLX/Telosa-Dev/actions

Each push shows:
- ✅ Build succeeded
- ✅ Cloudflare deployment succeeded  
- ✅ IONOS FTP deployment succeeded

---

## ⚠️ Important Notes

1. **NEVER commit the IONOS FTP password** to the repository
2. **archive.telosa.dev** is the production URL for your team
3. **Cloudflare URLs** are for testing only
4. Deployment takes 2-3 minutes after pushing to GitHub
5. Both deployments happen automatically on every `git push`

---

## 🆘 Troubleshooting

### "Secrets not found" error:
- Double-check you added all 3 secrets to GitHub
- Make sure secret names match exactly (case-sensitive)

### FTP deployment fails:
- Verify FTP password is correct in GitHub secrets
- Check IONOS account is active
- Ensure FTP access is enabled in IONOS dashboard

### Cloudflare deployment fails:
- Verify API token has correct permissions
- Check Account ID is correct (32 characters)
- Ensure token hasn't expired

---

## 📞 Support

If deployment fails, check the Actions tab for detailed error logs:
https://github.com/linczyc-MLX/Telosa-Dev/actions
