import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../providers/instant_provider.dart';
import '../../providers/instant_mode_provider.dart';
import '../../theme/instant_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/tappable.dart';
import '../../utils/transitions.dart';
import 'instant_cart_screen.dart';
import 'instant_product_detail_sheet.dart';
import 'instant_order_logs_screen.dart';
import 'instant_order_status_screen.dart';
import '../../widgets/remote_carousel.dart';

/// Blinkit/Zepto-style instant storefront, rendered inside the Home tab when
/// Instant mode is active. Light-purple theme throughout.
class InstantStoreScreen extends StatefulWidget {
  const InstantStoreScreen({super.key});

  @override
  State<InstantStoreScreen> createState() => _InstantStoreScreenState();
}

class _InstantStoreScreenState extends State<InstantStoreScreen> {
  String? _selectedCategory; // null == All

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<InstantProvider>();
      provider.ensureLoaded();
      provider.loadOrders();
    });
  }

  void _openCart() {
    Navigator.push(context, SlideUpRoute(page: const InstantCartScreen()));
  }

  void _openLogs() {
    Navigator.push(context, SlideUpRoute(page: const InstantOrderLogsScreen()));
  }

  void _openOrdersPopup(InstantProvider provider) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _ActiveOrdersSheet(orders: provider.activeOrders),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InstantProvider>();
    final categories = _visibleCategories(provider);
    final products = _productsFor(provider.products, _selectedCategory);
    final loading = !provider.productsLoaded && provider.products.isEmpty;

    return Container(
      color: InstantColors.scaffoldBg,
      child: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Column(
              children: [
                _InstantHeader(
                  itemCount: provider.itemCount,
                  onCart: _openCart,
                  onLogs: _openLogs,
                ),
                Expanded(
                  child: RefreshIndicator(
                    color: InstantColors.primary,
                    onRefresh: () async {
                      await Future.wait([
                        provider.loadProducts(forceRefresh: true),
                        provider.loadCategories(forceRefresh: true),
                        provider.loadCart(forceRefresh: true),
                        provider.loadAvailability(),
                      ]);
                    },
                    child: loading
                        ? const _StoreLoading()
                        : CustomScrollView(
                            physics: const BouncingScrollPhysics(
                              parent: AlwaysScrollableScrollPhysics(),
                            ),
                            slivers: [
                              SliverToBoxAdapter(
                                child: _DeliveryWindowBanner(
                                  provider: provider,
                                ),
                              ),
                              const SliverToBoxAdapter(
                                child: RemoteCarousel(
                                  location: 'home_instant',
                                  fallbackAssets: [
                                    'assets/images/1.png',
                                    'assets/images/2.png',
                                    'assets/images/3.png',
                                    'assets/images/4.png',
                                    'assets/images/5.png',
                                  ],
                                  heightDivisor: 2.1,
                                  borderRadius: 18,
                                  dotColor: InstantColors.primary,
                                  padding: EdgeInsets.fromLTRB(14, 6, 14, 10),
                                ),
                              ),
                              SliverToBoxAdapter(
                                child: _CategoryChips(
                                  categories: categories,
                                  selected: _selectedCategory,
                                  onSelected: (slug) =>
                                      setState(() => _selectedCategory = slug),
                                ),
                              ),
                              if (products.isEmpty)
                                const SliverFillRemaining(
                                  hasScrollBody: false,
                                  child: _EmptyStore(),
                                )
                              else
                                SliverPadding(
                                  padding: EdgeInsets.fromLTRB(
                                    14,
                                    4,
                                    14,
                                    provider.itemCount > 0 ? 150 : 110,
                                  ),
                                  sliver: SliverGrid(
                                    gridDelegate:
                                        const SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount: 2,
                                      crossAxisSpacing: 12,
                                      mainAxisSpacing: 12,
                                      childAspectRatio: 0.62,
                                    ),
                                    delegate: SliverChildBuilderDelegate(
                                      (context, index) => _InstantProductCard(
                                        product: products[index],
                                      ),
                                      childCount: products.length,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
            // Floating view-cart bar
            if (provider.itemCount > 0)
              Positioned(
                left: 14,
                right: 14,
                bottom: provider.activeOrders.isNotEmpty ? 144 : 84,
                child: _ViewCartBar(
                  itemCount: provider.itemCount,
                  total: provider.totalAmount,
                  onTap: _openCart,
                ),
              ),
            // Floating "Your Orders" badge
            if (provider.activeOrders.isNotEmpty)
              Positioned(
                left: 14,
                right: 14,
                bottom: 84,
                child: _YourOrdersBadge(
                  orders: provider.activeOrders,
                  onTap: () => _openOrdersPopup(provider),
                ),
              ),
          ],
        ),
      ),
    );
  }

  List<Map<String, dynamic>> _visibleCategories(InstantProvider provider) {
    final slugsWithProducts = <String>{
      for (final p in provider.products)
        if (p is Map && p['category'] is String) p['category'] as String,
    };
    final result = <Map<String, dynamic>>[];
    for (final raw in provider.categories) {
      if (raw is! Map) continue;
      final slug = raw['slug'];
      if (slug is String && slugsWithProducts.contains(slug)) {
        result.add(Map<String, dynamic>.from(raw));
      }
    }
    return result;
  }

  List<Map<String, dynamic>> _productsFor(List<dynamic> products, String? slug) {
    final list = products
        .whereType<Map>()
        .map((p) => Map<String, dynamic>.from(p))
        .where((p) => slug == null || p['category'] == slug)
        .toList();
    list.sort((a, b) {
      final aActive = a['is_active'] == true ? 0 : 1;
      final bActive = b['is_active'] == true ? 0 : 1;
      if (aActive != bActive) return aActive.compareTo(bActive);
      return (a['name'] as String? ?? '').compareTo(b['name'] as String? ?? '');
    });
    return list;
  }
}

// ── Shared toggle (also used on the scheduled Home) ──────────────────────────

class ScheduleInstantToggle extends StatelessWidget {
  final bool isInstant;
  final ValueChanged<bool> onChanged;

  const ScheduleInstantToggle({
    super.key,
    required this.isInstant,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor =
        isInstant ? InstantColors.primary : const Color(0xFF2E8EEA);
    return Container(
      height: 44,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: activeColor.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          _segment(
            label: 'Scheduled',
            icon: Icons.calendar_month_rounded,
            selected: !isInstant,
            color: const Color(0xFF2E8EEA),
            onTap: () => onChanged(false),
          ),
          _segment(
            label: 'Instant',
            icon: Icons.bolt_rounded,
            selected: isInstant,
            color: InstantColors.primary,
            onTap: () => onChanged(true),
          ),
        ],
      ),
    );
  }

  Widget _segment({
    required String label,
    required IconData icon,
    required bool selected,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: Tappable(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        scaleFactor: 0.96,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            color: selected ? color : Colors.transparent,
            borderRadius: BorderRadius.circular(11),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: selected ? Colors.white : color.withValues(alpha: 0.8),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppType.small.copyWith(
                  color: selected ? Colors.white : color.withValues(alpha: 0.9),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Header (toggle + ⚡ cart pill) ────────────────────────────────────────────

class _InstantHeader extends StatelessWidget {
  final int itemCount;
  final VoidCallback onCart;
  final VoidCallback onLogs;

  const _InstantHeader({
    required this.itemCount,
    required this.onCart,
    required this.onLogs,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
      child: Row(
        children: [
          Expanded(
            child: ScheduleInstantToggle(
              isInstant: true,
              onChanged: (instant) =>
                  context.read<InstantModeProvider>().setInstant(instant),
            ),
          ),
          const SizedBox(width: 10),
          _LogsPill(onTap: onLogs),
          const SizedBox(width: 8),
          _InstantCartPill(itemCount: itemCount, onTap: onCart),
        ],
      ),
    );
  }
}

/// Small button beside the cart pill that opens the past-orders log screen.
class _LogsPill extends StatelessWidget {
  final VoidCallback onTap;

  const _LogsPill({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tappable(
      onTap: onTap,
      scaleFactor: 0.92,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: InstantColors.border),
        ),
        child: const Icon(
          Icons.receipt_long_rounded,
          color: InstantColors.primary,
          size: 20,
        ),
      ),
    );
  }
}

/// Cart icon with a lightning symbol below it + count badge.
class _InstantCartPill extends StatelessWidget {
  final int itemCount;
  final VoidCallback onTap;

  const _InstantCartPill({required this.itemCount, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tappable(
      onTap: onTap,
      scaleFactor: 0.92,
      child: Container(
        width: 48,
        height: 44,
        decoration: BoxDecoration(
          gradient: InstantColors.gradient,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: InstantColors.primary.withValues(alpha: 0.35),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shopping_cart_rounded,
                      color: Colors.white, size: 19),
                  Icon(Icons.bolt_rounded,
                      color: Colors.amberAccent, size: 11),
                ],
              ),
            ),
            if (itemCount > 0)
              Positioned(
                right: -5,
                top: -5,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  constraints: const BoxConstraints(minWidth: 18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: InstantColors.primary, width: 1.5),
                  ),
                  child: Text(
                    '$itemCount',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: InstantColors.primary,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Category chips ───────────────────────────────────────────────────────────

/// Always-visible strip stating the instant-delivery window, so customers learn
/// the hours up front instead of discovering them via an error at checkout.
///
/// Open  → green "Delivering now · 8:00 AM – 9:00 PM" (amber when closing soon).
/// Closed→ amber/grey "Closed · opens 8:00 AM" with the full window beneath.
class _DeliveryWindowBanner extends StatelessWidget {
  final InstantProvider provider;

  const _DeliveryWindowBanner({required this.provider});

  /// Warn once the window has under an hour left.
  static const int _closingSoonThreshold = 60;

  String _formatDuration(int minutes) {
    if (minutes < 60) return '$minutes min';
    final hours = minutes ~/ 60;
    final mins = minutes % 60;
    return mins == 0 ? '$hours hr' : '$hours hr $mins min';
  }

  @override
  Widget build(BuildContext context) {
    final label = provider.windowLabel;
    // Nothing useful to say until the first availability fetch lands.
    if (label == null) return const SizedBox.shrink();

    final isOpen = provider.isInstantOpen;
    final untilClose = provider.minutesUntilClose;
    final untilOpen = provider.minutesUntilOpen;
    final closingSoon =
        isOpen && untilClose != null && untilClose <= _closingSoonThreshold;

    late final Color accent;
    late final IconData icon;
    late final String title;
    late final String detail;

    if (!isOpen) {
      accent = InstantColors.textSecondary;
      icon = Icons.schedule_rounded;
      title = provider.isInstantDisabled
          ? 'Instant delivery is unavailable'
          : 'Closed right now';
      detail = provider.isInstantDisabled
          ? 'Please check back later.'
          : (untilOpen != null
              ? 'Opens in ${_formatDuration(untilOpen)} · Daily $label'
              : 'Daily $label');
    } else if (closingSoon) {
      accent = const Color(0xFFF59E0B); // amber-500
      icon = Icons.timelapse_rounded;
      title = 'Closing in ${_formatDuration(untilClose)}';
      detail = 'Order now · Daily $label';
    } else {
      accent = InstantColors.success;
      icon = Icons.bolt_rounded;
      title = 'Delivering now · in ${provider.etaMinutes} min';
      detail = 'Instant delivery open daily $label';
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(14, 10, 14, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: accent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppType.captionBold.copyWith(color: accent),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: AppType.small
                      .copyWith(color: InstantColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
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
    if (categories.isEmpty) return const SizedBox(height: 4);
    return SizedBox(
      height: 68,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        itemCount: categories.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
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
          final label = category['label'] as String? ?? slug;
          final imageUrl = category['image_url'] as String? ?? '';
          return _chip(
            label: label,
            imageUrl: imageUrl,
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
    return Tappable(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      scaleFactor: 0.94,
      child: Tooltip(
        message: label,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: active ? InstantColors.primary : Colors.white,
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: active ? InstantColors.primary : InstantColors.border,
              width: active ? 2 : 1,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: imageUrl.isEmpty
              ? Center(
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.small.copyWith(
                      color:
                          active ? Colors.white : InstantColors.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.all(3),
                  child: ClipOval(
                    child: CachedNetworkImage(
                      imageUrl: imageUrl,
                      fit: BoxFit.cover,
                      width: 54,
                      height: 54,
                      placeholder: (_, __) =>
                          Container(color: InstantColors.border),
                      errorWidget: (_, __, ___) => Container(
                        color: Colors.white,
                        alignment: Alignment.center,
                        child: Text(
                          label,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.small.copyWith(
                            color: InstantColors.textSecondary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}

// ── Product card ─────────────────────────────────────────────────────────────

class _InstantProductCard extends StatelessWidget {
  final Map<String, dynamic> product;

  const _InstantProductCard({required this.product});

  String _imageUrl() {
    final cover = product['cover_image_large'] ?? product['cover_image_small'];
    if (cover is String && cover.isNotEmpty) return cover;
    final images = product['images'];
    if (images is List) {
      return images.whereType<String>().firstWhere(
            (i) => i.isNotEmpty,
            orElse: () => '',
          );
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InstantProvider>();
    final id = product['id'] as String? ?? '';
    final isActive = product['is_active'] == true;
    final name = product['name'] as String? ?? '';
    final unit = product['unit'] as String? ?? '';
    final price = product['price'] as num?;
    final qty = provider.quantityOf(id);
    final imageUrl = _imageUrl();

    return Tappable(
      onTap: () {
        HapticFeedback.selectionClick();
        showInstantProductDetailSheet(context, product);
      },
      scaleFactor: 0.97,
      child: Container(
        decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: InstantColors.border),
        boxShadow: [
          BoxShadow(
            color: InstantColors.primary.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image
          Expanded(
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(18)),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    color: InstantColors.primaryLight,
                    child: imageUrl.isEmpty
                        ? const Icon(Icons.local_grocery_store_rounded,
                            size: 36, color: InstantColors.primary)
                        : CachedNetworkImage(
                            imageUrl: imageUrl,
                            fit: BoxFit.cover,
                            memCacheWidth: 360,
                            errorWidget: (_, __, ___) => const Icon(
                              Icons.local_grocery_store_rounded,
                              size: 36,
                              color: InstantColors.primary,
                            ),
                          ),
                  ),
                  if (!isActive)
                    Container(
                      color: Colors.black.withValues(alpha: 0.45),
                      alignment: Alignment.center,
                      child: Text(
                        'Coming Soon',
                        style: AppType.small.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          // Details
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.captionBold.copyWith(
                    color: InstantColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  unit,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.micro.copyWith(
                    color: InstantColors.textHint,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        price == null ? '—' : '₹${price.toStringAsFixed(0)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppType.bodyBold.copyWith(
                          color: InstantColors.textPrimary,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    _AddControl(productId: id, quantity: qty, enabled: isActive),
                  ],
                ),
              ],
            ),
          ),
        ],
        ),
      ),
    );
  }
}

class _AddControl extends StatelessWidget {
  final String productId;
  final int quantity;
  final bool enabled;

  const _AddControl({
    required this.productId,
    required this.quantity,
    required this.enabled,
  });

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InstantProvider>();
    final pending = provider.isPending(productId);

    if (quantity == 0) {
      return Tappable(
        onTap: enabled && !pending ? () => provider.addItem(productId) : null,
        scaleFactor: 0.9,
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: enabled
                ? InstantColors.primaryLight
                : InstantColors.surfaceBg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: enabled
                  ? InstantColors.primary.withValues(alpha: 0.4)
                  : InstantColors.border,
            ),
          ),
          child: pending
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: InstantColors.primary,
                  ),
                )
              : Text(
                  'ADD',
                  style: AppType.micro.copyWith(
                    color: enabled
                        ? InstantColors.primary
                        : InstantColors.textHint,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
        ),
      );
    }

    return Container(
      height: 32,
      decoration: BoxDecoration(
        color: InstantColors.primary,
        borderRadius: BorderRadius.circular(10),
      ),
      child: pending
          ? const SizedBox(
              width: 60,
              height: 32,
              child: Center(
                child: SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                ),
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _stepBtn(
                    Icons.remove_rounded, () => provider.decrement(productId)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Text(
                    '$quantity',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                    ),
                  ),
                ),
                _stepBtn(
                    Icons.add_rounded, () => provider.increment(productId)),
              ],
            ),
    );
  }

  Widget _stepBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      borderRadius: BorderRadius.circular(10),
      child: SizedBox(
        width: 28,
        height: 32,
        child: Icon(icon, color: Colors.white, size: 16),
      ),
    );
  }
}

// ── View-cart bar ────────────────────────────────────────────────────────────

class _ViewCartBar extends StatelessWidget {
  final int itemCount;
  final double total;
  final VoidCallback onTap;

  const _ViewCartBar({
    required this.itemCount,
    required this.total,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tappable(
      onTap: onTap,
      scaleFactor: 0.97,
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          gradient: InstantColors.gradient,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: InstantColors.primary.withValues(alpha: 0.4),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.bolt_rounded, color: Colors.amberAccent, size: 20),
            const SizedBox(width: 8),
            Text(
              '$itemCount ${itemCount == 1 ? 'item' : 'items'}  ·  ₹${total.toStringAsFixed(0)}',
              style: AppType.bodyBold.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
            const Spacer(),
            Text(
              'View Cart',
              style: AppType.bodyBold.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_forward_rounded,
                color: Colors.white, size: 18),
          ],
        ),
      ),
    );
  }
}

// ── States ───────────────────────────────────────────────────────────────────

class _EmptyStore extends StatelessWidget {
  const _EmptyStore();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                color: InstantColors.primaryLight,
                borderRadius: BorderRadius.circular(22),
              ),
              child: const Icon(Icons.bolt_rounded,
                  size: 34, color: InstantColors.primary),
            ),
            const SizedBox(height: 16),
            Text(
              'No instant products yet',
              style: AppType.captionBold.copyWith(
                color: InstantColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Items enabled for instant delivery will appear here.',
              textAlign: TextAlign.center,
              style: AppType.small.copyWith(color: InstantColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class _StoreLoading extends StatelessWidget {
  const _StoreLoading();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(
        strokeWidth: 2.5,
        color: InstantColors.primary,
      ),
    );
  }
}

// ── "Your Orders" floating badge ─────────────────────────────────────────────

String _orderImageUrl(Map<String, dynamic> item) {
  final cover = item['cover_image_small'] ?? item['cover_image_large'];
  if (cover is String && cover.isNotEmpty) return cover;
  final images = item['images'];
  if (images is List) {
    return images.whereType<String>().firstWhere(
          (i) => i.isNotEmpty,
          orElse: () => '',
        );
  }
  return '';
}

class _YourOrdersBadge extends StatelessWidget {
  final List<dynamic> orders;
  final VoidCallback onTap;

  const _YourOrdersBadge({required this.orders, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final items = orders
        .expand((o) => (o['items'] as List? ?? const []))
        .whereType<Map>()
        .map((i) => Map<String, dynamic>.from(i))
        .toList();
    final shown = items.take(3).toList();

    return Tappable(
      onTap: onTap,
      scaleFactor: 0.97,
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFE5E5),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFFFC2C2)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Text(
              'Your Orders',
              style: AppType.bodyBold.copyWith(
                color: const Color(0xFFB91C1C),
                fontWeight: FontWeight.w800,
              ),
            ),
            const Spacer(),
            SizedBox(
              width: 26.0 * shown.length + (shown.isEmpty ? 0 : 14),
              height: 36,
              child: Stack(
                children: [
                  for (var i = 0; i < shown.length; i++)
                    Positioned(
                      left: i * 26.0,
                      child: _OrderItemAvatar(item: shown[i]),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.arrow_forward_rounded,
                color: Color(0xFFB91C1C), size: 18),
          ],
        ),
      ),
    );
  }
}

class _OrderItemAvatar extends StatelessWidget {
  final Map<String, dynamic> item;

  const _OrderItemAvatar({required this.item});

  @override
  Widget build(BuildContext context) {
    final imageUrl = _orderImageUrl(item);
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: ClipOval(
        child: imageUrl.isEmpty
            ? const Icon(Icons.shopping_bag_rounded,
                size: 16, color: InstantColors.primary)
            : CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.cover,
                memCacheWidth: 90,
                errorWidget: (_, __, ___) => const Icon(
                  Icons.shopping_bag_rounded,
                  size: 16,
                  color: InstantColors.primary,
                ),
              ),
      ),
    );
  }
}

/// Bottom sheet listing items from orders still pending delivery.
class _ActiveOrdersSheet extends StatelessWidget {
  final List<dynamic> orders;

  const _ActiveOrdersSheet({required this.orders});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.7,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: InstantColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
              child: Row(
                children: [
                  const Icon(Icons.local_shipping_rounded,
                      color: InstantColors.primary, size: 20),
                  const SizedBox(width: 8),
                  Text('Your Orders',
                      style: AppType.h3
                          .copyWith(color: InstantColors.textPrimary)),
                ],
              ),
            ),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
                itemCount: orders.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (_, index) =>
                    _ActiveOrderCard(order: orders[index] as Map<String, dynamic>),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveOrderCard extends StatelessWidget {
  final Map<String, dynamic> order;

  const _ActiveOrderCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final items = (order['items'] as List? ?? const [])
        .whereType<Map>()
        .map((i) => Map<String, dynamic>.from(i))
        .toList();
    final total = (order['total_amount'] as num?)?.toDouble() ?? 0;

    // A pending order has not been accepted yet — saying "On the way" would be a
    // promise the store hasn't made.
    final isAwaiting = order['status'] == 'pending';
    final statusLabel = isAwaiting ? 'Awaiting confirmation' : 'On the way';
    final statusFg =
        isAwaiting ? const Color(0xFF92400E) : const Color(0xFFB91C1C);
    final statusBg =
        isAwaiting ? const Color(0xFFFEF3C7) : const Color(0xFFFFE5E5);

    return Tappable(
      // Re-entry point into the live status screen, so a customer who left the
      // app can get back to their pending order.
      onTap: () {
        Navigator.pop(context); // close the active-orders sheet
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => InstantOrderStatusScreen(
              order: Map<String, dynamic>.from(order),
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: InstantColors.surfaceBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: InstantColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusLabel,
                    style: AppType.micro.copyWith(
                      color: statusFg,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
                  ),
                ),
              const Spacer(),
              Text(
                '₹${total.toStringAsFixed(0)}',
                style: AppType.captionBold
                    .copyWith(color: InstantColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...items.map((item) {
            final imageUrl = _orderImageUrl(item);
            final name = item['product_name'] as String? ?? '';
            final qty = (item['quantity'] as num?)?.toInt() ?? 0;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 32,
                      height: 32,
                      child: imageUrl.isEmpty
                          ? Container(
                              color: InstantColors.primaryLight,
                              child: const Icon(Icons.shopping_bag_rounded,
                                  size: 16, color: InstantColors.primary),
                            )
                          : CachedNetworkImage(
                              imageUrl: imageUrl,
                              fit: BoxFit.cover,
                              memCacheWidth: 80,
                            ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppType.small
                          .copyWith(color: InstantColors.textPrimary),
                    ),
                  ),
                  Text(
                    '× $qty',
                    style: AppType.small
                        .copyWith(color: InstantColors.textSecondary),
                  ),
                ],
              ),
            );
            }),
          ],
        ),
      ),
    );
  }
}
