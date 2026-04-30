import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/tappable.dart';
import '../../widgets/app_snackbar.dart';
import '../../utils/transitions.dart';
import '../../providers/cart_provider.dart';
import '../products/products_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen>
    with SingleTickerProviderStateMixin {
  bool _showSavePill = false;
  bool _skipping = false;
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CartProvider>().loadTomorrowStatus();
      _fadeCtrl.forward();
    });
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    super.dispose();
  }

  void _showAutoSave() {
    setState(() => _showSavePill = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _showSavePill = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: Stack(
          children: [
            cart.tomorrowStatus == null
                ? cart.error != null
                    ? FullScreenError(
                        message: cart.error!,
                        icon: cart.error!.contains('internet') ||
                                cart.error!.contains('network')
                            ? Icons.wifi_off_rounded
                            : Icons.error_outline_rounded,
                        onRetry: () {
                          cart.clearError();
                          cart.loadTomorrowStatus();
                        },
                      )
                    : const Center(child: SkeletonCardLoader())
                : FadeTransition(
                    opacity: _fadeAnim,
                    child: RefreshIndicator(
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
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      cart.isLocked
                                          ? 'Day After Tomorrow'
                                          : "Tomorrow's Cart",
                                      style: AppType.h1,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      cart.tomorrowStatus!['date'] ?? '',
                                      style: AppType.caption.copyWith(
                                          color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                              if (!cart.isSkipped && cart.totalAmount > 0)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryLight,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    '₹${cart.totalAmount.toStringAsFixed(0)}',
                                    style: AppType.captionBold.copyWith(
                                        color: AppColors.primary),
                                  ),
                                ),
                            ],
                          ),

                          // ── Locked banner ───────────────────────────
                          if (cart.isLocked) ...[
                            const SizedBox(height: 14),
                            _LockedBanner(),
                          ],

                          const SizedBox(height: 24),

                          // ── Milk Section ────────────────────────────
                          if (cart.effectiveMilk != null) ...[
                            const SectionLabel('Milk Delivery'),
                            const SizedBox(height: 12),
                            _MilkCard(
                              milk: cart.effectiveMilk!,
                              isLocked: cart.isLocked,
                              onQuantityConfirmed: (v) async {
                                HapticFeedback.lightImpact();
                                final ok = await cart.modifyQuantity(v);
                                if (!context.mounted) return;
                                if (ok) {
                                  _showAutoSave();
                                } else {
                                  AppSnackbar.error(context,
                                      cart.error ?? 'Failed to update quantity.');
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
                                        final ok = await cart.skipTomorrow();
                                        if (!context.mounted) return;
                                        setState(() => _skipping = false);
                                        if (ok) {
                                          _showAutoSave();
                                        } else {
                                          AppSnackbar.error(context,
                                              cart.error ?? 'Failed to skip delivery.');
                                        }
                                      },
                                icon: _skipping
                                    ? const SizedBox(
                                        width: 15,
                                        height: 15,
                                        child: CircularProgressIndicator(
                                            color: AppColors.error,
                                            strokeWidth: 2),
                                      )
                                    : const Icon(Icons.event_busy_rounded,
                                        size: 15),
                                label: Text(_skipping ? 'Skipping…' : 'Skip tomorrow'),
                                style: TextButton.styleFrom(
                                  foregroundColor: AppColors.error,
                                  textStyle: AppType.small.copyWith(
                                      fontWeight: FontWeight.w600),
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
                                  _showAutoSave();
                                } else {
                                  AppSnackbar.error(context,
                                      cart.error ?? 'Failed to undo skip.');
                                }
                              },
                            ),
                          ],

                          const SizedBox(height: 24),

                          // ── Extra Items ─────────────────────────────
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const SectionLabel('Extra Items'),
                              Tappable(
                                onTap: () => _showQuickAddSheet(context),
                                scaleFactor: 0.93,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryLight,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.add_rounded,
                                          size: 16, color: AppColors.primary),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Quick Add',
                                        style: AppType.micro.copyWith(
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w700),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          if (cart.extraItems.isEmpty)
                            _EmptyExtrasCard()
                          else
                            ...cart.extraItems.map((item) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _ExtraItemCard(
                                    item: item,
                                    isLocked: cart.isLocked,
                                    onRemove: () async {
                                      HapticFeedback.mediumImpact();
                                      final ok = await cart
                                          .removeItem(item['product_id']);
                                      if (!context.mounted) return false;
                                      if (ok) {
                                        _showAutoSave();
                                      } else {
                                        AppSnackbar.error(context,
                                            cart.error ?? 'Failed to remove item.');
                                      }
                                      return ok;
                                    },
                                  ),
                                )),

                          // ── Total ───────────────────────────────────
                          if (!cart.isSkipped && cart.totalAmount > 0) ...[
                            const SizedBox(height: 16),
                            _TotalCard(amount: cart.totalAmount),
                          ],

                          const SizedBox(height: 100),
                        ],
                      ),
                    ),
                  ),

            // Auto-save pill
            Positioned(
              top: 8,
              left: 0,
              right: 0,
              child: Center(child: AutoSavePill(visible: _showSavePill)),
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
        onAdded: _showAutoSave,
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
            child: const Icon(Icons.lock_clock_rounded,
                size: 18, color: Colors.orange),
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
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.water_drop_rounded,
                    color: AppColors.primary, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '${(widget.milk['milk_type'] as String).toUpperCase()} Milk',
                          style: AppType.bodyBold,
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.lock_outline_rounded,
                            size: 13, color: AppColors.textHint),
                      ],
                    ),
                    const SizedBox(height: 2),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: _isDirty
                          ? Text(
                              '${_pendingQty % 1 == 0 ? _pendingQty.toInt() : _pendingQty}L  ·  ₹${(_pricePerLitre * _pendingQty).toStringAsFixed(0)}/day',
                              key: ValueKey(_pendingQty),
                              style: AppType.small
                                  .copyWith(color: AppColors.primary),
                            )
                          : Text(
                              '₹${widget.milk['price_per_litre']}/L',
                              key: const ValueKey('base'),
                              style: AppType.small
                                  .copyWith(color: AppColors.textSecondary),
                            ),
                    ),
                  ],
                ),
              ),
              _MiniStepper(
                value: _pendingQty,
                disabled: widget.isLocked || _saving,
                onChanged: (v) => setState(() => _pendingQty = v),
              ),
            ],
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
                              foregroundColor: AppColors.textSecondary),
                          child: const Text('Cancel'),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _saving
                                ? null
                                : () async {
                                    setState(() => _saving = true);
                                    await widget
                                        .onQuantityConfirmed(_pendingQty);
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
                                        color: Colors.white, strokeWidth: 2),
                                  )
                                : Text(
                                    'Update · ₹${(_pricePerLitre * _pendingQty).toStringAsFixed(0)}/day',
                                    style: AppType.small.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700),
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
            child: const Icon(Icons.event_busy_rounded,
                size: 24, color: AppColors.error),
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
                        color: AppColors.error, strokeWidth: 2),
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
    return PremiumCard(
      child: Column(
        children: [
          const SizedBox(height: 8),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.surfaceBg,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.local_dining_rounded,
                size: 28, color: AppColors.textHint),
          ),
          const SizedBox(height: 14),
          Text(
            'Your morning is missing something fresh',
            textAlign: TextAlign.center,
            style: AppType.caption
                .copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
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
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.surfaceBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.shopping_bag_rounded,
                  color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.item['product_name'] ?? '',
                      style: AppType.captionBold),
                  const SizedBox(height: 2),
                  Text(
                    'Qty: ${widget.item['quantity']}',
                    style: AppType.small
                        .copyWith(color: AppColors.textSecondary),
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
                              strokeWidth: 2, color: AppColors.error),
                        )
                      : const Icon(Icons.delete_outline_rounded,
                          size: 16, color: AppColors.error),
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
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tomorrow\'s Total',
                style: AppType.small.copyWith(
                    color: Colors.white.withValues(alpha: 0.8)),
              ),
              const SizedBox(height: 2),
              Text(
                '₹${amount.toStringAsFixed(2)}',
                style: AppType.h2.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.receipt_long_rounded,
                color: Colors.white, size: 22),
          ),
        ],
      ),
    );
  }
}

// ── Quick Add Sheet ───────────────────────────────────────────────────────────

class _QuickAddSheet extends StatefulWidget {
  final CartProvider cart;
  final VoidCallback onAdded;

  const _QuickAddSheet({required this.cart, required this.onAdded});

  @override
  State<_QuickAddSheet> createState() => _QuickAddSheetState();
}

class _QuickAddSheetState extends State<_QuickAddSheet> {
  // productId -> quantity staged for adding
  final Map<String, int> _basket = {};
  bool _confirming = false;

  int get _totalItems => _basket.values.fold(0, (s, q) => s + q);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 24),
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
          Text('Tap items to add to your order',
              style: AppType.small.copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: 20),

          // ── Product chips ─────────────────────────────────────
          FutureBuilder(
            future: widget.cart.loadProducts(),
            builder: (context, snapshot) {
              if (widget.cart.products.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  ),
                );
              }

              final essentials = widget.cart.products.take(6).toList();
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
                        color: inBasket ? AppColors.primary : AppColors.border,
                        width: inBasket ? 1.5 : 1,
                      ),
                    ),
                    child: inBasket
                        ? _BasketChip(
                            name: p['name'] ?? '',
                            qty: qty,
                            onIncrement: _confirming
                                ? null
                                : () => setState(
                                    () => _basket[id] = qty + 1),
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
                                  horizontal: 14, vertical: 10),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                      Icons.add_circle_outline_rounded,
                                      size: 18,
                                      color: AppColors.primary),
                                  const SizedBox(width: 8),
                                  Text(p['name'] ?? '',
                                      style: AppType.captionBold),
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
                                    orElse: () => <String, dynamic>{});
                            return Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.success
                                    .withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${product['name'] ?? e.key} ×${e.value}',
                                style: AppType.micro.copyWith(
                                  color: AppColors.success,
                                  fontWeight: FontWeight.w700,
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
                                      color: Colors.white, strokeWidth: 2),
                                )
                              : const Icon(Icons.check_rounded, size: 18),
                          label: Text(
                            _confirming
                                ? 'Adding…'
                                : 'Add $_totalItems item${_totalItems > 1 ? 's' : ''} to Cart',
                            style: AppType.button
                                .copyWith(color: Colors.white),
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
    );
  }

  Future<void> _confirmAdd() async {
    if (_basket.isEmpty) return;
    setState(() => _confirming = true);

    bool anyFailed = false;
    for (final entry in _basket.entries) {
      final ok = await widget.cart.addItem(entry.key, entry.value);
      if (!ok) anyFailed = true;
      if (!mounted) return;
    }

    if (!context.mounted) return;
    setState(() => _confirming = false);

    if (anyFailed) {
      AppSnackbar.error(
          context, widget.cart.error ?? 'Some items could not be added.');
    } else {
      Navigator.pop(context);
      widget.onAdded();
    }
  }
}

// ── Basket Chip (in-basket item with stepper) ─────────────────────────────────

class _BasketChip extends StatelessWidget {
  final String name;
  final int qty;
  final VoidCallback? onIncrement;
  final VoidCallback? onDecrement;

  const _BasketChip({
    required this.name,
    required this.qty,
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
              child: const Icon(Icons.remove_rounded,
                  size: 14, color: Colors.white),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(name,
                    style: AppType.captionBold
                        .copyWith(color: AppColors.primary)),
                Text('qty $qty',
                    style: AppType.micro.copyWith(color: AppColors.primary)),
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
              child: const Icon(Icons.add_rounded,
                  size: 14, color: Colors.white),
            ),
          ),
        ],
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
        _btn(Icons.remove_rounded,
            disabled || value <= 0.5 ? null : () => onChanged(value - 0.5)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            '${value % 1 == 0 ? value.toInt() : value}L',
            style: AppType.h3.copyWith(
              color: disabled ? AppColors.textHint : AppColors.primary,
            ),
          ),
        ),
        _btn(Icons.add_rounded,
            disabled || value >= 10 ? null : () => onChanged(value + 0.5)),
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
        child: Icon(icon,
            size: 16,
            color: isDisabled ? AppColors.textHint : AppColors.primary),
      ),
    );
  }
}
