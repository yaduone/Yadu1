import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../providers/instant_provider.dart';
import '../../theme/instant_theme.dart';
import '../../theme/app_typography.dart';
import 'instant_order_status_screen.dart';

/// Logs page listing all past instant orders with price and date.
class InstantOrderLogsScreen extends StatefulWidget {
  const InstantOrderLogsScreen({super.key});

  @override
  State<InstantOrderLogsScreen> createState() => _InstantOrderLogsScreenState();
}

class _InstantOrderLogsScreenState extends State<InstantOrderLogsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Force a refresh: the cached list may predate a delivery or rejection
      // that happened while the user was elsewhere in the app, and a plain
      // loadOrders() would return the stale copy without re-fetching.
      context.read<InstantProvider>().loadOrders(forceRefresh: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InstantProvider>();
    final loading = !provider.ordersLoaded;
    final orders = provider.orders;

    return Scaffold(
      backgroundColor: InstantColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: InstantColors.scaffoldBg,
        elevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: InstantColors.primary.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 16),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Instant Order Logs',
          style: AppType.h2.copyWith(color: InstantColors.textPrimary),
        ),
      ),
      body: loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: InstantColors.primary,
              ),
            )
          : orders.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.receipt_long_outlined,
                    size: 48,
                    color: InstantColors.textHint,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No instant orders yet',
                    style: AppType.caption.copyWith(
                      color: InstantColors.textSecondary,
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              color: InstantColors.primary,
              onRefresh: () => provider.loadOrders(forceRefresh: true),
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                itemCount: orders.length,
                itemBuilder: (context, i) =>
                    _OrderLogCard(order: orders[i] as Map<String, dynamic>),
              ),
            ),
    );
  }
}

class _OrderLogCard extends StatelessWidget {
  final Map<String, dynamic> order;

  const _OrderLogCard({required this.order});

  // Every status the server can return is handled explicitly. Falling back to
  // "ON THE WAY" would misreport a rejected or still-unaccepted order as being
  // out for delivery.
  Color get _statusColor {
    switch (order['status']) {
      case 'delivered':
        return InstantColors.success;
      case 'cancelled':
      case 'rejected':
        return InstantColors.error;
      case 'pending':
        return const Color(0xFFF59E0B); // amber — awaiting the store
      default:
        return InstantColors.primary;
    }
  }

  String get _statusLabel {
    switch (order['status']) {
      case 'delivered':
        return 'DELIVERED';
      case 'cancelled':
        return 'CANCELLED';
      case 'rejected':
        return 'NOT ACCEPTED';
      case 'pending':
        return 'REQUESTED';
      default:
        return 'ON THE WAY';
    }
  }

  String get _dateLabel {
    final placedAt = order['placed_at'];
    DateTime? date;
    if (placedAt is String) {
      try {
        date = DateTime.parse(placedAt);
      } catch (_) {}
    } else if (placedAt is Map && placedAt['_seconds'] != null) {
      date = DateTime.fromMillisecondsSinceEpoch(
        (placedAt['_seconds'] as int) * 1000,
      );
    }
    date ??= () {
      final d = order['date'] as String?;
      if (d == null) return null;
      try {
        return DateTime.parse(d);
      } catch (_) {
        return null;
      }
    }();
    if (date == null) return order['date']?.toString() ?? 'Date unavailable';
    return DateFormat('EEEE, d MMMM yyyy · h:mm a').format(date);
  }

  @override
  Widget build(BuildContext context) {
    final items = (order['items'] as List? ?? const [])
        .whereType<Map>()
        .map((i) => Map<String, dynamic>.from(i))
        .toList();
    final total = (order['total_amount'] as num?)?.toDouble() ?? 0;
    final deliveryCharge = (order['delivery_charge'] as num?)?.toDouble() ?? 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GestureDetector(
        // Any order opens the same live status screen, so the tracker is reachable
        // from history too — not just straight after checkout.
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => InstantOrderStatusScreen(order: order),
          ),
        ),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: InstantColors.border),
            boxShadow: [
              BoxShadow(
                color: InstantColors.primary.withValues(alpha: 0.05),
                blurRadius: 12,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _dateLabel,
                          style: AppType.captionBold.copyWith(
                            color: InstantColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: _statusColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _statusLabel,
                            style: AppType.micro.copyWith(
                              color: _statusColor,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '₹${total.toStringAsFixed(0)}',
                    style: AppType.h3.copyWith(
                      color: InstantColors.primary,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ...items.map((item) {
                final cover =
                    item['cover_image_small'] ?? item['cover_image_large'];
                final imageUrl = cover is String ? cover : '';
                final name = item['product_name'] as String? ?? '';
                final qty = (item['quantity'] as num?)?.toInt() ?? 0;
                final itemTotal = (item['total'] as num?)?.toDouble() ?? 0;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SizedBox(
                          width: 30,
                          height: 30,
                          child: imageUrl.isEmpty
                              ? Container(
                                  color: InstantColors.primaryLight,
                                  child: const Icon(
                                    Icons.shopping_bag_rounded,
                                    size: 15,
                                    color: InstantColors.primary,
                                  ),
                                )
                              : CachedNetworkImage(
                                  imageUrl: imageUrl,
                                  fit: BoxFit.cover,
                                  memCacheWidth: 80,
                                ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          '$name × $qty',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.small.copyWith(
                            color: InstantColors.textSecondary,
                          ),
                        ),
                      ),
                      Text(
                        '₹${itemTotal.toStringAsFixed(0)}',
                        style: AppType.small.copyWith(
                          color: InstantColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                );
              }),
              if (deliveryCharge > 0) ...[
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(height: 1, color: InstantColors.border),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Delivery charge',
                      style: AppType.small.copyWith(
                        color: InstantColors.textSecondary,
                      ),
                    ),
                    Text(
                      '₹${deliveryCharge.toStringAsFixed(0)}',
                      style: AppType.small.copyWith(
                        color: InstantColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
