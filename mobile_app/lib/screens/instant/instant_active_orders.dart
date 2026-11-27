import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../theme/app_typography.dart';
import '../../theme/instant_theme.dart';
import '../../widgets/tappable.dart';
import 'instant_order_status_screen.dart';

/// Opens live tracking for the customer's instant orders still awaiting the
/// store or on the way. With one active order there is nothing to choose
/// between, so it goes straight to that order's status screen; with several,
/// a sheet lets them pick.
void openInstantActiveOrders(BuildContext context, List<dynamic> activeOrders) {
  if (activeOrders.isEmpty) return;
  if (activeOrders.length == 1) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => InstantOrderStatusScreen(
          order: Map<String, dynamic>.from(activeOrders.first as Map),
        ),
      ),
    );
    return;
  }
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => _ActiveOrdersSheet(orders: activeOrders),
  );
}

// ── "Your Orders" floating badge ─────────────────────────────────────────────
// Floats over the products page while any instant order is still pending or
// on the way; tapping it reopens live tracking.

String _orderImageUrl(Map<String, dynamic> item) {
  final cover = item['cover_image_small'] ?? item['cover_image_large'];
  if (cover is String && cover.isNotEmpty) return cover;
  final images = item['images'];
  if (images is List) {
    return images.whereType<String>().firstWhere(
          (i) => i.isNotEmpty,
          orElse: () => '',
        );
  }
  return '';
}

class InstantOrdersBadge extends StatelessWidget {
  final List<dynamic> orders;
  final VoidCallback onTap;

  const InstantOrdersBadge({
    super.key,
    required this.orders,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final items = orders
        .expand((o) => (o['items'] as List? ?? const []))
        .whereType<Map>()
        .map((i) => Map<String, dynamic>.from(i))
        .toList();
    final shown = items.take(3).toList();

    return Tappable(
      onTap: onTap,
      scaleFactor: 0.97,
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFE5E5),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFFFC2C2)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Text(
              'Your Orders',
              style: AppType.bodyBold.copyWith(
                color: const Color(0xFFB91C1C),
                fontWeight: FontWeight.w800,
              ),
            ),
            const Spacer(),
            SizedBox(
              width: 26.0 * shown.length + (shown.isEmpty ? 0 : 14),
              height: 36,
              child: Stack(
                children: [
                  for (var i = 0; i < shown.length; i++)
                    Positioned(
                      left: i * 26.0,
                      child: _OrderItemAvatar(item: shown[i]),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.arrow_forward_rounded,
                color: Color(0xFFB91C1C), size: 18),
          ],
        ),
      ),
    );
  }
}

class _OrderItemAvatar extends StatelessWidget {
  final Map<String, dynamic> item;

  const _OrderItemAvatar({required this.item});

  @override
  Widget build(BuildContext context) {
    final imageUrl = _orderImageUrl(item);
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: ClipOval(
        child: imageUrl.isEmpty
            ? const Icon(Icons.shopping_bag_rounded,
                size: 16, color: InstantColors.primary)
            : CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.cover,
                memCacheWidth: 90,
                errorWidget: (_, __, ___) => const Icon(
                  Icons.shopping_bag_rounded,
                  size: 16,
                  color: InstantColors.primary,
                ),
              ),
      ),
    );
  }
}

/// Bottom sheet listing items from orders still pending delivery.
class _ActiveOrdersSheet extends StatelessWidget {
  final List<dynamic> orders;

  const _ActiveOrdersSheet({required this.orders});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.7,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: InstantColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
              child: Row(
                children: [
                  const Icon(Icons.local_shipping_rounded,
                      color: InstantColors.primary, size: 20),
                  const SizedBox(width: 8),
                  Text('Your Orders',
                      style: AppType.h3
                          .copyWith(color: InstantColors.textPrimary)),
                ],
              ),
            ),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
                itemCount: orders.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (_, index) =>
                    _ActiveOrderCard(order: orders[index] as Map<String, dynamic>),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveOrderCard extends StatelessWidget {
  final Map<String, dynamic> order;

  const _ActiveOrderCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final items = (order['items'] as List? ?? const [])
        .whereType<Map>()
        .map((i) => Map<String, dynamic>.from(i))
        .toList();
    final total = (order['total_amount'] as num?)?.toDouble() ?? 0;

    // A pending order has not been accepted yet — saying "On the way" would be a
    // promise the store hasn't made.
    final isAwaiting = order['status'] == 'pending';
    final statusLabel = isAwaiting ? 'Awaiting confirmation' : 'On the way';
    final statusFg =
        isAwaiting ? const Color(0xFF92400E) : const Color(0xFFB91C1C);
    final statusBg =
        isAwaiting ? const Color(0xFFFEF3C7) : const Color(0xFFFFE5E5);

    return Tappable(
      // Re-entry point into the live status screen, so a customer who left the
      // app can get back to their pending order.
      onTap: () {
        Navigator.pop(context); // close the active-orders sheet
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => InstantOrderStatusScreen(
              order: Map<String, dynamic>.from(order),
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: InstantColors.surfaceBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: InstantColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusLabel,
                    style: AppType.micro.copyWith(
                      color: statusFg,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
                  ),
                ),
              const Spacer(),
              Text(
                '₹${total.toStringAsFixed(0)}',
                style: AppType.captionBold
                    .copyWith(color: InstantColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...items.map((item) {
            final imageUrl = _orderImageUrl(item);
            final name = item['product_name'] as String? ?? '';
            final qty = (item['quantity'] as num?)?.toInt() ?? 0;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 32,
                      height: 32,
                      child: imageUrl.isEmpty
                          ? Container(
                              color: InstantColors.primaryLight,
                              child: const Icon(Icons.shopping_bag_rounded,
                                  size: 16, color: InstantColors.primary),
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
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppType.small
                          .copyWith(color: InstantColors.textPrimary),
                    ),
                  ),
                  Text(
                    '× $qty',
                    style: AppType.small
                        .copyWith(color: InstantColors.textSecondary),
                  ),
                ],
              ),
            );
            }),
          ],
        ),
      ),
    );
  }
}
