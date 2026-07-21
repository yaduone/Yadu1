# Instant Delivery Feature

A second, on-demand purchasing mode alongside the existing **Scheduled** (next-day cart) model.
Users open an **Instant** tab on Home, browse a Blinkit/Zepto-style storefront, build a
**separate persistent cart**, pick an optional delivery charge, and **confirm an order now**.
When an admin marks an instant order **delivered**, its value (items + delivery charge) is added
to the user's existing **due** balance — identical to scheduled orders.

While Instant mode is active the app chrome turns **light purple**, and instant deliveries are
shown in **purple** on the global delivery calendar.

---

## Data model (Firestore)

| Collection / field | Purpose |
| --- | --- |
| `products.availability` | `'scheduled' \| 'instant' \| 'both'`. Missing/legacy ⇒ treated as `scheduled`. New products default to `both` in the admin form. |
| `instant_carts` (doc id = userId) | One persistent cart per user: `items[]`, `delivery_charge`, `items_total`, `total_amount`. Stays saved (visible to admin) even after checkout. |
| `instant_orders` (auto id) | Snapshot on confirm: `items[]`, `items_total`, `delivery_charge`, `total_amount`, `status` (`pending \| delivered \| cancelled`), `date` (today), `order_type: 'instant'`. Multiple per day allowed. |

Billing/notifications reuse `dueService.incrementDueInTransaction` and
`notificationService.sendDeliveryNotification` / `sendOrderCancelledNotification`.

---

## Backend API (`/api/instant`, auth = user unless noted)

| Method & path | Description |
| --- | --- |
| `GET  /cart` | Current instant cart |
| `POST /cart/add-item` | `{product_id, quantity}` — validates product is active & instant-available |
| `PUT  /cart/update-item` | `{product_id, quantity}` (0 removes) |
| `DELETE /cart/remove-item/:productId` | Remove a line |
| `PUT  /cart/delivery-charge` | `{delivery_charge}` ∈ `[0,10,20,30,40,50]` |
| `DELETE /cart` | Empty the cart |
| `POST /cart/confirm` | Snapshot → create `instant_orders`, empty cart |
| `GET  /orders` | User's instant order history |
| `GET  /orders/admin/list?date&status` | **admin** — area orders, enriched with user info |
| `GET  /carts/admin/list` | **admin** — live saved instant carts |
| `PUT  /orders/admin/:id/status` | **admin** — `delivered` (bills due) / `cancelled` |

Catalog is reused: `GET /api/products?availability=instant` returns instant-available products.
`GET /api/reports/user/calendar?month=YYYY-MM` now also returns an `instant` map
(`date → { count, total_amount, delivered, pending, not_delivered, orders[] }`).

---

## Admin panel

- **Products** page: per-product **Availability** select (Scheduled / Instant / Both) + badge.
- **Instant** page (`/instant-orders`, ⚡ nav item):
  - **Orders** tab — date/status filters, charge breakdown, single + bulk **Mark Delivered**.
  - **Active Carts** tab — read-only view of saved instant carts.

---

## Mobile app

- **Home**: a `Scheduled | Instant` segmented toggle (`ScheduleInstantToggle`). Switching to
  Instant flips `InstantModeProvider` (purple chrome) and swaps the Home body for `InstantStoreScreen`.
- **`InstantStoreScreen`**: carousel, category chips, 2-column product grid with `ADD` → `+/-`
  steppers, a top **⚡ cart pill**, and a floating **View Cart** bar.
- **`InstantCartScreen`**: line items with steppers, **delivery-charge chips** (Free/₹10…₹50),
  a **charges breakdown** (items / delivery / to-pay), and **Confirm Order**.
- **`InstantProvider`** mirrors `CartProvider` (server-backed cart, each mutation returns the fresh cart).
- Bottom nav accent turns purple in instant mode; the global calendar shows a purple ⚡ marker on
  days with instant orders and lists them in the day-detail sheet.

Key files: `lib/theme/instant_theme.dart`, `lib/providers/instant_provider.dart`,
`lib/providers/instant_mode_provider.dart`, `lib/screens/instant/`.

---

## Verify

- **Backend**: `cd backend && npx jest` (incl. `tests/instant-order-billing.test.js`).
- **Mobile**: `cd mobile_app && flutter analyze lib`.
- **End-to-end**: admin sets a product to Instant/Both → app Instant tab → add items → set
  delivery charge → Confirm → admin **Instant → Mark Delivered** → user's due increases and the
  day shows purple on the calendar.
