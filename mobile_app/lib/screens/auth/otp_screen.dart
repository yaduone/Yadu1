import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:pinput/pinput.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/app_snackbar.dart';
import '../../providers/auth_provider.dart';
import 'widgets/auth_image_carousel.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen>
    with SingleTickerProviderStateMixin {
  final _pinController = TextEditingController();

  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  // Resend countdown
  int _resendSeconds = 60;
  Timer? _resendTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeAnimation =
        CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.25),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _controller.forward();

    _startResendTimer();
  }

  void _startResendTimer() {
    _resendSeconds = 60;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_resendSeconds <= 1) {
        t.cancel();
      }
      if (mounted) setState(() => _resendSeconds--);
    });
  }

  @override
  void dispose() {
    _pinController.dispose();
    _controller.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AppAuthProvider>();

    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          Column(
            children: [
              // Image carousel — square images, height = screen width
              AuthImageCarousel(
                height: MediaQuery.of(context).size.width,
              ),

              // OTP panel — scrollable
              Expanded(
                child: SingleChildScrollView(
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: SlideTransition(
                      position: _slideAnimation,
                      child: _OtpPanel(
                        pinController: _pinController,
                        auth: auth,
                        resendSeconds: _resendSeconds,
                        onResend: _startResendTimer,
                        onProceed: _handleVerify,
                        onCompleted: _handleVerify,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),

          // Back button overlay
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
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
                        color: Colors.black.withValues(alpha: 0.08),
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
      Navigator.popUntil(context, (route) => route.isFirst);
    }
    // error shown inline via InlineErrorBanner in _OtpPanel
  }
}

class _OtpPanel extends StatelessWidget {
  final TextEditingController pinController;
  final AppAuthProvider auth;
  final int resendSeconds;
  final VoidCallback onResend;
  final Future<void> Function() onProceed;
  final Future<void> Function() onCompleted;

  const _OtpPanel({
    required this.pinController,
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

    return GlassContainer(
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(26, 16, 26, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Logo
              Container(
                width: 64,
                height: 64,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.asset(
                    'assets/images/image.png',
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [AppColors.primary, AppColors.primaryDark],
                          ),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.local_drink_rounded,
                          color: Colors.white,
                          size: 28,
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text('YaduONE', style: AppType.h1.copyWith(letterSpacing: -0.5)),
              const SizedBox(height: 2),
              Text(
                'Soch nayi sanskaar wahi',
                style: AppType.small.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),

              // Label row: "Enter OTP" + "Resend OTP" with countdown
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
                length: 6,
                defaultPinTheme: defaultTheme,
                focusedPinTheme: focusedTheme,
                submittedPinTheme: submittedTheme,
                separatorBuilder: (_) => const SizedBox(width: 6),
                onCompleted: (_) => onCompleted(),
              ),

              if (auth.error != null) ...[
                const SizedBox(height: 14),
                InlineErrorBanner(message: auth.error!),
              ],

              const SizedBox(height: 22),

              SizedBox(
                width: double.infinity,
                height: 56,
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
                          style: AppType.button.copyWith(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
