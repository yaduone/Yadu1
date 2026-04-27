# Image Upload Testing Guide

## Quick Diagnostics

### 1. Run Diagnostic Script
```bash
node tests/diagnose-upload.js
```

This will check:
- Firebase configuration
- Service account setup
- Storage bucket access
- Multer configuration
- File permissions
- Environment variables

### 2. Run Test Suite
```bash
# Install test dependencies if needed
npm install --save-dev jest supertest

# Run all image upload tests
npm test -- tests/image-upload.test.js

# Run specific test suite
npm test -- tests/image-upload.test.js -t "Direct uploadImages"

# Run with verbose output
npm test -- tests/image-upload.test.js --verbose
```

## Manual Testing with cURL

### Prerequisites
1. Get an admin JWT token:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

2. Create a test image:
```bash
# Create a minimal 1x1 pixel PNG
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

# Or use ImageMagick
convert -size 1x1 xc:red test.png

# Or use any existing image
```

### Test Cases

#### Test 1: Create Product with Single Image
```bash
TOKEN="your_admin_token_here"

curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Test Product" \
  -F "category=curd" \
  -F "unit=500g" \
  -F "price=150" \
  -F "description=Test product with image" \
  -F "images=@test.png"
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "product_id",
      "name": "Test Product",
      "category": "curd",
      "unit": "500g",
      "price": 150,
      "description": "Test product with image",
      "images": [
        "https://storage.googleapis.com/yadu1-821e8.firebasestorage.app/products/1234567890_abc123.png"
      ],
      "is_active": true,
      "created_at": "2026-04-27T10:30:00Z"
    }
  }
}
```

#### Test 2: Create Product with Multiple Images
```bash
TOKEN="your_admin_token_here"

curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Multi Image Product" \
  -F "category=paneer" \
  -F "unit=250g" \
  -F "price=200" \
  -F "images=@test.png" \
  -F "images=@test2.png" \
  -F "images=@test3.png"
```

#### Test 3: Create Product Without Images
```bash
TOKEN="your_admin_token_here"

curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=No Image Product" \
  -F "category=curd" \
  -F "unit=500g" \
  -F "price=150"
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "product_id",
      "images": []
    }
  }
}
```

#### Test 4: Update Product - Add Images
```bash
TOKEN="your_admin_token_here"
PRODUCT_ID="product_id_from_test_3"

curl -X PUT http://localhost:3000/api/products/$PRODUCT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -F "images=@test.png"
```

#### Test 5: Update Product - Replace All Images
```bash
TOKEN="your_admin_token_here"
PRODUCT_ID="product_id"

curl -X PUT http://localhost:3000/api/products/$PRODUCT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -F "replace_images=true" \
  -F "images=@new_image.png"
```

#### Test 6: Update Product - Remove Specific Images
```bash
TOKEN="your_admin_token_here"
PRODUCT_ID="product_id"
IMAGE_URL="https://storage.googleapis.com/yadu1-821e8.firebasestorage.app/products/1234567890_abc123.png"

curl -X PUT http://localhost:3000/api/products/$PRODUCT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -F "remove_images=[\"$IMAGE_URL\"]"
```

#### Test 7: Test File Size Limit (Should Fail)
```bash
TOKEN="your_admin_token_here"

# Create a 6MB file
dd if=/dev/zero of=large.bin bs=1M count=6

curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Large File Test" \
  -F "category=curd" \
  -F "unit=500g" \
  -F "price=150" \
  -F "images=@large.bin"
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Only JPG and PNG images are allowed"
}
```

#### Test 8: Test Invalid File Type (Should Fail)
```bash
TOKEN="your_admin_token_here"

echo "This is not an image" > test.txt

curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Invalid File Test" \
  -F "category=curd" \
  -F "unit=500g" \
  -F "price=150" \
  -F "images=@test.txt"
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Only JPG and PNG images are allowed"
}
```

## Troubleshooting

### Issue: 401 Unauthorized
**Cause:** Invalid or expired JWT token
**Solution:**
1. Get a fresh token from login endpoint
2. Verify token is passed in Authorization header
3. Check token expiration

### Issue: 400 Bad Request - Missing Fields
**Cause:** Required fields not provided
**Solution:**
1. Ensure name, category, unit, price are provided
2. Check field names match exactly
3. Verify price is a valid number

### Issue: 400 Bad Request - File Type Error
**Cause:** Uploaded file is not JPG or PNG
**Solution:**
1. Convert image to JPG or PNG format
2. Verify file extension is correct
3. Check file MIME type

### Issue: 413 Payload Too Large
**Cause:** File exceeds 5MB limit
**Solution:**
1. Compress image before upload
2. Reduce image dimensions
3. Use ImageMagick: `convert input.jpg -quality 85 output.jpg`

### Issue: 500 Internal Server Error
**Cause:** Firebase Storage error
**Solution:**
1. Run diagnostic script: `node tests/diagnose-upload.js`
2. Check backend logs for detailed error
3. Verify Firebase credentials
4. Check storage bucket permissions
5. Verify FIREBASE_STORAGE_BUCKET env var

### Issue: Images Upload But Don't Display
**Cause:** Images not made public or URL incorrect
**Solution:**
1. Verify images are in Firebase Storage Console
2. Check if images have public read permissions
3. Test URL directly in browser
4. Check CORS configuration

## Performance Testing

### Load Test - Upload 100 Images
```bash
TOKEN="your_admin_token_here"

for i in {1..100}; do
  curl -X POST http://localhost:3000/api/products \
    -H "Authorization: Bearer $TOKEN" \
    -F "name=Product $i" \
    -F "category=curd" \
    -F "unit=500g" \
    -F "price=150" \
    -F "images=@test.png" &
done
wait
```

### Concurrent Upload Test
```bash
TOKEN="your_admin_token_here"

# Upload same product 10 times concurrently
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/products \
    -H "Authorization: Bearer $TOKEN" \
    -F "name=Concurrent Test $i" \
    -F "category=curd" \
    -F "unit=500g" \
    -F "price=150" \
    -F "images=@test.png" &
done
wait
```

## Monitoring

### Check Firebase Storage Usage
```bash
# Using Firebase CLI
firebase storage:download gs://yadu1-821e8.firebasestorage.app/products

# Or check in Firebase Console
# Storage > Files > products/
```

### Monitor Backend Logs
```bash
# Watch logs in real-time
tail -f backend.log | grep -i "upload\|image\|storage"
```

### Check Firestore Products
```bash
# Using Firebase CLI
firebase firestore:get products

# Or check in Firebase Console
# Firestore > Collections > products
```

## Success Criteria

✅ All tests pass
✅ Images upload to Firebase Storage
✅ Images are publicly accessible
✅ URLs are returned in response
✅ Images display in admin panel
✅ Images display in mobile app
✅ File size validation works
✅ File type validation works
✅ Concurrent uploads work
✅ Image deletion works
✅ Image replacement works

## Next Steps

1. **If tests pass:** Images are uploading correctly. Check frontend implementation.
2. **If tests fail:** Review error messages and run diagnostic script.
3. **If performance is slow:** Check Firebase quota and network connectivity.
4. **If images don't display:** Verify CORS and public access permissions.
