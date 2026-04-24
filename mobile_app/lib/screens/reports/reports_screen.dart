import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/delivery_calendar.dart';
import '../../services/api_service.dart';

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
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
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
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline_rounded,
                            size: 48, color: AppColors.textHint),
                        const SizedBox(height: 12),
                        Text('Failed to load reports',
                            style: AppType.caption
                                .copyWith(color: AppColors.textSecondary)),
                      ],
                    ),
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
                                    Text('Reports & Insights', style: AppType.h1),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Your delivery analytics at a glance',
                                      style: AppType.caption
                                          .copyWith(color: AppColors.textSecondary),
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
                                  'Skipped',
                                  '${_report!['total_skipped_days']} days',
                                  Icons.event_busy_rounded,
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
                          const SectionLabel('Monthly Summary'),
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
