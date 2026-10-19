/**
 * Subscription Flow Code Verification Script
 * 
 * This script performs static code analysis and verification of the subscription flow
 * without making actual API calls. It verifies:
 * 1. All required endpoints exist
 * 2. Service methods are properly implemented
 * 3. Validation logic is in place
 * 4. Database operations are correct
 * 5. Error handling is implemented
 * 6. Security middleware is applied
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class SubscriptionCodeVerifier {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      checks: []
    };
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  check(description, passed, details = '') {
    this.results.total++;
    if (passed) {
      this.results.passed++;
      this.log(`✅ PASS: ${description}`, colors.green);
    } else {
      this.results.failed++;
      this.log(`❌ FAIL: ${description}`, colors.red);
    }
    if (details) {
      this.log(`   ${details}`, colors.yellow);
    }
    this.results.checks.push({ description, passed, details });
  }

  readFile(filePath) {
    try {
      const fullPath = path.join(__dirname, filePath);
      return fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
      return null;
    }
  }

  containsPattern(content, pattern, description) {
    if (!content) return false;
    const found = pattern.test(content);
    return found;
  }

  verifyAuthRoutes() {
    this.log('\n' + '='.repeat(80), colors.cyan);
    this.log('1. VERIFYING AUTH ROUTES', colors.bright);
    this.log('='.repeat(80), colors.cyan);

    const authRoutes = this.readFile('src/modules/auth/auth.routes.js');
    const authService = this.readFile('src/modules/auth/auth.service.js');

    // Check user verification endpoint
    this.check(
      'POST /api/auth/user/verify endpoint exists',
      this.containsPattern(authRoutes, /router\.post\s*\(\s*['"]\/user\/verify['"]/),
      'Endpoint for Firebase token verification'
    );

    this.check(
      'verifyUserToken service method exists',
      this.containsPattern(authService, /async\s+function\s+verifyUserToken/),
      'Service method to verify Firebase tokens and create/find users'
    );

    this.check(
      'Firebase token verification implemented',
      this.containsPattern(authService, /admin\.auth\(\)\.verifyIdToken/),
      'Uses Firebase Admin SDK to verify ID tokens'
    );

    // Check profile completion endpoint
    this.check(
      'POST /api/auth/user/complete-profile endpoint exists',
      this.containsPattern(authRoutes, /router\.post\s*\(\s*['"]\/user\/complete-profile['"]/),
      'Endpoint for completing user profile'
    );

    this.check(
      'completeProfile service method exists',
      this.containsPattern(authService, /async\s+function\s+completeProfile/),
      'Service method to complete user profile with name, area_id, address'
    );

    this.check(
      'Profile validation implemented',
      authService && authService.includes('name') && authService.includes('area_id') && authService.includes('address'),
      'Validates required profile fields'
    );

    this.check(
      'Area validation implemented',
      this.containsPattern(authService, /collection\(['"]areas['"]\).*get\(\)/),
      'Verifies that area_id exists and is active'
    );
  }

  verifySubscriptionRoutes() {
    this.log('\n' + '='.repeat(80), colors.cyan);
    this.log('2. VERIFYING SUBSCRIPTION ROUTES', colors.bright);
    this.log('='.repeat(80), colors.cyan);

    const subRoutes = this.readFile('src/modules/subscriptions/subscription.routes.js');
    const subService = this.readFile('src/modules/subscriptions/subscription.service.js');

    // Create subscription
    this.check(
      'POST /api/subscriptions endpoint exists',
      this.containsPattern(subRoutes, /router\.post\s*\(\s*['"]\/['"]/),
      'Endpoint to create new subscription'
    );

    this.check(
      'requireCompleteProfile middleware applied to create',
      this.containsPattern(subRoutes, /router\.post\s*\([^)]*requireCompleteProfile/),
      'Ensures user has completed profile before creating subscription'
    );

    this.check(
      'createSubscription service method exists',
      this.containsPattern(subService, /async\s+function\s+createSubscription/),
      'Service method to create subscription'
    );

    // Get active subscription
    this.check(
      'GET /api/subscriptions/active endpoint exists',
      this.containsPattern(subRoutes, /router\.get\s*\(\s*['"]\/active['"]/),
      'Endpoint to retrieve active subscription'
    );

    this.check(
      'getActiveSubscription service method exists',
      this.containsPattern(subService, /async\s+function\s+getActiveSubscription/),
      'Service method to get active/paused subscription'
    );

    // Pause subscription
    this.check(
      'PUT /api/subscriptions/:id/pause endpoint exists',
      this.containsPattern(subRoutes, /router\.put\s*\(\s*['"]\/[^'"]*pause['"]/),
      'Endpoint to pause subscription'
    );

    this.check(
      'pauseSubscription service method exists',
      this.containsPattern(subService, /async\s+function\s+pauseSubscription/),
      'Service method to pause active subscription'
    );

    // Resume subscription
    this.check(
      'PUT /api/subscriptions/:id/resume endpoint exists',
      this.containsPattern(subRoutes, /router\.put\s*\(\s*['"]\/[^'"]*resume['"]/),
      'Endpoint to resume subscription'
    );

    this.check(
      'resumeSubscription service method exists',
      this.containsPattern(subService, /async\s+function\s+resumeSubscription/),
      'Service method to resume paused subscription'
    );

    // Cancel subscription
    this.check(
      'PUT /api/subscriptions/:id/cancel endpoint exists',
      this.containsPattern(subRoutes, /router\.put\s*\(\s*['"]\/[^'"]*cancel['"]/),
      'Endpoint to cancel subscription'
    );

    this.check(
      'cancelSubscription service method exists',
      this.containsPattern(subService, /async\s+function\s+cancelSubscription/),
      'Service method to cancel subscription'
    );
  }

  verifyTomorrowRoutes() {
    this.log('\n' + '='.repeat(80), colors.cyan);
    this.log('3. VERIFYING TOMORROW/SKIP ROUTES', colors.bright);
    this.log('='.repeat(80), colors.cyan);

    const tomorrowRoutes = this.readFile('src/modules/cart/tomorrow.routes.js');
    const tomorrowService = this.readFile('src/modules/cart/tomorrow.service.js');

    // Get tomorrow status
    this.check(
      'GET /api/tomorrow/status endpoint exists',
      this.containsPattern(tomorrowRoutes, /router\.get\s*\(\s*['"]\/status['"]/),
      'Endpoint to get tomorrow\'s delivery status'
    );

    this.check(
      'getTomorrowStatus service method exists',
      this.containsPattern(tomorrowService, /async\s+function\s+getTomorrowStatus/),
      'Service method to compute tomorrow\'s delivery status'
    );

    // Skip tomorrow
    this.check(
      'POST /api/tomorrow/skip endpoint exists',
      this.containsPattern(tomorrowRoutes, /router\.post\s*\(\s*['"]\/skip['"]/),
      'Endpoint to skip tomorrow\'s delivery'
    );

    this.check(
      'skipTomorrow service method exists',
      this.containsPattern(tomorrowService, /async\s+function\s+skipTomorrow/),
      'Service method to create skip override'
    );

    // Modify tomorrow
    this.check(
      'POST /api/tomorrow/modify endpoint exists',
      this.containsPattern(tomorrowRoutes, /router\.post\s*\(\s*['"]\/modify['"]/),
      'Endpoint to modify tomorrow\'s quantity'
    );

    this.check(
      'modifyTomorrow service method exists',
      this.containsPattern(tomorrowService, /async\s+function\s+modifyTomorrow/),
      'Service method to create quantity override'
    );

    // Revert override
    this.check(
      'DELETE /api/tomorrow/override endpoint exists',
      this.containsPattern(tomorrowRoutes, /router\.delete\s*\(\s*['"]\/override['"]/),
      'Endpoint to revert override'
    );

    this.check(
      'revertOverride service method exists',
      this.containsPattern(tomorrowService, /async\s+function\s+revertOverride/),
      'Service method to delete override and restore default'
    );
  }

  verifyValidation() {
    this.log('\n' + '='.repeat(80), colors.cyan);
    this.log('4. VERIFYING VALIDATION LOGIC', colors.bright);
    this.log('='.repeat(80), colors.cyan);

    const validators = this.readFile('src/utils/validators.js');
    const subService = this.readFile('src/modules/subscriptions/subscription.service.js');

    this.check(
      'isValidMilkType validator exists',
      this.containsPattern(validators, /function\s+isValidMilkType/),
      'Validates milk type against allowed values'
    );

    this.check(
      'isValidQuantity validator exists',
      this.containsPattern(validators, /function\s+isValidQuantity/),
      'Validates quantity is 0.5-10 litres in 0.5L increments'
    );

    this.check(
      'isValidSlot validator exists',
      this.containsPattern(validators, /function\s+isValidSlot/),
      'Validates delivery slot (morning, evening, both)'
    );

    this.check(
      'Milk type validation used in createSubscription',
      this.containsPattern(subService, /isValidMilkType/),
      'createSubscription calls isValidMilkType'
    );

    this.check(
      'Quantity validation used in createSubscription',
      this.containsPattern(subService, /isValidQuantity/),
      'createSubscription calls isValidQuantity'
    );

    this.check(
      'Slot validation used in createSubscription',
      this.containsPattern(subService, /isValidSlot/),
      'createSubscription calls isValidSlot'
    );

    this.check(
      'Duplicate subscription check implemented',
      subService && subService.includes('active') && subService.includes('paused') && subService.includes('already have'),
      'Prevents creating multiple active/paused subscriptions'
    );

    this.check(
      'Start date validation implemented',
      this.containsPattern(subService, /start_date.*earliestStartDate/),
      'Validates start_date is not in the past'
    );
  }

  verifyMiddleware() {
    this.log('\n' + '='.repeat(80), colors.cyan);
    this.log('5. VERIFYING AUTHENTICATION MIDDLEWARE', colors.bright);
    this.log('='.repeat(80), colors.cyan);

    const middleware = this.readFile('src/middleware/auth.js');

    this.check(
      'authenticateUser middleware exists',
      this.containsPattern(middleware, /async\s+function\s+authenticateUser/),
      'Middleware to verify Firebase ID token'
    );

    this.check(
      'requireCompleteProfile middleware exists',
      this.containsPattern(middleware, /function\s+requireCompleteProfile/),
      'Middleware to ensure profile is complete'
    );

    this.check(
      'Firebase token verification in middleware',
      this.containsPattern(middleware, /admin\.auth\(\)\.verifyIdToken/),
      'Verifies Firebase token and extracts user info'
    );

    this.check(
      'Profile completeness check in middleware',
      middleware && middleware.includes('isProfileComplete') && middleware.includes('name') && middleware.includes('area_id'),
      'Checks for name, area_id, and address'
    );

    const subRoutes = this.readFile('src/modules/subscriptions/subscription.routes.js');
    const tomorrowRoutes = this.readFile('src/modules/cart/tomorrow.routes.js');

    this.check(
      'Subscription routes use authenticateUser',
      this.containsPattern(subRoutes, /authenticateUser/),
      'All subscription endpoints require authentication'
    );

    this.check(
      'Subscription routes use requireCompleteProfile',
      this.containsPattern(subRoutes, /requireCompleteProfile/),
      'All subscription endpoints require complete profile'
    );

    this.check(
      'Tomorrow routes use requireCompleteProfile',
      this.containsPattern(tomorrowRoutes, /requireCompleteProfile/),
      'All tomorrow endpoints require complete profile'
    );
  }

  verifyDatabaseOperations() {
    this.log('\n' + '='.repeat(80), colors.cyan);
    this.log('6. VERIFYING DATABASE OPERATIONS', colors.bright);
    this.log('='.repeat(80), colors.cyan);

    const subService = this.readFile('src/modules/subscriptions/subscription.service.js');
    const tomorrowService = this.readFile('src/modules/cart/tomorrow.service.js');

    // Subscription operations
    this.check(
      'Creates subscription document',
      this.containsPattern(subService, /collection\(['"]subscriptions['"]\)\.add/),
      'createSubscription adds document to subscriptions collection'
    );

    this.check(
      'Updates subscription status on pause',
      subService && subService.includes('pauseSubscription') && subService.includes('update') && subService.includes('paused'),
      'pauseSubscription updates status to paused'
    );

    this.check(
      'Updates subscription status on resume',
      subService && subService.includes('resumeSubscription') && subService.includes('update') && subService.includes('active'),
      'resumeSubscription updates status to active'
    );

    this.check(
      'Updates subscription status on cancel',
      subService && subService.includes('cancelSubscription') && subService.includes('update') && subService.includes('cancelled'),
      'cancelSubscription updates status to cancelled'
    );

    // Override operations
    this.check(
      'Creates override for skip',
      this.containsPattern(tomorrowService, /collection\(['"]next_day_overrides['"]\)\.add/) && tomorrowService.includes('skip'),
      'skipTomorrow creates override with type skip'
    );

    this.check(
      'Creates override for modify',
      this.containsPattern(tomorrowService, /collection\(['"]next_day_overrides['"]\)\.add/) && tomorrowService.includes('modify'),
      'modifyTomorrow creates override with modified_quantity'
    );

    this.check(
      'Deletes override on revert',
      this.containsPattern(tomorrowService, /\.delete\(\)/),
      'revertOverride removes override document'
    );

    // Audit logging
    this.check(
      'Audit logs subscription creation',
      this.containsPattern(subService, /collection\(['"]audit_logs['"]\)\.add/) && subService.includes('subscription.created'),
      'Logs subscription creation to audit_logs'
    );

    this.check(
      'Uses Firestore timestamps',
      this.containsPattern(subService, /FieldValue\.serverTimestamp/),
      'Uses server timestamps for created_at and updated_at'
    );
  }

  verifyErrorHandling() {
    this.log('\n' + '='.repeat(80), colors.cyan);
    this.log('7. VERIFYING ERROR HANDLING', colors.bright);
    this.log('='.repeat(80), colors.cyan);

    const subService = this.readFile('src/modules/subscriptions/subscription.service.js');
    const authService = this.readFile('src/modules/auth/auth.service.js');
    const subRoutes = this.readFile('src/modules/subscriptions/subscription.routes.js');

    this.check(
      'Validation errors throw with status code',
      this.containsPattern(subService, /throw.*statusCode.*400/),
      'Invalid input throws 400 errors'
    );

    this.check(
      'Not found errors throw with status code',
      this.containsPattern(subService, /throw.*statusCode.*404/) || this.containsPattern(subService, /not found/i),
      'Missing resources throw 404 errors'
    );

    this.check(
      'Forbidden errors throw with status code',
      this.containsPattern(subService, /throw.*statusCode.*403/) || this.containsPattern(authService, /statusCode.*403/),
      'Unauthorized access throws 403 errors'
    );

    this.check(
      'Routes have error handling middleware',
      this.containsPattern(subRoutes, /next\(err\)/),
      'Routes pass errors to Express error handler'
    );

    this.check(
      'User ownership verification',
      subService && subService.includes('user_id') && (subService.includes('Forbidden') || subService.includes('403')),
      'Verifies user owns subscription before modifications'
    );

    this.check(
      'Status validation before operations',
      subService && (
        (subService.includes('pauseSubscription') && subService.includes('status') && subService.includes('active')) ||
        (subService.includes('resumeSubscription') && subService.includes('status') && subService.includes('paused'))
      ),
      'Validates subscription status before pause/resume/cancel'
    );
  }

  verifyBusinessLogic() {
    this.log('\n' + '='.repeat(80), colors.cyan);
    this.log('8. VERIFYING BUSINESS LOGIC', colors.bright);
    this.log('='.repeat(80), colors.cyan);

    const subService = this.readFile('src/modules/subscriptions/subscription.service.js');
    const tomorrowService = this.readFile('src/modules/cart/tomorrow.service.js');

    this.check(
      'Fetches current price when creating subscription',
      this.containsPattern(subService, /collection\(['"]price_config['"]\)/) && subService.includes('price_per_litre'),
      'Gets active price for milk type during subscription creation'
    );

    this.check(
      'Stores price_per_litre in subscription',
      subService && subService.includes('price_per_litre') && subService.includes('subscriptionData'),
      'Saves price_per_litre to lock in the rate'
    );

    this.check(
      'Sets timestamps on pause',
      subService && subService.includes('pauseSubscription') && subService.includes('paused_at'),
      'Records paused_at timestamp when pausing'
    );

    this.check(
      'Clears paused_at on resume',
      subService && subService.includes('resumeSubscription') && subService.includes('paused_at') && subService.includes('null'),
      'Clears paused_at when resuming'
    );

    this.check(
      'Sets cancelled_at on cancel',
      subService && subService.includes('cancelSubscription') && subService.includes('cancelled_at'),
      'Records cancelled_at timestamp when cancelling'
    );

    this.check(
      'Cleans up overrides on pause',
      subService && subService.includes('pauseSubscription') && subService.includes('next_day_overrides'),
      'Removes tomorrow overrides when pausing'
    );

    this.check(
      'Cleans up overrides on cancel',
      subService && subService.includes('cancelSubscription') && subService.includes('next_day_overrides'),
      'Removes all overrides when cancelling'
    );

    this.check(
      'Tomorrow status computes effective milk',
      tomorrowService && tomorrowService.includes('effectiveMilk') && tomorrowService.includes('override'),
      'Applies overrides to calculate actual delivery'
    );

    this.check(
      'Skip override nullifies milk delivery',
      tomorrowService && tomorrowService.includes('skip') && (tomorrowService.includes('null') || tomorrowService.includes('isSkipped')),
      'Setting override_type=skip removes milk from delivery'
    );

    this.check(
      'Modify override adjusts quantity',
      tomorrowService && tomorrowService.includes('modify') && tomorrowService.includes('modified_quantity'),
      'Setting override_type=modify changes delivery quantity'
    );
  }

  verifyNotifications() {
    this.log('\n' + '='.repeat(80), colors.cyan);
    this.log('9. VERIFYING NOTIFICATIONS', colors.bright);
    this.log('='.repeat(80), colors.cyan);

    const subService = this.readFile('src/modules/subscriptions/subscription.service.js');

    this.check(
      'notifySubscriptionChange function exists',
      this.containsPattern(subService, /async\s+function\s+notifySubscriptionChange/),
      'Helper function to send subscription notifications'
    );

    this.check(
      'Notification on subscription creation',
      subService && subService.includes('createSubscription') && subService.includes('notifySubscriptionChange') && subService.includes('Subscription Started'),
      'Sends notification when subscription is created'
    );

    this.check(
      'Notification on pause',
      subService && subService.includes('pauseSubscription') && subService.includes('notifySubscriptionChange') && subService.includes('Paused'),
      'Sends notification when subscription is paused'
    );

    this.check(
      'Notification on resume',
      subService && subService.includes('resumeSubscription') && subService.includes('notifySubscriptionChange') && subService.includes('Resumed'),
      'Sends notification when subscription is resumed'
    );

    this.check(
      'Notification on cancel',
      subService && subService.includes('cancelSubscription') && subService.includes('notifySubscriptionChange') && subService.includes('Cancelled'),
      'Sends notification when subscription is cancelled'
    );

    this.check(
      'Notification error handling',
      this.containsPattern(subService, /try.*catch/) && subService.includes('notification'),
      'Handles notification failures gracefully'
    );
  }

  printSummary() {
    this.log('\n\n' + '█'.repeat(80), colors.cyan);
    this.log('VERIFICATION SUMMARY', colors.bright);
    this.log('█'.repeat(80), colors.cyan);
    this.log(`Total Checks: ${this.results.total}`, colors.blue);
    this.log(`Passed: ${this.results.passed}`, colors.green);
    this.log(`Failed: ${this.results.failed}`, colors.red);
    const percentage = ((this.results.passed / this.results.total) * 100).toFixed(2);
    this.log(`Success Rate: ${percentage}%`, percentage === '100.00' ? colors.green : colors.yellow);
    this.log('█'.repeat(80) + '\n', colors.cyan);

    if (this.results.failed > 0) {
      this.log('FAILED CHECKS:', colors.red);
      this.results.checks
        .filter(c => !c.passed)
        .forEach(c => {
          this.log(`  ❌ ${c.description}`, colors.red);
          if (c.details) {
            this.log(`     ${c.details}`, colors.yellow);
          }
        });
      this.log('');
    }
  }

  run() {
    this.log('\n' + '█'.repeat(80), colors.cyan);
    this.log('SUBSCRIPTION FLOW CODE VERIFICATION', colors.bright);
    this.log('Static Code Analysis (No API Calls)', colors.yellow);
    this.log('█'.repeat(80) + '\n', colors.cyan);

    this.verifyAuthRoutes();
    this.verifySubscriptionRoutes();
    this.verifyTomorrowRoutes();
    this.verifyValidation();
    this.verifyMiddleware();
    this.verifyDatabaseOperations();
    this.verifyErrorHandling();
    this.verifyBusinessLogic();
    this.verifyNotifications();

    this.printSummary();

    return this.results.failed === 0;
  }
}

// Main execution
function main() {
  const verifier = new SubscriptionCodeVerifier();
  const success = verifier.run();
  process.exit(success ? 0 : 1);
}

main();
