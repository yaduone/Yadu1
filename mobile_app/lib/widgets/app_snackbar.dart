import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';

enum SnackType { error, success, warning, info }

/// Centralized snackbar helper.
/// Usage: AppSnackbar.show(context, 'Something went wrong', type: SnackType.error);
class AppSnackbar {
  AppSnackbar._();

  static void show(
    BuildContext context,
    String message, {
    SnackType type = SnackType.error,
    Duration duration = const Duration(seconds: 4),
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    final config = _config(type);

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(config.icon, color: Colors.white, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: AppType.small.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          backgroundColor: config.color,
          behavior: SnackBarBehavior.floating,
          duration: duration,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          action: actionLabel != null
              ? SnackBarAction(
                  label: actionLabel,
                  textColor: Colors.white,
                  onPressed: onAction ?? () {},
                )
              : null,
        ),
      );
  }

  static void error(BuildContext context, String message, {String? actionLabel, VoidCallback? onAction}) =>
      show(context, message, type: SnackType.error, actionLabel: actionLabel, onAction: onAction);

  static void success(BuildContext context, String message) =>
      show(context, message, type: SnackType.success, duration: const Duration(seconds: 3));

  static void warning(BuildContext context, String message) =>
      show(context, message, type: SnackType.warning);

  static void info(BuildContext context, String message) =>
      show(context, message, type: SnackType.info);

  static _SnackConfig _config(SnackType type) {
    switch (type) {
      case SnackType.error:
        return _SnackConfig(AppColors.error, Icons.error_outline_rounded);
      case SnackType.success:
        return _SnackConfig(AppColors.success, Icons.check_circle_outline_rounded);
      case SnackType.warning:
        return _SnackConfig(AppColors.warning, Icons.warning_amber_rounded);
      case SnackType.info:
        return _SnackConfig(AppColors.primary, Icons.info_outline_rounded);
    }
  }
}

class _SnackConfig {
  final Color color;
  final IconData icon;
  const _SnackConfig(this.color, this.icon);
}

/// Inline error banner — used inside forms/cards instead of snackbars.
class InlineErrorBanner extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const InlineErrorBanner({
    super.key,
    required this.message,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOutCubic,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline_rounded,
                size: 18, color: AppColors.error),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: AppType.small.copyWith(
                  color: AppColors.error,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: onRetry,
                child: Text(
                  'Retry',
                  style: AppType.small.copyWith(
                    color: AppColors.error,
                    fontWeight: FontWeight.w700,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Full-screen error state — used when a screen fails to load entirely.
class FullScreenError extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final IconData icon;

  const FullScreenError({
    super.key,
    required this.message,
    this.onRetry,
    this.icon = Icons.wifi_off_rounded,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(icon, size: 40, color: AppColors.error),
            ),
            const SizedBox(height: 20),
            Text(
              message,
              style: AppType.body.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Try Again'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(160, 48),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
