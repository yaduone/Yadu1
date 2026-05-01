import 'dart:ui' as dart_ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../providers/cart_provider.dart';
import 'product_detail_screen.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  String _selectedCategory = 'All';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CartProvider>().loadProducts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final products = cart.products;

    // Extract unique categories
    final categories = <String>{'All'};
    for (final p in products) {
      if (p['category'] != null) categories.add(p['category'] as String);
    }

    // Filter by category then sort: active first, inactive (coming soon) last
    final categoryFiltered = _selectedCategory == 'All'
        ? products
        : products
            .where((p) => p['category'] == _selectedCategory)
            .toList();
    final filtered = [...categoryFiltered]
      ..sort((a, b) {
        final aActive = a['is_active'] == true ? 0 : 1;
        final bActive = b['is_active'] == true ? 0 : 1;
        return aActive.compareTo(bActive);
      });

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: NestedScrollView(
          headerSliverBuilder: (context, innerBoxIsScrolled) {
            return [
              SliverAppBar(
                backgroundColor: AppColors.scaffoldBg,
                floating: true,
                snap: true,
                leading: IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.08),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.arrow_back_ios_new, size: 16),
                  ),
                  onPressed: () => Navigator.pop(context),
                ),
                title: Text('Shop', style: AppType.h2),
                bottom: PreferredSize(
                  preferredSize: const Size.fromHeight(56),
                  child: _buildCategoryTabs(categories),
                ),
              ),
            ];
          },
          body: products.isEmpty
              ? _buildLoadingGrid()
              : filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.search_off_rounded,
                              size: 48, color: AppColors.textHint),
                          const SizedBox(height: 12),
                          Text('No products in this category',
                              style: AppType.caption
                                  .copyWith(color: AppColors.textSecondary)),
                        ],
                      ),
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.all(20),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 14,
                        mainAxisSpacing: 14,
                        childAspectRatio: 0.72,
                      ),
                      itemCount: filtered.length,
                      itemBuilder: (_, i) =>
                          _ProductCard(product: filtered[i]),
                    ),
        ),
      ),
    );
  }

  Widget _buildCategoryTabs(Set<String> categories) {
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: categories.map((cat) {
          final isSelected = _selectedCategory == cat;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _selectedCategory = cat);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color:
                                AppColors.primary.withValues(alpha: 0.2),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ]
                      : [
                          BoxShadow(
                            color:
                                AppColors.primary.withValues(alpha: 0.06),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                ),
                child: Center(
                  child: Text(
                    cat,
                    style: AppType.captionBold.copyWith(
                      color: isSelected ? Colors.white : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildLoadingGrid() {
    return GridView.builder(
      padding: const EdgeInsets.all(20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 0.72,
      ),
      itemCount: 6,
      itemBuilder: (_, __) => const SkeletonLoader(height: 220),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final dynamic product;

  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context) {
    final isActive = product['is_active'] == true;

    return GestureDetector(
      onTap: isActive
          ? () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ProductDetailScreen(product: product),
                ),
              )
          : null,
      child: Opacity(
        opacity: isActive ? 1.0 : 0.85,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.06),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image
              Expanded(
                flex: 3,
                child: ClipRRect(
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(20)),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ImageFiltered(
                        imageFilter: isActive
                            ? _noFilter
                            : _comingSoonBlur,
                        child: _buildImage(product),
                      ),
                      if (!isActive)
                        Container(
                          color: Colors.black.withValues(alpha: 0.45),
                          child: const Center(
                            child: Text(
                              'Coming\nSoon',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                                height: 1.3,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // Info
              Expanded(
                flex: 2,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product['name'] ?? '',
                        style: AppType.captionBold,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      if (product['unit'] != null)
                        Text(
                          product['unit'] ?? '',
                          style: AppType.small
                              .copyWith(color: AppColors.textSecondary),
                        ),
                      const Spacer(),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '₹${(product['price'] as num).toStringAsFixed(0)}',
                            style: AppType.bodyBold.copyWith(
                              color: isActive
                                  ? AppColors.primary
                                  : AppColors.textSecondary,
                            ),
                          ),
                          if (isActive)
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.add_rounded,
                                  color: Colors.white, size: 18),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static final _noFilter = dart_ui.ImageFilter.blur(sigmaX: 0, sigmaY: 0);
  static final _comingSoonBlur = dart_ui.ImageFilter.blur(sigmaX: 2.5, sigmaY: 2.5);

  Widget _buildImage(dynamic product) {
    final images = product['images'];
    final url = (images is List && images.isNotEmpty) ? images[0] as String : null;
    if (url == null || url.isEmpty) return _imageFallback();
    return CachedNetworkImage(
      imageUrl: url,
      width: double.infinity,
      fit: BoxFit.cover,
      memCacheWidth: 400,
      fadeInDuration: const Duration(milliseconds: 300),
      placeholder: (_, __) => Container(
        color: AppColors.surfaceBg,
        child: const Center(
          child: Icon(Icons.image_rounded, color: AppColors.textHint, size: 28),
        ),
      ),
      errorWidget: (_, __, ___) => _imageFallback(),
    );
  }

  Widget _imageFallback() {
    return Container(
      color: AppColors.surfaceBg,
      child: const Center(
        child: Icon(Icons.local_grocery_store_rounded,
            color: AppColors.textHint, size: 32),
      ),
    );
  }
}
