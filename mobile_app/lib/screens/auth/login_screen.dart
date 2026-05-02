import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/tappable.dart';
import '../../widgets/app_snackbar.dart';
import '../../utils/transitions.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';
import 'otp_screen.dart';
import 'widgets/auth_image_carousel.dart';
import '../legal/privacy_policy_screen.dart';
import '../legal/terms_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _phoneController = TextEditingController();
  final String _countryCode = '+91';

  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  bool? _backendOnline;

  Future<void> _checkBackend() async {
    try {
      final res = await http
          .get(Uri.parse('${AppConstants.apiBaseUrl}/health'))
          .timeout(const Duration(seconds: 5));
      if (mounted) setState(() => _backendOnline = res.statusCode == 200);
    } catch (_) {
      if (mounted) setState(() => _backendOnline = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _checkBackend();
    // Clear any stale error from a previous auth attempt.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppAuthProvider>().clearError();
    });
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
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _controller.dispose();
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
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // ── Full-bleed carousel (bleeds under status bar) ──
          Positioned(
            top: -mq.padding.top,
            left: 0,
            right: 0,
            child: AuthImageCarousel(height: carouselH + mq.padding.top),
          ),

          // ── Floating login card — rises with keyboard ──────────────────
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
                child: _LoginCard(
                  phoneController: _phoneController,
                  countryCode: _countryCode,
                  auth: auth,
                  onSendOtp: _handleSendOtp,
                ),
              ),
            ),
          ),

          // ── Server status dot ────────────────────────────────────────────
          Positioned(
            top: mq.padding.top + 12,
            right: 16,
            child: Tooltip(
              message: _backendOnline == null
                  ? 'Checking server…'
                  : _backendOnline!
                      ? 'Server online'
                      : 'Server offline',
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 400),
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _backendOnline == null
                      ? Colors.grey
                      : _backendOnline!
                          ? Colors.green
                          : Colors.red,
                  boxShadow: [
                    BoxShadow(
                      color: (_backendOnline == true
                              ? Colors.green
                              : Colors.red)
                          .withValues(alpha: 0.5),
                      blurRadius: 8,
                      spreadRadius: 2,
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

  Future<void> _handleSendOtp() async {
    final auth = context.read<AppAuthProvider>();
    final phone = _phoneController.text.trim();

    if (phone.isEmpty) {
      AppSnackbar.warning(context, 'Please enter your phone number.');
      return;
    }
    if (phone.length != 10 || !RegExp(r'^\d{10}$').hasMatch(phone)) {
      AppSnackbar.warning(context, 'Enter a valid 10-digit mobile number.');
      return;
    }

    await auth.sendOtp('$_countryCode$phone');

    if (!mounted) return;
    if (auth.error == null) {
      Navigator.push(context, SlideUpRoute(page: const OtpScreen()));
    }
  }
}

// ── Login Card ────────────────────────────────────────────────────────────────

class _LoginCard extends StatelessWidget {
  final TextEditingController phoneController;
  final String countryCode;
  final AppAuthProvider auth;
  final Future<void> Function() onSendOtp;

  const _LoginCard({
    required this.phoneController,
    required this.countryCode,
    required this.auth,
    required this.onSendOtp,
  });

  @override
  Widget build(BuildContext context) {
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
        child: SingleChildScrollView(
          physics: const NeverScrollableScrollPhysics(),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // ── Drag handle ──────────────────────────────────────────
                Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 18),
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // ── Logo + brand ─────────────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _LogoBadge(),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('YaduONE',
                            style: AppType.h2.copyWith(letterSpacing: -0.5)),
                        Text(
                          'Soch nayi sanskaar wahi',
                          style: AppType.small
                              .copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 22),

                // ── Phone label ──────────────────────────────────────────
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Phone Number', style: AppType.captionBold),
                ),
                const SizedBox(height: 10),

                // ── Phone input row ──────────────────────────────────────
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      height: 56,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceBg,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          const Text('🇮🇳', style: TextStyle(fontSize: 18)),
                          const SizedBox(width: 6),
                          Text('+91', style: AppType.bodyBold),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: TextField(
                          controller: phoneController,
                          keyboardType: TextInputType.phone,
                          maxLength: 10,
                          textInputAction: TextInputAction.done,
                          onSubmitted: (_) => onSendOtp(),
                          style:
                              AppType.bodyBold.copyWith(letterSpacing: 1.5),
                          decoration: InputDecoration(
                            hintText: 'XXXXXXXXXX',
                            counterText: '',
                            filled: true,
                            fillColor: AppColors.surfaceBg,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 16),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide.none,
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(
                                  color: AppColors.primary, width: 1.5),
                            ),
                            suffixIcon: ValueListenableBuilder(
                              valueListenable: phoneController,
                              builder: (_, value, __) {
                                if (value.text.isEmpty) {
                                  return const SizedBox.shrink();
                                }
                                return IconButton(
                                  icon: const Icon(Icons.clear_rounded,
                                      size: 18, color: AppColors.textHint),
                                  onPressed: () => phoneController.clear(),
                                );
                              },
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                if (auth.error != null) ...[
                  const SizedBox(height: 12),
                  InlineErrorBanner(message: auth.error!),
                ],

                const SizedBox(height: 16),

                // ── Send OTP button ──────────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton(
                    onPressed: auth.isLoading ? null : onSendOtp,
                    child: auth.isLoading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2.5),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('Send OTP',
                                  style: AppType.button
                                      .copyWith(color: Colors.white)),
                              const SizedBox(width: 8),
                              const Icon(Icons.arrow_forward_rounded,
                                  size: 20),
                            ],
                          ),
                  ),
                ),

                const SizedBox(height: 12),

                const TrustBadge(
                  icon: Icons.lock_rounded,
                  label: 'Encrypted OTP · 100% Secure',
                ),

                const SizedBox(height: 14),

                // ── Legal links ──────────────────────────────────────────
                Wrap(
                  alignment: WrapAlignment.center,
                  children: [
                    Text(
                      'By continuing, you agree to our ',
                      style: AppType.micro.copyWith(
                          color: AppColors.textHint,
                          fontWeight: FontWeight.w500),
                    ),
                    Tappable(
                      onTap: () => Navigator.push(context,
                          SlideUpRoute(page: const TermsScreen())),
                      haptic: HapticFeedbackType.selection,
                      child: Text(
                        'Terms',
                        style: AppType.micro.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text(
                      ' & ',
                      style: AppType.micro.copyWith(
                          color: AppColors.textHint,
                          fontWeight: FontWeight.w500),
                    ),
                    Tappable(
                      onTap: () => Navigator.push(context,
                          SlideUpRoute(page: const PrivacyPolicyScreen())),
                      haptic: HapticFeedbackType.selection,
                      child: Text(
                        'Privacy Policy',
                        style: AppType.micro.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Logo Badge ────────────────────────────────────────────────────────────────

class _LogoBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 64,
      height: 64,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.15),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.asset(
          'assets/images/image.png',
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.primaryDark],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.local_drink_rounded,
                  color: Colors.white, size: 26),
            );
          },
        ),
      ),
    );
  }
}
