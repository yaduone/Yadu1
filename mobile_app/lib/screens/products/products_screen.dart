import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../providers/cart_provider.dart';
import '../../models/pending_cart_item.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../utils/cart_delivery_copy.dart';
import '../../widgets/app_snackbar.dart';
import '../../widgets/premium_components.dart';
import 'product_detail_screen.dart';

class ProductsScreen extends StatefulWidget {
  final VoidCallback? onGoToCart;

  const ProductsScreen({super.key, this.onGoToCart});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  String? _selectedCategory;
  String? _revealedProductId;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  final Map<String, _PendingCartItem> _pendingItems = {};
  String _searchQuery = '';
  bool _isSearching = false;
  // Staged items are flushed to the local pending cache instantly, so there is
  // no in-flight submit state; kept as a guard for the disabled-button styling.
  final bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final cart = context.read<CartProvider>();
      cart.loadProducts();
      cart.loadCategories();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final categories = _categoryEntries(cart.categories, cart.products);
    final selectedSlug = _resolvedSelectedSlug(categories);
    final filteredProducts = _productsFor(cart.products, selectedSlug);
    final searchResults = _searchMatches(cart.products, categories);
    // Gate the whole screen on a single readiness flag so the category rail,
    // header, and product list swap from skeleton to real content together
    // instead of revealing piecemeal as each request finishes.
    final isReady = cart.productsLoaded && cart.categoriesLoaded;
    final isLoading = !isReady;
    final isInitialLoading = isLoading;
    final hasPendingItems = _pendingItems.isNotEmpty;
    final showPendingItems = hasPendingItems && !_isSearching;
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      resizeToAvoidBottomInset: false,
      body: AnimatedPadding(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.only(bottom: keyboardInset),
        child: SafeArea(
          child: Row(
            children: [
              _CategoryRail(
                categories: categories,
                selectedSlug: selectedSlug,
                loading: isLoading,
                onSelected: _selectCategory,
              ),
              Expanded(
                child: Column(
                  children: [
                    _CatalogueHeader(
                      title: _categoryLabel(categories, selectedSlug),
                      isSearching: _isSearching,
                      loading: isInitialLoading,
                      searchController: _searchController,
                      searchFocusNode: _searchFocusNode,
                      onBack: _isSearching
                          ? _closeSearch
                          : () => Navigator.pop(context),
                      onSearch: _openSearch,
                      onQueryChanged: (query) {
                        setState(() => _searchQuery = query);
                      },
                      onClearSearch: _clearSearchQuery,
                      onCart: _goToCart,
                    ),
                    Expanded(
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: AnimatedSwitcher(
                              duration: const Duration(milliseconds: 260),
                              switchInCurve: Curves.easeOut,
                              switchOutCurve: Curves.easeIn,
                              transitionBuilder: (child, animation) =>
                                  FadeTransition(
                                    opacity: animation,
                                    child: SlideTransition(
                                      position:
                                          Tween<Offset>(
                                            begin: const Offset(0.04, 0),
                                            end: Offset.zero,
                                          ).animate(
                                            CurvedAnimation(
                                              parent: animation,
                                              curve: Curves.easeOut,
                                            ),
                                          ),
                                      child: child,
                                    ),
                                  ),
                              layoutBuilder: (currentChild, previousChildren) =>
                                  Stack(
                                    alignment: Alignment.topCenter,
                                    children: [
                                      ...previousChildren,
                                      if (currentChild != null) currentChild,
                                    ],
                                  ),
                              child: _isSearching
                                  ? _ProductSearchPanel(
                                      key: const ValueKey('search-panel'),
                                      query: _searchQuery.trim(),
                                      products: searchResults,
                                      loading: isLoading,
                                      categoryLabel: (slug) =>
                                          _categoryLabel(categories, slug),
                                      onSelected: _revealSearchResult,
                                    )
                                  : isInitialLoading
                                  ? _buildLoadingList(
                                      key: const ValueKey('loading-list'),
                                      bottomPadding: showPendingItems
                                          ? 210
                                          : 32,
                                    )
                                  : filteredProducts.isEmpty
                                  ? _EmptyCategory(
                                      key: ValueKey('empty-$selectedSlug'),
                                      label: _categoryLabel(
                                        categories,
                                        selectedSlug,
                                      ),
                                    )
                                  : ListView.separated(
                                      key: ValueKey(
                                        'products-$selectedSlug-${_revealedProductId ?? ''}',
                                      ),
                                      padding: EdgeInsets.fromLTRB(
                                        14,
                                        14,
                                        14,
                                        showPendingItems ? 210 : 32,
                                      ),
                                      itemCount: filteredProducts.length,
                                      separatorBuilder: (_, __) =>
                                          const SizedBox(height: 16),
                                      itemBuilder: (_, index) {
                                        final product = filteredProducts[index];
                                        final id =
                                            product['id'] as String? ?? '';
                                        return _ProductCard(
                                          product: product,
                                          highlighted:
                                              id.isNotEmpty &&
                                              id == _revealedProductId,
                                          queuedQuantity:
                                              _pendingItems[id]?.quantity ?? 0,
                                          isSubmitting: _isSubmitting,
                                          onAdd: () => _queueItem(product),
                                          onTap: () => showProductDetailSheet(
                                            context,
                                            product,
                                          ),
                                        );
                                      },
                                    ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.bottomCenter,
                            child: AnimatedSwitcher(
                              duration: const Duration(milliseconds: 220),
                              child: !showPendingItems
                                  ? const SizedBox.shrink()
                                  : Padding(
                                      key: const ValueKey('pending-cart-box'),
                                      padding: const EdgeInsets.fromLTRB(
                                        10,
                                        0,
                                        10,
                                        10,
                                      ),
                                      child: _PendingCartBox(
                                        items: _pendingItems.values.toList(),
                                        isSubmitting: _isSubmitting,
                                        onAdd: _incrementItem,
                                        onRemove: _removeItem,
                                        onSubmit: _submitPendingItems,
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
            ],
          ),
        ),
      ),
    );
  }

  String? _resolvedSelectedSlug(List<Map<String, dynamic>> categories) {
    if (categories.isEmpty) return null;
    if (categories.any((category) => category['slug'] == _selectedCategory)) {
      return _selectedCategory;
    }
    return categories.first['slug'] as String;
  }

  List<Map<String, dynamic>> _categoryEntries(
    List<dynamic> source,
    List<dynamic> products,
  ) {
    final entries = <Map<String, dynamic>>[];
    final slugs = <String>{};
    for (final raw in source) {
      if (raw is! Map) continue;
      final category = Map<String, dynamic>.from(raw);
      final slug = category['slug'];
      if (slug is String && slug.isNotEmpty && slugs.add(slug)) {
        entries.add(category);
      }
    }
    for (final raw in products) {
      if (raw is! Map) continue;
      final slug = raw['category'];
      if (slug is String && slug.isNotEmpty && slugs.add(slug)) {
        entries.add({'slug': slug, 'label': _titleFromSlug(slug)});
      }
    }
    return entries;
  }

  List<Map<String, dynamic>> _productsFor(
    List<dynamic> products,
    String? category,
  ) {
    if (category == null) return [];
    final filtered = products
        .whereType<Map>()
        .where((product) => product['category'] == category)
        .map((product) => Map<String, dynamic>.from(product))
        .toList();
    filtered.sort((a, b) {
      final aSelected = a['id'] == _revealedProductId ? 0 : 1;
      final bSelected = b['id'] == _revealedProductId ? 0 : 1;
      if (aSelected != bSelected) return aSelected.compareTo(bSelected);
      final aActive = a['is_active'] == true ? 0 : 1;
      final bActive = b['is_active'] == true ? 0 : 1;
      if (aActive != bActive) return aActive.compareTo(bActive);
      return (a['name'] as String? ?? '').compareTo(b['name'] as String? ?? '');
    });
    return filtered;
  }

  List<Map<String, dynamic>> _searchMatches(
    List<dynamic> products,
    List<Map<String, dynamic>> categories,
  ) {
    final query = _searchQuery.trim().toLowerCase();
    if (query.isEmpty) return [];
    final labels = <String, String>{
      for (final category in categories)
        if (category['slug'] is String)
          category['slug'] as String:
              category['label'] as String? ??
              _titleFromSlug(category['slug'] as String),
    };
    final results = products
        .whereType<Map>()
        .map((product) => Map<String, dynamic>.from(product))
        .where((product) {
          final category = product['category'] as String? ?? '';
          final text = [
            product['name'],
            product['description'],
            product['unit'],
            category,
            labels[category],
          ].whereType<String>().join(' ').toLowerCase();
          return text.contains(query);
        })
        .toList();
    results.sort((a, b) {
      final aActive = a['is_active'] == true ? 0 : 1;
      final bActive = b['is_active'] == true ? 0 : 1;
      if (aActive != bActive) return aActive.compareTo(bActive);
      return (a['name'] as String? ?? '').toLowerCase().compareTo(
        (b['name'] as String? ?? '').toLowerCase(),
      );
    });
    return results;
  }

  String _categoryLabel(List<Map<String, dynamic>> categories, String? slug) {
    if (slug == null) return 'Products';
    final category = categories.firstWhere(
      (item) => item['slug'] == slug,
      orElse: () => {'label': _titleFromSlug(slug)},
    );
    return category['label'] as String? ?? _titleFromSlug(slug);
  }

  String _titleFromSlug(String slug) {
    return slug
        .split('_')
        .map(
          (word) => word.isEmpty
              ? word
              : '${word[0].toUpperCase()}${word.substring(1)}',
        )
        .join(' ');
  }

  Widget _buildLoadingList({Key? key, required double bottomPadding}) {
    return _ProductListSkeleton(key: key, bottomPadding: bottomPadding);
  }

  void _openSearch() {
    HapticFeedback.selectionClick();
    setState(() {
      _isSearching = true;
      _revealedProductId = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _searchFocusNode.requestFocus();
    });
  }

  void _clearSearchQuery() {
    _searchController.clear();
    setState(() => _searchQuery = '');
    _searchFocusNode.requestFocus();
  }

  void _closeSearch() {
    _searchFocusNode.unfocus();
    _searchController.clear();
    setState(() {
      _isSearching = false;
      _searchQuery = '';
    });
  }

  void _selectCategory(String slug) {
    HapticFeedback.selectionClick();
    _searchFocusNode.unfocus();
    _searchController.clear();
    setState(() {
      _isSearching = false;
      _searchQuery = '';
      _selectedCategory = slug;
      _revealedProductId = null;
    });
  }

  void _revealSearchResult(Map<String, dynamic> product) {
    final category = product['category'];
    if (category is! String || category.isEmpty) return;
    HapticFeedback.selectionClick();
    _searchFocusNode.unfocus();
    _searchController.clear();
    final id = product['id'] as String? ?? '';
    setState(() {
      _isSearching = false;
      _searchQuery = '';
      _selectedCategory = category;
      _revealedProductId = id.isEmpty ? null : id;
    });
  }

  void _queueItem(Map<String, dynamic> product) {
    if (_isSubmitting || product['is_active'] != true) return;
    final id = product['id'] as String? ?? '';
    if (id.isEmpty) return;
    HapticFeedback.lightImpact();
    setState(() {
      final existing = _pendingItems[id];
      if (existing == null) {
        _pendingItems[id] = _PendingCartItem(product: product);
      } else {
        existing.quantity += 1;
      }
    });
  }

  void _incrementItem(String id) {
    if (_isSubmitting) return;
    final item = _pendingItems[id];
    if (item == null) return;
    HapticFeedback.selectionClick();
    setState(() => item.quantity += 1);
  }

  void _removeItem(String id) {
    if (_isSubmitting) return;
    final item = _pendingItems[id];
    if (item == null) return;
    HapticFeedback.selectionClick();
    setState(() {
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        _pendingItems.remove(id);
      }
    });
  }

  void _submitPendingItems() {
    if (_pendingItems.isEmpty) return;

    HapticFeedback.mediumImpact();
    final cart = context.read<CartProvider>();

    // Stage everything into the local pending cache (instant, no network). The
    // items show in the cart and are flushed to the server on confirmation.
    var addedQuantity = 0;
    for (final entry in _pendingItems.values) {
      cart.addPendingItem(
        PendingCartItem.fromProduct(entry.product, entry.quantity),
      );
      addedQuantity += entry.quantity;
    }

    setState(() => _pendingItems.clear());

    AppSnackbar.show(
      context,
      '$addedQuantity item${addedQuantity > 1 ? 's' : ''} added. Confirm in your cart to schedule for ${CartDeliveryCopy.dateLabel(cart.tomorrowStatus)}.',
      type: SnackType.success,
      duration: const Duration(seconds: 6),
      actionLabel: 'VIEW CART',
      onAction: _goToCart,
    );
  }

  void _goToCart() {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    if (Navigator.canPop(context)) Navigator.pop(context);
    widget.onGoToCart?.call();
  }
}

class _ProductListSkeleton extends StatelessWidget {
  final double bottomPadding;

  const _ProductListSkeleton({super.key, required this.bottomPadding});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: EdgeInsets.fromLTRB(14, 14, 14, bottomPadding),
      itemCount: 4,
      separatorBuilder: (_, __) => const SizedBox(height: 16),
      itemBuilder: (_, index) => _ProductCardSkeleton(isLast: index == 3),
    );
  }
}

class _ProductCardSkeleton extends StatelessWidget {
  final bool isLast;

  const _ProductCardSkeleton({this.isLast = false});

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: isLast ? 0.7 : 1,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 16,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 190,
                child: Stack(
                  children: [
                    const Positioned.fill(
                      child: SkeletonLoader(height: 190, borderRadius: 0),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 12,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          SkeletonLoader(height: 6, width: 18, borderRadius: 6),
                          SizedBox(width: 6),
                          SkeletonLoader(height: 6, width: 6, borderRadius: 6),
                          SizedBox(width: 6),
                          SkeletonLoader(height: 6, width: 6, borderRadius: 6),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FractionallySizedBox(
                      widthFactor: 0.72,
                      child: SkeletonLoader(height: 22, borderRadius: 8),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: const [
                        Expanded(
                          child: SkeletonLoader(height: 22, borderRadius: 8),
                        ),
                        SizedBox(width: 16),
                        SkeletonLoader(height: 42, width: 84, borderRadius: 12),
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
}

class _CatalogueHeader extends StatelessWidget {
  final String title;
  final bool isSearching;
  final bool loading;
  final TextEditingController searchController;
  final FocusNode searchFocusNode;
  final VoidCallback onBack;
  final VoidCallback onSearch;
  final ValueChanged<String> onQueryChanged;
  final VoidCallback onClearSearch;
  final VoidCallback onCart;

  const _CatalogueHeader({
    required this.title,
    required this.isSearching,
    required this.loading,
    required this.searchController,
    required this.searchFocusNode,
    required this.onBack,
    required this.onSearch,
    required this.onQueryChanged,
    required this.onClearSearch,
    required this.onCart,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 70,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: isSearching ? 'Back to products' : 'Back',
            onPressed: onBack,
            icon: AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              child: Icon(
                isSearching
                    ? Icons.arrow_back_rounded
                    : Icons.arrow_back_ios_new_rounded,
                key: ValueKey(isSearching),
                size: 19,
              ),
            ),
          ),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SizeTransition(
                  sizeFactor: animation,
                  axis: Axis.horizontal,
                  axisAlignment: -1,
                  child: child,
                ),
              ),
              child: isSearching
                  ? TextField(
                      key: const ValueKey('product-search-field'),
                      controller: searchController,
                      focusNode: searchFocusNode,
                      textInputAction: TextInputAction.search,
                      onChanged: onQueryChanged,
                      onTapOutside: (_) =>
                          FocusManager.instance.primaryFocus?.unfocus(),
                      decoration: InputDecoration(
                        hintText: 'Search products',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 11,
                        ),
                        prefixIcon: const Icon(Icons.search_rounded, size: 20),
                        suffixIcon: searchController.text.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Clear search',
                                onPressed: onClearSearch,
                                icon: const Icon(Icons.close_rounded, size: 18),
                              ),
                      ),
                    )
                  : loading
                  ? const Column(
                      key: ValueKey('category-title-skeleton'),
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonLoader(height: 22, width: 132, borderRadius: 8),
                        SizedBox(height: 6),
                        SkeletonLoader(height: 9, width: 92, borderRadius: 5),
                      ],
                    )
                  : Text(
                      title,
                      key: const ValueKey('category-title'),
                      overflow: TextOverflow.ellipsis,
                      style: AppType.h2,
                    ),
            ),
          ),
          if (!isSearching) ...[
            loading
                ? const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: SkeletonLoader(
                      height: 36,
                      width: 36,
                      borderRadius: 18,
                    ),
                  )
                : IconButton(
                    tooltip: 'Search products',
                    onPressed: onSearch,
                    icon: const Icon(Icons.search_rounded),
                  ),
            loading
                ? const Padding(
                    padding: EdgeInsets.only(right: 2),
                    child: SkeletonLoader(
                      height: 36,
                      width: 36,
                      borderRadius: 18,
                    ),
                  )
                : IconButton(
                    tooltip: 'Go to cart',
                    onPressed: onCart,
                    icon: const Icon(Icons.shopping_cart_outlined),
                  ),
          ],
        ],
      ),
    );
  }
}

class _CategoryRail extends StatelessWidget {
  final List<Map<String, dynamic>> categories;
  final String? selectedSlug;
  final bool loading;
  final ValueChanged<String> onSelected;

  const _CategoryRail({
    required this.categories,
    required this.selectedSlug,
    required this.loading,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 108,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          Container(
            height: 104,
            width: double.infinity,
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: loading
                ? const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SkeletonLoader(height: 34, width: 34, borderRadius: 12),
                      SizedBox(height: 10),
                      SkeletonLoader(height: 10, width: 66, borderRadius: 6),
                    ],
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.grid_view_rounded,
                        size: 28,
                        color: AppColors.primary,
                      ),
                      const SizedBox(height: 8),
                      Text('Categories', style: AppType.small),
                    ],
                  ),
          ),
          Expanded(
            child: loading
                ? ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    itemCount: 5,
                    separatorBuilder: (_, __) => const SizedBox(height: 14),
                    itemBuilder: (_, __) => const _CategoryTileSkeleton(),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    itemCount: categories.length,
                    itemBuilder: (_, index) {
                      final category = categories[index];
                      final slug = category['slug'] as String;
                      final selected = slug == selectedSlug;
                      return _CategoryTile(
                        category: category,
                        selected: selected,
                        onTap: () => onSelected(slug),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  final Map<String, dynamic> category;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryTile({
    required this.category,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final imageUrl = category['image_url'] as String? ?? '';
    final label = category['label'] as String? ?? '';
    return InkWell(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 5),
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 3),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryLight : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              height: 58,
              width: 58,
              padding: EdgeInsets.all(selected ? 2 : 0),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
                border: Border.all(
                  color: selected ? AppColors.primary : AppColors.border,
                  width: selected ? 2 : 1,
                ),
              ),
              child: ClipOval(
                child: imageUrl.isEmpty
                    ? const _CategoryImageFallback()
                    : CachedNetworkImage(
                        imageUrl: imageUrl,
                        fit: BoxFit.cover,
                        memCacheWidth: 128,
                        errorWidget: (_, __, ___) =>
                            const _CategoryImageFallback(),
                      ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppType.small.copyWith(
                color: selected ? AppColors.primary : AppColors.textSecondary,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryTileSkeleton extends StatelessWidget {
  const _CategoryTileSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 10),
      child: Column(
        children: const [
          SkeletonLoader(height: 58, width: 58, borderRadius: 29),
          SizedBox(height: 10),
          SkeletonLoader(height: 9, width: 58, borderRadius: 5),
          SizedBox(height: 5),
          SkeletonLoader(height: 9, width: 42, borderRadius: 5),
        ],
      ),
    );
  }
}

class _CategoryImageFallback extends StatelessWidget {
  const _CategoryImageFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceBg,
      child: const Icon(
        Icons.local_grocery_store_outlined,
        size: 24,
        color: AppColors.textHint,
      ),
    );
  }
}

class _ProductSearchResultSkeleton extends StatelessWidget {
  const _ProductSearchResultSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: const [
          SkeletonLoader(height: 68, width: 58, borderRadius: 12),
          SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonLoader(
                  height: 14,
                  width: double.infinity,
                  borderRadius: 7,
                ),
                SizedBox(height: 8),
                SkeletonLoader(height: 11, width: 110, borderRadius: 6),
                SizedBox(height: 8),
                SkeletonLoader(height: 12, width: 76, borderRadius: 6),
              ],
            ),
          ),
          SizedBox(width: 12),
          SkeletonLoader(height: 22, width: 22, borderRadius: 11),
        ],
      ),
    );
  }
}

class _ProductSearchPanel extends StatelessWidget {
  final String query;
  final List<Map<String, dynamic>> products;
  final bool loading;
  final String Function(String?) categoryLabel;
  final ValueChanged<Map<String, dynamic>> onSelected;

  const _ProductSearchPanel({
    super.key,
    required this.query,
    required this.products,
    required this.loading,
    required this.categoryLabel,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (query.isEmpty) {
      return const _SearchMessage(
        icon: Icons.manage_search_rounded,
        title: 'Find a product',
        detail: 'Search by product name or category.',
      );
    }
    if (loading) {
      return ListView.separated(
        padding: const EdgeInsets.all(14),
        itemCount: 4,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, __) => const _ProductSearchResultSkeleton(),
      );
    }
    if (products.isEmpty) {
      return _SearchMessage(
        icon: Icons.search_off_rounded,
        title: 'No results for "$query"',
        detail: 'Try another product name or category.',
      );
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '${products.length} ${products.length == 1 ? 'result' : 'results'}',
              style: AppType.small.copyWith(color: AppColors.textSecondary),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 20),
            itemCount: products.length,
            separatorBuilder: (_, __) => const SizedBox(height: 9),
            itemBuilder: (_, index) {
              final product = products[index];
              return _ProductSearchResult(
                product: product,
                categoryLabel: categoryLabel(
                  product['category'] is String
                      ? product['category'] as String
                      : null,
                ),
                onTap: () => onSelected(product),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _SearchMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String detail;

  const _SearchMessage({
    required this.icon,
    required this.title,
    required this.detail,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 46, color: AppColors.textHint),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppType.captionBold.copyWith(color: AppColors.textPrimary),
            ),
            const SizedBox(height: 5),
            Text(
              detail,
              textAlign: TextAlign.center,
              style: AppType.small.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductSearchResult extends StatelessWidget {
  final Map<String, dynamic> product;
  final String categoryLabel;
  final VoidCallback onTap;

  const _ProductSearchResult({
    required this.product,
    required this.categoryLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = product['name'] as String? ?? 'Product';
    final unit = product['unit'] as String? ?? '';
    final price = product['price'] as num?;
    final isActive = product['is_active'] == true;
    final imageUrl = _imageUrl();

    return Semantics(
      button: true,
      label: 'Show $name in $categoryLabel',
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    height: 68,
                    width: 58,
                    child: imageUrl.isEmpty
                        ? const _CategoryImageFallback()
                        : CachedNetworkImage(
                            imageUrl: imageUrl,
                            fit: BoxFit.cover,
                            memCacheWidth: 124,
                            errorWidget: (_, __, ___) =>
                                const _CategoryImageFallback(),
                          ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppType.captionBold,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        categoryLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppType.small.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        price == null
                            ? unit
                            : '\u20B9${price.toStringAsFixed(0)}${unit.isEmpty ? '' : ' / $unit'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppType.small.copyWith(
                          color: isActive
                              ? AppColors.primary
                              : AppColors.textSecondary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isActive)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Soon',
                      style: AppType.micro.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                const SizedBox(width: 5),
                const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 15,
                  color: AppColors.textHint,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _imageUrl() {
    final cover = product['cover_image_small'] ?? product['cover_image_large'];
    if (cover is String && cover.isNotEmpty) return cover;
    final images = product['images'];
    if (images is List) {
      return images.whereType<String>().firstWhere(
        (image) => image.isNotEmpty,
        orElse: () => '',
      );
    }
    return '';
  }
}

class _EmptyCategory extends StatelessWidget {
  final String label;

  const _EmptyCategory({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.inventory_2_outlined,
              size: 44,
              color: AppColors.textHint,
            ),
            const SizedBox(height: 12),
            Text(
              'No $label products yet',
              textAlign: TextAlign.center,
              style: AppType.caption.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class _PendingCartItem {
  final Map<String, dynamic> product;
  int quantity = 1;

  _PendingCartItem({required this.product});
}

class _PendingCartBox extends StatelessWidget {
  final List<_PendingCartItem> items;
  final bool isSubmitting;
  final ValueChanged<String> onAdd;
  final ValueChanged<String> onRemove;
  final VoidCallback onSubmit;

  const _PendingCartBox({
    required this.items,
    required this.isSubmitting,
    required this.onAdd,
    required this.onRemove,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final count = items.fold<int>(0, (total, item) => total + item.quantity);
    return Material(
      elevation: 10,
      borderRadius: BorderRadius.circular(20),
      color: Colors.white,
      shadowColor: Colors.black.withValues(alpha: 0.15),
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Selected items', style: AppType.captionBold),
                const Spacer(),
                Text(
                  '$count ${count == 1 ? 'item' : 'items'}',
                  style: AppType.small.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 68,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, index) => _PendingItemChip(
                  item: items[index],
                  isSubmitting: isSubmitting,
                  onAdd: () =>
                      onAdd(items[index].product['id'] as String? ?? ''),
                  onRemove: () =>
                      onRemove(items[index].product['id'] as String? ?? ''),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 44,
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: isSubmitting ? null : onSubmit,
                icon: isSubmitting
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons.shopping_cart_checkout_rounded,
                        size: 18,
                      ),
                label: Text(isSubmitting ? 'Adding...' : 'Add to cart'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PendingItemChip extends StatelessWidget {
  final _PendingCartItem item;
  final bool isSubmitting;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  const _PendingItemChip({
    required this.item,
    required this.isSubmitting,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final product = item.product;
    final name = product['name'] as String? ?? '';
    final imageUrl = _smallImageUrl(product);
    return Container(
      width: 150,
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: AppColors.surfaceBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(9),
            child: SizedBox(
              width: 46,
              height: 58,
              child: imageUrl.isEmpty
                  ? Container(
                      color: AppColors.primaryLight,
                      child: const Icon(
                        Icons.local_grocery_store_outlined,
                        size: 20,
                        color: AppColors.primary,
                      ),
                    )
                  : CachedNetworkImage(
                      imageUrl: imageUrl,
                      fit: BoxFit.cover,
                      memCacheWidth: 100,
                      errorWidget: (_, __, ___) =>
                          const _CategoryImageFallback(),
                    ),
            ),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.small.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text('x${item.quantity}', style: AppType.small),
                    const Spacer(),
                    _SmallActionButton(
                      icon: Icons.add_rounded,
                      enabled: !isSubmitting,
                      onTap: onAdd,
                    ),
                    const SizedBox(width: 4),
                    _SmallActionButton(
                      icon: item.quantity > 1
                          ? Icons.remove_rounded
                          : Icons.close_rounded,
                      enabled: !isSubmitting,
                      onTap: onRemove,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _smallImageUrl(Map<String, dynamic> product) {
    final cover = product['cover_image_small'] ?? product['cover_image_large'];
    if (cover is String && cover.isNotEmpty) return cover;
    final images = product['images'];
    if (images is List) {
      return images.whereType<String>().firstWhere(
        (image) => image.isNotEmpty,
        orElse: () => '',
      );
    }
    return '';
  }
}

class _SmallActionButton extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  const _SmallActionButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 20,
        width: 20,
        decoration: BoxDecoration(
          color: enabled ? Colors.white : AppColors.border,
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: 14,
          color: enabled ? AppColors.primary : AppColors.textHint,
        ),
      ),
    );
  }
}

class _ProductCard extends StatefulWidget {
  final Map<String, dynamic> product;
  final bool highlighted;
  final int queuedQuantity;
  final bool isSubmitting;
  final VoidCallback onAdd;
  final VoidCallback onTap;

  const _ProductCard({
    required this.product,
    this.highlighted = false,
    required this.queuedQuantity,
    required this.isSubmitting,
    required this.onAdd,
    required this.onTap,
  });

  @override
  State<_ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<_ProductCard> {
  int _imageIndex = 0;

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final isActive = product['is_active'] == true;
    final name = product['name'] as String? ?? '';
    final unit = product['unit'] as String? ?? '';
    final price = product['price'] as num?;
    final images = _imageUrls(product);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 260),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: widget.highlighted
              ? Border.all(color: AppColors.primary, width: 2)
              : null,
          boxShadow: [
            BoxShadow(
              color: widget.highlighted
                  ? AppColors.primary.withValues(alpha: 0.15)
                  : Colors.black.withValues(alpha: 0.06),
              blurRadius: 16,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 190,
                child: Stack(
                  children: [
                    Positioned.fill(child: _imageCarousel(images)),
                    if (!isActive)
                      Positioned.fill(
                        child: Container(
                          color: Colors.black.withValues(alpha: 0.45),
                          alignment: Alignment.center,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 9,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: Colors.white70),
                            ),
                            child: const Text(
                              'Coming Soon',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ),
                    if (images.length > 1)
                      Positioned(
                        bottom: 10,
                        left: 0,
                        right: 0,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(images.length, (index) {
                            final active = _imageIndex == index;
                            return AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              width: active ? 17 : 6,
                              height: 6,
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              decoration: BoxDecoration(
                                color: active
                                    ? AppColors.primary
                                    : Colors.white70,
                                borderRadius: BorderRadius.circular(10),
                              ),
                            );
                          }),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppType.h3,
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            price == null
                                ? unit
                                : '₹${price.toStringAsFixed(0)}${unit.isEmpty ? '' : ' / $unit'}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppType.bodyBold.copyWith(
                              color: isActive
                                  ? AppColors.primary
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        FilledButton.icon(
                          onPressed: isActive && !widget.isSubmitting
                              ? widget.onAdd
                              : null,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(0, 42),
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          icon: const Icon(Icons.add_rounded, size: 17),
                          label: Text(
                            widget.queuedQuantity == 0
                                ? 'Add'
                                : '${widget.queuedQuantity}',
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

  Widget _imageCarousel(List<String> images) {
    if (images.isEmpty) {
      return Container(
        color: AppColors.surfaceBg,
        child: const Center(
          child: Icon(
            Icons.local_grocery_store_rounded,
            size: 44,
            color: AppColors.textHint,
          ),
        ),
      );
    }
    return PageView.builder(
      itemCount: images.length,
      onPageChanged: (index) => setState(() => _imageIndex = index),
      itemBuilder: (_, index) => CachedNetworkImage(
        imageUrl: images[index],
        height: 190,
        width: double.infinity,
        fit: BoxFit.cover,
        memCacheWidth: 720,
        placeholder: (_, __) => Container(color: AppColors.surfaceBg),
        errorWidget: (_, __, ___) => Container(
          color: AppColors.surfaceBg,
          child: const Icon(
            Icons.broken_image_outlined,
            color: AppColors.textHint,
          ),
        ),
      ),
    );
  }

  List<String> _imageUrls(Map<String, dynamic> product) {
    final urls = <String>[];
    final cover = product['cover_image_large'] ?? product['cover_image_small'];
    if (cover is String && cover.isNotEmpty) urls.add(cover);
    final images = product['images'];
    if (images is List) {
      for (final image in images.whereType<String>()) {
        if (image.isNotEmpty && !urls.contains(image)) urls.add(image);
      }
    }
    return urls;
  }
}
