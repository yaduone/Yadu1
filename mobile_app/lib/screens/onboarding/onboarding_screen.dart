import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';

import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../services/onboarding_service.dart';

/// A full-screen, swipeable onboarding intro shown on new registration.
///
/// Pages (image + headline + description) and their count are fully
/// admin-configurable via the backend `/onboarding` endpoints. When the user
/// finishes or skips, [onDone] is called and the intro is marked as seen.
class OnboardingScreen extends StatefulWidget {
  final List<OnboardingPage> pages;
  final VoidCallback onDone;

  const OnboardingScreen({
    super.key,
    required this.pages,
    required this.onDone,
  });

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _current = 0;

  bool get _isLastPage => _current >= widget.pages.length - 1;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _finish() => widget.onDone();

  void _next() {
    if (_isLastPage) {
      _finish();
    } else {
      _controller.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = widget.pages;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // ── Swipeable full-screen pages ────────────────────────────────
          PageView.builder(
            controller: _controller,
            itemCount: pages.length,
            onPageChanged: (i) => setState(() => _current = i),
            itemBuilder: (context, index) => _OnboardingPageView(page: pages[index]),
          ),

          // ── Skip button — always available to close the intro ──────────
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 8,
            child: TextButton.icon(
              onPressed: _finish,
              icon: Text(
                'Skip',
                style: AppType.small.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
              label: const Icon(Icons.close_rounded, size: 16, color: Colors.white),
              style: TextButton.styleFrom(
                foregroundColor: Colors.white,
                backgroundColor: Colors.black.withValues(alpha: 0.28),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              ),
            ),
          ),

          // ── Bottom controls: page dots + next / get started ────────────
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (pages.length > 1)
                      AnimatedSmoothIndicator(
                        activeIndex: _current,
                        count: pages.length,
                        effect: ExpandingDotsEffect(
                          activeDotColor: Colors.white,
                          dotColor: Colors.white.withValues(alpha: 0.4),
                          dotHeight: 8,
                          dotWidth: 8,
                          expansionFactor: 3,
                          spacing: 6,
                        ),
                      )
                    else
                      const SizedBox.shrink(),
                    _NextButton(
                      isLast: _isLastPage,
                      onTap: _next,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OnboardingPageView extends StatelessWidget {
  final OnboardingPage page;

  const _OnboardingPageView({required this.page});

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Full-bleed image
        CachedNetworkImage(
          imageUrl: page.imageUrl,
          fit: BoxFit.cover,
          placeholder: (context, _) => Container(
            color: AppColors.primaryLight,
            child: const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: AppColors.primary,
              ),
            ),
          ),
          errorWidget: (context, _, __) => Container(
            color: AppColors.primaryLight,
            child: const Center(
              child: Icon(Icons.image_not_supported_outlined,
                  size: 56, color: AppColors.primary),
            ),
          ),
        ),

        // Gradient scrim so text stays readable over any image
        if (page.headline.isNotEmpty || page.description.isNotEmpty)
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.center,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Color(0xCC000000)],
              ),
            ),
          ),

        // Headline + description near the bottom (leaves room for controls)
        Positioned(
          left: 24,
          right: 24,
          bottom: 96,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (page.headline.isNotEmpty)
                Text(
                  page.headline,
                  style: AppType.h1.copyWith(
                    color: Colors.white,
                    fontSize: 30,
                    height: 1.15,
                    letterSpacing: -0.5,
                  ),
                ),
              if (page.description.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  page.description,
                  style: AppType.body.copyWith(
                    color: Colors.white.withValues(alpha: 0.88),
                    height: 1.4,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _NextButton extends StatelessWidget {
  final bool isLast;
  final VoidCallback onTap;

  const _NextButton({required this.isLast, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: EdgeInsets.symmetric(
            horizontal: isLast ? 28 : 20,
            vertical: 16,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(30),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isLast ? 'Get Started' : 'Next',
              style: AppType.button.copyWith(color: Colors.white),
            ),
            const SizedBox(width: 8),
            Icon(
              isLast ? Icons.check_rounded : Icons.arrow_forward_rounded,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
