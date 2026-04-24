import 'package:flutter/material.dart';
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService().get('/notifications?limit=50');
      setState(() {
        _notifications = res['data']?['notifications'] ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
        title: Text('Notifications', style: AppType.h2),
      ),
      body: _loading
          ? Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: List.generate(
                  5,
                  (_) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: SkeletonLoader(height: 72, borderRadius: 20),
                  ),
                ),
              ),
            )
          : _notifications.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.notifications_off_outlined,
                          size: 56, color: AppColors.textHint),
                      const SizedBox(height: 16),
                      Text('No notifications',
                          style: AppType.caption
                              .copyWith(color: AppColors.textSecondary)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(20),
                  itemCount: _notifications.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final n = _notifications[i];
                    final isAlert = n['type'] == 'alert';
                    final isRead = n['is_read'] == true;

                    return PremiumCard(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                      color:
                          isRead ? AppColors.cardBg : AppColors.primaryLight,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: isAlert
                                  ? AppColors.error.withValues(alpha: 0.1)
                                  : AppColors.primary
                                      .withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              isAlert
                                  ? Icons.warning_amber_rounded
                                  : Icons.info_outline_rounded,
                              color: isAlert
                                  ? AppColors.error
                                  : AppColors.primary,
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
                                  style: (isRead
                                          ? AppType.caption
                                          : AppType.captionBold)
                                      .copyWith(
                                          color: AppColors.textPrimary),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  n['body'] ?? '',
                                  style: AppType.small.copyWith(
                                      color: AppColors.textSecondary,
                                      height: 1.4),
                                ),
                              ],
                            ),
                          ),
                          if (!isRead)
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
                    );
                  },
                ),
    );
  }
}
