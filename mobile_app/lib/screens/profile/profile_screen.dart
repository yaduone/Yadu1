import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../providers/auth_provider.dart';
import '../../providers/subscription_provider.dart';
import '../../services/api_service.dart';
import '../../widgets/delivery_calendar.dart';
import '../legal/privacy_policy_screen.dart';
import '../legal/terms_screen.dart';
import '../auth/login_screen.dart';
import 'edit_profile_screen.dart';
import '../../utils/transitions.dart';
import '../home/home_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<dynamic> _orders = [];
  bool _loadingOrders = true;
  bool _loggingOut = false;

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    try {
      final res = await ApiService().get('/orders?limit=20');
      setState(() {
        _orders = res['data']?['orders'] ?? [];
        _loadingOrders = false;
      });
    } catch (_) {
      setState(() => _loadingOrders = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AppAuthProvider>();
    final sub = context.watch<SubscriptionProvider>();
    final user = auth.userData;

    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) {
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
            child: Image.asset(
              'assets/images/333.jpg',
              fit: BoxFit.cover,
            ),
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
                        Shadow(
                          color: Colors.black54,
                          blurRadius: 10,
                        ),
                      ],
                    ),
                  ),
                ),
                CalendarIconButton(),
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
                        onPressed: () => Navigator.push(
                          context,
                          SlideUpRoute(page: const EditProfileScreen()),
                        ),
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
                    style: AppType.caption.copyWith(color: AppColors.textSecondary),
                  ),

                  if (user?['area_name'] != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
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
                          child: const Icon(Icons.location_on_outlined,
                              size: 18, color: AppColors.primary),
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
                                Text(user['address']['line2'],
                                    style: AppType.small.copyWith(
                                        color: AppColors.textSecondary)),
                              Text(
                                'Pincode: ${user['address']['pincode'] ?? ''}',
                                style: AppType.small
                                    .copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 28),

            // Order History
            const SectionLabel('Order History', color: Colors.white70),
            const SizedBox(height: 12),

            if (_loadingOrders)
              Column(
                children: List.generate(
                  3,
                  (_) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: SkeletonLoader(height: 72, borderRadius: 20),
                  ),
                ),
              )
            else if (_orders.isEmpty)
              PremiumCard(
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.receipt_long_outlined,
                          size: 40, color: AppColors.textHint),
                      const SizedBox(height: 12),
                      Text('No orders yet',
                          style: AppType.caption
                              .copyWith(color: AppColors.textSecondary)),
                    ],
                  ),
                ),
              )
            else
              ..._orders.map((o) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: PremiumCard(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: o['status'] == 'delivered'
                                  ? AppColors.success.withValues(alpha: 0.1)
                                  : AppColors.warning.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              o['status'] == 'delivered'
                                  ? Icons.check_circle_outline_rounded
                                  : Icons.schedule_rounded,
                              color: o['status'] == 'delivered'
                                  ? AppColors.success
                                  : AppColors.warning,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(o['date'] ?? '',
                                    style: AppType.captionBold),
                                const SizedBox(height: 2),
                                Text(
                                  '${o['milk'] != null ? '${o['milk']['milk_type']} ${o['milk']['quantity_litres']}L' : 'No milk'}'
                                  '${(o['extra_items'] as List?)?.isNotEmpty == true ? ' + ${(o['extra_items'] as List).length} extras' : ''}',
                                  style: AppType.small.copyWith(
                                      color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '₹${(o['total_amount'] as num).toStringAsFixed(2)}',
                                style: AppType.captionBold,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                (o['status'] ?? '').toString().toUpperCase(),
                                style: AppType.micro.copyWith(
                                  color: o['status'] == 'delivered'
                                      ? AppColors.success
                                      : AppColors.warning,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  )),

            const SizedBox(height: 28),

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
                          builder: (_) => const PrivacyPolicyScreen()),
                    ),
                  ),
                  Divider(height: 1, indent: 60, color: AppColors.divider),
                  _LegalTile(
                    icon: Icons.gavel_rounded,
                    label: 'Terms of Service',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const TermsScreen()),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 28),

            // Logout — subdued, at the bottom
            Center(
              child: TextButton(
                onPressed: _loggingOut
                    ? null
                    : () async {
                        final authProvider = context.read<AppAuthProvider>();
                        final nav = Navigator.of(context);
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Logout?'),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(24)),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx, false),
                                  child: const Text('Cancel')),
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                child: Text('Logout',
                                    style: TextStyle(color: AppColors.error)),
                              ),
                            ],
                          ),
                        );
                        if (confirm == true && mounted) {
                          setState(() => _loggingOut = true);
                          await authProvider.logout();
                          nav.pushAndRemoveUntil(
                            MaterialPageRoute(
                                builder: (_) => const LoginScreen()),
                            (route) => false,
                          );
                        }
                      },
                child: _loggingOut
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        'Sign Out',
                        style: AppType.caption.copyWith(
                          color: AppColors.textHint,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
              ),
            ),

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
            Expanded(
              child: Text(label, style: AppType.captionBold),
            ),
            const Icon(Icons.chevron_right_rounded,
                size: 20, color: AppColors.textHint),
          ],
        ),
      ),
    );
  }
}
