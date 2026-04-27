#!/usr/bin/env node

/**
 * Image Upload Diagnostic Script
 * Identifies issues preventing image uploads to Firebase Storage
 * 
 * Run: node tests/diagnose-upload.js
 */

const fs = require('fs');
const path = require('path');
const { bucket, admin, db } = require('../src/config/firebase');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log(`\n${colors.cyan}${'─'.repeat(70)}${colors.reset}`);
  log(title, 'cyan');
  console.log(`${colors.cyan}${'─'.repeat(70)}${colors.reset}\n`);
}

async function runDiagnostics() {
  log('🔍 Firebase Storage Image Upload Diagnostics\n', 'blue');

  // 1. Check Firebase Configuration
  section('1. Firebase Configuration');
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!projectId) {
      log('❌ FIREBASE_PROJECT_ID not set', 'red');
    } else {
      log(`✓ Project ID: ${projectId}`, 'green');
    }

    if (!storageBucket) {
      log('❌ FIREBASE_STORAGE_BUCKET not set', 'red');
    } else {
      log(`✓ Storage Bucket: ${storageBucket}`, 'green');
    }

    if (!serviceAccountPath) {
      log('⚠ FIREBASE_SERVICE_ACCOUNT_PATH not set (using default)', 'yellow');
    } else {
      log(`✓ Service Account Path: ${serviceAccountPath}`, 'green');
    }

    // Check if service account file exists
    const accountPath = path.resolve(__dirname, '../', serviceAccountPath || './service-account-key.json');
    if (fs.existsSync(accountPath)) {
      log(`✓ Service account file exists: ${accountPath}`, 'green');
    } else {
      log(`❌ Service account file not found: ${accountPath}`, 'red');
    }
  } catch (err) {
    log(`❌ Configuration check failed: ${err.message}`, 'red');
  }

  // 2. Check Firebase Admin SDK Initialization
  section('2. Firebase Admin SDK');
  try {
    if (!admin.apps || admin.apps.length === 0) {
      log('❌ Firebase Admin SDK not initialized', 'red');
    } else {
      log('✓ Firebase Admin SDK initialized', 'green');
      log(`  App name: ${admin.apps[0].name}`, 'green');
    }
  } catch (err) {
    log(`❌ Admin SDK check failed: ${err.message}`, 'red');
  }

  // 3. Check Firestore Connection
  section('3. Firestore Connection');
  try {
    const testDoc = await db.collection('_diagnostics').doc('test').get();
    log('✓ Firestore connection successful', 'green');
  } catch (err) {
    log(`❌ Firestore connection failed: ${err.message}`, 'red');
  }

  // 4. Check Storage Bucket Access
  section('4. Storage Bucket Access');
  try {
    const [files] = await bucket.getFiles({ maxResults: 1 });
    log('✓ Storage bucket accessible', 'green');
    log(`  Bucket name: ${bucket.name}`, 'green');
  } catch (err) {
    log(`❌ Storage bucket access failed: ${err.message}`, 'red');
    log('  Possible causes:', 'yellow');
    log('  - Service account lacks Storage permissions', 'yellow');
    log('  - Bucket name is incorrect', 'yellow');
    log('  - Firebase project is not properly configured', 'yellow');
  }

  // 5. Test Upload Capability
  section('5. Test Upload');
  try {
    const testFilename = `_diagnostics/test-${Date.now()}.txt`;
    const testFile = bucket.file(testFilename);
    
    await testFile.save('Test content', {
      metadata: { contentType: 'text/plain' },
    });
    
    log('✓ File upload successful', 'green');

    // Check if file is public
    try {
      await testFile.makePublic();
      log('✓ File made public successfully', 'green');
    } catch (err) {
      log(`⚠ Could not make file public: ${err.message}`, 'yellow');
    }

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${testFilename}`;
    log(`  Public URL: ${publicUrl}`, 'green');

    // Cleanup
    await testFile.delete();
    log('✓ Test file cleaned up', 'green');
  } catch (err) {
    log(`❌ Upload test failed: ${err.message}`, 'red');
    log('  Possible causes:', 'yellow');
    log('  - Service account lacks write permissions', 'yellow');
    log('  - Bucket storage rules deny writes', 'yellow');
    log('  - Network connectivity issue', 'yellow');
  }

  // 6. Check Multer Configuration
  section('6. Multer Configuration');
  try {
    const productRoutesPath = path.join(__dirname, '../src/modules/products/product.routes.js');
    const content = fs.readFileSync(productRoutesPath, 'utf8');
    
    if (content.includes('multer.memoryStorage()')) {
      log('✓ Multer memory storage configured', 'green');
    } else {
      log('⚠ Multer storage configuration unclear', 'yellow');
    }

    if (content.includes('5 * 1024 * 1024')) {
      log('✓ File size limit: 5 MB', 'green');
    } else {
      log('⚠ File size limit not found or different', 'yellow');
    }

    if (content.includes('.jpg') && content.includes('.png')) {
      log('✓ JPG and PNG file types allowed', 'green');
    } else {
      log('⚠ File type restrictions unclear', 'yellow');
    }
  } catch (err) {
    log(`⚠ Could not check Multer config: ${err.message}`, 'yellow');
  }

  // 7. Check Storage Utility
  section('7. Storage Utility Functions');
  try {
    const storageUtilPath = path.join(__dirname, '../src/utils/storage.js');
    const content = fs.readFileSync(storageUtilPath, 'utf8');
    
    if (content.includes('uploadImages')) {
      log('✓ uploadImages function exists', 'green');
    } else {
      log('❌ uploadImages function not found', 'red');
    }

    if (content.includes('deleteImages')) {
      log('✓ deleteImages function exists', 'green');
    } else {
      log('❌ deleteImages function not found', 'red');
    }

    if (content.includes('makePublic')) {
      log('✓ makePublic() called on uploaded files', 'green');
    } else {
      log('⚠ Files may not be made public', 'yellow');
    }

    if (content.includes('storage.googleapis.com')) {
      log('✓ Public URL generation configured', 'green');
    } else {
      log('⚠ Public URL generation unclear', 'yellow');
    }
  } catch (err) {
    log(`⚠ Could not check storage utility: ${err.message}`, 'yellow');
  }

  // 8. Check Product Routes
  section('8. Product Routes Configuration');
  try {
    const routesPath = path.join(__dirname, '../src/modules/products/product.routes.js');
    const content = fs.readFileSync(routesPath, 'utf8');
    
    if (content.includes('upload.array')) {
      log('✓ Multer array upload configured', 'green');
    } else {
      log('❌ Multer array upload not found', 'red');
    }

    if (content.includes('uploadImages')) {
      log('✓ uploadImages called in POST route', 'green');
    } else {
      log('❌ uploadImages not called', 'red');
    }

    if (content.includes('deleteImages')) {
      log('✓ deleteImages called for cleanup', 'green');
    } else {
      log('⚠ deleteImages not called', 'yellow');
    }
  } catch (err) {
    log(`⚠ Could not check product routes: ${err.message}`, 'yellow');
  }

  // 9. Check Frontend API Configuration
  section('9. Frontend API Configuration');
  try {
    const apiPath = path.join(__dirname, '../../admin-panel/src/services/api.js');
    if (fs.existsSync(apiPath)) {
      const content = fs.readFileSync(apiPath, 'utf8');
      
      if (content.includes('FormData')) {
        log('✓ FormData support available', 'green');
      } else {
        log('⚠ FormData not explicitly mentioned', 'yellow');
      }

      if (content.includes('multipart')) {
        log('✓ Multipart form handling configured', 'green');
      } else {
        log('⚠ Multipart form handling not explicit', 'yellow');
      }
    } else {
      log('⚠ Frontend API file not found', 'yellow');
    }
  } catch (err) {
    log(`⚠ Could not check frontend API: ${err.message}`, 'yellow');
  }

  // 10. Check Environment Variables
  section('10. Environment Variables');
  try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      
      const firebaseVars = lines.filter(l => l.includes('FIREBASE'));
      if (firebaseVars.length > 0) {
        log(`✓ Found ${firebaseVars.length} Firebase environment variables`, 'green');
        firebaseVars.forEach(v => {
          const [key] = v.split('=');
          log(`  - ${key}`, 'green');
        });
      } else {
        log('❌ No Firebase environment variables found', 'red');
      }
    } else {
      log('❌ .env file not found', 'red');
    }
  } catch (err) {
    log(`⚠ Could not check .env: ${err.message}`, 'yellow');
  }

  // Summary
  section('Summary & Recommendations');
  log('Common issues preventing image uploads:\n', 'blue');
  log('1. Service Account Permissions', 'yellow');
  log('   → Ensure service account has "Storage Object Creator" role', 'cyan');
  log('   → Check Firebase Console > IAM & Admin > Service Accounts\n', 'cyan');

  log('2. Storage Bucket Rules', 'yellow');
  log('   → Verify Firebase Storage Rules allow writes', 'cyan');
  log('   → Check Firebase Console > Storage > Rules\n', 'cyan');

  log('3. CORS Configuration', 'yellow');
  log('   → If uploading from browser, configure CORS', 'cyan');
  log('   → Use gsutil cors set command or Firebase Console\n', 'cyan');

  log('4. File Size Limits', 'yellow');
  log('   → Check multer fileSize limit (currently 5MB)', 'cyan');
  log('   → Verify client-side file validation\n', 'cyan');

  log('5. Network Issues', 'yellow');
  log('   → Check internet connectivity', 'cyan');
  log('   → Verify firewall/proxy not blocking googleapis.com\n', 'cyan');

  log('6. Firebase Configuration', 'yellow');
  log('   → Verify FIREBASE_PROJECT_ID matches bucket', 'cyan');
  log('   → Ensure FIREBASE_STORAGE_BUCKET is correct\n', 'cyan');

  log('Next steps:', 'blue');
  log('1. Run: npm test -- tests/image-upload.test.js', 'cyan');
  log('2. Check backend logs for detailed error messages', 'cyan');
  log('3. Verify Firebase Console for any quota/billing issues', 'cyan');
  log('4. Test with curl: curl -X POST http://localhost:3000/api/products -F "images=@test.jpg"', 'cyan');
}

// Run diagnostics
runDiagnostics().catch(err => {
  log(`\n❌ Diagnostic failed: ${err.message}`, 'red');
  process.exit(1);
});
