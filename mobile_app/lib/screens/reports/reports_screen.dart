import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Map<String, dynamic>? _report;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  Future<void> _loadReport() async {
    try {
      final res = await ApiService().get('/reports/user/summary');
      setState(() {
        _report = res['data'];
        _loading = false;
      });
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
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2.5))
            : _report == null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline_rounded, size: 48, color: AppColors.textHint),
                        const SizedBox(height: 12),
                        const Text('Failed to load reports', style: TextStyle(color: AppColors.textSecondary)),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: _loadReport,
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      children: [
                        const SizedBox(height: 20),
                        const Text(
                          'Reports & Insights',
                          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.3),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Your delivery analytics at a glance',
                          style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
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
                                'Rs.${(_report!['total_spent'] as num).toStringAsFixed(0)}',
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
                        ...(_report!['monthly_summary'] as List? ?? []).map((m) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: PremiumCard(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        color: AppColors.primaryLight,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: const Icon(Icons.calendar_month_rounded, color: AppColors.primary, size: 20),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            m['month'],
                                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '${m['milk_litres']}L milk, ${m['extra_items']} extras',
                                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Text(
                                      'Rs.${(m['amount'] as num).toStringAsFixed(0)}',
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.primary),
                                    ),
                                  ],
                                ),
                              ),
                            )),

                        const SizedBox(height: 28),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _statTile(String label, String value, IconData icon, Color color) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withAlpha(20),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 14),
          Text(
            value,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
