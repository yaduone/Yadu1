# Cart Confirmation Flow - Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MOBILE APP                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐      ┌─────────────┐      ┌──────────────┐    │
│  │  Products  │─────>│  Cart       │─────>│ Confirmation │    │
│  │  Screen    │ Add  │  Screen     │Review│  Screen      │    │
│  └────────────┘      └─────────────┘      └──────────────┘    │
│                            │                      │             │
│                            │                      │             │
│                     ┌──────▼──────────────────────▼────┐        │
│                     │    CartProvider                  │        │
│                     │  ┌────────────────────────────┐  │        │
│                     │  │   Pending Cart (Local)     │  │        │
│                     │  │  - Items not confirmed     │  │        │
│                     │  │  - In-memory state         │  │        │
│                     │  └────────────────────────────┘  │        │
│                     │                                  │        │
│                     │  ┌────────────────────────────┐  │        │
│                     │  │  Confirmed Cart (Server)   │  │        │
│                     │  │  - Items confirmed         │  │        │
│                     │  │  - Synced with backend     │  │        │
│                     │  └────────────────────────────┘  │        │
│                     └───────────┬──────────────────────┘        │
│                                 │                                │
└─────────────────────────────────┼────────────────────────────────┘
                                  │ confirmPendingCart()
                                  │ POST /cart/tomorrow/add-item
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐      ┌─────────────┐      ┌──────────────┐ │
│  │ Cart Routes    │─────>│  Cart       │─────>│  Firebase    │ │
│  │ /tomorrow/...  │      │  Service    │      │  Firestore   │ │
│  └────────────────┘      └─────────────┘      └──────────────┘ │
│                                                        │         │
│                          ┌─────────────────────────────┘         │
│                          │                                      │
│                          ▼                                      │
│  ┌────────────────────────────────────────────────────┐        │
│  │         Collections (Unchanged)                     │        │
│  │  ┌────────────┐  ┌─────────────────┐  ┌─────────┐ │        │
│  │  │   carts    │  │ next_day        │  │ orders  │ │        │
│  │  │            │  │ _overrides      │  │         │ │        │
│  │  └────────────┘  └─────────────────┘  └─────────┘ │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │ Nightly Job (11 PM)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MANIFEST GENERATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Read `carts` collection (confirmed items)                   │
│  2. Read `next_day_overrides` (milk modifications)              │
│  3. Read `subscriptions` (base milk orders)                     │
│  4. Create orders in `orders` collection                        │
│  5. Generate PDF manifest                                       │
│  6. Clean up processed carts and overrides                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CART STATE MACHINE                           │
└─────────────────────────────────────────────────────────────────┘

    ┌───────────────┐
    │  Empty Cart   │
    │ Pending: []   │
    │ Confirmed: [] │
    └───────┬───────┘
            │
            │ User adds items
            ▼
    ┌───────────────────┐
    │ Has Pending Items │
    │ Pending: [items]  │
    │ Confirmed: []     │
    │ 🔴 Show Confirm   │
    └───────┬───────────┘
            │
            │ User clicks Confirm
            ▼
    ┌───────────────────┐
    │  Confirming...    │
    │ ⏳ API calls      │
    └───────┬───────────┘
            │
            ├──Success──> ┌─────────────────┐
            │             │ Fully Confirmed │
            │             │ Pending: []     │
            │             │ Confirmed: [all]│
            │             │ ✅ No button    │
            │             └─────────────────┘
            │                     │
            │                     │ User adds more OR removes item
            │                     ▼
            │             ┌─────────────────┐
            │             │ Mixed State     │
            │             │ Pending: [new]  │
            │             │ Confirmed: [old]│
            │             │ 🔴 Show Confirm │
            │             └─────────────────┘
            │
            └──Failure──> ┌─────────────────┐
                          │ Pending Items   │
                          │ (Retry State)   │
                          │ Pending: [items]│
                          │ Confirmed: []   │
                          │ 🔴 Show Confirm │
                          │ ⚠️ Show Error   │
                          └─────────────────┘
```

## UI Screen Layouts

### 1. Cart Screen - With Pending Items

```
╔════════════════════════════════════════════════╗
║  🔙  Tomorrow's Cart              ₹330        ║
╠════════════════════════════════════════════════╣
║                                                ║
║  📦 Delivery Summary                           ║
║  ┌──────────────────────────────────────────┐  ║
║  │ 🚚 Scheduled delivery                    │  ║
║  │ Tomorrow, June 8, 2026                   │  ║
║  │ 🥛 Buffalo Milk  🛍️ 2 extra items       │  ║
║  └──────────────────────────────────────────┘  ║
║                                                ║
║  Milk Delivery                                 ║
║  ┌──────────────────────────────────────────┐  ║
║  │ 🐃 Buffalo Milk                          │  ║
║  │ ₹60/L                      [- 1.0L +]    │  ║
║  └──────────────────────────────────────────┘  ║
║                                                ║
║  Extra Items                  [+ Quick Add]    ║
║  ┌──────────────────────────────────────────┐  ║
║  │ 🧀 Fresh Paneer              ₹160        │  ║
║  │ Qty: 2                           [🗑️]    │  ║
║  └──────────────────────────────────────────┘  ║
║                                                ║
║  ⚠️ Pending Changes                            ║
║  ┌──────────────────────────────────────────┐  ║
║  │ ⏳ 2 items awaiting confirmation         │  ║
║  │                                          │  ║
║  │  [✅ Confirm Cart (₹170)]  ◀── NEW      │  ║
║  └──────────────────────────────────────────┘  ║
║                                                ║
║  💰 Delivery Total                             ║
║  ┌──────────────────────────────────────────┐  ║
║  │ ₹330.00                          📄      │  ║
║  └──────────────────────────────────────────┘  ║
║                                                ║
╚════════════════════════════════════════════════╝
```

### 2. Confirmation Screen

```
╔════════════════════════════════════════════════╗
║  ❌  Confirm Your Order                        ║
╠════════════════════════════════════════════════╣
║                                                ║
║  🚚 Delivery Date                              ║
║  ┌──────────────────────────────────────────┐  ║
║  │ 🚛 Tomorrow, June 8, 2026               │  ║
║  └──────────────────────────────────────────┘  ║
║                                                ║
║  ➕ Items Being Added                          ║
║                                                ║
║  ┌──────────────────────────────────────────┐  ║
║  │ [🧈]  Butter (Amul)           ₹80       │  ║
║  │       Qty: 1  |  ₹80/pack                │  ║
║  │       1 × ₹80 = ₹80                      │  ║
║  └──────────────────────────────────────────┘  ║
║                                                ║
║  ┌──────────────────────────────────────────┐  ║
║  │ [🧀]  Fresh Paneer           ₹180       │  ║
║  │       Qty: 2  |  ₹90/pack                │  ║
║  │       2 × ₹90 = ₹180                     │  ║
║  └──────────────────────────────────────────┘  ║
║                                                ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                ║
║  Price Summary                                 ║
║                                                ║
║  Previously in Cart         ₹150.00            ║
║  New Items                  ₹260.00 ⭐        ║
║  Delivery Fee               FREE 🎉           ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║  Total Cart Price           ₹410.00            ║
║                                                ║
║  ℹ️ After confirmation, these items will be    ║
║     added to your delivery for Tomorrow.       ║
║     Any changes require re-confirmation.       ║
║                                                ║
║  ┌─────────────────┐  ┌────────────────────┐  ║
║  │  [← Go Back]    │  │ [✅ Confirm Order] │  ║
║  └─────────────────┘  └────────────────────┘  ║
║                                                ║
╚════════════════════════════════════════════════╝
```

## Data Flow Sequence

### Scenario 1: Add Items and Confirm

```
User                CartScreen          CartProvider           Backend
 │                       │                    │                   │
 │ Tap "Quick Add"       │                    │                   │
 ├──────────────────────>│                    │                   │
 │                       │                    │                   │
 │ Select items          │                    │                   │
 │ Tap "Add to Cart"     │                    │                   │
 ├──────────────────────>│                    │                   │
 │                       │ addPendingItem()   │                   │
 │                       ├───────────────────>│                   │
 │                       │                    │ (Local only)      │
 │                       │<───────────────────┤                   │
 │                       │ hasPendingChanges  │                   │
 │<──────────────────────┤    = true          │                   │
 │ See "Confirm" button  │                    │                   │
 │                       │                    │                   │
 │ Tap "Confirm Cart"    │                    │                   │
 ├──────────────────────>│                    │                   │
 │                       │ Show Confirmation  │                   │
 │                       │     Screen         │                   │
 │<──────────────────────┤                    │                   │
 │ Review items          │                    │                   │
 │ Tap "Confirm Order"   │                    │                   │
 ├──────────────────────>│                    │                   │
 │                       │confirmPendingCart()│                   │
 │                       ├───────────────────>│                   │
 │                       │                    │ POST add-item (×N)│
 │                       │                    ├──────────────────>│
 │                       │                    │  Success          │
 │                       │                    │<──────────────────┤
 │                       │                    │ clearPendingCart()│
 │                       │    Success         │                   │
 │                       │<───────────────────┤                   │
 │ "Cart confirmed!" 🎉  │                    │                   │
 │<──────────────────────┤                    │                   │
 │                       │                    │                   │
```

### Scenario 2: Network Error During Confirmation

```
User                CartScreen          CartProvider           Backend
 │                       │                    │                   │
 │ Tap "Confirm Order"   │                    │                   │
 ├──────────────────────>│                    │                   │
 │                       │confirmPendingCart()│                   │
 │                       ├───────────────────>│                   │
 │                       │                    │ POST add-item     │
 │                       │                    ├──────────────────>│
 │                       │                    │     ❌ Error      │
 │                       │                    │<──────────────────┤
 │                       │    Failure         │                   │
 │                       │<───────────────────┤                   │
 │                       │ (Pending retained) │                   │
 │ "Failed. Try again"⚠️ │                    │                   │
 │<──────────────────────┤                    │                   │
 │ "Confirm" still shown │                    │                   │
 │                       │                    │                   │
```

## Testing Scenarios

### ✅ Happy Path
1. User adds 2 items to cart
2. Confirm button appears
3. User clicks confirm
4. Confirmation screen shows both items
5. User confirms
6. Items sent to backend
7. Pending cart cleared
8. Success message shown

### ⚠️ Error Handling
1. User adds items
2. User confirms
3. Network error occurs
4. Error message shown
5. Pending cart retained
6. User can retry

### 🔄 Iterative Changes
1. User adds item A
2. User confirms
3. Pending cart cleared
4. User adds item B
5. Confirm button reappears
6. User confirms again
7. Both A and B in cart

### 🗑️ Remove Confirmed Item
1. User has confirmed items [A, B]
2. User removes item A
3. Confirm button reappears
4. User must re-confirm

## Performance Considerations

### Memory
- Pending cart: In-memory only (~10-50 items max)
- Images: Cached via CachedNetworkImage
- Provider: Uses ChangeNotifier (efficient)

### Network
- Confirmation: N API calls for N items
- Future optimization: Batch API endpoint
- Retry logic: Built-in error handling

### UI
- Cart screen: Rebuilds only on state change
- Confirmation screen: Static after load
- Animations: Lightweight (AnimatedSize, AnimatedContainer)

## Conclusion

This visual guide provides:
- System architecture overview
- State machine diagram
- UI mockups
- Sequence diagrams
- Testing scenarios

Use this as a reference for understanding and explaining the cart confirmation flow to team members and stakeholders.
