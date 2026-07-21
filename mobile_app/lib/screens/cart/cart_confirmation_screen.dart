import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/pending_cart_item.dart';
import '../../models/cart_charge.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';

/// Full-screen cart confirmation dialog showing all pending items
/// before they are sent to the main cart for manifest generation.
class CartConfirmationScreen extends StatefulWidget {
  final List<PendingCartItem> pendingItems;
  final double confirmedTotal;
  final double pendingTotal;
  final List<CartCharge> charges;
  final String deliveryDate;
  final Future<void> Function() onConfirm;
  final VoidCallback onCancel;

  const CartConfirmationScreen({
    super.key,
    required this.pendingItems,
    required this.confirmedTotal,
    required this.pendingTotal,
    this.charges = const [],
    required this.deliveryDate,
    required this.onConfirm,
    required this.onCancel,
  });

  @override
  State<CartConfirmationScreen> createState() =>
      _CartConfirmationScreenState();
}

class _CartConfirmationScreenState extends State<CartConfirmationScreen> {
  bool _isConfirming = false;

  Future<void> _handleConfirm() async {
    if (_isConfirming) return;
    HapticFeedback.mediumImpact();
    setState(() => _isConfirming = true);
    await widget.onConfirm();
  }

  @override
  Widget build(BuildContext context) {
    final pendingItems = widget.pendingItems;
    final confirmedTotal = widget.confirmedTotal;
    final pendingTotal = widget.pendingTotal;
    final deliveryDate = widget.deliveryDate;
    final onCancel = widget.onCancel;
    final charges = widget.charges;
    final chargesTotal = CartCharge.totalOf(charges);
    final totalCartPrice = confirmedTotal + pendingTotal + chargesTotal;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Confirm Your Order'),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: onCancel,
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // ── Delivery Date Info ─────────────────────────────
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.local_shipping_rounded,
                          color: AppColors.primary,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Delivery Date',
                              style: AppType.small.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              deliveryDate,
                              style: AppType.captionBold.copyWith(
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // ── Section: New Items Being Added ─────────────────
                Row(
                  children: [
                    const Icon(
                      Icons.add_shopping_cart_rounded,
                      size: 20,
                      color: AppColors.success,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Items Being Added',
                      style: AppType.h3.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                ...pendingItems.map((item) => _ConfirmationProductCard(
                      item: item,
                      isNewItem: true,
                    )),

                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 16),

                // ── Price Breakdown ────────────────────────────────
                Text(
                  'Price Summary',
                  style: AppType.h3.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 16),

                if (confirmedTotal > 0) ...[
                  _PriceRow(
                    label: 'Previously in Cart',
                    value: confirmedTotal,
                    isSubtotal: true,
                  ),
                  const SizedBox(height: 8),
                ],

                _PriceRow(
                  label: 'New Items',
                  value: pendingTotal,
                  isSubtotal: true,
                  highlight: true,
                ),
                const SizedBox(height: 8),

                // ── Admin-configured charges (platform fee, QA fees, …) ──
                ...charges.map((charge) => Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: _PriceRow(
                        label: charge.name,
                        value: charge.amount,
                        isSubtotal: true,
                        freeLabel: true,
                      ),
                    )),

                const SizedBox(height: 16),
                const Divider(thickness: 2),
                const SizedBox(height: 16),

                _PriceRow(
                  label: 'Total Cart Price',
                  value: totalCartPrice,
                  isTotal: true,
                ),

                const SizedBox(height: 24),

                // ── Info Banner ───────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Colors.blue.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.info_outline_rounded,
                        size: 20,
                        color: Colors.blue[700],
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'After confirmation, these items will be added to your delivery for $deliveryDate. Any changes after this will require re-confirmation.',
                          style: AppType.small.copyWith(
                            color: Colors.blue[900],
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),
              ],
            ),
          ),

          // ── Bottom Action Bar ──────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 16,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _isConfirming ? null : onCancel,
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(52),
                          ),
                          child: const Text('Go Back'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          onPressed: _isConfirming ? null : _handleConfirm,
                          icon: _isConfirming
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(
                                  Icons.check_circle_rounded,
                                  size: 22,
                                ),
                          label: Text(
                            _isConfirming ? 'Confirming...' : 'Confirm Order',
                            style: AppType.button.copyWith(color: Colors.white),
                          ),
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size.fromHeight(52),
                            backgroundColor: AppColors.success,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Product Card in Confirmation Screen ───────────────────────────────────────

class _ConfirmationProductCard extends StatelessWidget {
  final PendingCartItem item;
  final bool isNewItem;

  const _ConfirmationProductCard({
    required this.item,
    this.isNewItem = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isNewItem
            ? AppColors.success.withValues(alpha: 0.03)
            : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isNewItem
              ? AppColors.success.withValues(alpha: 0.2)
              : AppColors.border,
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          // Product Image
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.surfaceBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: item.coverImage != null && item.coverImage!.isNotEmpty
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: CachedNetworkImage(
                      imageUrl: item.coverImage!,
                      fit: BoxFit.cover,
                      memCacheWidth: 128,
                      memCacheHeight: 128,
                      errorWidget: (_, __, ___) => const Icon(
                        Icons.shopping_bag_rounded,
                        color: AppColors.primary,
                        size: 28,
                      ),
                    ),
                  )
                : const Icon(
                    Icons.shopping_bag_rounded,
                    color: AppColors.primary,
                    size: 28,
                  ),
          ),
          const SizedBox(width: 14),

          // Product Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.captionBold.copyWith(
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'Qty: ${item.quantity}',
                        style: AppType.micro.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '₹${item.price.toStringAsFixed(0)}/${item.unit}',
                      style: AppType.small.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Price Calculation
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '₹${item.total.toStringAsFixed(0)}',
                style: AppType.h3.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${item.quantity} × ₹${item.price.toStringAsFixed(0)}',
                style: AppType.micro.copyWith(
                  color: AppColors.textHint,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Price Row Component ───────────────────────────────────────────────────────

class _PriceRow extends StatelessWidget {
  final String label;
  final double value;
  final bool isSubtotal;
  final bool isTotal;
  final bool highlight;
  final bool freeLabel;

  const _PriceRow({
    required this.label,
    required this.value,
    this.isSubtotal = false,
    this.isTotal = false,
    this.highlight = false,
    this.freeLabel = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: isTotal
              ? AppType.h3.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                )
              : AppType.caption.copyWith(
                  color: highlight
                      ? AppColors.success
                      : AppColors.textSecondary,
                  fontWeight: highlight ? FontWeight.w600 : FontWeight.w500,
                ),
        ),
        if (freeLabel && value == 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              'FREE',
              style: AppType.micro.copyWith(
                color: AppColors.success,
                fontWeight: FontWeight.w700,
              ),
            ),
          )
        else
          Text(
            '₹${value.toStringAsFixed(2)}',
            style: isTotal
                ? AppType.h2.copyWith(
                    fontWeight: FontWeight.w900,
                    color: AppColors.primary,
                  )
                : AppType.captionBold.copyWith(
                    color: highlight
                        ? AppColors.success
                        : AppColors.textPrimary,
                  ),
          ),
      ],
    );
  }
}
