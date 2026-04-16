import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../providers/cart_provider.dart';
import '../../providers/subscription_provider.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CartProvider>().loadTomorrowStatus();
      context.read<CartProvider>().loadProducts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final sub = context.watch<SubscriptionProvider>();

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () => cart.loadTomorrowStatus(),
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            children: [
              const SizedBox(height: 20),

              // Header
              const Text(
                "Tomorrow's Cart",
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.3),
              ),
              if (cart.tomorrowStatus != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Delivery on ${cart.tomorrowStatus!['date']}',
                  style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                ),
              ],

              const SizedBox(height: 24),

              // Milk Section
              if (sub.hasActiveSubscription && sub.subscription!['status'] == 'active') ...[
                const SectionLabel('Milk'),
                const SizedBox(height: 12),
                _buildMilkSection(cart, sub),
                const SizedBox(height: 24),
              ],

              // Extra Products
              const SectionLabel('Extra Products'),
              const SizedBox(height: 12),
              _buildExtrasSection(cart),
              const SizedBox(height: 16),

              // Add Products Button
              OutlinedButton.icon(
                onPressed: () => _showProductsSheet(cart),
                icon: const Icon(Icons.add_rounded, size: 20),
                label: const Text('Add Extra Products'),
              ),

              const SizedBox(height: 24),

              // Total
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600)),
                    Text(
                      'Rs.${cart.totalAmount.toStringAsFixed(2)}',
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMilkSection(CartProvider cart, SubscriptionProvider sub) {
    final baseSub = sub.subscription!;
    final baseQty = (baseSub['quantity_litres'] as num).toDouble();
    final effectiveQty = cart.effectiveMilk != null ? (cart.effectiveMilk!['quantity_litres'] as num).toDouble() : baseQty;

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (cart.isSkipped) ...[
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.error.withAlpha(15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.block_rounded, color: AppColors.error, size: 22),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Text(
                    'Delivery Skipped',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.error),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () => cart.revertOverride(),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.success,
                side: const BorderSide(color: AppColors.success, width: 1.5),
              ),
              child: const Text('Undo Skip'),
            ),
          ] else ...[
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.water_drop_rounded, color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 14),
                Text(
                  '${(baseSub['milk_type'] as String).toUpperCase()} Milk',
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Quantity stepper
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceBg,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _stepperButton(
                      Icons.remove_rounded,
                      effectiveQty > 0.5 ? () => cart.modifyQuantity(effectiveQty - 0.5) : null,
                    ),
                    Container(
                      width: 80,
                      alignment: Alignment.center,
                      child: Text(
                        '${effectiveQty}L',
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                      ),
                    ),
                    _stepperButton(
                      Icons.add_rounded,
                      effectiveQty < 10 ? () => cart.modifyQuantity(effectiveQty + 0.5) : null,
                    ),
                  ],
                ),
              ),
            ),

            if (effectiveQty != baseQty) ...[
              const SizedBox(height: 12),
              Center(
                child: TextButton(
                  onPressed: () => cart.revertOverride(),
                  child: Text('Reset to default (${baseQty}L)'),
                ),
              ),
            ],

            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () => cart.skipTomorrow(),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.error, width: 1.5),
              ),
              child: const Text('Skip Tomorrow'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _stepperButton(IconData icon, VoidCallback? onPressed) {
    final enabled = onPressed != null;
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: enabled ? AppColors.primary : AppColors.border,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: enabled ? Colors.white : AppColors.textHint, size: 22),
      ),
    );
  }

  Widget _buildExtrasSection(CartProvider cart) {
    if (cart.extraItems.isEmpty) {
      return PremiumCard(
        child: Center(
          child: Column(
            children: [
              Icon(Icons.shopping_bag_outlined, size: 36, color: AppColors.textHint),
              const SizedBox(height: 10),
              const Text('No extra products added', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
            ],
          ),
        ),
      );
    }

    return PremiumCard(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      child: Column(
        children: cart.extraItems.map((item) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.inventory_2_outlined, size: 18, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['product_name'] ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      Text(
                        '${item['quantity']}x ${item['unit']} @ Rs.${item['price']}',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                Text(
                  'Rs.${(item['total'] as num).toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary),
                ),
                const SizedBox(width: 4),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.error),
                  onPressed: () => cart.removeItem(item['product_id']),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  void _showProductsSheet(CartProvider cart) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          minChildSize: 0.4,
          expand: false,
          builder: (_, scrollController) => Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                // Handle
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Add Products',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 20),
                Expanded(
                  child: ListView.separated(
                    controller: scrollController,
                    itemCount: cart.products.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final p = cart.products[i];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                        leading: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceBg,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.inventory_2_outlined, color: AppColors.primary, size: 20),
                        ),
                        title: Text(p['name'], style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(
                          '${p['unit']} - Rs.${p['price']}',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        ),
                        trailing: GestureDetector(
                          onTap: () {
                            cart.addItem(p['id'], 1);
                            Navigator.pop(context);
                          },
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.add_rounded, color: Colors.white, size: 20),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
