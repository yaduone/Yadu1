# Implementation Roadmap

## Phase 2 — Backend Implementation (Steps 1–14)

### Step 1: Project Setup
- Initialize Node.js project
- Install dependencies
- Create folder structure
- Create .env.example
- Create server.js entry point

### Step 2: Firebase Config
- Setup Firebase Admin SDK initialization
- Create Firestore helper utility
- MANUAL TASK: Create Firebase project, download service account key

### Step 3: Utility Modules
- Response formatter
- Date helpers (tomorrow date, IST timezone)
- Validation helpers
- Error handler middleware

### Step 4: Auth Module
- Firebase token verification middleware (users)
- JWT generation + verification middleware (admins)
- Admin login endpoint
- User verify endpoint
- User complete-profile endpoint

### Step 5: Seed Script
- Seed areas
- Seed admins (with bcrypt hashed passwords)
- Seed price_config
- Seed sample products

### Step 6: Area Module
- CRUD routes for areas
- Public list endpoint

### Step 7: Product Module
- CRUD routes for products
- Category filtering
- Active/inactive toggle

### Step 8: Subscription Module
- Create subscription
- Get active subscription
- Pause / Resume / Cancel
- Admin list subscriptions by area
- Enforce one-active-per-user rule

### Step 9: Next Day Override Module
- Modify tomorrow quantity
- Skip tomorrow
- Revert override
- Get tomorrow status
- Cutoff time enforcement

### Step 10: Tomorrow Cart Module
- Get computed tomorrow cart
- Add/update/remove extra products
- Cart total calculation

### Step 11: Order Module
- Order creation (called by nightly job)
- Order history for user
- Admin order list by area
- Admin update order status

### Step 12: Manifest Module
- PDF generation with PDFKit
- Manifest creation (called by nightly job)
- Manifest list for admin
- Manifest download
- Manual regeneration

### Step 13: Nightly Cron Job
- Schedule at 11 PM IST
- Process all areas
- Create orders from subscriptions + carts
- Generate manifests
- Cleanup overrides

### Step 14: Reports & Remaining Modules
- User report/insights endpoint
- Admin dashboard endpoint
- Livestream CRUD
- Notification endpoints
- Price config endpoints

---

## Phase 3 — Admin Web Panel (Steps 15–20)

### Step 15: React Project Setup
- Vite + React + Tailwind CSS
- Routing setup
- Auth context
- API service layer

### Step 16: Login & Layout
- Admin login page
- Protected route wrapper
- Sidebar layout with navigation

### Step 17: Dashboard
- Stats cards
- Subscription counts
- Tomorrow delivery summary
- Charts with Recharts

### Step 18: Management Pages
- User management (list, search, view)
- Product management (CRUD)
- Area management

### Step 19: Delivery & Manifests
- Tomorrow delivery summary page
- Manifest list + download
- Regenerate manifest

### Step 20: Reports, Livestream, Settings
- Reports page with charts
- Livestream management CRUD
- Admin profile settings

---

## Phase 4 — Flutter Mobile App (Steps 21–27)

### Step 21: Flutter Project Setup
- Create Flutter project
- Add dependencies
- Setup project structure
- MANUAL TASK: Configure Firebase for Flutter

### Step 22: Auth Flow
- OTP login screen
- Profile completion screen
- Auth state management with Provider

### Step 23: Subscription Screens
- Create subscription
- View active subscription
- Pause/resume/cancel

### Step 24: Tomorrow Cart Screens
- View tomorrow cart (milk + extras)
- Modify quantity (+/- 0.5L, skip)
- Add extra products
- Cart total

### Step 25: Reports & History
- User insights screen
- Order history
- Billing summary

### Step 26: Livestream & Notifications
- Livestream page
- Notifications list

### Step 27: Profile & Polish
- Profile screen
- Address editing
- Support/contact

---

## Phase 5 — Testing & Cleanup (Step 28)

### Step 28: Final Verification
- Test checklist
- Edge case review
- Deployment guide
- Manual verification steps

---

## Manual Setup Tasks (Required Before Coding)

### MANUAL TASK 1: Create Firebase Project
**Why**: Backend needs Firebase Admin SDK to verify tokens and access Firestore.
**Where**: https://console.firebase.google.com
**Steps**:
1. Go to Firebase Console
2. Click "Add Project"
3. Name it (e.g., "dairy-delivery-mvp")
4. Disable Google Analytics (not needed for MVP)
5. Click Create Project

### MANUAL TASK 2: Enable Phone Authentication
**Why**: User login uses OTP via Firebase Auth.
**Where**: Firebase Console → Authentication → Sign-in method
**Steps**:
1. Go to Authentication section
2. Click "Sign-in method" tab
3. Enable "Phone" provider
4. Save

### MANUAL TASK 3: Create Firestore Database
**Why**: All app data is stored in Firestore.
**Where**: Firebase Console → Firestore Database
**Steps**:
1. Go to Firestore Database section
2. Click "Create database"
3. Choose "Start in test mode" (for MVP development)
4. Select region closest to your users (e.g., asia-south1 for India)
5. Click Enable

### MANUAL TASK 4: Download Service Account Key
**Why**: Backend uses this to authenticate with Firebase Admin SDK.
**Where**: Firebase Console → Project Settings → Service Accounts
**Steps**:
1. Go to Project Settings (gear icon)
2. Click "Service Accounts" tab
3. Click "Generate new private key"
4. Download the JSON file
5. Save it as `backend/service-account-key.json`
6. **NEVER commit this file to git**

### MANUAL TASK 5: Set Environment Variables
**Why**: Backend reads config from .env file.
**Where**: backend/.env
**Steps**:
1. Copy backend/.env.example to backend/.env
2. Fill in:
   - PORT=3000
   - FIREBASE_PROJECT_ID=your-project-id
   - JWT_SECRET=a-random-secure-string
   - TIMEZONE=Asia/Kolkata
   - MANIFEST_CUTOFF_HOUR=21

### MANUAL TASK 6: Flutter Firebase Setup (Phase 4)
**Why**: Flutter app needs Firebase config for OTP auth.
**Where**: Firebase Console + Flutter project
**Steps**:
1. In Firebase Console, add Android app
2. Register with your app's package name
3. Download google-services.json → place in android/app/
4. Add iOS app if needed
5. Follow Firebase Flutter setup guide
6. For Android: Add SHA-1 and SHA-256 keys to Firebase project
