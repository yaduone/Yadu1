#!/bin/bash

# Quick Image Upload Test Script
# Tests Firebase Storage image upload functionality
# Usage: bash tests/quick-test.sh

set -e

echo "🔍 Image Upload Quick Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3000/api}"
TEST_DIR="./tests/fixtures"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

# Create test fixtures directory
mkdir -p "$TEST_DIR"

# Function to create test image
create_test_image() {
  local filename=$1
  local format=$2
  
  if [ "$format" = "png" ]; then
    # Create minimal PNG using Python
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
with open('$filename', 'wb') as f:
    f.write(png_data)
" 2>/dev/null || echo "Failed to create PNG"
  elif [ "$format" = "jpg" ]; then
    # Create minimal JPEG
    printf '\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9' > "$filename"
  fi
}

# Function to print status
print_status() {
  local status=$1
  local message=$2
  
  if [ "$status" = "pass" ]; then
    echo -e "${GREEN}✓${NC} $message"
  elif [ "$status" = "fail" ]; then
    echo -e "${RED}✗${NC} $message"
  elif [ "$status" = "info" ]; then
    echo -e "${BLUE}ℹ${NC} $message"
  elif [ "$status" = "warn" ]; then
    echo -e "${YELLOW}⚠${NC} $message"
  fi
}

# Step 1: Check prerequisites
echo ""
echo -e "${BLUE}Step 1: Checking Prerequisites${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v curl &> /dev/null; then
  print_status "fail" "curl not found"
  exit 1
fi
print_status "pass" "curl is available"

if ! command -v python3 &> /dev/null; then
  print_status "warn" "python3 not found (needed for image creation)"
fi

# Step 2: Check API connectivity
echo ""
echo -e "${BLUE}Step 2: Checking API Connectivity${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s "$API_URL/health" > /dev/null 2>&1; then
  print_status "pass" "API is running at $API_URL"
else
  print_status "fail" "Cannot reach API at $API_URL"
  print_status "info" "Make sure backend is running: npm start"
  exit 1
fi

# Step 3: Check Firebase connectivity
echo ""
echo -e "${BLUE}Step 3: Checking Firebase Connectivity${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FIREBASE_STATUS=$(curl -s "$API_URL/debug/status" 2>/dev/null || echo "{}")

if echo "$FIREBASE_STATUS" | grep -q '"initialized":true'; then
  print_status "pass" "Firebase Admin SDK initialized"
else
  print_status "warn" "Firebase Admin SDK status unclear"
fi

if echo "$FIREBASE_STATUS" | grep -q '"connected":true' | head -1; then
  print_status "pass" "Firestore connected"
else
  print_status "warn" "Firestore connection unclear"
fi

# Step 4: Create test images
echo ""
echo -e "${BLUE}Step 4: Creating Test Images${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

create_test_image "$TEST_DIR/test.png" "png"
if [ -f "$TEST_DIR/test.png" ]; then
  print_status "pass" "Created test.png"
else
  print_status "fail" "Failed to create test.png"
fi

create_test_image "$TEST_DIR/test.jpg" "jpg"
if [ -f "$TEST_DIR/test.jpg" ]; then
  print_status "pass" "Created test.jpg"
else
  print_status "fail" "Failed to create test.jpg"
fi

# Step 5: Check admin token
echo ""
echo -e "${BLUE}Step 5: Checking Admin Token${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$ADMIN_TOKEN" ]; then
  print_status "warn" "ADMIN_TOKEN not set"
  print_status "info" "Set ADMIN_TOKEN environment variable to test API endpoints"
  print_status "info" "Example: export ADMIN_TOKEN=your_token_here"
  SKIP_API_TESTS=true
else
  print_status "pass" "ADMIN_TOKEN is set"
  SKIP_API_TESTS=false
fi

# Step 6: Test debug endpoints
echo ""
echo -e "${BLUE}Step 6: Testing Debug Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s "$API_URL/debug/status" > /dev/null 2>&1; then
  print_status "pass" "Debug endpoints available"
else
  print_status "warn" "Debug endpoints not available (production mode?)"
fi

# Step 7: Test upload (if token available)
echo ""
echo -e "${BLUE}Step 7: Testing Image Upload${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$SKIP_API_TESTS" = true ]; then
  print_status "warn" "Skipping API tests (no token)"
else
  UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/products" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -F "name=Test Product $(date +%s)" \
    -F "category=curd" \
    -F "unit=500g" \
    -F "price=150" \
    -F "images=@$TEST_DIR/test.png" 2>/dev/null || echo "{}")

  if echo "$UPLOAD_RESPONSE" | grep -q '"success":true'; then
    print_status "pass" "Product created successfully"
    
    # Extract product ID and image URL
    PRODUCT_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    IMAGE_URL=$(echo "$UPLOAD_RESPONSE" | grep -o '"https://storage.googleapis.com[^"]*"' | head -1 | tr -d '"')
    
    if [ -n "$PRODUCT_ID" ]; then
      print_status "pass" "Product ID: $PRODUCT_ID"
    fi
    
    if [ -n "$IMAGE_URL" ]; then
      print_status "pass" "Image URL: $IMAGE_URL"
      
      # Test if image is accessible
      if curl -s -I "$IMAGE_URL" | grep -q "200"; then
        print_status "pass" "Image is publicly accessible"
      else
        print_status "warn" "Image URL returned non-200 status"
      fi
    fi
  else
    print_status "fail" "Product creation failed"
    print_status "info" "Response: $UPLOAD_RESPONSE"
  fi
fi

# Step 8: Summary
echo ""
echo -e "${BLUE}Step 8: Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

print_status "info" "Quick test complete!"
echo ""
echo "Next steps:"
echo "1. Run full diagnostics: node tests/diagnose-upload.js"
echo "2. Run test suite: npm test -- tests/image-upload.test.js"
echo "3. Check logs: tail -f backend/logs/uploads.log"
echo "4. View debug info: curl http://localhost:3000/api/debug/status"
echo ""
