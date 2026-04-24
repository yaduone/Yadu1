# Production Deployment Guide — YaduONE

## System Overview

```
Flutter Mobile App (Android + iOS)
  → Firebase Auth (OTP) + REST API calls

React Admin Panel (SPA)
  → JWT Auth + REST API calls

Node.js + Express Backend (Port 3000)
  → 14 REST modules + nightly cron job (11 PM IST)

Firebase Services (managed by Google — no deployment needed)
  → Firestore (database)
  → Firebase Auth (user OTP)
  → Firebase Storage (product images / manifests)
```

---

## Deployment Options at a Glance

| | Railway | Render | VPS (Hetzner) |
|---|---|---|---|
| Cost/month | ~$5 | Free–$7 | ~$4 |
| Setup time | 30 min | 30 min | 2–3 hours |
| DevOps needed | None | None | Basic Linux |
| Cold starts | No | Yes (free tier) | No |
| Best for | Quick launch | Free tier | Full control |

**Recommended path:** Start with Railway (fastest), migrate to VPS when you have 100+ users.

---

# Step 1 — Firebase Setup (Database + Auth + Storage)

Firebase is your database, auth provider, and file storage. It's fully managed — no servers to run.

## 1.1 Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add project" → name it (e.g. `yaduone-prod`)
3. Disable Google Analytics (not needed) → Create project

## 1.2 Enable Firestore Database

1. In the Firebase console → left sidebar → "Firestore Database"
2. Click "Create database"
3. Choose "Production mode" (locked by default — good)
4. Select region: `asia-south1` (Mumbai — closest for India)
5. Click "Enable"

## 1.3 Enable Firebase Authentication

1. Left sidebar → "Authentication" → "Get started"
2. Go to "Sign-in method" tab
3. Enable "Phone" provider → Save
4. Under "Authorized domains" → add your admin panel domain later (e.g. `admin.yourdomain.com`)

## 1.4 Enable Firebase Storage

1. Left sidebar → "Storage" → "Get started"
2. Choose "Production mode" → Next
3. Select region: `asia-south1` → Done

## 1.5 Generate a Service Account Key

This is the credential your backend uses to talk to Firebase.

1. Firebase console → Project Settings (gear icon) → "Service accounts" tab
2. Click "Generate new private key" → "Generate key"
3. A JSON file downloads — this is your `service-account-key.json`
4. **Never commit this file to git.** It's already in `.gitignore`.

## 1.6 Encode the Service Account for Cloud Deployment

All cloud platforms use environment variables, not files. Encode the key:

**On Mac/Linux:**
```bash
base64 -i service-account-key.json | tr -d '\n'
```

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account-key.json"))
```

Copy the entire output — you'll paste it as `FIREBASE_SERVICE_ACCOUNT_BASE64` in the next steps.

## 1.7 Set Firestore Security Rules

In Firebase console → Firestore → "Rules" tab, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // All reads/writes go through your backend (Firebase Admin SDK bypasses these rules)
    // Block all direct client access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Click "Publish". Your backend uses the Admin SDK which bypasses these rules entirely — this just blocks any accidental direct client access.

## 1.8 Set Firebase Storage Rules

Firebase console → Storage → "Rules" tab:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;   // product images are public
      allow write: if false; // only backend can write
    }
  }
}
```

Click "Publish".

---

# Step 2 — Redis Setup (Optional but Recommended)

Redis powers rate limiting and response caching. The app works without it but rate limiting will be disabled.

## Option A — Redis Cloud (Free, Easiest)

1. Go to [redis.io/try-free](https://redis.io/try-free) → Create free account
2. Create a free database (30MB — plenty for rate limiting)
3. Copy the "Public endpoint" — it looks like: `redis-12345.c1.us-east-1-2.ec2.redns.redis-cloud.com:12345`
4. Copy the password from the "Security" section
5. Your `REDIS_URL` will be: `redis://:YOUR_PASSWORD@HOST:PORT`

## Option B — Upstash (Free, Serverless Redis)

1. Go to [upstash.com](https://upstash.com) → Create account
2. Create a Redis database → select region closest to your backend
3. Copy the "Redis URL" from the dashboard (includes password)

## Option C — Skip Redis

Leave `REDIS_URL` unset. The app logs a warning and continues without rate limiting or caching. Fine for early launch.

---

# Step 3 — Backend Deployment

## Option A — Railway (Recommended)

### 3A.1 Create Railway Account

1. Go to [railway.app](https://railway.app) → Sign up with GitHub
2. Verify your account (requires credit card for Hobby plan — $5/month)

### 3A.2 Deploy the Backend

1. Dashboard → "New Project" → "Deploy from GitHub repo"
2. Authorize Railway to access your repo → select the repo
3. Railway detects multiple folders — click "Configure" → set **Root Directory** to `backend`
4. Railway auto-detects Node.js and will run `npm start`
5. Click "Deploy"

### 3A.3 Add Environment Variables

In your Railway project → "Variables" tab → add each one:

```
PORT=3000
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
FIREBASE_SERVICE_ACCOUNT_BASE64=<paste the base64 string from Step 1.6>
JWT_SECRET=<generate below>
TIMEZONE=Asia/Kolkata
MANIFEST_CUTOFF_HOUR=21
MANIFEST_CRON_HOUR=23
REDIS_URL=<your Redis URL from Step 2, or leave blank>
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3A.4 Get Your Backend URL

1. Railway project → "Settings" → "Networking" → "Generate Domain"
2. Copy the URL — e.g. `https://yaduone-backend.up.railway.app`
3. Test it: open `https://yaduone-backend.up.railway.app/api/health` in your browser
4. You should see: `{"success":true,"message":"Dairy Delivery API is running",...}`

---

## Option B — Render

### 3B.1 Deploy the Backend

1. Go to [render.com](https://render.com) → New → "Web Service"
2. Connect GitHub → select your repo
3. Set Root Directory: `backend`
4. Build command: `npm install`
5. Start command: `node server.js`
6. Select "Free" or "Starter" plan

### 3B.2 Add Environment Variables

Same variables as Railway above — add them in the "Environment" section.

### 3B.3 Fix Cold Starts (Free Tier)

Free tier spins down after 15 minutes of inactivity. To prevent this, use a free uptime monitor:
- [UptimeRobot](https://uptimerobot.com) → Add monitor → HTTP → URL: `https://your-app.onrender.com/api/health` → every 5 minutes

---

## Option C — VPS (Hetzner / DigitalOcean)

### 3C.1 Create a Server

**Hetzner (recommended — cheapest):**
1. Go to [hetzner.com/cloud](https://www.hetzner.com/cloud) → Create account
2. New Project → Add Server
3. Location: Nuremberg or Helsinki (or Bangalore if available)
4. Image: Ubuntu 22.04
5. Type: CX22 (2 vCPU, 4GB RAM) — €3.79/month
6. Add your SSH public key (or use password auth)
7. Create server → note the IP address

**DigitalOcean alternative:**
- Basic Droplet → Ubuntu 22.04 → $6/month (1 vCPU, 1GB RAM) or $12/month (1 vCPU, 2GB RAM)

### 3C.2 Initial Server Setup

SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```

Run these commands:
```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify
node --version   # should show v20.x.x

# Install PM2 (keeps backend alive, restarts on crash, auto-starts on reboot)
npm install -g pm2

# Install Nginx (reverse proxy + serve admin panel)
apt-get install -y nginx

# Install Certbot (free SSL certificates)
apt-get install -y certbot python3-certbot-nginx

# Install Git
apt-get install -y git
```

### 3C.3 Point Your Domain to the Server

Before getting SSL certificates, your domain must point to the server IP.

In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
- Add A record: `api.yourdomain.com` → `YOUR_SERVER_IP`
- Add A record: `admin.yourdomain.com` → `YOUR_SERVER_IP`

DNS propagation takes 5–30 minutes. Verify with:
```bash
nslookup api.yourdomain.com
```

### 3C.4 Clone and Configure the Backend

```bash
# Clone your repo
git clone https://github.com/your-org/yaduone.git /var/www/yaduone

# Go to backend
cd /var/www/yaduone/backend

# Install production dependencies only
npm install --production

# Create the .env file
nano .env
```

Paste your environment variables into nano:
```
PORT=3000
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
FIREBASE_SERVICE_ACCOUNT_BASE64=<paste base64 string>
JWT_SECRET=<your 64-char secret>
TIMEZONE=Asia/Kolkata
MANIFEST_CUTOFF_HOUR=21
MANIFEST_CRON_HOUR=23
REDIS_URL=<your Redis URL or leave blank>
```

Save: `Ctrl+O` → Enter → `Ctrl+X`

### 3C.5 Start the Backend with PM2

```bash
cd /var/www/yaduone/backend

# Start the app
pm2 start server.js --name yaduone-backend

# Save PM2 process list (survives reboots)
pm2 save

# Configure PM2 to start on system boot
pm2 startup
# Copy and run the command it outputs (looks like: sudo env PATH=... pm2 startup ...)

# Check it's running
pm2 status
pm2 logs yaduone-backend --lines 20
```

### 3C.6 Configure Nginx

Create the Nginx config:
```bash
nano /etc/nginx/sites-available/yaduone
```

Paste:
```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }
}

# Admin Panel
server {
    listen 80;
    server_name admin.yourdomain.com;

    root /var/www/yaduone/admin-panel/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Save and enable:
```bash
# Enable the site
ln -s /etc/nginx/sites-available/yaduone /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Reload Nginx
systemctl reload nginx
```

### 3C.7 Get SSL Certificates

```bash
certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com
```

Follow the prompts — Certbot automatically updates your Nginx config with HTTPS. Certificates auto-renew every 90 days.

Test HTTPS: open `https://api.yourdomain.com/api/health` in your browser.

---

# Step 4 — Admin Panel Deployment

## Option A — Railway

1. In your Railway project → "New Service" → "GitHub Repo" → same repo
2. Set Root Directory: `admin-panel`
3. Add environment variable:
   ```
   VITE_API_URL=https://your-backend-url/api
   ```
4. Railway detects Vite and runs `npm run build` automatically
5. Go to Settings → Networking → Generate Domain → copy the admin panel URL

## Option B — Render (Static Site)

1. Render dashboard → New → "Static Site"
2. Connect repo → Root Directory: `admin-panel`
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. Add environment variable: `VITE_API_URL=https://your-backend-url/api`
6. Under "Redirects/Rewrites" → add rule:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: Rewrite
   (This is required for React Router to work)

## Option C — VPS (Nginx already configured in Step 3C.6)

```bash
cd /var/www/yaduone/admin-panel

# Install dependencies
npm install

# Set the API URL and build
VITE_API_URL=https://api.yourdomain.com/api npm run build

# The dist/ folder is now served by Nginx automatically
```

---

# Step 5 — Update CORS for Production

Open `backend/src/app.js` and replace the open CORS config:

```js
// Replace:
app.use(cors());

// With:
app.use(cors({
  origin: [
    'https://admin.yourdomain.com',   // your actual admin panel URL
    'http://localhost:5173',           // keep for local dev
  ],
  credentials: true,
}));
```

Redeploy the backend after this change.

---

# Step 6 — Seed Initial Data (First Time Only)

After the backend is live, run the seed script to populate initial data (areas, products, prices):

**Railway / Render:** Use their "Shell" or "Console" feature in the dashboard to run:
```bash
node seeds/seed.js
```

**VPS:**
```bash
cd /var/www/yaduone/backend
node seeds/seed.js
```

---

# Step 7 — Verify Everything Works

Run through this checklist after deployment:

```
[ ] GET https://your-backend-url/api/health  → returns { success: true }
[ ] GET https://your-backend-url/api/areas   → returns areas list
[ ] GET https://your-backend-url/api/products → returns products list
[ ] Admin panel loads at https://admin.yourdomain.com
[ ] Admin panel login works (JWT auth)
[ ] Product images load (Firebase Storage)
[ ] Nightly manifest cron is scheduled (check PM2 logs or Railway logs at 11 PM IST)
```

---

# Step 8 — Ongoing Deployments

## Railway / Render

Push to your main branch — both platforms auto-deploy on every push.

## VPS

```bash
cd /var/www/yaduone

# Pull latest code
git pull origin main

# Backend — reinstall deps if package.json changed
cd backend && npm install --production

# Restart backend
pm2 restart yaduone-backend

# Admin panel — rebuild
cd ../admin-panel
npm install
VITE_API_URL=https://api.yourdomain.com/api npm run build
# Nginx serves the new dist/ automatically — no restart needed
```

---

# Environment Variables — Complete Reference

```bash
# ── Required ──────────────────────────────────────────────────
PORT=3000
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app

# Use one of these two (not both):
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account-key.json   # local dev only
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 encoded JSON>       # cloud deployments

JWT_SECRET=<minimum 64 random characters — never reuse dev secret>
TIMEZONE=Asia/Kolkata

# ── Cron job timing ───────────────────────────────────────────
MANIFEST_CUTOFF_HOUR=21    # 9 PM IST — orders locked after this
MANIFEST_CRON_HOUR=23      # 11 PM IST — manifest PDF generated

# ── Optional ──────────────────────────────────────────────────
REDIS_URL=redis://:password@host:port   # rate limiting + caching
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

# Troubleshooting

**Backend won't start — Firebase error**
- Check `FIREBASE_SERVICE_ACCOUNT_BASE64` is set and the base64 string has no line breaks
- Verify `FIREBASE_PROJECT_ID` matches your Firebase project exactly

**Admin panel shows blank page**
- Check `VITE_API_URL` is set correctly (must include `/api` at the end)
- Check browser console for CORS errors — update `app.js` CORS origin list
- Ensure the Nginx `try_files` rule is in place (required for React Router)

**Rate limiting not working**
- Redis is not connected — check `REDIS_URL` format and that the Redis instance is running
- The `/api/health` endpoint shows `"redis": false` if disconnected

**Manifest PDFs not generating**
- Check server timezone — `TIMEZONE=Asia/Kolkata` must be set
- Check cron logs: `pm2 logs yaduone-backend | grep -i manifest` (VPS) or platform logs

**PM2 process keeps crashing (VPS)**
```bash
pm2 logs yaduone-backend --lines 50   # see the actual error
pm2 describe yaduone-backend          # see restart count and status
```
