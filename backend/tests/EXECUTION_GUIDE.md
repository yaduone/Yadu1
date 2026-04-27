# Image Upload Testing - Execution Guide

## Quick Start (5 minutes)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Run Diagnostics
```bash
npm run diagnose
```

This will check all Firebase configuration and identify any issues.

### 3. Run Quick Test
```bash
npm run test:quick
```

Or with admin token:
```bash
ADMIN_TOKEN=your_token_here npm run test:quick
```

## Full Testing (15 minutes)

### 1. Setup Test Environment
```bash
cd backend

# Install dependencies if not already done
npm install

# Ensure backend is running
npm start
# In another terminal, continue with tests
```

### 2. Run Diagnostics
```bash
npm run diagnose
```

**Expected Output:**
- ✓ Firebase configuration found
- ✓ Service account file exists
- ✓ Firestore connection successful
- ✓ Storage bucket accessible
- ✓ File upload successful
- ✓ Multer configuration correct

### 3. Run Test Suite
```bash
npm run test:upload
```

**Expected Output:**
```
PASS  tests/image-upload.test.js
  Image Upload - Firebase Storage Integration
    Direct uploadImages() Function
      ✓ should upload single JPG image and return public URL (1234ms)
      ✓ should upload single PNG image and return public URL (1567ms)
      ✓ should upload multiple images and return array of URLs (2345ms)
      ✓ should make uploaded files publicly readable (1234ms)
      ✓ should generate unique filenames for same image uploaded twice (2456ms)
      ✓ should handle empty file array gracefully (12ms)
    Direct deleteImages() Function
      ✓ should delete uploaded image from storage (1234ms)
      ✓ should handle deletion of non-existent files gracefully (234ms)
      ✓ should delete multiple images (2345ms)
    ...
```

### 4. Check Logs
```bash
# View recent logs
tail -50 backend/logs/uploads.log

# Watch logs in real-time
tail -f backend/logs/uploads.log

# Search for errors
grep ERROR backend/logs/uploads.log
```

### 5. Manual Testing with cURL
```bash
# Get admin token (replace with actual credentials)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Create test image
python3 -c "
import struct
png_data = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
])
with open('test.png', 'wb') as f:
    f.write(png_data)
"

# Test upload
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Test Product" \
  -F "category=curd" \
  -F "unit=500g" \
  -F "price=150" \
  -F "images=@test.png"
```

## Troubleshooting

### Issue: "Cannot find module 'jest'"
**Solution:**
```bash
npm install --save-dev jest supertest
```

### Issue: "FIREBASE_PROJECT_ID not set"
**Solution:**
```bash
# Check .env file
cat backend/.env

# Should contain:
# FIREBASE_PROJECT_ID=yadu1-821e8
# FIREBASE_STORAGE_BUCKET=yadu1-821e8.firebasestorage.app
```

### Issue: "Service account file not found"
**Solution:**
```bash
# Verify service account file exists
ls -la backend/service-account-key.json

# If missing, download from Firebase Console:
# 1. Go to Firebase Console
# 2. Project Settings > Service Accounts
# 3. Generate new private key
# 4. Save as backend/service-account-key.json
```

### Issue: "Cannot reach API at http://localhost:3000/api"
**Solution:**
```bash
# Start backend server
cd backend
npm start

# In another terminal, run tests
npm run test:quick
```

### Issue: "401 Unauthorized" in API tests
**Solution:**
```bash
# Set admin token
export ADMIN_TOKEN=your_token_here

# Or get token from login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

## Debug Endpoints

### Check Firebase Status
```bash
curl http://localhost:3000/api/debug/status
```

### List Files in Storage
```bash
curl http://localhost:3000/api/debug/storage?prefix=products/&limit=50
```

### List Products with Images
```bash
curl http://localhost:3000/api/debug/products
```

### View Upload Logs
```bash
curl http://localhost:3000/api/debug/logs?lines=100
```

### Test Upload Capability
```bash
curl -X POST http://localhost:3000/api/debug/test-upload
```

### Verify Product Images
```bash
curl http://localhost:3000/api/debug/verify-image/product_id_here
```

## Performance Testing

### Load Test - 10 Concurrent Uploads
```bash
TOKEN=your_token_here

for i in {1..10}; do
  curl -X POST http://localhost:3000/api/products \
    -H "Authorization: Bearer $TOKEN" \
    -F "name=Product $i" \
    -F "category=curd" \
    -F "unit=500g" \
    -F "price=150" \
    -F "images=@test.png" &
done
wait

echo "All uploads complete"
```

### Measure Upload Time
```bash
TOKEN=your_token_here

time curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Timed Product" \
  -F "category=curd" \
  -F "unit=500g" \
  -F "price=150" \
  -F "images=@test.png"
```

## Monitoring

### Watch Logs in Real-Time
```bash
tail -f backend/logs/uploads.log
```

### Count Successful Uploads
```bash
grep "SUCCESS" backend/logs/uploads.log | wc -l
```

### Count Failed Uploads
```bash
grep "ERROR" backend/logs/uploads.log | wc -l
```

### View Recent Errors
```bash
grep "ERROR" backend/logs/uploads.log | tail -10
```

## Complete Testing Workflow

### Step 1: Prepare Environment
```bash
cd backend
npm install
npm start  # In one terminal
```

### Step 2: Run Diagnostics (In another terminal)
```bash
cd backend
npm run diagnose
```

### Step 3: Run Quick Test
```bash
npm run test:quick
```

### Step 4: Run Full Test Suite
```bash
npm run test:upload
```

### Step 5: Manual Testing
```bash
# Follow cURL examples above
```

### Step 6: Check Results
```bash
# View logs
tail -f backend/logs/uploads.log

# Check debug endpoints
curl http://localhost:3000/api/debug/status
```

## Success Indicators

✅ Diagnostics pass all checks
✅ Test suite passes all tests
✅ Images upload to Firebase Storage
✅ Images are publicly accessible
✅ URLs returned in API response
✅ Logs show successful operations
✅ Debug endpoints return valid data
✅ Manual cURL tests succeed

## Next Steps

1. **If all tests pass:** Images are uploading correctly
   - Check frontend implementation
   - Verify images display in UI
   - Test in mobile app

2. **If tests fail:** Review error messages
   - Check logs: `tail -f backend/logs/uploads.log`
   - Run diagnostics: `npm run diagnose`
   - Verify Firebase credentials
   - Check storage bucket permissions

3. **If performance is slow:** Optimize
   - Check network connectivity
   - Verify Firebase quota
   - Monitor backend resources
   - Review Firebase Storage metrics

## Support

For issues:
1. Check logs: `backend/logs/uploads.log`
2. Run diagnostics: `npm run diagnose`
3. Review error messages
4. Check Firebase Console
5. Verify network connectivity

## Commands Reference

```bash
# Diagnostics
npm run diagnose

# Quick test
npm run test:quick

# Full test suite
npm run test:upload

# All tests
npm test

# View logs
tail -f backend/logs/uploads.log

# Check status
curl http://localhost:3000/api/debug/status

# Verify images
curl http://localhost:3000/api/debug/verify-image/product_id
```
