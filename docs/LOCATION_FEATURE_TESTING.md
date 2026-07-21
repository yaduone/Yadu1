# Location Feature Testing Guide

## Pre-Testing Setup

### Requirements
- [ ] Admin account with valid credentials
- [ ] Test user account in the system
- [ ] HTTPS connection (required for Geolocation API)
- [ ] Location permissions enabled in browser
- [ ] Mobile device OR desktop with location services

### Browser Compatibility
Test on at least 2 of these browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browser (iOS Safari/Chrome)

## 1. Location Recording Tests

### 1.1 Record New Location
**Steps:**
1. Login as admin
2. Navigate to Users page
3. Find a user without location
4. Click the green map pin icon
5. Click "Use Current Location"
6. Grant location permissions if prompted
7. Verify coordinates are displayed
8. Click "Preview in Google Maps"
9. Verify maps opens with correct location
10. Click "Save Location"
11. Verify success message

**Expected Results:**
- [ ] Modal opens cleanly
- [ ] Location permission prompt appears
- [ ] Coordinates captured (latitude/longitude shown)
- [ ] Preview link works
- [ ] Save operation succeeds
- [ ] Success message appears
- [ ] Modal state updates to show saved location
- [ ] Users page refreshes with location link

### 1.2 Update Existing Location
**Steps:**
1. Open location modal for user with existing location
2. Verify existing location is displayed
3. Click "Update Location"
4. Click "Use Current Location"
5. New coordinates captured
6. Click "Save Location"
7. Verify update succeeds

**Expected Results:**
- [ ] Existing location shown in green box
- [ ] Button says "Update Location"
- [ ] New coordinates replace old ones
- [ ] Timestamp updates
- [ ] Users page shows updated location

### 1.3 Delete Location
**Steps:**
1. Open location modal for user with location
2. Click the trash icon
3. Confirm deletion in browser prompt
4. Verify success message

**Expected Results:**
- [ ] Confirmation dialog appears
- [ ] Location deleted successfully
- [ ] Success message shown
- [ ] Users page updates (no location link)
- [ ] Record button reappears

### 1.4 Cancel Pending Location
**Steps:**
1. Open location modal
2. Click "Use Current Location"
3. After capture, click "Cancel" instead of "Save"
4. Verify location is discarded

**Expected Results:**
- [ ] Captured location discarded
- [ ] Returns to initial state
- [ ] Can capture new location
- [ ] No data saved

## 2. Permission Handling Tests

### 2.1 Location Permission Denied
**Steps:**
1. Block location permissions in browser
2. Open location modal
3. Click "Use Current Location"
4. Read error message

**Expected Results:**
- [ ] Clear error message about permissions
- [ ] Instructions to enable permissions
- [ ] No crash or freeze
- [ ] Can retry after enabling permissions

### 2.2 Location Timeout
**Steps:**
1. Simulate poor GPS signal (if possible)
2. Or wait for timeout (15 seconds)
3. Observe error handling

**Expected Results:**
- [ ] Timeout error message appears
- [ ] Can retry
- [ ] No infinite loading state

### 2.3 Geolocation Not Supported
**Steps:**
1. Test on older browser (if available)
2. Or mock navigator.geolocation = undefined

**Expected Results:**
- [ ] Clear "not supported" message
- [ ] Graceful degradation
- [ ] Suggestion to use modern browser

## 3. UI/UX Tests

### 3.1 Users Page - Desktop
**Steps:**
1. Navigate to Users page on desktop
2. Scroll through user list
3. Find users with and without locations

**Expected Results:**
- [ ] Location column visible in table
- [ ] Blue "Location" links for users with coordinates
- [ ] Map pin button for users without location
- [ ] Links open Google Maps in new tab
- [ ] Map pin icon button opens modal

### 3.2 Users Page - Mobile
**Steps:**
1. Navigate to Users page on mobile/narrow viewport
2. View user cards

**Expected Results:**
- [ ] Location links visible in cards
- [ ] Green map pin button accessible
- [ ] Touch targets large enough
- [ ] Modal responsive on small screens

### 3.3 Orders Page
**Steps:**
1. Navigate to Orders page
2. View orders with user locations
3. Click location links

**Expected Results:**
- [ ] Location links appear in customer blocks
- [ ] Links work correctly
- [ ] Icons properly sized
- [ ] No layout issues

### 3.4 Manifest PDFs
**Steps:**
1. Generate/download a manifest
2. Open PDF
3. Find orders with locations
4. Click location links in PDF

**Expected Results:**
- [ ] Location links present in PDF
- [ ] Links are clickable
- [ ] Links open Google Maps
- [ ] Coordinates properly formatted

## 4. Data Validation Tests

### 4.1 Invalid Coordinates - Frontend
**Steps:**
1. (Developer test) Mock invalid coordinates
2. Try to save

**Expected Results:**
- [ ] Frontend validates before sending
- [ ] Error message displayed
- [ ] No invalid data sent to backend

### 4.2 Invalid Coordinates - Backend
**Steps:**
1. Send API request with invalid data:
   - Latitude > 90 or < -90
   - Longitude > 180 or < -180
   - Non-numeric values
   - Missing fields

**Expected Results:**
- [ ] 400 Bad Request returned
- [ ] Clear error message
- [ ] No invalid data stored
- [ ] Database remains consistent

### 4.3 Coordinate Precision
**Steps:**
1. Record location
2. Check precision in database
3. Verify display formatting

**Expected Results:**
- [ ] Stored with full precision
- [ ] Displayed with 6 decimal places
- [ ] Google Maps link uses full precision
- [ ] No rounding errors

## 5. Security Tests

### 5.1 Area-Based Access Control
**Steps:**
1. Login as admin for Area A
2. Try to record location for user in Area B
3. Check API response

**Expected Results:**
- [ ] 403 Forbidden error
- [ ] Cannot update other area's users
- [ ] Clear error message
- [ ] Activity not logged

### 5.2 Authentication Required
**Steps:**
1. Logout or use invalid token
2. Try to access location endpoints
3. Check API response

**Expected Results:**
- [ ] 401 Unauthorized error
- [ ] Redirected to login
- [ ] No data exposed
- [ ] No operations performed

### 5.3 Super Admin Override
**Steps:**
1. Login as super_admin
2. Try to update user in different area
3. Verify access granted

**Expected Results:**
- [ ] Super admin can access all areas
- [ ] Operation succeeds
- [ ] Activity logged correctly

## 6. Activity Logging Tests

### 6.1 Location Recorded
**Steps:**
1. Record a new location
2. Check activity logs (admin panel or database)

**Expected Results:**
- [ ] Log entry created
- [ ] Correct admin ID recorded
- [ ] Timestamp accurate
- [ ] Coordinates logged in metadata

### 6.2 Location Removed
**Steps:**
1. Delete a location
2. Check activity logs

**Expected Results:**
- [ ] Deletion logged
- [ ] Admin ID recorded
- [ ] Timestamp accurate

## 7. Performance Tests

### 7.1 Location Capture Speed
**Steps:**
1. Time from "Use Current Location" to display
2. Test on mobile and desktop
3. Test in different locations

**Expected Results:**
- [ ] < 5 seconds in good conditions
- [ ] Progress indicator shown
- [ ] No UI freeze
- [ ] Smooth experience

### 7.2 Page Load with Locations
**Steps:**
1. Load Users page with 100+ users
2. Many with locations
3. Check rendering performance

**Expected Results:**
- [ ] Page loads normally
- [ ] No noticeable lag
- [ ] Location links render efficiently
- [ ] Smooth scrolling

### 7.3 API Response Times
**Steps:**
1. Monitor network tab
2. Record location
3. Load users list
4. Load orders list

**Expected Results:**
- [ ] POST /location < 500ms
- [ ] GET /users includes locations without slowdown
- [ ] Orders API includes locations efficiently

## 8. Edge Cases

### 8.1 Rapid Succession
**Steps:**
1. Record location
2. Immediately click update
3. Record again quickly
4. Save

**Expected Results:**
- [ ] No race conditions
- [ ] Latest location saved
- [ ] No duplicate logs
- [ ] No errors

### 8.2 Network Interruption
**Steps:**
1. Start recording location
2. Disconnect network
3. Try to save
4. Observe error handling

**Expected Results:**
- [ ] Network error message
- [ ] Retry option available
- [ ] No data loss
- [ ] Can retry when online

### 8.3 Modal Close During Operation
**Steps:**
1. Click "Use Current Location"
2. Immediately close modal
3. Reopen modal

**Expected Results:**
- [ ] Operation cancelled cleanly
- [ ] No hanging state
- [ ] Modal reloads correctly
- [ ] Can start fresh

### 8.4 Concurrent Admin Updates
**Steps:**
1. Admin A opens location modal for User X
2. Admin B also opens modal for User X
3. Admin A saves location
4. Admin B saves different location
5. Check final state

**Expected Results:**
- [ ] Last write wins (expected behavior)
- [ ] Both operations logged
- [ ] No data corruption
- [ ] Both admins see final result

## 9. Integration Tests

### 9.1 End-to-End Flow
**Steps:**
1. Admin records user location
2. Location appears in Users page
3. Location appears in Orders page
4. Location appears in generated manifest PDF
5. All links open correct location

**Expected Results:**
- [ ] Seamless flow through all pages
- [ ] Consistent data everywhere
- [ ] All links functional
- [ ] Professional appearance

### 9.2 User List Refresh
**Steps:**
1. Record location in modal
2. Close modal
3. Verify Users page updated

**Expected Results:**
- [ ] Page data refreshed
- [ ] New location visible
- [ ] No manual refresh needed

## 10. Regression Tests

### 10.1 Existing Functionality
**Steps:**
1. Test all other Users page features
2. Test Orders page features
3. Test Manifest generation

**Expected Results:**
- [ ] No existing features broken
- [ ] All buttons still work
- [ ] Cart modal still works
- [ ] Calendar modal still works
- [ ] Delete user still works

### 10.2 Mobile Responsiveness
**Steps:**
1. Test on various screen sizes
2. Portrait and landscape
3. Check all breakpoints

**Expected Results:**
- [ ] All layouts responsive
- [ ] No horizontal scroll
- [ ] Buttons accessible
- [ ] Text readable

## Bug Tracking

### Found Issues
| # | Description | Severity | Status | Notes |
|---|-------------|----------|--------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### Test Summary
- **Total Tests:** 50+
- **Passed:** ___
- **Failed:** ___
- **Blocked:** ___
- **Not Tested:** ___

## Sign-off

**Tested By:** ________________  
**Date:** ________________  
**Environment:** Production / Staging / Development  
**Build Version:** ________________  

**Overall Status:** ☐ Pass ☐ Fail ☐ Pass with Issues  

**Notes:**
_______________________________________
_______________________________________
_______________________________________
