/**
 * Comprehensive Subscription Flow Testing Script
 * 
 * Tests the complete subscription lifecycle:
 * 1. Create a user (Firebase token verification)
 * 2. Complete user profile
 * 3. Start a subscription
 * 4. Skip a delivery for tomorrow
 * 5. Pause the subscription
 * 6. Resume the subscription
 * 7. Cancel the subscription
 * 
 * Usage:
 * - For production API: node test-subscription-flow.js production
 * - For local API: node test-subscription-flow.js local
 */

const axios = require('axios');

// Configuration
const PRODUCTION_URL = 'https://your-production-api.com'; // Update with actual production URL
const LOCAL_URL = 'http://localhost:3000';

// Test user data
const TEST_USER = {
  // You need a valid Firebase ID token for this test
  // Generate one from Firebase Console or your client app
  firebase_token: 'YOUR_FIREBASE_TOKEN_HERE',
  phone: '+919876543210',
  name: 'Test User',
  area_id: 'test-area-id', // Replace with a valid area_id from your Firestore
  address: {
    line1: '123 Test Street',
    line2: 'Test Apartment',
    city: 'Test City',
    state: 'Test State',
    pincode: '123456'
  }
};

const TEST_SUBSCRIPTION = {
  milk_type: 'cow',
  quantity_litres: 1.0,
  start_date: new Date().toISOString().split('T')[0], // Today
  delivery_slot: 'morning'
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class SubscriptionFlowTester {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.authToken = null;
    this.userId = null;
    this.subscriptionId = null;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      steps: []
    };
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  logStep(step, status, details = '') {
    const statusColor = status === 'PASS' ? colors.green : status === 'FAIL' ? colors.red : colors.yellow;
    this.log(`\n${'='.repeat(80)}`, colors.cyan);
    this.log(`STEP: ${step}`, colors.bright);
    this.log(`STATUS: ${status}`, statusColor);
    if (details) {
      this.log(`DETAILS: ${details}`, colors.reset);
    }
    this.log('='.repeat(80), colors.cyan);
  }

  recordResult(step, passed, details = '', data = null) {
    this.results.total++;
    if (passed) {
      this.results.passed++;
      this.logStep(step, 'PASS', details);
    } else {
      this.results.failed++;
      this.logStep(step, 'FAIL', details);
    }
    this.results.steps.push({ step, passed, details, data });
  }

  async makeRequest(method, endpoint, data = null, token = null) {
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {}
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await axios(config);
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  async step1_CreateUser() {
    this.log('\n📝 Step 1: Creating User (Verify Firebase Token)', colors.blue);
    
    const result = await this.makeRequest('POST', '/api/auth/user/verify', {
      firebase_token: TEST_USER.firebase_token
    });

    if (result.success && result.data.data) {
      this.userId = result.data.data.user.id;
      this.authToken = TEST_USER.firebase_token; // In real scenario, this would be the token
      this.recordResult(
        'Create User',
        true,
        `User created with ID: ${this.userId}`,
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Create User',
        false,
        `Failed to create user: ${JSON.stringify(result.error)}`,
        result
      );
      return false;
    }
  }

  async step2_CompleteProfile() {
    this.log('\n👤 Step 2: Completing User Profile', colors.blue);

    const result = await this.makeRequest(
      'POST',
      '/api/auth/user/complete-profile',
      {
        name: TEST_USER.name,
        area_id: TEST_USER.area_id,
        address: TEST_USER.address
      },
      this.authToken
    );

    if (result.success && result.data.success) {
      this.recordResult(
        'Complete Profile',
        true,
        `Profile completed for user: ${TEST_USER.name}`,
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Complete Profile',
        false,
        `Failed to complete profile: ${JSON.stringify(result.error)}`,
        result
      );
      return false;
    }
  }

  async step3_StartSubscription() {
    this.log('\n🥛 Step 3: Starting Subscription', colors.blue);

    const result = await this.makeRequest(
      'POST',
      '/api/subscriptions',
      TEST_SUBSCRIPTION,
      this.authToken
    );

    if (result.success && result.data.data?.subscription) {
      this.subscriptionId = result.data.data.subscription.id;
      this.recordResult(
        'Start Subscription',
        true,
        `Subscription created with ID: ${this.subscriptionId}, Type: ${TEST_SUBSCRIPTION.milk_type}, Quantity: ${TEST_SUBSCRIPTION.quantity_litres}L`,
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Start Subscription',
        false,
        `Failed to start subscription: ${JSON.stringify(result.error)}`,
        result
      );
      return false;
    }
  }

  async step4_GetSubscriptionStatus() {
    this.log('\n📊 Step 4: Getting Subscription Status', colors.blue);

    const result = await this.makeRequest(
      'GET',
      '/api/subscriptions/active',
      null,
      this.authToken
    );

    if (result.success && result.data.data?.subscription) {
      const sub = result.data.data.subscription;
      this.recordResult(
        'Get Subscription Status',
        true,
        `Active subscription found: Status=${sub.status}, Type=${sub.milk_type}, Qty=${sub.quantity_litres}L`,
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Get Subscription Status',
        false,
        `Failed to get subscription status: ${JSON.stringify(result.error)}`,
        result
      );
      return false;
    }
  }

  async step5_SkipTomorrow() {
    this.log('\n⏭️  Step 5: Skipping Tomorrow\'s Delivery', colors.blue);

    const result = await this.makeRequest(
      'POST',
      '/api/tomorrow/skip',
      {},
      this.authToken
    );

    if (result.success && result.data.success) {
      this.recordResult(
        'Skip Tomorrow',
        true,
        `Tomorrow's delivery skipped successfully. Is skipped: ${result.data.data.is_skipped}`,
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Skip Tomorrow',
        false,
        `Failed to skip tomorrow: ${JSON.stringify(result.error)}`,
        result
      );
      return false;
    }
  }

  async step6_GetTomorrowStatus() {
    this.log('\n📅 Step 6: Checking Tomorrow\'s Status', colors.blue);

    const result = await this.makeRequest(
      'GET',
      '/api/tomorrow/status',
      null,
      this.authToken
    );

    if (result.success && result.data.data) {
      const status = result.data.data;
      this.recordResult(
        'Get Tomorrow Status',
        true,
        `Tomorrow's status retrieved: Is skipped=${status.is_skipped}, Total amount=${status.total_amount}`,
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Get Tomorrow Status',
        false,
        `Failed to get tomorrow status: ${JSON.stringify(result.error)}`,
        result
      );
      return false;
    }
  }

  async step7_PauseSubscription() {
    this.log('\n⏸️  Step 7: Pausing Subscription', colors.blue);

    const result = await this.makeRequest(
      'PUT',
      `/api/subscriptions/${this.subscriptionId}/pause`,
      {},
      this.authToken
    );

    if (result.success && result.data.success) {
      this.recordResult(
        'Pause Subscription',
        true,
        `Subscription paused successfully. New status: ${result.data.data.status}`,
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Pause Subscription',
        false,
        `Failed to pause subscription: ${JSON.stringify(result.error)}`,
        result
      );
      return false;
    }
  }

  async step8_ResumeSubscription() {
    this.log('\n▶️  Step 8: Resuming Subscription', colors.blue);

    const result = await this.makeRequest(
      'PUT',
      `/api/subscriptions/${this.subscriptionId}/resume`,
      {},
      this.authToken
    );

    if (result.success && result.data.success) {
      this.recordResult(
        'Resume Subscription',
        true,
        `Subscription resumed successfully. New status: ${result.data.data.status}`,
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Resume Subscription',
        false,
        `Failed to resume subscription: ${JSON.stringify(result.error)}`,
        result
      );
      return false;
    }
  }

  async step9_CancelSubscription() {
    this.log('\n❌ Step 9: Cancelling Subscription', colors.blue);

    const result = await this.makeRequest(
      'PUT',
      `/api/subscriptions/${this.subscriptionId}/cancel`,
      {},
      this.authToken
    );

    if (result.success && result.data.success) {
      this.recordResult(
        'Cancel Subscription',
        true,
        `Subscription cancelled successfully. New status: ${result.data.data.status}`,
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Cancel Subscription',
        false,
        `Failed to cancel subscription: ${JSON.stringify(result.error)}`,
        result
      );
      return false;
    }
  }

  async step10_VerifyCancellation() {
    this.log('\n✅ Step 10: Verifying Cancellation', colors.blue);

    const result = await this.makeRequest(
      'GET',
      '/api/subscriptions/active',
      null,
      this.authToken
    );

    if (result.success && result.data.data?.subscription === null) {
      this.recordResult(
        'Verify Cancellation',
        true,
        'Confirmed: No active subscription found after cancellation',
        result.data
      );
      return true;
    } else if (result.success && result.data.data?.subscription?.status === 'cancelled') {
      this.recordResult(
        'Verify Cancellation',
        true,
        'Confirmed: Subscription status is cancelled',
        result.data
      );
      return true;
    } else {
      this.recordResult(
        'Verify Cancellation',
        false,
        `Unexpected state after cancellation: ${JSON.stringify(result.data)}`,
        result
      );
      return false;
    }
  }

  printSummary() {
    this.log('\n\n' + '='.repeat(80), colors.cyan);
    this.log('TEST SUMMARY', colors.bright);
    this.log('='.repeat(80), colors.cyan);
    this.log(`Total Tests: ${this.results.total}`, colors.blue);
    this.log(`Passed: ${this.results.passed}`, colors.green);
    this.log(`Failed: ${this.results.failed}`, colors.red);
    this.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(2)}%`, colors.magenta);
    this.log('='.repeat(80) + '\n', colors.cyan);

    if (this.results.failed > 0) {
      this.log('FAILED STEPS:', colors.red);
      this.results.steps
        .filter(s => !s.passed)
        .forEach(s => {
          this.log(`  ❌ ${s.step}: ${s.details}`, colors.red);
        });
      this.log('');
    }
  }

  async run() {
    this.log('\n\n' + '█'.repeat(80), colors.cyan);
    this.log('SUBSCRIPTION FLOW DRY RUN TEST', colors.bright);
    this.log(`Testing against: ${this.baseURL}`, colors.yellow);
    this.log('█'.repeat(80) + '\n', colors.cyan);

    try {
      // Run all steps in sequence
      const step1 = await this.step1_CreateUser();
      if (!step1) {
        this.log('\n⛔ Test aborted: User creation failed', colors.red);
        this.printSummary();
        return;
      }

      const step2 = await this.step2_CompleteProfile();
      if (!step2) {
        this.log('\n⛔ Test aborted: Profile completion failed', colors.red);
        this.printSummary();
        return;
      }

      const step3 = await this.step3_StartSubscription();
      if (!step3) {
        this.log('\n⛔ Test aborted: Subscription creation failed', colors.red);
        this.printSummary();
        return;
      }

      await this.step4_GetSubscriptionStatus();
      await this.step5_SkipTomorrow();
      await this.step6_GetTomorrowStatus();
      await this.step7_PauseSubscription();
      await this.step8_ResumeSubscription();
      await this.step9_CancelSubscription();
      await this.step10_VerifyCancellation();

      this.printSummary();

    } catch (error) {
      this.log(`\n💥 Unexpected error: ${error.message}`, colors.red);
      console.error(error);
    }
  }
}

// Main execution
async function main() {
  const mode = process.argv[2] || 'local';
  const baseURL = mode === 'production' ? PRODUCTION_URL : LOCAL_URL;

  console.log('\n⚠️  IMPORTANT SETUP INSTRUCTIONS:', colors.yellow);
  console.log('=' .repeat(80));
  console.log('Before running this test, you need to:');
  console.log('1. Update TEST_USER.firebase_token with a valid Firebase ID token');
  console.log('2. Update TEST_USER.area_id with a valid area_id from your Firestore');
  console.log('3. If testing production, update PRODUCTION_URL with your actual API URL');
  console.log('4. Ensure your backend server is running');
  console.log('=' .repeat(80) + '\n');

  const proceed = TEST_USER.firebase_token !== 'YOUR_FIREBASE_TOKEN_HERE';
  
  if (!proceed) {
    console.log('❌ Please update the TEST_USER configuration before running this test.\n');
    process.exit(1);
  }

  const tester = new SubscriptionFlowTester(baseURL);
  await tester.run();

  process.exit(tester.results.failed > 0 ? 1 : 0);
}

main();
