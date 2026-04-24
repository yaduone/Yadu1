import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _currentPage = 0;

  static const _pages = [
    _OnboardingPage(
      icon: Icons.water_drop_rounded,
      title: 'Pure Milk, Daily',
      subtitle:
          'Farm-fresh cow & buffalo milk\ndelivered to your doorstep every morning.',
      quote: '"The first glass of the morning sets the tone for the day."',
      attribution: '— A WELLNESS THOUGHT',
    ),
    _OnboardingPage(
      icon: Icons.verified_rounded,
      title: '100% Authentic',
      subtitle:
          'Quality tested & FSSAI approved.\nNo additives, no preservatives.',
      quote: '"Trust is earned one delivery at a time."',
      attribution: '— YADUONE PROMISE',
    ),
    _OnboardingPage(
      icon: Icons.local_shipping_rounded,
      title: 'Delivered Fresh',
      subtitle:
          'From farm to your door in under 12 hours.\nChoose your delivery slot.',
      quote:
          '"Freshness is not a feature — it\'s a way of life."',
      attribution: '— FARM WISDOM',
    ),
  ];

  void _skip() {
    Navigator.pushReplacementNamed(context, '/');
  }

  void _next() {
    if (_currentPage == _pages.length - 1) {
      _skip();
    } else {
      _controller.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: Column(
          children: [
            // Skip button
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 12, right: 20),
                child: TextButton(
                  onPressed: _skip,
                  child: Text(
                    'Skip',
                    style: AppType.caption.copyWith(color: AppColors.textHint),
                  ),
                ),
              ),
            ),

            // PageView
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) => setState(() => _currentPage = i),
                itemBuilder: (_, i) {
                  final page = _pages[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Icon circle — large, gradient-tinted
                        Container(
                          width: 140,
                          height: 140,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                AppColors.primaryLight,
                                AppColors.primary.withValues(alpha: 0.15),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color:
                                    AppColors.primary.withValues(alpha: 0.12),
                                blurRadius: 32,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Icon(page.icon,
                              size: 64, color: AppColors.primary),
                        ),
                        const SizedBox(height: 44),
                        Text(
                          page.title,
                          textAlign: TextAlign.center,
                          style: AppType.display,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          page.subtitle,
                          textAlign: TextAlign.center,
                          style: AppType.body.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.6,
                          ),
                        ),
                        const SizedBox(height: 36),
                        // Quote card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 24),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceBg,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Column(
                            children: [
                              Icon(Icons.format_quote_rounded,
                                  size: 28,
                                  color: AppColors.primary
                                      .withValues(alpha: 0.5)),
                              const SizedBox(height: 10),
                              Text(
                                page.quote,
                                textAlign: TextAlign.center,
                                style: AppType.caption.copyWith(
                                  fontStyle: FontStyle.italic,
                                  color: AppColors.textSecondary,
                                  height: 1.6,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                page.attribution,
                                style: AppType.micro.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Page indicators
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                _pages.length,
                (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: _currentPage == i ? 28 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: _currentPage == i
                        ? AppColors.primary
                        : AppColors.border,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 28),

            // Trust badges row on last page
            if (_currentPage == _pages.length - 1) ...[
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 28),
                child: TrustBadgeRow(),
              ),
              const SizedBox(height: 16),
            ],

            // CTA Button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _next,
                  child: Text(
                    _currentPage == _pages.length - 1
                        ? 'Get Started'
                        : 'Next',
                    style: AppType.button.copyWith(color: Colors.white),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _OnboardingPage {
  final IconData icon;
  final String title;
  final String subtitle;
  final String quote;
  final String attribution;

  const _OnboardingPage({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.quote,
    required this.attribution,
  });
}
