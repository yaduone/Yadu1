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
  /// How long the confirm button stays in its loading state at minimum. The
  /// order request usually resolves faster than this; holding the spinner for a
  /// beat keeps the tap → success transition from feeling like a glitch.
  static const Duration _minSpinner = Duration(milliseconds: 1000);

  bool _confirming = false;

  /// The cart as it looked when confirm was tapped. A successful confirm empties
  /// the cart (locally and on the server), which would otherwise collapse the
  /// list to the empty state behind the success dialog. Rendering this frozen
  /// copy keeps the receipt visible under the dialog until the customer leaves.
  List<dynamic>? _frozenItems;
  double _frozenItemsTotal = 0;
  double _frozenTotal = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InstantProvider>().loadCart();
    });
  }

  Future<void> _confirm() async {
    final provider = context.read<InstantProvider>();
    HapticFeedback.mediumImpact();
    setState(() {
      _confirming = true;
      _frozenItems = List<dynamic>.from(provider.items);
      _frozenItemsTotal = provider.itemsTotal;
      _frozenTotal = provider.totalAmount;
    });

    // Run the request and the minimum spinner window concurrently — the button
    // settles on whichever finishes last, so a fast backend still shows a
    // deliberate beat of loading and a slow one is never cut short.
    final results = await Future.wait([
      provider.confirm(),
      Future<void>.delayed(_minSpinner),
    ]);
    if (!mounted) return;

    final order = results.first as Map<String, dynamic>?;

    if (order == null) {
      // Failed — unfreeze and re-enable the button so the customer can retry.
      setState(() {
        _confirming = false;
        _frozenItems = null;
      });
      AppSnackbar.error(context, provider.error ?? 'Could not place the order.');
      return;
    }

    HapticFeedback.heavyImpact();
    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'Order placed',
      barrierColor: const Color(0xFF2A1A4A).withValues(alpha: 0.45),
      transitionDuration: const Duration(milliseconds: 260),
      pageBuilder: (_, __, ___) => _OrderPlacedDialog(
        order: order,
        etaMinutes: provider.etaMinutes,
        onTrack: () => _openStatus(order),
        onBrowse: _backToStore,
      ),
      transitionBuilder: (_, anim, __, child) {
        final curved =
            CurvedAnimation(parent: anim, curve: Curves.easeOutCubic);
        return FadeTransition(
          opacity: curved,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.92, end: 1).animate(curved),
            child: child,
          ),
        );
      },
    );
  }

  /// Replaces the cart with live tracking, so backing out of the status screen
  /// lands on the store rather than on a cart that no longer exists.
  void _openStatus(Map<String, dynamic> order) {
    Navigator.pop(context); // close the dialog
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => InstantOrderStatusScreen(
          order: Map<String, dynamic>.from(order),
        ),
      ),
    );
  }

  /// Back to the instant storefront to keep shopping. The store's floating
  /// "Your Orders" badge is already showing the new order when they land.
  void _backToStore() {
    Navigator.pop(context); // close the dialog
    Navigator.pop(context); // leave the cart
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InstantProvider>();
    final frozen = _frozenItems != null;
    final items = _frozenItems ?? provider.items;
    final itemsTotal = frozen ? _frozenItemsTotal : provider.itemsTotal;
    final total = frozen ? _frozenTotal : provider.totalAmount;
    final itemCount = frozen
        ? items.fold<int>(
            0, (sum, i) => sum + ((i['quantity'] as num?)?.toInt() ?? 0))
        : provider.itemCount;

    return PopScope(
      // No route changes while the order is being created or while the success
      // dialog is up — leaving mid-flight would strand the customer without the
      // "track it" hand-off.
      canPop: !_confirming,
      child: Scaffold(
        backgroundColor: InstantColors.scaffoldBg,
        body: SafeArea(
          child: Column(
            children: [
              _Header(itemCount: itemCount, locked: _confirming),
              Expanded(
                child: items.isEmpty
                    ? const _EmptyCart()
                    : IgnorePointer(
                        // Quantity steppers and tip chips go inert once confirm
                        // is tapped — the frozen list is a receipt at that
                        // point, and an edit can no longer reach the order.
                        ignoring: _confirming,
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                          children: [
                            ...items.map((item) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _CartItemCard(
                                    item: item as Map<String, dynamic>,
                                  ),
                                )),
                            const SizedBox(height: 8),
                            _DeliveryChargeCard(
                                selected: provider.deliveryCharge),
                            const SizedBox(height: 12),
                            _ChargesBreakdown(
                              itemsTotal: itemsTotal,
                              deliveryCharge: provider.deliveryCharge,
                              extraCharges: provider.extraCharges,
                              total: total,
                            ),
                          ],
                        ),
                      ),
              ),
              if (items.isNotEmpty)
                _ConfirmBar(
                  total: total,
                  loading: _confirming || provider.mutating,
                  enabled: true,
                  onConfirm: _confirm,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Header ───────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final int itemCount;

  /// Hides the back affordance while the order is being placed, so the only
  /// ways out are the two buttons on the success dialog.
  final bool locked;

  const _Header({required this.itemCount, this.locked = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          AnimatedOpacity(
            opacity: locked ? 0 : 1,
            duration: const Duration(milliseconds: 180),
            child: IconButton(
              onPressed: locked ? null : () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 19),
              color: InstantColors.textPrimary,
            ),
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

// ── Order placed dialog ──────────────────────────────────────────────────────

/// Success sheet shown the moment the order exists. Choreographed in one
/// controller so the badge, copy and buttons arrive in sequence rather than all
/// snapping in at once.
class _OrderPlacedDialog extends StatefulWidget {
  final Map<String, dynamic> order;
  final int etaMinutes;
  final VoidCallback onTrack;
  final VoidCallback onBrowse;

  const _OrderPlacedDialog({
    required this.order,
    required this.etaMinutes,
    required this.onTrack,
    required this.onBrowse,
  });

  @override
  State<_OrderPlacedDialog> createState() => _OrderPlacedDialogState();
}

class _OrderPlacedDialogState extends State<_OrderPlacedDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  )..forward();

  late final Animation<double> _badge = _interval(0.00, 0.42, Curves.easeOut);
  late final Animation<double> _tick = _interval(0.26, 0.62, Curves.easeInOut);
  late final Animation<double> _copy = _interval(0.42, 0.70, Curves.easeOut);
  late final Animation<double> _actions = _interval(0.58, 0.86, Curves.easeOut);

  Animation<double> _interval(double begin, double end, Curve curve) =>
      CurvedAnimation(parent: _ctrl, curve: Interval(begin, end, curve: curve));

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  /// Short, human-readable handle for the order — the same last-6 convention
  /// used on the status screen, so the two agree.
  String? get _orderRef {
    final id = widget.order['order_number'] as String? ??
        widget.order['id'] as String?;
    if (id == null || id.isEmpty) return null;
    return id.length <= 6 ? id.toUpperCase() : id.substring(id.length - 6).toUpperCase();
  }

  /// Slide-and-fade used by every staged block below, so the whole sequence
  /// shares one motion signature.
  Widget _rise(Animation<double> t, Widget child) {
    return AnimatedBuilder(
      animation: t,
      builder: (_, c) => Opacity(
        opacity: t.value.clamp(0.0, 1.0),
        child: Transform.translate(offset: Offset(0, 12 * (1 - t.value)), child: c),
      ),
      child: child,
    );
  }

  @override
  Widget build(BuildContext context) {
    final ref = _orderRef;

    return PopScope(
      // The two buttons are the only exits — a back gesture here would drop the
      // customer on a cart that has already become an order.
      canPop: false,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Material(
              color: Colors.transparent,
              child: Container(
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2A1A4A).withValues(alpha: 0.18),
                      blurRadius: 40,
                      offset: const Offset(0, 18),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _SuccessBadge(badge: _badge, tick: _tick),
                    const SizedBox(height: 22),
                    _rise(
                      _copy,
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Order Placed!',
                            style: AppType.h2.copyWith(
                              color: InstantColors.textPrimary,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Your instant order is confirmed and on its way to '
                            'the store.',
                            textAlign: TextAlign.center,
                            style: AppType.small.copyWith(
                              color: InstantColors.textSecondary,
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: InstantColors.primaryLight,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.bolt_rounded,
                                    size: 16, color: InstantColors.primary),
                                const SizedBox(width: 5),
                                Text(
                                  'Arriving in ~${widget.etaMinutes} minutes',
                                  style: AppType.micro.copyWith(
                                    color: InstantColors.primary,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (ref != null) ...[
                            const SizedBox(height: 10),
                            Text(
                              'Order #$ref',
                              style: AppType.micro.copyWith(
                                color: InstantColors.textHint,
                                letterSpacing: 0.4,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 26),
                    _rise(
                      _actions,
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Tappable(
                            onTap: widget.onTrack,
                            scaleFactor: 0.97,
                            haptic: HapticFeedbackType.medium,
                            child: Container(
                              height: 54,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                gradient: InstantColors.gradient,
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: InstantColors.primary
                                        .withValues(alpha: 0.35),
                                    blurRadius: 14,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.local_shipping_rounded,
                                      color: Colors.white, size: 19),
                                  const SizedBox(width: 8),
                                  Text('Go to Order Status',
                                      style: AppType.button
                                          .copyWith(color: Colors.white)),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Tappable(
                            onTap: widget.onBrowse,
                            scaleFactor: 0.97,
                            child: Container(
                              height: 52,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border:
                                    Border.all(color: InstantColors.border, width: 1.5),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.storefront_rounded,
                                      color: InstantColors.primary, size: 19),
                                  const SizedBox(width: 8),
                                  Text('Browse More',
                                      style: AppType.button
                                          .copyWith(color: InstantColors.primary)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The green circle with the check stroking itself on, plus a halo that pulses
/// outward once as the badge lands.
class _SuccessBadge extends StatelessWidget {
  final Animation<double> badge;
  final Animation<double> tick;

  const _SuccessBadge({required this.badge, required this.tick});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 112,
      height: 112,
      child: AnimatedBuilder(
        animation: Listenable.merge([badge, tick]),
        builder: (_, __) {
          final b = badge.value.clamp(0.0, 1.0);
          // Overshoot then settle, so the badge lands with weight instead of
          // simply growing to size.
          final scale = b < 1 ? Curves.easeOutBack.transform(b) : 1.0;
          return Stack(
            alignment: Alignment.center,
            children: [
              // Halo — expands and fades as the circle arrives.
              Opacity(
                opacity: (1 - b) * 0.45,
                child: Container(
                  width: 112 * (0.55 + 0.45 * b),
                  height: 112 * (0.55 + 0.45 * b),
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: InstantColors.success,
                  ),
                ),
              ),
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: InstantColors.success.withValues(alpha: 0.12 * b),
                ),
              ),
              Transform.scale(
                scale: scale,
                child: Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: InstantColors.success,
                    boxShadow: [
                      BoxShadow(
                        color: InstantColors.success.withValues(alpha: 0.38),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: CustomPaint(
                    painter: _CheckPainter(progress: tick.value.clamp(0.0, 1.0)),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Draws the check mark as a partially-stroked path, so it appears to be
/// written rather than faded in.
class _CheckPainter extends CustomPainter {
  final double progress;

  const _CheckPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;

    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.28, h * 0.52)
      ..lineTo(w * 0.44, h * 0.68)
      ..lineTo(w * 0.73, h * 0.36);

    final metric = path.computeMetrics().first;
    final drawn = metric.extractPath(0, metric.length * progress);

    canvas.drawPath(
      drawn,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_CheckPainter old) => old.progress != progress;
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
