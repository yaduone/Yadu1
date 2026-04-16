# Business Logic Flows

## 1. Tomorrow Cart Engine (Core Logic)

The tomorrow cart is the central concept. It represents what a user will receive on the next delivery day.

### How the Tomorrow Cart is Computed

```
Tomorrow Cart = Subscription Milk + Next Day Override + Extra Products
```

**Flow**:
1. Check if user has active subscription
2. If yes → default milk entry = subscription.milk_type + subscription.quantity_litres
3. Check for next_day_override for tomorrow's date
   - If override_type = "modify" → replace quantity with modified_quantity
   - If override_type = "skip" → remove milk entirely
4. Check for extra products in carts collection for tomorrow's date
5. Combine all into a single view

**Important**: The cart for tomorrow always shows the EFFECTIVE state. It is a computed view, not a separate source of truth for milk. Milk comes from subscription + overrides. Only extra products are stored directly in the cart.

### Cutoff Time

Users can modify tomorrow's order until **9:00 PM today** (configurable).
After cutoff, tomorrow's order is locked.

### Tomorrow Date Calculation

"Tomorrow" = current date + 1 day, using server timezone (IST / Asia/Kolkata).

---

## 2. Subscription Lifecycle

```
[Created] → [Active] → [Paused] → [Active] (resume)
                     → [Cancelled] (terminal)
           [Paused] → [Cancelled] (terminal)
```

**Rules**:
- Only ONE active/paused subscription per user at any time
- Cancelled subscriptions cannot be resumed (user must create new)
- When paused: milk is NOT included in tomorrow cart
- When cancelled: all pending overrides are deleted, cart milk cleared
- Price is locked at subscription creation time

---

## 3. Next Day Override Flow

### User Modifies Quantity
1. User requests quantity change for tomorrow
2. Validate: has active subscription, before cutoff, valid quantity
3. Upsert next_day_override: { date: tomorrow, type: "modify", modified_quantity: X }
4. Cart view reflects new quantity

### User Skips Tomorrow
1. User requests skip for tomorrow
2. Validate: has active subscription, before cutoff
3. Upsert next_day_override: { date: tomorrow, type: "skip" }
4. Cart view shows no milk

### User Reverts Override
1. User cancels their override
2. Delete next_day_override for tomorrow
3. Cart view reverts to base subscription quantity

### Override Lifecycle
- Overrides are date-specific: they apply to exactly ONE date
- After the nightly job processes them into orders, they can be cleaned up
- An override for a past date is irrelevant and can be garbage collected

---

## 4. Nightly Manifest Generation Flow

**Trigger**: Cron job at 11:00 PM IST daily.

**For each active area**:

```
Step 1: Determine delivery date (tomorrow)
Step 2: Fetch all users in this area with active subscriptions
Step 3: For each user:
   a. Get subscription → base milk quantity and type
   b. Check next_day_override for delivery date
      - If "skip" → no milk for this user
      - If "modify" → use modified_quantity
      - If none → use base quantity
   c. Get cart for delivery date → extra products
   d. Calculate totals
   e. Create order record in 'orders' collection
Step 4: Aggregate all orders for this area
Step 5: Generate PDF manifest with:
   - Date, area name
   - Table: user name, phone, address, milk qty, extras, total
   - Summary totals at bottom
Step 6: Save PDF to filesystem (manifests/{area_slug}_{date}.pdf)
Step 7: Create manifest record in Firestore
Step 8: Clean up processed overrides for this date
```

### Manual Regeneration
Admin can trigger regeneration for a date:
1. Delete existing orders for that area + date (if any) — OR update them
2. Re-run steps 2-7
3. Update manifest record

---

## 5. Area-Based Access Control

### Rules
- Every user belongs to exactly one area
- Every area_admin manages exactly one area
- super_admin can manage all areas
- All data queries for area_admin are filtered by their area_id

### Enforcement
- Middleware extracts area_id from admin JWT
- Service layer always includes area_id in Firestore queries
- User endpoints use the user's own area_id

---

## 6. Livestream Visibility Logic

```
Show livestream to user IF:
  1. livestream.area_id == user.area_id
  2. livestream.is_active == true
  3. current_time >= livestream.start_time
  4. current_time <= livestream.end_time
```

If no matching livestream exists → show "No live stream available" message.

---

## 7. Reporting Logic

### User Reports (computed on-demand)
- **Total milk delivered**: SUM of orders.milk.quantity_litres WHERE status = "delivered"
- **Total milk pending**: SUM of orders.milk.quantity_litres WHERE status = "pending"
- **Total spent**: SUM of orders.total_amount WHERE status = "delivered"
- **Skipped days**: COUNT of next_day_overrides WHERE type = "skip" (historical)
- **Monthly summary**: Group by month, aggregate above metrics

### Admin Reports (computed on-demand)
- **Active subscriptions**: COUNT WHERE area_id = X AND status = "active"
- **Tomorrow total litres**: Computed from active subscriptions + overrides for tomorrow
- **Revenue this month**: SUM of orders.total_amount for current month
- **Product demand**: COUNT/SUM of extra items across orders

---

## 8. Order Status Flow

```
[pending] → [delivered]   (admin marks as delivered)
          → [cancelled]   (admin cancels / user cancels before cutoff)
```

Orders are created by the nightly job with status "pending".
Admin marks orders as delivered during/after delivery.

---

## 9. Pricing Logic

- Milk prices are stored in price_config collection
- When a user creates a subscription, the current price is copied to subscription.price_per_litre
- This locks the price for that subscription (price changes don't affect existing subscriptions)
- Extra product prices are copied to cart items at add time
- Order totals are computed from these locked prices

---

## 10. Seed Data Plan

### Areas
1. Rajendranagar (slug: rajendranagar)
2. Satellite (slug: satellite)

### Admins
1. rajendra_admin / Raj@1234 → area: Rajendranagar, role: area_admin
2. satellite_admin / Sat@1234 → area: Satellite, role: area_admin

### Price Config
1. cow → ₹60/litre
2. buffalo → ₹70/litre
3. toned → ₹50/litre

### Sample Products
1. Fresh Curd 500g → curd, ₹40
2. Paneer 200g → paneer, ₹80
3. Butter Milk 500ml → butter_milk, ₹25
4. Pure Ghee 500ml → ghee, ₹350
5. Fresh Butter 100g → butter, ₹55
6. Sweet Lassi 250ml → lassi, ₹30
7. Fresh Cream 200ml → cream, ₹45
8. Cheese Slice 100g → cheese, ₹60
