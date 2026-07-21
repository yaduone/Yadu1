import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../providers/instant_provider.dart';
import '../../models/cart_charge.dart';
import '../../theme/instant_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/tappable.dart';
import '../../widgets/app_snackbar.dart';
import 'instant_order_status_screen.dart';

class InstantCartScreen extends StatefulWidget {
  const InstantCartScreen({super.key});

  @override
  State<InstantCartScreen> createState() => _InstantCartScreenState();
}

class _InstantCartScreenState extends State<InstantCartScreen> {
  bool _confirming = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InstantProvider>().loadCart();
    });
  }

  Future<void> _confirm() async {
    final provider = context.read<InstantProvider>();
    setState(() => _confirming = true);
    HapticFeedback.mediumImpact();
    final order = await provider.confirm();
    if (!mounted) return;
    setState(() => _confirming = false);

    if (order != null) {
      // Replace the cart with the live status screen: the order is only
      // *requested* at this point, and the customer waits there until an admin
      // accepts it. Using pushReplacement means Back returns to the store, not
      // to a now-empty cart.
      await Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => InstantOrderStatusScreen(order: order),
        ),
      );
    } else {
      AppSnackbar.error(context, provider.error ?? 'Could not place the order.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InstantProvider>();
    final items = provider.items;

    return Scaffold(
      backgroundColor: InstantColors.scaffoldBg,
      body: SafeArea(
        child: Column(
          children: [
            _Header(itemCount: provider.itemCount),
            Expanded(
              child: items.isEmpty
                  ? const _EmptyCart()
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      children: [
                        ...items.map((item) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _CartItemCard(
                                item: item as Map<String, dynamic>,
                              ),
                            )),
                        const SizedBox(height: 8),
                        _DeliveryChargeCard(selected: provider.deliveryCharge),
                        const SizedBox(height: 12),
                        _ChargesBreakdown(
                          itemsTotal: provider.itemsTotal,
                          deliveryCharge: provider.deliveryCharge,
                          extraCharges: provider.extraCharges,
                          total: provider.totalAmount,
                        ),
                      ],
                    ),
            ),
            if (items.isNotEmpty)
              _ConfirmBar(
                total: provider.totalAmount,
                loading: _confirming || provider.mutating,
                enabled: true,
                onConfirm: _confirm,
              ),
          ],
        ),
      ),
    );
  }
}

// ── Header ───────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final int itemCount;
  const _Header({required this.itemCount});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 19),
            color: InstantColors.textPrimary,
          ),
          Expanded(
            child: Row(
              children: [
                const Icon(Icons.bolt_rounded,
                    color: InstantColors.primary, size: 22),
                const SizedBox(width: 4),
                Text('Instant Cart',
                    style:
                        AppType.h2.copyWith(color: InstantColors.textPrimary)),
              ],
            ),
          ),
          if (itemCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: InstantColors.primaryLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$itemCount ${itemCount == 1 ? 'item' : 'items'}',
                style: AppType.micro.copyWith(
                  color: InstantColors.primary,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Item card ────────────────────────────────────────────────────────────────

class _CartItemCard extends StatelessWidget {
  final Map<String, dynamic> item;
  const _CartItemCard({required this.item});

  String _imageUrl(InstantProvider provider) {
    final productId = item['product_id'];
    final product = provider.products.firstWhere(
      (p) => p['id'] == productId,
      orElse: () => <String, dynamic>{},
    );
    final cover = product['cover_image_small'] ?? product['cover_image_large'];
    if (cover is String && cover.isNotEmpty) return cover;
    final images = product['images'];
    if (images is List) {
      return images.whereType<String>().firstWhere(
            (i) => i.isNotEmpty,
            orElse: () => '',
          );
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.read<InstantProvider>();
    final id = item['product_id'] as String? ?? '';
    final name = item['product_name'] as String? ?? '';
    final unit = item['unit'] as String? ?? '';
    final price = (item['price'] as num?)?.toDouble() ?? 0;
    final qty = (item['quantity'] as num?)?.toInt() ?? 0;
    final total = (item['total'] as num?)?.toDouble() ?? price * qty;
    final imageUrl = _imageUrl(provider);

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: InstantColors.border),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 54,
              height: 54,
              child: imageUrl.isEmpty
                  ? Container(
                      color: InstantColors.primaryLight,
                      child: const Icon(Icons.shopping_bag_rounded,
                          color: InstantColors.primary, size: 22),
                    )
                  : CachedNetworkImage(
                      imageUrl: imageUrl,
                      fit: BoxFit.cover,
                      memCacheWidth: 120,
                      errorWidget: (_, __, ___) => Container(
                        color: InstantColors.primaryLight,
                        child: const Icon(Icons.shopping_bag_rounded,
                            color: InstantColors.primary, size: 22),
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.captionBold
                        .copyWith(color: InstantColors.textPrimary)),
                const SizedBox(height: 2),
                Text('$unit · ₹${price.toStringAsFixed(0)}',
                    style: AppType.micro.copyWith(
                        color: InstantColors.textSecondary, letterSpacing: 0)),
                const SizedBox(height: 6),
                Text('₹${total.toStringAsFixed(0)}',
                    style: AppType.bodyBold.copyWith(
                        color: InstantColors.primary,
                        fontWeight: FontWeight.w900)),
              ],
            ),
          ),
          _Stepper(
            quantity: qty,
            onMinus: () => provider.decrement(id),
            onPlus: () => provider.increment(id),
          ),
        ],
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  final int quantity;
  final VoidCallback onMinus;
  final VoidCallback onPlus;

  const _Stepper({
    required this.quantity,
    required this.onMinus,
    required this.onPlus,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: InstantColors.primary,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _btn(Icons.remove_rounded, () {
            HapticFeedback.selectionClick();
            onMinus();
          }),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text('$quantity',
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 14)),
          ),
          _btn(Icons.add_rounded, () {
            HapticFeedback.selectionClick();
            onPlus();
          }),
        ],
      ),
    );
  }

  Widget _btn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: SizedBox(
        width: 32,
        height: 36,
        child: Icon(icon, color: Colors.white, size: 17),
      ),
    );
  }
}

// ── Delivery charge selector ─────────────────────────────────────────────────

class _DeliveryChargeCard extends StatelessWidget {
  final int selected;
  const _DeliveryChargeCard({required this.selected});

  @override
  Widget build(BuildContext context) {
    final provider = context.read<InstantProvider>();
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: InstantColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.delivery_dining_rounded,
                  size: 18, color: InstantColors.primary),
              const SizedBox(width: 8),
              Text('Delivery Charge',
                  style: AppType.captionBold
                      .copyWith(color: InstantColors.textPrimary)),
            ],
          ),
          const SizedBox(height: 4),
          Text('Delivery is free — add a tip to support faster delivery.',
              style: AppType.micro.copyWith(
                  color: InstantColors.textSecondary, letterSpacing: 0)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: InstantProvider.deliveryChargeOptions.map((charge) {
              final active = charge == selected;
              return Tappable(
                onTap: () {
                  HapticFeedback.selectionClick();
                  provider.setDeliveryCharge(charge);
                },
                scaleFactor: 0.92,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                  decoration: BoxDecoration(
                    color: active ? InstantColors.primary : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color:
                          active ? InstantColors.primary : InstantColors.border,
                    ),
                  ),
                  child: Text(
                    charge == 0 ? 'Free' : '₹$charge',
                    style: AppType.small.copyWith(
                      color: active ? Colors.white : InstantColors.textSecondary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

// ── Charges breakdown ────────────────────────────────────────────────────────

class _ChargesBreakdown extends StatelessWidget {
  final double itemsTotal;
  final int deliveryCharge;
  final List<CartCharge> extraCharges;
  final double total;

  const _ChargesBreakdown({
    required this.itemsTotal,
    required this.deliveryCharge,
    this.extraCharges = const [],
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: InstantColors.border),
      ),
      child: Column(
        children: [
          _row('Items total', '₹${itemsTotal.toStringAsFixed(0)}'),
          const SizedBox(height: 8),
          _row(
            'Delivery charge',
            deliveryCharge == 0 ? 'FREE' : '₹$deliveryCharge',
            valueColor: deliveryCharge == 0 ? InstantColors.success : null,
          ),
          ...extraCharges.map((c) => Padding(
                padding: const EdgeInsets.only(top: 8),
                child: _row(
                  c.name,
                  c.isFree ? 'FREE' : '₹${c.amount.toStringAsFixed(0)}',
                  valueColor: c.isFree ? InstantColors.success : null,
                ),
              )),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: InstantColors.border),
          ),
          _row(
            'To Pay',
            '₹${total.toStringAsFixed(0)}',
            bold: true,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.payments_outlined,
                  size: 14, color: InstantColors.textSecondary),
              const SizedBox(width: 4),
              Text('Cash on Delivery — pay in cash when your order arrives',
                  style: AppType.micro.copyWith(
                      color: InstantColors.textSecondary, letterSpacing: 0)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value,
      {bool bold = false, Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: (bold ? AppType.bodyBold : AppType.small).copyWith(
            color: bold ? InstantColors.textPrimary : InstantColors.textSecondary,
            fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
          ),
        ),
        Text(
          value,
          style: (bold ? AppType.h3 : AppType.captionBold).copyWith(
            color: valueColor ??
                (bold ? InstantColors.primary : InstantColors.textPrimary),
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

// ── Confirm bar ──────────────────────────────────────────────────────────────

class _ConfirmBar extends StatelessWidget {
  final double total;
  final bool loading;
  final bool enabled;
  final VoidCallback onConfirm;

  const _ConfirmBar({
    required this.total,
    required this.loading,
    this.enabled = true,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, 12 + MediaQuery.of(context).padding.bottom),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('To Pay',
                  style: AppType.micro.copyWith(
                      color: InstantColors.textSecondary, letterSpacing: 0)),
              Text('₹${total.toStringAsFixed(0)}',
                  style: AppType.h2.copyWith(
                      color: InstantColors.textPrimary,
                      fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Tappable(
              onTap: (loading || !enabled) ? null : onConfirm,
              scaleFactor: 0.97,
              child: Container(
                height: 54,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: enabled ? InstantColors.gradient : null,
                  color: enabled ? null : InstantColors.textSecondary.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: enabled
                      ? [
                          BoxShadow(
                            color: InstantColors.primary.withValues(alpha: 0.35),
                            blurRadius: 14,
                            offset: const Offset(0, 6),
                          ),
                        ]
                      : null,
                ),
                child: loading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2.5),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                              enabled
                                  ? Icons.bolt_rounded
                                  : Icons.access_time_filled_rounded,
                              color: Colors.white,
                              size: 20),
                          const SizedBox(width: 6),
                          Text(enabled ? 'Confirm Order' : 'Closed',
                              style: AppType.button
                                  .copyWith(color: Colors.white)),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Empty ────────────────────────────────────────────────────────────────────

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: InstantColors.primaryLight,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.shopping_cart_outlined,
                  size: 38, color: InstantColors.primary),
            ),
            const SizedBox(height: 18),
            Text('Your instant cart is empty',
                style: AppType.h3.copyWith(color: InstantColors.textPrimary)),
            const SizedBox(height: 6),
            Text('Add products from the instant store to get started.',
                textAlign: TextAlign.center,
                style: AppType.small
                    .copyWith(color: InstantColors.textSecondary)),
            const SizedBox(height: 22),
            ElevatedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.bolt_rounded, size: 18),
              label: const Text('Browse Instant Store'),
              style: ElevatedButton.styleFrom(
                backgroundColor: InstantColors.primary,
                minimumSize: const Size(220, 50),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
