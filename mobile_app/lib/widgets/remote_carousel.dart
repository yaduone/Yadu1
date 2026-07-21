import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:carousel_slider/carousel_slider.dart';
import '../services/api_service.dart';

/// A carousel whose slides are configured from the admin panel.
///
/// Fetches active slides for [location] from `/carousels/app`. Until they load
/// (or if none are configured / the request fails) it shows [fallbackAssets] so
/// the screen is never blank.
///
/// [location] is one of: home_scheduled, home_instant, livestream.
class RemoteCarousel extends StatefulWidget {
  final String location;
  final List<String> fallbackAssets;

  /// Slide height is `maxWidth / heightDivisor` (e.g. 2.0 → 2:1 aspect ratio).
  final double heightDivisor;
  final double borderRadius;
  final Color dotColor;
  final BoxFit fit;
  final EdgeInsetsGeometry padding;

  const RemoteCarousel({
    super.key,
    required this.location,
    required this.fallbackAssets,
    required this.dotColor,
    this.heightDivisor = 2.0,
    this.borderRadius = 14,
    this.fit = BoxFit.cover,
    this.padding = EdgeInsets.zero,
  });

  @override
  State<RemoteCarousel> createState() => _RemoteCarouselState();
}

class _RemoteCarouselState extends State<RemoteCarousel> {
  final ApiService _api = ApiService();
  List<String> _urls = const [];
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.get('/carousels/app?location=${widget.location}');
      final slides = (res['data']?['slides'] as List?) ?? const [];
      final urls = slides
          .map((s) => (s['image_url'] as String?) ?? '')
          .where((u) => u.isNotEmpty)
          .toList();
      if (mounted && urls.isNotEmpty) setState(() => _urls = urls);
    } catch (_) {
      // Keep fallback assets on any failure.
    }
  }

  @override
  Widget build(BuildContext context) {
    final useNetwork = _urls.isNotEmpty;
    final items = useNetwork ? _urls : widget.fallbackAssets;
    if (items.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: widget.padding,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final height = constraints.maxWidth / widget.heightDivisor;
          return Column(
            children: [
              CarouselSlider(
                options: CarouselOptions(
                  height: height,
                  viewportFraction: 1.0,
                  autoPlay: items.length > 1,
                  autoPlayInterval: const Duration(seconds: 3),
                  autoPlayCurve: Curves.easeInOut,
                  autoPlayAnimationDuration: const Duration(milliseconds: 350),
                  enableInfiniteScroll: items.length > 1,
                  onPageChanged: (i, _) => setState(() => _index = i),
                ),
                items: items.map((src) {
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(widget.borderRadius),
                    child: useNetwork
                        ? CachedNetworkImage(
                            imageUrl: src,
                            width: double.infinity,
                            fit: widget.fit,
                            placeholder: (c, _) => Container(color: Colors.black12),
                            errorWidget: (c, _, __) => Container(color: Colors.black12),
                          )
                        : Image.asset(
                            src,
                            width: double.infinity,
                            fit: widget.fit,
                            cacheWidth: 700,
                          ),
                  );
                }).toList(),
              ),
              if (items.length > 1) ...[
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(items.length, (i) {
                    final active = i == _index;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: active ? 18 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: active
                            ? widget.dotColor
                            : widget.dotColor.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    );
                  }),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
