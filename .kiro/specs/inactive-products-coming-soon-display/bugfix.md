# Bugfix Requirements Document

## Introduction

When an admin toggles a product to inactive (`is_active = false`) in the admin panel, the product completely disappears from the mobile app product list. This prevents users from seeing upcoming "Coming Soon" products, which defeats the purpose of having an inactive status. The inactive status should indicate "coming soon" visibility with restricted interaction, not complete invisibility.

**Impact:** Users cannot discover upcoming products, reducing anticipation and engagement for new product launches.

**Root Cause:** The backend API endpoint `/products` (line 42 in `backend/src/modules/products/product.routes.js`) filters out inactive products entirely using `where('is_active', '==', true)`, preventing them from reaching the mobile app.

**Files to Modify:**
1. `backend/src/modules/products/product.routes.js` - Remove the `where('is_active', '==', true)` filter from the public `/products` endpoint (line 42)
2. `mobile_app/lib/screens/products/products_screen.dart` - Add visual styling and sorting logic for inactive products (blur, overlay, "Coming Soon" text, positioned after active products)
3. `mobile_app/lib/screens/products/product_detail_screen.dart` - Prevent navigation or interaction for inactive products

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the backend `/products` endpoint is queried THEN the system filters products with `where('is_active', '==', true)` at line 42 of `backend/src/modules/products/product.routes.js`

1.2 WHEN a product has `is_active = false` THEN the system excludes it completely from the `/products` API response

1.3 WHEN the mobile app requests products via `/products` endpoint THEN the system returns only active products, causing inactive products to vanish from the product list entirely

1.4 WHEN users browse the products screen THEN the system shows no indication that inactive/upcoming products exist

### Expected Behavior (Correct)

2.1 WHEN the backend `/products` endpoint is queried THEN the system SHALL remove the `where('is_active', '==', true)` filter and return ALL products (both active and inactive) with their `is_active` field

2.2 WHEN a product has `is_active = false` THEN the system SHALL include it in the `/products` API response with the `is_active` field set to `false`

2.3 WHEN the mobile app receives inactive products THEN the system SHALL display them with visual styling: blurred cover image with dark overlay and "Coming Soon" text overlay

2.4 WHEN inactive products are displayed THEN the system SHALL position them AFTER all active products in the list

2.5 WHEN a user attempts to tap/click an inactive product THEN the system SHALL prevent navigation to the product detail screen (non-clickable)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a product has `is_active = true` THEN the system SHALL CONTINUE TO display it normally with full interactivity and navigation

3.2 WHEN users tap on active products THEN the system SHALL CONTINUE TO navigate to the product detail screen with full functionality

3.3 WHEN products are filtered by category THEN the system SHALL CONTINUE TO apply category filtering correctly for both active and inactive products

3.4 WHEN the admin panel queries `/products/all` endpoint THEN the system SHALL CONTINUE TO return all products (both active and inactive) as it currently does

3.5 WHEN the admin panel toggles a product's `is_active` status THEN the system SHALL CONTINUE TO update the product status without any changes to the toggle functionality

3.6 WHEN products are displayed in the grid layout THEN the system SHALL CONTINUE TO maintain the current grid structure and visual design for active products

3.7 WHEN product images are loaded for active products THEN the system SHALL CONTINUE TO use cached network images with the same loading and error handling behavior

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ProductQueryRequest
  OUTPUT: boolean
  
  // Returns true when the bug condition is met
  // Bug occurs when the backend filters out inactive products at line 42
  RETURN X.endpoint = "/products" AND 
         X.query_contains_filter = "where('is_active', '==', true)"
END FUNCTION
```

### Property Specification: Fix Checking

```pascal
// Property: Fix Checking - Inactive Products Visibility
FOR ALL X WHERE isBugCondition(X) DO
  result ← getProducts'(X)
  ASSERT result.products CONTAINS products WHERE is_active = false
  ASSERT (FOR ALL p IN result.products WHERE p.is_active = false):
    - p HAS visual_styling = {blur: true, overlay: "dark", text: "Coming Soon"}
    - p IS non_clickable = true
    - p IS positioned_after_all_active_products = true
END FOR
```

**Key Definitions:**
- **F**: `getProducts()` - The original function with `where('is_active', '==', true)` filter at line 42
- **F'**: `getProducts'()` - The fixed function that returns all products (removes the filter)

### Property Specification: Preservation Checking

```pascal
// Property: Preservation Checking - Active Products Unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR

// Specifically:
// - Active products display and behavior remains identical
// - Admin endpoint /products/all continues to work as before
// - Category filtering continues to work for all products
// - Product detail navigation for active products unchanged
```

## Concrete Counterexample

**Scenario:** Admin creates a new product "Organic Honey" and sets `is_active = false` to prepare for launch.

**Current Behavior (Bug):**
```
Request: GET /products
Response: { products: [ /* Organic Honey is missing */ ] }
Mobile App: Shows no trace of "Organic Honey"
User Experience: No awareness of upcoming product
```

**Expected Behavior (Fix):**
```
Request: GET /products
Response: { 
  products: [ 
    { id: "123", name: "Organic Honey", is_active: false, ... },
    /* other products */
  ] 
}
Mobile App: Displays "Organic Honey" with blur + "Coming Soon" label
User Experience: Sees upcoming product, builds anticipation
```
