import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';
import '../providers/calendar_provider.dart';
import 'premium_components.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Entry point (kept for backward compat)
// ─────────────────────────────────────────────────────────────────────────────

void showDeliveryCalendar(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => ChangeNotifierProvider.value(
      value: context.read<CalendarProvider>(),
      child: const _CalendarSheet(),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline calendar card — embed directly in a parent ListView
// ─────────────────────────────────────────────────────────────────────────────

class DeliveryCalendarCard extends StatefulWidget {
  const DeliveryCalendarCard({super.key});

  @override
  State<DeliveryCalendarCard> createState() => _DeliveryCalendarCardState();
}

class _DeliveryCalendarCardState extends State<DeliveryCalendarCard> {
  late DateTime _focusedMonth;

  @override
  void initState() {
    super.initState();
    _focusedMonth = DateTime(DateTime.now().year, DateTime.now().month);
    _load();
  }

  String get _monthKey => DateFormat('yyyy-MM').format(_focusedMonth);

  void _load() {
    Future.microtask(() {
      if (mounted) context.read<CalendarProvider>().loadMonth(_monthKey);
    });
  }

  void _prevMonth() {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month - 1);
    });
    _load();
  }

  void _nextMonth() {
    final now = DateTime.now();
    final next = DateTime(_focusedMonth.year, _focusedMonth.month + 1);
    if (next.isAfter(DateTime(now.year, now.month))) return;
    setState(() => _focusedMonth = next);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<CalendarProvider>(
      builder: (context, cal, _) {
        final loading = cal.isLoading(_monthKey);
        final days = cal.dayMap(_monthKey);
        final summary = cal.summary(_monthKey);

        return PremiumCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _MonthNavigator(
                month: _focusedMonth,
                onPrev: _prevMonth,
                onNext: _nextMonth,
                canGoNext: DateTime(_focusedMonth.year, _focusedMonth.month + 1)
                    .isBefore(DateTime(
                        DateTime.now().year, DateTime.now().month + 1)),
              ),

              const SizedBox(height: 12),
              const _Legend(),
              const SizedBox(height: 12),

              if (loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Center(
                    child: CircularProgressIndicator(
                        strokeWidth: 2.5, color: AppColors.primary),
                  ),
                )
              else if (cal.error != null && days.isEmpty)
                _ErrorState(
                    onRetry: () =>
                        cal.loadMonth(_monthKey, forceRefresh: true))
              else
                _CalendarGrid(
                  month: _focusedMonth,
                  days: days,
                  onDayTap: (date, data) =>
                      _showDayDetail(context, date, data),
                ),

              if (!loading && summary != null) ...[
                const SizedBox(height: 14),
                _SummaryRow(summary: summary),
              ],

              if (!loading && days.isNotEmpty) ...[
                const SizedBox(height: 14),
                _MonthStatsCard(days: days),
              ],
            ],
          ),
        );
      },
    );
  }

  void _showDayDetail(
      BuildContext context, DateTime date, Map<String, dynamic>? data) {
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _DayDetailSheet(date: date, data: data),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable calendar icon button (kept for other screens)
// ─────────────────────────────────────────────────────────────────────────────

class CalendarIconButton extends StatelessWidget {
  const CalendarIconButton({super.key});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => showDeliveryCalendar(context),
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
        child: const Icon(Icons.calendar_month_rounded,
            size: 22, color: AppColors.textPrimary),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

class _CalendarSheet extends StatefulWidget {
  const _CalendarSheet();

  @override
  State<_CalendarSheet> createState() => _CalendarSheetState();
}

class _CalendarSheetState extends State<_CalendarSheet> {
  late DateTime _focusedMonth;

  @override
  void initState() {
    super.initState();
    _focusedMonth = DateTime(DateTime.now().year, DateTime.now().month);
    _load();
  }

  String get _monthKey => DateFormat('yyyy-MM').format(_focusedMonth);

  void _load() {
    Future.microtask(() {
      if (mounted) context.read<CalendarProvider>().loadMonth(_monthKey);
    });
  }

  void _prevMonth() {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month - 1);
    });
    _load();
  }

  void _nextMonth() {
    final now = DateTime.now();
    final next = DateTime(_focusedMonth.year, _focusedMonth.month + 1);
    if (next.isAfter(DateTime(now.year, now.month))) return;
    setState(() => _focusedMonth = next);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.of(context).size.height;

    return Container(
      height: screenH * 0.92,
      decoration: const BoxDecoration(
        color: AppColors.scaffoldBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Delivery Calendar', style: AppType.h2),
                      Text(
                        'Tap any day to see details',
                        style: AppType.small
                            .copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),
          const Divider(height: 1),

          Expanded(
            child: Consumer<CalendarProvider>(
              builder: (context, cal, _) {
                final loading = cal.isLoading(_monthKey);
                final days = cal.dayMap(_monthKey);
                final summary = cal.summary(_monthKey);

                return ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                  children: [
                    _MonthNavigator(
                      month: _focusedMonth,
                      onPrev: _prevMonth,
                      onNext: _nextMonth,
                      canGoNext: DateTime(_focusedMonth.year,
                              _focusedMonth.month + 1)
                          .isBefore(DateTime(DateTime.now().year,
                              DateTime.now().month + 1)),
                    ),

                    const SizedBox(height: 16),

                    if (!loading && days.isNotEmpty) ...[
                      _MonthStatsCard(days: days),
                      const SizedBox(height: 16),
                    ],

                    const _Legend(),
                    const SizedBox(height: 16),

                    if (cal.error != null && days.isEmpty && !loading)
                      _ErrorState(
                          onRetry: () =>
                              cal.loadMonth(_monthKey, forceRefresh: true))
                    else if (loading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Center(
                          child: CircularProgressIndicator(
                              strokeWidth: 2.5, color: AppColors.primary),
                        ),
                      )
                    else
                      _CalendarGrid(
                        month: _focusedMonth,
                        days: days,
                        onDayTap: (date, data) =>
                            _showDayDetail(context, date, data),
                      ),

                    if (!loading && summary != null) ...[
                      const SizedBox(height: 20),
                      _SummaryRow(summary: summary),
                    ],

                    if (!loading && days.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      _RecentDeliveriesLog(days: days),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showDayDetail(
      BuildContext context, DateTime date, Map<String, dynamic>? data) {
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _DayDetailSheet(date: date, data: data),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Month stats card — total spent + litres delivered this month
// ─────────────────────────────────────────────────────────────────────────────

class _MonthStatsCard extends StatelessWidget {
  final Map<String, dynamic> days;

  const _MonthStatsCard({required this.days});

  @override
  Widget build(BuildContext context) {
    double totalSpent = 0;
    double totalLitres = 0;
    int deliveredCount = 0;

    for (final entry in days.values) {
      final d = entry as Map<String, dynamic>;
      if (d['status'] == 'delivered') {
        totalSpent += (d['total_amount'] as num? ?? 0).toDouble();
        final milk = d['milk'] as Map<String, dynamic>?;
        if (milk != null) {
          totalLitres +=
              (milk['quantity_litres'] as num? ?? 0).toDouble();
        }
        deliveredCount++;
      }
    }

    return PremiumCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          _StatChip(
            icon: Icons.currency_rupee_rounded,
            iconColor: AppColors.primary,
            label: 'Month Spend',
            value: '₹${totalSpent.toStringAsFixed(0)}',
          ),
          Container(width: 1, height: 40, color: AppColors.border,
              margin: const EdgeInsets.symmetric(horizontal: 12)),
          _StatChip(
            icon: Icons.water_drop_rounded,
            iconColor: const Color(0xFF06B6D4),
            label: 'Litres Delivered',
            value: '${totalLitres.toStringAsFixed(1)}L',
          ),
          Container(width: 1, height: 40, color: AppColors.border,
              margin: const EdgeInsets.symmetric(horizontal: 12)),
          _StatChip(
            icon: Icons.check_circle_outline_rounded,
            iconColor: AppColors.success,
            label: 'Deliveries',
            value: '$deliveredCount days',
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;

  const _StatChip({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 16, color: iconColor),
          const SizedBox(height: 4),
          Text(value,
              style: AppType.captionBold.copyWith(color: AppColors.textPrimary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          Text(label,
              style: AppType.micro.copyWith(color: AppColors.textSecondary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error state
// ─────────────────────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;

  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.cloud_off_rounded,
                size: 36, color: AppColors.textHint),
            const SizedBox(height: 10),
            Text('Could not load calendar',
                style: AppType.captionBold
                    .copyWith(color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text('Pull down to retry',
                style:
                    AppType.small.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: onRetry,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('Retry',
                    style:
                        AppType.captionBold.copyWith(color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Month navigator
// ─────────────────────────────────────────────────────────────────────────────

class _MonthNavigator extends StatelessWidget {
  final DateTime month;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final bool canGoNext;

  const _MonthNavigator({
    required this.month,
    required this.onPrev,
    required this.onNext,
    required this.canGoNext,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _navBtn(Icons.chevron_left_rounded, onPrev, true),
        Text(DateFormat('MMMM yyyy').format(month), style: AppType.h3),
        _navBtn(Icons.chevron_right_rounded, onNext, canGoNext),
      ],
    );
  }

  Widget _navBtn(IconData icon, VoidCallback onTap, bool enabled) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: enabled ? AppColors.primaryLight : AppColors.surfaceBg,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon,
            size: 20,
            color: enabled ? AppColors.primary : AppColors.textHint),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────────

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: const [
        _LegendDot(color: AppColors.success, label: 'Delivered'),
        _LegendDot(color: AppColors.warning, label: 'Pending'),
        _LegendDot(color: AppColors.error, label: 'Skipped'),
        _LegendDot(color: Color(0xFF9CA3AF), label: 'Cancelled'),
      ],
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(label,
            style: AppType.small.copyWith(color: AppColors.textSecondary)),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar grid
// ─────────────────────────────────────────────────────────────────────────────

class _CalendarGrid extends StatelessWidget {
  final DateTime month;
  final Map<String, dynamic> days;
  final void Function(DateTime date, Map<String, dynamic>? data) onDayTap;

  const _CalendarGrid({
    required this.month,
    required this.days,
    required this.onDayTap,
  });

  @override
  Widget build(BuildContext context) {
    final firstDay = DateTime(month.year, month.month, 1);
    final daysInMonth = DateUtils.getDaysInMonth(month.year, month.month);
    final startOffset = (firstDay.weekday % 7);
    final today = DateTime.now();

    return Column(
      children: [
        Row(
          children: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
              .map((d) => Expanded(
                    child: Center(
                      child: Text(d,
                          style: AppType.micro.copyWith(
                              color: AppColors.textHint,
                              fontWeight: FontWeight.w700)),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            mainAxisSpacing: 6,
            crossAxisSpacing: 4,
            childAspectRatio: 0.80,
          ),
          itemCount: startOffset + daysInMonth,
          itemBuilder: (context, index) {
            if (index < startOffset) return const SizedBox();
            final day = index - startOffset + 1;
            final date = DateTime(month.year, month.month, day);
            final dateKey = DateFormat('yyyy-MM-dd').format(date);
            final data = days[dateKey] as Map<String, dynamic>?;
            final isFuture = date.isAfter(today);
            final isToday = DateUtils.isSameDay(date, today);

            return _DayCell(
              day: day,
              data: data,
              isToday: isToday,
              isFuture: isFuture,
              onTap: () => onDayTap(date, data),
            );
          },
        ),
      ],
    );
  }
}

class _DayCell extends StatelessWidget {
  final int day;
  final Map<String, dynamic>? data;
  final bool isToday;
  final bool isFuture;
  final VoidCallback onTap;

  const _DayCell({
    required this.day,
    required this.data,
    required this.isToday,
    required this.isFuture,
    required this.onTap,
  });

  Color get _statusColor {
    switch (data?['status'] as String?) {
      case 'delivered':
        return AppColors.success;
      case 'pending':
        return AppColors.warning;
      case 'skipped':
        return AppColors.error;
      case 'cancelled':
        return const Color(0xFF9CA3AF);
      default:
        return Colors.transparent;
    }
  }

  // First letter of milk type for delivered days: C / B / P
  String? get _milkInitial {
    if (data?['status'] != 'delivered') return null;
    final milkType =
        (data?['milk'] as Map<String, dynamic>?)?['milk_type'] as String?;
    return milkType?.isNotEmpty == true
        ? milkType![0].toUpperCase()
        : null;
  }

  @override
  Widget build(BuildContext context) {
    final dotColor = _statusColor;
    final initial = _milkInitial;
    final hasData = data != null;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: isToday
              ? AppColors.primary.withValues(alpha: 0.1)
              : hasData
                  ? dotColor.withValues(alpha: 0.07)
                  : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: isToday
              ? Border.all(color: AppColors.primary, width: 1.5)
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '$day',
              style: AppType.small.copyWith(
                color: isFuture
                    ? AppColors.textHint
                    : isToday
                        ? AppColors.primary
                        : AppColors.textPrimary,
                fontWeight: isToday ? FontWeight.w800 : FontWeight.w500,
              ),
            ),
            const SizedBox(height: 2),
            if (initial != null)
              Text(
                initial,
                style: TextStyle(
                  fontSize: 8,
                  fontWeight: FontWeight.w800,
                  color: dotColor,
                  height: 1.1,
                ),
              )
            else
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary row
// ─────────────────────────────────────────────────────────────────────────────

class _SummaryRow extends StatelessWidget {
  final Map<String, dynamic> summary;

  const _SummaryRow({required this.summary});

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _SummaryTile(
              count: summary['delivered'] ?? 0,
              label: 'Delivered',
              color: AppColors.success),
          _vDivider(),
          _SummaryTile(
              count: summary['pending'] ?? 0,
              label: 'Pending',
              color: AppColors.warning),
          _vDivider(),
          _SummaryTile(
              count: summary['skipped'] ?? 0,
              label: 'Skipped',
              color: AppColors.error),
          _vDivider(),
          _SummaryTile(
              count: summary['cancelled'] ?? 0,
              label: 'Cancelled',
              color: const Color(0xFF9CA3AF)),
        ],
      ),
    );
  }

  Widget _vDivider() =>
      Container(width: 1, height: 32, color: AppColors.border);
}

class _SummaryTile extends StatelessWidget {
  final int count;
  final String label;
  final Color color;

  const _SummaryTile(
      {required this.count, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$count',
          style: AppType.h2.copyWith(color: color, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 2),
        Text(label,
            style: AppType.micro.copyWith(color: AppColors.textSecondary)),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent deliveries log — last 5 delivered days, newest first
// ─────────────────────────────────────────────────────────────────────────────

class _RecentDeliveriesLog extends StatelessWidget {
  final Map<String, dynamic> days;

  const _RecentDeliveriesLog({required this.days});

  @override
  Widget build(BuildContext context) {
    final delivered = days.entries
        .where((e) => (e.value as Map<String, dynamic>)['status'] == 'delivered')
        .toList()
      ..sort((a, b) => b.key.compareTo(a.key)); // newest first

    if (delivered.isEmpty) return const SizedBox.shrink();

    final recent = delivered.take(5).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.history_rounded,
                size: 16, color: AppColors.textSecondary),
            const SizedBox(width: 6),
            Text('Recent Deliveries',
                style: AppType.captionBold
                    .copyWith(color: AppColors.textPrimary)),
          ],
        ),
        const SizedBox(height: 10),
        ...recent.map((entry) {
          final date = DateTime.parse(entry.key);
          final d = entry.value as Map<String, dynamic>;
          final milk = d['milk'] as Map<String, dynamic>?;
          final extras = (d['extra_items'] as List?) ?? [];
          final total = (d['total_amount'] as num?)?.toDouble() ?? 0;
          final slot = d['delivery_slot'] as String?;
          final milkType =
              (milk?['milk_type'] as String? ?? '').toUpperCase();
          final qty = milk?['quantity_litres'];

          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: PremiumCard(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.check_circle_rounded,
                        size: 20, color: AppColors.success),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          DateFormat('EEE, d MMM').format(date),
                          style: AppType.captionBold,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _buildSubtitle(
                              milkType, qty, extras.length, slot),
                          style: AppType.small
                              .copyWith(color: AppColors.textSecondary),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '₹${total.toStringAsFixed(0)}',
                    style: AppType.captionBold
                        .copyWith(color: AppColors.primary),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  String _buildSubtitle(
      String milkType, dynamic qty, int extraCount, String? slot) {
    final parts = <String>[];
    if (milkType.isNotEmpty && qty != null) {
      parts.add('$milkType ${qty}L');
    }
    if (extraCount > 0) {
      parts.add('$extraCount extra${extraCount > 1 ? 's' : ''}');
    }
    if (slot != null && slot.isNotEmpty) {
      parts.add(slot[0].toUpperCase() + slot.substring(1));
    }
    return parts.join(' · ');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Day detail bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

class _DayDetailSheet extends StatelessWidget {
  final DateTime date;
  final Map<String, dynamic>? data;

  const _DayDetailSheet({required this.date, required this.data});

  Color get _statusColor {
    switch (data?['status']) {
      case 'delivered':
        return AppColors.success;
      case 'pending':
        return AppColors.warning;
      case 'skipped':
        return AppColors.error;
      case 'cancelled':
        return const Color(0xFF9CA3AF);
      default:
        return AppColors.textHint;
    }
  }

  IconData get _statusIcon {
    switch (data?['status']) {
      case 'delivered':
        return Icons.check_circle_rounded;
      case 'pending':
        return Icons.schedule_rounded;
      case 'skipped':
        return Icons.event_busy_rounded;
      case 'cancelled':
        return Icons.cancel_rounded;
      default:
        return Icons.info_outline_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = data?['status'] as String?;
    final milk = data?['milk'] as Map<String, dynamic>?;
    final extras = (data?['extra_items'] as List?) ?? [];
    final total = (data?['total_amount'] as num?)?.toDouble() ?? 0;
    final slot = data?['delivery_slot'] as String?;
    final orderId = data?['order_id'] as String?;
    final color = _statusColor;
    final isFuture = date.isAfter(DateTime.now());

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).padding.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 20),

          // Date + status header
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(_statusIcon, color: color, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('EEEE, d MMMM yyyy').format(date),
                      style: AppType.h3,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _StatusBadge(
                          label: status != null
                              ? status.toUpperCase()
                              : isFuture
                                  ? 'UPCOMING'
                                  : 'NO RECORD',
                          color: color,
                        ),
                        if (slot != null && slot.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          _SlotBadge(slot: slot),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (data == null) ...[
            const SizedBox(height: 20),
            Center(
              child: Text(
                isFuture
                    ? 'No delivery scheduled for this day.'
                    : 'No delivery recorded for this day.',
                style: AppType.caption
                    .copyWith(color: AppColors.textSecondary),
              ),
            ),
          ] else ...[
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 16),

            if (milk != null) ...[
              _DetailRow(
                icon: Icons.water_drop_rounded,
                iconColor: AppColors.primary,
                title:
                    '${(milk['milk_type'] as String? ?? '').toUpperCase()} Milk',
                subtitle:
                    '${milk['quantity_litres']}L · ₹${milk['price_per_litre']}/L',
                trailing:
                    '₹${((milk['quantity_litres'] as num) * (milk['price_per_litre'] as num)).toStringAsFixed(0)}',
              ),
              const SizedBox(height: 10),
            ],

            if (extras.isNotEmpty) ...[
              Text('Extra Items',
                  style: AppType.small
                      .copyWith(color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              ...extras.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _DetailRow(
                      icon: Icons.shopping_bag_rounded,
                      iconColor: const Color(0xFF8B5CF6),
                      title: item['product_name'] ?? item['name'] ?? '',
                      subtitle: 'Qty: ${item['quantity']}',
                      trailing:
                          '₹${((item['total'] as num?) ?? 0).toStringAsFixed(0)}',
                    ),
                  )),
            ],

            if (total > 0) ...[
              const SizedBox(height: 8),
              const Divider(),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Total', style: AppType.bodyBold),
                  Text(
                    '₹${total.toStringAsFixed(2)}',
                    style: AppType.h3.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ],

            // Order reference footer
            if (orderId != null && orderId.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.receipt_long_rounded,
                      size: 12, color: AppColors.textHint),
                  const SizedBox(width: 4),
                  Text(
                    'Order #${orderId.length > 8 ? orderId.substring(orderId.length - 8) : orderId}',
                    style: AppType.micro
                        .copyWith(color: AppColors.textHint),
                  ),
                ],
              ),
            ],
          ],

          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label,
          style: AppType.micro
              .copyWith(color: color, fontWeight: FontWeight.w700)),
    );
  }
}

class _SlotBadge extends StatelessWidget {
  final String slot;

  const _SlotBadge({required this.slot});

  @override
  Widget build(BuildContext context) {
    final isMorning = slot.toLowerCase() == 'morning';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.surfaceBg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isMorning ? Icons.wb_sunny_rounded : Icons.nights_stay_rounded,
            size: 10,
            color: isMorning
                ? const Color(0xFFF59E0B)
                : const Color(0xFF6366F1),
          ),
          const SizedBox(width: 3),
          Text(
            slot[0].toUpperCase() + slot.substring(1),
            style: AppType.micro.copyWith(
                color: AppColors.textSecondary, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String trailing;

  const _DetailRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: iconColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: AppType.captionBold,
                  overflow: TextOverflow.ellipsis),
              Text(subtitle,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.small
                      .copyWith(color: AppColors.textSecondary)),
            ],
          ),
        ),
        Text(trailing, style: AppType.captionBold),
      ],
    );
  }
}
