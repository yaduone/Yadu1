import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../providers/cart_provider.dart';
import '../../providers/instant_provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../theme/instant_theme.dart';
import '../../utils/delivery_mode_status.dart';
import '../../utils/transitions.dart';
import '../../widgets/premium_components.dart';
import '../home/home_screen.dart';
import '../instant/instant_active_orders.dart';
import '../instant/instant_cart_screen.dart';
import '../instant/instant_order_logs_screen.dart';
import 'product_detail_screen.dart';
import 'product_info.dart';
import 'widgets/delivery_add_buttons.dart';

/// The one catalogue in the app: every product the admin has defined, each
/// with an add control for the next scheduled delivery and one for instant
/// delivery. Replaces the separate instant storefront that used to live
/// behind a Scheduled/Instant toggle on Home.
class ProductsScreen extends StatefulWidget {
  /// Called after the page closes when the customer asks for the scheduled
  /// cart. Defaults to switching Home to its Cart tab.
  final VoidCallback? onGoToCart;

  const ProductsScreen({super.key, this.onGoToCart});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  String? _category; // null == All
  bool _searching = false;
  String _query = '';
  final TextEditingController _searchCtrl = TextEditingController();
  final FocusNode _searchFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final cart = context.read<CartProvider>();
      cart.loadProducts();
      cart.loadCategories();
      cart.ensureTomorrowStatusLoaded();
      final instant = context.read<InstantProvider>();
      instant.ensureLoaded();
      instant.loadOrders();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    final cart = context.read<CartProvider>();
    final instant = context.read<InstantProvider>();
    await Future.wait([
      cart.loadProducts(forceRefresh: true),
      cart.loadCategories(forceRefresh: true),
      cart.loadTomorrowStatus(),
      instant.loadProducts(forceRefresh: true),
      instant.loadCart(forceRefresh: true),
      instant.loadAvailability(),
      instant.loadOrders(forceRefresh: true),
    ]);
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  void _openScheduledCart() {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    if (Navigator.canPop(context)) Navigator.pop(context);
    final onGoToCart = widget.onGoToCart;
    if (onGoToCart != null) {
      onGoToCart();
    } else {
      HomeScreen.globalKey.currentState?.changeTab(HomeScreen.cartTabIndex);
    }
  }

  void _openInstantCart() {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    Navigator.push(context, SlideUpRoute(page: const InstantCartScreen()));
  }

  void _openInstantHistory() {
    Navigator.push(
      context,
      SlideUpRoute(page: const InstantOrderLogsScreen()),
    );
  }

  // ── Search ────────────────────────────────────────────────────────────────

  void _openSearch() {
    HapticFeedback.selectionClick();
    setState(() => _searching = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _searchFocus.requestFocus();
    });
  }

  void _closeSearch() {
    _searchFocus.unfocus();
    _searchCtrl.clear();
    setState(() {
      _searching = false;
      _query = '';
    });
  }

  void _clearQuery() {
    _searchCtrl.clear();
    setState(() => _query = '');
    _searchFocus.requestFocus();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final instant = context.watch<InstantProvider>();

    final products = _catalogue(cart.products);
    final categories = _categories(cart.categories, products);
    final labels = {
      for (final c in categories) c['slug'] as String: c['label'] as String,
    };
    String labelOf(Map<String, dynamic> p) {
      final slug = p['category'];
      if (slug is! String || slug.isEmpty) return '';
      return labels[slug] ?? ProductInfo.titleFromSlug(slug);
    }

    final selected = categories.any((c) => c['slug'] == _category)
        ? _category
        : null;
    final query = _query.trim().toLowerCase();
    final visible = _searching
        ? (query.isEmpty ? <Map<String, dynamic>>[] : _search(products, query, labelOf))
        : products
              .where((p) => selected == null || p['category'] == selected)
              .toList();

    final loading = !cart.productsLoaded && products.isEmpty;
    final scheduledStatus = DeliveryModeStatus.scheduled(cart);
    final instantStatus = DeliveryModeStatus.instant(instant);

    final pendingScheduled = cart.pendingCartItems.fold<int>(
      0,
      (sum, item) => sum + item.quantity,
    );
    final confirmedScheduled = cart.extraItems.fold<int>(
      0,
      (sum, item) => sum + ((item['quantity'] as num?)?.toInt() ?? 0),
    );
    final instantCount = instant.itemCount;
    final activeOrders = instant.activeOrders;

    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final hasCartBar = pendingScheduled > 0 || instantCount > 0;
    final listBottom =
        24 +
        bottomInset +
        (hasCartBar ? 72 : 0) +
        (activeOrders.isNotEmpty ? 64 : 0);

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Column(
              children: [
                _Header(
                  searching: _searching,
                  productCount: products.length,
                  loading: loading,
                  searchCtrl: _searchCtrl,
                  searchFocus: _searchFocus,
                  onBack: _searching
                      ? _closeSearch
                      : () => Navigator.pop(context),
                  onSearch: _openSearch,
                  onQueryChanged: (q) => setState(() => _query = q),
                  onClearQuery: _clearQuery,
                  scheduledCount: pendingScheduled + confirmedScheduled,
                  instantCount: instantCount,
                  onScheduledCart: _openScheduledCart,
                  onInstantCart: _openInstantCart,
                  onInstantHistory: _openInstantHistory,
                ),
                Expanded(
                  child: RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: _refresh,
                    child: CustomScrollView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      physics: const BouncingScrollPhysics(
                        parent: AlwaysScrollableScrollPhysics(),
                      ),
                      slivers: [
                        if (!_searching)
                          SliverToBoxAdapter(
                            child: _ModeStatusRow(
                              scheduled: scheduledStatus,
                              instant: instantStatus,
                            ),
                          ),
                        if (!_searching && categories.isNotEmpty)
                          SliverPersistentHeader(
                            pinned: true,
                            delegate: _PinnedChips(
                              child: _CategoryChips(
                                categories: categories,
                                selected: selected,
                                onSelected: (slug) {
                                  HapticFeedback.selectionClick();
                                  setState(() => _category = slug);
                                },
                              ),
                            ),
                          ),
                        if (_searching && query.isNotEmpty && !loading)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(16, 14, 16, 2),
                              child: Text(
                                '${visible.length} ${visible.length == 1 ? 'result' : 'results'} for "${_query.trim()}"',
                                style: AppType.small.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        if (loading)
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(14, 8, 14, 24),
                            sliver: SliverList.separated(
                              itemCount: 4,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (_, __) => const _TileSkeleton(),
                            ),
                          )
                        else if (visible.isEmpty)
                          SliverFillRemaining(
                            hasScrollBody: false,
                            child: _EmptyState(
                              searching: _searching,
                              query: _query.trim(),
                              categoryLabel: selected == null
                                  ? null
                                  : labels[selected],
                              catalogueEmpty: products.isEmpty,
                            ),
                          )
                        else
                          SliverPadding(
                            padding: EdgeInsets.fromLTRB(14, 8, 14, listBottom),
                            sliver: SliverList.separated(
                              itemCount: visible.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final product = visible[index];
                                final label = labelOf(product);
                                return _ProductTile(
                                  key: ValueKey(ProductInfo.id(product)),
                                  product: product,
                                  categoryLabel: label,
                                  onTap: () => showProductDetailSheet(
                                    context,
                                    product,
                                    categoryLabel: label,
                                  ),
                                );
                              },
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            Positioned(
              left: 12,
              right: 12,
              bottom: 12 + bottomInset,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (activeOrders.isNotEmpty) ...[
                    InstantOrdersBadge(
                      orders: activeOrders,
                      onTap: () =>
                          openInstantActiveOrders(context, activeOrders),
                    ),
                    if (hasCartBar) const SizedBox(height: 8),
                  ],
                  if (hasCartBar)
                    _CartBar(
                      pendingScheduled: pendingScheduled,
                      instantCount: instantCount,
                      instantTotal: instant.itemsTotal,
                      onScheduled: _openScheduledCart,
                      onInstant: _openInstantCart,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Every product the admin defined, active first, then by name.
  List<Map<String, dynamic>> _catalogue(List<dynamic> source) {
    final list = source
        .whereType<Map>()
        .map((p) => Map<String, dynamic>.from(p))
        .where((p) => ProductInfo.id(p).isNotEmpty)
        .toList();
    list.sort((a, b) {
      final aActive = ProductInfo.isActive(a) ? 0 : 1;
      final bActive = ProductInfo.isActive(b) ? 0 : 1;
      if (aActive != bActive) return aActive.compareTo(bActive);
      return ProductInfo.name(a)
          .toLowerCase()
          .compareTo(ProductInfo.name(b).toLowerCase());
    });
    return list;
  }

  /// Admin categories (in admin order) that have at least one product, plus
  /// any slug a product uses that isn't a configured category.
  List<Map<String, dynamic>> _categories(
    List<dynamic> source,
    List<Map<String, dynamic>> products,
  ) {
    final used = <String>{
      for (final p in products)
        if (p['category'] is String && (p['category'] as String).isNotEmpty)
          p['category'] as String,
    };
    final result = <Map<String, dynamic>>[];
    final seen = <String>{};
    for (final raw in source) {
      if (raw is! Map) continue;
      final slug = raw['slug'];
      if (slug is String && used.contains(slug) && seen.add(slug)) {
        result.add({
          'slug': slug,
          'label': raw['label'] as String? ?? ProductInfo.titleFromSlug(slug),
          'image_url': raw['image_url'] as String? ?? '',
        });
      }
    }
    for (final slug in used) {
      if (seen.add(slug)) {
        result.add({
          'slug': slug,
          'label': ProductInfo.titleFromSlug(slug),
          'image_url': '',
        });
      }
    }
    return result;
  }

  List<Map<String, dynamic>> _search(
    List<Map<String, dynamic>> products,
    String query,
    String Function(Map<String, dynamic>) labelOf,
  ) {
    return products.where((p) {
      final text = [
        ProductInfo.name(p),
        ProductInfo.description(p),
        ProductInfo.unit(p),
        p['category'] as String? ?? '',
        labelOf(p),
      ].join(' ').toLowerCase();
      return text.contains(query);
    }).toList();
  }
}

// ── Header ───────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final bool searching;
  final int productCount;
  final bool loading;
  final TextEditingController searchCtrl;
  final FocusNode searchFocus;
  final VoidCallback onBack;
  final VoidCallback onSearch;
  final ValueChanged<String> onQueryChanged;
  final VoidCallback onClearQuery;
  final int scheduledCount;
  final int instantCount;
  final VoidCallback onScheduledCart;
  final VoidCallback onInstantCart;
  final VoidCallback onInstantHistory;

  const _Header({
    required this.searching,
    required this.productCount,
    required this.loading,
    required this.searchCtrl,
    required this.searchFocus,
    required this.onBack,
    required this.onSearch,
    required this.onQueryChanged,
    required this.onClearQuery,
    required this.scheduledCount,
    required this.instantCount,
    required this.onScheduledCart,
    required this.onInstantCart,
    required this.onInstantHistory,
  });

  static const _compact = BoxConstraints(minWidth: 38, minHeight: 40);

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 60),
      padding: const EdgeInsets.fromLTRB(4, 6, 8, 6),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: searching ? 'Close search' : 'Back',
            onPressed: onBack,
            constraints: _compact,
            padding: const EdgeInsets.all(8),
            icon: Icon(
              searching
                  ? Icons.arrow_back_rounded
                  : Icons.arrow_back_ios_new_rounded,
              size: 19,
              color: AppColors.textPrimary,
            ),
          ),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: searching
                  ? TextField(
                      key: const ValueKey('search'),
                      controller: searchCtrl,
                      focusNode: searchFocus,
                      textInputAction: TextInputAction.search,
                      onChanged: onQueryChanged,
                      decoration: InputDecoration(
                        hintText: 'Search products',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 11,
                        ),
                        prefixIcon: const Icon(Icons.search_rounded, size: 20),
                        suffixIcon: searchCtrl.text.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Clear search',
                                onPressed: onClearQuery,
                                icon: const Icon(Icons.close_rounded, size: 18),
                              ),
                      ),
                    )
                  : Padding(
                      key: const ValueKey('title'),
                      padding: const EdgeInsets.only(left: 2),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Products',
                            maxLines: 1,
                            style: AppType.h2.copyWith(
                              color: AppColors.textPrimary,
                            ),
                          ),
                          if (!loading)
                            Text(
                              '$productCount ${productCount == 1 ? 'item' : 'items'}',
                              maxLines: 1,
                              style: AppType.micro.copyWith(
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0,
                              ),
                            ),
                        ],
                      ),
                    ),
            ),
          ),
          if (!searching) ...[
            IconButton(
              tooltip: 'Search products',
              onPressed: onSearch,
              constraints: _compact,
              padding: const EdgeInsets.all(8),
              icon: const Icon(
                Icons.search_rounded,
                size: 22,
                color: AppColors.textPrimary,
              ),
            ),
            IconButton(
              tooltip: 'Instant order history',
              onPressed: onInstantHistory,
              constraints: _compact,
              padding: const EdgeInsets.all(8),
              icon: const Icon(
                Icons.receipt_long_rounded,
                size: 21,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(width: 2),
            _CartButton(
              tooltip: 'Scheduled cart',
              icon: Icons.shopping_cart_outlined,
              color: AppColors.primary,
              count: scheduledCount,
              onTap: onScheduledCart,
            ),
            const SizedBox(width: 6),
            _CartButton(
              tooltip: 'Instant cart',
              icon: Icons.bolt_rounded,
              color: InstantColors.primary,
              count: instantCount,
              onTap: onInstantCart,
            ),
          ],
        ],
      ),
    );
  }
}

class _CartButton extends StatelessWidget {
  final String tooltip;
  final IconData icon;
  final Color color;
  final int count;
  final VoidCallback onTap;

  const _CartButton({
    required this.tooltip,
    required this.icon,
    required this.color,
    required this.count,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        label: '$tooltip, $count ${count == 1 ? 'item' : 'items'}',
        child: Material(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 40,
              height: 40,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Center(child: Icon(icon, size: 21, color: color)),
                  if (count > 0)
                    Positioned(
                      right: -4,
                      top: -4,
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 18),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: color,
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                        child: Text(
                          count > 99 ? '99+' : '$count',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Delivery-mode status ─────────────────────────────────────────────────────

class _ModeStatusRow extends StatelessWidget {
  final DeliveryModeStatus scheduled;
  final DeliveryModeStatus instant;

  const _ModeStatusRow({required this.scheduled, required this.instant});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
      child: Row(
        children: [
          Expanded(
            child: DeliveryModeStatusTile(
              icon: Icons.event_repeat_rounded,
              label: 'Scheduled',
              color: AppColors.primary,
              status: scheduled,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: DeliveryModeStatusTile(
              icon: Icons.bolt_rounded,
              label: 'Instant',
              color: InstantColors.primary,
              status: instant,
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact card naming a delivery mode and whether it is taking orders.
/// Shared with the Home products card.
class DeliveryModeStatusTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final DeliveryModeStatus status;
  final Color background;

  const DeliveryModeStatusTile({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.status,
    this.background = Colors.white,
  });

  static Color toneColor(DeliveryModeTone tone) {
    switch (tone) {
      case DeliveryModeTone.ok:
        return AppColors.success;
      case DeliveryModeTone.warn:
        return const Color(0xFFF59E0B);
      case DeliveryModeTone.off:
        return AppColors.textHint;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tone = toneColor(status.tone);
    return Semantics(
      label: '$label delivery: ${status.title}. ${status.detail}',
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 15, color: color),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.small.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: tone,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    status.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.micro.copyWith(
                      color: status.tone == DeliveryModeTone.off
                          ? AppColors.textSecondary
                          : tone,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 1),
            Text(
              status.detail,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppType.micro.copyWith(
                color: AppColors.textSecondary,
                letterSpacing: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Category chips (pinned under the header while scrolling) ────────────────

class _PinnedChips extends SliverPersistentHeaderDelegate {
  final Widget child;

  _PinnedChips({required this.child});

  static const double _height = 56;

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      color: AppColors.scaffoldBg,
      alignment: Alignment.center,
      child: child,
    );
  }

  @override
  bool shouldRebuild(covariant _PinnedChips oldDelegate) =>
      oldDelegate.child != child;
}

class _CategoryChips extends StatelessWidget {
  final List<Map<String, dynamic>> categories;
  final String? selected;
  final ValueChanged<String?> onSelected;

  const _CategoryChips({
    required this.categories,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        itemCount: categories.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          if (index == 0) {
            return _chip(
              label: 'All',
              imageUrl: '',
              active: selected == null,
              onTap: () => onSelected(null),
            );
          }
          final category = categories[index - 1];
          final slug = category['slug'] as String;
          return _chip(
            label: category['label'] as String,
            imageUrl: category['image_url'] as String? ?? '',
            active: selected == slug,
            onTap: () => onSelected(slug),
          );
        },
      ),
    );
  }

  Widget _chip({
    required String label,
    required String imageUrl,
    required bool active,
    required VoidCallback onTap,
  }) {
    return Semantics(
      button: true,
      selected: active,
      label: label,
      child: Material(
        color: active ? AppColors.primary : Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: EdgeInsets.fromLTRB(imageUrl.isEmpty ? 16 : 5, 0, 16, 0),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: active ? AppColors.primary : AppColors.border,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (imageUrl.isNotEmpty) ...[
                  ClipOval(
                    child: CachedNetworkImage(
                      imageUrl: imageUrl,
                      width: 28,
                      height: 28,
                      fit: BoxFit.cover,
                      memCacheWidth: 84,
                      errorWidget: (_, __, ___) =>
                          const SizedBox(width: 28, height: 28),
                    ),
                  ),
                  const SizedBox(width: 7),
                ],
                Text(
                  label,
                  style: AppType.small.copyWith(
                    color: active ? Colors.white : AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
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

// ── Product tile ─────────────────────────────────────────────────────────────

class _ProductTile extends StatelessWidget {
  final Map<String, dynamic> product;
  final String categoryLabel;
  final VoidCallback onTap;

  const _ProductTile({
    super.key,
    required this.product,
    required this.categoryLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isActive = ProductInfo.isActive(product);
    final description = ProductInfo.description(product);
    final meta = [
      ProductInfo.unit(product),
      categoryLabel,
    ].where((s) => s.isNotEmpty).join(' · ');

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Thumbnail(
                    url: ProductInfo.thumbnail(product),
                    active: isActive,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ProductInfo.name(product),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.bodyBold.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                            height: 1.25,
                          ),
                        ),
                        if (meta.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            meta,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppType.small.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            description,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppType.small.copyWith(
                              color: AppColors.textHint,
                              height: 1.35,
                            ),
                          ),
                        ],
                        const SizedBox(height: 6),
                        _PriceLine(product: product),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (isActive)
                DeliveryAddButtons(product: product)
              else
                Container(
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Coming soon',
                    style: AppType.small.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Price as the admin set it. When the instant price differs from the
/// scheduled one, both are shown so neither button holds a surprise.
class _PriceLine extends StatelessWidget {
  final Map<String, dynamic> product;

  const _PriceLine({required this.product});

  @override
  Widget build(BuildContext context) {
    final offersScheduled = ProductInfo.offersScheduled(product);
    final offersInstant = ProductInfo.offersInstant(product);
    final scheduled = ProductInfo.scheduledPrice(product);
    final instant = ProductInfo.instantPrice(product);

    final main = AppType.bodyBold.copyWith(
      color: AppColors.textPrimary,
      fontWeight: FontWeight.w900,
    );
    final instantStyle = AppType.small.copyWith(
      color: InstantColors.primary,
      fontWeight: FontWeight.w800,
    );

    if (!offersScheduled) {
      return Text(
        ProductInfo.formatPrice(instant),
        style: main.copyWith(color: InstantColors.primary),
      );
    }
    final differs = offersInstant && instant != scheduled;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      children: [
        Text(ProductInfo.formatPrice(scheduled), style: main),
        if (differs)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.bolt_rounded,
                size: 14,
                color: InstantColors.primary,
              ),
              Text(
                '${ProductInfo.formatPrice(instant)} instant',
                style: instantStyle,
              ),
            ],
          ),
      ],
    );
  }
}

class _Thumbnail extends StatelessWidget {
  final String url;
  final bool active;

  const _Thumbnail({required this.url, required this.active});

  static const double _size = 92;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: _size,
        height: _size,
        child: Stack(
          fit: StackFit.expand,
          children: [
            url.isEmpty
                ? const _ThumbFallback()
                : CachedNetworkImage(
                    imageUrl: url,
                    fit: BoxFit.cover,
                    memCacheWidth: 276,
                    placeholder: (_, __) =>
                        Container(color: AppColors.surfaceBg),
                    errorWidget: (_, __, ___) => const _ThumbFallback(),
                  ),
            if (!active)
              Container(
                color: Colors.black.withValues(alpha: 0.45),
                alignment: Alignment.center,
                child: Text(
                  'Soon',
                  style: AppType.small.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ThumbFallback extends StatelessWidget {
  const _ThumbFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primaryLight,
      child: const Icon(
        Icons.local_grocery_store_rounded,
        color: AppColors.primary,
        size: 30,
      ),
    );
  }
}

class _TileSkeleton extends StatelessWidget {
  const _TileSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: const Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonLoader(height: 92, width: 92, borderRadius: 14),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonLoader(height: 16, borderRadius: 7),
                    SizedBox(height: 8),
                    SkeletonLoader(height: 11, width: 110, borderRadius: 6),
                    SizedBox(height: 8),
                    SkeletonLoader(height: 11, borderRadius: 6),
                    SizedBox(height: 10),
                    SkeletonLoader(height: 16, width: 60, borderRadius: 7),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: SkeletonLoader(height: 42, borderRadius: 12)),
              SizedBox(width: 8),
              Expanded(child: SkeletonLoader(height: 42, borderRadius: 12)),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool searching;
  final String query;
  final String? categoryLabel;
  final bool catalogueEmpty;

  const _EmptyState({
    required this.searching,
    required this.query,
    required this.categoryLabel,
    required this.catalogueEmpty,
  });

  @override
  Widget build(BuildContext context) {
    final IconData icon;
    final String title;
    final String detail;
    if (searching && query.isEmpty) {
      icon = Icons.manage_search_rounded;
      title = 'Find a product';
      detail = 'Search by name, unit or category.';
    } else if (searching) {
      icon = Icons.search_off_rounded;
      title = 'No results for "$query"';
      detail = 'Try another product name or category.';
    } else if (catalogueEmpty) {
      icon = Icons.inventory_2_outlined;
      title = 'No products yet';
      detail = 'Pull down to refresh.';
    } else {
      icon = Icons.inventory_2_outlined;
      title = 'Nothing in ${categoryLabel ?? 'this category'} yet';
      detail = 'Pick another category.';
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
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
            const SizedBox(height: 4),
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

// ── Floating cart bar ────────────────────────────────────────────────────────

class _CartBar extends StatelessWidget {
  final int pendingScheduled;
  final int instantCount;
  final double instantTotal;
  final VoidCallback onScheduled;
  final VoidCallback onInstant;

  const _CartBar({
    required this.pendingScheduled,
    required this.instantCount,
    required this.instantTotal,
    required this.onScheduled,
    required this.onInstant,
  });

  @override
  Widget build(BuildContext context) {
    final both = pendingScheduled > 0 && instantCount > 0;
    return Row(
      children: [
        if (pendingScheduled > 0)
          Expanded(
            child: _CartBarSegment(
              gradient: const LinearGradient(
                colors: [AppColors.primaryDark, AppColors.primary],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shadow: AppColors.primary,
              icon: Icons.event_repeat_rounded,
              title: both
                  ? '$pendingScheduled ${pendingScheduled == 1 ? 'item' : 'items'}'
                  : '$pendingScheduled ${pendingScheduled == 1 ? 'item' : 'items'} to confirm',
              // Side by side there's only room for the action; the icon and
              // colour already say which cart it is.
              subtitle: both ? 'To confirm' : 'Scheduled · Review cart',
              onTap: onScheduled,
            ),
          ),
        if (both) const SizedBox(width: 8),
        if (instantCount > 0)
          Expanded(
            child: _CartBarSegment(
              gradient: InstantColors.gradient,
              shadow: InstantColors.primary,
              icon: Icons.bolt_rounded,
              iconColor: Colors.amberAccent,
              title:
                  '$instantCount ${instantCount == 1 ? 'item' : 'items'} · ${ProductInfo.formatPrice(instantTotal)}',
              subtitle: both ? 'Checkout' : 'Instant · Checkout',
              onTap: onInstant,
            ),
          ),
      ],
    );
  }
}

class _CartBarSegment extends StatelessWidget {
  final Gradient gradient;
  final Color shadow;
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _CartBarSegment({
    required this.gradient,
    required this.shadow,
    required this.icon,
    this.iconColor = Colors.white,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: shadow.withValues(alpha: 0.35),
            blurRadius: 16,
            offset: const Offset(0, 7),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: SizedBox(
            height: 58,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Icon(icon, color: iconColor, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.captionBold.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.micro.copyWith(
                            color: Colors.white.withValues(alpha: 0.8),
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.arrow_forward_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
