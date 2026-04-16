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

class _AuthImageCarouselState extends State<AuthImageCarousel> {
  int _current = 0;

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
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppColors.primaryLight, Color(0xFFB8DFF5)],
                  ),
                ),
              ),

              CarouselSlider(
                options: CarouselOptions(
                  height: h,
                  viewportFraction: 1.0,
                  autoPlay: true,
                  autoPlayInterval: const Duration(seconds: 4),
                  autoPlayAnimationDuration: const Duration(milliseconds: 700),
                  autoPlayCurve: Curves.easeInOut,
                  onPageChanged: (index, _) =>
                      setState(() => _current = index),
                ),
                items: AuthImageCarousel._images.map((path) {
                  return SizedBox.expand(
                    child: Image.asset(
                      path,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => Container(
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
                  );
                }).toList(),
              ),

              // Dot indicator
              Positioned(
                left: 0,
                right: 0,
                bottom: 24,
                child: Center(
                  child: AnimatedSmoothIndicator(
                    activeIndex: _current,
                    count: AuthImageCarousel._images.length,
                    effect: const ExpandingDotsEffect(
                      activeDotColor: AppColors.primary,
                      dotColor: Colors.white,
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
