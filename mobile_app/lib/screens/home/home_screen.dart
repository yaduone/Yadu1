import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/subscription_provider.dart';
import '../../providers/cart_provider.dart';
import '../../services/api_service.dart';
import '../subscription/subscription_screen.dart';
import '../cart/cart_screen.dart';
import '../reports/reports_screen.dart';
import '../livestream/livestream_screen.dart';
import '../profile/profile_screen.dart';
import '../notifications/notifications_screen.dart';
import '../dues/due_screen.dart';
import '../products/products_screen.dart';
import 'widgets/curved_navbar.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  // Index mapping: 0=Home, 1=Reports, 2=Cart, 3=Profile
  final _screens = const [
    _HomeTab(),
    ReportsScreen(),
    CartScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SubscriptionProvider>().loadSubscription();
      context.read<CartProvider>().loadTomorrowStatus();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: CurvedNavBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        onFabPressed: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const LivestreamScreen()),
        ),
      ),
    );
  }
}

class _HomeTab extends StatefulWidget {
  const _HomeTab();

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> {
  double? _dueAmount;

  @override
  void initState() {
    super.initState();
    _loadDue();
  }

  Future<void> _loadDue() async {
    try {
      final res = await ApiService().get('/dues/me');
      if (mounted) {
        setState(() => _dueAmount = (res['data']?['due_amount'] as num?)?.toDouble() ?? 0);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AppAuthProvider>();
    final sub = context.watch<SubscriptionProvider>();
    final cart = context.watch<CartProvider>();
    final name = auth.userData?['name'] ?? 'User';
    final firstName = (name as String).split(' ').first;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            await sub.loadSubscription();
            await cart.loadTomorrowStatus();
            await _loadDue();
          },
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            children: [
              const SizedBox(height: 20),

              // Header
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Good ${_greeting()},',
                          style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          firstName,
                          style: const TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _headerAction(
                    Icons.notifications_outlined,
                    () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen())),
                  ),
                  const SizedBox(width: 10),
                  _headerAction(
                    Icons.live_tv_rounded,
                    () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LivestreamScreen())),
                  ),
                ],
              ),

              const SizedBox(height: 28),

              // Due Amount Card
              if (_dueAmount != null && _dueAmount! > 0) ...[
                GestureDetector(
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const DueScreen())),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: AppColors.error.withAlpha(12),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.error.withAlpha(50)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.error.withAlpha(18),
                            borderRadius: BorderRadius.circular(11),
                          ),
                          child: const Icon(Icons.account_balance_wallet_outlined, color: AppColors.error, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Due Amount', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                              Text(
                                'Rs.${_dueAmount!.toStringAsFixed(2)}',
                                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.error),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.error),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Subscription Card
              const SectionLabel('My Subscription'),
              const SizedBox(height: 12),
              _buildSubscriptionCard(context, sub),

              const SizedBox(height: 24),

              // Tomorrow's Delivery
              const SectionLabel("Tomorrow's Delivery"),
              const SizedBox(height: 12),
              _buildDeliveryCard(context, cart),

              const SizedBox(height: 24),

              // Shop Banner
              const SectionLabel('Shop'),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProductsScreen())),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.primary, AppColors.primaryDark],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: Colors.white.withAlpha(30),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 26),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Browse Products',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Paneer, curd, ghee & more',
                              style: TextStyle(fontSize: 13, color: Colors.white70),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white70, size: 16),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }

  Widget _headerAction(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withAlpha(10),
              blurRadius: 12,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Icon(icon, size: 22, color: AppColors.textPrimary),
      ),
    );
  }

  Widget _buildSubscriptionCard(BuildContext context, SubscriptionProvider sub) {
    if (sub.subscription == null) {
      return PremiumCard(
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.water_drop_outlined, color: AppColors.primary, size: 28),
            ),
            const SizedBox(height: 16),
            const Text(
              'No active subscription',
              style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SubscriptionScreen())),
              child: const Text('Start Subscription'),
            ),
          ],
        ),
      );
    }

    final s = sub.subscription!;
    final isActive = s['status'] == 'active';

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isActive ? AppColors.success.withAlpha(20) : AppColors.warning.withAlpha(20),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.water_drop_rounded,
                  color: isActive ? AppColors.success : AppColors.warning,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${(s['milk_type'] as String).toUpperCase()} Milk',
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${s['quantity_litres']}L daily @ Rs.${s['price_per_litre']}/L',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isActive ? AppColors.success.withAlpha(20) : AppColors.warning.withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  s['status'].toString().toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isActive ? AppColors.success : AppColors.warning,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SubscriptionScreen())),
              style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 44)),
              child: const Text('Manage Subscription'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryCard(BuildContext context, CartProvider cart) {
    if (cart.tomorrowStatus == null) {
      return PremiumCard(
        child: Center(
          child: SizedBox(
            height: 24,
            width: 24,
            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
          ),
        ),
      );
    }

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.local_shipping_outlined, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      cart.tomorrowStatus!['date'] ?? '',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                    if (cart.isSkipped)
                      const Text('Delivery skipped', style: TextStyle(fontSize: 13, color: AppColors.error))
                    else if (cart.effectiveMilk != null)
                      Text(
                        '${(cart.effectiveMilk!['milk_type'] as String).toUpperCase()} - ${cart.effectiveMilk!['quantity_litres']}L',
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (cart.isSkipped)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.error.withAlpha(10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Text(
                    'SKIPPED',
                    style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w700, fontSize: 13, letterSpacing: 1),
                  ),
                ),
              ),
            ),
          if (!cart.isSkipped) ...[
            if (cart.extraItems.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '+ ${cart.extraItems.length} extra items',
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
              ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.primary),
                  ),
                  Text(
                    'Rs.${cart.totalAmount.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.primary),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  }
}
