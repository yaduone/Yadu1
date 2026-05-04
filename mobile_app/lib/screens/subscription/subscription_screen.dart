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

const _milkValues = {'Cow': 'cow', 'Buffalo': 'buffalo', 'Child Pack': 'toned'};
const _milkLogos = {
  'Cow': '\u{1F404}',
  'Buffalo': '\u{1F403}',
  'Child Pack': '\u{1F476}',
};
const _deliverySlotIcons = {
  'morning': Icons.wb_sunny_rounded,
  'evening': Icons.nightlight_round,
  'both': Icons.sync_rounded,
};

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  String _selectedMilk = 'cow';
  double _quantity = 1.0;
  String _selectedSlot = 'morning';
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));

  // Pending quantity for manage view (null = not dirty)
  double? _pendingQty;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SubscriptionProvider>().loadPrices(forceRefresh: true);
    });
  }

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
                  child: const Icon(
                    Icons.person_off_outlined,
                    size: 36,
                    color: AppColors.warning,
                  ),
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
    final isManageBusy = sub.isLoading || sub.isActionLoading;
    final cancelStyle = AppType.caption.copyWith(color: AppColors.error);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        PremiumCard(
          child: Column(
            children: [
              StatefulAvatar(
                name:
                    AppConstants.milkTypeLabels[s['milk_type'] as String] ??
                    (s['milk_type'] as String).toUpperCase(),
                isSubscriptionActive: isActive,
                size: 64,
              ),
              const SizedBox(height: 16),
              Text(
                '${AppConstants.milkTypeLabels[s['milk_type'] as String] ?? (s['milk_type'] as String).toUpperCase()} Milk',
                style: AppType.h2,
              ),
              const SizedBox(height: 6),
              Text(
                '${s['quantity_litres']}L daily · ${s['delivery_slot']} delivery',
                style: AppType.caption.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
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

        // Quantity controls
        Builder(builder: (context) {
          final actualQty = (s['quantity_litres'] as num).toDouble();
          final displayQty = _pendingQty ?? actualQty;
          final pricePerLitre = (s['price_per_litre'] as num?)?.toDouble() ?? 0.0;
          final isDirty = _pendingQty != null && _pendingQty != actualQty;

          return PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Daily Quantity',
                              style: AppType.captionBold
                                  .copyWith(color: AppColors.textSecondary)),
                          const SizedBox(height: 2),
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 200),
                            child: isDirty
                                ? Text(
                                    '${displayQty % 1 == 0 ? displayQty.toInt() : displayQty}L  ·  ₹${(pricePerLitre * displayQty).toStringAsFixed(0)}/day',
                                    key: ValueKey(displayQty),
                                    style: AppType.small
                                        .copyWith(color: AppColors.primary),
                                  )
                                : Text(
                                    '₹$pricePerLitre/L',
                                    key: const ValueKey('base'),
                                    style: AppType.small.copyWith(
                                        color: AppColors.textSecondary),
                                  ),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        _quantityButton(
                          icon: Icons.remove_rounded,
                          onTap: (isManageBusy || displayQty <= 0.5)
                              ? null
                              : () {
                                  HapticFeedback.selectionClick();
                                  setState(() => _pendingQty = displayQty - 0.5);
                                },
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            '${displayQty % 1 == 0 ? displayQty.toInt() : displayQty}L',
                            style: AppType.h2,
                          ),
                        ),
                        _quantityButton(
                          icon: Icons.add_rounded,
                          onTap: (isManageBusy || displayQty >= 10)
                              ? null
                              : () {
                                  HapticFeedback.selectionClick();
                                  setState(() => _pendingQty = displayQty + 0.5);
                                },
                        ),
                      ],
                    ),
                  ],
                ),

                // Confirm row — slides in when dirty
                AnimatedSize(
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeOut,
                  child: isDirty
                      ? Padding(
                          padding: const EdgeInsets.only(top: 14),
                          child: Row(
                            children: [
                              TextButton(
                                onPressed: sub.isUpdatingQuantity
                                    ? null
                                    : () => setState(() => _pendingQty = null),
                                style: TextButton.styleFrom(
                                    foregroundColor: AppColors.textSecondary),
                                child: const Text('Cancel'),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: sub.isUpdatingQuantity
                                      ? null
                                      : () async {
                                          final ok = await sub
                                              .updateQuantity(_pendingQty!);
                                          if (!context.mounted) return;
                                          if (ok) {
                                            setState(() => _pendingQty = null);
                                            AppSnackbar.success(context,
                                                'Daily quantity updated.');
                                          } else {
                                            AppSnackbar.error(
                                                context,
                                                sub.error ??
                                                    'Failed to update quantity.');
                                          }
                                        },
                                  style: ElevatedButton.styleFrom(
                                    minimumSize: const Size.fromHeight(40),
                                  ),
                                  child: sub.isUpdatingQuantity
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                              color: Colors.white,
                                              strokeWidth: 2),
                                        )
                                      : Text(
                                          'Update · ₹${(pricePerLitre * displayQty).toStringAsFixed(0)}/day',
                                          style: AppType.small.copyWith(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w700),
                                        ),
                                ),
                              ),
                            ],
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          );
        }),

        const SizedBox(height: 12),

        // Skip tomorrow
        if (isActive)
          OutlinedButton.icon(
            onPressed: isManageBusy
                ? null
                : () async {
                    HapticFeedback.mediumImpact();
                    final confirm = await _confirmDialog(
                      context,
                      'Skip Tomorrow\'s Delivery?',
                      'Your regular delivery will not be made tomorrow.',
                    );
                    if (!confirm || !context.mounted) return;
                    final ok = await sub.skipTomorrow();
                    if (!context.mounted) return;
                    if (ok) {
                      AppSnackbar.success(context, 'Tomorrow\'s delivery skipped.');
                    } else {
                      AppSnackbar.error(context, sub.error ?? 'Failed to skip delivery.');
                    }
                  },
            icon: sub.isSkipping
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.skip_next_rounded),
            label: Text(sub.isSkipping ? 'Skipping...' : 'Skip Tomorrow'),
          ),

        const SizedBox(height: 12),

        // Action buttons
        if (isActive)
          OutlinedButton.icon(
            onPressed: isManageBusy
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
                      AppSnackbar.success(
                        context,
                        'Subscription paused successfully.',
                      );
                    } else {
                      AppSnackbar.error(
                        context,
                        sub.error ?? 'Failed to pause subscription.',
                      );
                    }
                  },
            icon: sub.isPausing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.pause_circle_outline_rounded),
            label: Text(sub.isPausing ? 'Pausing...' : 'Pause Subscription'),
          )
        else
          ElevatedButton.icon(
            onPressed: isManageBusy
                ? null
                : () async {
                    HapticFeedback.mediumImpact();
                    final ok = await sub.resumeSubscription();
                    if (!context.mounted) return;
                    if (ok) {
                      AppSnackbar.success(
                        context,
                        'Subscription resumed. Deliveries will restart.',
                      );
                    } else {
                      AppSnackbar.error(
                        context,
                        sub.error ?? 'Failed to resume subscription.',
                      );
                    }
                  },
            icon: sub.isResuming
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : const Icon(Icons.play_circle_outline_rounded),
            label: Text(sub.isResuming ? 'Resuming...' : 'Resume Subscription'),
          ),

        const SizedBox(height: 12),

        TextButton(
          onPressed: isManageBusy
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
                    AppSnackbar.error(
                      context,
                      sub.error ?? 'Failed to cancel subscription.',
                    );
                  }
                },
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: sub.isCancelling
                ? Row(
                    key: const ValueKey('cancelling'),
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          color: AppColors.error,
                          strokeWidth: 2,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text('Cancelling...', style: cancelStyle),
                    ],
                  )
                : Text(
                    'Cancel Subscription',
                    key: const ValueKey('cancel'),
                    style: cancelStyle,
                  ),
          ),
        ),
      ],
    );
  }

  // ── Create new subscription ──────────────────────────────────
  Widget _buildCreateView(BuildContext context, SubscriptionProvider sub) {
    final pricePerLitre = sub.priceForMilkType(_selectedMilk);
    final dailyPrice = _quantity * pricePerLitre;
    final confirmLabel = sub.isPricesLoading && !sub.pricesLoaded
        ? 'Confirm · Loading price...'
        : 'Confirm · ₹${dailyPrice.toStringAsFixed(0)}/day';

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
                      colors: [
                        AppColors.primaryLight,
                        AppColors.primary.withValues(alpha: 0.15),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.water_drop_outlined,
                    color: AppColors.primary,
                    size: 32,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: Text(
                  'Start Daily Milk Subscription',
                  style: AppType.h2,
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  'Choose your preferences below',
                  style: AppType.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // ── Milk Type ─────────────────────────────────────
              const SectionLabel('Select Milk Type'),
              const SizedBox(height: 12),

              Row(
                children: AppConstants.milkTypes.map((type) {
                  final isSelected =
                      _selectedMilk ==
                      (_milkValues[type] ?? type.toLowerCase());
                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        right: type != AppConstants.milkTypes.last ? 10 : 0,
                      ),
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(
                            () => _selectedMilk =
                                _milkValues[type] ?? type.toLowerCase(),
                          );
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(
                            vertical: 16,
                            horizontal: 12,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary
                                : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: isSelected
                                ? null
                                : Border.all(color: AppColors.border, width: 1),
                            boxShadow: isSelected
                                ? [
                                    BoxShadow(
                                      color: AppColors.primary.withValues(
                                        alpha: 0.25,
                                      ),
                                      blurRadius: 16,
                                      offset: const Offset(0, 6),
                                    ),
                                  ]
                                : [],
                          ),
                          child: Column(
                            children: [
                              Text(
                                _milkLogos[type] ?? '\u{1F95B}',
                                style: const TextStyle(fontSize: 30),
                                semanticsLabel: '$type logo',
                              ),
                              const SizedBox(height: 8),
                              Text(
                                type,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
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

              Column(
                children: AppConstants.deliverySlots.map((slot) {
                  final isSelected = _selectedSlot == slot.toLowerCase();
                  final title = AppConstants.deliverySlotLabels[slot] ?? slot;
                  final time = AppConstants.deliverySlotSubtitles[slot] ?? '';
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: slot != AppConstants.deliverySlots.last ? 10 : 0,
                    ),
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() => _selectedSlot = slot.toLowerCase());
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 14,
                        ),
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
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color:
                                    (isSelected
                                            ? AppColors.primary
                                            : AppColors.primaryLight)
                                        .withValues(
                                          alpha: isSelected ? 1 : 0.7,
                                        ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(
                                _deliverySlotIcons[slot] ??
                                    Icons.schedule_rounded,
                                color: isSelected
                                    ? Colors.white
                                    : AppColors.primary,
                                size: 21,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppType.captionBold.copyWith(
                                      color: isSelected
                                          ? AppColors.primary
                                          : AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    time,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppType.caption.copyWith(
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            AnimatedOpacity(
                              opacity: isSelected ? 1 : 0,
                              duration: const Duration(milliseconds: 160),
                              child: const Icon(
                                Icons.check_circle_rounded,
                                color: AppColors.primary,
                                size: 22,
                              ),
                            ),
                          ],
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.calendar_today_rounded,
                          color: AppColors.primary,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Text(
                        DateFormat('dd MMMM yyyy').format(_startDate),
                        style: AppType.bodyBold,
                      ),
                      const Spacer(),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: AppColors.textHint,
                      ),
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
                      color: Colors.white,
                      strokeWidth: 2.5,
                    ),
                  )
                : Text(
                    confirmLabel,
                    style: AppType.button.copyWith(color: Colors.white),
                  ),
          ),
        ),
      ],
    );
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

  Widget _quantityButton({required IconData icon, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: onTap == null ? AppColors.border : AppColors.primaryLight,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: onTap == null ? AppColors.border : AppColors.primary,
            width: 1.5,
          ),
        ),
        child: Icon(
          icon,
          size: 20,
          color: onTap == null ? AppColors.textHint : AppColors.primary,
        ),
      ),
    );
  }

  Future<bool> _confirmDialog(
    BuildContext context,
    String title,
    String body,
  ) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(
          body,
          style: AppType.caption.copyWith(color: AppColors.textSecondary),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Confirm', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}
