import 'package:flutter/material.dart';

import '../services/update_service.dart';
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';

/// The "a new version is available" popup.
///
/// When [info.forceUpdate] is set the dialog is barrier- and back-proof: the
/// only way out is to update. Otherwise the user can dismiss it and be asked
/// again on the next launch.
class UpdateDialog extends StatefulWidget {
  final UpdateInfo info;

  const UpdateDialog({super.key, required this.info});

  /// Shows the dialog. Completes once the user dismisses it, or never (for a
  /// forced update the app stays parked here until Play takes over).
  static Future<void> show(BuildContext context, UpdateInfo info) {
    return showDialog<void>(
      context: context,
      barrierDismissible: !info.forceUpdate,
      builder: (_) => UpdateDialog(info: info),
    );
  }

  @override
  State<UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<UpdateDialog> {
  bool _busy = false;

  Future<void> _update() async {
    if (_busy) return;
    setState(() => _busy = true);

    // Prefer Play's in-app flow — it installs without leaving the app. A forced
    // update uses the immediate (blocking) variant; a nudge uses flexible.
    final handled = await UpdateService.tryPlayInAppUpdate(
      immediate: widget.info.forceUpdate,
    );

    if (!handled) {
      await UpdateService.openStore(widget.info.storeUrl);
    }

    if (!mounted) return;
    setState(() => _busy = false);

    // Keep a forced dialog on screen — the user has not updated yet, and the
    // Play listing opened in another task.
    if (!widget.info.forceUpdate) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    final forced = info.forceUpdate;

    return PopScope(
      canPop: !forced,
      child: Dialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 28),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.primaryLight,
                  ),
                  child: const Icon(
                    Icons.system_update_rounded,
                    size: 36,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                forced ? 'Update required' : 'Update available',
                textAlign: TextAlign.center,
                style: AppType.h2.copyWith(color: AppColors.textPrimary),
              ),
              const SizedBox(height: 10),
              Text(
                forced
                    ? 'This version of YaduOne is no longer supported. Please '
                        'update to continue using the app.'
                    : 'A new version of YaduOne is available on the Play Store '
                        'with the latest improvements and fixes.',
                textAlign: TextAlign.center,
                style: AppType.body.copyWith(color: AppColors.textSecondary),
              ),
              if (info.latestVersion.isNotEmpty) ...[
                const SizedBox(height: 12),
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Version ${info.latestVersion}',
                      style: AppType.captionBold
                          .copyWith(color: AppColors.primary),
                    ),
                  ),
                ),
              ],
              if (info.releaseNotes.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.scaffoldBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    info.releaseNotes,
                    style: AppType.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _busy ? null : _update,
                child: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Update now'),
              ),
              if (!forced) ...[
                const SizedBox(height: 4),
                TextButton(
                  onPressed:
                      _busy ? null : () => Navigator.of(context).pop(),
                  child: Text(
                    'Later',
                    style: AppType.button
                        .copyWith(color: AppColors.textSecondary),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
