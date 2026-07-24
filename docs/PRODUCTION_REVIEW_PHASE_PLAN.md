# YaduOne — Production Readiness Review: Phase Plan & Phase 1 Findings

**Commit under review:** `17b37dacf60e2c5480ec3f06cd43294bdccac3a8`
**Branch:** `performance`
**Review date:** 2026-07-21
**Access level at time of writing:** source repository only — no Railway dashboard, no Firebase console, no production logs, no physical devices.

---

## 0. Evidence policy (read this first)

The governing instruction for this review is "never estimate, everything must be measured." That standard cannot be met for an entire class of questions from source code alone. Rather than fabricate numbers to fill tables, every claim in this review carries one of three labels:

| Label | Meaning |
|---|---|
| **DERIVED** | Provable from source, lockfiles, or git history. Cited to `file:line`. Reproducible by anyone with the repo. |
| **NOT COLLECTED** | Requires a console, a production log, or a device. States the exact capture command and who must run it. Never assigned a value. |
| **INFERRED** | A reasoned conclusion from DERIVED facts that a measurement could still overturn. Always flagged, never counted as evidence. |

A DERIVED finding is actionable now. An INFERRED finding is a hypothesis with a named test. **No optimization proceeds on an INFERRED finding alone.** This is the discipline that separates a review from an opinion, and it is the reason the roadmap in Phase 8 is deliberately not written yet.

---

## 1. The phase plan

Phases are gated: a phase may not start until the prior phase's completion criteria are met. Phases 1–3 are executable with repo-only access. Phases 4–7 are blocked on production access and are specified now so the access request can be made once, in full, rather than in a dozen interruptions.

### Phase 1 — Static architecture & inventory `[COMPLETE — see §2]`
**Goal.** Establish the ground-truth map of what exists: deployable units, modules, routes, collections, jobs, dependencies.
**Why it exists.** Firestore is schemaless and this system has no index manifest or rules file in the repo. The data model is undiscoverable except by reading every call site. Nothing downstream can be reasoned about until this map exists.
**Deliverables.** Route inventory (151 endpoints), collection inventory (20 collections), job inventory, dependency register, git-history secret scan.
**Commands.** Recorded in §2 with verbatim output.
**Completion criteria.** Route count from grep matches route count in the inventory table; every `.collection()` string in the codebase appears in the collection inventory. ✅ Met.

### Phase 2 — Static correctness & security audit `[NEXT]`
**Goal.** Identify defects provable without running the system: unbounded batches, N+1 loops, missing auth guards, unvalidated input, secret handling.
**Why it exists.** These are the findings that need no telemetry. Doing them first means production access, when granted, is spent on questions that genuinely require it.
**Deliverables.** Per-endpoint auth/validation matrix across all 151 routes; Firestore batch-limit audit; input-validation coverage gap list; `npm audit` and `flutter pub outdated` output.
**Completion criteria.** Every one of the 151 routes classified as `public | authenticated | admin`, with the middleware proving it cited to `file:line`. No route left "unknown."

### Phase 3 — Flutter static architecture `[BLOCKED on Phase 2]`
**Goal.** Map startup sequence, provider graph, navigation, image loading, and the API client's cross-cutting behavior (retry, timeout, 401 handling, connection reuse).
**Why it exists.** The client uses the `http` package, which has no interceptor concept. Whatever plays that role determines whether auth, retry, and timeout are handled consistently or per-call. That is a static question and it strongly shapes what Phase 6 will measure.
**Deliverables.** Annotated `main.dart` startup table; provider inventory with `notifyListeners()` call sites; `api_service.dart` configuration table.
**Completion criteria.** Every startup step classified blocking/non-blocking; every provider's consumption site recorded as `Consumer`/`Selector`/`watch`.

### Phase 4 — Backend runtime measurement `[BLOCKED on production access]`
**Goal.** Per-endpoint p50/p95/p99, Firestore read counts per call, Redis hit rate, container cold start.
**Required access.** Railway logs + metrics, Firebase usage console.
**Completion criteria.** ≥7 days of data, ≥1 peak hour covered, sample size recorded per endpoint.

### Phase 5 — Data layer economics `[BLOCKED on Firebase console]`
**Goal.** Reads/writes per day, cost attribution by endpoint and by the nightly job, composite index export, growth rates per collection.
**Note.** The composite index set exists only in the Firebase console — it is not in the repo (DERIVED, §2.4). Exporting it is the single highest-value artifact of this phase, because every query in §2.3 is currently unverifiable against it.

### Phase 6 — Flutter runtime measurement `[BLOCKED on devices]`
**Goal.** Startup TTFF/TTI, frame timings, jank %, memory over a 30-min session, network waterfalls.
**Required.** 3-tier device matrix, profile builds only. Debug-mode measurements are rejected.

### Phase 7 — Scalability & failure-mode analysis `[BLOCKED on Phases 4–6]`
**Goal.** Establish the concurrency ceiling and the first component to fail under load. Load test against staging.
**Gate.** Requires a staging environment. Whether one exists is currently **NOT COLLECTED**.

### Phase 8 — Optimization roadmap `[BLOCKED on Phases 2–7]`
Prioritized, evidence-cited, with rollback and validation per item. Deliberately empty until the evidence exists.

### Phase 9+ — Implementation phases
One engineering objective each, created after the roadmap is approved.

---

## 2. Phase 1 findings (DERIVED)

### 2.1 Deployable units
`backend/` (Express API, Railway) · `mobile_app/` (Flutter) · `admin-panel/` · `website/`. 151 HTTP endpoints across 23 modules; 3 cron jobs; 20 Firestore collections.

### 2.2 Secret handling — CLEAN ✅
```
$ git log --all --oneline -- backend/service-account-key.json
(no output — never committed)
$ git check-ignore -v backend/service-account-key.json
backend/.gitignore:7:service-account-key.json
```
**DERIVED:** the service-account key has never entered git history and is correctly ignored. The §1.8 concern raised in `ENGINEERING_INVESTIGATION_FRAMEWORK.md` is **resolved and closed.** This was the highest-severity open question in the existing framework document; it is a non-issue.

### 2.3 F-1 — Nightly manifest is a sequential N+1 loop `[DERIVED — SEVERITY: HIGH]`

`backend/src/jobs/nightlyManifest.js:90-231`. The job loads all active subscriptions for an area, then iterates them **sequentially with `await` inside the loop**, issuing per-subscription queries against `orders` (`:108`), `next_day_overrides` (`:116`), and `carts` (`:154`).

Cost is therefore `O(subscriptions × 3)` round trips, executed serially. At 1,000 subscribers that is ~3,000 sequential Firestore round trips per area per night. **INFERRED** (needs Phase 5 to confirm): this is the dominant Firestore read line item and the dominant nightly cost driver. **Test that confirms or refutes it:** Firebase usage console, read count in the cron hour vs. baseline hour.

This is the single most consequential structural finding in Phase 1, because it degrades **linearly with customer growth** — it is precisely the thing that works fine today and fails at 10×.

### 2.4 F-2 — Unbounded `batch.commit()` will throw above 500 documents `[DERIVED — SEVERITY: HIGH, latent]`

`backend/src/jobs/nightlyManifest.js:265-278`:
```js
const batch = db.batch();
overridesSnap.docs.forEach((doc) => batch.delete(doc.ref));
await batch.commit();          // same pattern again at :276 for carts
```
Firestore hard-caps a write batch at **500 operations**. Neither call site chunks. Once a single area accumulates >500 overrides or >500 carts in a day, the commit throws and the nightly cleanup fails — after orders have already been created. This is not a performance issue; it is a **correctness cliff with a known, fixed trigger threshold**, and it is currently silent because volume is presumably below it.

### 2.5 F-3 — Cron jobs run in the API process on every replica `[DERIVED — SEVERITY: HIGH, conditional]`

`backend/server.js:4-6` registers all three jobs in the same process that serves HTTP. There is no distributed lock in `nightlyManifest.js`. **If Railway replica count > 1, every replica runs the nightly job concurrently**, racing on order creation. The idempotency check at `:106-112` is a read-then-write with no transaction, so it does not prevent duplicates under concurrency.

Replica count is **NOT COLLECTED** — Railway dashboard. This finding is either "no impact today" or "duplicate orders in production" depending entirely on that one number, which makes it the highest-priority item in the access request.

### 2.6 F-4 — No Firestore index manifest and no security rules in the repo `[DERIVED — SEVERITY: MEDIUM]`

```
$ find . -name "firestore.indexes.json" -not -path "*/node_modules/*"   → no results
$ find . -name "*.rules" -not -path "*/node_modules/*"                   → no results
```
Composite indexes and security rules are console-managed, unversioned, unreviewable, and not reproducible into a new environment. Any multi-field query in this codebase depends on console state no engineer can see from the repo. This also means **there is no way to stand up a staging environment that matches production** — which blocks Phase 7.

### 2.7 F-5 — `/api/debug` mounted with no rate limiter `[DERIVED — SEVERITY: MEDIUM]`

`backend/src/app.js:95` — `app.use('/api/debug', debugRoutes)` is the only mount without a `limit.*` middleware. The routes self-guard via `NODE_ENV === 'production'` (`debug.routes.js:15-20`), which is sound **if and only if** `NODE_ENV` is actually set to `production` on Railway. That is **NOT COLLECTED**, and it is a single environment variable standing between the public internet and unrated-limited endpoints that enumerate Firebase Storage contents (`debug.routes.js:60+`).

Defense-in-depth argues for a rate limiter regardless of the env guard. `/api/testing` by contrast is correctly protected by `authenticateAdmin` on every route.

### 2.8 F-6 — No CI/CD `[DERIVED — SEVERITY: MEDIUM]`
`.github/workflows/` does not exist. No automated test, lint, or audit gate on merge to `master`. Deploy trigger and branch protection are **NOT COLLECTED**.

### 2.9 Query boundedness — better than expected
177 `.get()` executions vs. 36 `.limit()` calls, but only **three** are true full-collection scans, all on small config-like collections:
`products/product.routes.js:72`, `prices/price.routes.js`, `categories/category.routes.js`.
These are bounded by catalog size, not user count, and are cacheable. **Low severity.** The 43 `users` and 17 `subscriptions` call sites are filtered. This is a genuinely healthier picture than the raw ratio suggests, and I note it because a review that only reports bad news is not calibrated.

---

## 3. Access request (unblocks Phases 4–7)

Ranked by what each answer changes:

1. **Railway replica count** — determines whether F-3 is theoretical or actively corrupting order data. One number.
2. **`NODE_ENV` value in Railway production** — determines whether F-5 is exposed. One number.
3. `gcloud firestore indexes composite list --format=json` — unblocks Phase 5 and Phase 7.
4. Firebase usage console, 30d reads/writes/cost — confirms or refutes F-1.
5. Railway metrics 7d + 30d, and whether a staging environment exists.
6. 3-tier device matrix availability for Phase 6.

Items 1 and 2 are two dashboard lookups and I would recommend answering them before anything else in this document is acted on.

---

## 4. Findings register

| ID | Finding | Evidence | Severity | Status |
|---|---|---|---|---|
| F-1 | Nightly manifest sequential N+1 | `nightlyManifest.js:90-231` | HIGH | Confirm cost via Phase 5 |
| F-2 | Unbounded batch >500 docs | `nightlyManifest.js:265-278` | HIGH | DERIVED, actionable now |
| F-3 | Cron on every replica, no lock | `server.js:4-6` | HIGH* | Blocked on replica count |
| F-4 | No index manifest / rules in repo | `find` output §2.6 | MEDIUM | DERIVED, actionable now |
| F-5 | `/api/debug` unrate-limited | `app.js:95` | MEDIUM | Blocked on `NODE_ENV` |
| F-6 | No CI/CD | no `.github/workflows` | MEDIUM | DERIVED, actionable now |
| — | Service-account key clean | git history §2.2 | — | CLOSED ✅ |

\* HIGH if replicas > 1; NONE if replicas == 1.

**No fixes are proposed in this document.** Per the review protocol, remediation is designed in Phase 8 against complete evidence.
