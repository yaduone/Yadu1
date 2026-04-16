import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../providers/subscription_provider.dart';
import '../../providers/cart_provider.dart';
import '../../utils/constants.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  String _selectedMilkType = 'cow';
  double _quantity = 1.0;
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));

  @override
  Widget build(BuildContext context) {
    final sub = context.watch<SubscriptionProvider>();

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.scaffoldBg,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 16),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Subscription'),
      ),
      body: sub.subscription != null ? _buildManageView(sub) : _buildCreateView(sub),
    );
  }

  Widget _buildCreateView(SubscriptionProvider sub) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.water_drop_rounded, size: 36, color: AppColors.primary),
            ),
          ),
          const SizedBox(height: 16),
          const Center(
            child: Text(
              'Start Daily Milk Subscription',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
            ),
          ),
          const SizedBox(height: 6),
          const Center(
            child: Text(
              'Choose your preferences below',
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
          ),

          const SizedBox(height: 32),

          // Milk type selection
          const SectionLabel('Select Milk Type'),
          const SizedBox(height: 12),
          ...AppConstants.milkTypes.map((type) {
            final selected = _selectedMilkType == type;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: () => setState(() => _selectedMilkType = type),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primaryLight : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected ? AppColors.primary : AppColors.border,
                      width: selected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: selected ? AppColors.primary.withAlpha(20) : AppColors.surfaceBg,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          Icons.water_drop_rounded,
                          color: selected ? AppColors.primary : AppColors.textHint,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Text(
                        AppConstants.milkTypeLabels[type] ?? type,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                          color: selected ? AppColors.primary : AppColors.textPrimary,
                        ),
                      ),
                      const Spacer(),
                      if (selected)
                        const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 22),
                    ],
                  ),
                ),
              ),
            );
          }),

          const SizedBox(height: 24),

          // Quantity
          const SectionLabel('Daily Quantity'),
          const SizedBox(height: 12),
          PremiumCard(
            child: Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _stepperBtn(
                    Icons.remove_rounded,
                    _quantity > 0.5 ? () => setState(() => _quantity -= 0.5) : null,
                  ),
                  Container(
                    width: 90,
                    alignment: Alignment.center,
                    child: Text(
                      '${_quantity}L',
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                    ),
                  ),
                  _stepperBtn(
                    Icons.add_rounded,
                    _quantity < 10 ? () => setState(() => _quantity += 0.5) : null,
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Start date
          const SectionLabel('Start Date'),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _startDate,
                firstDate: DateTime.now().add(const Duration(days: 1)),
                lastDate: DateTime.now().add(const Duration(days: 365)),
                builder: (context, child) {
                  return Theme(
                    data: Theme.of(context).copyWith(
                      colorScheme: Theme.of(context).colorScheme.copyWith(primary: AppColors.primary),
                    ),
                    child: child!,
                  );
                },
              );
              if (picked != null) setState(() => _startDate = picked);
            },
            child: PremiumCard(
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.calendar_today_rounded, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 14),
                  Text(
                    DateFormat('dd MMM yyyy').format(_startDate),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.textHint),
                ],
              ),
            ),
          ),

          if (sub.error != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withAlpha(15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 18, color: AppColors.error),
                  const SizedBox(width: 8),
                  Expanded(child: Text(sub.error!, style: const TextStyle(color: AppColors.error, fontSize: 13))),
                ],
              ),
            ),
          ],

          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: sub.isLoading
                ? null
                : () async {
                    final ok = await sub.createSubscription(
                      milkType: _selectedMilkType,
                      quantity: _quantity,
                      startDate: DateFormat('yyyy-MM-dd').format(_startDate),
                    );
                    if (ok && mounted) Navigator.pop(context);
                  },
            child: sub.isLoading
                ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                : const Text('Start Subscription'),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _stepperBtn(IconData icon, VoidCallback? onPressed) {
    final enabled = onPressed != null;
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: enabled ? AppColors.primary : AppColors.border,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Icon(icon, color: enabled ? Colors.white : AppColors.textHint, size: 24),
      ),
    );
  }

  Widget _buildManageView(SubscriptionProvider sub) {
    final s = sub.subscription!;
    final isActive = s['status'] == 'active';
    final isPaused = s['status'] == 'paused';

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: isActive ? AppColors.success.withAlpha(20) : AppColors.warning.withAlpha(20),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        Icons.water_drop_rounded,
                        color: isActive ? AppColors.success : AppColors.warning,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${(s['milk_type'] as String).toUpperCase()} Milk',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: isActive ? AppColors.success.withAlpha(20) : AppColors.warning.withAlpha(20),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              s['status'].toString().toUpperCase(),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: isActive ? AppColors.success : AppColors.warning,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _infoRow(Icons.local_drink_rounded, 'Daily', '${s['quantity_litres']}L'),
                const SizedBox(height: 10),
                _infoRow(Icons.currency_rupee_rounded, 'Price', 'Rs.${s['price_per_litre']}/litre'),
                const SizedBox(height: 10),
                _infoRow(Icons.calendar_today_rounded, 'Started', '${s['start_date']}'),
              ],
            ),
          ),

          const SizedBox(height: 28),

          if (isActive)
            _actionButton('Pause Subscription', AppColors.warning, Icons.pause_circle_outline_rounded, () async {
              await sub.pauseSubscription();
              if (mounted) context.read<CartProvider>().loadTomorrowStatus();
            }),
          if (isPaused)
            _actionButton('Resume Subscription', AppColors.success, Icons.play_circle_outline_rounded, () async {
              await sub.resumeSubscription();
              if (mounted) context.read<CartProvider>().loadTomorrowStatus();
            }),
          const SizedBox(height: 12),
          _actionButton('Cancel Subscription', AppColors.error, Icons.cancel_outlined, () async {
            final confirm = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Cancel Subscription?'),
                content: const Text('This cannot be undone. You will need to create a new subscription.'),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Yes, Cancel', style: TextStyle(color: AppColors.error)),
                  ),
                ],
              ),
            );
            if (confirm == true) {
              await sub.cancelSubscription();
              if (mounted) Navigator.pop(context);
            }
          }),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.textHint),
        const SizedBox(width: 10),
        Text(label, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
        const Spacer(),
        Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
      ],
    );
  }

  Widget _actionButton(String label, Color color, IconData icon, VoidCallback onPressed) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}
