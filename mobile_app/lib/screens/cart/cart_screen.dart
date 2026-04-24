import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/tappable.dart';
import '../../utils/transitions.dart';
import '../../providers/cart_provider.dart';
import '../products/products_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  bool _showSavePill = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CartProvider>().loadTomorrowStatus();
    });
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
                ? const Center(child: SkeletonCardLoader())
                : RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: cart.loadTomorrowStatus,
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      children: [
                        const SizedBox(height: 20),

                        // Header
                        Text(
                          cart.isLocked ? 'Day After Tomorrow' : "Tomorrow's Cart",
                          style: AppType.h1,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          cart.tomorrowStatus!['date'] ?? '',
                          style: AppType.caption
                              .copyWith(color: AppColors.textSecondary),
                        ),

                        // Locked banner
                        if (cart.isLocked) ...[
                          const SizedBox(height: 16),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: Colors.orange.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                  color: Colors.orange.withValues(alpha: 0.4)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.lock_clock_rounded,
                                    size: 18, color: Colors.orange),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    "Tomorrow's cart is locked. You're now editing the day after tomorrow.",
                                    style: AppType.small
                                        .copyWith(color: Colors.orange[800]),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 24),

                        // ── Milk Section ───────────────────────────
                        if (cart.effectiveMilk != null) ...[
                          const SectionLabel('Milk Delivery'),
                          const SizedBox(height: 12),

                          PremiumCard(
                            child: Row(
                              children: [
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryLight,
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: const Icon(
                                      Icons.water_drop_rounded,
                                      color: AppColors.primary,
                                      size: 24),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            '${(cart.effectiveMilk!['milk_type'] as String).toUpperCase()} Milk',
                                            style: AppType.bodyBold,
                                          ),
                                          const SizedBox(width: 6),
                                          Icon(Icons.lock_outline_rounded,
                                              size: 14,
                                              color: AppColors.textHint),
                                        ],
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '₹${cart.effectiveMilk!['price_per_litre']}/L',
                                        style: AppType.small.copyWith(
                                            color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                                // Quantity stepper (mini)
                                _MiniStepper(
                                  value: (cart.effectiveMilk!['quantity_litres']
                                          as num?)
                                      ?.toDouble() ?? 0.5,
                                  disabled: cart.isLocked,
                                  onChanged: (v) async {
                                    HapticFeedback.lightImpact();
                                    final ok =
                                        await cart.modifyQuantity(v);
                                    if (ok) _showAutoSave();
                                  },
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                        ],

                        // ── Skip / Revert ──────────────────────────
                        if (!cart.isLocked && !cart.isSkipped && cart.effectiveMilk != null)
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () async {
                                HapticFeedback.mediumImpact();
                                await cart.skipTomorrow();
                                _showAutoSave();
                              },
                              child: Text('Skip tomorrow',
                                  style: AppType.small.copyWith(
                                      color: AppColors.error,
                                      fontWeight: FontWeight.w600)),
                            ),
                          ),

                        if (cart.isSkipped)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: PremiumCard(
                              color: AppColors.error.withValues(alpha: 0.06),
                              child: Column(
                                children: [
                                  const Icon(Icons.event_busy_rounded,
                                      size: 28, color: AppColors.error),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Delivery is skipped for tomorrow',
                                    style: AppType.captionBold
                                        .copyWith(color: AppColors.error),
                                  ),
                                  const SizedBox(height: 12),
                                  OutlinedButton(
                                    onPressed: () async {
                                      HapticFeedback.mediumImpact();
                                      await cart.revertOverride();
                                      _showAutoSave();
                                    },
                                    style: OutlinedButton.styleFrom(
                                      side: const BorderSide(
                                          color: AppColors.error, width: 1.5),
                                      foregroundColor: AppColors.error,
                                      minimumSize:
                                          const Size(double.infinity, 44),
                                    ),
                                    child: const Text('Undo Skip'),
                                  ),
                                ],
                              ),
                            ),
                          ),

                        const SizedBox(height: 24),

                        // ── Extra Items ────────────────────────────
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
                                    Text('Quick Add',
                                        style: AppType.micro.copyWith(
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w700)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        if (cart.extraItems.isEmpty)
                          PremiumCard(
                            child: Column(
                              children: [
                                const SizedBox(height: 8),
                                Icon(Icons.local_dining_rounded,
                                    size: 40, color: AppColors.textHint),
                                const SizedBox(height: 14),
                                Text(
                                  'Your morning is missing something fresh',
                                  textAlign: TextAlign.center,
                                  style: AppType.caption.copyWith(
                                      color: AppColors.textSecondary),
                                ),
                                const SizedBox(height: 16),
                                OutlinedButton.icon(
                                  onPressed: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                        builder: (_) =>
                                            const ProductsScreen()),
                                  ),
                                  icon: const Icon(Icons.storefront_rounded,
                                      size: 18),
                                  label: const Text('Browse Dairy Essentials'),
                                  style: OutlinedButton.styleFrom(
                                    minimumSize:
                                        const Size(double.infinity, 48),
                                  ),
                                ),
                                const SizedBox(height: 8),
                              ],
                            ),
                          )
                        else
                          ...cart.extraItems.map((item) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Dismissible(
                                key: Key(item['product_id'] ?? ''),
                                direction: cart.isLocked
                                    ? DismissDirection.none
                                    : DismissDirection.endToStart,
                                background: Container(
                                  padding: const EdgeInsets.only(right: 20),
                                  alignment: Alignment.centerRight,
                                  decoration: BoxDecoration(
                                    color: AppColors.error,
                                    borderRadius: BorderRadius.circular(24),
                                  ),
                                  child: const Icon(Icons.delete_outline_rounded,
                                      color: Colors.white),
                                ),
                                onDismissed: (_) async {
                                  HapticFeedback.mediumImpact();
                                  await cart
                                      .removeItem(item['product_id']);
                                  _showAutoSave();
                                },
                                child: PremiumCard(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 14),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 44,
                                        height: 44,
                                        decoration: BoxDecoration(
                                          color: AppColors.surfaceBg,
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: const Icon(
                                            Icons.shopping_bag_rounded,
                                            color: AppColors.primary,
                                            size: 20),
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(item['product_name'] ?? '',
                                                style: AppType.captionBold),
                                            Text(
                                              'Qty: ${item['quantity']}',
                                              style: AppType.small.copyWith(
                                                  color: AppColors
                                                      .textSecondary),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Text(
                                        '₹${((item['total'] as num?) ?? 0).toStringAsFixed(0)}',
                                        style: AppType.bodyBold.copyWith(
                                            color: AppColors.primary),
                                      ),
                                      const SizedBox(width: 8),
                                      if (!cart.isLocked)
                                        GestureDetector(
                                          onTap: () async {
                                            HapticFeedback.mediumImpact();
                                            await cart.removeItem(item['product_id']);
                                            _showAutoSave();
                                          },
                                          child: Container(
                                            width: 32,
                                            height: 32,
                                            decoration: BoxDecoration(
                                              color: AppColors.error.withValues(alpha: 0.1),
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
                                ),
                              ),
                            );
                          }),

                        // ── Total ──────────────────────────────────
                        if (!cart.isSkipped && cart.totalAmount > 0) ...[
                          const SizedBox(height: 16),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                                vertical: 16, horizontal: 20),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  AppColors.primary,
                                  AppColors.primaryDark,
                                ],
                              ),
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.primary
                                      .withValues(alpha: 0.2),
                                  blurRadius: 20,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Total',
                                    style: AppType.bodyBold
                                        .copyWith(color: Colors.white)),
                                Text(
                                  '₹${cart.totalAmount.toStringAsFixed(2)}',
                                  style: AppType.h2.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 100),
                      ],
                    ),
                  ),

            // Auto-save pill overlay
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
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
            Text('Essentials for tomorrow',
                style: AppType.small.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 20),

            // Quick essentials — shows products from cart provider
            FutureBuilder(
              future: cart.loadProducts(),
              builder: (context, snapshot) {
                if (cart.products.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          const CircularProgressIndicator(strokeWidth: 2.5),
                          const SizedBox(height: 12),
                          Text('Loading products...',
                              style: AppType.small.copyWith(
                                  color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  );
                }

                final essentials = cart.products.take(6).toList();
                return Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: essentials.map((p) {
                    return Tappable(
                      onTap: () async {
                        HapticFeedback.lightImpact();
                        await cart.addItem(p['id'], 1);
                        if (context.mounted) {
                          Navigator.pop(context);
                          _showAutoSave();
                        }
                      },
                      scaleFactor: 0.93,
                      enableFeedback: false,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceBg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: AppColors.border, width: 1),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.add_circle_outline_rounded,
                                size: 18, color: AppColors.primary),
                            const SizedBox(width: 8),
                            Text(p['name'] ?? '',
                                style: AppType.captionBold),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),

            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.push(
                    context,
                    SlideRightRoute(page: const ProductsScreen()),
                  );
                },
                child: const Text('Browse All Products'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Mini +/- stepper for inline quantity editing.
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
        _btn(Icons.remove, disabled ? null : () {
          if (value > 0.5) onChanged(value - 0.5);
        }),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            '${value % 1 == 0 ? value.toInt() : value}L',
            style: AppType.h3.copyWith(
              color: disabled ? AppColors.textHint : AppColors.primary,
            ),
          ),
        ),
        _btn(Icons.add, disabled ? null : () {
          if (value < 10) onChanged(value + 0.5);
        }),
      ],
    );
  }

  Widget _btn(IconData icon, VoidCallback? onTap) {
    final isDisabled = onTap == null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: isDisabled
              ? AppColors.border
              : AppColors.primaryLight,
          shape: BoxShape.circle,
        ),
        child: Icon(icon,
            size: 16,
            color: isDisabled ? AppColors.textHint : AppColors.primary),
      ),
    );
  }
}
