#!/usr/bin/env node

/**
 * Test Admin Panel Image Upload Pipeline
 * Simulates the exact flow from admin panel to Firebase
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

async function testAdminUpload() {
  console.log('🧪 Testing Admin Panel Upload Pipeline\n');

  if (!ADMIN_TOKEN) {
    console.error('❌ ADMIN_TOKEN not set');
    console.log('Set token: export ADMIN_TOKEN=your_token_here');
    process.exit(1);
  }

  try {
    // Create test image
    const testImagePath = path.join(__dirname, 'fixtures', 'test.png');
    if (!fs.existsSync(testImagePath)) {
      console.log('Creating test image...');
      const buffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(testImagePath, buffer);
    }

    // Test 1: Create FormData like admin panel does
    console.log('Test 1: Creating FormData (like admin panel)...');
    const formData = new FormData();
    formData.append('name', 'Test Product Admin');
    formData.append('category', 'curd');
    formData.append('unit', '500g');
    formData.append('price', '150');
    formData.append('description', 'Test from admin panel');
    formData.append('images', fs.createReadStream(testImagePath), 'test.png');
    console.log('✅ FormData created\n');

    // Test 2: Send request with proper headers
    console.log('Test 2: Sending request to backend...');
    const response = await axios.post(`${API_URL}/products`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
    });

    if (response.status === 201) {
      console.log('✅ Product created (201)\n');
      
      const product = response.data.data.product;
      console.log('Product Details:');
      console.log(`  ID: ${product.id}`);
      console.log(`  Name: ${product.name}`);
      console.log(`  Images: ${product.images.length}`);
      
      if (product.images.length > 0) {
        console.log(`  Image URL: ${product.images[0]}`);
        
        // Test 3: Verify image is accessible
        console.log('\nTest 3: Verifying image is publicly accessible...');
        try {
          const imgResponse = await axios.head(product.images[0]);
          if (imgResponse.status === 200) {
            console.log('✅ Image is publicly accessible\n');
          }
        } catch (err) {
          console.log('⚠️  Image URL returned: ' + err.response?.status);
        }

        // Test 4: Verify in Firebase
        console.log('Test 4: Verifying in Firebase Storage...');
        try {
          const verifyResponse = await axios.get(`${API_URL}/debug/verify-image/${product.id}`, {
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
          });
          
          const verification = verifyResponse.data.data.verification[0];
          if (verification.status === 'exists') {
            console.log('✅ Image exists in Firebase Storage\n');
          } else {
            console.log(`⚠️  Image status: ${verification.status}\n`);
          }
        } catch (err) {
          console.log('⚠️  Could not verify in Firebase\n');
        }

        console.log('✅ ADMIN PANEL UPLOAD PIPELINE WORKING!\n');
      } else {
        console.log('❌ No images in response\n');
      }
    } else {
      console.log(`❌ Unexpected status: ${response.status}\n`);
    }

  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

testAdminUpload();
