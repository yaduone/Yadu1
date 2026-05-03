const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');
const limit = require('./middleware/rateLimiter');
const config = require('./config');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const areaRoutes = require('./modules/areas/area.routes');
const productRoutes = require('./modules/products/product.routes');
const categoryRoutes = require('./modules/categories/category.routes');
const subscriptionRoutes = require('./modules/subscriptions/subscription.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const tomorrowRoutes = require('./modules/cart/tomorrow.routes');
const orderRoutes = require('./modules/orders/order.routes');
const manifestRoutes = require('./modules/manifests/manifest.routes');
const reportRoutes = require('./modules/reports/report.routes');
const livestreamRoutes = require('./modules/livestreams/livestream.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const priceRoutes = require('./modules/prices/price.routes');
const userRoutes = require('./modules/users/user.routes');
const dueRoutes = require('./modules/dues/due.routes');
const adminRoutes = require('./modules/admins/admin.routes');
const debugRoutes = require('./modules/debug/debug.routes');

// Initialize Redis connection early
require('./config/redis').getRedisClient();

const app = express();

// Global middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (config.allowedOrigins.length === 0 || config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health check (no rate limit — used by load balancers)
app.get('/api/health', (req, res) => {
  const { isRedisReady } = require('./config/redis');
  res.json({ success: true, message: 'Dairy Delivery API is running', redis: isRedisReady() });
});

// ─── Routes with rate limiting ────────────────────────────────────────────────
// Auth: strict (5 req/min) — brute force protection
app.use('/api/auth', limit.auth, authRoutes);

// Public read endpoints: generous (120 req/min) + cached
app.use('/api/areas', limit.public, areaRoutes);
app.use('/api/categories', limit.public, categoryRoutes);
app.use('/api/products', limit.public, productRoutes);
app.use('/api/prices', limit.public, priceRoutes);

// Authenticated user actions: moderate (60 req/min)
app.use('/api/subscriptions', limit.medium, subscriptionRoutes);
app.use('/api/cart', limit.medium, cartRoutes);
app.use('/api/tomorrow', limit.medium, tomorrowRoutes);
app.use('/api/orders', limit.medium, orderRoutes);
app.use('/api/notifications', limit.medium, notificationRoutes);
app.use('/api/users', limit.medium, userRoutes);
app.use('/api/dues', limit.medium, dueRoutes);
app.use('/api/livestreams', limit.medium, livestreamRoutes);
app.use('/api/admins', limit.medium, adminRoutes);

// Heavy endpoints: aggressive (10 req/min) — PDF generation, file uploads, reports
app.use('/api/manifests', limit.heavy, manifestRoutes);
app.use('/api/reports', limit.heavy, reportRoutes);

// Debug endpoints (development only)
app.use('/api/debug', debugRoutes);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
