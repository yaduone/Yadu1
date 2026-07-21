import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/tappable.dart';
import '../../widgets/app_snackbar.dart';
import '../../utils/transitions.dart';
import '../../utils/constants.dart';
import '../../utils/cart_delivery_copy.dart';
import '../../providers/cart_provider.dart';
import '../../providers/auth_provider.dart';
import '../../models/pending_cart_item.dart';
import '../products/products_screen.dart';
import '../home/home_screen.dart';
import '../auth/complete_profile_screen.dart';
import 'cart_confirmation_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final ValueNotifier<bool> _showSavePill = ValueNotifier(false);
  final ValueNotifier<String> _savePillText = ValueNotifier('Cart modified');
  bool _skipping = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final cart = context.read<CartProvider>();
      cart.ensureTomorrowStatusLoaded();
      cart.loadProducts();
      cart.loadCharges();
    });
  }

  @override
  void dispose() {
    _showSavePill.dispose();
    _savePillText.dispose();
    super.dispose();
  }

  void _showAutoSave([String message = 'Cart modified']) {
    _savePillText.value = message;
    _showSavePill.value = true;
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) _showSavePill.value = false;
    });
  }

  void _showCartUpdatedConfirmation({int? addedQuantity}) {
    final status = context.read<CartProvider>().tomorrowStatus;
    _showAutoSave('Cart modified for ${CartDeliveryCopy.dateLabel(status)}');
    AppSnackbar.show(
      context,
      CartDeliveryCopy.updatedMessage(status, addedQuantity: addedQuantity),
      type: SnackType.success,
      duration: const Duration(seconds: 6),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final isProfileComplete = context.select<AppAuthProvider, bool>(
      (a) => a.isProfileComplete,
    );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          // Navigate to home tab (index 0)
          context.findAncestorStateOfType<HomeScreenState>()?.changeTab(0);
        }
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Stack(
          children: [
            RepaintBoundary(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Image.asset(
                      'assets/images/333.jpg',
                      fit: BoxFit.cover,
                      cacheWidth: 800,
                    ),
                  ),
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.55),
                            Colors.black.withValues(alpha: 0.15),
                            Colors.transparent,
                          ],
                          stops: const [0.0, 0.35, 0.65],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SafeArea(
              child: Stack(
                children: [
                  !isProfileComplete
                      ? Center(child: _CartProfileIncomplete())
                      : cart.tomorrowStatus == null
                      ? cart.error != null
                            ? FullScreenError(
                                message: cart.error!,
                                icon:
                                    cart.error!.contains('internet') ||
                                        cart.error!.contains('network')
                                    ? Icons.wifi_off_rounded
                                    : Icons.error_outline_rounded,
                                onRetry: () {
                                  cart.clearError();
                                  cart.loadTomorrowStatus();
                                },
                              )
                            : const Center(child: SkeletonCardLoader())
                      : RefreshIndicator(
                          color: AppColors.primary,
                          onRefresh: cart.loadTomorrowStatus,
                          child: ListView(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            children: [
                              const SizedBox(height: 20),

                              // ── Header ─────────────────────────────────
                              Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          cart.isLocked
                                              ? 'Day After Tomorrow'
                                              : "Tomorrow's Cart",
                                          style: AppType.h1.copyWith(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w900,
                                            shadows: [
                                              Shadow(
                                                color: Colors.black54,
                                                blurRadius: 10,
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          cart.tomorrowStatus!['date'] ?? '',
                                          style: AppType.caption.copyWith(
                                            color: Colors.white.withValues(
                                              alpha: 0.82,
                                            ),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (!cart.isSkipped && cart.totalAmount > 0)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(
                                          alpha: 0.2,
                                        ),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: Colors.white.withValues(
                                            alpha: 0.5,
                                          ),
                                          width: 1,
                                        ),
                                      ),
                                      child: Text(
                                        '₹${cart.totalAmount.toStringAsFixed(0)}',
                                        style: AppType.captionBold.copyWith(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                ],
                              ),

                              // ── Locked banner ───────────────────────────
                              if (cart.isLocked) ...[
                                const SizedBox(height: 14),
                                _LockedBanner(),
                              ],

                              const SizedBox(height: 14),
                              _CartDeliverySummaryCard(
                                status: cart.tomorrowStatus!,
                                isLocked: cart.isLocked,
                              ),

                              const SizedBox(height: 24),

                              // ── Milk Section ────────────────────────────
                              if (cart.effectiveMilk != null) ...[
                                const SectionLabel(
                                  'Milk Delivery',
                                  color: Colors.white70,
                                ),
                                const SizedBox(height: 12),
                                _MilkCard(
                                  milk: cart.effectiveMilk!,
                                  isLocked: cart.isLocked,
                                  onQuantityConfirmed: (v) async {
                                    HapticFeedback.lightImpact();
                                    final ok = await cart.modifyQuantity(v);
                                    if (!context.mounted) return;
                                    if (ok) {
                                      _showAutoSave(
                                        'Milk updated for ${CartDeliveryCopy.dateLabel(cart.tomorrowStatus)}',
                                      );
                                    } else {
                                      AppSnackbar.error(
                                        context,
                                        cart.error ??
                                            'Failed to update quantity.',
                                      );
                                    }
                                  },
                                ),
                                const SizedBox(height: 8),
                              ],

                              // ── Skip / Revert ───────────────────────────
                              if (!cart.isLocked &&
                                  !cart.isSkipped &&
                                  cart.effectiveMilk != null)
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton.icon(
                                    onPressed: _skipping
                                        ? null
                                        : () async {
                                            HapticFeedback.mediumImpact();
                                            setState(() => _skipping = true);
                                            final ok = await cart
                                                .skipTomorrow();
                                            if (!context.mounted) return;
                                            setState(() => _skipping = false);
                                            if (ok) {
                                              _showAutoSave(
                                                'Delivery skipped for ${CartDeliveryCopy.dateLabel(cart.tomorrowStatus)}',
                                              );
                                            } else {
                                              AppSnackbar.error(
                                                context,
                                                cart.error ??
                                                    'Failed to skip delivery.',
                                              );
                                            }
                                          },
                                    icon: _skipping
                                        ? const SizedBox(
                                            width: 15,
                                            height: 15,
                                            child: CircularProgressIndicator(
                                              color: AppColors.error,
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.event_busy_rounded,
                                            size: 15,
                                          ),
                                    label: Text(
                                      _skipping ? 'Skipping…' : 'Skip tomorrow',
                                    ),
                                    style: TextButton.styleFrom(
                                      foregroundColor: AppColors.error,
                                      textStyle: AppType.small.copyWith(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),

                              if (cart.isSkipped) ...[
                                const SizedBox(height: 12),
                                _SkippedCard(
                                  onRevert: () async {
                                    HapticFeedback.mediumImpact();
                                    final ok = await cart.revertOverride();
                                    if (!context.mounted) return;
                                    if (ok) {
                                      _showAutoSave(
                                        'Delivery restored for ${CartDeliveryCopy.dateLabel(cart.tomorrowStatus)}',
                                      );
                                    } else {
                                      AppSnackbar.error(
                                        context,
                                        cart.error ?? 'Failed to undo skip.',
                                      );
                                    }
                                  },
                                ),
                              ],

                              const SizedBox(height: 24),

                              // ── Extra Items ─────────────────────────────
                              Wrap(
                                alignment: WrapAlignment.spaceBetween,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                spacing: 12,
                                runSpacing: 8,
                                children: [
                                  const SectionLabel(
                                    'Extra Items',
                                    color: Colors.white70,
                                  ),
                                  Tappable(
                                    onTap: () => _showQuickAddSheet(context),
                                    scaleFactor: 0.93,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.primaryLight,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(
                                            Icons.add_rounded,
                                            size: 16,
                                            color: AppColors.primary,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            'Quick Add',
                                            style: AppType.micro.copyWith(
                                              color: AppColors.primary,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),

                              if (cart.extraItems.isEmpty &&
                                  !cart.hasPendingChanges)
                                _EmptyExtrasCard()
                              else
                                ...cart.extraItems.map(
                                  (item) => Padding(
                                    padding: const EdgeInsets.only(bottom: 10),
                                    child: _ExtraItemCard(
                                      item: item,
                                      isLocked: cart.isLocked,
                                      onRemove: () async {
                                        HapticFeedback.mediumImpact();
                                        final ok = await cart.removeItem(
                                          item['product_id'],
                                        );
                                        if (!context.mounted) return false;
                                        if (ok) {
                                          _showAutoSave(
                                            'Cart modified for ${CartDeliveryCopy.dateLabel(cart.tomorrowStatus)}',
                                          );
                                        } else {
                                          AppSnackbar.error(
                                            context,
                                            cart.error ??
                                                'Failed to remove item.',
                                          );
                                        }
                                        return ok;
                                      },
                                    ),
                                  ),
                                ),

                              // ── Unconfirmed local changes ───────────────
                              if (cart.hasPendingChanges) ...[
                                const SizedBox(height: 6),
                                _PendingChangesHeader(
                                  count: cart.pendingCartItems.length,
                                ),
                                const SizedBox(height: 10),
                                ...cart.pendingCartItems.map(
                                  (item) => Padding(
                                    padding: const EdgeInsets.only(bottom: 10),
                                    child: _PendingItemCard(
                                      item: item,
                                      onRemove: () {
                                        HapticFeedback.mediumImpact();
                                        cart.removePendingItem(item.productId);
                                      },
                                      onQuantityChanged: (q) => cart
                                          .updatePendingItemQuantity(
                                            item.productId,
                                            q,
                                          ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                _ConfirmChangesButton(
                                  pendingTotal: cart.pendingTotal,
                                  count: cart.pendingCartItems.length,
                                  onConfirm: _showCartConfirmation,
                                ),
                              ],

                              // ── Total ───────────────────────────────────
                              if (!cart.isSkipped && cart.totalAmount > 0) ...[
                                const SizedBox(height: 16),
                                _TotalCard(amount: cart.totalAmount),
                              ],

                              const SizedBox(height: 100),
                            ],
                          ),
                        ),

                  // Auto-save pill — uses ValueListenableBuilder to avoid full tree rebuild
                  Positioned(
                    top: 8,
                    left: 0,
                    right: 0,
                    child: ValueListenableBuilder<String>(
                      valueListenable: _savePillText,
                      builder: (_, message, __) => ValueListenableBuilder<bool>(
                        valueListenable: _showSavePill,
                        builder: (_, visible, __) => Center(
                          child: AutoSavePill(visible: visible, text: message),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showQuickAddSheet(BuildContext context) {
    final cart = context.read<CartProvider>();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _QuickAddSheet(
        cart: cart,
        onAdded: _showPendingAddedMessage,
      ),
    );
  }

  /// Items added via Quick Add land in the local pending cache (not yet sent to
  /// the server) — tell the user they still need to confirm.
  void _showPendingAddedMessage(int count) {
    final cart = context.read<CartProvider>();
    _showAutoSave('Saved to cart');
    AppSnackbar.show(
      context,
      '$count item${count > 1 ? 's' : ''} added. Tap Confirm to schedule them for ${CartDeliveryCopy.dateLabel(cart.tomorrowStatus)}.',
      type: SnackType.info,
      duration: const Duration(seconds: 5),
    );
  }

  /// Opens the full-screen review of the locally-saved changes before they are
  /// flushed to the server (and on to the admin / target-date cart).
  void _showCartConfirmation() {
    final cart = context.read<CartProvider>();
    if (!cart.hasPendingChanges) return;
    // Ensure the latest admin-configured charges are available.
    cart.loadCharges();
    Navigator.push(
      context,
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => CartConfirmationScreen(
          pendingItems: cart.pendingCartItems,
          confirmedTotal: cart.confirmedTotal,
          pendingTotal: cart.pendingTotal,
          charges: cart.charges,
          deliveryDate: CartDeliveryCopy.dateLabel(cart.tomorrowStatus),
          onConfirm: _confirmPendingCart,
          onCancel: () => Navigator.of(context).maybePop(),
        ),
      ),
    );
  }

  Future<void> _confirmPendingCart() async {
    final cart = context.read<CartProvider>();
    final ok = await cart.confirmPendingCart();
    if (!mounted) return;
    Navigator.of(context).pop();
    if (ok) {
      _showCartUpdatedConfirmation();
    } else {
      AppSnackbar.error(
        context,
        cart.error ?? 'Could not confirm your changes. Please try again.',
      );
    }
  }
}

// ── Profile Incomplete Card ───────────────────────────────────────────────────

class _CartProfileIncomplete extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(22),
            ),
            child: const Icon(
              Icons.person_add_rounded,
              size: 36,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Profile Incomplete',
            style: AppType.h2.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Complete your profile to manage tomorrow\'s cart and deliveries.',
            textAlign: TextAlign.center,
            style: AppType.caption.copyWith(
              color: Colors.white.withValues(alpha: 0.75),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => Navigator.push(
              context,
              SlideUpRoute(page: const CompleteProfileScreen()),
            ),
            icon: const Icon(Icons.arrow_forward_rounded, size: 18),
            label: const Text('Complete Profile'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppColors.primary,
              minimumSize: const Size(200, 48),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Locked Banner ─────────────────────────────────────────────────────────────

class _LockedBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.orange.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.orange.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.lock_clock_rounded,
              size: 18,
              color: Colors.orange,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              "Tomorrow's cart is locked. You're now editing the day after tomorrow.",
              style: AppType.small.copyWith(color: Colors.orange[800]),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Milk Card ─────────────────────────────────────────────────────────────────

class _CartDeliverySummaryCard extends StatelessWidget {
  final Map<String, dynamic> status;
  final bool isLocked;

  const _CartDeliverySummaryCard({
    required this.status,
    required this.isLocked,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveMilk = status['effective_milk'];
    final hasMilk = effectiveMilk is Map;
    final extraCount = ((status['extra_items'] as List?) ?? const []).length;
    final milkKey = hasMilk
        ? (effectiveMilk['milk_type'] as String? ?? '').toLowerCase()
        : '';
    final milkType = hasMilk
        ? AppConstants.milkTypeLabels[milkKey] ?? 'Milk'
        : null;

    return PremiumCard(
      padding: const EdgeInsets.all(16),
      borderRadius: 20,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
              isLocked
                  ? Icons.event_available_rounded
                  : Icons.local_shipping_rounded,
              color: AppColors.primary,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isLocked ? 'Next editable delivery' : 'Scheduled delivery',
                  style: AppType.captionBold,
                ),
                const SizedBox(height: 4),
                Text(
                  CartDeliveryCopy.targetPhrase(status),
                  style: AppType.small.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  CartDeliveryCopy.cartSummary(status),
                  style: AppType.small.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
                ),
                if (hasMilk || extraCount > 0) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (hasMilk)
                        _DeliverySummaryChip(
                          icon: Icons.water_drop_rounded,
                          label: milkType!,
                        ),
                      if (extraCount > 0)
                        _DeliverySummaryChip(
                          icon: Icons.shopping_bag_rounded,
                          label:
                              '$extraCount extra ${extraCount == 1 ? 'item' : 'items'}',
                        ),
                    ],
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

class _DeliverySummaryChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _DeliverySummaryChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surfaceBg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.primary),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppType.micro.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _MilkCard extends StatefulWidget {
  final Map<String, dynamic> milk;
  final bool isLocked;
  final Future<void> Function(double) onQuantityConfirmed;

  const _MilkCard({
    required this.milk,
    required this.isLocked,
    required this.onQuantityConfirmed,
  });

  @override
  State<_MilkCard> createState() => _MilkCardState();
}

class _MilkCardState extends State<_MilkCard> {
  late double _pendingQty;
  bool _saving = false;

  double get _actualQty =>
      (widget.milk['quantity_litres'] as num?)?.toDouble() ?? 0.5;
  double get _pricePerLitre =>
      (widget.milk['price_per_litre'] as num?)?.toDouble() ?? 0.0;

  @override
  void initState() {
    super.initState();
    _pendingQty = _actualQty;
  }

  @override
  void didUpdateWidget(_MilkCard old) {
    super.didUpdateWidget(old);
    final oldActual = (old.milk['quantity_litres'] as num?)?.toDouble() ?? 0.5;
    if (_actualQty != oldActual) {
      // server confirmed new quantity — sync pending
      setState(() => _pendingQty = _actualQty);
    }
  }

  bool get _isDirty => _pendingQty != _actualQty;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Top row: icon + info + stepper ─────────────────────
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 276;
              final info = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          '${AppConstants.milkTypeLabels[widget.milk['milk_type'] as String] ?? (widget.milk['milk_type'] as String).toUpperCase()} Milk',
                          overflow: TextOverflow.ellipsis,
                          style: AppType.bodyBold,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(
                        Icons.lock_outline_rounded,
                        size: 13,
                        color: AppColors.textHint,
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: _isDirty
                        ? Text(
                            '${_pendingQty % 1 == 0 ? _pendingQty.toInt() : _pendingQty}L  ·  ₹${(_pricePerLitre * _pendingQty).toStringAsFixed(0)}/day',
                            key: ValueKey(_pendingQty),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppType.small.copyWith(
                              color: AppColors.primary,
                            ),
                          )
                        : Text(
                            '₹${widget.milk['price_per_litre']}/L',
                            key: const ValueKey('base'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppType.small.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                  ),
                ],
              );
              final stepper = _MiniStepper(
                value: _pendingQty,
                disabled: widget.isLocked || _saving,
                onChanged: (v) => setState(() => _pendingQty = v),
              );

              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        _MilkTypeIcon(
                          milkType: (widget.milk['milk_type'] as String? ?? '')
                              .toLowerCase(),
                        ),
                        Expanded(child: info),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Align(alignment: Alignment.centerRight, child: stepper),
                  ],
                );
              }

              return Row(
                children: [
                  _MilkTypeIcon(
                    milkType: (widget.milk['milk_type'] as String? ?? '')
                        .toLowerCase(),
                  ),
                  Expanded(child: info),
                  stepper,
                ],
              );
            },
          ),

          // ── Confirm row (slides in when dirty) ─────────────────
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
            child: _isDirty
                ? Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Row(
                      children: [
                        TextButton(
                          onPressed: _saving
                              ? null
                              : () => setState(() => _pendingQty = _actualQty),
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.textSecondary,
                          ),
                          child: const Text('Cancel'),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _saving
                                ? null
                                : () async {
                                    setState(() => _saving = true);
                                    await widget.onQuantityConfirmed(
                                      _pendingQty,
                                    );
                                    if (mounted) {
                                      setState(() => _saving = false);
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size.fromHeight(40),
                            ),
                            child: _saving
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Text(
                                    'Update · ₹${(_pricePerLitre * _pendingQty).toStringAsFixed(0)}/day',
                                    style: AppType.small.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

// ── Skipped Card ──────────────────────────────────────────────────────────────

class _SkippedCard extends StatefulWidget {
  final VoidCallback onRevert;

  const _SkippedCard({required this.onRevert});

  @override
  State<_SkippedCard> createState() => _SkippedCardState();
}

class _SkippedCardState extends State<_SkippedCard> {
  bool _reverting = false;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      color: AppColors.error.withValues(alpha: 0.05),
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.event_busy_rounded,
              size: 24,
              color: AppColors.error,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Delivery Skipped',
            style: AppType.captionBold.copyWith(color: AppColors.error),
          ),
          const SizedBox(height: 4),
          Text(
            'No delivery scheduled for tomorrow',
            style: AppType.small.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _reverting
                ? null
                : () async {
                    setState(() => _reverting = true);
                    widget.onRevert();
                  },
            icon: _reverting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      color: AppColors.error,
                      strokeWidth: 2,
                    ),
                  )
                : const Icon(Icons.undo_rounded, size: 16),
            label: Text(_reverting ? 'Undoing…' : 'Undo Skip'),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.error, width: 1.5),
              foregroundColor: AppColors.error,
              minimumSize: const Size(double.infinity, 44),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Empty Extras Card ─────────────────────────────────────────────────────────

class _EmptyExtrasCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final products = context.select<CartProvider, List<dynamic>>(
      (cart) => cart.products,
    );
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          Center(
            child: Column(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBg,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.local_dining_rounded,
                    size: 28,
                    color: AppColors.textHint,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Your morning is missing something fresh',
                  textAlign: TextAlign.center,
                  style: AppType.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Product glimpse strip ─────────────────────────────
          _ProductGlimpseStrip(products: products),

          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ProductsScreen()),
            ),
            icon: const Icon(Icons.storefront_rounded, size: 18),
            label: const Text('Browse Dairy Essentials'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(double.infinity, 48),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

// ── Extra Item Card ───────────────────────────────────────────────────────────

class _ProductGlimpseStrip extends StatelessWidget {
  final List<dynamic> products;

  const _ProductGlimpseStrip({required this.products});

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return const SizedBox(
        height: 72,
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    final preview = products.take(6).toList();
    return SizedBox(
      height: 80,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: preview.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final p = preview[i];
          final cover =
              (p['cover_image_small'] ?? p['cover_image_large']) as String?;
          final images = p['images'];
          final url = (cover != null && cover.isNotEmpty)
              ? cover
              : (images is List && images.isNotEmpty
                    ? images[0] as String?
                    : null);

          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.surfaceBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: url != null && url.isNotEmpty
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: CachedNetworkImage(
                          imageUrl: url,
                          fit: BoxFit.cover,
                          memCacheWidth: 96,
                          memCacheHeight: 96,
                          errorWidget: (_, __, ___) => const Icon(
                            Icons.shopping_bag_rounded,
                            color: AppColors.primary,
                            size: 20,
                          ),
                        ),
                      )
                    : const Icon(
                        Icons.shopping_bag_rounded,
                        color: AppColors.primary,
                        size: 20,
                      ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                width: 56,
                child: Text(
                  p['name'] ?? '',
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.micro.copyWith(color: AppColors.textSecondary),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ExtraItemCard extends StatefulWidget {
  final Map<String, dynamic> item;
  final bool isLocked;
  final Future<bool> Function() onRemove;

  const _ExtraItemCard({
    required this.item,
    required this.isLocked,
    required this.onRemove,
  });

  @override
  State<_ExtraItemCard> createState() => _ExtraItemCardState();
}

class _ExtraItemCardState extends State<_ExtraItemCard> {
  bool _removing = false;

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(widget.item['product_id'] ?? ''),
      direction: widget.isLocked
          ? DismissDirection.none
          : DismissDirection.endToStart,
      confirmDismiss: (_) => widget.onRemove(),
      background: Container(
        padding: const EdgeInsets.only(right: 20),
        alignment: Alignment.centerRight,
        decoration: BoxDecoration(
          color: AppColors.error,
          borderRadius: BorderRadius.circular(24),
        ),
        child: const Icon(Icons.delete_outline_rounded, color: Colors.white),
      ),
      child: PremiumCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            _ExtraItemThumb(productId: widget.item['product_id']),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.item['product_name'] ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.captionBold,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Qty: ${widget.item['quantity']}',
                    style: AppType.small.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              '₹${((widget.item['total'] as num?) ?? 0).toStringAsFixed(0)}',
              style: AppType.bodyBold.copyWith(color: AppColors.primary),
            ),
            if (!widget.isLocked) ...[
              const SizedBox(width: 8),
              Tappable(
                onTap: _removing
                    ? null
                    : () async {
                        setState(() => _removing = true);
                        final ok = await widget.onRemove();
                        if (mounted && !ok) {
                          setState(() => _removing = false);
                        }
                      },
                scaleFactor: 0.9,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: _removing
                      ? const Padding(
                          padding: EdgeInsets.all(8),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.error,
                          ),
                        )
                      : const Icon(
                          Icons.delete_outline_rounded,
                          size: 16,
                          color: AppColors.error,
                        ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Total Card ────────────────────────────────────────────────────────────────

class _TotalCard extends StatelessWidget {
  final double amount;

  const _TotalCard({required this.amount});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Delivery Total',
                  style: AppType.small.copyWith(
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                ),
                const SizedBox(height: 2),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '₹${amount.toStringAsFixed(2)}',
                    style: AppType.h2.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.receipt_long_rounded,
              color: Colors.white,
              size: 22,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Pending (locally-saved, unconfirmed) changes ──────────────────────────────

class _PendingChangesHeader extends StatelessWidget {
  final int count;

  const _PendingChangesHeader({required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(
          Icons.edit_calendar_rounded,
          size: 16,
          color: Colors.amberAccent,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Unconfirmed changes',
            style: AppType.captionBold.copyWith(
              color: Colors.white,
              shadows: [const Shadow(color: Colors.black54, blurRadius: 8)],
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: Colors.amber.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.amber.withValues(alpha: 0.6)),
          ),
          child: Text(
            '$count saved locally',
            style: AppType.micro.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _PendingItemCard extends StatelessWidget {
  final PendingCartItem item;
  final VoidCallback onRemove;
  final ValueChanged<int> onQuantityChanged;

  const _PendingItemCard({
    required this.item,
    required this.onRemove,
    required this.onQuantityChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Colors.amber.withValues(alpha: 0.55),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.amber.withValues(alpha: 0.12),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          _PendingThumb(coverImage: item.coverImage),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.captionBold,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'Not saved yet',
                        style: AppType.micro.copyWith(
                          color: Colors.amber[800],
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        '₹${item.price.toStringAsFixed(0)}/${item.unit}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppType.small.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _PendingQtyStepper(
            quantity: item.quantity,
            onChanged: onQuantityChanged,
          ),
          const SizedBox(width: 8),
          Tappable(
            onTap: onRemove,
            scaleFactor: 0.9,
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.delete_outline_rounded,
                size: 16,
                color: AppColors.error,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PendingThumb extends StatelessWidget {
  final String? coverImage;

  const _PendingThumb({required this.coverImage});

  @override
  Widget build(BuildContext context) {
    final url = coverImage;
    return Container(
      width: 44,
      height: 44,
      margin: const EdgeInsets.only(right: 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: url != null && url.isNotEmpty
          ? ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                memCacheWidth: 88,
                memCacheHeight: 88,
                errorWidget: (_, __, ___) => const Icon(
                  Icons.shopping_bag_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
            )
          : const Icon(
              Icons.shopping_bag_rounded,
              color: AppColors.primary,
              size: 20,
            ),
    );
  }
}

class _PendingQtyStepper extends StatelessWidget {
  final int quantity;
  final ValueChanged<int> onChanged;

  const _PendingQtyStepper({required this.quantity, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _btn(Icons.remove_rounded, () => onChanged(quantity - 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            '$quantity',
            style: AppType.captionBold.copyWith(color: AppColors.primary),
          ),
        ),
        _btn(Icons.add_rounded, () => onChanged(quantity + 1)),
      ],
    );
  }

  Widget _btn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Container(
        width: 26,
        height: 26,
        decoration: const BoxDecoration(
          color: AppColors.primaryLight,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 14, color: AppColors.primary),
      ),
    );
  }
}

class _ConfirmChangesButton extends StatelessWidget {
  final double pendingTotal;
  final int count;
  final VoidCallback onConfirm;

  const _ConfirmChangesButton({
    required this.pendingTotal,
    required this.count,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: () {
        HapticFeedback.mediumImpact();
        onConfirm();
      },
      icon: const Icon(Icons.check_circle_rounded, size: 20),
      label: Text(
        'Confirm $count change${count > 1 ? 's' : ''} · ₹${pendingTotal.toStringAsFixed(0)}',
        style: AppType.button.copyWith(color: Colors.white),
      ),
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.success,
        minimumSize: const Size.fromHeight(50),
      ),
    );
  }
}

// ── Quick Add Sheet ───────────────────────────────────────────────────────────

class _QuickAddSheet extends StatefulWidget {
  final CartProvider cart;
  final ValueChanged<int> onAdded;

  const _QuickAddSheet({required this.cart, required this.onAdded});

  @override
  State<_QuickAddSheet> createState() => _QuickAddSheetState();
}

class _QuickAddSheetState extends State<_QuickAddSheet> {
  // productId -> quantity staged for adding
  final Map<String, int> _basket = {};
  // Adds are instant (local pending cache), but kept as a guard against
  // double-taps while the sheet is dismissing.
  final bool _confirming = false;

  int get _totalItems => _basket.values.fold(0, (s, q) => s + q);

  @override
  void initState() {
    super.initState();
    widget.cart.loadProducts();
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(bottom: mediaQuery.viewInsets.bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: mediaQuery.size.height * 0.85),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle
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
                  const SizedBox(height: 20),
                  Text('Quick Add', style: AppType.h2),
                  const SizedBox(height: 4),
                  Text(
                    'Tap items to add to your order',
                    style: AppType.small.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ── Product chips ─────────────────────────────────────
                  AnimatedBuilder(
                    animation: widget.cart,
                    builder: (context, _) {
                      final products = widget.cart.products;
                      if (products.isEmpty) {
                        return const Center(
                          child: Padding(
                            padding: EdgeInsets.symmetric(vertical: 20),
                            child: CircularProgressIndicator(strokeWidth: 2.5),
                          ),
                        );
                      }

                      final essentials = products.take(6).toList();
                      return Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: essentials.map((p) {
                          final id = (p['id'] as String?) ?? '';
                          final qty = _basket[id] ?? 0;
                          final inBasket = qty > 0;

                          return AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            decoration: BoxDecoration(
                              color: inBasket
                                  ? AppColors.primaryLight
                                  : AppColors.surfaceBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: inBasket
                                    ? AppColors.primary
                                    : AppColors.border,
                                width: inBasket ? 1.5 : 1,
                              ),
                            ),
                            child: inBasket
                                ? _BasketChip(
                                    name: p['name'] ?? '',
                                    qty: qty,
                                    maxNameWidth: (mediaQuery.size.width - 144)
                                        .clamp(40.0, double.infinity)
                                        .toDouble(),
                                    onIncrement: _confirming
                                        ? null
                                        : () => setState(
                                            () => _basket[id] = qty + 1,
                                          ),
                                    onDecrement: _confirming
                                        ? null
                                        : () => setState(() {
                                            if (qty <= 1) {
                                              _basket.remove(id);
                                            } else {
                                              _basket[id] = qty - 1;
                                            }
                                          }),
                                  )
                                : Tappable(
                                    onTap: _confirming
                                        ? null
                                        : () {
                                            HapticFeedback.lightImpact();
                                            setState(() => _basket[id] = 1);
                                          },
                                    scaleFactor: 0.93,
                                    enableFeedback: false,
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 10,
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(
                                            Icons.add_circle_outline_rounded,
                                            size: 18,
                                            color: AppColors.primary,
                                          ),
                                          const SizedBox(width: 8),
                                          ConstrainedBox(
                                            constraints: BoxConstraints(
                                              maxWidth:
                                                  (mediaQuery.size.width - 112)
                                                      .clamp(
                                                        40.0,
                                                        double.infinity,
                                                      )
                                                      .toDouble(),
                                            ),
                                            child: Text(
                                              p['name'] ?? '',
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: AppType.captionBold,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                          );
                        }).toList(),
                      );
                    },
                  ),

                  // ── Basket summary + confirm ──────────────────────────
                  AnimatedSize(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeOut,
                    child: _basket.isNotEmpty
                        ? Padding(
                            padding: const EdgeInsets.only(top: 20),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // Summary chips
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: _basket.entries.map((e) {
                                    final product = widget.cart.products
                                        .firstWhere(
                                          (p) => (p['id'] as String?) == e.key,
                                          orElse: () => <String, dynamic>{},
                                        );
                                    return Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.success.withValues(
                                          alpha: 0.1,
                                        ),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: ConstrainedBox(
                                        constraints: BoxConstraints(
                                          maxWidth: (mediaQuery.size.width - 92)
                                              .clamp(40.0, double.infinity)
                                              .toDouble(),
                                        ),
                                        child: Text(
                                          '${product['name'] ?? e.key} ×${e.value}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: AppType.micro.copyWith(
                                            color: AppColors.success,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    );
                                  }).toList(),
                                ),
                                const SizedBox(height: 12),
                                // Confirm button
                                ElevatedButton.icon(
                                  onPressed: _confirming ? null : _confirmAdd,
                                  icon: _confirming
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            color: Colors.white,
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.check_rounded,
                                          size: 18,
                                        ),
                                  label: Text(
                                    _confirming
                                        ? 'Adding…'
                                        : 'Add $_totalItems item${_totalItems > 1 ? 's' : ''} to Cart',
                                    style: AppType.button.copyWith(
                                      color: Colors.white,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    minimumSize: const Size.fromHeight(48),
                                  ),
                                ),
                              ],
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),

                  const SizedBox(height: 12),

                  // Browse all
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _confirming
                          ? null
                          : () {
                              Navigator.pop(context);
                              Navigator.push(
                                context,
                                SlideRightRoute(page: const ProductsScreen()),
                              );
                            },
                      icon: const Icon(Icons.storefront_rounded, size: 18),
                      label: const Text('Browse All Products'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _confirmAdd() {
    if (_basket.isEmpty) return;

    // Stage items into the local pending cache instead of hitting the server.
    // They become visible in the cart and are flushed on confirmation.
    for (final entry in _basket.entries) {
      final product = widget.cart.products.firstWhere(
        (p) => (p['id'] as String?) == entry.key,
        orElse: () => <String, dynamic>{},
      );
      if (product.isEmpty) continue;
      widget.cart.addPendingItem(
        PendingCartItem.fromProduct(product, entry.value),
      );
    }

    final added = _totalItems;
    Navigator.pop(context);
    widget.onAdded(added);
  }
}

// ── Basket Chip (in-basket item with stepper) ─────────────────────────────────

class _BasketChip extends StatelessWidget {
  final String name;
  final int qty;
  final double maxNameWidth;
  final VoidCallback? onIncrement;
  final VoidCallback? onDecrement;

  const _BasketChip({
    required this.name,
    required this.qty,
    required this.maxNameWidth,
    required this.onIncrement,
    required this.onDecrement,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: onDecrement,
            child: Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.remove_rounded,
                size: 14,
                color: Colors.white,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: maxNameWidth),
                  child: Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.captionBold.copyWith(
                      color: AppColors.primary,
                    ),
                  ),
                ),
                Text(
                  'qty $qty',
                  style: AppType.micro.copyWith(color: AppColors.primary),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onIncrement,
            child: Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.add_rounded,
                size: 14,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Milk Type Icon ────────────────────────────────────────────────────────────

class _MilkTypeIcon extends StatelessWidget {
  final String milkType;
  const _MilkTypeIcon({required this.milkType});

  @override
  Widget build(BuildContext context) {
    final bool useEmoji = milkType == 'cow' || milkType == 'buffalo';
    final String emoji = milkType == 'cow'
        ? '🐄'
        : milkType == 'buffalo'
        ? '🐃'
        : '';
    final bool isInfant = milkType == 'toned' || milkType == 'double_toned';

    return Container(
      width: 48,
      height: 48,
      margin: const EdgeInsets.only(right: 14),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(14),
      ),
      child: useEmoji
          ? Center(child: Text(emoji, style: const TextStyle(fontSize: 24)))
          : Icon(
              isInfant ? Icons.child_care_rounded : Icons.water_drop_rounded,
              color: AppColors.primary,
              size: 24,
            ),
    );
  }
}

// ── Extra Item Thumb ──────────────────────────────────────────────────────────

class _ExtraItemThumb extends StatelessWidget {
  final String? productId;
  const _ExtraItemThumb({required this.productId});

  @override
  Widget build(BuildContext context) {
    final products = context.read<CartProvider>().products;
    final product = products.firstWhere(
      (p) => p['id'] == productId || p['_id'] == productId,
      orElse: () => <String, dynamic>{},
    );
    final cover =
        (product['cover_image_small'] ?? product['cover_image_large'])
            as String?;
    final images = product['images'];
    final url = (cover != null && cover.isNotEmpty)
        ? cover
        : (images is List && images.isNotEmpty ? images[0] as String? : null);

    return Container(
      width: 44,
      height: 44,
      margin: const EdgeInsets.only(right: 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: url != null && url.isNotEmpty
          ? ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                memCacheWidth: 88,
                memCacheHeight: 88,
                errorWidget: (_, __, ___) => const Icon(
                  Icons.shopping_bag_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
            )
          : const Icon(
              Icons.shopping_bag_rounded,
              color: AppColors.primary,
              size: 20,
            ),
    );
  }
}

// ── Mini Stepper ──────────────────────────────────────────────────────────────

class _MiniStepper extends StatelessWidget {
  final double value;
  final ValueChanged<double> onChanged;
  final bool disabled;

  const _MiniStepper({
    required this.value,
    required this.onChanged,
    this.disabled = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _btn(
          Icons.remove_rounded,
          disabled || value <= 0.5 ? null : () => onChanged(value - 0.5),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            '${value % 1 == 0 ? value.toInt() : value}L',
            style: AppType.h3.copyWith(
              color: disabled ? AppColors.textHint : AppColors.primary,
            ),
          ),
        ),
        _btn(
          Icons.add_rounded,
          disabled || value >= 10 ? null : () => onChanged(value + 0.5),
        ),
      ],
    );
  }

  Widget _btn(IconData icon, VoidCallback? onTap) {
    final isDisabled = onTap == null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: isDisabled ? AppColors.border : AppColors.primaryLight,
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: 16,
          color: isDisabled ? AppColors.textHint : AppColors.primary,
        ),
      ),
    );
  }
}
