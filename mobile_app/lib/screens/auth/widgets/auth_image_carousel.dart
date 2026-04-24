import 'package:flutter/material.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../../theme/app_theme.dart';

class AuthImageCarousel extends StatefulWidget {
  final double height;

  const AuthImageCarousel({super.key, this.height = 0});

  static const List<String> _images = [
    'assets/images/corousel/1.png',
    'assets/images/corousel/2.png',
    'assets/images/corousel/3.png',
    'assets/images/corousel/4.png',
    'assets/images/corousel/5.png',
    'assets/images/corousel/6.png',
  ];

  @override
  State<AuthImageCarousel> createState() => _AuthImageCarouselState();
}

class _AuthImageCarouselState extends State<AuthImageCarousel>
    with SingleTickerProviderStateMixin {
  int _current = 0;

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
    // Square images — use screen width so image fills without cropping
    final screenWidth = MediaQuery.of(context).size.width;
    final h = widget.height > 0 ? widget.height : screenWidth;

    return SizedBox(
      height: h,
      width: screenWidth,
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
              autoPlayAnimationDuration: const Duration(milliseconds: 800),
              autoPlayCurve: Curves.easeInOut,
              onPageChanged: (index, _) => setState(() => _current = index),
            ),
            items: AuthImageCarousel._images.map((path) {
              return SizedBox(
                width: double.infinity,
                height: h,
                child: AnimatedBuilder(
                  animation: _panCtrl,
                  builder: (context, child) {
                    final offsetX = (_panCtrl.value - 0.5) * 20;
                    final scale = 1.02 + (_panCtrl.value * 0.03);
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
                ),
              );
            }).toList(),
          ),

          // Dot indicator at the bottom of the image area
          Positioned(
            left: 0,
            right: 0,
            bottom: 12,
            child: Center(
              child: AnimatedSmoothIndicator(
                activeIndex: _current,
                count: AuthImageCarousel._images.length,
                effect: ExpandingDotsEffect(
                  activeDotColor: AppColors.primary,
                  dotColor: Colors.white.withValues(alpha: 0.7),
                  dotHeight: 7,
                  dotWidth: 7,
                  expansionFactor: 3,
                  spacing: 5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
