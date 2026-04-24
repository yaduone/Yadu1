import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../providers/auth_provider.dart';
import '../../providers/subscription_provider.dart';
import '../../services/api_service.dart';
import '../../widgets/delivery_calendar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<dynamic> _orders = [];
  bool _loadingOrders = true;

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

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          children: [
            const SizedBox(height: 20),

            // Header
            Row(
              children: [
                Expanded(child: Text('Profile', style: AppType.h1)),
                CalendarIconButton(),
              ],
            ),

            const SizedBox(height: 24),

            // Profile Card with StatefulAvatar
            PremiumCard(
              child: Column(
                children: [
                  StatefulAvatar(
                    name: user?['name'] ?? 'U',
                    isSubscriptionActive: sub.hasActiveSubscription,
                    size: 72,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    user?['name'] ?? 'User',
                    style: AppType.h2,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user?['phone'] ?? '',
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
            const SectionLabel('Order History'),
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

            // Logout — subdued, at the bottom
            Center(
              child: TextButton(
                onPressed: () async {
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
                              style:
                                  TextStyle(color: AppColors.error)),
                        ),
                      ],
                    ),
                  );
                  if (confirm == true && mounted) {
                    context.read<AppAuthProvider>().logout();
                  }
                },
                child: Text(
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
    );
  }
}
