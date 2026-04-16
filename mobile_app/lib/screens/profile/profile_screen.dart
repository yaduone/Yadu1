import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

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
    final user = auth.userData;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          children: [
            const SizedBox(height: 20),

            // Header with logout
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Profile',
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.3),
                  ),
                ),
                GestureDetector(
                  onTap: () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Logout?'),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            child: const Text('Logout', style: TextStyle(color: AppColors.error)),
                          ),
                        ],
                      ),
                    );
                    if (confirm == true) auth.logout();
                  },
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(color: AppColors.primary.withAlpha(10), blurRadius: 12, offset: const Offset(0, 2)),
                      ],
                    ),
                    child: const Icon(Icons.logout_rounded, size: 20, color: AppColors.error),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Profile Card
            PremiumCard(
              child: Column(
                children: [
                  // Avatar
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Center(
                      child: Text(
                        (user?['name'] as String? ?? 'U')[0].toUpperCase(),
                        style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    user?['name'] ?? 'User',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user?['phone'] ?? '',
                    style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                  ),

                  if (user?['area_name'] != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        user!['area_name'],
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary),
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
                          child: const Icon(Icons.location_on_outlined, size: 18, color: AppColors.primary),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${user!['address']['line1'] ?? ''}',
                                style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                              ),
                              if (user['address']['line2'] != null && user['address']['line2'].toString().isNotEmpty)
                                Text(user['address']['line2'], style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                              Text(
                                'Pincode: ${user['address']['pincode'] ?? ''}',
                                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
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
              const Center(child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ))
            else if (_orders.isEmpty)
              PremiumCard(
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.receipt_long_outlined, size: 40, color: AppColors.textHint),
                      const SizedBox(height: 12),
                      const Text('No orders yet', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                    ],
                  ),
                ),
              )
            else
              ..._orders.map((o) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: PremiumCard(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: o['status'] == 'delivered'
                                  ? AppColors.success.withAlpha(15)
                                  : AppColors.warning.withAlpha(15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              o['status'] == 'delivered' ? Icons.check_circle_outline_rounded : Icons.schedule_rounded,
                              color: o['status'] == 'delivered' ? AppColors.success : AppColors.warning,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  o['date'] ?? '',
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${o['milk'] != null ? '${o['milk']['milk_type']} ${o['milk']['quantity_litres']}L' : 'No milk'}'
                                  '${(o['extra_items'] as List?)?.isNotEmpty == true ? ' + ${(o['extra_items'] as List).length} extras' : ''}',
                                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                'Rs.${(o['total_amount'] as num).toStringAsFixed(2)}',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                (o['status'] ?? '').toString().toUpperCase(),
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                  color: o['status'] == 'delivered' ? AppColors.success : AppColors.warning,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  )),

            const SizedBox(height: 28),
          ],
        ),
      ),
    );
  }
}
