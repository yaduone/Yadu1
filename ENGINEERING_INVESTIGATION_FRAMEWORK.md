# YaduOne — Engineering Investigation Framework

**Purpose.** This document is a *collection instrument*, not an analysis. It specifies exactly what artifacts must be gathered before a production architecture and performance review of the YaduOne system. It is complete when another senior engineer can read it end-to-end and understand the entire system without asking a single follow-up question.

**Status:** `[ ] Not started  [ ] In progress  [ ] Complete`
**Owner:** `<name>`
**Review date:** `<YYYY-MM-DD>`
**Commit under review:** `<git rev-parse HEAD output>`

**Rules for whoever fills this in**
1. Paste real artifacts. Never summarize a file when the instruction says paste it.
2. If an item does not exist in the system, write `NOT PRESENT` — never leave it blank and never invent a plausible answer. `NOT PRESENT` is a finding; a blank is a gap in the investigation.
3. Every measurement must record device/environment, timestamp, and whether it was a debug or release/production build. A number without those three is discarded.
4. Do not propose fixes anywhere in this document except the final Findings tables, which stay empty during collection.

---

## Table of Contents

| § | Section | Owner | Status |
|---|---|---|---|
| 1 | System Overview | | |
| 2 | Complete Execution Flows | | |
| 3 | Flutter Architecture | | |
| 4 | Network Layer | | |
| 5 | Backend Architecture | | |
| 6 | API Inventory | | |
| 7 | Data Layer (Firestore + Redis) | | |
| 8 | Infrastructure | | |
| 9 | External Dependencies | | |
| 10 | Production Readiness | | |
| 11 | Performance Evidence | | |
| 12 | Engineering Findings *(leave empty)* | | |

---

# 1. System Overview

## 1.1 Architecture narrative

Document, in prose, the answer to: *what are the deployable units, what talks to what, and what is the source of truth for each piece of data?*

**Paste here:** `<narrative>`

## 1.2 Required diagrams

Each diagram must be committed to `docs/diagrams/` as source (Mermaid/draw.io) plus a rendered PNG, and embedded here.

| # | Diagram | Must show | Reason it is required | File |
|---|---|---|---|---|
| D1 | System context | Mobile app, admin-panel, website, backend, Firestore, Redis, Firebase Auth/FCM/Storage, Railway | Establishes the trust and failure boundaries everything else is reasoned against | `docs/diagrams/D1-context.*` |
| D2 | Deployment topology | Railway services, regions, replica counts, Redis instance, custom domains, which envs exist | Determines whether scaling and latency questions are even answerable | `docs/diagrams/D2-deployment.*` |
| D3 | Request path | Client → DNS → Railway edge → Express middleware chain → module → Firestore/Redis | Baseline for every latency attribution in §11 | `docs/diagrams/D3-request-path.*` |
| D4 | Firestore collection map | Every collection, subcollection, document ID scheme, and reference edges | Firestore has no schema to introspect; without this the data model is undiscoverable | `docs/diagrams/D4-collections.*` |
| D5 | Auth sequence | Firebase phone auth → ID token → backend verify → app JWT → refresh | Auth spans three systems and is the highest-risk flow | `docs/diagrams/D5-auth.*` |
| D6 | Scheduled job timeline | All `node-cron` jobs on a 24h axis, with timezone | Job overlap and cost spikes are invisible without a time axis | `docs/diagrams/D6-jobs.*` |
| D7 | Order/subscription state machine | Every state, transition, and who may trigger it | Business-critical correctness surface | `docs/diagrams/D7-order-states.*` |

## 1.3 Technology stack

Fill one row per component. Version must come from a lockfile or a runtime command, not from memory.

| Layer | Technology | Version | Source of truth for version | Command that proves it |
|---|---|---|---|---|
| Mobile | Flutter / Dart | | `mobile_app/pubspec.lock` | `flutter --version` |
| Mobile state | `provider` | | `pubspec.lock` | |
| Mobile HTTP | `http` | | `pubspec.lock` | |
| Backend runtime | Node.js | | Railway runtime | `node -v` on the deployed container |
| Backend framework | Express | | `backend/package-lock.json` | |
| Primary datastore | Cloud Firestore | n/a | Firebase console | |
| Cache / rate-limit store | Redis (`ioredis`) | | `backend/package-lock.json` | `redis-server --version` or provider console |
| Auth | Firebase Auth + `jsonwebtoken` | | `pubspec.lock` / `package-lock.json` | |
| Push | FCM (`firebase_messaging`, `firebase-admin`) | | both lockfiles | |
| Object storage | Firebase Storage | n/a | | |
| Scheduling | `node-cron` | | `package-lock.json` | |
| PDF generation | `pdfkit` | | `package-lock.json` | |
| Admin panel | `<framework>` | | `admin-panel/package.json` | |
| Website | `<framework>` | | `website/` | |
| Hosting (API) | Railway | n/a | Railway dashboard | |
| Hosting (admin) | Netlify and/or Vercel — **resolve which** | n/a | `admin-panel/netlify.toml`, `admin-panel/vercel.json` | |

> **Explicit unknown to resolve:** `admin-panel/` contains both `netlify.toml` and `vercel.json`. Record which one is live, and whether the other is dead configuration.

**Attach:** full `backend/package.json`, `mobile_app/pubspec.yaml`, `admin-panel/package.json`. Attach both lockfiles as files, not inline.

## 1.4 Repository layout

Paste the output of a depth-3 tree excluding `node_modules`, `build`, `.dart_tool`, `dist`, `.git`.

```
<paste tree output>
```

Then annotate every top-level directory:

| Path | Purpose | Deployed? | Deployed where | Owner |
|---|---|---|---|---|
| `backend/` | Express API | | Railway | |
| `mobile_app/` | Flutter client | | Play Store / App Store | |
| `admin-panel/` | | | | |
| `website/` | | | | |
| `docs/` | Design docs | No | — | |
| `.kiro/specs/` | | | | |
| `backend/manifests/` | | | | |
| `backend/migrations/` | One-off data scripts | | | |
| `backend/seeds/` | | | | |
| `backend/logs/` | | | | |

Also record, for each of the ~12 loose Markdown files at repo root and in `docs/`: is it current, superseded, or stale? A reviewer must not be misled by outdated design docs.

| Doc | Last meaningful update | Current / Superseded / Stale | Superseded by |
|---|---|---|---|
| `ARCHITECTURE_AUDIT.md` | | | |
| `docs/01-architecture.md` … `06-testing-and-verification.md` | | | |
| `CART_CONFIRMATION_*.md` (4 files) | | | |
| `INSTANT_DELIVERY_FEATURE.md` | | | |
| `LOCATION_FEATURE_*.md` | | | |
| `docs/PRODUCTION_DEPLOYMENT.md` | | | |

## 1.5 Business domain

Explain the product in terms an engineer with no dairy-delivery context can follow.

| Item | Content |
|---|---|
| What the business does | |
| Who the actors are (customer, delivery agent, admin, …) | |
| What a "subscription" is and its lifecycle | |
| What "instant" delivery is and how it differs from subscription | |
| What a "manifest" is, who consumes it, and when it is generated | |
| What "dues" represent and how they are settled | |
| What an "area" is and how it constrains a user | |
| Delivery cutoff times and the timezone they are evaluated in | |
| Money handling: is payment in-app, on-delivery, or ledger-only? | |

## 1.6 Critical user journeys

Rank by business criticality. These drive §2 — every journey marked P0 or P1 requires a full execution flow.

| ID | Journey | Actor | Priority | Daily volume | Peak hour | Revenue-bearing | §2 flow written |
|---|---|---|---|---|---|---|---|
| J1 | First launch → phone OTP → profile → home | Customer | P0 | | | | |
| J2 | Browse products → add to cart → confirm tomorrow's delivery | Customer | P0 | | | | |
| J3 | Create/modify/pause subscription | Customer | P0 | | | | |
| J4 | Instant order placement → expiry | Customer | P0 | | | | |
| J5 | Nightly manifest generation | System (cron) | P0 | | | | |
| J6 | Delivery marked complete → dues updated | Admin/agent | P0 | | | | |
| J7 | Push notification receipt → deep link | Customer | P1 | | | | |
| J8 | Livestream view | Customer | P1 | | | | |
| J9 | Reports / delivery logs | Customer | P1 | | | | |
| J10 | Admin: price change, inventory, carousel, onboarding config | Admin | P1 | | | | |
| J11 | Forced app update (`in_app_update`) | Customer | P2 | | | | |

## 1.7 Application boundaries

| Boundary | Crossed by | Protocol | Auth | Timeout | Failure mode when the far side is down |
|---|---|---|---|---|---|
| App → Backend | | HTTPS/JSON | | | |
| App → Firebase Auth | | | | | |
| App → FCM | | | | | |
| App → Firebase Storage (images) | | | | | |
| App → YouTube (livestream) | | | | | |
| Backend → Firestore | | gRPC | service account | | |
| Backend → Redis | | | | | |
| Backend → FCM | | | | | |
| Backend → Firebase Storage | | | | | |
| Admin panel → Backend | | | | | |

## 1.8 Environments

| Env | Exists? | API URL | Firebase project | Redis | Who can deploy | Data realism | Notes |
|---|---|---|---|---|---|---|---|
| Local | | | | | | | |
| Staging | | | | | | | |
| Production | | | | | | | |

**Attach:** a redacted copy of every environment's variable set — key names and whether set, values masked. Source: Railway variables tab, `backend/src/config/index.js`.

| Variable | Read in | Required? | Default if unset | Set in prod? | Set in staging? |
|---|---|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | `config/firebase.js` | | | | |
| `FIREBASE_PROJECT_ID` | | | | | |
| `FIREBASE_STORAGE_BUCKET` | | | | | |
| `REDIS_URL` | `config/redis.js` | | | | |
| `JWT_SECRET` | | | | | |
| `ALLOWED_ORIGINS` | `app.js` CORS | | | | |
| `PORT` | `server.js` | | | | |
| *(complete from `config/index.js` — every key)* | | | | | |

> **Item to resolve explicitly:** `backend/service-account-key.json` exists as a file in the working tree. Record (a) whether it is tracked by git, (b) whether it has ever been committed in history, (c) which credential path production actually uses. Command: `git log --all --oneline -- backend/service-account-key.json` and `git check-ignore -v backend/service-account-key.json`. Paste both outputs verbatim.

---

# 2. Complete Execution Flows

One subsection per P0/P1 journey from §1.6. The purpose is a single artifact where every hop is named with a real file and line, so latency and failure can be attributed to a layer rather than guessed at.

## 2.0 Template — copy this per feature

### Flow: `<Journey ID — name>`

**Trigger:** `<exact user action, e.g. taps "Confirm" in cart>`
**Entry widget:** `<file:line>`
**Preconditions:** `<auth state, cached data, connectivity assumptions>`

#### Hop table

| # | Layer | Artifact (file:line) | What happens | Sync/Async | Can fail? | Failure surfaced to user as | Measured duration |
|---|---|---|---|---|---|---|---|
| 1 | User action | | | | | | |
| 2 | Flutter widget | | | | | | |
| 3 | State management (Provider) | | | | | | |
| 4 | Service / repository | | | | | | |
| 5 | API client (`api_service.dart`) | | | | | | |
| 6 | HTTP request emitted | | method, path, headers, body size | | | | |
| 7 | Railway edge | | | | | | |
| 8 | Express global middleware | `app.js` | helmet → cors → json → rate limiter | | | | |
| 9 | Route middleware | `middleware/auth.js`, `cache.js` | | | | | |
| 10 | Route handler | `<module>.routes.js:<line>` | | | | | |
| 11 | Service / business logic | `<module>.service.js:<line>` | | | | | |
| 12 | Firestore reads/writes | | collection, query shape, doc count | | | | |
| 13 | Redis access | | key, TTL, hit or miss | | | | |
| 14 | External service calls | | | | | | |
| 15 | Serialization | `utils/response.js` | | | | | |
| 16 | Network response | | status, body size, `Content-Encoding` | | | | |
| 17 | Flutter parsing | | `jsonDecode` + model mapping, on which isolate | | | | |
| 18 | State update | | which `notifyListeners()` | | | | |
| 19 | Widget rebuild | | which subtree rebuilds, measured count | | | | |
| 20 | UI updated | | frame count from action to paint | | | | |

#### Required attachments per flow

| Artifact | How to capture | Why |
|---|---|---|
| Widget code | paste the screen file | anchors hops 2–3 |
| Provider code | paste the provider file | anchors hop 3–4, 18 |
| Route + service code | paste both `.routes.js` and `.service.js` | anchors hops 10–13 |
| Raw request/response pair | Charles/mitmproxy or `curl -v` against prod with a test account | ground truth for size and status |
| DevTools Timeline export | Flutter DevTools → Performance → export, covering trigger → paint | attributes hops 17–20 |
| Server timing log lines | correlate by request id | attributes hops 8–16 |
| Screenshot: before / loading / success / error / empty / offline | device screenshots, release build | proves which states actually exist |

#### Sequence diagram

`<Mermaid sequenceDiagram covering hops 1–20>`

---

## 2.1 J1 — Onboarding & Authentication
Files known to be involved: `mobile_app/lib/screens/splash/`, `screens/onboarding/`, `screens/auth/login_screen.dart`, `otp_screen.dart`, `complete_profile_screen.dart`, `providers/auth_provider.dart`, `services/onboarding_service.dart`, `backend/src/modules/auth/`, `modules/onboarding/`, `middleware/auth.js`.
Additionally document: where the token is stored, its lifetime, refresh trigger, behaviour on 401 mid-session, and Firebase App Check enforcement state.

`<fill using §2.0 template>`

## 2.2 J2 — Cart & tomorrow's delivery confirmation
Files: `screens/cart/cart_screen.dart`, `providers/cart_provider.dart`, `services/cart_cache_service.dart`, `models/pending_cart_item.dart`, `models/cart_charge.dart`, `utils/cart_delivery_copy.dart`, `backend/src/modules/cart/cart.routes.js`, `cart/tomorrow.routes.js`.
Additionally document: the cutoff-time rule and where it is evaluated (client, server, or both), and what the cache service persists across launches.

`<fill>`

## 2.3 J3 — Subscriptions
Files: `screens/subscription/`, `providers/subscription_provider.dart`, `providers/calendar_provider.dart`, `widgets/delivery_calendar.dart`, `backend/src/modules/subscriptions/`.
Additionally document: the full pause/resume/modify semantics and how calendar data is paginated or bounded.

`<fill>`

## 2.4 J4 — Instant delivery
Files: `screens/instant/`, `providers/instant_provider.dart`, `providers/instant_mode_provider.dart`, `theme/instant_theme.dart`, `backend/src/modules/instant/`, `backend/src/jobs/instantOrderExpiry.js`.
Additionally document: expiry window, who cancels, and what the user sees when an order expires while the screen is open.

`<fill>`

## 2.5 J5 — Nightly manifest generation *(system-triggered)*
Files: `backend/src/jobs/nightlyManifest.js`, `backend/src/modules/manifests/`, `backend/manifests/`.
Hops 1–5 are replaced by: cron trigger → schedule expression → timezone. Document total documents read and written per run, wall-clock duration, and behaviour if the container restarts mid-run.

| Item | Value |
|---|---|
| Cron expression + timezone | |
| Runs on every replica or one? | |
| Idempotent? | |
| Documents read per run | |
| Documents written per run | |
| Wall-clock duration (last 7 runs) | |
| Failure alerting | |
| Recovery procedure if a night is missed | |

## 2.6 J6 — Delivery completion & dues
Files: `backend/src/modules/orders/`, `modules/dues/`, `backend/fixDues.js`, `mobile_app/lib/screens/dues/`, `screens/profile/delivery_logs_screen.dart`.
Additionally document: whether dues are recomputed or incrementally mutated, and what transaction/consistency guarantee applies.

> **Item to resolve:** `backend/fixDues.js` is a root-level repair script. Record what it repairs, when it was last run, and whether it is ever run against production.

`<fill>`

## 2.7 J7 — Push notifications
Files: `mobile_app/lib/services/fcm_service.dart`, `screens/notifications/`, `backend/src/modules/notifications/`.
Document all three delivery states (foreground, background, terminated), token registration and refresh, topic vs. direct-token sends, and deep-link routing.

`<fill>`

## 2.8 J8–J11
`<fill using §2.0 template for livestream, reports, admin operations, forced update>`

---

# 3. Flutter Architecture

## 3.1 Folder structure and conventions

**Paste:** `mobile_app/lib/` tree.

| Directory | Contains | Naming convention | Layer rule (what it may import) |
|---|---|---|---|
| `models/` | | | |
| `providers/` | | | |
| `screens/` | | | |
| `services/` | | | |
| `theme/` | | | |
| `utils/` | | | |
| `widgets/` | | | |

> **Item to resolve:** `models/` holds only two files while screens are numerous. Document where the other response types are represented — raw `Map<String, dynamic>`, inline classes, or elsewhere. This determines how parsing cost and type safety are assessed.

## 3.2 Startup sequence

Paste `mobile_app/lib/main.dart` in full, then decompose it:

| # | Step | File:line | Blocking? | Duration (cold) | Duration (warm) | Failure behaviour |
|---|---|---|---|---|---|---|
| 1 | `WidgetsFlutterBinding.ensureInitialized` | | | | | |
| 2 | `Firebase.initializeApp` | | | | | |
| 3 | App Check activation | | | | | |
| 4 | FCM init & permission | | | | | |
| 5 | `SharedPreferences` load | | | | | |
| 6 | Provider tree construction | | | | | |
| 7 | Splash screen shown | | | | | |
| 8 | Auth state resolution | | | | | |
| 9 | First network call issued | | | | | |
| 10 | First meaningful paint | | | | | |
| 11 | Update check (`in_app_update`) | | | | | |

**Measure with:** `flutter run --profile --trace-startup` → paste `start_up_info.json`. Repeat 5× on each device tier in §3.10 and record all runs, not an average.

## 3.3 Navigation

| Item | Content |
|---|---|
| Router type (imperative `Navigator`, named routes, generated) | |
| Route table location | |
| Deep link handling (FCM, `url_launcher`) | |
| Custom transitions | `utils/transitions.dart` — paste |
| Are routes disposed or kept alive? | |
| Back-button / predictive-back behaviour | |

**Paste:** route definitions, `utils/transitions.dart`.

## 3.4 State management

| Provider | File | Type (`ChangeNotifier`/other) | Scope (global/screen) | Holds what | Listener count | `notifyListeners()` call sites |
|---|---|---|---|---|---|---|
| `AuthProvider` | | | | | | |
| `CartProvider` | | | | | | |
| `CalendarProvider` | | | | | | |
| `SubscriptionProvider` | | | | | | |
| `InstantProvider` | | | | | | |
| `InstantModeProvider` | | | | | | |

**Paste:** every file in `lib/providers/`. Also paste the `MultiProvider` block from `main.dart`.

Record for each: is it `Consumer`, `Selector`, or `context.watch` at the consumption site, and at what widget depth.

## 3.5 Dependency injection

| Item | Content |
|---|---|
| DI mechanism (Provider only? service locator? none?) | |
| How `ApiService` is obtained by callers | |
| Singletons and who owns their lifetime | |
| Anything constructed per-build | |
| Test seams (can services be swapped in tests?) | |

## 3.6 Widget hierarchy & rendering

For each P0 screen, attach:

| Screen | Widget tree depth | Widget count | `const` ratio | Rebuild count on a typical interaction | DevTools screenshot |
|---|---|---|---|---|---|
| Home | | | | | |
| Products | | | | | |
| Cart | | | | | |
| Subscription | | | | | |
| Instant | | | | | |

**Capture:** DevTools → Widget Inspector → "Track widget rebuilds"; screenshot the rebuild counts overlay. Also attach the Widget Details Tree export.

**Paste:** `widgets/premium_components.dart`, `widgets/delivery_calendar.dart`, `screens/home/widgets/curved_navbar.dart` — these are the shared/custom-painted widgets whose cost is not obvious from usage sites.

## 3.7 Image loading

| Item | Content |
|---|---|
| Library | `cached_network_image` |
| Disk cache location, size cap, eviction policy | |
| `memCacheWidth`/`memCacheHeight` usage (list per call site) | |
| Placeholder / error widgets | |
| Image origin (Firebase Storage / other) | |
| Are images resized server-side or shipped at full resolution? | |
| Largest image byte size in a product list response | |
| Total bytes downloaded on a cold Products screen load | |

**Capture:** network waterfall for a cold Products screen; list every image with URL, dimensions, bytes.
**Paste:** `widgets/remote_carousel.dart`, and every `CachedNetworkImage` construction site.

## 3.8 Memory

| Scenario | RSS at start | RSS after | Dart heap | Image cache bytes | External bytes | Method |
|---|---|---|---|---|---|---|
| Cold start → home idle 60s | | | | | | DevTools Memory |
| Scroll Products to end | | | | | | |
| 10× navigate in/out of Product Detail | | | | | | |
| Open/close cart 20× | | | | | | |
| Background 5 min → foreground | | | | | | |
| 30 min continuous use | | | | | | |

**Attach:** DevTools memory timeline screenshots plus a heap snapshot (`.json`) at the start and end of the 30-minute session. Profile build only.

## 3.9 Background isolates, animations, pagination, offline, caching, lifecycle, platform channels

| Topic | What to document | Where to look |
|---|---|---|
| Isolates | Every `compute()`/`Isolate.spawn` call, and what JSON parsing happens on the UI isolate | grep `compute(`, `jsonDecode` |
| Animations | Every `AnimationController`: duration, curve, whether disposed, whether it drives layout or only paint | grep `AnimationController` |
| Pagination | Per list screen: paginated or full-fetch? page size, trigger, dedup, end-of-list handling | `products_screen.dart`, `delivery_logs_screen.dart`, `notifications_screen.dart`, `reports_screen.dart` |
| Offline storage | Every `SharedPreferences` key: name, type, size, write frequency, migration story | grep `SharedPreferences`, `cart_cache_service.dart` |
| Client caching | What responses are cached, TTL, invalidation trigger, staleness ceiling | `cart_cache_service.dart` |
| App lifecycle | `AppLifecycleState` handlers; what refetches on resume; what is cancelled on pause | grep `didChangeAppLifecycleState` |
| Platform channels | Every plugin crossing the boundary and whether any call is on the UI thread's critical path | `pubspec.yaml` plugin list |

**Paste:** `services/cart_cache_service.dart`, `services/update_service.dart`, `utils/error_handler.dart`, `utils/constants.dart`.

**Fill:** SharedPreferences key inventory —

| Key | Written by | Read by | Type | Typical size | Written how often | Cleared on logout? |
|---|---|---|---|---|---|---|

## 3.10 Device matrix

All mobile measurements in §11 must be repeated across this matrix. Record it once here.

| Tier | Device | OS version | RAM | Network condition | Used for |
|---|---|---|---|---|---|
| Low | | | | 3G throttled | worst-case |
| Mid | | | | 4G | representative |
| High | | | | WiFi | best-case |

---

# 4. Network Layer

## 4.1 Client configuration

**Paste:** `mobile_app/lib/services/api_service.dart` in full.

| Item | Value | Source (file:line) |
|---|---|---|
| Client type (`http.Client`, one-shot `http.get`, …) | | |
| Is a single `Client` reused across requests? | | |
| Base URL(s) per environment | | `utils/constants.dart` |
| Connect timeout | | |
| Read/response timeout | | |
| Total request timeout | | |
| Retry policy (count, backoff, which status codes, which methods) | | |
| Idempotency keys on writes | | |
| Auth header injection point | | |
| 401 handling / token refresh | | |
| Request cancellation on screen dispose | | |
| Compression (`Accept-Encoding` sent? `Content-Encoding` returned?) | | |
| Certificate pinning | | |
| Logging of requests in release builds | | |

> **Item to resolve:** the client is the `http` package, which has no interceptor concept. Document what plays the role of interceptors (a wrapper method, per-call boilerplate, or nothing), since cross-cutting concerns — auth, retry, logging, tracing — must live somewhere.

## 4.2 Connection behaviour

| Measurement | Value | How captured |
|---|---|---|
| Is the TCP/TLS connection reused between calls? | | packet capture or server access log connection ids |
| TLS handshake time (cold) | | Charles / `curl -w` |
| DNS resolution time (cold) | | `curl -w '%{time_namelookup}'` |
| Time to first byte, p50/p95, per endpoint | | §6 table |
| HTTP version negotiated | | `curl -v` |

**Paste:** `curl -w "@curl-format.txt" -o /dev/null -s https://<prod-api>/api/health` output, run 10× cold and 10× warm.

## 4.3 Request choreography per screen

For each P0 screen, list every request the screen fires, in order, with dependency relationships. This exposes sequential chains that could be parallel and duplicate fetches.

| Screen | # | Endpoint | Fires at | Depends on | Sequential or parallel | Bytes down | Duration |
|---|---|---|---|---|---|---|---|
| Splash → Home | 1 | | | | | | |
| | 2 | | | | | | |
| Products | | | | | | | |
| Cart | | | | | | | |
| Subscription | | | | | | | |

**Attach:** a network waterfall screenshot per screen (Charles Proxy or DevTools Network tab), release build, mid-tier device, 4G.

## 4.4 Payload sizes

| Endpoint | Request bytes | Response bytes (uncompressed) | Response bytes (on wire) | Largest observed | What dominates the payload |
|---|---|---|---|---|---|

Capture the largest realistic response for each — e.g. a user with the maximum number of subscriptions, a full month of calendar data, the longest delivery log.

---

# 5. Backend Architecture

## 5.1 Folder structure

**Paste:** `backend/src/` tree and describe the module convention.

| Convention question | Answer |
|---|---|
| Is every module `X.routes.js` + `X.service.js`? List exceptions. | |
| Where does validation live? | `express-validator` — in routes or separately? |
| Where does Firestore access live — routes or services? | |
| Is there a repository/data-access layer, or do services call Firestore directly? | |
| Is business logic ever in a route handler? List cases. | |

**Paste in full:** `backend/server.js`, `backend/src/app.js`, `backend/src/config/index.js`, `config/redis.js`, `config/firebase.js`, `middleware/auth.js`, `middleware/cache.js`, `middleware/rateLimiter.js`, `middleware/errorHandler.js`, `utils/response.js`, `utils/validators.js`, `utils/storage.js`, `utils/date.js`, `utils/activityLog.js`.

## 5.2 Bootstrap sequence

| # | Step | File:line | Blocking? | Duration | Failure behaviour (crash / degrade) |
|---|---|---|---|---|---|
| 1 | Env load (`dotenv`) | | | | |
| 2 | Redis client creation | `app.js` — `getRedisClient()` at import time | | | |
| 3 | Firebase Admin init | `config/firebase.js` | | | |
| 4 | Route module imports | | | | |
| 5 | Middleware registration | | | | |
| 6 | Cron job registration | `jobs/` | | | |
| 7 | HTTP listen | `server.js` | | | |
| 8 | First request served | | | | |

**Measure:** timestamped log lines at each step; paste a full container startup log from a real deploy.

Answer explicitly: **does the process accept traffic before Redis and Firebase are ready, and what happens to a request that arrives in that window?**

## 5.3 Middleware chain

Enumerate in execution order, exactly as registered.

| Order | Middleware | File | Applies to | Cost per request | Can short-circuit? | Notes |
|---|---|---|---|---|---|---|
| 1 | `helmet()` | `app.js` | all | | | |
| 2 | `cors()` | `app.js` | all | | | dynamic origin fn |
| 3 | `express.json()` | `app.js` | all | | | body size limit = ? |
| 4 | rate limiter (`limit.auth` / `limit.public` / `limit.medium` / …) | `middleware/rateLimiter.js` | per route group | | | Redis-backed |
| 5 | `auth` | `middleware/auth.js` | per route | | | verifies which token type? |
| 6 | `cache` | `middleware/cache.js` | per route | | | keying strategy? |
| … | route handler | | | | | |
| last | `errorHandler` | `middleware/errorHandler.js` | all | | | |

Fill the rate-limit policy table from `rateLimiter.js`:

| Limiter | Window | Max | Keyed by | Store | Applied to route groups | Response on limit |
|---|---|---|---|---|---|---|
| `auth` | 1 min | 5 | | Redis | `/api/auth` | |
| `public` | 1 min | 120 | | Redis | areas, categories, products, prices | |
| `medium` | 1 min | 60 | | Redis | subscriptions, cart, tomorrow, orders, notifications, users, dues, livestreams | |
| *(others)* | | | | | | |

Record: behaviour when Redis is unavailable — fail open or fail closed?

## 5.4 Routing map

One row per mounted router.

| Mount path | Router file | Rate limiter | Auth required | Admin only | Cached | Endpoint count |
|---|---|---|---|---|---|---|
| `/api/health` | `app.js` | none | no | no | no | 1 |
| `/api/auth` | `auth.routes.js` | `auth` | | | | |
| `/api/areas` | | `public` | | | | |
| `/api/categories` | | `public` | | | | |
| `/api/products` | | `public` | | | | |
| `/api/prices` | | `public` | | | | |
| `/api/subscriptions` | | `medium` | | | | |
| `/api/cart` | | `medium` | | | | |
| `/api/tomorrow` | | `medium` | | | | |
| `/api/orders` | | `medium` | | | | |
| `/api/notifications` | | `medium` | | | | |
| `/api/users` | | `medium` | | | | |
| `/api/dues` | | `medium` | | | | |
| `/api/livestreams` | | `medium` | | | | |
| `/api/manifests` | | | | | | |
| `/api/reports` | | | | | | |
| `/api/admins` | | | | | | |
| `/api/settings` | | | | | | |
| `/api/inventory` | | | | | | |
| `/api/notes` | | | | | | |
| `/api/instant` | | | | | | |
| `/api/carousels` | | | | | | |
| `/api/onboarding` | | | | | | |
| `/api/debug` | `debug.routes.js` | | | | | |
| `/api/testing` | `testing.routes.js` | | | | | |

> **Item to resolve:** `debug` and `testing` modules are mounted. Record whether they are reachable in production, what they expose, and what guards them. Paste both route files in full.

**Paste:** the remainder of `app.js` beyond the excerpt (route mounts after `/api/livestreams`, 404 handler, error handler registration, and anything else).

## 5.5 Background workers

| Job | File | Schedule | Timezone | Runs on all replicas? | Locking | Duration | Last-run observability | Failure alerting |
|---|---|---|---|---|---|---|---|---|
| Nightly manifest | `jobs/nightlyManifest.js` | | | | | | | |
| Instant order expiry | `jobs/instantOrderExpiry.js` | | | | | | | |
| Livestream scheduler | `jobs/livestreamScheduler.js` | | | | | | | |

**Paste:** all three job files. Record how jobs are registered (in `server.js` or `app.js`) and whether they run in the same process as the HTTP server.

## 5.6 Request & response lifecycle

| Item | Content |
|---|---|
| Is there a request id? Where generated, propagated, logged? | |
| Response envelope shape | `utils/response.js` — paste |
| Error envelope shape | `middleware/errorHandler.js` — paste |
| Status codes used, and their meaning in this system | |
| Validation failure format | |
| Are Firestore errors ever leaked to the client? | |
| Is stack trace ever returned? Under which env flag? | |
| Response compression enabled? | grep for `compression` — appears absent from `package.json`; confirm |

## 5.7 Logging

| Item | Content |
|---|---|
| Logging library (or `console`) | |
| Log format (JSON / plain) | |
| Levels used | |
| What is logged per request | |
| PII in logs (phone numbers, addresses, tokens) — enumerate | |
| Log destination in production | |
| Retention | |
| `backend/logs/` — what writes there, is it used in prod, is it rotated | |
| `load-server.out.log` / `.err.log` at `backend/` root — what produced these | |

**Attach:** 500 consecutive lines of production log covering a peak minute.

---

# 6. API Inventory

Every endpoint gets a row in the summary table and, for P0 endpoints, a full detail block.

## 6.1 Summary table

Generate the endpoint list mechanically first — paste the output of a grep over `backend/src/modules/**/*.routes.js` for `router.(get|post|put|patch|delete)` — then complete the table. The count must match.

| # | Method | Path | Module | Auth | Role | Rate limiter | Cached (TTL) | Paginated | Called by (app screen / admin / cron) | p50 ms | p95 ms | p99 ms | Req bytes | Resp bytes | Firestore reads/call |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/health` | — | none | — | none | no | no | Railway healthcheck | | | | | | 0 |
| 2 | | | | | | | | | | | | | | | |

*(one row per endpoint — do not truncate)*

## 6.2 Detail block template — required for every P0 endpoint

### `<METHOD> <path>`

| Field | Content |
|---|---|
| Purpose | |
| Handler | `<file:line>` |
| Service function | `<file:line>` |
| Authentication | token type, verification path |
| Authorization | role check location |
| Middleware chain | exact ordered list |
| Validation rules | paste the `express-validator` chain |
| Request payload | full JSON example |
| Response payload | full JSON example, realistic size |
| Response size: typical / p95 / max | |
| Firestore operations | one row per read/write below |
| Redis operations | key pattern, TTL, hit rate |
| External calls | FCM / Storage / other |
| Idempotent? | |
| Transactional? | |
| Pagination | param names, page size, cursor type, is total count computed |
| Caching | cache key, TTL, invalidation trigger |
| Error cases | status → cause → client message |
| Timing | p50/p95/p99, measurement window, sample size |

**Firestore operations for this endpoint**

| # | Collection | Operation | Query shape | Composite index required | Docs read | Docs written | In a transaction | Bounded by |
|---|---|---|---|---|---|---|---|---|

**Mandatory P0 detail blocks:** auth verify/login, cart read, cart confirm, tomorrow, products list, subscriptions list, subscription create/modify, instant order create, orders list, dues, manifests generate, notifications list.

---

# 7. Data Layer (Firestore + Redis)

> This system uses **Cloud Firestore**, a schemaless document store. There is no schema to dump and no `EXPLAIN ANALYZE`. The equivalent artifacts are: the collection map, the index configuration, the query inventory, and per-query document-read counts. Substitute accordingly and do not leave these blank because a SQL-shaped tool does not exist.

## 7.1 Architecture

| Item | Content |
|---|---|
| Firestore mode (Native / Datastore) | |
| Region / multi-region | |
| Project id(s) per environment | |
| Are prod and staging separate projects or separate collection prefixes? | |
| Client library and version | `firebase-admin@<v>` |
| Does the mobile app ever access Firestore directly, or only via the API? | |

## 7.2 Collection inventory

One row per collection and subcollection.

| Collection path | Document ID scheme | Purpose | Written by | Read by | Doc count (today) | Avg doc size | Largest doc | Growth/day | Growth driver | TTL/archival |
|---|---|---|---|---|---|---|---|---|---|---|
| `users/{uid}` | | | | | | | | | | |
| `products/{id}` | | | | | | | | | | |
| `categories/{id}` | | | | | | | | | | |
| `areas/{id}` | | | | | | | | | | |
| `prices/{id}` | | | | | | | | | | |
| `subscriptions/{id}` | | | | | | | | | | |
| `orders/{id}` | | | | | | | | | | |
| `carts/{uid}` | | | | | | | | | | |
| `dues/{id}` | | | | | | | | | | |
| `manifests/{id}` | | | | | | | | | | |
| `notifications/{id}` | | | | | | | | | | |
| `livestreams/{id}` | | | | | | | | | | |
| `inventory/{id}` | | | | | | | | | | |
| `notes/{id}` | | | | | | | | | | |
| `carousels/{id}` | | | | | | | | | | |
| `settings/{id}` | | | | | | | | | | |
| `admins/{id}` | | | | | | | | | | |
| *(complete — derive by grepping `.collection(` across `backend/src/`)* | | | | | | | | | | |

**Paste:** output of `grep -rhoE "\.collection\('[^']+'\)" backend/src | sort | uniq -c | sort -rn` — this is the authoritative list and its usage frequency.

## 7.3 Document shapes

For each collection, paste one real (PII-redacted) document as JSON, plus a field table:

| Field | Type | Required | Indexed | Denormalized from | Nullable | Notes |
|---|---|---|---|---|---|---|

## 7.4 Relationships

| Parent | Child | Modelled as (subcollection / reference field / duplicated id) | Cardinality | Cascade behaviour on delete | Referential integrity enforced where |
|---|---|---|---|---|---|

**Diagram D4** is mandatory here.

## 7.5 Index configuration

| Item | Content |
|---|---|
| Is `firestore.indexes.json` in the repo? Path? | |
| If not, how are composite indexes managed — console-only? | |
| Field-level index exemptions | |

**Attach:** export of all composite indexes from the Firebase console (`gcloud firestore indexes composite list --format=json`), and all index exemptions. Paste verbatim.

| Collection | Fields | Order | Used by which query (§6) | Created when | Still used? |
|---|---|---|---|---|---|

## 7.6 Query inventory

The Firestore analogue of a slow-query log. One row per distinct query in the codebase.

| # | File:line | Collection | Filters | Order by | Limit | Docs read (typical) | Docs read (worst realistic) | Unbounded? | Index used | Called from endpoint/job | Frequency/day |
|---|---|---|---|---|---|---|---|---|---|---|---|

Flag every query with no `.limit()` — record it, do not fix it.

## 7.7 Reads/writes economics

| Metric | Value | Source |
|---|---|---|
| Document reads/day | | Firebase usage dashboard |
| Document writes/day | | |
| Document deletes/day | | |
| Peak reads/minute | | |
| Reads attributable to nightly manifest job | | |
| Reads attributable to top endpoint | | |
| Monthly Firestore cost | | billing console |
| Egress volume | | |

**Attach:** Firebase console usage screenshots for the last 30 days — reads, writes, deletes, storage, and the billing breakdown.

## 7.8 Transactions & consistency

| Location (file:line) | Type (`runTransaction` / `batch` / neither) | Documents touched | Contention risk | Retry behaviour | What breaks if it half-applies |
|---|---|---|---|---|---|

Identify every multi-document mutation that is **not** transactional and record it as an observation only.

## 7.9 Security rules

**Attach:** `firestore.rules` and `storage.rules` in full. If the app never touches Firestore directly, state the rules posture anyway (e.g. deny-all) and prove it with the rules file.

## 7.10 Redis

| Item | Content |
|---|---|
| Provider & plan | |
| Version | |
| Memory limit | |
| Eviction policy (`maxmemory-policy`) | |
| Persistence | |
| Connection: TLS? pooled? single client? | `config/redis.js` |
| Reconnect strategy | |
| Behaviour when Redis is down | |

**Key inventory**

| Key pattern | Written by | TTL | Value size | Purpose | Hit rate | Invalidation trigger |
|---|---|---|---|---|---|---|
| rate-limit keys | `rateLimiter.js` | | | | | |
| cache keys | `middleware/cache.js` | | | | | |

**Attach:** `redis-cli INFO all`, `INFO keyspace`, and `--bigkeys` output from production.

## 7.11 Migrations & data scripts

| Script | Path | Purpose | Idempotent | Last run (date, env) | Reversible | Run by whom |
|---|---|---|---|---|---|---|
| `rename_area_rajendranagar_to_bareilly.js` | `backend/migrations/` | | | | | |
| `reassign_users_satellite_to_bareilly.js` | `backend/migrations/` | | | | | |
| `seed.js` | `backend/seeds/` | | | | | |
| `fixDues.js` | `backend/` | | | | | |

Record: is there any migration *framework*, versioning, or applied-migrations ledger, or are these ad-hoc scripts? State it plainly.

## 7.12 Backup & recovery

| Item | Content |
|---|---|
| Firestore backup mechanism (scheduled exports? PITR?) | |
| Backup frequency | |
| Backup destination + retention | |
| Last restore drill (date, outcome) | |
| Measured RTO | |
| Measured RPO | |
| Redis backup (or: is Redis data disposable?) | |
| Firebase Storage backup | |

---

# 8. Infrastructure

## 8.1 Railway configuration

**Attach:** screenshots of the Railway service settings, variables (masked), metrics, and deploy history.

| Item | Content |
|---|---|
| Project / service names | |
| Region | |
| Replica count | |
| CPU limit | |
| Memory limit | |
| Plan | |
| Autoscaling configured? Trigger? | |
| Custom domain(s) | |
| Build method: Nixpacks or Dockerfile? | |
| `railway.json` / `railway.toml` present? | grep — record `NOT PRESENT` if absent |
| `Dockerfile` present? | record `NOT PRESENT` if absent |
| `.nixpacks` config / `nixpacks.toml` | |
| Detected Node version and how it is pinned (`engines` field? `.nvmrc`?) | |
| Start command | |
| Health check path & timeout | |
| Restart policy | |

## 8.2 Build & deploy

| Item | Content |
|---|---|
| Trigger (push to `master`? manual?) | |
| Build duration (last 10 deploys) | |
| Image/slug size | |
| Deploy strategy (rolling / recreate) | |
| Zero-downtime? Evidence? | |
| Rollback procedure and last time it was used | |
| Who can deploy | |
| Is `node_modules` committed or built? | |

**Attach:** full build log and full deploy log from the most recent production deploy.

## 8.3 Startup & lifecycle measurements

| Measurement | Value | Method |
|---|---|---|
| Container cold start → process up | | deploy log timestamps |
| Process up → first successful `/api/health` | | |
| Cold start p95 over last 20 deploys | | |
| Requests failed during a deploy | | |
| Restart count last 30 days | | Railway metrics |
| Restart causes (OOM / crash / deploy / platform) | | |
| Does the app sleep on idle? | | |
| Graceful shutdown implemented? (`SIGTERM` handler in `server.js`) | | paste code or `NOT PRESENT` |
| In-flight requests on shutdown | | |
| Cron jobs interrupted by restart | | |

## 8.4 Resource utilization

Record over a full 7-day window covering at least one peak.

| Metric | p50 | p95 | max | When max occurred |
|---|---|---|---|---|
| CPU % | | | | |
| Memory MB | | | | |
| Network egress | | | | |
| Requests/min | | | | |
| Error rate | | | | |

**Attach:** Railway metrics screenshots, 7-day and 30-day views.

## 8.5 Networking

| Item | Content |
|---|---|
| CDN in front of API? | |
| TLS termination point | |
| TLS version + cipher | `openssl s_client -connect <host>:443` — paste |
| Certificate issuer & expiry | |
| HTTP/2 or HTTP/1.1 | |
| Egress path to Firestore (region-to-region latency) | |
| Static asset hosting (admin panel, website) | |

## 8.6 Client distribution

| Item | Content |
|---|---|
| Android min SDK / target SDK | `mobile_app/android/app/build.gradle.kts` — paste |
| iOS deployment target | |
| Current released version | `pubspec.yaml` → `1.0.13+23` — confirm against store |
| Release channel (internal / staged rollout %) | |
| Version adoption distribution | Play Console screenshot |
| Forced-update mechanism | `services/update_service.dart` |
| APK/AAB size (per ABI) | `flutter build appbundle --analyze-size` — attach JSON |
| ProGuard/R8 enabled | |

---

# 9. External Dependencies

## 9.1 Dependency register

| # | Service | Used by | Purpose | SDK + version | Init location | Init blocking? | Timeout | Retries | Fallback if down | User-visible impact if down | Quota/limits | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Firebase Auth (phone) | app | | | | | | | | | SMS quota | |
| 2 | Firebase App Check | app | | | | | | | | | | |
| 3 | Firestore | backend | | | | | | | | | | |
| 4 | Firebase Storage | backend + app | | `utils/storage.js` | | | | | | | |
| 5 | FCM | both | | `fcm_service.dart`, `modules/notifications` | | | | | | | |
| 6 | Redis | backend | | `config/redis.js` | | | | | | | |
| 7 | YouTube (`youtube_player_flutter`) | app | livestream | | | | | | | | |
| 8 | Google Fonts | app | | | | | | | runtime fetch or bundled? | | |
| 9 | Play In-App Update | app | | | | | | | | | |
| 10 | `url_launcher` targets (payment? support? maps?) | app | enumerate every URL launched | | | | | | | | |
| 11 | Payments provider | | **State explicitly whether one exists.** If payments are cash-on-delivery only, write that. | | | | | | | | |
| 12 | SMS provider other than Firebase | | | | | | | | | | |
| 13 | Email provider | | | | | | | | | | |
| 14 | Analytics | | | | | | | | | | |
| 15 | Crash reporting | | | | | | | | | | |
| 16 | Maps / geocoding (location feature) | | see `LOCATION_FEATURE_README.md` | | | | | | | | |

For rows 11–16, `NOT PRESENT` is an acceptable and important answer.

## 9.2 Per-dependency detail

For each service in the register, document:

| Field | Content |
|---|---|
| Initialization code | `<paste>` |
| Called synchronously on a user-facing path? Which paths | |
| Measured p50/p95 latency of its calls | |
| Configured timeout vs. observed worst case | |
| Retry policy and whether retries are idempotent-safe | |
| Circuit breaker | |
| Error handling — swallowed, logged, or surfaced | |
| Credential storage and rotation procedure | |
| SLA / status page URL | |
| Last incident affecting this system | |

## 9.3 Firebase project configuration

**Attach:** `mobile_app/firebase.json`, `mobile_app/lib/firebase_options.dart` (redacted), Android `google-services.json` and iOS `GoogleService-Info.plist` presence confirmation (do not paste key material).

| Item | Content |
|---|---|
| Firebase project ids per environment | |
| App Check provider (Play Integrity / DeviceCheck / debug) | |
| App Check enforcement: monitoring or enforced, per API | |
| Phone auth quota and current usage | |
| Test phone numbers configured | |
| Authorized domains | |

---

# 10. Production Readiness

## 10.1 Observability matrix

| Capability | Tool | Covers backend | Covers mobile | Retention | Who watches it | Evidence to attach |
|---|---|---|---|---|---|---|
| Structured logging | | | | | | log sample |
| Metrics | | | | | | dashboard screenshot |
| Distributed tracing | | | | | | trace screenshot |
| Crash reporting | | | | | | crash-free rate |
| Performance monitoring (RUM) | | | | | | screenshot |
| Uptime monitoring | | | | | | 90-day uptime |
| Alerting | | | | | | alert rule list |
| On-call rotation | | | | | | |

For any row that is `NOT PRESENT`, record how the corresponding failure is currently detected instead (e.g. "user reports via support").

## 10.2 Alerting inventory

| Alert | Condition | Threshold | Channel | Who responds | Times fired last 90d | False-positive rate |
|---|---|---|---|---|---|---|

## 10.3 Security

| Item | Content |
|---|---|
| Auth model: Firebase ID token, custom JWT, or both — and where each is used | |
| JWT: algorithm, secret source, lifetime, refresh, revocation | |
| Admin authentication (`modules/admins`) — separate from user auth? | |
| Role/permission model and where enforced | |
| Secrets: where stored, who can read, rotation cadence, last rotation | |
| `backend/service-account-key.json` — git-tracked status (see §1.8) | |
| Input validation coverage — which endpoints have `express-validator` chains and which do not | |
| File upload handling (`multer`): size limits, MIME allowlist, storage path, filename sanitization | `utils/uploadDebug.js`, `utils/storage.js` |
| CORS allowlist contents in production | |
| `helmet` configuration and any disabled headers | |
| Rate limiting coverage — which routes have none | |
| PII inventory: what personal data is stored, where, encrypted at rest? | |
| Dependency vulnerabilities | `npm audit --json` — attach; `flutter pub outdated` — attach |
| Last security review / pentest | |

## 10.4 CI/CD

| Item | Content |
|---|---|
| CI provider | grep for `.github/workflows/` — record `NOT PRESENT` if absent |
| Steps run on PR | |
| Steps run on merge | |
| Branch protection on `master` | |
| Mobile build pipeline | |
| Signing key management | |
| Is anything deployed manually from a laptop? | |

## 10.5 Testing

| Item | Content |
|---|---|
| Backend test files | `backend/tests/` — list |
| Backend coverage % | `npx jest --coverage` — attach summary |
| Which modules have zero tests | |
| Mobile test files | `mobile_app/test/` — list |
| Mobile coverage % | `flutter test --coverage` — attach `lcov.info` summary |
| Integration/E2E tests | |
| Load test ever run? Tooling? Results? | |
| Manual QA checklist | |
| `modules/testing` — is this a test-support endpoint set? | |

## 10.6 Configuration & feature flags

| Item | Content |
|---|---|
| Runtime config source (`modules/settings`) — what is configurable without a deploy | |
| Feature flag mechanism | |
| Flags currently defined, their values, and their owners | |
| Client-side config caching and staleness | |
| Kill switch for any feature? | |

| Flag / setting | Location | Type | Prod value | Consumed by | Owner |
|---|---|---|---|---|---|

## 10.7 Operational runbooks

Confirm existence (path) or `NOT PRESENT` for each:

| Runbook | Path |
|---|---|
| API is down | |
| Firestore quota exceeded | |
| Redis down | |
| Nightly manifest failed | |
| Bad deploy → rollback | |
| Data corruption → restore | |
| FCM delivery failure | |
| Certificate expiry | |

---

# 11. Performance Evidence

**Ground rules.** Every artifact records: build mode (must be profile or release — debug measurements are rejected), device or container spec, network condition, timestamp, and sample size. Single-sample measurements are rejected; report min/p50/p95/max across ≥5 runs.

## 11.1 Artifact register

| # | Artifact | Capture method | Environment | Attach as | Collected |
|---|---|---|---|---|---|
| P1 | Flutter DevTools Timeline — cold start | `flutter run --profile --trace-startup` | all 3 device tiers | `.json` + screenshot | ☐ |
| P2 | Flutter DevTools Timeline — J2 cart confirm | DevTools Performance, record across the flow | mid-tier | `.json` + screenshot | ☐ |
| P3 | Flutter DevTools Timeline — Products scroll | record 10s of scroll | mid-tier | `.json` | ☐ |
| P4 | Memory profile — 30 min session | DevTools Memory + 2 heap snapshots | mid-tier | `.json` ×2 | ☐ |
| P5 | Memory profile — navigation loop ×20 | | mid-tier | screenshot | ☐ |
| P6 | CPU profile — startup | DevTools CPU Profiler | low-tier | `.json` | ☐ |
| P7 | CPU profile — scroll | | low-tier | `.json` | ☐ |
| P8 | Widget rebuild counts per P0 screen | Inspector → track rebuilds | mid-tier | screenshots | ☐ |
| P9 | Raster/UI thread stats per P0 screen | DevTools Performance overlay | low + mid | screenshots | ☐ |
| P10 | Frame stats: total, janky, worst frame | `flutter run --profile` frame summary | all tiers | table below | ☐ |
| P11 | Network waterfall per P0 screen | Charles / DevTools Network | mid-tier, 4G | screenshots + HAR | ☐ |
| P12 | Railway CPU/memory/network, 7d and 30d | dashboard | prod | screenshots | ☐ |
| P13 | Firestore usage: reads/writes/storage, 30d | Firebase console | prod | screenshots | ☐ |
| P14 | Redis `INFO` + `--bigkeys` | `redis-cli` | prod | text | ☐ |
| P15 | Per-endpoint timing (p50/p95/p99) | server timing logs, 7d | prod | §6.1 table | ☐ |
| P16 | Unbounded/expensive query list | §7.6 | prod | table | ☐ |
| P17 | Server logs, peak hour | Railway logs | prod | 500 lines | ☐ |
| P18 | Server logs, error-only, 7d | | prod | full | ☐ |
| P19 | Container cold start ×20 | deploy logs | prod | table below | ☐ |
| P20 | App cold start ×5 per tier | `--trace-startup` | all tiers | table below | ☐ |
| P21 | App warm start ×5 per tier | | all tiers | table below | ☐ |
| P22 | Time-to-interactive per P0 screen | screen recording, frame count | mid-tier | table below | ☐ |
| P23 | APK/AAB size analysis | `flutter build appbundle --analyze-size` | release | `.json` | ☐ |
| P24 | Crash-free session rate, 30d | crash tool | prod | screenshot | ☐ |
| P25 | Peak-hour load profile: RPM by endpoint | server logs | prod | table | ☐ |

## 11.2 Startup measurements

| Tier | Run | Cold TTFF (ms) | Cold TTI (ms) | Warm TTI (ms) | First request at (ms) | Home rendered at (ms) |
|---|---|---|---|---|---|---|
| Low | 1–5 | | | | | |
| Mid | 1–5 | | | | | |
| High | 1–5 | | | | | |

## 11.3 Frame rendering

| Screen | Tier | Total frames | Frames > 16ms | Frames > 32ms | Worst UI frame | Worst raster frame | Jank % |
|---|---|---|---|---|---|---|---|
| Home | | | | | | | |
| Products (scroll) | | | | | | | |
| Cart | | | | | | | |
| Subscription calendar | | | | | | | |
| Instant | | | | | | | |
| Reports (charts) | | | | | | | |

## 11.4 Screen time-to-interactive

| Screen | Tier | Network | Nav → first paint | Nav → data rendered | Requests fired | Bytes down |
|---|---|---|---|---|---|---|

## 11.5 Backend timing

| Endpoint | Samples | p50 | p95 | p99 | max | Firestore time share | Redis time share | Handler time share |
|---|---|---|---|---|---|---|---|---|

## 11.6 Cold start (server)

| Deploy | Timestamp | Build (s) | Container start → listen (s) | Listen → healthy (s) | Failed requests during cutover |
|---|---|---|---|---|---|

## 11.7 Load profile

| Hour (local) | Requests/min | Active users | Top endpoint | CPU % | Memory MB | Error rate |
|---|---|---|---|---|---|---|

---

# 12. Engineering Findings

> **This section is intentionally empty.** No analysis is performed during collection. These tables are populated only after §1–§11 are complete and signed off. Adding a row before collection is complete invalidates the review.

## 12.1 Findings

| ID | Finding | Evidence (§ ref + artifact) | Severity | Subsystem | Root Cause | Recommended Fix | Estimated Impact | Effort | Risk of Fix | Owner | Implementation Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | |
| | | | | | | | | | | | |
| | | | | | | | | | | | |
| | | | | | | | | | | | |
| | | | | | | | | | | | |
| | | | | | | | | | | | |
| | | | | | | | | | | | |
| | | | | | | | | | | | |
| | | | | | | | | | | | |
| | | | | | | | | | | | |

## 12.2 Open questions raised during collection

| ID | Question | Raised in § | Asked of | Answer | Resolved |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

## 12.3 Documentation gaps discovered

| ID | Gap | Section | Impact on review | Closed |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

## 12.4 Risk register

| ID | Risk | Subsystem | Likelihood | Impact | Detection today | Mitigation | Owner |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |

---

## Appendix A — Command reference

Run each and paste the verbatim output into the section named.

| # | Command | Run from | Paste into |
|---|---|---|---|
| A1 | `git rev-parse HEAD && git log -1 --stat` | repo root | header |
| A2 | `git log --all --oneline -- backend/service-account-key.json` | repo root | §1.8 |
| A3 | `git check-ignore -v backend/service-account-key.json` | repo root | §1.8 |
| A4 | depth-3 tree excluding build dirs | repo root | §1.4 |
| A5 | `grep -rhoE "\.collection\('[^']+'\)" backend/src \| sort \| uniq -c \| sort -rn` | repo root | §7.2 |
| A6 | `grep -rnE "router\.(get\|post\|put\|patch\|delete)" backend/src/modules` | repo root | §6.1 |
| A7 | `grep -rn "\.limit(" backend/src` | repo root | §7.6 |
| A8 | `npm audit --json` | `backend/` | §10.3 |
| A9 | `npm ls --depth=0` | `backend/` | §1.3 |
| A10 | `node -v && npm -v` | prod container | §1.3 |
| A11 | `flutter --version && dart --version` | `mobile_app/` | §1.3 |
| A12 | `flutter pub deps --style=compact` | `mobile_app/` | §1.3 |
| A13 | `flutter pub outdated` | `mobile_app/` | §10.3 |
| A14 | `flutter analyze` | `mobile_app/` | §10.5 |
| A15 | `flutter build appbundle --analyze-size` | `mobile_app/` | §8.6 |
| A16 | `flutter test --coverage` | `mobile_app/` | §10.5 |
| A17 | `npx jest --coverage` | `backend/` | §10.5 |
| A18 | `gcloud firestore indexes composite list --format=json` | any | §7.5 |
| A19 | `redis-cli INFO all` / `INFO keyspace` / `--bigkeys` | prod | §7.10 |
| A20 | `curl -w "@curl-format.txt" -o /dev/null -s <prod>/api/health` ×20 | laptop | §4.2 |
| A21 | `openssl s_client -connect <host>:443 </dev/null` | laptop | §8.5 |
| A22 | `railway logs --json` (peak hour) | laptop | §11 |

## Appendix B — Screenshot register

| # | Screenshot | Source | Section |
|---|---|---|---|
| S1 | Railway service overview | Railway | §8.1 |
| S2 | Railway variables (masked) | Railway | §1.8 |
| S3 | Railway metrics 7d / 30d | Railway | §8.4 |
| S4 | Railway deploy history | Railway | §8.2 |
| S5 | Firebase usage — Firestore 30d | Firebase console | §7.7 |
| S6 | Firebase billing breakdown | Firebase console | §7.7 |
| S7 | Firebase Auth usage + SMS quota | Firebase console | §9.3 |
| S8 | App Check enforcement status | Firebase console | §9.3 |
| S9 | Firebase Storage usage | Firebase console | §9.1 |
| S10 | FCM delivery stats | Firebase console | §2.7 |
| S11 | Play Console: version adoption | Play Console | §8.6 |
| S12 | Play Console: ANR & crash rate | Play Console | §10.1 |
| S13 | Play Console: app size & vitals | Play Console | §8.6 |
| S14–S19 | DevTools: timeline, memory, CPU, rebuilds, raster, network | DevTools | §11 |
| S20+ | Per-screen UI states (default/loading/error/empty/offline) for every P0 screen | device | §2 |

## Appendix C — Sign-off

| Section | Collected by | Date | Reviewed by | Date | Complete |
|---|---|---|---|---|---|
| 1 System Overview | | | | | ☐ |
| 2 Execution Flows | | | | | ☐ |
| 3 Flutter Architecture | | | | | ☐ |
| 4 Network Layer | | | | | ☐ |
| 5 Backend Architecture | | | | | ☐ |
| 6 API Inventory | | | | | ☐ |
| 7 Data Layer | | | | | ☐ |
| 8 Infrastructure | | | | | ☐ |
| 9 External Dependencies | | | | | ☐ |
| 10 Production Readiness | | | | | ☐ |
| 11 Performance Evidence | | | | | ☐ |

**The architecture review may not begin until every row above is checked.**
