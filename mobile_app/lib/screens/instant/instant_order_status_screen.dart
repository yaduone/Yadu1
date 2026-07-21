import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/instant_provider.dart';
import '../../theme/instant_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/tappable.dart';
import '../../widgets/app_snackbar.dart';

/// Live status screen shown immediately after an instant order is placed.
///
/// The customer lands on "Requested" and stays there until an admin accepts the
/// order, at which point it flips to "Accepted" with the promised ETA countdown.
/// If the admin rejects it — or nobody responds before the configured
/// auto-expiry deadline — the reason is shown here instead.
class InstantOrderStatusScreen extends StatefulWidget {
  final Map<String, dynamic> order;

  const InstantOrderStatusScreen({super.key, required this.order});

  @override
  State<InstantOrderStatusScreen> createState() =>
      _InstantOrderStatusScreenState();
}

/// The stages an instant order moves through, as the customer experiences them.
///
/// Derived from the server `status` in one place so the headline, icon, tracker
/// position, poll cadence and terminal-ness can never disagree with each other.
enum _Stage {
  requested,
  accepted,
  runningLate,
  delivered,
  rejected,
  cancelled,
}

class _InstantOrderStatusScreenState extends State<InstantOrderStatusScreen>
    with WidgetsBindingObserver {
  // Poll faster while awaiting acceptance — that is the stage where the
  // customer is actively watching and the state can flip at any moment.
  static const Duration _awaitingInterval = Duration(seconds: 8);
  static const Duration _enRouteInterval = Duration(seconds: 20);

  /// Only surface a connection warning after repeated failures, so one dropped
  /// request on a flaky mobile connection doesn't flash an alarming banner.
  static const int _failuresBeforeWarning = 3;

  late Map<String, dynamic> _order;
  Timer? _poller;
  Timer? _ticker;
  bool _fetching = false;
  bool _cancelling = false;
  int _consecutiveFailures = 0;

  String get _status => (_order['status'] as String?) ?? 'pending';

  _Stage get _stage {
    switch (_status) {
      case 'acknowledged':
        return (_order['is_overdue'] as bool? ?? false)
            ? _Stage.runningLate
            : _Stage.accepted;
      case 'delivered':
        return _Stage.delivered;
      case 'rejected':
        return _Stage.rejected;
      case 'cancelled':
        return _Stage.cancelled;
      default:
        return _Stage.requested;
    }
  }

  bool get _isTerminal =>
      _stage == _Stage.delivered ||
      _stage == _Stage.rejected ||
      _stage == _Stage.cancelled;

  bool get _isFailure =>
      _stage == _Stage.rejected || _stage == _Stage.cancelled;

  bool get _isAwaitingAcceptance => _stage == _Stage.requested;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _order = Map<String, dynamic>.from(widget.order);
    _syncTimers();
    // This screen is reachable from order history without passing through the
    // storefront, so the cancel-window setting may not have been fetched yet.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<InstantProvider>().loadAvailability();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poller?.cancel();
    _ticker?.cancel();
    super.dispose();
  }

  /// Polling a backgrounded screen burns battery and data for updates nobody can
  /// see. Suspend while hidden, and refresh immediately on return — the customer
  /// is most likely coming back *because* they tapped the acceptance push.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncTimers();
      _refresh();
    } else {
      _poller?.cancel();
      _ticker?.cancel();
    }
  }

  /// Single place that decides which timers should be running for the current
  /// stage, so every state change routes through the same logic.
  void _syncTimers() {
    _poller?.cancel();
    _ticker?.cancel();
    if (_isTerminal) return;

    _poller = Timer.periodic(
      _isAwaitingAcceptance ? _awaitingInterval : _enRouteInterval,
      (_) => _refresh(),
    );

    // Once accepted there is a deadline to count down to, so repaint each second
    // to keep the "arriving in 12 min" line honest between polls.
    if (_order['expected_delivery_by'] != null) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  Future<void> _refresh() async {
    final id = _order['id'] as String?;
    if (id == null || _fetching) return; // guard against overlapping polls

    _fetching = true;
    try {
      final fresh = await context.read<InstantProvider>().fetchOrder(id);
      if (!mounted) return;

      if (fresh == null) {
        setState(() => _consecutiveFailures++);
        return;
      }

      final previousStage = _stage;
      setState(() {
        _order = fresh;
        _consecutiveFailures = 0;
      });

      // Cadence and countdown depend on the stage, so re-derive the timers
      // whenever it actually moves.
      if (_stage != previousStage) {
        _syncTimers();
        // Keep the history/logs screens consistent with what is shown here.
        if (_isTerminal) {
          context.read<InstantProvider>().loadOrders(forceRefresh: true);
        }
      }
    } finally {
      _fetching = false;
    }
  }

  /// Confirm, then cancel. The confirmation matters more once the order is
  /// accepted — someone may already be on their way with it.
  Future<void> _confirmCancel() async {
    final provider = context.read<InstantProvider>();
    final wasAccepted = _stage != _Stage.requested;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Cancel this order?', style: AppType.h3),
        content: Text(
          wasAccepted
              ? 'The store has already accepted this order and may be on the way. '
                  'Cancel it anyway?'
              : 'Your order will be cancelled. You can always place it again.',
          style: AppType.body.copyWith(color: InstantColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text('Keep Order',
                style: AppType.body.copyWith(color: InstantColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text('Cancel Order',
                style: AppType.body.copyWith(color: InstantColors.error)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _cancelling = true);
    final error = await provider.cancelOrder(_order['id'] as String);
    if (!mounted) return;
    setState(() => _cancelling = false);

    if (error != null) {
      // The window may have closed while this screen was open — pull the
      // authoritative state so the UI matches the server.
      AppSnackbar.error(context, error);
      _refresh();
      return;
    }

    await _refresh();
  }

  // ── Stage presentation ─────────────────────────────────────────────────────

  /// Position in the three-step tracker. Running late still sits at "Accepted".
  int get _currentStep {
    switch (_stage) {
      case _Stage.accepted:
      case _Stage.runningLate:
        return 1;
      case _Stage.delivered:
        return 2;
      default:
        return 0;
    }
  }

  /// Whole minutes left before the promised delivery time, or null when there
  /// is no deadline to count against.
  int? get _minutesRemaining {
    final raw = _order['expected_delivery_by'] as String?;
    if (raw == null) return null;
    final deadline = DateTime.tryParse(raw);
    if (deadline == null) return null;
    final left = deadline.difference(DateTime.now());
    return left.isNegative ? 0 : left.inMinutes + 1;
  }

  String get _headline {
    switch (_stage) {
      case _Stage.requested:
        return 'Order Requested';
      case _Stage.accepted:
        return 'Order Accepted';
      case _Stage.runningLate:
        return 'Running Late';
      case _Stage.delivered:
        return 'Delivered';
      case _Stage.rejected:
        return 'Order Not Accepted';
      case _Stage.cancelled:
        return 'Order Cancelled';
    }
  }

  String get _subtitle {
    switch (_stage) {
      case _Stage.requested:
        return 'Waiting for the store to accept your order. This usually takes a minute.';
      case _Stage.accepted:
        final left = _minutesRemaining;
        if (left != null) {
          return left <= 1
              ? 'Your order is arriving any moment now.'
              : 'Your order is on the way, arriving in about $left minutes.';
        }
        final eta = (_order['eta_minutes'] as num?)?.toInt() ??
            context.read<InstantProvider>().etaMinutes;
        return 'Your order is on the way and will be delivered in $eta minutes.';
      case _Stage.runningLate:
        return 'Your order is taking longer than expected, but it is still on the way.';
      case _Stage.delivered:
        return 'Your order has been delivered. Thanks for shopping with us!';
      case _Stage.rejected:
        return (_order['rejection_reason'] as String?) ??
            'The store could not accept this order.';
      case _Stage.cancelled:
        return 'This order was cancelled.';
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: InstantColors.scaffoldBg,
        appBar: AppBar(
          backgroundColor: InstantColors.scaffoldBg,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          foregroundColor: InstantColors.textPrimary,
          title: Text('Your Order', style: AppType.h3),
        ),
        body: RefreshIndicator(
          color: InstantColors.primary,
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              _StatusHero(
                headline: _headline,
                subtitle: _subtitle,
                stage: _stage,
              ),
              if (_consecutiveFailures >= _failuresBeforeWarning) ...[
                const SizedBox(height: 16),
                const _ConnectionNotice(),
              ],
              const SizedBox(height: 28),
              if (!_isFailure) ...[
                _StepTracker(currentStep: _currentStep),
                const SizedBox(height: 28),
              ],
              _OrderSummaryCard(order: _order),
              const SizedBox(height: 24),
              _PrimaryButton(
                label: _isFailure ? 'Back to Store' : 'Continue Shopping',
                onTap: () => Navigator.pop(context),
              ),
              // Offered right up until the order is marked delivered, subject to
              // the admin-configured cancel window.
              if (context.watch<InstantProvider>().canCancel(_status)) ...[
                const SizedBox(height: 12),
                _CancelButton(
                  busy: _cancelling,
                  onTap: _cancelling ? null : _confirmCancel,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Hero ─────────────────────────────────────────────────────────────────────

class _StatusHero extends StatelessWidget {
  final String headline;
  final String subtitle;
  final _Stage stage;

  const _StatusHero({
    required this.headline,
    required this.subtitle,
    required this.stage,
  });

  static const Color _amber = Color(0xFFF59E0B);

  /// One place mapping stage → accent colour and icon, so the hero can never
  /// show (say) a success tick against a rejection message.
  Color get _accent {
    switch (stage) {
      case _Stage.rejected:
      case _Stage.cancelled:
        return InstantColors.error;
      case _Stage.delivered:
        return InstantColors.success;
      case _Stage.runningLate:
        return _amber;
      case _Stage.requested:
      case _Stage.accepted:
        return InstantColors.primary;
    }
  }

  IconData get _icon {
    switch (stage) {
      case _Stage.rejected:
      case _Stage.cancelled:
        return Icons.close_rounded;
      case _Stage.delivered:
        return Icons.check_rounded;
      case _Stage.runningLate:
        return Icons.running_with_errors_rounded;
      case _Stage.requested:
        return Icons.hourglass_top_rounded;
      case _Stage.accepted:
        return Icons.delivery_dining_rounded;
    }
  }

  /// Only the pre-acceptance wait gets the live spinner ring.
  bool get isWaiting => stage == _Stage.requested;

  @override
  Widget build(BuildContext context) {
    final Color accent = _accent;

    return Column(
      children: [
        SizedBox(
          width: 96,
          height: 96,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // A slow ring while we wait signals "live", without pretending to
              // show real progress toward acceptance.
              if (isWaiting)
                SizedBox(
                  width: 96,
                  height: 96,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    valueColor: AlwaysStoppedAnimation(accent.withValues(alpha: 0.35)),
                  ),
                ),
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(_icon, size: 38, color: accent),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Text(
          headline,
          textAlign: TextAlign.center,
          style: AppType.h2.copyWith(
            color: InstantColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: AppType.body.copyWith(
            color: InstantColors.textSecondary,
            height: 1.45,
          ),
        ),
      ],
    );
  }
}

/// Shown after several consecutive failed polls. The order itself is safe on
/// the server — only our view of it is stale — so the wording reassures rather
/// than alarms.
class _ConnectionNotice extends StatelessWidget {
  const _ConnectionNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          const Icon(Icons.wifi_off_rounded, size: 18, color: Color(0xFFB45309)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              "Can't reach the server — your order is still placed. Retrying…",
              style: AppType.small.copyWith(color: const Color(0xFFB45309)),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Step tracker ─────────────────────────────────────────────────────────────

class _StepTracker extends StatelessWidget {
  final int currentStep;

  const _StepTracker({required this.currentStep});

  static const List<String> _labels = ['Requested', 'Accepted', 'Delivered'];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(_labels.length * 2 - 1, (i) {
        // Odd indices are the connecting bars between step dots.
        if (i.isOdd) {
          final stepBefore = i ~/ 2;
          final done = currentStep > stepBefore;
          return Expanded(
            child: Container(
              height: 3,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: done ? InstantColors.primary : InstantColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }

        final step = i ~/ 2;
        final reached = currentStep >= step;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: reached ? InstantColors.primary : Colors.white,
                shape: BoxShape.circle,
                border: Border.all(
                  color: reached ? InstantColors.primary : InstantColors.border,
                  width: 2,
                ),
              ),
              child: reached
                  ? const Icon(Icons.check, size: 15, color: Colors.white)
                  : null,
            ),
            const SizedBox(height: 6),
            Text(
              _labels[step],
              style: AppType.small.copyWith(
                color: reached
                    ? InstantColors.textPrimary
                    : InstantColors.textHint,
                fontWeight: reached ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        );
      }),
    );
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

class _OrderSummaryCard extends StatelessWidget {
  final Map<String, dynamic> order;

  const _OrderSummaryCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final items = (order['items'] as List?) ?? const [];
    final total = (order['total_amount'] as num?)?.toDouble() ?? 0;
    final deliveryCharge = (order['delivery_charge'] as num?)?.toDouble() ?? 0;
    final itemsTotal = (order['items_total'] as num?)?.toDouble() ?? 0;
    final extraTotal =
        (order['extra_charges_total'] as num?)?.toDouble() ?? 0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: InstantColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Order Summary',
              style: AppType.bodyBold
                  .copyWith(color: InstantColors.textPrimary)),
          const SizedBox(height: 14),
          ...items.map((item) {
            final name = item['product_name'] ?? 'Item';
            final qty = (item['quantity'] as num?)?.toInt() ?? 0;
            final lineTotal = (item['total'] as num?)?.toDouble() ?? 0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '$name  ×$qty',
                      style: AppType.body
                          .copyWith(color: InstantColors.textSecondary),
                    ),
                  ),
                  Text(
                    'Rs. ${lineTotal.toStringAsFixed(2)}',
                    style: AppType.body
                        .copyWith(color: InstantColors.textPrimary),
                  ),
                ],
              ),
            );
          }),
          const Divider(height: 22, color: InstantColors.border),
          _row('Items', itemsTotal),
          if (deliveryCharge > 0) _row('Delivery', deliveryCharge),
          if (extraTotal > 0) _row('Other charges', extraTotal),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text('Total (Cash on Delivery)',
                    style: AppType.bodyBold
                        .copyWith(color: InstantColors.textPrimary)),
              ),
              Text(
                'Rs. ${total.toStringAsFixed(2)}',
                style: AppType.bodyBold.copyWith(
                  color: InstantColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(String label, double amount) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            Expanded(
              child: Text(label,
                  style: AppType.caption
                      .copyWith(color: InstantColors.textSecondary)),
            ),
            Text('Rs. ${amount.toStringAsFixed(2)}',
                style: AppType.caption
                    .copyWith(color: InstantColors.textSecondary)),
          ],
        ),
      );
}

// ── Button ───────────────────────────────────────────────────────────────────

/// Deliberately understated next to the primary action — cancelling should be
/// reachable, not inviting.
class _CancelButton extends StatelessWidget {
  final bool busy;
  final VoidCallback? onTap;

  const _CancelButton({required this.busy, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tappable(
      onTap: onTap,
      child: Container(
        height: 50,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: InstantColors.error.withValues(alpha: busy ? 0.25 : 0.45),
          ),
        ),
        child: busy
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(InstantColors.error),
                ),
              )
            : Text(
                'Cancel Order',
                style: AppType.bodyBold.copyWith(color: InstantColors.error),
              ),
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _PrimaryButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tappable(
      onTap: onTap,
      child: Container(
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: InstantColors.gradient,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: AppType.bodyBold.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
