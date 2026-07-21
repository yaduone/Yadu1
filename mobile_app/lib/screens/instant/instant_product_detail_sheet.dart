import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../providers/instant_provider.dart';
import '../../theme/app_typography.dart';
import '../../theme/instant_theme.dart';

/// Opens the instant-delivery product detail popup, sliding up over the
/// current screen. Everything shown here (photos, cover, description, unit,
/// price, category, availability) is admin-configured on the product doc.
Future<void> showInstantProductDetailSheet(
  BuildContext context,
  Map<String, dynamic> product,
) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (_) => InstantProductDetailSheet(product: product),
  );
}

class InstantProductDetailSheet extends StatefulWidget {
  final Map<String, dynamic> product;
  const InstantProductDetailSheet({super.key, required this.product});

  @override
  State<InstantProductDetailSheet> createState() =>
      _InstantProductDetailSheetState();
}

class _InstantProductDetailSheetState extends State<InstantProductDetailSheet> {
  final ValueNotifier<int> _currentImageIndex = ValueNotifier(0);
  final PageController _pageController = PageController();

  /// Gallery height bounds. Portrait shots are allowed to run tall, but not so
  /// tall that the title and CTA get pushed off the first screen.
  static const double _defaultGalleryHeight = 280;
  static const double _minGalleryHeight = 200;
  static const double _maxGalleryHeight = 380;

  /// width/height per page index, filled in as each image decodes.
  final Map<int, double> _aspectRatios = {};

  @override
  void dispose() {
    _pageController.dispose();
    _currentImageIndex.dispose();
    super.dispose();
  }

  /// Gallery order: admin's large cover first (falling back to the small
  /// cover), then the remaining uploaded images.
  List<String> _imageUrls() {
    final images = widget.product['images'];
    if (images is! List || images.isEmpty) return [];
    final all = images.whereType<String>().where((u) => u.isNotEmpty).toList();
    final cover =
        (widget.product['cover_image_large'] ?? widget.product['cover_image_small'])
            as String?;
    if (cover != null &&
        cover.isNotEmpty &&
        all.contains(cover) &&
        all.first != cover) {
      return [cover, ...all.where((u) => u != cover)];
    }
    return all;
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final id = p['id'] as String? ?? '';
    final isActive = p['is_active'] == true;
    final price = p['price'] as num?;
    final description = p['description'] as String? ?? '';

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
            color: InstantColors.scaffoldBg,
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
                              color: InstantColors.border,
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                          const SizedBox(height: 10),
                          _buildGallery(isActive),
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
                                    p['name'] as String? ?? '',
                                    style: AppType.h1.copyWith(
                                      color: InstantColors.textPrimary,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  price == null
                                      ? '—'
                                      : '₹${price.toStringAsFixed(0)}',
                                  style: AppType.price.copyWith(
                                    color: InstantColors.primary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            if (p['category'] != null)
                              Text(
                                p['category'] as String? ?? '',
                                style: AppType.caption.copyWith(
                                  color: InstantColors.textSecondary,
                                ),
                              ),
                            const SizedBox(height: 16),
                            _deliveryBadges(),
                            const SizedBox(height: 20),
                            if ((p['unit'] as String? ?? '').isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: InstantColors.surfaceBg,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  p['unit'] as String,
                                  style: AppType.small.copyWith(
                                    color: InstantColors.textSecondary,
                                  ),
                                ),
                              ),
                            if (description.isNotEmpty) ...[
                              const SizedBox(height: 24),
                              Text(
                                'About',
                                style: AppType.bodyBold.copyWith(
                                  color: InstantColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                description,
                                style: AppType.caption.copyWith(
                                  color: InstantColors.textSecondary,
                                  height: 1.6,
                                ),
                              ),
                            ],
                            const SizedBox(height: 130), // room for the bar
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
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
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: _BottomBar(
                    productId: id,
                    price: price,
                    enabled: isActive && id.isNotEmpty,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _deliveryBadges() {
    return const Row(
      children: [
        Expanded(
          child: _InstantBadge(
            icon: Icons.bolt_rounded,
            label: 'Instant Delivery',
          ),
        ),
        SizedBox(width: 10),
        Expanded(
          child: _InstantBadge(
            icon: Icons.verified_rounded,
            label: 'Quality Guaranteed',
          ),
        ),
      ],
    );
  }

  /// Height the gallery should take for [index], derived from that image's
  /// intrinsic aspect ratio and clamped so neither a very tall nor a very wide
  /// admin upload blows out (or collapses) the sheet.
  double _galleryHeight(int index, double width) {
    final ratio = _aspectRatios[index];
    if (ratio == null) return _defaultGalleryHeight;
    return (width / ratio).clamp(_minGalleryHeight, _maxGalleryHeight);
  }

  /// Resolves the decoded image's dimensions once and caches the ratio, then
  /// re-lays-out so the current page can animate to its natural height.
  void _cacheAspectRatio(int index, String url) {
    if (_aspectRatios.containsKey(index)) return;
    final stream = CachedNetworkImageProvider(url).resolve(
      const ImageConfiguration(),
    );
    late final ImageStreamListener listener;
    listener = ImageStreamListener((info, _) {
      stream.removeListener(listener);
      if (!mounted) return;
      final ratio = info.image.width / info.image.height;
      if (ratio <= 0 || !ratio.isFinite) return;
      setState(() => _aspectRatios[index] = ratio);
    }, onError: (_, __) => stream.removeListener(listener));
    stream.addListener(listener);
  }

  Widget _buildGallery(bool isActive) {
    final urls = _imageUrls();
    if (urls.isEmpty) {
      return SizedBox(height: _defaultGalleryHeight, child: _imageFallback());
    }

    final width = MediaQuery.of(context).size.width;
    for (var i = 0; i < urls.length; i++) {
      _cacheAspectRatio(i, urls[i]);
    }

    return Stack(
      alignment: Alignment.bottomCenter,
      children: [
        ValueListenableBuilder<int>(
          valueListenable: _currentImageIndex,
          builder: (_, currentIndex, child) => AnimatedContainer(
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeOutCubic,
            height: _galleryHeight(currentIndex, width),
            child: child,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              fit: StackFit.expand,
              children: [
                PageView.builder(
                  controller: _pageController,
                  itemCount: urls.length,
                  onPageChanged: (i) => _currentImageIndex.value = i,
                  itemBuilder: (_, i) => CachedNetworkImage(
                    imageUrl: urls[i],
                    // The box already matches this image's ratio, so `contain`
                    // fills it edge to edge without cropping; only clamped
                    // extremes letterbox, and the tinted backdrop hides that.
                    fit: BoxFit.contain,
                    memCacheWidth: 800,
                    fadeInDuration: const Duration(milliseconds: 300),
                    placeholder: (_, __) =>
                        Container(color: InstantColors.surfaceBg),
                    errorWidget: (_, __, ___) => _imageFallback(),
                  ),
                ),
                if (!isActive)
                  Container(
                    color: Colors.black.withValues(alpha: 0.45),
                    alignment: Alignment.center,
                    child: Text(
                      'Coming Soon',
                      style: AppType.bodyBold.copyWith(color: Colors.white),
                    ),
                  ),
              ],
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
                          ? InstantColors.primary
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

  Widget _imageFallback() {
    return Container(
      color: InstantColors.primaryLight,
      child: const Center(
        child: Icon(
          Icons.local_grocery_store_rounded,
          color: InstantColors.primary,
          size: 64,
        ),
      ),
    );
  }
}

class _InstantBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InstantBadge({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: InstantColors.primaryLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: InstantColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: InstantColors.primary),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppType.micro.copyWith(
                color: InstantColors.textPrimary,
                fontWeight: FontWeight.w700,
                letterSpacing: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Live-bound to the server cart, so the sheet reflects whatever quantity the
/// store grid / cart screen already holds for this product.
class _BottomBar extends StatelessWidget {
  final String productId;
  final num? price;
  final bool enabled;

  const _BottomBar({
    required this.productId,
    required this.price,
    required this.enabled,
  });

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InstantProvider>();
    final qty = provider.quantityOf(productId);
    final pending = provider.isPending(productId);
    final lineTotal = (price ?? 0) * (qty == 0 ? 1 : qty);

    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        14,
        20,
        14 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: InstantColors.border)),
        boxShadow: [
          BoxShadow(
            color: InstantColors.primary.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  qty == 0 ? 'Price' : 'Total',
                  style: AppType.small.copyWith(
                    color: InstantColors.textSecondary,
                  ),
                ),
                Text(
                  '₹${lineTotal.toStringAsFixed(0)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.h2.copyWith(
                    color: InstantColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(flex: 3, child: _action(context, provider, qty, pending)),
        ],
      ),
    );
  }

  Widget _action(
    BuildContext context,
    InstantProvider provider,
    int qty,
    bool pending,
  ) {
    if (!enabled) {
      return Container(
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: InstantColors.surfaceBg,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          'Unavailable',
          style: AppType.captionBold.copyWith(color: InstantColors.textHint),
        ),
      );
    }

    if (qty == 0) {
      return SizedBox(
        height: 56,
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: InstantColors.primary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          onPressed: pending
              ? null
              : () {
                  HapticFeedback.mediumImpact();
                  provider.addItem(productId);
                },
          child: pending
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(
                  'Add to Cart',
                  style: AppType.captionBold.copyWith(color: Colors.white),
                ),
        ),
      );
    }

    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: InstantColors.primary,
        borderRadius: BorderRadius.circular(14),
      ),
      child: pending
          ? const Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              ),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _step(Icons.remove_rounded,
                    () => provider.decrement(productId)),
                Text(
                  '$qty',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                  ),
                ),
                _step(Icons.add_rounded, () => provider.increment(productId)),
              ],
            ),
    );
  }

  Widget _step(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: 44,
        height: 56,
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }
}
