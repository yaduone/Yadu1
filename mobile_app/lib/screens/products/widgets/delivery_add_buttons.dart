import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../models/pending_cart_item.dart';
import '../../../providers/cart_provider.dart';
import '../../../providers/instant_provider.dart';
import '../../../theme/app_theme.dart';
import '../../../theme/app_typography.dart';
import '../../../theme/instant_theme.dart';
import '../../../utils/delivery_mode_status.dart';
import '../../../widgets/app_snackbar.dart';
import '../product_info.dart';

/// The pair of add controls every product carries: one for the next
/// scheduled delivery, one for instant delivery.
///
/// Each control turns into a −/+ stepper once the product is in that cart, and
/// goes grey (tap explains why) when the product isn't offered in that mode or
/// the mode isn't taking orders right now. Both read [DeliveryModeStatus], the
/// same source as the status chips above the list.
class DeliveryAddButtons extends StatelessWidget {
  final Map<String, dynamic> product;
  final double height;

  /// Show the mode's price under its label (detail sheet); the list tile shows
  /// prices beside the product name instead.
  final bool showPrices;

  const DeliveryAddButtons({
    super.key,
    required this.product,
    this.height = 42,
    this.showPrices = false,
  });

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final instant = context.watch<InstantProvider>();
    final id = ProductInfo.id(product);
    final name = ProductInfo.name(product);

    final scheduled = DeliveryModeStatus.scheduled(cart);
    final instantStatus = DeliveryModeStatus.instant(instant);

    final scheduledQty = cart.pendingCartItems
        .where((item) => item.productId == id)
        .fold<int>(0, (sum, item) => sum + item.quantity);
    final instantQty = instant.quantityOf(id);

    // Instant cart lines are priced from the instant catalog, so a product the
    // admin marked instant must also be present there to be addable.
    final offersScheduled = ProductInfo.offersScheduled(product);
    final offersInstant = ProductInfo.offersInstant(product) &&
        (!instant.productsLoaded ||
            instant.products.any((p) => p is Map && p['id'] == id));

    void explain(String message) {
      HapticFeedback.selectionClick();
      AppSnackbar.info(context, message);
    }

    return Row(
      children: [
        Expanded(
          child: _ModeButton(
            icon: Icons.event_repeat_rounded,
            label: 'Scheduled',
            caption: showPrices
                ? ProductInfo.formatPrice(ProductInfo.scheduledPrice(product))
                : null,
            color: AppColors.primary,
            height: height,
            quantity: scheduledQty,
            blockedLabel: !offersScheduled
                ? 'Instant only'
                : (!scheduled.active ? scheduled.blockedLabel : null),
            canIncrement: offersScheduled && scheduled.active,
            onAdd: () {
              HapticFeedback.lightImpact();
              cart.addPendingItem(PendingCartItem.fromProduct(product, 1));
            },
            onDecrement: () {
              HapticFeedback.selectionClick();
              cart.updatePendingItemQuantity(id, scheduledQty - 1);
            },
            onBlockedTap: () => explain(
              !offersScheduled
                  ? '$name is available for instant delivery only.'
                  : scheduled.message,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ModeButton(
            icon: Icons.bolt_rounded,
            label: 'Instant',
            caption: showPrices
                ? ProductInfo.formatPrice(ProductInfo.instantPrice(product))
                : null,
            color: InstantColors.primary,
            height: height,
            quantity: instantQty,
            blockedLabel: !offersInstant
                ? 'Scheduled only'
                : (!instantStatus.active ? instantStatus.blockedLabel : null),
            canIncrement: offersInstant && instantStatus.active,
            onAdd: () {
              HapticFeedback.lightImpact();
              instant.addItem(id);
            },
            onDecrement: () {
              HapticFeedback.selectionClick();
              instant.decrement(id);
            },
            onBlockedTap: () => explain(
              !offersInstant
                  ? '$name is available for scheduled delivery only.'
                  : instantStatus.message,
            ),
          ),
        ),
      ],
    );
  }
}

class _ModeButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? caption;
  final Color color;
  final double height;
  final int quantity;

  /// Non-null when nothing new can be added; the text says why.
  final String? blockedLabel;
  final bool canIncrement;
  final VoidCallback onAdd;
  final VoidCallback onDecrement;
  final VoidCallback onBlockedTap;

  const _ModeButton({
    required this.icon,
    required this.label,
    required this.caption,
    required this.color,
    required this.height,
    required this.quantity,
    required this.blockedLabel,
    required this.canIncrement,
    required this.onAdd,
    required this.onDecrement,
    required this.onBlockedTap,
  });

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(12);

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 180),
      switchInCurve: Curves.easeOut,
      transitionBuilder: (child, animation) =>
          FadeTransition(opacity: animation, child: child),
      child: quantity > 0
          ? _stepper(radius)
          : blockedLabel != null
          ? _blocked(radius)
          : _add(radius),
    );
  }

  Widget _add(BorderRadius radius) {
    return Semantics(
      key: const ValueKey('add'),
      button: true,
      label: 'Add to $label delivery',
      child: Material(
        color: color.withValues(alpha: 0.08),
        borderRadius: radius,
        child: InkWell(
          onTap: onAdd,
          borderRadius: radius,
          child: Container(
            height: height,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(color: color.withValues(alpha: 0.35)),
            ),
            child: Row(
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 6),
                Expanded(child: _labels(color, color.withValues(alpha: 0.75))),
                Icon(Icons.add_rounded, size: 19, color: color),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _stepper(BorderRadius radius) {
    return Semantics(
      key: const ValueKey('stepper'),
      label: '$label delivery, quantity $quantity',
      child: Container(
        height: height,
        decoration: BoxDecoration(color: color, borderRadius: radius),
        child: Row(
          children: [
            _stepButton(Icons.remove_rounded, onDecrement, 'Remove one'),
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 14, color: Colors.white70),
                  const SizedBox(width: 4),
                  Text(
                    '$quantity',
                    style: AppType.captionBold.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            _stepButton(
              Icons.add_rounded,
              canIncrement ? onAdd : onBlockedTap,
              'Add one',
              dimmed: !canIncrement,
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepButton(
    IconData icon,
    VoidCallback onTap,
    String semantic, {
    bool dimmed = false,
  }) {
    return Semantics(
      button: true,
      label: semantic,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 38,
          height: height,
          child: Icon(
            icon,
            size: 18,
            color: dimmed ? Colors.white38 : Colors.white,
          ),
        ),
      ),
    );
  }

  Widget _blocked(BorderRadius radius) {
    return Semantics(
      key: const ValueKey('blocked'),
      button: true,
      label: '$label delivery: $blockedLabel',
      child: Material(
        color: AppColors.surfaceBg,
        borderRadius: radius,
        child: InkWell(
          onTap: onBlockedTap,
          borderRadius: radius,
          child: Container(
            height: height,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Icon(icon, size: 15, color: AppColors.textHint),
                const SizedBox(width: 6),
                Expanded(
                  child: caption == null
                      ? Text(
                          blockedLabel!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.small.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w700,
                          ),
                        )
                      : _labels(
                          AppColors.textSecondary,
                          AppColors.textHint,
                          override: blockedLabel,
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Mode label, with the price (or the blocked reason) beneath it when a
  /// caption is shown.
  Widget _labels(Color main, Color sub, {String? override}) {
    final title = Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppType.small.copyWith(color: main, fontWeight: FontWeight.w800),
    );
    final second = override ?? caption;
    if (second == null) return title;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        title,
        Text(
          second,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppType.micro.copyWith(
            color: sub,
            fontWeight: FontWeight.w700,
            letterSpacing: 0,
          ),
        ),
      ],
    );
  }
}
