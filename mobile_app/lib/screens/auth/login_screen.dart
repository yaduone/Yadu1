import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/tappable.dart';
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

  bool? _backendOnline; // null = checking, true = online, false = offline

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
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.25),
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

    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: Colors.white,
      body: Column(
        children: [
          // Image carousel — square images, height = screen width
          AuthImageCarousel(
            height: MediaQuery.of(context).size.width,
          ),

          // Login panel — scrollable so keyboard doesn't cover it
          Expanded(
            child: SingleChildScrollView(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: SlideTransition(
                  position: _slideAnimation,
                  child: _LoginPanel(
                    phoneController: _phoneController,
                    countryCode: _countryCode,
                    auth: auth,
                    onSendOtp: _handleSendOtp,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),

      // Backend status dot — bottom right
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 4, right: 4),
        child: Tooltip(
          message: _backendOnline == null
              ? 'Checking server...'
              : _backendOnline!
                  ? 'Server online'
                  : 'Server offline',
          child: Container(
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
                  color: (_backendOnline == true ? Colors.green : Colors.red)
                      .withValues(alpha: 0.5),
                  blurRadius: 6,
                  spreadRadius: 1,
                ),
              ],
            ),
          ),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }

  Future<void> _handleSendOtp() async {
    final auth = context.read<AppAuthProvider>();
    if (_phoneController.text.trim().length != 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Enter a valid 10-digit number'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final phone = '$_countryCode${_phoneController.text.trim()}';
    await auth.sendOtp(phone);

    if (auth.error == null && mounted) {
      Navigator.push(
        context,
        SlideUpRoute(page: const OtpScreen()),
      );
    }
  }
}

class _LoginPanel extends StatelessWidget {
  final TextEditingController phoneController;
  final String countryCode;
  final AppAuthProvider auth;
  final Future<void> Function() onSendOtp;

  const _LoginPanel({
    required this.phoneController,
    required this.countryCode,
    required this.auth,
    required this.onSendOtp,
  });

  @override
  Widget build(BuildContext context) {
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

              // Phone label
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Phone Number',
                  style: AppType.captionBold,
                ),
              ),
              const SizedBox(height: 10),

              // Phone input row
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
                        style: AppType.bodyBold.copyWith(letterSpacing: 1.2),
                        decoration: InputDecoration(
                          hintText: 'XXXXXXXXXX',
                          counterText: '',
                          filled: true,
                          fillColor: AppColors.surfaceBg,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 16,
                          ),
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
                              color: AppColors.primary,
                              width: 1.5,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              if (auth.error != null) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.error.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        size: 18,
                        color: AppColors.error,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          auth.error!,
                          style: AppType.micro.copyWith(
                            color: AppColors.error,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 12),

              // Send OTP button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: auth.isLoading ? null : onSendOtp,
                  child: auth.isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2.5,
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('Send OTP', style: AppType.button.copyWith(color: Colors.white)),
                            const SizedBox(width: 8),
                            const Icon(Icons.arrow_forward_rounded, size: 20),
                          ],
                        ),
                ),
              ),

              const SizedBox(height: 10),

              // Trust badge
              const TrustBadge(
                icon: Icons.lock_rounded,
                label: 'Encrypted OTP',
              ),

              const SizedBox(height: 16),

              // Legal links
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
                    onTap: () => Navigator.push(
                      context,
                      SlideUpRoute(page: const TermsScreen()),
                    ),
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
                    onTap: () => Navigator.push(
                      context,
                      SlideUpRoute(page: const PrivacyPolicyScreen()),
                    ),
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
    );
  }
}
