import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/tappable.dart';
import '../../utils/transitions.dart';
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
import 'package:intl/intl.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  static const _screens = [
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
      body: FadeIndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: CurvedNavBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        onFabPressed: () => Navigator.push(
          context,
          SlideUpRoute(page: const LivestreamScreen()),
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
    final name = context.select<AppAuthProvider, String>(
      (a) => a.userData?['name'] ?? 'User',
    );
    final isProfileComplete = context.select<AppAuthProvider, bool>(
      (a) => a.isProfileComplete,
    );
    final sub = context.watch<SubscriptionProvider>();
    final cart = context.watch<CartProvider>();
    final firstName = name.split(' ').first;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Blue Header ───────────────────────────────────────────────
          _buildBlueHeader(context, firstName),

          // ── Scrollable Content ────────────────────────────────────────
          Expanded(
            child: SafeArea(
              top: false,
              child: RefreshIndicator(
                color: Colors.white,
                backgroundColor: const Color(0xFF2A9D8F),
                onRefresh: () async {
                  await sub.loadSubscription();
                  await cart.loadTomorrowStatus();
                  await _loadDue();
                },
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                    children: [
                      // Profile incomplete banner
                      if (!isProfileComplete) ...[
                        Tappable(
                          onTap: () => Navigator.push(
                            context,
                            SlideUpRoute(page: const CompleteProfileScreen()),
                          ),
                          scaleFactor: 0.97,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 14),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  AppColors.warning,
                                  AppColors.warning.withValues(alpha: 0.8),
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

                      // ── Tomorrow's Delivery ───────────────────────────
                      _SectionHeader(
                        title: "Tomorrow's Delivery",
                        icon: Icons.local_shipping_outlined,
                      ),
                      const SizedBox(height: 10),
                      _buildDeliveryCard(context, cart),

                      const SizedBox(height: 24),

                      // ── Quick Actions ─────────────────────────────────
                      _SectionHeader(title: 'Quick Actions', icon: Icons.flash_on_rounded),
                      const SizedBox(height: 10),
                      _QuickActionsGrid(
                        cart: cart,
                        onSkipToggle: () async {
                          if (cart.isSkipped) {
                            await cart.revertOverride();
                          } else {
                            await cart.skipTomorrow();
                          }
                        },
                        onAddExtras: () {
                          final homeState =
                              context.findAncestorStateOfType<_HomeScreenState>();
                          homeState?.setState(() => homeState._currentIndex = 2);
                        },
                        onReports: () {
                          final homeState =
                              context.findAncestorStateOfType<_HomeScreenState>();
                          homeState?.setState(() => homeState._currentIndex = 1);
                        },
                        onLive: () => Navigator.push(
                            context, SlideUpRoute(page: const LivestreamScreen())),
                      ),

                      const SizedBox(height: 24),

                      // ── My Subscription ───────────────────────────────
                      _SectionHeader(
                        title: 'My Subscription',
                        icon: Icons.water_drop_rounded,
                        actionLabel: 'Manage',
                        onAction: () => Navigator.push(
                            context, SlideUpRoute(page: const SubscriptionScreen())),
                      ),
                      const SizedBox(height: 10),
                      _buildSubscriptionCard(context, sub),

                      const SizedBox(height: 24),

                      // ── Shop Banner ───────────────────────────────────
                      _SectionHeader(title: 'Shop', icon: Icons.storefront_rounded),
                      const SizedBox(height: 10),
                      Tappable(
                        onTap: () => Navigator.push(context,
                            SlideRightRoute(page: const ProductsScreen())),
                        scaleFactor: 0.97,
                        child: Container(
                          height: 110,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF1B6B5A), Color(0xFF2A9D8F)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF2A9D8F).withValues(alpha: 0.3),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Stack(
                            children: [
                              Positioned(
                                right: -16,
                                bottom: -16,
                                child: Icon(
                                  Icons.storefront_rounded,
                                  size: 110,
                                  color: Colors.white.withValues(alpha: 0.07),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.all(20),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 50,
                                      height: 50,
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                      child: const Icon(Icons.storefront_rounded,
                                          color: Colors.white, size: 24),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Text(
                                            'Browse Products',
                                            style: AppType.h3.copyWith(color: Colors.white),
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            'Paneer, curd, ghee & more',
                                            style: AppType.small.copyWith(
                                              color: Colors.white.withValues(alpha: 0.7),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      width: 32,
                                      height: 32,
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: const Icon(Icons.arrow_forward_rounded,
                                          color: Colors.white, size: 16),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),
                      const TrustBadgeRow(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────────

  Widget _buildBlueHeader(BuildContext context, String firstName) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1B6B5A), Color(0xFF2A9D8F), Color(0xFF48C9B0)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: [0.0, 0.55, 1.0],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2A9D8F).withValues(alpha: 0.40),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Good ${_greeting()}  ',
                          style: AppType.caption.copyWith(
                            color: Colors.white.withValues(alpha: 0.75),
                          ),
                        ),
                        Text(
                          _greetingEmoji(),
                          style: const TextStyle(fontSize: 14),
                        ),
                      ],
                    ),
                    const SizedBox(height: 1),
                    Text(
                      firstName,
                      style: AppType.h1.copyWith(
                        color: Colors.white,
                        fontSize: 26,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(
                          Icons.calendar_today_rounded,
                          size: 11,
                          color: Colors.white.withValues(alpha: 0.6),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          DateFormat('EEEE, d MMMM').format(DateTime.now()),
                          style: AppType.micro.copyWith(
                            color: Colors.white.withValues(alpha: 0.65),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (_dueAmount != null) ...[
                _HeaderWalletPill(
                  amount: _dueAmount!,
                  onTap: () => Navigator.push(
                      context, SlideUpRoute(page: const DueScreen())),
                ),
                const SizedBox(width: 8),
              ],
              _headerIconBtn(
                Icons.calendar_month_rounded,
                () => showDeliveryCalendar(context),
              ),
              const SizedBox(width: 8),
              _headerIconBtn(
                Icons.notifications_none_rounded,
                () => Navigator.push(
                    context, SlideUpRoute(page: const NotificationsScreen())),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _headerIconBtn(IconData icon, VoidCallback onTap) {
    return Tappable(
      onTap: onTap,
      scaleFactor: 0.92,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: Icon(icon, size: 20, color: Colors.white),
      ),
    );
  }

  // ── Delivery Card ─────────────────────────────────────────────────────────────

  Widget _buildDeliveryCard(BuildContext context, CartProvider cart) {
    if (cart.tomorrowStatus == null) {
      return const SkeletonCardLoader();
    }

    final milkType = (cart.effectiveMilk?['milk_type'] as String? ?? '').toLowerCase();

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
                  color: cart.isSkipped
                      ? AppColors.error.withValues(alpha: 0.1)
                      : AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  cart.isSkipped
                      ? Icons.event_busy_rounded
                      : Icons.local_shipping_outlined,
                  color: cart.isSkipped ? AppColors.error : AppColors.primary,
                  size: 24,
                ),
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
                    else if (cart.effectiveMilk == null)
                      Text(
                        'No active subscription',
                        style: AppType.small
                            .copyWith(color: AppColors.textHint),
                      ),
                  ],
                ),
              ),
              if (!cart.isSkipped)
                _ghostButton('Edit', Icons.edit_outlined, () {
                  final homeState =
                      context.findAncestorStateOfType<_HomeScreenState>();
                  homeState?.setState(() => homeState._currentIndex = 2);
                }),
            ],
          ),

          if (cart.isSkipped) ...[
            const SizedBox(height: 14),
            Container(
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
          ] else ...[
            // Milk type chip
            if (cart.effectiveMilk != null) ...[
              const SizedBox(height: 12),
              _MilkTypeChip(
                milkType: milkType,
                quantity: cart.effectiveMilk!['quantity_litres'],
              ),
            ],

            // Extra items strip
            if (cart.extraItems.isNotEmpty) ...[
              const SizedBox(height: 14),
              _ExtraItemsStrip(extraItems: cart.extraItems),
            ],

            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 16),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.receipt_long_rounded,
                          size: 16, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        'Total',
                        style: AppType.bodyBold
                            .copyWith(color: AppColors.primary),
                      ),
                    ],
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

  // ── Subscription Card ─────────────────────────────────────────────────────────

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
            const SizedBox(height: 12),
            Text(
              'No active subscription',
              style: AppType.caption
                  .copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 4),
            Text(
              'Start a subscription to get fresh milk daily',
              textAlign: TextAlign.center,
              style: AppType.micro.copyWith(color: AppColors.textHint),
            ),
            const SizedBox(height: 16),
            if (!auth.isProfileComplete)
              Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: null,
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
                        style: AppType.micro.copyWith(color: AppColors.warning),
                      ),
                    ],
                  ),
                ],
              )
            else
              ElevatedButton(
                onPressed: () => Navigator.push(context,
                    SlideUpRoute(page: const SubscriptionScreen())),
                child: const Text('Start Subscription'),
              ),
          ],
        ),
      );
    }

    final s = sub.subscription!;
    final isActive = s['status'] == 'active';
    final milkType = (s['milk_type'] as String? ?? '').toLowerCase();
    final milkColor = _milkTypeColor(milkType);
    final statusColor = isActive ? AppColors.success : AppColors.warning;

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: milkColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Icon(Icons.water_drop_rounded, color: milkColor, size: 26),
                    Positioned(
                      bottom: 8,
                      right: 8,
                      child: Text(
                        _milkTypeEmoji(milkType),
                        style: const TextStyle(fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_milkTypeLabel(milkType)} Milk',
                      style: AppType.h3,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: milkColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${s['quantity_litres']}L/day',
                            style: AppType.micro.copyWith(
                              color: milkColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '₹${s['price_per_litre']}/L',
                          style: AppType.small
                              .copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              AnimatedStatusBadge(
                label: s['status'].toString(),
                color: statusColor,
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.push(
                  context, SlideUpRoute(page: const SubscriptionScreen())),
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 46)),
              child: const Text('Manage Subscription'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _ghostButton(String label, IconData icon, VoidCallback onTap) {
    return Tappable(
      onTap: onTap,
      scaleFactor: 0.93,
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
              style: AppType.micro.copyWith(
                  color: AppColors.primary, fontWeight: FontWeight.w700),
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

  String _greetingEmoji() {
    final hour = DateTime.now().hour;
    if (hour < 12) return '☀️';
    if (hour < 17) return '🌤️';
    return '🌙';
  }

  static Color _milkTypeColor(String milkType) {
    switch (milkType) {
      case 'cow':
        return const Color(0xFF10B981);
      case 'buffalo':
        return const Color(0xFF7C3AED);
      case 'full_cream':
        return const Color(0xFFFF9500);
      case 'toned':
        return const Color(0xFF2E8EEA);
      case 'double_toned':
        return const Color(0xFF06B6D4);
      default:
        return AppColors.primary;
    }
  }

  static String _milkTypeEmoji(String milkType) {
    switch (milkType) {
      case 'cow':
        return '🐄';
      case 'buffalo':
        return '🐃';
      default:
        return '🥛';
    }
  }

  static String _milkTypeLabel(String milkType) {
    switch (milkType) {
      case 'full_cream':
        return 'Full Cream';
      case 'double_toned':
        return 'Double Toned';
      default:
        return milkType
            .split('_')
            .map((w) => w.isEmpty
                ? ''
                : w[0].toUpperCase() + w.substring(1))
            .join(' ');
    }
  }
}

// ── Header Wallet Pill ────────────────────────────────────────────────────────

class _HeaderWalletPill extends StatelessWidget {
  final double amount;
  final VoidCallback onTap;

  const _HeaderWalletPill({required this.amount, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final hasDue = amount > 0;
    return Tappable(
      onTap: onTap,
      scaleFactor: 0.93,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.account_balance_wallet_rounded,
              size: 15,
              color: hasDue ? const Color(0xFFFFD700) : Colors.white,
            ),
            const SizedBox(width: 5),
            Text(
              hasDue ? '₹${amount.toStringAsFixed(0)} due' : '✓ Clear',
              style: AppType.small.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Section Header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _SectionHeader({
    required this.title,
    required this.icon,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.primaryLight,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 15, color: AppColors.primary),
        ),
        const SizedBox(width: 8),
        Text(title, style: AppType.h3),
        const Spacer(),
        if (actionLabel != null && onAction != null)
          Tappable(
            onTap: onAction!,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                actionLabel!,
                style: AppType.micro.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ── Milk Type Chip ────────────────────────────────────────────────────────────

class _MilkTypeChip extends StatelessWidget {
  final String milkType;
  final dynamic quantity;

  const _MilkTypeChip({required this.milkType, required this.quantity});

  Color get _color {
    switch (milkType) {
      case 'cow':
        return const Color(0xFF10B981);
      case 'buffalo':
        return const Color(0xFF7C3AED);
      case 'full_cream':
        return const Color(0xFFFF9500);
      case 'toned':
        return const Color(0xFF2E8EEA);
      default:
        return AppColors.primary;
    }
  }

  String get _emoji {
    switch (milkType) {
      case 'cow':
        return '🐄';
      case 'buffalo':
        return '🐃';
      default:
        return '🥛';
    }
  }

  String get _label {
    switch (milkType) {
      case 'full_cream':
        return 'Full Cream';
      case 'double_toned':
        return 'Double Toned';
      default:
        return milkType
            .split('_')
            .map((w) => w.isEmpty ? '' : w[0].toUpperCase() + w.substring(1))
            .join(' ');
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_emoji, style: const TextStyle(fontSize: 18)),
          const SizedBox(width: 8),
          Icon(Icons.water_drop_rounded, color: color, size: 16),
          const SizedBox(width: 6),
          Text(
            '$_label · ${quantity}L',
            style: AppType.small
                .copyWith(color: color, fontWeight: FontWeight.w700),
          ),
          const SizedBox(width: 8),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              'Subscription',
              style: AppType.micro.copyWith(
                  color: color, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Extra Items Strip ─────────────────────────────────────────────────────────

class _ExtraItemsStrip extends StatelessWidget {
  final List<dynamic> extraItems;

  const _ExtraItemsStrip({required this.extraItems});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.add_shopping_cart_rounded,
                size: 13, color: AppColors.textSecondary),
            const SizedBox(width: 4),
            Text(
              '${extraItems.length} extra ${extraItems.length == 1 ? 'item' : 'items'} added',
              style: AppType.micro.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 88,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: extraItems.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (ctx, i) {
              final item = extraItems[i] as Map<String, dynamic>;
              return _ExtraItemThumbnail(item: item);
            },
          ),
        ),
      ],
    );
  }
}

class _ExtraItemThumbnail extends StatelessWidget {
  final Map<String, dynamic> item;

  const _ExtraItemThumbnail({required this.item});

  @override
  Widget build(BuildContext context) {
    final name = item['product_name'] as String? ?? '';
    final qty = item['quantity'];
    final images = item['images'];
    final imageUrl =
        (images is List && images.isNotEmpty) ? images[0] as String? : null;

    return SizedBox(
      width: 70,
      child: Column(
        children: [
          Stack(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: imageUrl != null && imageUrl.isNotEmpty
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(13),
                        child: CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          memCacheWidth: 120,
                          memCacheHeight: 120,
                          errorWidget: (_, __, ___) =>
                              _ProductInitial(name: name),
                        ),
                      )
                    : _ProductInitial(name: name),
              ),
              if (qty != null)
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Text(
                      'x$qty',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppType.micro.copyWith(
              color: AppColors.textSecondary,
              height: 1.2,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductInitial extends StatelessWidget {
  final String name;
  const _ProductInitial({required this.name});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: AppType.h3.copyWith(
          color: AppColors.primary,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

// ── Quick Actions Grid ────────────────────────────────────────────────────────

class _QuickActionsGrid extends StatelessWidget {
  final CartProvider cart;
  final VoidCallback onSkipToggle;
  final VoidCallback onAddExtras;
  final VoidCallback onReports;
  final VoidCallback onLive;

  const _QuickActionsGrid({
    required this.cart,
    required this.onSkipToggle,
    required this.onAddExtras,
    required this.onReports,
    required this.onLive,
  });

  @override
  Widget build(BuildContext context) {
    final isSkipped = cart.isSkipped;

    return Row(
      children: [
        _QuickActionTile(
          icon: isSkipped ? Icons.replay_rounded : Icons.event_busy_rounded,
          label: isSkipped ? 'Undo\nSkip' : 'Skip\nTomorrow',
          color: isSkipped ? AppColors.success : AppColors.error,
          onTap: onSkipToggle,
        ),
        const SizedBox(width: 10),
        _QuickActionTile(
          icon: Icons.add_shopping_cart_rounded,
          label: 'Add\nExtras',
          color: AppColors.primary,
          onTap: onAddExtras,
        ),
        const SizedBox(width: 10),
        _QuickActionTile(
          icon: Icons.bar_chart_rounded,
          label: 'My\nReports',
          color: const Color(0xFF7C3AED),
          onTap: onReports,
        ),
        const SizedBox(width: 10),
        _QuickActionTile(
          icon: Icons.live_tv_rounded,
          label: 'Farm\nLive',
          color: const Color(0xFFDC2626),
          onTap: onLive,
        ),
      ],
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Tappable(
        onTap: onTap,
        scaleFactor: 0.93,
        haptic: HapticFeedbackType.light,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.12),
                blurRadius: 16,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 20, color: color),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: AppType.micro.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
