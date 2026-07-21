import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../theme/instant_theme.dart';
import '../../widgets/premium_components.dart';
import '../../services/api_service.dart';
import '../../utils/delivery_status.dart';

class DeliveryLogsScreen extends StatefulWidget {
  const DeliveryLogsScreen({super.key});

  @override
  State<DeliveryLogsScreen> createState() => _DeliveryLogsScreenState();
}

class _DeliveryLogsScreenState extends State<DeliveryLogsScreen> {
  List<dynamic> _orders = [];
  bool _loading = true;
  String? _error;

  /// Reshape an instant order into the row shape this log renders.
  ///
  /// Instant orders carry `items[]` with `product_name`, whereas the scheduled
  /// rows expect `extra_items[]` with `name` and no milk line. Normalising here
  /// keeps [_LogRow] unaware that two different order systems exist.
  static Map<String, dynamic> _instantAsLogEntry(Map<String, dynamic> order) {
    return {
      ...order,
      'order_type': 'instant',
      'milk': null,
      'delivery_slot': null,
      'extra_items': ((order['items'] as List?) ?? [])
          .whereType<Map>()
          .map((i) => {
                ...Map<String, dynamic>.from(i),
                'name': i['product_name'] ?? i['name'],
              })
          .toList(),
    };
  }

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
      // Scheduled and instant deliveries live in two separate collections, so
      // this log has to read both — otherwise a delivered instant order never
      // shows up here at all.
      final results = await Future.wait([
        ApiService().get('/orders?limit=100'),
        ApiService().get('/instant/orders?limit=100'),
      ]);

      final scheduled = (results[0]['data']?['orders'] as List?) ?? [];
      final instant = ((results[1]['data']?['orders'] as List?) ?? [])
          .whereType<Map>()
          .map((o) => _instantAsLogEntry(Map<String, dynamic>.from(o)))
          .toList();

      final merged = [...scheduled, ...instant]
        ..sort((a, b) {
          final da = (a as Map)['date']?.toString() ?? '';
          final db = (b as Map)['date']?.toString() ?? '';
          return db.compareTo(da); // newest first
        });

      setState(() {
        _orders = merged;
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
                strokeWidth: 2.5,
                color: AppColors.primary,
              ),
            )
          : _error != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.cloud_off_rounded,
                    size: 40,
                    color: AppColors.textHint,
                  ),
                  const SizedBox(height: 12),
                  Text('Failed to load logs', style: AppType.captionBold),
                  const SizedBox(height: 16),
                  ElevatedButton(onPressed: _load, child: const Text('Retry')),
                ],
              ),
            )
          : _orders.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.receipt_long_outlined,
                    size: 48,
                    color: AppColors.textHint,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No delivery logs yet',
                    style: AppType.caption.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _load,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final horizontalPadding = constraints.maxWidth < 360
                      ? 12.0
                      : 20.0;

                  return ListView.builder(
                    padding: EdgeInsets.fromLTRB(
                      horizontalPadding,
                      8,
                      horizontalPadding,
                      32,
                    ),
                    itemCount: _orders.length,
                    itemBuilder: (context, i) => Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 600),
                        child: _LogRow(order: _orders[i]),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}

class _LogRow extends StatelessWidget {
  final Map<String, dynamic> order;

  const _LogRow({required this.order});

  Color get _statusColor => DeliveryStatus.color(order['status'] as String?);

  IconData get _statusIcon => DeliveryStatus.icon(order['status'] as String?);

  @override
  Widget build(BuildContext context) {
    final milkData = order['milk'];
    final milk = milkData is Map ? Map<String, dynamic>.from(milkData) : null;
    final extras = ((order['extra_items'] as List?) ?? [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    final total = (order['total_amount'] as num?)?.toDouble() ?? 0;
    final slot = order['delivery_slot'] as String?;
    final status = order['status'] as String?;
    final notes = order['notes']?.toString().trim() ?? '';
    final dateStr = order['date'] as String?;
    DateTime? date;
    try {
      if (dateStr != null) date = DateTime.parse(dateStr);
    } catch (_) {}
    final dateLabel = date != null
        ? DateFormat('EEEE, d MMMM yyyy').format(date)
        : (dateStr?.isNotEmpty == true ? dateStr! : 'Date unavailable');
    final isNotDelivered = DeliveryStatus.normalize(status) == 'not_delivered';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PremiumCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
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
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(dateLabel, style: AppType.captionBold),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          _LogBadge(
                            label: DeliveryStatus.label(status).toUpperCase(),
                            color: _statusColor,
                          ),
                          if (order['order_type'] == 'instant')
                            const _LogBadge(
                              label: 'INSTANT',
                              color: InstantColors.primary,
                              icon: Icons.bolt_rounded,
                            ),
                          if (slot != null && slot.isNotEmpty)
                            _LogBadge(
                              label: _capitalize(slot),
                              color: AppColors.primary,
                              icon: Icons.schedule_rounded,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _OrderTotalRow(total: total),
            if (isNotDelivered) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  DeliveryStatus.notDeliveredExplanation(order),
                  style: AppType.small.copyWith(color: AppColors.error),
                ),
              ),
            ],
            if (milk != null || extras.isNotEmpty) ...[
              const SizedBox(height: 14),
              if (milk != null)
                _LogDetailTile(
                  icon: Icons.water_drop_rounded,
                  iconColor: AppColors.primary,
                  title: _milkTitle(milk),
                  subtitle: _milkDescription(milk),
                  amount: _milkSubtotal(milk),
                ),
              for (var index = 0; index < extras.length; index++) ...[
                if (milk != null || index > 0) const SizedBox(height: 8),
                _LogDetailTile(
                  icon: Icons.shopping_bag_rounded,
                  iconColor: const Color(0xFF8B5CF6),
                  title: _extraName(extras[index]),
                  subtitle: _extraDescription(extras[index]),
                  amount: extras[index]['total'] as num?,
                ),
              ],
            ] else if (!isNotDelivered) ...[
              const SizedBox(height: 14),
              const _LogDetailTile(
                icon: Icons.inventory_2_outlined,
                iconColor: AppColors.textHint,
                title: 'No items recorded',
                subtitle: 'There are no product details for this delivery.',
              ),
            ],
            if (notes.isNotEmpty) ...[
              const SizedBox(height: 8),
              _LogDetailTile(
                icon: Icons.notes_rounded,
                iconColor: AppColors.textSecondary,
                title: 'Delivery note',
                subtitle: notes,
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _milkTitle(Map<String, dynamic> milk) {
    final type = milk['milk_type']?.toString().trim() ?? '';
    return type.isEmpty ? 'Milk delivery' : '${type.toUpperCase()} Milk';
  }

  String _milkDescription(Map<String, dynamic> milk) {
    final details = <String>[];
    final quantity = milk['quantity_litres'];
    final price = milk['price_per_litre'] as num?;

    if (quantity != null) details.add('${_formatValue(quantity)} L');
    if (price != null) details.add('${_money(price)} / L');

    return details.isEmpty ? 'Milk details unavailable' : details.join(' at ');
  }

  num? _milkSubtotal(Map<String, dynamic> milk) {
    final subtotal = milk['total'] as num?;
    if (subtotal != null) return subtotal;

    final quantity = milk['quantity_litres'];
    final price = milk['price_per_litre'];
    if (quantity is num && price is num) return quantity * price;
    return null;
  }

  String _extraName(Map<String, dynamic> item) {
    final name = item['product_name'] ?? item['name'];
    final label = name?.toString().trim() ?? '';
    return label.isEmpty ? 'Extra item' : label;
  }

  String _extraDescription(Map<String, dynamic> item) {
    final quantity = item['quantity'];
    return quantity == null ? 'Quantity unavailable' : 'Qty: $quantity';
  }

  String _capitalize(String text) {
    return text.isEmpty ? text : text[0].toUpperCase() + text.substring(1);
  }

  String _formatValue(dynamic value) {
    if (value is num && value == value.roundToDouble()) {
      return value.toInt().toString();
    }
    return value.toString();
  }

  String _money(num amount) => '\u20B9${amount.toStringAsFixed(0)}';
}

class _LogBadge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;

  const _LogBadge({required this.label, required this.color, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, color: color, size: 13),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppType.micro.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderTotalRow extends StatelessWidget {
  final double total;

  const _OrderTotalRow({required this.total});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 16,
        runSpacing: 6,
        children: [
          Text(
            'Order total',
            style: AppType.small.copyWith(color: AppColors.textSecondary),
          ),
          Text(
            '\u20B9${total.toStringAsFixed(0)}',
            style: AppType.captionBold.copyWith(color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}

class _LogDetailTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final num? amount;

  const _LogDetailTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.amount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceBg.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 17, color: iconColor),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppType.captionBold),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: AppType.small.copyWith(color: AppColors.textSecondary),
                ),
                if (amount != null) ...[
                  const SizedBox(height: 5),
                  Text(
                    'Subtotal: \u20B9${amount!.toStringAsFixed(0)}',
                    style: AppType.small.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
