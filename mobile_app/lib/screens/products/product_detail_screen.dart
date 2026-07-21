import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../utils/cart_delivery_copy.dart';
import '../../widgets/app_snackbar.dart';
import '../../widgets/premium_components.dart';
import '../../providers/cart_provider.dart';
import '../../models/pending_cart_item.dart';

/// Opens the product description popup, sliding up from below and
/// overlaying the current screen (per the admin-set product photo +
/// description wireframe).
Future<void> showProductDetailSheet(
  BuildContext context,
  Map<String, dynamic> product,
) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (_) => ProductDetailSheet(product: product),
  );
}

class ProductDetailSheet extends StatefulWidget {
  final Map<String, dynamic> product;
  const ProductDetailSheet({super.key, required this.product});

  @override
  State<ProductDetailSheet> createState() => _ProductDetailSheetState();
}

class _ProductDetailSheetState extends State<ProductDetailSheet> {
  int _quantity = 1;
  final ValueNotifier<int> _currentImageIndex = ValueNotifier(0);
  final PageController _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    _currentImageIndex.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.55,
      maxChildSize: 0.96,
      expand: false,
      snap: true,
      snapSizes: const [0.55, 0.9, 0.96],
      builder: (context, scrollController) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          child: Material(
            color: AppColors.scaffoldBg,
            child: Stack(
              children: [
                CustomScrollView(
                  controller: scrollController,
                  physics: const BouncingScrollPhysics(
                    parent: AlwaysScrollableScrollPhysics(),
                  ),
                  slivers: [
                    SliverToBoxAdapter(
                      child: Column(
                        children: [
                          const SizedBox(height: 10),
                          Container(
                            width: 40,
                            height: 4,
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                          const SizedBox(height: 10),
                          _buildImageSlider(p),
                        ],
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    p['name'] ?? '',
                                    style: AppType.h1,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  '₹${(p['price'] as num).toStringAsFixed(0)}',
                                  style: AppType.price.copyWith(
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            if (p['category'] != null)
                              Text(
                                p['category'] ?? '',
                                style: AppType.caption.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            const SizedBox(height: 16),

                            // Trust badges
                            const Row(
                              children: [
                                Expanded(
                                  child: TrustBadge(
                                    icon: Icons.verified_rounded,
                                    label: 'Quality Guaranteed',
                                  ),
                                ),
                                SizedBox(width: 10),
                                Expanded(
                                  child: TrustBadge(
                                    icon: Icons.verified_rounded,
                                    label: 'Freshness Guaranteed',
                                  ),
                                ),
                              ],
                            ),

                            const SizedBox(height: 20),

                            if (p['unit'] != null)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceBg,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  p['unit'] ?? '',
                                  style: AppType.small.copyWith(
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ),

                            const SizedBox(height: 24),

                            // Description (set by admin)
                            if (p['description'] != null &&
                                (p['description'] as String).isNotEmpty) ...[
                              Text('About', style: AppType.bodyBold),
                              const SizedBox(height: 8),
                              Text(
                                p['description'] ?? '',
                                style: AppType.caption.copyWith(
                                  color: AppColors.textSecondary,
                                  height: 1.6,
                                ),
                              ),
                            ],

                            const SizedBox(height: 24),

                            // Quantity selector
                            const SectionLabel('Quantity'),
                            const SizedBox(height: 12),
                            Center(
                              child: HapticStepper(
                                value: _quantity.toDouble(),
                                step: 1,
                                min: 1,
                                max: 20,
                                suffix: '',
                                onChanged: (v) =>
                                    setState(() => _quantity = v.toInt()),
                              ),
                            ),

                            const SizedBox(
                              height: 120,
                            ), // room for floating bar
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                // Close button
                Positioned(
                  top: 18,
                  right: 16,
                  child: GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.close_rounded, size: 18),
                    ),
                  ),
                ),

                // Floating bottom bar
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: StickyBottomBar(
                    child: Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Total',
                                style: AppType.small.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              Text(
                                '₹${((p['price'] as num) * _quantity).toStringAsFixed(0)}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppType.h2.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          flex: 3,
                          child: SizedBox(
                            height: 56,
                            child: ElevatedButton(
                              onPressed: _addToCart,
                              child: Text(
                                "Add to Tomorrow's Cart",
                                style: AppType.captionBold.copyWith(
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  List<String> _imageUrls(dynamic p) {
    final images = p['images'];
    if (images is! List || images.isEmpty) return [];
    final all = images.whereType<String>().toList();
    final cover = (p['cover_image_large'] ?? p['cover_image_small']) as String?;
    if (cover != null &&
        cover.isNotEmpty &&
        all.contains(cover) &&
        all[0] != cover) {
      return [cover, ...all.where((u) => u != cover)];
    }
    return all;
  }

  Widget _buildImageSlider(dynamic p) {
    final urls = _imageUrls(p);
    if (urls.isEmpty) return _imageFallback();

    return Stack(
      alignment: Alignment.bottomCenter,
      children: [
        SizedBox(
          height: 280,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: PageView.builder(
              controller: _pageController,
              itemCount: urls.length,
              onPageChanged: (i) => _currentImageIndex.value = i,
              itemBuilder: (_, i) => CachedNetworkImage(
                imageUrl: urls[i],
                fit: BoxFit.cover,
                memCacheWidth: 800,
                fadeInDuration: const Duration(milliseconds: 300),
                placeholder: (_, __) => Container(
                  color: AppColors.surfaceBg,
                  child: const Center(
                    child: Icon(
                      Icons.image_rounded,
                      color: AppColors.textHint,
                      size: 48,
                    ),
                  ),
                ),
                errorWidget: (_, __, ___) => _imageFallback(),
              ),
            ),
          ),
        ),
        if (urls.length > 1)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: ValueListenableBuilder<int>(
              valueListenable: _currentImageIndex,
              builder: (_, currentIndex, __) => Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(urls.length, (i) {
                  final active = i == currentIndex;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: active ? 20 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: active
                          ? AppColors.primary
                          : Colors.white.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
            ),
          ),
      ],
    );
  }

  void _addToCart() {
    HapticFeedback.mediumImpact();
    final cart = context.read<CartProvider>();
    // Stage into the local pending cache; it shows in the cart and is flushed
    // to the server when the user confirms.
    cart.addPendingItem(
      PendingCartItem.fromProduct(
        Map<String, dynamic>.from(widget.product),
        _quantity,
      ),
    );
    HapticFeedback.heavyImpact();
    AppSnackbar.show(
      context,
      '$_quantity item${_quantity > 1 ? 's' : ''} added. Confirm in your cart to schedule for ${CartDeliveryCopy.dateLabel(cart.tomorrowStatus)}.',
      type: SnackType.success,
      duration: const Duration(seconds: 5),
    );
    Navigator.pop(context);
  }

  Widget _imageFallback() {
    return Container(
      color: AppColors.surfaceBg,
      child: const Center(
        child: Icon(
          Icons.local_grocery_store_rounded,
          color: AppColors.textHint,
          size: 64,
        ),
      ),
    );
  }
}
