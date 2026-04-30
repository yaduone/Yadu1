import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/app_snackbar.dart';
import '../../providers/subscription_provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  String _selectedMilk = 'cow';
  double _quantity = 1.0;
  String _selectedSlot = 'morning';
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));

  @override
  Widget build(BuildContext context) {
    final sub = context.watch<SubscriptionProvider>();
    final auth = context.watch<AppAuthProvider>();

    // Guard: profile must be complete before a subscription can be created
    if (!auth.isProfileComplete) {
      return Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        appBar: AppBar(
          backgroundColor: AppColors.scaffoldBg,
          leading: IconButton(
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.arrow_back_ios_new, size: 16),
            ),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text('Subscription', style: AppType.h2),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.person_off_outlined, size: 36, color: AppColors.warning),
                ),
                const SizedBox(height: 20),
                Text(
                  'Profile Incomplete',
                  style: AppType.h2,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Please complete your profile with your name, delivery area, and address before starting a subscription.',
                  style: AppType.body.copyWith(color: AppColors.textSecondary),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.scaffoldBg,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 16),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Subscription', style: AppType.h2),
      ),
      body: sub.hasActiveSubscription
          ? _buildManageView(context, sub)
          : _buildCreateView(context, sub),
    );
  }

  // ── Manage existing subscription ─────────────────────────────
  Widget _buildManageView(BuildContext context, SubscriptionProvider sub) {
    final s = sub.subscription!;
    final isActive = s['status'] == 'active';

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        PremiumCard(
          child: Column(
            children: [
              StatefulAvatar(
                name: (s['milk_type'] as String).toUpperCase(),
                isSubscriptionActive: isActive,
                size: 64,
              ),
              const SizedBox(height: 16),
              Text(
                '${(s['milk_type'] as String).toUpperCase()} Milk',
                style: AppType.h2,
              ),
              const SizedBox(height: 6),
              Text(
                '${s['quantity_litres']}L daily · ${s['delivery_slot']} delivery',
                style: AppType.caption.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: (isActive ? AppColors.success : AppColors.warning)
                      .withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  isActive ? 'ACTIVE' : 'PAUSED',
                  style: AppType.microUpper.copyWith(
                    color: isActive ? AppColors.success : AppColors.warning,
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Action buttons
        if (isActive)
          OutlinedButton.icon(
            onPressed: sub.isLoading
                ? null
                : () async {
                    HapticFeedback.mediumImpact();
                    final confirm = await _confirmDialog(
                      context,
                      'Pause Subscription?',
                      'You can resume anytime. No deliveries will be made while paused.',
                    );
                    if (!confirm || !context.mounted) return;
                    final ok = await sub.pauseSubscription();
                    if (!context.mounted) return;
                    if (ok) {
                      AppSnackbar.success(context, 'Subscription paused successfully.');
                    } else {
                      AppSnackbar.error(context, sub.error ?? 'Failed to pause subscription.');
                    }
                  },
            icon: sub.isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.pause_circle_outline_rounded),
            label: Text(sub.isLoading ? 'Pausing…' : 'Pause Subscription'),
          )
        else
          ElevatedButton.icon(
            onPressed: sub.isLoading
                ? null
                : () async {
                    HapticFeedback.mediumImpact();
                    final ok = await sub.resumeSubscription();
                    if (!context.mounted) return;
                    if (ok) {
                      AppSnackbar.success(context, 'Subscription resumed. Deliveries will restart.');
                    } else {
                      AppSnackbar.error(context, sub.error ?? 'Failed to resume subscription.');
                    }
                  },
            icon: sub.isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2),
                  )
                : const Icon(Icons.play_circle_outline_rounded),
            label: Text(sub.isLoading ? 'Resuming…' : 'Resume Subscription'),
          ),

        const SizedBox(height: 12),

        TextButton(
          onPressed: sub.isLoading
              ? null
              : () async {
                  final confirm = await _confirmDialog(
                    context,
                    'Cancel Subscription?',
                    'This action cannot be undone. You\'ll need to create a new subscription.',
                  );
                  if (!confirm || !context.mounted) return;
                  final ok = await sub.cancelSubscription();
                  if (!context.mounted) return;
                  if (ok) {
                    Navigator.pop(context);
                  } else {
                    AppSnackbar.error(context, sub.error ?? 'Failed to cancel subscription.');
                  }
                },
          child: sub.isLoading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      color: AppColors.error, strokeWidth: 2),
                )
              : Text(
                  'Cancel Subscription',
                  style: AppType.caption.copyWith(color: AppColors.error),
                ),
        ),
      ],
    );
  }

  // ── Create new subscription ──────────────────────────────────
  Widget _buildCreateView(BuildContext context, SubscriptionProvider sub) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // Header
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.primaryLight, AppColors.primary.withValues(alpha: 0.15)],
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.water_drop_outlined,
                      color: AppColors.primary, size: 32),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: Text('Start Daily Milk Subscription',
                    style: AppType.h2, textAlign: TextAlign.center),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  'Choose your preferences below',
                  style: AppType.caption.copyWith(color: AppColors.textSecondary),
                ),
              ),

              const SizedBox(height: 28),

              // ── Milk Type ─────────────────────────────────────
              const SectionLabel('Select Milk Type'),
              const SizedBox(height: 12),

              Row(
                children: AppConstants.milkTypes.map((type) {
                  final isSelected =
                      _selectedMilk == type.toLowerCase();
                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        right: type != AppConstants.milkTypes.last ? 10 : 0,
                      ),
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() => _selectedMilk = type.toLowerCase());
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(
                              vertical: 16, horizontal: 12),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary
                                : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: isSelected
                                ? null
                                : Border.all(
                                    color: AppColors.border, width: 1),
                            boxShadow: isSelected
                                ? [
                                    BoxShadow(
                                      color: AppColors.primary
                                          .withValues(alpha: 0.25),
                                      blurRadius: 16,
                                      offset: const Offset(0, 6),
                                    ),
                                  ]
                                : [],
                          ),
                          child: Column(
                            children: [
                              Icon(
                                Icons.water_drop_rounded,
                                color: isSelected
                                    ? Colors.white
                                    : AppColors.textSecondary,
                                size: 28,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                type,
                                style: AppType.captionBold.copyWith(
                                  color: isSelected
                                      ? Colors.white
                                      : AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 28),

              // ── Quantity ──────────────────────────────────────
              const SectionLabel('Daily Quantity'),
              const SizedBox(height: 16),
              Center(
                child: HapticStepper(
                  value: _quantity,
                  onChanged: (v) => setState(() => _quantity = v),
                ),
              ),

              const SizedBox(height: 28),

              // ── Delivery Slot ─────────────────────────────────
              const SectionLabel('Delivery Slot'),
              const SizedBox(height: 12),

              Row(
                children: AppConstants.deliverySlots.map((slot) {
                  final isSelected =
                      _selectedSlot == slot.toLowerCase();
                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        right: slot != AppConstants.deliverySlots.last
                            ? 10
                            : 0,
                      ),
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(
                              () => _selectedSlot = slot.toLowerCase());
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primaryLight
                                : Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.border,
                              width: isSelected ? 2 : 1,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              slot,
                              style: AppType.captionBold.copyWith(
                                color: isSelected
                                    ? AppColors.primary
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 28),

              // ── Start Date ────────────────────────────────────
              const SectionLabel('Start Date'),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _startDate,
                    firstDate: DateTime.now().add(const Duration(days: 1)),
                    lastDate: DateTime.now().add(const Duration(days: 30)),
                  );
                  if (picked != null) {
                    setState(() => _startDate = picked);
                  }
                },
                child: PremiumCard(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.calendar_today_rounded,
                            color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 14),
                      Text(
                        DateFormat('dd MMMM yyyy').format(_startDate),
                        style: AppType.bodyBold,
                      ),
                      const Spacer(),
                      const Icon(Icons.chevron_right_rounded,
                          color: AppColors.textHint),
                    ],
                  ),
                ),
              ),

              // Error
              if (sub.error != null) ...[
                const SizedBox(height: 16),
                InlineErrorBanner(message: sub.error!),
              ],

              const SizedBox(height: 120), // room for sticky bar
            ],
          ),
        ),

        // Sticky bottom CTA
        StickyBottomBar(
          child: ElevatedButton(
            onPressed: sub.isLoading ? null : _handleCreate,
            child: sub.isLoading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2.5))
                : Text(
                    'Confirm · ₹${(_quantity * _getPricePerLitre()).toStringAsFixed(0)}/day',
                    style: AppType.button.copyWith(color: Colors.white),
                  ),
          ),
        ),
      ],
    );
  }

  double _getPricePerLitre() {
    // rough estimation — your API may provide actual prices
    return _selectedMilk == 'cow' ? 60 : _selectedMilk == 'buffalo' ? 70 : 65;
  }

  Future<void> _handleCreate() async {
    HapticFeedback.mediumImpact();
    final sub = context.read<SubscriptionProvider>();
    final ok = await sub.createSubscription(
      milkType: _selectedMilk,
      quantity: _quantity,
      startDate: DateFormat('yyyy-MM-dd').format(_startDate),
      deliverySlot: _selectedSlot,
    );
    if (ok && mounted) {
      HapticFeedback.heavyImpact();
      Navigator.pop(context);
    }
  }

  Future<bool> _confirmDialog(
      BuildContext context, String title, String body) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body,
            style: AppType.caption.copyWith(color: AppColors.textSecondary)),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Confirm',
                style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}
