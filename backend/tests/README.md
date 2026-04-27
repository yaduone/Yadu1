# Image Upload Testing & Diagnostics

This directory contains comprehensive testing and diagnostic tools for Firebase Storage image uploads.

## Quick Start

### 1. Run Diagnostics (Recommended First Step)
```bash
node tests/diagnose-upload.js
```

This will check:
- ✓ Firebase configuration
- ✓ Service account setup
- ✓ Storage bucket access
- ✓ Multer configuration
- ✓ File permissions
- ✓ Environment variables

### 2. Run Test Suite
```bash
npm test -- tests/image-upload.test.js
```

### 3. Manual Testing with cURL
See `UPLOAD_TEST_GUIDE.md` for detailed cURL examples.

## Files

### `diagnose-upload.js`
Automated diagnostic script that checks:
- Firebase Admin SDK initialization
- Firestore connectivity
- Storage bucket access
- Multer configuration
- Storage utility functions
- Product routes setup
- Frontend API configuration
- Environment variables

**Run:** `node tests/diagnose-upload.js`

### `image-upload.test.js`
Comprehensive Jest test suite covering:
- Direct `uploadImages()` function tests
- Direct `deleteImages()` function tests
- Product creation with images (API)
- Product updates with image management
- Error handling and edge cases
- Performance tests

**Run:** `npm test -- tests/image-upload.test.js`

### `UPLOAD_TEST_GUIDE.md`
Manual testing guide with:
- cURL command examples
- Test cases for all scenarios
- Troubleshooting guide
- Performance testing commands
- Success criteria

## Debug Endpoints (Development Only)

When running in development mode, the following debug endpoints are available:

### GET /api/debug/status
Check Firebase connectivity status
```bash
curl http://localhost:3000/api/debug/status
```

### GET /api/debug/storage
List files in Firebase Storage
```bash
curl http://localhost:3000/api/debug/storage?prefix=products/&limit=50
```

### GET /api/debug/products
List products with image information
```bash
curl http://localhost:3000/api/debug/products
```

### GET /api/debug/logs
Get upload operation logs
```bash
curl http://localhost:3000/api/debug/logs?lines=100
```

### DELETE /api/debug/logs
Clear upload logs
```bash
curl -X DELETE http://localhost:3000/api/debug/logs
```

### POST /api/debug/test-upload
Test upload functionality
```bash
curl -X POST http://localhost:3000/api/debug/test-upload
```

### GET /api/debug/verify-image/:productId
Verify product images exist in storage
```bash
curl http://localhost:3000/api/debug/verify-image/product_id_here
```

## Upload Debug Logging

The system now includes detailed logging for all upload operations. Logs are stored in `backend/logs/uploads.log`.

### Log Levels
- `UPLOAD` - Upload operation started
- `DELETE` - Delete operation started
- `SUCCESS` - Operation completed successfully
- `ERROR` - Operation failed

### View Logs
```bash
# Last 50 lines
tail -50 backend/logs/uploads.log

# Watch in real-time
tail -f backend/logs/uploads.log

# Search for errors
grep ERROR backend/logs/uploads.log

# Get via API
curl http://localhost:3000/api/debug/logs?lines=100
```

## Common Issues & Solutions

### Issue: "Only JPG and PNG images are allowed"
**Cause:** File type validation failed
**Solution:**
1. Verify file is actually JPG or PNG
2. Check file extension
3. Verify MIME type

### Issue: "File size exceeds limit"
**Cause:** File is larger than 5MB
**Solution:**
1. Compress image
2. Reduce dimensions
3. Use ImageMagick: `convert input.jpg -quality 85 output.jpg`

### Issue: Images upload but don't display
**Cause:** Images not public or URL incorrect
**Solution:**
1. Run: `curl http://localhost:3000/api/debug/verify-image/product_id`
2. Check if files exist in Firebase Storage
3. Verify public read permissions
4. Test URL directly in browser

### Issue: 500 Internal Server Error
**Cause:** Firebase Storage error
**Solution:**
1. Run diagnostic: `node tests/diagnose-upload.js`
2. Check backend logs: `tail -f backend/logs/uploads.log`
3. Verify Firebase credentials
4. Check storage bucket permissions

### Issue: 401 Unauthorized
**Cause:** Invalid JWT token
**Solution:**
1. Get fresh token from login endpoint
2. Verify token in Authorization header
3. Check token expiration

## Performance Benchmarks

Expected performance (on typical network):
- Single image upload: < 2 seconds
- 5 images upload: < 5 seconds
- 10 images upload: < 10 seconds

If uploads are slower:
1. Check network connectivity
2. Verify Firebase quota
3. Check backend CPU/memory
4. Review Firebase Storage metrics

## Testing Workflow

### For Developers
1. Run diagnostics: `node tests/diagnose-upload.js`
2. Run test suite: `npm test -- tests/image-upload.test.js`
3. Check logs: `curl http://localhost:3000/api/debug/logs`
4. Verify images: `curl http://localhost:3000/api/debug/verify-image/product_id`

### For QA/Testing
1. Follow `UPLOAD_TEST_GUIDE.md`
2. Test all cURL examples
3. Verify images display in admin panel
4. Verify images display in mobile app
5. Test concurrent uploads
6. Test file size limits

### For Production
1. Disable debug endpoints (set NODE_ENV=production)
2. Monitor upload logs
3. Set up alerts for upload failures
4. Regular backup of Firebase Storage
5. Monitor Firebase quota usage

## Environment Setup

### Required Environment Variables
```bash
FIREBASE_PROJECT_ID=yadu1-821e8
FIREBASE_STORAGE_BUCKET=yadu1-821e8.firebasestorage.app
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account-key.json
```

### Optional for Testing
```bash
TEST_ADMIN_TOKEN=your_test_token_here
NODE_ENV=development  # Enables debug endpoints
```

## Troubleshooting Checklist

- [ ] Run `node tests/diagnose-upload.js`
- [ ] Check `.env` file has all Firebase variables
- [ ] Verify service account file exists
- [ ] Check Firebase Console for bucket
- [ ] Verify service account has Storage permissions
- [ ] Check Firebase Storage Rules
- [ ] Test with `curl http://localhost:3000/api/debug/test-upload`
- [ ] Review logs: `tail -f backend/logs/uploads.log`
- [ ] Check network connectivity
- [ ] Verify file size < 5MB
- [ ] Verify file type is JPG or PNG

## Next Steps

1. **If diagnostics pass:** Run test suite
2. **If tests pass:** Check frontend implementation
3. **If tests fail:** Review error messages and logs
4. **If performance is slow:** Check Firebase metrics
5. **If images don't display:** Verify CORS and public access

## Support

For issues:
1. Check logs: `backend/logs/uploads.log`
2. Run diagnostics: `node tests/diagnose-upload.js`
3. Review error messages in test output
4. Check Firebase Console for quota/billing issues
5. Verify network connectivity to googleapis.com
