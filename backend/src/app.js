const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const areaRoutes = require('./modules/areas/area.routes');
const productRoutes = require('./modules/products/product.routes');
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

const app = express();

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Dairy Delivery API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/products', productRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/tomorrow', tomorrowRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/manifests', manifestRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/livestreams', livestreamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dues', dueRoutes);
app.use('/api/admins', adminRoutes);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
