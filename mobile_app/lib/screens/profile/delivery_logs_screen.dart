import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../services/api_service.dart';

class DeliveryLogsScreen extends StatefulWidget {
  const DeliveryLogsScreen({super.key});

  @override
  State<DeliveryLogsScreen> createState() => _DeliveryLogsScreenState();
}

class _DeliveryLogsScreenState extends State<DeliveryLogsScreen> {
  List<dynamic> _orders = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiService().get('/orders?limit=100');
      setState(() {
        _orders = res['data']?['orders'] ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.scaffoldBg,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 16),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Delivery Logs', style: AppType.h2),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                  strokeWidth: 2.5, color: AppColors.primary),
            )
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.cloud_off_rounded,
                          size: 40, color: AppColors.textHint),
                      const SizedBox(height: 12),
                      Text('Failed to load logs',
                          style: AppType.captionBold),
                      const SizedBox(height: 16),
                      ElevatedButton(
                          onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : _orders.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.receipt_long_outlined,
                              size: 48, color: AppColors.textHint),
                          const SizedBox(height: 12),
                          Text('No delivery logs yet',
                              style: AppType.caption.copyWith(
                                  color: AppColors.textSecondary)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                        itemCount: _orders.length,
                        itemBuilder: (context, i) =>
                            _LogRow(order: _orders[i]),
                      ),
                    ),
    );
  }
}

class _LogRow extends StatelessWidget {
  final Map<String, dynamic> order;

  const _LogRow({required this.order});

  Color get _statusColor {
    switch (order['status'] as String?) {
      case 'delivered':
        return AppColors.success;
      case 'skipped':
        return AppColors.error;
      case 'cancelled':
        return const Color(0xFF9CA3AF);
      default:
        return AppColors.warning;
    }
  }

  IconData get _statusIcon {
    switch (order['status'] as String?) {
      case 'delivered':
        return Icons.check_circle_rounded;
      case 'skipped':
        return Icons.event_busy_rounded;
      case 'cancelled':
        return Icons.cancel_rounded;
      default:
        return Icons.schedule_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final milk = order['milk'] as Map<String, dynamic>?;
    final extras = (order['extra_items'] as List?) ?? [];
    final total = (order['total_amount'] as num?)?.toDouble() ?? 0;
    final slot = order['delivery_slot'] as String?;
    final dateStr = order['date'] as String?;
    DateTime? date;
    try {
      if (dateStr != null) date = DateTime.parse(dateStr);
    } catch (_) {}

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: PremiumCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_statusIcon, color: _statusColor, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    date != null
                        ? DateFormat('EEE, d MMM yyyy').format(date)
                        : (dateStr ?? ''),
                    style: AppType.captionBold,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _subtitle(milk, extras.length, slot),
                    style: AppType.small
                        .copyWith(color: AppColors.textSecondary),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '₹${total.toStringAsFixed(0)}',
                  style: AppType.captionBold,
                ),
                const SizedBox(height: 2),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: _statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Text(
                    (order['status'] as String? ?? '').toUpperCase(),
                    style: AppType.micro.copyWith(
                      color: _statusColor,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _subtitle(Map<String, dynamic>? milk, int extraCount, String? slot) {
    final parts = <String>[];
    if (milk != null) {
      final type = (milk['milk_type'] as String? ?? '').toUpperCase();
      final qty = milk['quantity_litres'];
      if (type.isNotEmpty && qty != null) parts.add('$type ${qty}L');
    }
    if (extraCount > 0) parts.add('$extraCount extra${extraCount > 1 ? 's' : ''}');
    if (slot != null && slot.isNotEmpty) {
      parts.add(slot[0].toUpperCase() + slot.substring(1));
    }
    return parts.isEmpty ? 'No details' : parts.join(' · ');
  }
}
