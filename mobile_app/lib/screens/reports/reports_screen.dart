import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/delivery_calendar.dart';
import '../../services/api_service.dart';
import '../../providers/auth_provider.dart';
import '../../utils/transitions.dart';
import '../home/home_screen.dart';
import '../auth/complete_profile_screen.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen>
    with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _report;
  bool _loading = true;
  late AnimationController _animCtrl;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _loadReport();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadReport() async {
    final isProfileComplete =
        context.read<AppAuthProvider>().isProfileComplete;
    if (!isProfileComplete) {
      setState(() => _loading = false);
      return;
    }
    try {
      final res = await ApiService().get('/reports/user/summary');
      setState(() {
        _report = res['data'];
        _loading = false;
      });
      _animCtrl.forward();
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          // Navigate to home tab (index 0)
          context.findAncestorStateOfType<HomeScreenState>()?.changeTab(0);
        }
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Stack(
        children: [
          Positioned.fill(
            child: Image.asset(
              'assets/images/333.jpg',
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
                    Colors.black.withValues(alpha: 0.55),
                    Colors.black.withValues(alpha: 0.15),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.35, 0.65],
                ),
              ),
            ),
          ),
          SafeArea(
        child: _loading
            ? Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 20),
                    const SkeletonLoader(height: 32, width: 180, borderRadius: 8),
                    const SizedBox(height: 24),
                    Row(
                      children: const [
                        Expanded(child: SkeletonLoader(height: 120)),
                        SizedBox(width: 12),
                        Expanded(child: SkeletonLoader(height: 120)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: const [
                        Expanded(child: SkeletonLoader(height: 120)),
                        SizedBox(width: 12),
                        Expanded(child: SkeletonLoader(height: 120)),
                      ],
                    ),
                  ],
                ),
              )
            : _report == null
                ? Center(
                    child: _buildEmptyState(context),
                  )
                : RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: _loadReport,
                    child: FadeTransition(
                      opacity: CurvedAnimation(
                          parent: _animCtrl, curve: Curves.easeOut),
                      child: ListView(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        children: [
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Reports & Insights',
                                      style: AppType.h1.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w900,
                                        shadows: [
                                          Shadow(
                                            color: Colors.black54,
                                            blurRadius: 10,
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Your delivery analytics at a glance',
                                      style: AppType.caption.copyWith(
                                        color: Colors.white.withValues(alpha: 0.82),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const CalendarIconButton(),
                            ],
                          ),

                          const SizedBox(height: 24),

                          // Stats grid
                          Row(
                            children: [
                              Expanded(
                                child: _statTile(
                                  'Delivered',
                                  '${_report!['total_milk_delivered_litres']}L',
                                  Icons.local_drink_rounded,
                                  AppColors.success,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _statTile(
                                  'Pending',
                                  '${_report!['total_milk_pending_litres']}L',
                                  Icons.pending_rounded,
                                  AppColors.warning,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: _statTile(
                                  'Total Spent',
                                  '₹${(_report!['total_spent'] as num).toStringAsFixed(0)}',
                                  Icons.currency_rupee_rounded,
                                  AppColors.primary,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _statTile(
                                  'Not Delivered',
                                  '${_report!['total_not_delivered_days'] ?? _report!['total_skipped_days']} days',
                                  Icons.cancel_rounded,
                                  AppColors.error,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _statTile(
                            'Extra Items Ordered',
                            '${_report!['extra_items_count']}',
                            Icons.shopping_bag_rounded,
                            const Color(0xFF8B5CF6),
                          ),

                          const SizedBox(height: 28),

                          // Monthly summary
                          const SectionLabel('Monthly Summary', color: Colors.white70),
                          const SizedBox(height: 12),
                          ...(_report!['monthly_summary'] as List? ?? [])
                              .map((m) => Padding(
                                    padding:
                                        const EdgeInsets.only(bottom: 10),
                                    child: PremiumCard(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 16, vertical: 14),
                                      child: Row(
                                        children: [
                                          Container(
                                            width: 44,
                                            height: 44,
                                            decoration: BoxDecoration(
                                              color: AppColors.primaryLight,
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                            ),
                                            child: const Icon(
                                                Icons
                                                    .calendar_month_rounded,
                                                color: AppColors.primary,
                                                size: 20),
                                          ),
                                          const SizedBox(width: 14),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(m['month'],
                                                    style:
                                                        AppType.captionBold),
                                                const SizedBox(height: 2),
                                                Text(
                                                  '${m['milk_litres']}L milk, ${m['extra_items']} extras',
                                                  style: AppType.small
                                                      .copyWith(
                                                          color: AppColors
                                                              .textSecondary),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Text(
                                            '₹${(m['amount'] as num).toStringAsFixed(0)}',
                                            style: AppType.bodyBold.copyWith(
                                                color: AppColors.primary),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )),

                          const SizedBox(height: 80),
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

  Widget _buildEmptyState(BuildContext context) {
    final isProfileComplete =
        context.read<AppAuthProvider>().isProfileComplete;
    if (!isProfileComplete) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(22),
              ),
              child: const Icon(Icons.person_add_rounded,
                  size: 36, color: Colors.white70),
            ),
            const SizedBox(height: 18),
            Text(
              'Profile Incomplete',
              style: AppType.h2.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Complete your profile to view your delivery reports and insights.',
              textAlign: TextAlign.center,
              style: AppType.caption.copyWith(
                color: Colors.white.withValues(alpha: 0.75),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => Navigator.push(
                context,
                SlideUpRoute(page: const CompleteProfileScreen()),
              ),
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: const Text('Complete Profile'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                minimumSize: const Size(200, 48),
              ),
            ),
          ],
        ),
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.error_outline_rounded, size: 48, color: Colors.white54),
        const SizedBox(height: 12),
        Text(
          'Failed to load reports',
          style: AppType.caption.copyWith(color: Colors.white70),
        ),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: () {
            setState(() => _loading = true);
            _loadReport();
          },
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: Colors.white54),
            foregroundColor: Colors.white,
          ),
          child: const Text('Retry'),
        ),
      ],
    );
  }

  Widget _statTile(
      String label, String value, IconData icon, Color color) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 14),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppType.h2.copyWith(color: color, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppType.small.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
