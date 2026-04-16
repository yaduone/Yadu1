import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../theme/app_theme.dart';
import '../../providers/cart_provider.dart';
import 'product_detail_screen.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  String _selectedCategory = 'all';

  static const _categories = [
    'all', 'curd', 'paneer', 'butter_milk', 'ghee', 'butter', 'lassi', 'cream', 'cheese',
  ];

  static const _categoryLabels = {
    'all': 'All',
    'curd': 'Curd',
    'paneer': 'Paneer',
    'butter_milk': 'Butter Milk',
    'ghee': 'Ghee',
    'butter': 'Butter',
    'lassi': 'Lassi',
    'cream': 'Cream',
    'cheese': 'Cheese',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CartProvider>().loadProducts();
    });
  }

  List<dynamic> _filtered(List<dynamic> products) {
    if (_selectedCategory == 'all') return products;
    return products.where((p) => p['category'] == _selectedCategory).toList();
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final filtered = _filtered(cart.products);

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: const Text('Shop'),
        backgroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // Category filter chips
          SizedBox(
            height: 52,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final cat = _categories[i];
                final selected = cat == _selectedCategory;
                return GestureDetector(
                  onTap: () => setState(() => _selectedCategory = cat),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primary : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: selected ? AppColors.primary : AppColors.border,
                      ),
                    ),
                    child: Text(
                      _categoryLabels[cat] ?? cat,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: selected ? Colors.white : AppColors.textSecondary,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          // Product grid
          Expanded(
            child: cart.isLoading && cart.products.isEmpty
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.storefront_outlined, size: 52, color: AppColors.textHint),
                            const SizedBox(height: 12),
                            const Text('No products available', style: TextStyle(color: AppColors.textSecondary)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: () => cart.loadProducts(),
                        child: GridView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 0.72,
                          ),
                          itemCount: filtered.length,
                          itemBuilder: (_, i) => _ProductCard(
                            product: filtered[i],
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ProductDetailScreen(product: filtered[i]),
                              ),
                            ),
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _ProductCard extends StatefulWidget {
  final Map<String, dynamic> product;
  final VoidCallback onTap;

  const _ProductCard({required this.product, required this.onTap});

  @override
  State<_ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<_ProductCard> {
  int _imgIndex = 0;
  bool _adding = false;

  List<String> get _images {
    final imgs = widget.product['images'];
    if (imgs is List && imgs.isNotEmpty) return imgs.cast<String>();
    return [];
  }

  Future<void> _addToCart() async {
    setState(() => _adding = true);
    final cart = context.read<CartProvider>();
    final added = await cart.addItem(widget.product['id'], 1);
    if (mounted) {
      setState(() => _adding = false);
      if (added) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${widget.product['name']} added to tomorrow\'s cart'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    return GestureDetector(
      onTap: widget.onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withAlpha(10),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image area
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: SizedBox(
                height: 140,
                width: double.infinity,
                child: _images.isEmpty
                    ? _placeholder()
                    : Stack(
                        children: [
                          CarouselSlider(
                            options: CarouselOptions(
                              height: 140,
                              viewportFraction: 1.0,
                              enableInfiniteScroll: _images.length > 1,
                              autoPlay: _images.length > 1,
                              autoPlayInterval: const Duration(seconds: 3),
                              onPageChanged: (idx, _) => setState(() => _imgIndex = idx),
                            ),
                            items: _images.map((url) => _networkImage(url)).toList(),
                          ),
                          if (_images.length > 1)
                            Positioned(
                              bottom: 6,
                              left: 0,
                              right: 0,
                              child: Center(
                                child: AnimatedSmoothIndicator(
                                  activeIndex: _imgIndex,
                                  count: _images.length,
                                  effect: const WormEffect(
                                    dotHeight: 5,
                                    dotWidth: 5,
                                    activeDotColor: Colors.white,
                                    dotColor: Colors.white54,
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
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p['name'] ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      p['unit'] ?? '',
                      style: const TextStyle(fontSize: 11, color: AppColors.textHint),
                    ),
                    const Spacer(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '₹${p['price']}',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                          ),
                        ),
                        GestureDetector(
                          onTap: _adding ? null : _addToCart,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              color: _adding ? AppColors.border : AppColors.primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: _adding
                                ? const Padding(
                                    padding: EdgeInsets.all(6),
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppColors.primary,
                                    ),
                                  )
                                : const Icon(Icons.add_rounded, color: Colors.white, size: 18),
                          ),
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
    );
  }

  Widget _placeholder() {
    return Container(
      color: AppColors.primaryLight,
      child: const Center(
        child: Icon(Icons.inventory_2_outlined, color: AppColors.primary, size: 36),
      ),
    );
  }

  Widget _networkImage(String url) {
    return Image.network(
      url,
      fit: BoxFit.cover,
      width: double.infinity,
      height: 140,
      errorBuilder: (_, __, ___) => _placeholder(),
      loadingBuilder: (_, child, progress) {
        if (progress == null) return child;
        return Container(
          color: AppColors.primaryLight,
          child: const Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
          ),
        );
      },
    );
  }
}
