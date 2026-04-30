import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../providers/cart_provider.dart';

class ProductDetailScreen extends StatefulWidget {
  final dynamic product;
  const ProductDetailScreen({super.key, required this.product});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _quantity = 1;
  bool _addingToCart = false;
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

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: Stack(
        children: [
          // Scrollable content
          CustomScrollView(
            slivers: [
              // Image slider header
              SliverAppBar(
                expandedHeight: 320,
                pinned: true,
                backgroundColor: AppColors.scaffoldBg,
                leading: IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.arrow_back_ios_new, size: 16),
                  ),
                  onPressed: () => Navigator.pop(context),
                ),
                flexibleSpace: FlexibleSpaceBar(
                  background: _buildImageSlider(p),
                ),
              ),

              // Product info
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p['name'] ?? '', style: AppType.h1),
                      const SizedBox(height: 4),
                      if (p['category'] != null)
                        Text(
                          p['category'] ?? '',
                          style: AppType.caption
                              .copyWith(color: AppColors.textSecondary),
                        ),
                      const SizedBox(height: 16),

                      // Trust badge
                      const TrustBadge(
                        icon: Icons.verified_rounded,
                        label: 'Quality Guaranteed',
                      ),
                      const TrustBadge(
                        icon: Icons.verified_rounded,
                        label: 'Freshness Guaranteed',
                      ),

                      const SizedBox(height: 20),

                      // Price
                      Row(
                        children: [
                          Text(
                            '₹${(p['price'] as num).toStringAsFixed(0)}',
                            style: AppType.price.copyWith(color: AppColors.primary),
                          ),
                          const SizedBox(width: 8),
                          if (p['unit'] != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceBg,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                p['unit'] ?? '',
                                style: AppType.small
                                    .copyWith(color: AppColors.textSecondary),
                              ),
                            ),
                        ],
                      ),

                      const SizedBox(height: 24),

                      // Description
                      if (p['description'] != null) ...[
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

                      const SizedBox(height: 120), // room for floating bar
                    ],
                  ),
                ),
              ),
            ],
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
                        Text('Total',
                            style: AppType.small
                                .copyWith(color: AppColors.textSecondary)),
                        Text(
                          '₹${((p['price'] as num) * _quantity).toStringAsFixed(0)}',
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
                        onPressed: _addingToCart ? null : _addToCart,
                        child: _addingToCart
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2.5),
                              )
                            : Text(
                                "Add to Tomorrow's Cart",
                                style: AppType.captionBold
                                    .copyWith(color: Colors.white),
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
    );
  }

  List<String> _imageUrls(dynamic p) {
    final images = p['images'];
    if (images is List && images.isNotEmpty) {
      return images.whereType<String>().toList();
    }
    return [];
  }

  Widget _buildImageSlider(dynamic p) {
    final urls = _imageUrls(p);
    if (urls.isEmpty) return _imageFallback();

    final topPadding = MediaQuery.of(context).padding.top;

    return Stack(
      alignment: Alignment.bottomCenter,
      children: [
        Padding(
          padding: EdgeInsets.only(top: topPadding),
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
                  child: Icon(Icons.image_rounded, color: AppColors.textHint, size: 48),
                ),
              ),
              errorWidget: (_, __, ___) => _imageFallback(),
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
                      color: active ? AppColors.primary : Colors.white.withValues(alpha: 0.7),
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

  Future<void> _addToCart() async {
    HapticFeedback.mediumImpact();
    setState(() => _addingToCart = true);
    final cart = context.read<CartProvider>();
    final ok = await cart.addItem(widget.product['id'], _quantity);
    if (!mounted) return;
    setState(() => _addingToCart = false);
    if (ok) {
      HapticFeedback.heavyImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Added to tomorrow\'s cart',
              style: AppType.small.copyWith(color: Colors.white)),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(cart.error ?? 'Failed to add item. Please try again.',
              style: AppType.small.copyWith(color: Colors.white)),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      );
    }
  }

  Widget _imageFallback() {
    return Container(
      color: AppColors.surfaceBg,
      child: const Center(
        child: Icon(Icons.local_grocery_store_rounded,
            color: AppColors.textHint, size: 64),
      ),
    );
  }
}
