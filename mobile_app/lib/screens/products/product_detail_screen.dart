import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
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
              // Parallax header image
              SliverAppBar(
                expandedHeight: 320,
                stretch: true,
                stretchTriggerOffset: 150,
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
                  stretchModes: const [
                    StretchMode.zoomBackground,
                    StretchMode.blurBackground,
                  ],
                  background: _firstImageUrl(p) != null
                      ? CachedNetworkImage(
                          imageUrl: _firstImageUrl(p)!,
                          fit: BoxFit.cover,
                          fadeInDuration: const Duration(milliseconds: 300),
                          placeholder: (_, __) => Container(
                            color: AppColors.surfaceBg,
                            child: const Center(
                              child: Icon(Icons.image_rounded,
                                  color: AppColors.textHint, size: 48),
                            ),
                          ),
                          errorWidget: (_, __, ___) => _imageFallback(),
                        )
                      : _imageFallback(),
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
                        onPressed: _addToCart,
                        child: Text(
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

  String? _firstImageUrl(dynamic p) {
    final images = p['images'];
    if (images is List && images.isNotEmpty) return images[0] as String;
    return null;
  }

  Future<void> _addToCart() async {
    HapticFeedback.mediumImpact();
    final cart = context.read<CartProvider>();
    final ok = await cart.addItem(widget.product['id'], _quantity);
    if (ok && mounted) {
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
