# Phase 5 — Testing, Verification & Deployment Guide

## Section A — Pre-Requisite Manual Tasks

Before testing anything, complete these manual tasks:

### MANUAL TASK 1: Create Firebase Project
- **Why**: Backend + mobile app need Firebase
- **Where**: https://console.firebase.google.com
- **Steps**:
  1. Create new project named "dairy-delivery-mvp"
  2. Disable Google Analytics (not needed)
  3. Click Create

### MANUAL TASK 2: Enable Phone Authentication
- **Where**: Firebase Console → Authentication → Sign-in method
- **Steps**: Enable "Phone" provider, save

### MANUAL TASK 3: Create Firestore Database
- **Where**: Firebase Console → Firestore Database
- **Steps**: Create database → test mode → select asia-south1 region

### MANUAL TASK 4: Download Service Account Key
- **Where**: Firebase Console → Project Settings → Service Accounts
- **Steps**:
  1. Generate new private key
  2. Save as `backend/service-account-key.json`
  3. NEVER commit this file

### MANUAL TASK 5: Configure Backend .env
- Copy `backend/.env.example` → `backend/.env`
- Set `FIREBASE_PROJECT_ID` to your actual project ID
- Set `JWT_SECRET` to a random string

### MANUAL TASK 6: Flutter Firebase Setup
- **Where**: Firebase Console → Project Settings → Add app → Android
- **Steps**:
  1. Register Android app with package `com.dairydelivery.dairy_delivery`
  2. Download `google-services.json` → place in `mobile_app/android/app/`
  3. Add SHA-1 key (run `cd android && ./gradlew signingReport`)
  4. Follow FlutterFire setup: https://firebase.flutter.dev/docs/overview

---

## Section B — Commands to Run

### Backend
```bash
cd backend
cp .env.example .env        # Then edit .env with your values
npm run seed                 # Seeds areas, admins, prices, products
npm run dev                  # Starts server on localhost:3000
```

### Admin Panel
```bash
cd admin-panel
npm run dev                  # Starts on localhost:5173
```

### Flutter App
```bash
cd mobile_app
flutter pub get
flutter run                  # Requires Firebase setup first
```

---

## Section C — Test Checklist

### Backend API Tests (use curl, Postman, or similar)

#### Auth
- [ ] POST /api/auth/admin/login with rajendra_admin / Raj@1234 → get JWT
- [ ] POST /api/auth/admin/login with wrong password → 401
- [ ] GET /api/health → 200

#### Areas
- [ ] GET /api/areas → returns Rajendranagar and Satellite

#### Products
- [ ] GET /api/products → returns 8 seeded products
- [ ] GET /api/products?category=curd → returns only curd products
- [ ] POST /api/products (with admin JWT) → creates new product
- [ ] PUT /api/products/:id → updates product
- [ ] DELETE /api/products/:id → soft-deletes product

#### Prices
- [ ] GET /api/prices → returns cow/buffalo/toned prices
- [ ] PUT /api/prices/cow (admin) → updates price

#### Subscriptions (requires user auth)
- [ ] POST /api/subscriptions → creates subscription
- [ ] GET /api/subscriptions/active → returns subscription
- [ ] PUT /api/subscriptions/:id/pause → pauses
- [ ] PUT /api/subscriptions/:id/resume → resumes
- [ ] PUT /api/subscriptions/:id/cancel → cancels

#### Tomorrow Cart
- [ ] GET /api/tomorrow/status → returns computed cart
- [ ] POST /api/tomorrow/modify → modifies quantity
- [ ] POST /api/tomorrow/skip → skips tomorrow
- [ ] DELETE /api/tomorrow/override → reverts override
- [ ] POST /api/cart/tomorrow/add-item → adds extra product
- [ ] DELETE /api/cart/tomorrow/remove-item/:id → removes product

#### Orders (admin)
- [ ] GET /api/orders/admin/list?date=YYYY-MM-DD → lists orders
- [ ] PUT /api/orders/admin/:id/status → marks delivered

#### Manifests (admin)
- [ ] POST /api/manifests/regenerate → generates PDF
- [ ] GET /api/manifests → lists manifests
- [ ] GET /api/manifests/:id/download → downloads PDF

#### Reports
- [ ] GET /api/reports/admin/dashboard → returns stats
- [ ] GET /api/reports/admin/daily?from=...&to=... → daily stats
- [ ] GET /api/reports/user/summary → user insights

#### Livestreams
- [ ] POST /api/livestreams (admin) → creates livestream
- [ ] GET /api/livestreams/admin/list → lists
- [ ] GET /api/livestreams/active (user) → returns active stream

### Admin Panel Tests
- [ ] Login with rajendra_admin / Raj@1234 → dashboard loads
- [ ] Login with satellite_admin / Sat@1234 → dashboard loads
- [ ] Wrong credentials → error message shown
- [ ] Dashboard shows stats cards and charts
- [ ] Products page: CRUD operations work
- [ ] Users page: lists subscriptions by status
- [ ] Orders page: filter by date, mark as delivered
- [ ] Manifests page: regenerate and download PDF
- [ ] Reports page: date range filtering, charts display
- [ ] Livestreams page: CRUD operations work
- [ ] Prices page: edit milk prices
- [ ] Areas page: displays area list
- [ ] Logout works correctly

### Flutter App Tests
- [ ] OTP login screen appears
- [ ] OTP sent and received
- [ ] After verification, profile completion screen appears (new user)
- [ ] Area dropdown shows Rajendranagar and Satellite
- [ ] After profile completion, home screen loads
- [ ] Home screen shows subscription status and tomorrow cart
- [ ] Create subscription flow works
- [ ] Modify tomorrow's quantity (+/- 0.5L)
- [ ] Skip tomorrow works
- [ ] Add extra products to cart
- [ ] Remove products from cart
- [ ] Reports screen shows insights
- [ ] Order history shows past orders
- [ ] Livestream screen shows active/no stream
- [ ] Notifications screen works
- [ ] Profile screen shows user data
- [ ] Logout works

---

## Section D — Edge Cases to Verify

1. **Cutoff time**: After 9 PM, modifying tomorrow's cart should fail
2. **One subscription per user**: Creating second subscription should fail
3. **Invalid quantities**: Quantity not multiple of 0.5 should fail
4. **Cancelled subscription**: Cannot resume cancelled subscription
5. **Area isolation**: Admin A cannot see admin B's users/orders
6. **Locked price**: Changing milk price doesn't affect existing subscriptions
7. **Idempotent orders**: Running nightly job twice doesn't create duplicate orders
8. **Empty manifest**: Generating manifest with no orders creates PDF with "No orders"
9. **YouTube URL validation**: Invalid URLs rejected for livestreams

---

## Section E — Deployment Notes

### Backend (e.g., Railway, Render, or any Node.js host)
1. Set environment variables from .env
2. Upload service-account-key.json securely
3. Run `npm run seed` once on first deploy
4. Run `npm start`

### Admin Panel
1. Update API base URL if backend is not on same origin
2. Run `npm run build`
3. Deploy `dist/` folder to any static hosting (Vercel, Netlify, etc.)

### Flutter App
1. Configure Firebase for production
2. Update `AppConstants.apiBaseUrl` to production backend URL
3. Run `flutter build apk` or `flutter build ios`
