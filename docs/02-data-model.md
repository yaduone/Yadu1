# Firestore Data Model

## Collections & Schema

---

### 1. `areas`
Represents service delivery areas.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| name | string | Area name (e.g., "Rajendranagar") |
| slug | string | URL-safe identifier (e.g., "rajendranagar") |
| is_active | boolean | Whether area is currently serviced |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

**Seed Data**: Rajendranagar, Satellite

---

### 2. `admins`
Admin users for the web panel.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| username | string | Login username (unique) |
| password_hash | string | bcrypt hashed password |
| name | string | Display name |
| area_id | string | Reference to areas collection |
| role | string | "area_admin" or "super_admin" |
| is_active | boolean | Account status |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

**Index**: username (unique)

---

### 3. `users`
Mobile app users.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| firebase_uid | string | Firebase Auth UID |
| phone | string | Phone number (with country code) |
| name | string | Full name |
| area_id | string | Reference to areas collection |
| address | object | { line1, line2, landmark, pincode } |
| is_active | boolean | Account status |
| created_at | timestamp | Registration time |
| updated_at | timestamp | Last update time |

**Index**: firebase_uid (unique), area_id, phone

---

### 4. `products`
Dairy product catalog.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| name | string | Product name (e.g., "Fresh Paneer 200g") |
| category | string | One of: curd, paneer, butter_milk, ghee, butter, lassi, cream, cheese |
| unit | string | e.g., "200g", "500ml", "1kg" |
| price | number | Price in INR |
| description | string | Short description |
| is_active | boolean | Available for ordering |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

**Index**: category, is_active

---

### 5. `subscriptions`
Daily milk subscriptions for users.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| user_id | string | Reference to users |
| area_id | string | Reference to areas (denormalized) |
| milk_type | string | "cow", "buffalo", or "toned" |
| quantity_litres | number | Base daily quantity (in 0.5L increments) |
| price_per_litre | number | Locked-in price at subscription time |
| status | string | "active", "paused", "cancelled" |
| start_date | string | ISO date (YYYY-MM-DD) |
| paused_at | timestamp | When paused (null if not paused) |
| cancelled_at | timestamp | When cancelled (null if active) |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

**Index**: user_id, area_id + status, status

**Rule**: One active subscription per user at a time.

---

### 6. `next_day_overrides`
Temporary modifications to tomorrow's milk delivery.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| user_id | string | Reference to users |
| subscription_id | string | Reference to subscriptions |
| area_id | string | Reference to areas (denormalized) |
| date | string | Target delivery date (YYYY-MM-DD) |
| override_type | string | "modify" or "skip" |
| modified_quantity | number | New quantity (null if skip) |
| created_at | timestamp | When override was created |

**Index**: user_id + date (unique per user per date), area_id + date

**Lifecycle**: Created by user, consumed by nightly job, then marked as processed or deleted.

---

### 7. `carts`
Next-day cart for extra dairy products.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| user_id | string | Reference to users |
| area_id | string | Reference to areas (denormalized) |
| date | string | Target delivery date (YYYY-MM-DD) |
| items | array | Array of cart item objects |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

**Cart Item Object** (embedded in items array):
| Field | Type | Description |
|-------|------|-------------|
| product_id | string | Reference to products |
| product_name | string | Denormalized name |
| quantity | number | Number of units |
| unit | string | Denormalized unit |
| price | number | Price per unit at time of adding |
| total | number | quantity * price |

**Index**: user_id + date (unique), area_id + date

---

### 8. `orders`
Finalized daily orders (created from cart + subscription by nightly job).

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| user_id | string | Reference to users |
| area_id | string | Reference to areas |
| date | string | Delivery date (YYYY-MM-DD) |
| milk | object | { milk_type, quantity_litres, price_per_litre, total } or null |
| extra_items | array | Same structure as cart items |
| total_amount | number | Grand total |
| status | string | "pending", "delivered", "cancelled" |
| notes | string | Optional delivery notes |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

**Index**: user_id + date, area_id + date, area_id + status

---

### 9. `manifests`
Generated delivery manifest records.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| area_id | string | Reference to areas |
| date | string | Delivery date (YYYY-MM-DD) |
| total_users | number | Count of users with orders |
| total_milk_litres | number | Sum of all milk quantities |
| total_extra_items | number | Count of extra product units |
| total_amount | number | Sum of all order amounts |
| pdf_path | string | File path to generated PDF |
| generated_at | timestamp | When manifest was generated |
| generated_by | string | "system" or admin_id (for manual regeneration) |

**Index**: area_id + date (unique)

---

### 10. `livestreams`
Livestream configuration per area.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| area_id | string | Reference to areas |
| title | string | Stream title |
| youtube_url | string | YouTube video/live URL |
| start_time | timestamp | Scheduled start |
| end_time | timestamp | Scheduled end |
| is_active | boolean | Admin toggle |
| created_by | string | Admin ID who created |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

**Index**: area_id + is_active

---

### 11. `notifications`
Push notifications / in-app messages.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| user_id | string | Target user (null for broadcast) |
| area_id | string | Target area (for area-wide notifications) |
| title | string | Notification title |
| body | string | Notification body |
| type | string | "info", "reminder", "alert" |
| is_read | boolean | Read status |
| created_at | timestamp | Creation time |

**Index**: user_id + is_read, area_id + created_at

---

### 12. `price_config`
Milk pricing configuration.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| milk_type | string | "cow", "buffalo", "toned" |
| price_per_litre | number | Current price in INR |
| is_active | boolean | Whether this type is available |
| updated_at | timestamp | Last price change |

**Seed Data**:
- cow: ₹60/litre
- buffalo: ₹70/litre
- toned: ₹50/litre

---

### 13. `audit_logs`
Track important actions for accountability.

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Document ID |
| actor_type | string | "user", "admin", "system" |
| actor_id | string | ID of who performed action |
| action | string | e.g., "subscription.created", "manifest.generated" |
| entity_type | string | Collection name affected |
| entity_id | string | Document ID affected |
| details | object | Additional context |
| created_at | timestamp | When action occurred |

**Index**: actor_id, entity_type + entity_id, created_at

---

## Relationships Diagram

```
areas ──┬── admins (area_id)
        ├── users (area_id)
        ├── livestreams (area_id)
        ├── manifests (area_id)
        └── notifications (area_id)

users ──┬── subscriptions (user_id)
        ├── next_day_overrides (user_id)
        ├── carts (user_id)
        ├── orders (user_id)
        └── notifications (user_id)

subscriptions ── next_day_overrides (subscription_id)

products ── carts.items (product_id)
         ── orders.extra_items (product_id)
```
