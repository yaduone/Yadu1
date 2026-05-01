import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  List<dynamic> _calendarOrders = [];
  int _carouselIndex = 0;
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;
  final ScrollController _scrollCtrl = ScrollController();
  double _collapseProgress = 0.0;

  static const double _kCollapseStart = 0.0;
  static const double _kCollapseEnd = 60.0;

  @override
  void initState() {
    super.initState();
    _loadDue();
    _loadCalendarOrders();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fadeCtrl.forward();
    _scrollCtrl.addListener(_onScroll);
  }

  void _onScroll() {
    final offset = _scrollCtrl.offset.clamp(0.0, double.infinity);
    final progress = ((offset - _kCollapseStart) / (_kCollapseEnd - _kCollapseStart))
        .clamp(0.0, 1.0);
    if ((progress - _collapseProgress).abs() > 0.008) {
      setState(() => _collapseProgress = progress);
    }
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
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

  Future<void> _loadCalendarOrders() async {
    try {
      final res = await ApiService().get('/orders?limit=30');
      if (mounted) {
        setState(() => _calendarOrders = res['data']?['orders'] ?? []);
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
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // ── Premium sky background ────────────────────────────────
          Positioned.fill(
            child: Image.asset(
              'assets/images/bg.jpg',
              fit: BoxFit.cover,
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFF063B66).withValues(alpha: 0.18),
                    Colors.white.withValues(alpha: 0.34),
                    const Color(0xFFF7FBFF).withValues(alpha: 0.92),
                  ],
                  stops: const [0.0, 0.45, 1.0],
                ),
              ),
            ),
          ),
          Positioned(
            left: -90,
            top: 150,
            child: _SoftBlob(color: const Color(0xFF2A9D8F).withValues(alpha: 0.18)),
          ),
          Positioned(
            right: -110,
            bottom: 70,
            child: _SoftBlob(color: const Color(0xFF2E8EEA).withValues(alpha: 0.14)),
          ),
          // ── Foreground content ───────────────────────────────────────
          Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
          // ── Animated Header ───────────────────────────────────────────────
          _buildAnimatedHeader(context, firstName),

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
                  await _loadCalendarOrders();
                },
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: ScrollConfiguration(
                    behavior: _SmoothScrollBehavior(),
                    child: ListView(
                    controller: _scrollCtrl,
                    physics: const BouncingScrollPhysics(
                      parent: AlwaysScrollableScrollPhysics(),
                    ),
                    padding: const EdgeInsets.fromLTRB(18, 14, 18, 110),
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

                      _buildHeroSnapshot(context, cart, sub),
                      const SizedBox(height: 24),

                      // ── Tomorrow's Delivery ───────────────────────────
                      _SectionHeader(
                        title: "Tomorrow's Delivery",
                        icon: Icons.local_shipping_outlined,
                      ),
                      const SizedBox(height: 10),
                      _buildDeliveryCard(context, cart),

                      const SizedBox(height: 24),

                      // ── Quick Calendar ────────────────────────────────
                      _SectionHeader(
                        title: 'Quick Calendar',
                        icon: Icons.calendar_month_rounded,
                      ),
                      const SizedBox(height: 10),
                      _QuickCalendar(orders: _calendarOrders),

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
          ),
        ],
          ),
        ],
      ),
    );
  }


  Widget _buildHeroSnapshot(BuildContext context, CartProvider cart, SubscriptionProvider sub) {
    final hasSub = sub.subscription != null;
    final isSkipped = cart.isSkipped;
    final milkType = ((cart.effectiveMilk?['milk_type'] as String?) ??
            (sub.subscription?['milk_type'] as String?) ??
            'fresh')
        .toLowerCase();
    final qty = cart.effectiveMilk?['quantity_litres'] ??
        sub.subscription?['quantity_litres'] ??
        '-';

    return _GlassCard(
      padding: const EdgeInsets.all(18),
      child: Stack(
        children: [
          Positioned(
            right: -24,
            top: -22,
            child: Icon(
              Icons.water_drop_rounded,
              size: 118,
              color: AppColors.primary.withValues(alpha: 0.055),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 54,
                    height: 54,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F766E), Color(0xFF2A9D8F)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.25),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.local_shipping_rounded,
                        color: Colors.white, size: 27),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isSkipped
                              ? 'Delivery paused for tomorrow'
                              : hasSub
                                  ? 'Tomorrow delivery is ready'
                                  : 'Start your fresh milk plan',
                          style: AppType.h3.copyWith(
                            color: const Color(0xFF082F49),
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isSkipped
                              ? 'Tap undo skip anytime before cutoff.'
                              : hasSub
                                  ? 'Fresh ${_milkTypeLabel(milkType)} milk scheduled at your doorstep.'
                                  : 'Subscribe and manage daily milk, extras and dues here.',
                          style: AppType.small.copyWith(
                            color: const Color(0xFF57758A),
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _InfoPill(
                      icon: Icons.water_drop_rounded,
                      title: '$qty L',
                      subtitle: 'Daily Qty',
                      color: _milkTypeColor(milkType),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _InfoPill(
                      icon: isSkipped ? Icons.event_busy_rounded : Icons.verified_rounded,
                      title: isSkipped ? 'Skipped' : hasSub ? 'Active' : 'Setup',
                      subtitle: 'Status',
                      color: isSkipped ? AppColors.error : AppColors.success,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _HeroCarousel(
                currentIndex: _carouselIndex,
                onIndexChanged: (i) => setState(() => _carouselIndex = i),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Animated Scroll Header ────────────────────────────────────────────────────

  Widget _buildAnimatedHeader(BuildContext context, String firstName) {
    final p = _collapseProgress;
    final fullFade = (1.0 - (p * 1.6).clamp(0.0, 1.0));
    final stickyFade = ((p - 0.4) / 0.6).clamp(0.0, 1.0);
    final vPad = lerpDouble(14.0, 7.0, p)!;

    return SafeArea(
      bottom: false,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        margin: const EdgeInsets.fromLTRB(14, 8, 14, 6),
        padding: EdgeInsets.symmetric(horizontal: 14, vertical: vPad),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18 + (p * 0.6)),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: Colors.white.withValues(alpha: 0.5)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF063B66).withValues(alpha: p * 0.12),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            // ── Expanded header ──────────────────────────────────────
            Opacity(
              opacity: fullFade,
              child: IgnorePointer(
                ignoring: p > 0.5,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.water_drop_rounded,
                          color: Color(0xFF0F766E), size: 22),
                    ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Good ${_greeting()} ${_greetingEmoji()}',
                                style: AppType.micro.copyWith(
                                  color: const Color(0xFF31556C),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                firstName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppType.h1.copyWith(
                                  color: const Color(0xFF082F49),
                                  fontSize: 24,
                                  letterSpacing: -0.5,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  const Icon(Icons.calendar_today_rounded,
                                      size: 11, color: Color(0xFF5F7F95)),
                                  const SizedBox(width: 4),
                                  Text(
                                    DateFormat('EEE, d MMM').format(DateTime.now()),
                                    style: AppType.micro.copyWith(
                                      color: const Color(0xFF5F7F95),
                                      fontWeight: FontWeight.w600,
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
                          Icons.notifications_none_rounded,
                          () => Navigator.push(
                              context, SlideUpRoute(page: const NotificationsScreen())),
                        ),
                      ],
                    ),
                  ),
                ),

                // ── Collapsed minimal bar ────────────────────────────────
                Positioned.fill(
                  child: Opacity(
                    opacity: stickyFade,
                    child: IgnorePointer(
                      ignoring: p < 0.5,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.5)),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Image.asset(
                              'assets/images/image.png',
                              fit: BoxFit.contain,
                            ),
                          ),
                          const SizedBox(width: 9),
                          Text(
                            'YaduOne',
                            style: TextStyle(
                              color: const Color(0xFF082F49),
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const Spacer(),
                          if (_dueAmount != null)
                            _HeaderWalletPill(
                              amount: _dueAmount!,
                              onTap: () => Navigator.push(
                                  context, SlideUpRoute(page: const DueScreen())),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
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
          color: Colors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
        ),
        child: Icon(icon, size: 20, color: const Color(0xFF0F3A4A)),
      ),
    );
  }

  // ── Delivery Card ─────────────────────────────────────────────────────────────

  Widget _buildDeliveryCard(BuildContext context, CartProvider cart) {
    if (cart.tomorrowStatus == null) {
      return const SkeletonCardLoader();
    }

    final milkType = (cart.effectiveMilk?['milk_type'] as String? ?? '').toLowerCase();

    return _GlassCard(
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
      return _GlassCard(
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

    return _GlassCard(
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
                        Flexible(
                          child: Text(
                            '₹${s['price_per_litre']}/L',
                            overflow: TextOverflow.ellipsis,
                            style: AppType.small
                                .copyWith(color: AppColors.textSecondary),
                          ),
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


class _GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;

  const _GlassCard({
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.radius = 24,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.70),
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: Colors.white.withValues(alpha: 0.78)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF063B66).withValues(alpha: 0.10),
                blurRadius: 26,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;

  const _InfoPill({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.58),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.14)),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.captionBold.copyWith(
                    color: const Color(0xFF082F49),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  subtitle,
                  style: AppType.micro.copyWith(
                    color: const Color(0xFF6B8798),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SoftBlob extends StatelessWidget {
  final Color color;
  const _SoftBlob({required this.color});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
        ),
      ),
    );
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
    final color = hasDue ? const Color(0xFFD97706) : const Color(0xFF047857);
    return Tappable(
      onTap: onTap,
      scaleFactor: 0.93,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.62),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: Colors.white.withValues(alpha: 0.65)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.account_balance_wallet_rounded, size: 15, color: color),
                const SizedBox(width: 6),
                Text(
                  hasDue ? '₹${amount.toStringAsFixed(0)} due' : 'Clear',
                  style: AppType.small.copyWith(
                    color: const Color(0xFF082F49),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
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
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppColors.primary.withValues(alpha: 0.18),
                Colors.white.withValues(alpha: 0.72),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.75)),
          ),
          child: Icon(icon, size: 17, color: const Color(0xFF0F766E)),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: AppType.h3.copyWith(
            color: const Color(0xFF082F49),
            fontWeight: FontWeight.w900,
            letterSpacing: -0.2,
          ),
        ),
        const Spacer(),
        if (actionLabel != null && onAction != null)
          Tappable(
            onTap: onAction!,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.58),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: Colors.white.withValues(alpha: 0.75)),
              ),
              child: Text(
                actionLabel!,
                style: AppType.micro.copyWith(
                  color: const Color(0xFF0F766E),
                  fontWeight: FontWeight.w800,
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
          Flexible(
            child: Text(
              '$_label · ${quantity}L',
              overflow: TextOverflow.ellipsis,
              style: AppType.small
                  .copyWith(color: color, fontWeight: FontWeight.w700),
            ),
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
            Flexible(
              child: Text(
                '${extraItems.length} extra ${extraItems.length == 1 ? 'item' : 'items'} added',
                overflow: TextOverflow.ellipsis,
                style: AppType.micro.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
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
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.64),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: Colors.white.withValues(alpha: 0.72)),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.15),
                    blurRadius: 20,
                    offset: const Offset(0, 9),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [color.withValues(alpha: 0.95), color.withValues(alpha: 0.70)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Icon(icon, size: 21, color: Colors.white),
                  ),
                  const SizedBox(height: 9),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: AppType.micro.copyWith(
                      color: const Color(0xFF183B4E),
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Quick Calendar ────────────────────────────────────────────────────────────

class _QuickCalendar extends StatefulWidget {
  final List<dynamic> orders;

  const _QuickCalendar({required this.orders});

  @override
  State<_QuickCalendar> createState() => _QuickCalendarState();
}

class _QuickCalendarState extends State<_QuickCalendar> {
  final ScrollController _ctrl = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToToday());
  }

  @override
  void didUpdateWidget(_QuickCalendar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.orders.isEmpty && widget.orders.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToToday());
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _scrollToToday() {
    if (!_ctrl.hasClients) return;
    // 14 days back is the start; each card = 56px + 8px gap = 64px
    const todayIndex = 14;
    final offset = (todayIndex * 64.0) - 120.0;
    _ctrl.animateTo(
      offset.clamp(0.0, _ctrl.position.maxScrollExtent),
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final todayNorm = DateTime(today.year, today.month, today.day);

    final Map<String, String> statusMap = {};
    for (final o in widget.orders) {
      final date = o['date'] as String?;
      final status = o['status'] as String?;
      if (date != null && status != null) {
        final normalized = date.length >= 10 ? date.substring(0, 10) : date;
        statusMap[normalized] = status;
      }
    }

    final start = todayNorm.subtract(const Duration(days: 14));
    final days = List.generate(22, (i) => start.add(Duration(days: i)));

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          height: 98,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.66),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.72)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF063B66).withValues(alpha: 0.10),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
        child: ListView.builder(
          controller: _ctrl,
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          itemCount: days.length,
          itemBuilder: (context, i) {
            final day = days[i];
            final dateStr = DateFormat('yyyy-MM-dd').format(day);
            final isToday = day == todayNorm;
            final isFuture = day.isAfter(todayNorm);
            final isPast = day.isBefore(todayNorm);
            final status = statusMap[dateStr];

            Color? dotColor;
            if (status == 'delivered') {
              dotColor = AppColors.success;
            } else if (status != null) {
              dotColor = AppColors.error;
            }

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: _CalendarDayCard(
                day: day,
                isToday: isToday,
                isPast: isPast,
                isFuture: isFuture,
                dotColor: dotColor,
              ),
            );
          },
        ),
          ),
        ),
      ),
    );
  }
}

class _CalendarDayCard extends StatelessWidget {
  final DateTime day;
  final bool isToday;
  final bool isPast;
  final bool isFuture;
  final Color? dotColor;

  const _CalendarDayCard({
    required this.day,
    required this.isToday,
    required this.isPast,
    required this.isFuture,
    required this.dotColor,
  });

  @override
  Widget build(BuildContext context) {
    final dimmed = isFuture || (isPast && dotColor == null);
    final textColor = isToday
        ? AppColors.primary
        : dimmed
            ? AppColors.textHint
            : AppColors.textPrimary;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: 56,
      decoration: BoxDecoration(
        color: isToday ? AppColors.primaryLight : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        border: isToday
            ? Border.all(color: AppColors.primary, width: 1.5)
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            DateFormat('EEE').format(day).substring(0, 3),
            style: AppType.micro.copyWith(
              color: textColor,
              fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
              fontSize: 10,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '${day.day}',
            style: AppType.captionBold.copyWith(
              color: textColor,
              fontWeight: isToday ? FontWeight.w900 : FontWeight.w600,
            ),
          ),
          const SizedBox(height: 5),
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: dotColor ?? Colors.transparent,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Hero Carousel ─────────────────────────────────────────────────────────────

class _HeroCarousel extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onIndexChanged;

  static const _images = [
    'assets/images/1.png',
    'assets/images/2.png',
    'assets/images/3.png',
  ];

  const _HeroCarousel({
    required this.currentIndex,
    required this.onIndexChanged,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final carouselHeight = constraints.maxWidth / 2.0;
    return Column(
      children: [
        CarouselSlider(
          options: CarouselOptions(
            height: carouselHeight,
            viewportFraction: 1.0,
            autoPlay: true,
            autoPlayInterval: const Duration(seconds: 3),
            autoPlayCurve: Curves.easeInOut,
            autoPlayAnimationDuration: const Duration(milliseconds: 600),
            enableInfiniteScroll: true,
            onPageChanged: (i, _) => onIndexChanged(i),
          ),
          items: _images.map((path) {
            return ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Image.asset(
                path,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_images.length, (i) {
            final active = i == currentIndex;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: active ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: active
                    ? AppColors.primary
                    : AppColors.primary.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
      },
    );
  }
}

// ── Smooth scroll behaviour (removes Android overscroll glow) ─────────────────

class _SmoothScrollBehavior extends ScrollBehavior {
  @override
  Widget buildOverscrollIndicator(
      BuildContext context, Widget child, ScrollableDetails details) {
    return child;
  }

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) =>
      const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
}

