import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:shared_preferences/shared_preferences.dart';

import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../auth/login_screen.dart';
import '../../main.dart' show AuthGate;

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _ctrl;

  // In animations
  late final Animation<double> _logoFade;
  late final Animation<double> _logoScale;
  late final Animation<double> _taglineFade;
  late final Animation<Offset> _taglineSlide;
  late final Animation<double> _progressFade;

  // Spinning loader
  late final AnimationController _spinCtrl;
  late final Animation<double> _spinAngle;
  late final Animation<double> _spinPulse;

  // Out animation (fade entire screen to white)
  late final AnimationController _exitCtrl;
  late final Animation<double> _exitFade;

  String _statusText = 'Initialising…';
  double _progress = 0.0;

  static const _minSplashMs = 2400;

  @override
  void initState() {
    super.initState();
    _buildAnimations();
    _ctrl.forward();
    _runLoading();
  }

  void _buildAnimations() {
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _logoFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
          parent: _ctrl,
          curve: const Interval(0.0, 0.45, curve: Curves.easeOut)),
    );
    _logoScale = Tween<double>(begin: 0.55, end: 1.0).animate(
      CurvedAnimation(
          parent: _ctrl,
          curve: const Interval(0.0, 0.55, curve: Curves.easeOutBack)),
    );
    _taglineFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
          parent: _ctrl,
          curve: const Interval(0.45, 0.75, curve: Curves.easeOut)),
    );
    _taglineSlide = Tween<Offset>(
      begin: const Offset(0, 0.35),
      end: Offset.zero,
    ).animate(CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.45, 0.75, curve: Curves.easeOut)));
    _progressFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
          parent: _ctrl,
          curve: const Interval(0.65, 0.90, curve: Curves.easeOut)),
    );

    _spinCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
    _spinAngle = Tween<double>(begin: 0.0, end: 2 * math.pi).animate(
      CurvedAnimation(parent: _spinCtrl, curve: Curves.easeInOut),
    );
    _spinPulse = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.7, end: 1.0), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.7), weight: 50),
    ]).animate(CurvedAnimation(parent: _spinCtrl, curve: Curves.easeInOut));

    _exitCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _exitFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _exitCtrl, curve: Curves.easeIn),
    );
  }

  Future<void> _runLoading() async {
    final stopwatch = Stopwatch()..start();

    _setStatus('Loading preferences…', 0.15);
    final prefsTask = SharedPreferences.getInstance();

    _setStatus('Checking session…', 0.35);
    final authTask = fb_auth.FirebaseAuth.instance.authStateChanges().first;

    final results = await Future.wait([prefsTask, authTask]);
    final prefs = results[0] as SharedPreferences;
    final user = results[1] as fb_auth.User?;

    _setStatus('Loading account data…', 0.60);
    prefs.getString('cached_user_name');
    prefs.getString('cached_subscription_status');

    _setStatus('Almost ready…', 0.85);

    final elapsed = stopwatch.elapsedMilliseconds;
    if (elapsed < _minSplashMs) {
      await Future.delayed(Duration(milliseconds: _minSplashMs - elapsed));
    }

    _setStatus('Done!', 1.0);
    await Future.delayed(const Duration(milliseconds: 200));

    // Play exit fade-out before navigating
    await _exitCtrl.forward();

    if (!mounted) return;

    final Widget destination =
        user == null ? const LoginScreen() : const AuthGate();

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => destination,
        transitionsBuilder: (_, animation, __, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 400),
      ),
    );
  }

  void _setStatus(String text, double progress) {

    if (!mounted) return;
    setState(() {
      _statusText = text;
      _progress = progress;
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _spinCtrl.dispose();
    _exitCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: AnimatedBuilder(
        animation: _exitFade,
        builder: (context, child) => Stack(
          children: [
            child!,
            // White overlay that fades in as exit animation
            if (_exitFade.value > 0)
              Positioned.fill(
                child: IgnorePointer(
                  child: Opacity(
                    opacity: _exitFade.value,
                    child: const ColoredBox(color: Colors.white),
                  ),
                ),
              ),
          ],
        ),
        child: Stack(
          children: [
            // Radial glow behind logo
            Positioned(
              top: size.height * 0.22,
              left: size.width / 2 - 120,
              child: Container(
                width: 240,
                height: 240,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.10),
                      AppColors.primary.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),

            SizedBox.expand(
              child: SafeArea(
                child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Spacer(flex: 3),

                  // Logo image with scale + fade in
                  FadeTransition(
                    opacity: _logoFade,
                    child: ScaleTransition(
                      scale: _logoScale,
                      child: Image.asset(
                        'assets/images/image.png',
                        width: 140,
                        height: 140,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // App name
                  FadeTransition(
                    opacity: _logoFade,
                    child: Text(
                      'YaduONE',
                      style: AppType.h1.copyWith(
                        color: AppColors.textPrimary,
                        letterSpacing: -0.5,
                        fontSize: 32,
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Tagline
                  FadeTransition(
                    opacity: _taglineFade,
                    child: SlideTransition(
                      position: _taglineSlide,
                      child: Text(
                        'Soch nayi, sanskaar wahi',
                        style: AppType.body.copyWith(
                          color: AppColors.textSecondary,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),

                  const Spacer(flex: 3),

                  // Progress section
                  FadeTransition(
                    opacity: _progressFade,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        AnimatedBuilder(
                          animation: _spinCtrl,
                          builder: (context, _) => Transform.scale(
                            scale: _spinPulse.value,
                            child: Transform.rotate(
                              angle: _spinAngle.value,
                              child: CustomPaint(
                                size: const Size(48, 48),
                                painter: _ArcSpinnerPainter(
                                  color: AppColors.primary,
                                  progress: _progress,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 300),
                          child: Text(
                            _statusText,
                            key: ValueKey(_statusText),
                            style: AppType.small
                                .copyWith(color: AppColors.textSecondary),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 48),

                  FadeTransition(
                    opacity: _progressFade,
                    child: Text(
                      'v1.0.0',
                      style: AppType.small.copyWith(
                        color: AppColors.textHint,
                        fontSize: 11,
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),
                ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArcSpinnerPainter extends CustomPainter {
  final Color color;
  final double progress;

  _ArcSpinnerPainter({required this.color, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 4;

    // Track circle
    final trackPaint = Paint()
      ..color = color.withValues(alpha: 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, trackPaint);

    // Arc — sweeps from 20% up to full based on progress
    final sweepAngle = (0.2 + 0.8 * progress) * 2 * math.pi;
    final arcPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      sweepAngle,
      false,
      arcPaint,
    );
  }

  @override
  bool shouldRepaint(_ArcSpinnerPainter old) =>
      old.progress != progress || old.color != color;
}
