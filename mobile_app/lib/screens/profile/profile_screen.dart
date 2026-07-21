import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/app_snackbar.dart';
import '../../providers/auth_provider.dart';
import '../../providers/subscription_provider.dart';
import '../../widgets/delivery_calendar.dart';
import '../../services/api_service.dart';
import '../legal/privacy_policy_screen.dart';
import '../legal/terms_screen.dart';
import '../support/help_support_screen.dart';
import '../auth/login_screen.dart';
import '../auth/complete_profile_screen.dart';
import 'edit_profile_screen.dart';
import 'delete_account_screen.dart';
import 'delivery_logs_screen.dart';
import '../../utils/transitions.dart';
import '../home/home_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _loggingOut = false;
  bool _updatingCallIn = false;

  void _showCallInDescription() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Call In'),
        content: const Text(
          'Call In tells the admin whether to call this user for confirmation of orders for the target date.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  Future<void> _setCallInEnabled(bool enabled) async {
    if (_updatingCallIn) return;

    setState(() => _updatingCallIn = true);
    try {
      await ApiService().put('/users/profile', {'call_in_enabled': enabled});

      if (!mounted) return;
      await context.read<AppAuthProvider>().loadProfile();

      if (!mounted) return;
      AppSnackbar.success(
        context,
        enabled ? 'Call In turned on' : 'Call In turned off',
      );
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.error(context, 'Failed to update Call In: ${e.toString()}');
    } finally {
      if (mounted) {
        setState(() => _updatingCallIn = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AppAuthProvider>();
    final sub = context.watch<SubscriptionProvider>();
    final user = auth.userData;
    final callInEnabled = user?['call_in_enabled'] != false;
    final isProfileComplete = auth.isProfileComplete;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          // Navigate to home tab (index 0)
          context.findAncestorStateOfType<HomeScreenState>()?.changeTab(0);
        }
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Stack(
          children: [
            Positioned.fill(
              child: Image.asset('assets/images/333.jpg', fit: BoxFit.cover),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.55),
                      Colors.black.withValues(alpha: 0.15),
                      Colors.transparent,
                    ],
                    stops: const [0.0, 0.35, 0.65],
                  ),
                ),
              ),
            ),
            SafeArea(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                children: [
                  const SizedBox(height: 20),

                  // Header
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Profile',
                          style: AppType.h1.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            shadows: [
                              Shadow(color: Colors.black54, blurRadius: 10),
                            ],
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const DeliveryLogsScreen(),
                          ),
                        ),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withValues(
                                  alpha: 0.08,
                                ),
                                blurRadius: 16,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.receipt_long_rounded,
                                size: 16,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'History',
                                style: AppType.captionBold.copyWith(
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Profile Card with StatefulAvatar
                  PremiumCard(
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.edit_rounded, size: 20),
                              color: AppColors.primary,
                              // Editing is only allowed once the profile is
                              // complete; disable it otherwise.
                              onPressed: isProfileComplete
                                  ? () => Navigator.push(
                                      context,
                                      SlideUpRoute(
                                        page: const EditProfileScreen(),
                                      ),
                                    )
                                  : null,
                            ),
                          ],
                        ),
                        StatefulAvatar(
                          name: user?['name'] ?? 'U',
                          isSubscriptionActive: sub.hasActiveSubscription,
                          size: 72,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          user?['name'] ?? 'User',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.h2,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          user?['phone'] ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.caption.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),

                        if (user?['area_name'] != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              user!['area_name'],
                              style: AppType.micro.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],

                        if (user?['address'] != null) ...[
                          const SizedBox(height: 16),
                          const Divider(),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceBg,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.location_on_outlined,
                                  size: 18,
                                  color: AppColors.primary,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${user!['address']['line1'] ?? ''}',
                                      overflow: TextOverflow.ellipsis,
                                      style: AppType.caption,
                                    ),
                                    if (user['address']['line2'] != null &&
                                        user['address']['line2']
                                            .toString()
                                            .isNotEmpty)
                                      Text(
                                        user['address']['line2'],
                                        style: AppType.small.copyWith(
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    Text(
                                      'Pincode: ${user['address']['pincode'] ?? ''}',
                                      style: AppType.small.copyWith(
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],

                        if (!isProfileComplete) ...[
                          const SizedBox(height: 16),
                          const Divider(),
                          const SizedBox(height: 12),
                          Text(
                            'Complete your profile to edit your details and unlock all features.',
                            textAlign: TextAlign.center,
                            style: AppType.small.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () => Navigator.push(
                                context,
                                SlideUpRoute(
                                  page: const CompleteProfileScreen(),
                                ),
                              ),
                              icon: const Icon(
                                Icons.person_add_rounded,
                                size: 18,
                              ),
                              label: const Text('Complete Profile'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                minimumSize: const Size(0, 48),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 28),

                  const SectionLabel(
                    'Order Confirmation',
                    color: Colors.white70,
                  ),
                  const SizedBox(height: 12),
                  PremiumCard(
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.phone_in_talk_outlined,
                            size: 18,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Row(
                            children: [
                              Flexible(
                                child: Text(
                                  'Call In',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppType.captionBold,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Tooltip(
                                message: 'What is Call In?',
                                child: IconButton(
                                  constraints: const BoxConstraints.tightFor(
                                    width: 32,
                                    height: 32,
                                  ),
                                  padding: EdgeInsets.zero,
                                  visualDensity: VisualDensity.compact,
                                  icon: const Icon(
                                    Icons.help_outline_rounded,
                                    size: 18,
                                    color: AppColors.textHint,
                                  ),
                                  onPressed: _showCallInDescription,
                                ),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(
                          width: 58,
                          height: 40,
                          child: Center(
                            child: _updatingCallIn
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.2,
                                      color: AppColors.primary,
                                    ),
                                  )
                                : Switch.adaptive(
                                    value: callInEnabled,
                                    activeThumbColor: AppColors.primary,
                                    onChanged: _setCallInEnabled,
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 28),

                  // Delivery Calendar
                  const SectionLabel(
                    'Delivery Calendar',
                    color: Colors.white70,
                  ),
                  const SizedBox(height: 12),
                  const DeliveryCalendarCard(),

                  const SizedBox(height: 28),

                  // Help & Support
                  const SectionLabel('Support', color: Colors.white70),
                  const SizedBox(height: 12),
                  PremiumCard(
                    padding: EdgeInsets.zero,
                    child: _LegalTile(
                      icon: Icons.support_agent_rounded,
                      label: 'Help & Support',
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const HelpSupportScreen(),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Legal links
                  const SectionLabel('Legal', color: Colors.white70),
                  const SizedBox(height: 12),
                  PremiumCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _LegalTile(
                          icon: Icons.shield_outlined,
                          label: 'Privacy Policy',
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const PrivacyPolicyScreen(),
                            ),
                          ),
                        ),
                        Divider(
                          height: 1,
                          indent: 60,
                          color: AppColors.divider,
                        ),
                        _LegalTile(
                          icon: Icons.gavel_rounded,
                          label: 'Terms of Service',
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const TermsScreen(),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 28),

                  // Account actions
                  const SectionLabel('Account', color: Colors.white70),
                  const SizedBox(height: 12),

                  // Sign Out — prominent tile
                  PremiumCard(
                    padding: EdgeInsets.zero,
                    child: InkWell(
                      onTap: _loggingOut
                          ? null
                          : () async {
                              final authProvider = context
                                  .read<AppAuthProvider>();
                              final nav = Navigator.of(context);
                              final confirm = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: const Text('Sign Out?'),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(24),
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () =>
                                          Navigator.pop(ctx, false),
                                      child: const Text('Cancel'),
                                    ),
                                    TextButton(
                                      onPressed: () => Navigator.pop(ctx, true),
                                      child: const Text('Sign Out'),
                                    ),
                                  ],
                                ),
                              );
                              if (confirm == true && mounted) {
                                setState(() => _loggingOut = true);
                                await authProvider.logout();
                                nav.pushAndRemoveUntil(
                                  MaterialPageRoute(
                                    builder: (_) => const LoginScreen(),
                                  ),
                                  (route) => false,
                                );
                              }
                            },
                      borderRadius: BorderRadius.circular(24),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 16,
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: AppColors.primaryLight,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: _loggingOut
                                  ? const Padding(
                                      padding: EdgeInsets.all(8),
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: AppColors.primary,
                                      ),
                                    )
                                  : const Icon(
                                      Icons.logout_rounded,
                                      size: 18,
                                      color: AppColors.primary,
                                    ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Text(
                                'Sign Out',
                                style: AppType.captionBold,
                              ),
                            ),
                            const Icon(
                              Icons.chevron_right_rounded,
                              size: 20,
                              color: AppColors.textHint,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 28),

                  // Delete Account — subdued text link at the bottom
                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const DeleteAccountScreen(),
                        ),
                      ),
                      child: Text(
                        'Delete Account',
                        style: AppType.caption.copyWith(
                          color: AppColors.textHint,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 28),

                  const _TrustFooter(),

                  const SizedBox(height: 80),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TrustFooter extends StatelessWidget {
  const _TrustFooter();

  Future<void> _openWhatsApp() async {
    final appUri = Uri.parse('whatsapp://send?phone=919286734980');
    final webUri = Uri.parse('https://wa.me/919286734980');
    try {
      if (await launchUrl(appUri, mode: LaunchMode.externalApplication)) {
        return;
      }
    } catch (_) {
      // Fall back to web handoff when WhatsApp is not installed.
    }
    await launchUrl(webUri, mode: LaunchMode.externalApplication);
  }

  Future<void> _callSupport() async {
    await launchUrl(Uri.parse('tel:+919286734980'));
  }

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: const [
              _BadgeIcon(
                icon: Icons.eco_rounded,
                label: '100% Natural\nPreservative-Free',
              ),
              _BadgeIcon(
                icon: Icons.water_drop_outlined,
                label: 'No Water\nGuaranteed',
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 16),
          Row(
            children: [
              const Icon(
                Icons.verified_user_outlined,
                size: 18,
                color: AppColors.primary,
              ),
              const SizedBox(width: 8),
              Text('FSSAI Lic. No: 22726616000172', style: AppType.caption),
            ],
          ),
          const SizedBox(height: 10),
          InkWell(
            onTap: _openWhatsApp,
            child: Row(
              children: [
                const Icon(
                  Icons.chat_bubble_outline_rounded,
                  size: 18,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 8),
                Text('WhatsApp: +91 92867 34980', style: AppType.caption),
              ],
            ),
          ),
          const SizedBox(height: 10),
          InkWell(
            onTap: _callSupport,
            child: Row(
              children: [
                const Icon(
                  Icons.support_agent_rounded,
                  size: 18,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 8),
                Text(
                  'Customer Care: +91 92867 34980',
                  style: AppType.caption,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeIcon extends StatelessWidget {
  final IconData icon;
  final String label;

  const _BadgeIcon({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.primary, width: 1.4),
          ),
          child: Icon(icon, size: 22, color: AppColors.primary),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          textAlign: TextAlign.center,
          style: AppType.micro.copyWith(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _LegalTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _LegalTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: AppColors.primary),
            ),
            const SizedBox(width: 14),
            Expanded(child: Text(label, style: AppType.captionBold)),
            const Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: AppColors.textHint,
            ),
          ],
        ),
      ),
    );
  }
}
