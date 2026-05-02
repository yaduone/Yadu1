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
              ? _buildLoadingList()
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
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 16),
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

  Widget _buildLoadingList() {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: 4,
      separatorBuilder: (_, __) => const SizedBox(height: 16),
      itemBuilder: (_, __) => const SkeletonLoader(height: 300),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final dynamic product;

  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context) {
    final isActive = product['is_active'] == true;
    final name = product['name'] as String? ?? '';
    final description = (product['description'] as String? ??
        product['unit'] as String? ?? '');
    final price = product['price'] as num?;

    return GestureDetector(
      onTap: isActive
          ? () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ProductDetailScreen(product: product),
                ),
              )
          : null,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Large image area with coming-soon overlay ──
              Stack(
                children: [
                  SizedBox(
                    height: 220,
                    width: double.infinity,
                    child: _buildImage(),
                  ),
                  if (!isActive)
                    Positioned.fill(
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Color(0x99000000),
                        ),
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 10),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(40),
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.6),
                                  width: 1.5),
                            ),
                            child: const Text(
                              'Coming Soon',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),

              // ── Title, description & price row ──
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            name,
                            style: AppType.h3,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (description.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              description,
                              style: AppType.small
                                  .copyWith(color: AppColors.textSecondary),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    if (price != null)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '₹${price.toStringAsFixed(0)}',
                            style: AppType.bodyBold.copyWith(
                              color: isActive
                                  ? AppColors.primary
                                  : AppColors.textSecondary,
                              fontSize: 18,
                            ),
                          ),
                          if (isActive)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.add_rounded,
                                    color: Colors.white, size: 18),
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImage() {
    final cover = product['cover_image'] as String?;
    final images = product['images'];
    final url = (cover != null && cover.isNotEmpty)
        ? cover
        : (images is List && images.isNotEmpty) ? images[0] as String : null;
    if (url == null || url.isEmpty) return _imageFallback();
    return CachedNetworkImage(
      imageUrl: url,
      width: double.infinity,
      height: 220,
      fit: BoxFit.cover,
      memCacheWidth: 800,
      fadeInDuration: const Duration(milliseconds: 300),
      placeholder: (_, __) => Container(
        color: AppColors.surfaceBg,
        child: const Center(
          child:
              Icon(Icons.image_rounded, color: AppColors.textHint, size: 36),
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
            color: AppColors.textHint, size: 48),
      ),
    );
  }
}
