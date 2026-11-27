# Instant Delivery Feature

A second, on-demand purchasing mode alongside the existing **Scheduled** (next-day cart) model.
Users add products to it from the single **Products** page (each product has a Scheduled and an
Instant button), building a **separate persistent cart**, pick an optional delivery charge, and **confirm an order now**.
When an admin marks an instant order **delivered**, its value (items + delivery charge) is added
to the user's existing **due** balance — identical to scheduled orders.

Instant controls, the instant cart and order screens use **light purple**, and instant deliveries are
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

- **Home** has no Scheduled/Instant toggle any more. A **Products** card sits directly under the
  subscription card, showing whether scheduled and instant delivery are each taking orders.
- **`ProductsScreen`** (`lib/screens/products/`) is the single catalogue: every admin-defined product
  (`GET /api/products`) with two add controls — **Scheduled** (next delivery's pending cart, confirmed
  from the Cart tab) and **Instant** (`InstantProvider` cart). Each control becomes a −/+ stepper once
  added, and goes grey with a reason when the product's admin `availability` excludes that mode
  ("Scheduled only" / "Instant only") or the mode isn't taking orders (instant window closed/paused,
  next delivery not loaded or locked). Status chips at the top and the buttons both read
  `DeliveryModeStatus` (`lib/utils/delivery_mode_status.dart`), so they never disagree.
  Header: search, instant order history, scheduled cart, instant cart. A floating bar links to each cart
  with items; the "Your Orders" badge tracks active instant orders.
- **Product sheet**: admin photos, unit, category, description, and a "Delivery options" card with each
  mode's price (`instant_price` when set) and live status, plus the same two add controls.
- **`InstantCartScreen`**: line items with steppers, **delivery-charge chips** (Free/₹10…₹50),
  a **charges breakdown** (items / delivery / to-pay), and **Confirm Order**. Opened once per launch
  over the products page.
- The global calendar still shows a purple ⚡ marker on days with instant orders.

Key files: `lib/screens/products/`, `lib/utils/delivery_mode_status.dart`,
`lib/providers/instant_provider.dart`, `lib/screens/instant/` (cart, order status, history, active orders).

## Verify

- **Backend**: `cd backend && npx jest` (incl. `tests/instant-order-billing.test.js`).
- **Mobile**: `cd mobile_app && flutter analyze lib`.
- **Products page**: `cd mobile_app && flutter test test/products_screen_test.dart`.
- **End-to-end**: admin sets a product to Instant/Both → Home → Products → tap Instant on it → set
  delivery charge → Confirm → admin **Instant → Mark Delivered** → user's due increases and the
  day shows purple on the calendar.
