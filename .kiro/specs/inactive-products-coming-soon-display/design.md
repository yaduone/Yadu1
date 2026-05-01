# Inactive Products Coming Soon Display Bugfix Design

## Overview

This bugfix addresses the issue where inactive products (`is_active = false`) are completely filtered out by the backend API, preventing users from seeing "Coming Soon" products in the mobile app. The fix involves removing the backend filter that excludes inactive products and implementing visual styling in the mobile app to display inactive products with "Coming Soon" styling while preserving all existing functionality for active products.

The approach ensures minimal changes to the backend (removing one filter line) while adding comprehensive visual and interaction handling in the mobile app to differentiate between active and inactive products.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the backend `/products` endpoint filters out inactive products using `where('is_active', '==', true)` at line 42
- **Property (P)**: The desired behavior when inactive products exist - they should be included in API responses and displayed with "Coming Soon" styling in the mobile app
- **Preservation**: Existing active product behavior, admin functionality, and all current user interactions that must remain unchanged by the fix
- **getProducts()**: The function in `backend/src/modules/products/product.routes.js` that handles the public `/products` endpoint
- **is_active**: The boolean field in the products collection that determines if a product is active (true) or inactive/coming soon (false)
- **ProductsScreen**: The Flutter screen in `mobile_app/lib/screens/products/products_screen.dart` that displays the product grid
- **ProductDetailScreen**: The Flutter screen in `mobile_app/lib/screens/products/product_detail_screen.dart` that shows individual product details

## Bug Details

### Bug Condition

The bug manifests when the backend `/products` endpoint is queried and inactive products exist in the database. The `getProducts()` function applies a filter `where('is_active', '==', true)` at line 42, which completely excludes inactive products from the API response, preventing the mobile app from displaying them as "Coming Soon" products.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ProductQueryRequest
  OUTPUT: boolean
  
  RETURN input.endpoint = "/products" 
         AND input.query_contains_filter = "where('is_active', '==', true)"
         AND EXISTS products WHERE is_active = false
END FUNCTION
```

### Examples

- **Example 1**: Admin creates "Organic Honey" product and sets `is_active = false` for upcoming launch
  - **Expected**: Product appears in mobile app with "Coming Soon" styling
  - **Actual**: Product completely disappears from mobile app product list

- **Example 2**: Admin toggles existing "Premium Rice" from active to inactive to prepare for restock
  - **Expected**: Product remains visible with "Coming Soon" overlay and no interaction
  - **Actual**: Product vanishes entirely from user view

- **Example 3**: User browses products when 3 active and 2 inactive products exist
  - **Expected**: Sees 5 products total (3 normal + 2 with "Coming Soon" styling)
  - **Actual**: Sees only 3 active products, unaware of upcoming products

- **Edge Case**: Category filtering with mixed active/inactive products
  - **Expected**: Both active and inactive products in selected category are shown with appropriate styling

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Active products (`is_active = true`) must continue to display and function exactly as before
- Product detail navigation for active products must remain unchanged
- Add to cart functionality for active products must work identically
- Admin panel `/products/all` endpoint must continue returning all products as it currently does
- Admin panel product toggle functionality must remain unchanged
- Category filtering must continue to work for both active and inactive products
- Product grid layout and visual design for active products must remain identical
- Image loading and caching behavior for active products must be preserved

**Scope:**
All inputs and interactions that do NOT involve inactive products should be completely unaffected by this fix. This includes:
- All active product interactions (viewing, adding to cart, navigation)
- Admin panel functionality and endpoints
- Category filtering and search functionality
- Product image display and caching for active products

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is clearly identified:

1. **Backend Filter Exclusion**: The primary cause is line 42 in `backend/src/modules/products/product.routes.js` where the query applies `where('is_active', '==', true)`, completely filtering out inactive products from the API response.

2. **Missing Mobile App Handling**: The mobile app (`ProductsScreen` and `ProductDetailScreen`) currently assumes all products in the API response are active and interactive, lacking logic to handle inactive products with different styling and behavior.

3. **No Visual Differentiation**: The current `_ProductCard` widget has no mechanism to detect or display inactive products differently from active ones.

4. **No Interaction Prevention**: The `ProductDetailScreen` navigation occurs for all products without checking the `is_active` status.

## Correctness Properties

Property 1: Bug Condition - Inactive Products Visibility

_For any_ API request to the `/products` endpoint where inactive products exist in the database, the fixed system SHALL include all products (both active and inactive) in the response with their `is_active` field, and the mobile app SHALL display inactive products with visual styling including blurred images, dark overlay, "Coming Soon" text, and positioning after active products.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Active Product Behavior

_For any_ interaction with active products (`is_active = true`), the fixed system SHALL produce exactly the same behavior as the original system, preserving all existing functionality including display, navigation, cart operations, and visual appearance.

**Validates: Requirements 3.1, 3.2, 3.3, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `backend/src/modules/products/product.routes.js`

**Function**: `GET /products` route handler (line 42)

**Specific Changes**:
1. **Remove Active Filter**: Remove the `where('is_active', '==', true)` filter from line 42
   - Change: `let query = db.collection('products').where('is_active', '==', true);`
   - To: `let query = db.collection('products');`
   - This allows both active and inactive products to be returned in the API response

**File**: `mobile_app/lib/screens/products/products_screen.dart`

**Function**: `_ProductCard` widget and product sorting logic

**Specific Changes**:
2. **Add Product Sorting**: Sort products to display active products first, then inactive products
   - Add sorting logic in the `build` method after category filtering
   - Sort by `is_active` field (true first, then false)

3. **Update _ProductCard Widget**: Add conditional styling for inactive products
   - Check `product['is_active']` field in the widget
   - Apply blur effect, dark overlay, and "Coming Soon" text for inactive products
   - Disable tap gesture for inactive products (make non-clickable)

4. **Add Visual Styling Components**: Implement "Coming Soon" overlay styling
   - Create blur effect using `ImageFiltered` widget
   - Add dark overlay using `Container` with semi-transparent black
   - Position "Coming Soon" text overlay in center of product card

**File**: `mobile_app/lib/screens/products/product_detail_screen.dart`

**Function**: Navigation prevention and detail screen handling

**Specific Changes**:
5. **Prevent Detail Navigation**: Add check in `ProductsScreen` to prevent navigation for inactive products
   - Modify `GestureDetector.onTap` to check `product['is_active']` before navigation
   - Only navigate to `ProductDetailScreen` if product is active

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Create test products with `is_active = false` in the database, then query the `/products` endpoint and check mobile app behavior. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Backend Filter Test**: Query `/products` endpoint when inactive products exist (will fail on unfixed code - inactive products missing from response)
2. **Mobile App Display Test**: Load products screen when API returns inactive products (will fail on unfixed code - no special styling)
3. **Category Filter Test**: Filter by category containing both active and inactive products (will fail on unfixed code - inactive products missing)
4. **Navigation Test**: Attempt to tap inactive product in mobile app (may fail on unfixed code - should be non-clickable)

**Expected Counterexamples**:
- API response excludes products where `is_active = false`
- Mobile app shows no visual indication of inactive products
- Possible causes: backend filter at line 42, missing mobile app inactive product handling

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getProducts_fixed(input)
  ASSERT result.products CONTAINS products WHERE is_active = false
  ASSERT (FOR ALL p IN result.products WHERE p.is_active = false):
    mobile_app_displays_with_coming_soon_styling(p)
    mobile_app_prevents_navigation(p)
    mobile_app_positions_after_active_products(p)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getProducts_original(input) = getProducts_fixed(input)
  ASSERT mobile_app_behavior_original(input) = mobile_app_behavior_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all active product interactions

**Test Plan**: Observe behavior on UNFIXED code first for active products and admin functionality, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Active Product Display Preservation**: Verify active products display identically before and after fix
2. **Active Product Navigation Preservation**: Verify tapping active products navigates to detail screen as before
3. **Admin Endpoint Preservation**: Verify `/products/all` endpoint continues to return all products
4. **Category Filtering Preservation**: Verify category filtering works for active products as before

### Unit Tests

- Test backend `/products` endpoint returns both active and inactive products after filter removal
- Test mobile app product sorting places active products before inactive products
- Test inactive product visual styling (blur, overlay, "Coming Soon" text)
- Test inactive product tap prevention (non-clickable behavior)
- Test active product behavior remains unchanged

### Property-Based Tests

- Generate random product datasets with mixed active/inactive status and verify correct API responses
- Generate random product configurations and verify mobile app displays active products identically to original behavior
- Test category filtering across many product combinations to ensure both active and inactive products are handled correctly

### Integration Tests

- Test full user flow: backend API → mobile app display → user interaction for both active and inactive products
- Test admin workflow: create inactive product → verify mobile app shows "Coming Soon" styling
- Test product lifecycle: toggle product from active to inactive → verify mobile app updates display appropriately