# API Specification

Base URL: `http://localhost:3000/api`

All responses follow format:
```json
{
  "success": true|false,
  "data": { ... },
  "message": "string",
  "error": "string (only on failure)"
}
```

Auth header format:
- User routes: `Authorization: Bearer <firebase_id_token>`
- Admin routes: `Authorization: Bearer <jwt_token>`

---

## 1. Auth APIs

### POST /api/auth/user/verify
Verify Firebase OTP token and register/login user.

**Auth**: None (token in body)
**Body**:
```json
{
  "firebase_token": "string (Firebase ID token)"
}
```
**Response** (200):
```json
{
  "success": true,
  "data": {
    "user": { "id", "phone", "name", "area_id", "is_profile_complete" },
    "is_new_user": true
  }
}
```
**Logic**: Verify token → find or create user → return user data.

---

### POST /api/auth/user/complete-profile
Complete user registration after first OTP login.

**Auth**: User (Firebase token)
**Body**:
```json
{
  "name": "string",
  "area_id": "string",
  "address": {
    "line1": "string",
    "line2": "string (optional)",
    "landmark": "string (optional)",
    "pincode": "string"
  }
}
```
**Validation**: name required, area_id must exist and be active, line1 + pincode required.
**Response** (200): Updated user object.

---

### POST /api/auth/admin/login
Admin login with username/password.

**Auth**: None
**Body**:
```json
{
  "username": "string",
  "password": "string"
}
```
**Response** (200):
```json
{
  "success": true,
  "data": {
    "admin": { "id", "username", "name", "area_id", "role" },
    "token": "jwt_string"
  }
}
```
**Logic**: Validate credentials → return JWT (expires in 24h).

---

## 2. User APIs

### GET /api/users/profile
Get current user profile.

**Auth**: User
**Response**: User object with area details.

---

### PUT /api/users/profile
Update user profile.

**Auth**: User
**Body**: `{ name?, address? }`
**Validation**: Cannot change area_id after subscription is active.

---

## 3. Area APIs

### GET /api/areas
List all active areas (public, used during registration).

**Auth**: None
**Response**: Array of `{ id, name, slug }`.

---

### POST /api/areas (Admin: super_admin only)
Create new area.

**Body**: `{ name, slug }`

---

### PUT /api/areas/:id (Admin: super_admin only)
Update area.

---

### DELETE /api/areas/:id (Admin: super_admin only)
Deactivate area (soft delete).

---

## 4. Product APIs

### GET /api/products
List active products.

**Auth**: User or Admin
**Query**: `?category=curd` (optional filter)
**Response**: Array of product objects.

---

### POST /api/products (Admin)
Create product.

**Body**:
```json
{
  "name": "string",
  "category": "string (enum)",
  "unit": "string",
  "price": "number",
  "description": "string"
}
```
**Validation**: category must be one of: curd, paneer, butter_milk, ghee, butter, lassi, cream, cheese. Price > 0.

---

### PUT /api/products/:id (Admin)
Update product.

---

### DELETE /api/products/:id (Admin)
Deactivate product (soft delete, set is_active = false).

---

## 5. Subscription APIs

### POST /api/subscriptions
Create a new milk subscription.

**Auth**: User
**Body**:
```json
{
  "milk_type": "cow|buffalo|toned",
  "quantity_litres": 1.0,
  "start_date": "2025-01-15"
}
```
**Validation**:
- User must have complete profile
- No existing active subscription
- quantity_litres must be multiple of 0.5, min 0.5, max 10
- start_date must be tomorrow or later
- milk_type must be valid and have active price_config

**Logic**: Create subscription → auto-create next day cart entry if start_date is tomorrow.

---

### GET /api/subscriptions/active
Get user's active subscription.

**Auth**: User
**Response**: Subscription object or null.

---

### PUT /api/subscriptions/:id/pause
Pause active subscription.

**Auth**: User
**Logic**: Set status to "paused", set paused_at. Remove from tomorrow's cart.

---

### PUT /api/subscriptions/:id/resume
Resume paused subscription.

**Auth**: User
**Logic**: Set status to "active", clear paused_at. Add to tomorrow's cart.

---

### PUT /api/subscriptions/:id/cancel
Cancel subscription permanently.

**Auth**: User
**Logic**: Set status to "cancelled", set cancelled_at. Remove from tomorrow's cart. Clear any pending overrides.

---

### GET /api/subscriptions/admin/list (Admin)
List subscriptions for admin's area.

**Auth**: Admin
**Query**: `?status=active&page=1&limit=20`

---

## 6. Next Day Override APIs

### POST /api/tomorrow/modify
Modify tomorrow's milk quantity.

**Auth**: User
**Body**:
```json
{
  "modified_quantity": 1.5
}
```
**Validation**:
- Must have active subscription
- modified_quantity must be multiple of 0.5, min 0.5, max 10
- Must be before cutoff time (e.g., 9:00 PM today)

**Logic**: Create/update next_day_override for tomorrow → update tomorrow cart.

---

### POST /api/tomorrow/skip
Skip tomorrow's milk delivery.

**Auth**: User
**Validation**: Must have active subscription, before cutoff time.
**Logic**: Create next_day_override with type "skip" → remove milk from tomorrow cart.

---

### DELETE /api/tomorrow/override
Cancel tomorrow's override (revert to default subscription quantity).

**Auth**: User
**Logic**: Delete next_day_override → reset cart to default quantity.

---

### GET /api/tomorrow/status
Get tomorrow's delivery status for current user.

**Auth**: User
**Response**:
```json
{
  "date": "2025-01-15",
  "subscription": { "milk_type": "cow", "base_quantity": 1.0 },
  "override": { "type": "modify", "modified_quantity": 1.5 } | null,
  "effective_milk_quantity": 1.5,
  "is_skipped": false,
  "extra_items": [...],
  "total_amount": 120.00
}
```

---

## 7. Tomorrow Cart APIs

### GET /api/cart/tomorrow
Get tomorrow's complete cart.

**Auth**: User
**Response**: Cart object with milk (from subscription) + extra items.

---

### POST /api/cart/tomorrow/add-item
Add extra product to tomorrow's cart.

**Auth**: User
**Body**:
```json
{
  "product_id": "string",
  "quantity": 1
}
```
**Validation**: Product must exist and be active. Quantity > 0.
**Logic**: Add to or update item in tomorrow's cart. If item exists, increment quantity.

---

### PUT /api/cart/tomorrow/update-item
Update extra product quantity in tomorrow's cart.

**Auth**: User
**Body**:
```json
{
  "product_id": "string",
  "quantity": 2
}
```
**Logic**: If quantity is 0, remove item.

---

### DELETE /api/cart/tomorrow/remove-item/:productId
Remove extra product from tomorrow's cart.

**Auth**: User

---

## 8. Order APIs

### GET /api/orders
Get user's order history.

**Auth**: User
**Query**: `?page=1&limit=20&month=2025-01`

---

### GET /api/orders/:id
Get single order detail.

**Auth**: User

---

### GET /api/orders/admin/list (Admin)
List orders for admin's area.

**Auth**: Admin
**Query**: `?date=2025-01-15&status=pending&page=1&limit=50`

---

### PUT /api/orders/admin/:id/status (Admin)
Update order status (mark delivered, cancel).

**Auth**: Admin
**Body**: `{ "status": "delivered"|"cancelled" }`

---

## 9. Manifest APIs

### GET /api/manifests (Admin)
List manifests for admin's area.

**Auth**: Admin
**Query**: `?month=2025-01`

---

### GET /api/manifests/:id/download (Admin)
Download manifest PDF.

**Auth**: Admin
**Response**: PDF file stream.

---

### POST /api/manifests/regenerate (Admin)
Manually regenerate manifest for a specific date.

**Auth**: Admin
**Body**: `{ "date": "2025-01-15" }`
**Logic**: Re-run manifest generation for given date and area.

---

## 10. Reports APIs

### GET /api/reports/user/summary
User's personal report/insights.

**Auth**: User
**Response**:
```json
{
  "total_milk_delivered_litres": 45.0,
  "total_milk_pending_litres": 5.0,
  "total_spent": 3500.00,
  "total_skipped_days": 3,
  "extra_items_count": 12,
  "monthly_summary": [
    { "month": "2025-01", "milk_litres": 30, "extra_items": 8, "amount": 2400 }
  ]
}
```

---

### GET /api/reports/admin/dashboard (Admin)
Admin dashboard data.

**Auth**: Admin
**Response**:
```json
{
  "active_subscriptions": 45,
  "paused_subscriptions": 5,
  "total_users": 60,
  "tomorrow_total_litres": 52.5,
  "tomorrow_order_count": 48,
  "revenue_this_month": 125000,
  "milk_type_breakdown": { "cow": 30, "buffalo": 15, "toned": 7.5 },
  "product_demand": [ { "product": "Paneer 200g", "quantity": 25 } ]
}
```

---

### GET /api/reports/admin/daily (Admin)
Daily stats for date range.

**Auth**: Admin
**Query**: `?from=2025-01-01&to=2025-01-31`

---

## 11. Livestream APIs

### GET /api/livestreams/active
Get active livestream for user's area.

**Auth**: User
**Logic**: Return livestream where area matches user's area, is_active=true, and current time is between start_time and end_time.

---

### GET /api/livestreams/admin/list (Admin)
List all livestreams for admin's area.

**Auth**: Admin

---

### POST /api/livestreams (Admin)
Create livestream.

**Auth**: Admin
**Body**:
```json
{
  "title": "string",
  "youtube_url": "string",
  "start_time": "ISO datetime",
  "end_time": "ISO datetime"
}
```
**Validation**: youtube_url must be valid YouTube URL. end_time > start_time.

---

### PUT /api/livestreams/:id (Admin)
Update livestream.

**Auth**: Admin

---

### DELETE /api/livestreams/:id (Admin)
Delete livestream.

**Auth**: Admin

---

## 12. Notification APIs

### GET /api/notifications
Get user's notifications.

**Auth**: User
**Query**: `?page=1&limit=20`

---

### PUT /api/notifications/:id/read
Mark notification as read.

**Auth**: User

---

## 13. Price Config APIs

### GET /api/prices
Get current milk prices.

**Auth**: None (public)
**Response**: Array of `{ milk_type, price_per_litre, is_active }`.

---

### PUT /api/prices/:milk_type (Admin)
Update milk price.

**Auth**: Admin
**Body**: `{ "price_per_litre": 65 }`
**Note**: Does not affect existing subscriptions (they lock in price at creation).
