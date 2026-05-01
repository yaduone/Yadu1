# Inactive Products Coming Soon Display - Implementation Tasks

## Phase 1: Backend API Fix

### 1.1 Remove Active Products Filter
- [ ] Remove `where('is_active', '==', true)` filter from line 42 in `backend/src/modules/products/product.routes.js`
- [ ] Verify `/products` endpoint returns both active and inactive products with `is_active` field
- [ ] Test that category filtering still works correctly for both active and inactive products
- [ ] Ensure admin `/products/all` endpoint continues to work unchanged

## Phase 2: Mobile App Visual Implementation

### 2.1 Add Product Sorting Logic
- [ ] Modify `ProductsScreen` to sort products by `is_active` status (active first, then inactive)
- [ ] Implement sorting after category filtering but before display
- [ ] Verify sorted order maintains category filtering functionality

### 2.2 Implement Coming Soon Visual Styling
- [ ] Update `_ProductCard` widget to detect inactive products using `is_active` field
- [ ] Add blur effect to product images for inactive products using `ImageFiltered`
- [ ] Add dark semi-transparent overlay for inactive products
- [ ] Add "Coming Soon" text overlay positioned in center of inactive product cards
- [ ] Ensure active products display exactly as before (no visual changes)

### 2.3 Prevent Inactive Product Interaction
- [ ] Modify `GestureDetector.onTap` in `_ProductCard` to check `is_active` status
- [ ] Prevent navigation to `ProductDetailScreen` for inactive products
- [ ] Ensure active products continue to navigate normally
- [ ] Add visual feedback (or lack thereof) to indicate inactive products are non-clickable

## Phase 3: Testing and Validation

### 3.1 Write Exploratory Bug Condition Tests
- [ ] Create test products with `is_active = false` in test database
- [ ] Write test to verify `/products` endpoint includes inactive products after fix
- [ ] Write test to verify mobile app displays inactive products with "Coming Soon" styling
- [ ] Write test to verify inactive products are positioned after active products
- [ ] Run tests on unfixed code to confirm they fail (demonstrating the bug)

### 3.2 Write Fix Checking Tests
- [ ] Write property-based test: for all inactive products, verify "Coming Soon" styling is applied
- [ ] Write property-based test: for all inactive products, verify navigation is prevented
- [ ] Write property-based test: for all inactive products, verify positioning after active products
- [ ] Write integration test: full flow from backend API to mobile app display for inactive products

### 3.3 Write Preservation Checking Tests
- [ ] Write property-based test: for all active products, verify display behavior is unchanged
- [ ] Write property-based test: for all active products, verify navigation behavior is unchanged
- [ ] Write property-based test: for all active products, verify cart functionality is unchanged
- [ ] Write test: verify admin `/products/all` endpoint behavior is unchanged
- [ ] Write test: verify category filtering works for both active and inactive products

### 3.4 Manual Testing Scenarios
- [ ] Test admin workflow: create inactive product → verify mobile app shows "Coming Soon"
- [ ] Test product lifecycle: toggle product active→inactive→active and verify mobile app updates
- [ ] Test category filtering with mixed active/inactive products
- [ ] Test edge case: all products inactive in a category
- [ ] Test edge case: no inactive products (ensure no regression)

## Phase 4: Documentation and Deployment

### 4.1 Update Documentation
- [ ] Document the new inactive product display behavior in user-facing documentation
- [ ] Update API documentation to reflect that `/products` now returns both active and inactive products
- [ ] Add code comments explaining the "Coming Soon" styling logic in mobile app

### 4.2 Deployment Preparation
- [ ] Verify all tests pass after implementation
- [ ] Test on staging environment with real product data
- [ ] Prepare rollback plan in case of issues
- [ ] Coordinate backend and mobile app deployment timing

## Acceptance Criteria

### Backend Changes
- ✅ `/products` endpoint returns both active and inactive products
- ✅ `is_active` field is included in all product responses
- ✅ Category filtering works for both active and inactive products
- ✅ Admin `/products/all` endpoint behavior unchanged
- ✅ No breaking changes to existing API contracts

### Mobile App Changes
- ✅ Inactive products display with blur effect and dark overlay
- ✅ "Coming Soon" text appears on inactive product cards
- ✅ Inactive products are positioned after active products in lists
- ✅ Inactive products are non-clickable (no navigation to detail screen)
- ✅ Active products display and behave exactly as before
- ✅ Category filtering includes both active and inactive products

### Quality Assurance
- ✅ All existing functionality for active products preserved
- ✅ No visual or behavioral regressions for active products
- ✅ Admin panel functionality unchanged
- ✅ Performance impact minimal (no additional API calls)
- ✅ Comprehensive test coverage for both fix and preservation scenarios

## Risk Mitigation

### Potential Risks
1. **Performance Impact**: Returning more products from API could affect load times
   - Mitigation: Monitor API response times and implement pagination if needed

2. **Mobile App Layout Issues**: Additional products might affect grid layout
   - Mitigation: Test with various product counts and screen sizes

3. **User Confusion**: Users might not understand "Coming Soon" products
   - Mitigation: Clear visual styling and consider adding explanatory text

4. **Admin Workflow Disruption**: Changes might affect admin product management
   - Mitigation: Thorough testing of admin panel functionality

### Rollback Plan
1. Revert backend filter change (restore `where('is_active', '==', true)`)
2. Deploy mobile app update that handles missing inactive products gracefully
3. Monitor for any data consistency issues
4. Communicate changes to admin users if needed