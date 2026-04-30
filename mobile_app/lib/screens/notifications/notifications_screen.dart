import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../services/api_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _loading = true;
  bool _hasError = false;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _hasError = false;
    });
    try {
      final res = await ApiService().get('/notifications?limit=50');
      final list = (res['data']?['notifications'] as List?) ?? [];
      setState(() {
        _notifications = list;
        _unreadCount = list.where((n) => n['is_read'] != true).length;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _hasError = true;
      });
    }
  }

  Future<void> _markRead(String id) async {
    final idx = _notifications.indexWhere((n) => n['id'] == id);
    if (idx == -1 || _notifications[idx]['is_read'] == true) return;
    setState(() {
      _notifications[idx] = {..._notifications[idx], 'is_read': true};
      _unreadCount = (_unreadCount - 1).clamp(0, 9999);
    });
    try {
      await ApiService().put('/notifications/$id/read', {});
    } catch (_) {
      // revert on failure
      setState(() {
        _notifications[idx] = {..._notifications[idx], 'is_read': false};
        _unreadCount++;
      });
    }
  }

  Future<void> _markAllRead() async {
    if (_unreadCount == 0) return;
    setState(() {
      _notifications = _notifications
          .map((n) => {...n as Map, 'is_read': true})
          .toList();
      _unreadCount = 0;
    });
    try {
      await ApiService().put('/notifications/read-all', {});
    } catch (_) {
      _load(); // resync on failure
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.scaffoldBg,
        elevation: 0,
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
        title: Row(
          children: [
            Text('Notifications', style: AppType.h2),
            if (_unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$_unreadCount',
                  style: AppType.micro.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: Text(
                'Mark all read',
                style: AppType.small.copyWith(color: AppColors.primary),
              ),
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: List.generate(
            5,
            (_) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SkeletonLoader(height: 88, borderRadius: 20),
            ),
          ),
        ),
      );
    }

    if (_hasError) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.textHint),
            const SizedBox(height: 12),
            Text('Could not load notifications',
                style: AppType.caption.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_notifications.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.notifications_off_outlined,
                size: 56, color: AppColors.textHint),
            const SizedBox(height: 16),
            Text('No notifications',
                style: AppType.caption
                    .copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 4),
            Text('Delivery updates will appear here',
                style: AppType.small.copyWith(color: AppColors.textHint)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        itemCount: _notifications.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final n = _notifications[i];
          final type = n['type'] as String? ?? 'info';
          switch (type) {
            case 'delivery_summary':
              return _DeliveryCard(
                notification: n,
                onTap: () => _markRead(n['id']),
              );
            case 'due_reminder':
              return _DueReminderCard(
                notification: n,
                onTap: () => _markRead(n['id']),
              );
            default:
              return _GenericCard(
                notification: n,
                onTap: () => _markRead(n['id']),
              );
          }
        },
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

String _relativeTime(dynamic createdAt) {
  if (createdAt == null) return '';
  try {
    final dt = DateTime.parse(createdAt as String).toLocal();
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    return DateFormat('d MMM').format(dt);
  } catch (_) {
    return '';
  }
}

bool _isUnread(dynamic n) => n['is_read'] != true;

// ── Delivery Summary Card ─────────────────────────────────────────────────────

class _DeliveryCard extends StatelessWidget {
  final dynamic notification;
  final VoidCallback onTap;
  const _DeliveryCard({required this.notification, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final meta = n['meta'] as Map? ?? {};
    final unread = _isUnread(n);
    final milk = meta['milk'] as Map?;
    final extras = (meta['extra_items'] as List?) ?? [];
    final orderAmount = (meta['order_amount'] as num?)?.toDouble() ?? 0;
    final newDue = (meta['new_due_amount'] as num?)?.toDouble() ?? 0;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        decoration: BoxDecoration(
          color: unread
              ? const Color(0xFFE8F5E9)
              : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: unread
                ? AppColors.success.withValues(alpha: 0.4)
                : AppColors.border,
          ),
          boxShadow: unread
              ? [
                  BoxShadow(
                    color: AppColors.success.withValues(alpha: 0.10),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  )
                ]
              : [],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.check_circle_rounded,
                      color: AppColors.success, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        n['title'] ?? 'Delivery Confirmed',
                        style: (unread ? AppType.captionBold : AppType.caption)
                            .copyWith(color: AppColors.textPrimary),
                      ),
                      Text(
                        _relativeTime(n['created_at']),
                        style: AppType.micro
                            .copyWith(color: AppColors.textHint),
                      ),
                    ],
                  ),
                ),
                if (unread)
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.success,
                      shape: BoxShape.circle,
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 12),

            // Order breakdown
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  if (milk != null)
                    _InfoRow(
                      icon: Icons.water_drop_rounded,
                      iconColor: AppColors.primary,
                      label:
                          '${_cap(milk['milk_type'] ?? '')} Milk',
                      value: '${milk['quantity_litres']}L',
                    ),
                  ...extras.map<Widget>((e) => _InfoRow(
                        icon: Icons.add_shopping_cart_rounded,
                        iconColor: AppColors.primary,
                        label: e['name'] ?? 'Extra item',
                        value: e['quantity'] != null
                            ? '×${e['quantity']}'
                            : '',
                      )),
                  const Divider(height: 16),
                  _InfoRow(
                    icon: Icons.receipt_rounded,
                    iconColor: AppColors.textSecondary,
                    label: 'Order amount',
                    value: '₹${orderAmount.toStringAsFixed(2)}',
                    bold: true,
                  ),
                  _InfoRow(
                    icon: Icons.account_balance_wallet_rounded,
                    iconColor:
                        newDue > 0 ? AppColors.error : AppColors.success,
                    label: 'Total due now',
                    value: '₹${newDue.toStringAsFixed(2)}',
                    bold: true,
                    valueColor:
                        newDue > 0 ? AppColors.error : AppColors.success,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _cap(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

// ── Due Reminder Card ─────────────────────────────────────────────────────────

class _DueReminderCard extends StatelessWidget {
  final dynamic notification;
  final VoidCallback onTap;
  const _DueReminderCard({required this.notification, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final meta = n['meta'] as Map? ?? {};
    final unread = _isUnread(n);
    final due = (meta['due_amount'] as num?)?.toDouble() ?? 0;
    final billed = (meta['total_billed'] as num?)?.toDouble() ?? 0;
    final paid = (meta['total_paid'] as num?)?.toDouble() ?? 0;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        decoration: BoxDecoration(
          color: unread ? const Color(0xFFFFF8E1) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: unread
                ? AppColors.warning.withValues(alpha: 0.5)
                : AppColors.border,
          ),
          boxShadow: unread
              ? [
                  BoxShadow(
                    color: AppColors.warning.withValues(alpha: 0.10),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  )
                ]
              : [],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.notifications_active_rounded,
                      color: AppColors.warning, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        n['title'] ?? 'Payment Reminder',
                        style: (unread ? AppType.captionBold : AppType.caption)
                            .copyWith(color: AppColors.textPrimary),
                      ),
                      Text(
                        _relativeTime(n['created_at']),
                        style: AppType.micro.copyWith(color: AppColors.textHint),
                      ),
                    ],
                  ),
                ),
                if (unread)
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: AppColors.warning,
                      shape: BoxShape.circle,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  _InfoRow(
                    icon: Icons.receipt_long_rounded,
                    iconColor: AppColors.textSecondary,
                    label: 'Total billed',
                    value: '₹${billed.toStringAsFixed(2)}',
                  ),
                  _InfoRow(
                    icon: Icons.check_circle_outline_rounded,
                    iconColor: AppColors.success,
                    label: 'Total paid',
                    value: '₹${paid.toStringAsFixed(2)}',
                  ),
                  const Divider(height: 16),
                  _InfoRow(
                    icon: Icons.account_balance_wallet_rounded,
                    iconColor: AppColors.error,
                    label: 'Outstanding due',
                    value: '₹${due.toStringAsFixed(2)}',
                    bold: true,
                    valueColor: AppColors.error,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Please pay your delivery agent at your earliest convenience.',
              style: AppType.small.copyWith(
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Generic (alert / info) Card ───────────────────────────────────────────────

class _GenericCard extends StatelessWidget {
  final dynamic notification;
  final VoidCallback onTap;
  const _GenericCard({required this.notification, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final isAlert = n['type'] == 'alert';
    final unread = _isUnread(n);

    return GestureDetector(
      onTap: onTap,
      child: PremiumCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        color: unread ? AppColors.primaryLight : AppColors.cardBg,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isAlert
                    ? AppColors.error.withValues(alpha: 0.10)
                    : AppColors.primary.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isAlert
                    ? Icons.warning_amber_rounded
                    : Icons.info_outline_rounded,
                color: isAlert ? AppColors.error : AppColors.primary,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    n['title'] ?? '',
                    style: (unread ? AppType.captionBold : AppType.caption)
                        .copyWith(color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    n['body'] ?? '',
                    style: AppType.small.copyWith(
                        color: AppColors.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _relativeTime(n['created_at']),
                    style: AppType.micro.copyWith(color: AppColors.textHint),
                  ),
                ],
              ),
            ),
            if (unread)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Shared row widget for breakdown tables ────────────────────────────────────

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;

  const _InfoRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    this.bold = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, size: 14, color: iconColor),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: AppType.small.copyWith(color: AppColors.textSecondary),
            ),
          ),
          Text(
            value,
            style: (bold ? AppType.captionBold : AppType.small).copyWith(
              color: valueColor ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
