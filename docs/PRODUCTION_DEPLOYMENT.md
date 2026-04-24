# Production Deployment Guide — YaduONE

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Flutter Mobile App (Android + iOS)                         │
│  → Firebase Auth (OTP) + REST API calls                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│  React Admin Panel (SPA)                                    │
│  → JWT Auth + REST API calls                                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│  Node.js + Express Backend (Port 3000)                      │
│  → 14 REST modules + nightly cron job (11 PM IST)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    Firestore DB     Firebase Auth    Firebase Storage
    (database)       (user OTP)       (product images)
```

---

## Option 1 — Railway (Recommended for MVP)

**Best for:** Getting to production in under 1 hour. No DevOps knowledge needed.
**Cost:** ~$5/month (Hobby plan)
**Limitations:** No persistent disk (fine — we use Firebase Storage)

### Backend Deployment

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select the repo → set **Root Directory** to `backend`
3. Railway auto-detects Node.js and runs `npm start`
4. Go to **Variables** tab → add all env vars:

```
PORT=3000
FIREBASE_PROJECT_ID=yadu1-821e8
FIREBASE_STORAGE_BUCKET=yadu1-821e8.firebasestorage.app
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account-key.json
JWT_SECRET=<generate a 64-char random string>
TIMEZONE=Asia/Kolkata
MANIFEST_CUTOFF_HOUR=21
MANIFEST_CRON_HOUR=23
```

5. Upload `service-account-key.json` — Railway doesn't support file uploads directly, so encode it:
   - Run locally: `base64 service-account-key.json` → copy the output
   - Add env var: `FIREBASE_SERVICE_ACCOUNT_BASE64=<paste output>`
   - Update `firebase.js` to decode it (see code change below)

6. Go to **Settings** → **Networking** → **Generate Domain** → copy the URL (e.g. `https://yaduone-backend.up.railway.app`)

### Admin Panel Deployment

1. New Project → Deploy from GitHub → Root Directory: `admin-panel`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add env var: `VITE_API_URL=https://yaduone-backend.up.railway.app`
5. Railway serves the static build automatically

### Mobile App

Update `constants.dart`:
```dart
static const String apiBaseUrl = 'https://yaduone-backend.up.railway.app/api';
```

---

## Option 2 — Render

**Best for:** Free tier available, simple setup, good for small teams.
**Cost:** Free (with cold starts) or $7/month (no cold starts)

### Backend

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect GitHub → Root Directory: `backend`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all environment variables (same as Railway above)
6. For `service-account-key.json` — use the base64 approach (same as Railway)

### Admin Panel

1. New → Static Site
2. Root Directory: `admin-panel`
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. Add redirect rule: `/* → /index.html` (for React Router)

---

## Option 3 — VPS (DigitalOcean / Hetzner / Contabo)

**Best for:** Full control, best price-to-performance, production-grade.
**Cost:** $4–6/month (Hetzner CX22 or DigitalOcean Basic Droplet)
**Recommended:** Hetzner CX22 — 2 vCPU, 4 GB RAM, 40 GB SSD, €3.79/month

### Server Setup

```bash
# 1. Create Ubuntu 22.04 server, SSH in as root

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Install PM2 (process manager — keeps backend alive + restarts on crash)
npm install -g pm2

# 4. Install Nginx (reverse proxy + serve admin panel)
apt-get install -y nginx

# 5. Install Certbot (free SSL)
apt-get install -y certbot python3-certbot-nginx
```

### Deploy Backend

```bash
# Clone repo on server
git clone https://github.com/your-org/yaduone.git /var/www/yaduone

# Install dependencies
cd /var/www/yaduone/backend
npm install --production

# Create .env
nano .env
# Paste all env vars

# Upload service-account-key.json
scp service-account-key.json root@your-server:/var/www/yaduone/backend/

# Start with PM2
pm2 start server.js --name yaduone-backend
pm2 save
pm2 startup   # auto-start on server reboot
```

### Build and Deploy Admin Panel

```bash
cd /var/www/yaduone/admin-panel
npm install
npm run build
# dist/ folder is now ready
```

### Nginx Config

Create `/etc/nginx/sites-available/yaduone`:

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
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;   # allow image uploads
    }
}

# Admin Panel
server {
    listen 80;
    server_name admin.yourdomain.com;

    root /var/www/yaduone/admin-panel/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # React Router support
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/yaduone /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Get SSL certificates (free)
certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com
```

---

## Option 4 — Docker + Any Cloud

**Best for:** Consistent environments, easy scaling, CI/CD pipelines.

### Dockerfile for Backend

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# service-account-key.json is injected at runtime via env var
EXPOSE 3000

CMD ["node", "server.js"]
```

### docker-compose.yml (local testing)

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    env_file:
      - ./backend/.env
    volumes:
      - ./backend/service-account-key.json:/app/service-account-key.json:ro
    restart: unless-stopped

  admin-panel:
    build:
      context: ./admin-panel
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

### Dockerfile for Admin Panel

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Deploy the Docker image to any of:
- **Railway** (supports Docker)
- **Fly.io** (free tier, great for small apps)
- **Google Cloud Run** (pay per request, scales to zero)
- **AWS ECS** (enterprise grade)

---

## Firebase Service Account — Secure Handling

The `service-account-key.json` file cannot be committed to git. Use this pattern for all cloud platforms:

### Step 1 — Encode locally

```bash
# On your machine
base64 -i backend/service-account-key.json
# Copy the entire output string
```

### Step 2 — Add to platform env vars

```
FIREBASE_SERVICE_ACCOUNT_BASE64=<paste the base64 string>
```

### Step 3 — Update firebase.js

```js
// In backend/src/config/firebase.js
// Replace the file-based loading with:

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  // Cloud deployment — decode from env var
  const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
  serviceAccount = JSON.parse(decoded);
} else {
  // Local development — load from file
  try {
    serviceAccount = require(serviceAccountPath);
  } catch (err) {
    console.warn('WARNING: Firebase service account key not found');
  }
}
```

---

## Mobile App — Production Build

### Before Building

Update `mobile_app/lib/utils/constants.dart`:
```dart
static const String apiBaseUrl = 'https://api.yourdomain.com/api';
```

### Android APK / AAB

```bash
cd mobile_app

# Release APK (for direct install / testing)
flutter build apk --release

# Release AAB (for Google Play Store)
flutter build appbundle --release
```

Output: `build/app/outputs/flutter-apk/app-release.apk`

**Before Play Store submission:**
- Create a keystore file for signing
- Add signing config to `android/app/build.gradle.kts`
- Update `applicationId` from `com.dairydelivery.dairy_delivery` to your actual package name

### iOS IPA

```bash
flutter build ios --release
# Then archive and distribute via Xcode or Fastlane
```

Requires: Mac, Apple Developer account ($99/year), provisioning profiles.

---

## Environment Variables — Complete Reference

```bash
# ── Required ──────────────────────────────────────────────────
PORT=3000
FIREBASE_PROJECT_ID=yadu1-821e8
FIREBASE_STORAGE_BUCKET=yadu1-821e8.firebasestorage.app
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account-key.json
# OR for cloud deployments:
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 encoded service account JSON>

JWT_SECRET=<minimum 64 random characters — never reuse dev secret>
TIMEZONE=Asia/Kolkata

# ── Cron job timing ───────────────────────────────────────────
MANIFEST_CUTOFF_HOUR=21    # 9 PM — orders locked after this
MANIFEST_CRON_HOUR=23      # 11 PM — manifest PDF generated
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## CORS — Update for Production

In `backend/src/app.js`, replace the open CORS with your actual domain:

```js
app.use(cors({
  origin: [
    'https://admin.yourdomain.com',
    'http://localhost:5173',   // keep for local dev
  ],
  credentials: true,
}));
```

---

## Deployment Comparison

| | Railway | Render | VPS (Hetzner) | Docker/Fly.io |
|---|---|---|---|---|
| Cost/month | ~$5 | Free–$7 | ~$4 | Free–$5 |
| Setup time | 30 min | 30 min | 2–3 hours | 1–2 hours |
| DevOps needed | None | None | Basic Linux | Basic Docker |
| Cold starts | No | Yes (free) | No | No |
| Custom domain | Yes | Yes | Yes | Yes |
| SSL | Auto | Auto | Certbot | Auto |
| Cron job support | Yes | Yes | Yes (PM2) | Yes |
| Best for | Quick launch | Free tier | Full control | Scalability |

---

## Recommended Path

**Phase 1 — Launch (today):**
→ Railway for backend + admin panel. Takes 30 minutes. $5/month.

**Phase 2 — Scale (when you have 100+ users):**
→ Migrate to Hetzner VPS. More control, cheaper, better performance.

**Phase 3 — Growth:**
→ Add Redis for caching, separate the cron job to a worker process, add a CDN in front of the admin panel.
