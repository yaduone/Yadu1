import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
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
import '../auth/complete_profile_screen.dart';
import 'widgets/curved_navbar.dart';
import '../../widgets/delivery_calendar.dart';

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

class _HomeTabState extends State<_HomeTab> with SingleTickerProviderStateMixin {
  double? _dueAmount;
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _loadDue();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadDue() async {
    try {
      final res = await ApiService().get('/dues/me');
      if (mounted) {
        setState(() =>
            _dueAmount = (res['data']?['due_amount'] as num?)?.toDouble() ?? 0);
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
          child: FadeTransition(
            opacity: _fadeAnim,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                const SizedBox(height: 20),

                // ── Header ────────────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Good ${_greeting()},',
                            style: AppType.caption
                                .copyWith(color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 2),
                          Text(firstName, style: AppType.h1),
                        ],
                      ),
                    ),
                    // Wallet pill
                    if (_dueAmount != null)
                      WalletPill(
                        amount: _dueAmount!,
                        onTap: () => Navigator.push(context,
                            MaterialPageRoute(builder: (_) => const DueScreen())),
                      ),
                    const SizedBox(width: 10),
                    const CalendarIconButton(),
                    const SizedBox(width: 10),
                    _headerAction(
                      Icons.notifications_none_rounded,
                      () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const NotificationsScreen())),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // ── Profile Incomplete Banner ─────────────────────────
                if (!auth.isProfileComplete) ...[
                  GestureDetector(
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const CompleteProfileScreen()),
                    ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primary,
                            AppColors.primary.withValues(alpha: 0.85),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.person_add_rounded,
                                color: Colors.white, size: 18),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Complete your address to start receiving milk',
                              style: AppType.small.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600),
                            ),
                          ),
                          const Icon(Icons.arrow_forward_ios_rounded,
                              color: Colors.white70, size: 14),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Tomorrow's Delivery (Hero Card) ───────────────────
                const SectionLabel("Tomorrow's Delivery"),
                const SizedBox(height: 12),
                _buildDeliveryCard(context, cart),

                const SizedBox(height: 24),

                // ── My Subscription ────────────────────────────────────
                const SectionLabel('My Subscription'),
                const SizedBox(height: 12),
                _buildSubscriptionCard(context, sub),

                const SizedBox(height: 24),

                // ── Shop Banner ────────────────────────────────────────
                const SectionLabel('Shop'),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => const ProductsScreen())),
                  child: Container(
                    height: 120,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary,
                          AppColors.primaryDark,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.25),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Stack(
                      children: [
                        // Background decoration
                        Positioned(
                          right: -20,
                          bottom: -20,
                          child: Icon(
                            Icons.storefront_rounded,
                            size: 120,
                            color: Colors.white.withValues(alpha: 0.08),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(20),
                          child: Row(
                            children: [
                              Container(
                                width: 52,
                                height: 52,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: const Icon(Icons.storefront_rounded,
                                    color: Colors.white, size: 26),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      'Browse Products',
                                      style: AppType.h3.copyWith(color: Colors.white),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Paneer, curd, ghee & more',
                                      style: AppType.small.copyWith(
                                        color: Colors.white.withValues(alpha: 0.7),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.arrow_forward_ios_rounded,
                                  color: Colors.white54, size: 16),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Trust badges
                const SizedBox(height: 24),
                const TrustBadgeRow(),

                const SizedBox(height: 100), // padding for bottom nav
              ],
            ),
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
              color: AppColors.primary.withValues(alpha: 0.08),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Icon(icon, size: 22, color: AppColors.textPrimary),
      ),
    );
  }

  Widget _buildSubscriptionCard(
      BuildContext context, SubscriptionProvider sub) {
    final auth = context.read<AppAuthProvider>();

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
              child: const Icon(Icons.water_drop_outlined,
                  color: AppColors.primary, size: 28),
            ),
            const SizedBox(height: 16),
            Text(
              'No active subscription',
              style: AppType.caption.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            if (!auth.isProfileComplete)
              // Profile incomplete — show disabled button with hint
              Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: null, // disabled
                      style: ElevatedButton.styleFrom(
                        disabledBackgroundColor: AppColors.border,
                        disabledForegroundColor: AppColors.textHint,
                      ),
                      child: const Text('Start Subscription'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.info_outline_rounded,
                          size: 13, color: AppColors.warning),
                      const SizedBox(width: 4),
                      Text(
                        'Complete your profile first',
                        style: AppType.micro
                            .copyWith(color: AppColors.warning),
                      ),
                    ],
                  ),
                ],
              )
            else
              ElevatedButton(
                onPressed: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const SubscriptionScreen())),
                child: const Text('Start Subscription'),
              ),
          ],
        ),
      );
    }

    final s = sub.subscription!;
    final isActive = s['status'] == 'active';
    final statusColor = isActive ? AppColors.success : AppColors.warning;

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child:
                    Icon(Icons.water_drop_rounded, color: statusColor, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${(s['milk_type'] as String).toUpperCase()} Milk',
                      style: AppType.h3,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${s['quantity_litres']}L daily · ₹${s['price_per_litre']}/L',
                      style: AppType.small
                          .copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  s['status'].toString().toUpperCase(),
                  style: AppType.micro.copyWith(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const SubscriptionScreen())),
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48)),
              child: const Text('Manage Subscription'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryCard(BuildContext context, CartProvider cart) {
    if (cart.tomorrowStatus == null) {
      return const SkeletonCardLoader();
    }

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.local_shipping_outlined,
                    color: AppColors.primary, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      cart.tomorrowStatus!['date'] ?? '',
                      style: AppType.bodyBold,
                    ),
                    if (cart.isSkipped)
                      Text('Delivery skipped',
                          style: AppType.small
                              .copyWith(color: AppColors.error))
                    else if (cart.effectiveMilk != null)
                      Text(
                        '🟢 ${(cart.effectiveMilk!['milk_type'] as String).toUpperCase()} - ${cart.effectiveMilk!['quantity_litres']}L',
                        style: AppType.small
                            .copyWith(color: AppColors.textSecondary),
                      ),
                  ],
                ),
              ),
              // Quick actions
              if (!cart.isSkipped) ...[
                _ghostButton('Edit', Icons.edit_outlined, () {
                  // Navigate to cart tab — find HomeScreen's setState
                  final homeState =
                      context.findAncestorStateOfType<_HomeScreenState>();
                  homeState?.setState(() => homeState._currentIndex = 2);
                }),
              ],
            ],
          ),
          if (cart.isSkipped)
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    'SKIPPED',
                    style: AppType.microUpper.copyWith(
                      color: AppColors.error,
                      letterSpacing: 1.5,
                    ),
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
                  style:
                      AppType.small.copyWith(color: AppColors.textSecondary),
                ),
              ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total',
                    style: AppType.bodyBold.copyWith(color: AppColors.primary),
                  ),
                  Text(
                    '₹${cart.totalAmount.toStringAsFixed(2)}',
                    style: AppType.h3.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _ghostButton(String label, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.primaryLight,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: AppColors.primary),
            const SizedBox(width: 4),
            Text(
              label,
              style: AppType.micro
                  .copyWith(color: AppColors.primary, fontWeight: FontWeight.w700),
            ),
          ],
        ),
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
