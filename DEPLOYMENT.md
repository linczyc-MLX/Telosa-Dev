# Telosa P4P - Deployment Guide

## Quick Start Guide

This guide will help you deploy the Telosa P4P Document Repository to Cloudflare Pages.

## Prerequisites

Before you begin, ensure you have:

1. ✅ Cloudflare account (free tier works)
2. ✅ Cloudflare API Token with appropriate permissions
3. ✅ Node.js 18+ installed locally
4. ✅ Git installed

## Step-by-Step Deployment

### Step 1: Configure Cloudflare API Token

First, you need to set up your Cloudflare API token for authentication.

**Option A: Use the Deploy Tab (Recommended)**
1. Go to the **Deploy** tab in this interface
2. Follow the instructions to configure your Cloudflare API key
3. The system will automatically configure the environment

**Option B: Manual Configuration**
1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Create a token with these permissions:
   - Account: D1 Edit
   - Account: R2 Edit
   - Zone: Workers Scripts Edit
   - Account: Cloudflare Pages Edit
3. Copy the token and run:
```bash
export CLOUDFLARE_API_TOKEN=your-token-here
```

### Step 2: Create Cloudflare D1 Database

The D1 database stores user accounts, document metadata, and activity logs.

```bash
cd /home/user/webapp
npx wrangler d1 create telosa-p4p-production
```

You'll see output like:
```
✅ Successfully created DB 'telosa-p4p-production'
database_id = "xxxx-xxxx-xxxx-xxxx"
```

**Important**: Copy the `database_id` value!

### Step 3: Create Cloudflare R2 Bucket

The R2 bucket stores the actual document files.

```bash
npx wrangler r2 bucket create telosa-p4p-files
```

### Step 4: Update Configuration

Edit `wrangler.jsonc` and add your database_id:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "telosa-p4p",
  "main": "src/index.tsx",
  "compatibility_date": "2026-01-26",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "telosa-p4p-production",
      "database_id": "PASTE-YOUR-DATABASE-ID-HERE"
    }
  ],
  
  "r2_buckets": [
    {
      "binding": "FILES",
      "bucket_name": "telosa-p4p-files"
    }
  ]
}
```

### Step 5: Run Database Migrations

Apply the database schema to your production database:

```bash
npx wrangler d1 migrations apply telosa-p4p-production
```

This creates all necessary tables (users, documents, document_access, activity_log).

### Step 6: Build the Application

```bash
npm run build
```

This compiles your application into the `dist/` directory.

### Step 7: Create Cloudflare Pages Project

```bash
npx wrangler pages project create telosa-p4p --production-branch main
```

### Step 8: Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy dist --project-name telosa-p4p
```

You'll see output with your deployment URL:
```
✨ Success! Uploaded 2 files (1 already uploaded)
✨ Deployment complete!
🌏 https://telosa-p4p.pages.dev
```

### Step 9: Initialize Production Database

Open your browser and visit:
```
https://your-deployment.pages.dev/api/init-db
```

You should see:
```json
{"success":true,"message":"Database initialized successfully"}
```

This creates the default user accounts.

### Step 10: Login and Test

1. Visit: `https://your-deployment.pages.dev`
2. Login with default credentials:
   - Email: `admin@telosap4p.com`
   - Password: `admin123`
3. Test uploading a document
4. Test downloading the document

## Post-Deployment Steps

### 1. Change Default Passwords

**CRITICAL**: Change all default passwords immediately!

1. Login as admin
2. Go to Users management
3. Update passwords for all accounts

### 2. Configure Custom Domain (Optional)

```bash
npx wrangler pages domain add yourdomain.com --project-name telosa-p4p
```

### 3. Set Environment Variables/Secrets

If you need to store API keys or secrets:

```bash
# Example: JWT secret
npx wrangler pages secret put JWT_SECRET --project-name telosa-p4p

# IONOS database credentials
npx wrangler pages secret put IONOS_API_URL --project-name telosa-p4p
npx wrangler pages secret put IONOS_API_KEY --project-name telosa-p4p
```

### 4. Enable Cloudflare Analytics (Optional)

1. Go to Cloudflare Dashboard
2. Select your Pages project
3. Enable Web Analytics
4. Add the analytics script to your site

## IONOS VPS Database Integration

To connect to your IONOS VPS database, follow these steps:

### 1. Create API Endpoint on IONOS Server

Create a REST API on your IONOS VPS that accepts database queries:

```javascript
// Example using Express.js on IONOS VPS
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// Database connection
const pool = mysql.createPool({
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'your_database'
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Query endpoint
app.post('/api/query', authenticateToken, async (req, res) => {
  try {
    const { query, params } = req.body;
    const [results] = await pool.execute(query, params);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('IONOS API running on port 3001');
});
```

### 2. Secure the Connection

1. Use HTTPS (SSL certificate from IONOS)
2. Implement strong API authentication
3. Whitelist Cloudflare IP ranges
4. Use environment variables for sensitive data

### 3. Update Cloudflare Worker Code

Edit `src/index.tsx` and update the external query endpoint:

```typescript
app.post('/api/external/query', authMiddleware, async (c) => {
  const user = c.get('user')
  
  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const { query, params } = await c.req.json()

  // Get secrets from environment
  const IONOS_API_URL = c.env.IONOS_API_URL
  const IONOS_API_KEY = c.env.IONOS_API_KEY

  try {
    const response = await fetch(`${IONOS_API_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${IONOS_API_KEY}`
      },
      body: JSON.stringify({ query, params })
    })
    
    const data = await response.json()
    return c.json(data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})
```

### 4. Test the Integration

```bash
# From your Cloudflare deployment
curl -X POST https://your-deployment.pages.dev/api/external/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT * FROM your_table LIMIT 10","params":[]}'
```

## Troubleshooting

### Issue: Database not found

**Solution**: Ensure the `database_id` in `wrangler.jsonc` matches the ID from `wrangler d1 create`.

### Issue: R2 bucket not accessible

**Solution**: Verify the bucket name in `wrangler.jsonc` matches the created bucket.

### Issue: Authentication fails

**Solution**: 
1. Check if database was initialized (`/api/init-db`)
2. Verify password hash algorithm
3. Check JWT secret configuration

### Issue: File uploads fail

**Solution**:
1. Ensure R2 bucket binding is correct
2. Check file size limits
3. Verify CORS configuration

### Issue: Cannot connect to IONOS database

**Solution**:
1. Verify IONOS API endpoint is accessible
2. Check firewall rules on IONOS server
3. Confirm API authentication tokens
4. Test IONOS API directly first

## Monitoring & Maintenance

### View Logs

```bash
# View deployment logs
npx wrangler pages deployment list --project-name telosa-p4p

# View specific deployment logs
npx wrangler pages deployment tail --project-name telosa-p4p
```

### Database Maintenance

```bash
# List all D1 databases
npx wrangler d1 list

# Query database
npx wrangler d1 execute telosa-p4p-production --command="SELECT COUNT(*) FROM users"

# Backup database
npx wrangler d1 export telosa-p4p-production --output=backup.sql
```

### R2 Bucket Management

```bash
# List objects in bucket
npx wrangler r2 object list telosa-p4p-files

# View bucket info
npx wrangler r2 bucket list
```

## Security Checklist

Before going live, ensure you've completed:

- [ ] Changed all default passwords
- [ ] Updated JWT_SECRET in production
- [ ] Configured proper CORS policies
- [ ] Enabled HTTPS only
- [ ] Set up rate limiting (if needed)
- [ ] Reviewed user permissions
- [ ] Configured proper R2 bucket policies
- [ ] Set up Cloudflare WAF rules
- [ ] Enabled audit logging
- [ ] Documented admin procedures

## Updates & Redeployment

To deploy updates:

```bash
# 1. Make your changes
# 2. Build
npm run build

# 3. Deploy
npx wrangler pages deploy dist --project-name telosa-p4p
```

## Rollback

If something goes wrong:

```bash
# List deployments
npx wrangler pages deployment list --project-name telosa-p4p

# Promote a specific deployment
npx wrangler pages deployment promote <deployment-id> --project-name telosa-p4p
```

## Support

For issues or questions:
1. Check the main README.md file
2. Review Cloudflare documentation
3. Contact the development team

---

**Last Updated**: January 26, 2026
