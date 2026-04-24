import 'package:flutter/material.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../../theme/app_theme.dart';

/// Auto-sliding image carousel used on the Login & OTP screens.
///
/// Sized by its parent (use Positioned.fill or a SizedBox).
/// Add more entries to [_images] as new artwork is dropped in `assets/images/`.
class AuthImageCarousel extends StatefulWidget {
  // ignore: unused_element
  final double height; // kept for API compatibility; sizing is driven by parent

  const AuthImageCarousel({super.key, this.height = 0});

  // TODO: replace with real brand/product imagery when available.
  static const List<String> _images = [
    'assets/images/ghee.jpg',
    'assets/images/ghee.jpg',
    'assets/images/ghee.jpg',
  ];

  @override
  State<AuthImageCarousel> createState() => _AuthImageCarouselState();
}

class _AuthImageCarouselState extends State<AuthImageCarousel>
    with SingleTickerProviderStateMixin {
  int _current = 0;

  // Slow-pan animation controller
  late AnimationController _panCtrl;

  @override
  void initState() {
    super.initState();
    _panCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 20),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _panCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final h = constraints.maxHeight.isInfinite
            ? MediaQuery.of(context).size.height
            : constraints.maxHeight;

        return SizedBox(
          height: h,
          width: double.infinity,
          child: Stack(
            children: [
              // Fallback background
              Container(
                width: double.infinity,
                height: h,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppColors.primaryLight, const Color(0xFFB8DFF5)],
                  ),
                ),
              ),

              CarouselSlider(
                options: CarouselOptions(
                  height: h,
                  viewportFraction: 1.0,
                  autoPlay: true,
                  autoPlayInterval: const Duration(seconds: 5),
                  autoPlayAnimationDuration:
                      const Duration(milliseconds: 800),
                  autoPlayCurve: Curves.easeInOut,
                  onPageChanged: (index, _) =>
                      setState(() => _current = index),
                ),
                items: AuthImageCarousel._images.map((path) {
                  return SizedBox.expand(
                    // Slow-pan animation: gently shifts the image
                    child: AnimatedBuilder(
                      animation: _panCtrl,
                      builder: (context, child) {
                        final offsetX = (_panCtrl.value - 0.5) * 30;
                        final scale = 1.05 + (_panCtrl.value * 0.05);
                        return Transform(
                          alignment: Alignment.center,
                          // ignore: deprecated_member_use
                          transform: Matrix4.identity()
                            ..translate(offsetX, 0.0)
                            ..scale(scale),
                          child: child,
                        );
                      },
                      child: Image.asset(
                        path,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) =>
                            Container(
                          color: AppColors.primaryLight,
                          child: const Center(
                            child: Icon(
                              Icons.local_drink_rounded,
                              size: 72,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              // Dot indicator — positioned higher so it doesn't conflict
              // with the glassmorphism panel below
              Positioned(
                left: 0,
                right: 0,
                bottom: h * 0.45, // Position dots near the center of visible image area
                child: Center(
                  child: AnimatedSmoothIndicator(
                    activeIndex: _current,
                    count: AuthImageCarousel._images.length,
                    effect: ExpandingDotsEffect(
                      activeDotColor: AppColors.primary,
                      dotColor: Colors.white.withValues(alpha: 0.7),
                      dotHeight: 8,
                      dotWidth: 8,
                      expansionFactor: 3,
                      spacing: 6,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
