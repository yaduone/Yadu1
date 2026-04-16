# System Architecture

## Overview

Three-tier architecture with clear separation:

```
┌─────────────────┐     ┌─────────────────┐
│  Flutter App     │     │  React Admin     │
│  (User Mobile)   │     │  (Web Panel)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │ HTTPS / REST
                     ▼
         ┌───────────────────────┐
         │   Node.js + Express   │
         │   Backend API Server  │
         │                       │
         │  ┌─────────────────┐  │
         │  │  Auth Middleware │  │
         │  │  Route Handlers │  │
         │  │  Service Layer  │  │
         │  │  Cron Jobs      │  │
         │  └─────────────────┘  │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐          ┌───────▼───────┐
    │Firestore│          │Firebase Auth  │
    │Database │          │(OTP for users)│
    └─────────┘          └───────────────┘
```

## Components

### 1. Backend API Server (Node.js + Express)
- REST API serving both mobile app and admin panel
- JWT-based auth for admins, Firebase token verification for users
- Business logic in service layer (not in route handlers)
- node-cron for nightly manifest generation
- PDFKit for manifest PDF generation

### 2. User Mobile App (Flutter)
- Firebase Auth for OTP login
- Communicates with backend via REST APIs
- State management: Provider
- Local storage for caching user session

### 3. Admin Web Panel (React + Vite)
- Username/password login via backend JWT
- Communicates with backend via REST APIs
- Tailwind CSS for styling
- Recharts for dashboard charts

### 4. Database (Firestore)
- NoSQL document database
- Collections for each entity
- Denormalized where needed for read performance

## Key Design Decisions

1. **Backend-first**: All business logic lives in the backend. Frontend/mobile are thin clients.
2. **Tomorrow cart is computed, not stored permanently**: The cart for tomorrow is rebuilt from subscription + overrides + extras. This prevents stale state.
3. **Area isolation**: Every query filters by area. Admins only access their area's data.
4. **Single server**: No microservices. One Express server handles everything for MVP.
5. **Firebase Auth for users only**: Admins use local JWT auth to keep it simple and separate.

## Authentication Flow

### User (Mobile App)
1. User enters phone number
2. Firebase Auth sends OTP
3. User verifies OTP → gets Firebase ID token
4. App sends Firebase ID token to backend
5. Backend verifies token via Firebase Admin SDK
6. Backend returns its own JWT (or uses Firebase token directly)
7. Subsequent requests use Authorization: Bearer <firebase_id_token>

### Admin (Web Panel)
1. Admin enters username + password
2. Backend validates credentials against admins collection
3. Backend returns JWT with admin_id and area_id
4. Subsequent requests use Authorization: Bearer <jwt>

## Cron Jobs

### Nightly Manifest Generation
- Runs at 11:00 PM every night
- For each area:
  1. Fetch all active subscriptions
  2. Apply next-day overrides (quantity changes, skips)
  3. Include extra products from next-day carts
  4. Generate PDF manifest
  5. Store manifest record in Firestore
  6. Clean up processed overrides

## Folder Structure

```
yaduone-cla/
├── docs/                    # Design documents
├── backend/
│   ├── src/
│   │   ├── config/          # Firebase config, env, constants
│   │   ├── middleware/       # Auth, error handling, validation
│   │   ├── modules/
│   │   │   ├── auth/        # Auth routes, controller, service
│   │   │   ├── users/       # User routes, controller, service
│   │   │   ├── admins/      # Admin routes, controller, service
│   │   │   ├── areas/       # Area routes, controller, service
│   │   │   ├── products/    # Product routes, controller, service
│   │   │   ├── subscriptions/ # Subscription routes, controller, service
│   │   │   ├── cart/        # Tomorrow cart routes, controller, service
│   │   │   ├── orders/      # Order routes, controller, service
│   │   │   ├── manifests/   # Manifest routes, controller, service, PDF generator
│   │   │   ├── reports/     # Reports routes, controller, service
│   │   │   ├── livestreams/ # Livestream routes, controller, service
│   │   │   └── notifications/ # Notification routes, controller, service
│   │   ├── jobs/            # Cron job definitions
│   │   ├── utils/           # Helpers (date, validation, response)
│   │   └── app.js           # Express app setup
│   ├── seeds/               # Seed data scripts
│   ├── manifests/           # Generated PDF storage (gitignored)
│   ├── package.json
│   ├── .env.example
│   └── server.js            # Entry point
├── admin-panel/
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   ├── context/         # Auth context
│   │   ├── hooks/           # Custom hooks
│   │   ├── utils/           # Helpers
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── mobile-app/              # Flutter project
│   ├── lib/
│   │   ├── models/          # Data models
│   │   ├── providers/       # State management
│   │   ├── screens/         # UI screens
│   │   ├── services/        # API services
│   │   ├── widgets/         # Reusable widgets
│   │   ├── utils/           # Helpers
│   │   └── main.dart
│   └── pubspec.yaml
└── README.md
```
