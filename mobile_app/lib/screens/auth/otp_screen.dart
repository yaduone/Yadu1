import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:pinput/pinput.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/app_snackbar.dart';
import '../../providers/auth_provider.dart';
import 'widgets/auth_image_carousel.dart';
import '../../main.dart' show AuthGate;

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen>
    with SingleTickerProviderStateMixin {
  final _pinController = TextEditingController();
  final _pinFocusNode = FocusNode();

  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  int _resendSeconds = 60;
  Timer? _resendTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnimation =
        CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.18),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _controller.forward();
    _startResendTimer();

    // Auto-focus the pin field after animation settles
    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) _pinFocusNode.requestFocus();
    });
  }

  void _startResendTimer() {
    _resendSeconds = 60;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_resendSeconds <= 1) t.cancel();
      if (mounted) setState(() => _resendSeconds--);
    });
  }

  Future<void> _handleResend() async {
    final auth = context.read<AppAuthProvider>();
    await auth.resendOtp();
    if (mounted && auth.error == null) {
      _startResendTimer();
      _pinController.clear();
    }
  }

  @override
  void dispose() {
    _pinController.dispose();
    _pinFocusNode.dispose();
    _controller.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AppAuthProvider>();
    final mq = MediaQuery.of(context);
    final screenH = mq.size.height;
    final carouselH = screenH * 0.52;
    final keyboardH = mq.viewInsets.bottom;

    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // ── Full-bleed carousel ──────────────────────────────────────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: AuthImageCarousel(height: carouselH),
          ),

          // ── Floating OTP card — rises with keyboard ──────────────────────
          AnimatedPositioned(
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOutCubic,
            left: 20,
            right: 20,
            bottom: 24 + keyboardH,
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: SlideTransition(
                position: _slideAnimation,
                child: _OtpCard(
                  pinController: _pinController,
                  pinFocusNode: _pinFocusNode,
                  auth: auth,
                  resendSeconds: _resendSeconds,
                  onResend: _handleResend,
                  onProceed: _handleVerify,
                  onCompleted: _handleVerify,
                ),
              ),
            ),
          ),

          // ── Back button overlay ──────────────────────────────────────────
          Positioned(
            top: mq.padding.top + 8,
            left: 16,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => Navigator.pop(context),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.10),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.arrow_back_ios_new,
                    size: 16,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleVerify() async {
    final auth = context.read<AppAuthProvider>();
    final otp = _pinController.text.trim();

    if (otp.length < 6) {
      AppSnackbar.warning(context, 'Please enter the complete 6-digit OTP.');
      return;
    }

    HapticFeedback.mediumImpact();
    final success = await auth.verifyOtp(otp);
    if (!mounted) return;

    if (success) {
      HapticFeedback.heavyImpact();
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const AuthGate()),
        (route) => false,
      );
    }
  }
}

// ── OTP Card ──────────────────────────────────────────────────────────────────

class _OtpCard extends StatelessWidget {
  final TextEditingController pinController;
  final FocusNode pinFocusNode;
  final AppAuthProvider auth;
  final int resendSeconds;
  final Future<void> Function() onResend;
  final Future<void> Function() onProceed;
  final Future<void> Function() onCompleted;

  const _OtpCard({
    required this.pinController,
    required this.pinFocusNode,
    required this.auth,
    required this.resendSeconds,
    required this.onResend,
    required this.onProceed,
    required this.onCompleted,
  });

  @override
  Widget build(BuildContext context) {
    final defaultTheme = PinTheme(
      width: 48,
      height: 56,
      textStyle: AppType.h2.copyWith(color: AppColors.textPrimary),
      decoration: BoxDecoration(
        color: AppColors.surfaceBg,
        borderRadius: BorderRadius.circular(14),
      ),
    );

    final focusedTheme = defaultTheme.copyWith(
      decoration: BoxDecoration(
        color: AppColors.surfaceBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary, width: 2),
      ),
    );

    final submittedTheme = defaultTheme.copyWith(
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(14),
      ),
    );

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.10),
            blurRadius: 40,
            spreadRadius: 0,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.06),
            blurRadius: 20,
            spreadRadius: 0,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // ── Drag handle ────────────────────────────────────────────
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // ── Header ─────────────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.sms_rounded,
                        color: AppColors.primary, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Verify your number', style: AppType.h3),
                      Text(
                        'Enter the OTP sent to your phone',
                        style: AppType.small
                            .copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 22),

              // ── OTP label + resend ──────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Enter OTP', style: AppType.captionBold),
                  GestureDetector(
                    onTap: resendSeconds <= 0 ? onResend : null,
                    child: Text(
                      resendSeconds > 0
                          ? 'Resend in ${resendSeconds}s'
                          : 'Resend OTP',
                      style: AppType.small.copyWith(
                        color: resendSeconds > 0
                            ? AppColors.textHint
                            : AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              Pinput(
                controller: pinController,
                focusNode: pinFocusNode,
                length: 6,
                defaultPinTheme: defaultTheme,
                focusedPinTheme: focusedTheme,
                submittedPinTheme: submittedTheme,
                separatorBuilder: (_) => const SizedBox(width: 6),
                onCompleted: (_) => onCompleted(),
                keyboardType: TextInputType.number,
              ),

              if (auth.error != null) ...[
                const SizedBox(height: 12),
                InlineErrorBanner(message: auth.error!),
              ],

              const SizedBox(height: 20),

              // ── Verify button ───────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: auth.isLoading ? null : onProceed,
                  child: auth.isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2.5,
                          ),
                        )
                      : Text('Verify & Proceed',
                          style:
                              AppType.button.copyWith(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
