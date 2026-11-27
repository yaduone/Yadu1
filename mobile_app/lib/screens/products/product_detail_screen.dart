import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/cart_provider.dart';
import '../../providers/instant_provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../theme/instant_theme.dart';
import '../../utils/delivery_mode_status.dart';
import '../../widgets/premium_components.dart';
import 'product_info.dart';
import 'widgets/delivery_add_buttons.dart';

/// Opens the product popup, sliding up over the current screen. Everything in
/// it (photos, cover, name, description, unit, prices, category, which
/// delivery modes it's offered in) comes from the admin's product doc.
Future<void> showProductDetailSheet(
  BuildContext context,
  Map<String, dynamic> product, {
  String? categoryLabel,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (_) =>
        ProductDetailSheet(product: product, categoryLabel: categoryLabel),
  );
}

class ProductDetailSheet extends StatefulWidget {
  final Map<String, dynamic> product;
  final String? categoryLabel;

  const ProductDetailSheet({
    super.key,
    required this.product,
    this.categoryLabel,
  });

  @override
  State<ProductDetailSheet> createState() => _ProductDetailSheetState();
}

class _ProductDetailSheetState extends State<ProductDetailSheet> {
  final ValueNotifier<int> _currentImageIndex = ValueNotifier(0);
  final PageController _pageController = PageController();

  /// Gallery height bounds. Portrait shots may run tall, but not so tall that
  /// the name and the add buttons get pushed off the first screen.
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

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final isActive = ProductInfo.isActive(p);
    final description = ProductInfo.description(p);
    final unit = ProductInfo.unit(p);
    final category =
        widget.categoryLabel ??
        (p['category'] is String
            ? ProductInfo.titleFromSlug(p['category'] as String)
            : '');

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
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: _buildGallery(isActive),
                          ),
                        ],
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              ProductInfo.name(p),
                              style: AppType.h1.copyWith(
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: [
                                if (unit.isNotEmpty) _Tag(text: unit),
                                if (category.isNotEmpty) _Tag(text: category),
                              ],
                            ),
                            const SizedBox(height: 18),
                            const SectionLabel('Delivery options'),
                            const SizedBox(height: 10),
                            _DeliveryOptions(product: p),
                            if (description.isNotEmpty) ...[
                              const SizedBox(height: 22),
                              const SectionLabel('About'),
                              const SizedBox(height: 8),
                              Text(
                                description,
                                style: AppType.caption.copyWith(
                                  color: AppColors.textSecondary,
                                  height: 1.6,
                                ),
                              ),
                            ],
                            const SizedBox(height: 22),
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
                                    icon: Icons.eco_rounded,
                                    label: 'Freshness Guaranteed',
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 130), // room for the bar
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                Positioned(
                  top: 18,
                  right: 26,
                  child: Semantics(
                    button: true,
                    label: 'Close',
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
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: StickyBottomBar(
                    child: isActive
                        ? DeliveryAddButtons(
                            product: p,
                            height: 52,
                            showPrices: true,
                          )
                        : Container(
                            height: 52,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceBg,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Text(
                              'Coming soon',
                              style: AppType.bodyBold.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
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

  /// Height the gallery should take for [index], from that image's intrinsic
  /// aspect ratio, clamped so neither a very tall nor a very wide upload blows
  /// out (or collapses) the sheet.
  double _galleryHeight(int index, double width) {
    final ratio = _aspectRatios[index];
    if (ratio == null) return _defaultGalleryHeight;
    return (width / ratio).clamp(_minGalleryHeight, _maxGalleryHeight);
  }

  /// Resolves the decoded image's dimensions once and caches the ratio, then
  /// re-lays-out so the current page can animate to its natural height.
  void _cacheAspectRatio(int index, String url) {
    if (_aspectRatios.containsKey(index)) return;
    // Mark as in-flight so a rebuild before decode doesn't attach a second
    // listener; replaced by the real ratio once it lands.
    _aspectRatios[index] = 0;
    final stream = CachedNetworkImageProvider(
      url,
    ).resolve(const ImageConfiguration());
    late final ImageStreamListener listener;
    listener = ImageStreamListener(
      (info, _) {
        stream.removeListener(listener);
        if (!mounted) return;
        final ratio = info.image.width / info.image.height;
        if (ratio <= 0 || !ratio.isFinite) return;
        setState(() => _aspectRatios[index] = ratio);
      },
      onError: (_, __) => stream.removeListener(listener),
    );
    stream.addListener(listener);
  }

  Widget _buildGallery(bool isActive) {
    final urls = ProductInfo.gallery(widget.product);
    if (urls.isEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: SizedBox(height: _defaultGalleryHeight, child: _fallback()),
      );
    }

    final width = MediaQuery.sizeOf(context).width - 32;
    for (var i = 0; i < urls.length; i++) {
      _cacheAspectRatio(i, urls[i]);
    }

    return Stack(
      alignment: Alignment.bottomCenter,
      children: [
        ValueListenableBuilder<int>(
          valueListenable: _currentImageIndex,
          builder: (_, currentIndex, child) {
            final ratio = _aspectRatios[currentIndex];
            return AnimatedContainer(
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              height: ratio == null || ratio == 0
                  ? _defaultGalleryHeight
                  : _galleryHeight(currentIndex, width),
              child: child,
            );
          },
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(color: AppColors.surfaceBg),
                PageView.builder(
                  controller: _pageController,
                  itemCount: urls.length,
                  onPageChanged: (i) => _currentImageIndex.value = i,
                  itemBuilder: (_, i) => CachedNetworkImage(
                    imageUrl: urls[i],
                    // The box already matches this image's ratio, so `contain`
                    // fills it edge to edge; only clamped extremes letterbox.
                    fit: BoxFit.contain,
                    memCacheWidth: 800,
                    fadeInDuration: const Duration(milliseconds: 300),
                    placeholder: (_, __) =>
                        Container(color: AppColors.surfaceBg),
                    errorWidget: (_, __, ___) => _fallback(),
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
                          ? AppColors.primary
                          : Colors.white.withValues(alpha: 0.75),
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

  Widget _fallback() {
    return Container(
      color: AppColors.primaryLight,
      child: const Center(
        child: Icon(
          Icons.local_grocery_store_rounded,
          color: AppColors.primary,
          size: 64,
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String text;
  const _Tag({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surfaceBg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: AppType.small.copyWith(color: AppColors.textSecondary),
      ),
    );
  }
}

/// One row per delivery mode: its price for this product and whether that
/// mode is taking orders now, from the same status the add buttons use.
class _DeliveryOptions extends StatelessWidget {
  final Map<String, dynamic> product;

  const _DeliveryOptions({required this.product});

  @override
  Widget build(BuildContext context) {
    final scheduled = DeliveryModeStatus.scheduled(
      context.watch<CartProvider>(),
    );
    final instant = DeliveryModeStatus.instant(
      context.watch<InstantProvider>(),
    );

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _OptionRow(
            icon: Icons.event_repeat_rounded,
            color: AppColors.primary,
            title: 'Scheduled delivery',
            offered: ProductInfo.offersScheduled(product),
            price: ProductInfo.scheduledPrice(product),
            status: scheduled,
          ),
          const Divider(height: 1, color: AppColors.divider),
          _OptionRow(
            icon: Icons.bolt_rounded,
            color: InstantColors.primary,
            title: 'Instant delivery',
            offered: ProductInfo.offersInstant(product),
            price: ProductInfo.instantPrice(product),
            status: instant,
          ),
        ],
      ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final bool offered;
  final double? price;
  final DeliveryModeStatus status;

  const _OptionRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.offered,
    required this.price,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    final Color dot;
    switch (status.tone) {
      case DeliveryModeTone.ok:
        dot = AppColors.success;
      case DeliveryModeTone.warn:
        dot = const Color(0xFFF59E0B);
      case DeliveryModeTone.off:
        dot = AppColors.textHint;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: (offered ? color : AppColors.textHint).withValues(
                alpha: 0.1,
              ),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(
              icon,
              size: 19,
              color: offered ? color : AppColors.textHint,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppType.captionBold.copyWith(
                    color: offered
                        ? AppColors.textPrimary
                        : AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                if (!offered)
                  Text(
                    'Not offered for this product',
                    style: AppType.small.copyWith(color: AppColors.textHint),
                  )
                else
                  Row(
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: dot,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          '${status.title} · ${status.detail}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.small.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            offered ? ProductInfo.formatPrice(price) : '—',
            style: AppType.bodyBold.copyWith(
              color: offered ? color : AppColors.textHint,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
