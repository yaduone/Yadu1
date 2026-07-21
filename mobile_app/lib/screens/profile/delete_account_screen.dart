import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';

class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  static const _reasons = [
    'I no longer need the service',
    'I\'m switching to a different provider',
    'The service quality wasn\'t satisfactory',
    'Too expensive for me',
    'I have privacy concerns',
    'I created a duplicate account',
    'Other',
  ];

  String? _selectedReason;
  final _otherController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _otherController.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _selectedReason != null &&
      (_selectedReason != 'Other' || _otherController.text.trim().isNotEmpty);

  Future<void> _submit() async {
    final authProvider = context.read<AppAuthProvider>();
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('Confirm Account Deletion'),
        content: const Text(
          'Your account and all personal data will be permanently removed within 30 days.\n\nAnonymised order records may be retained for accounting purposes.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Delete My Account',
                style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _submitting = true);
    try {
      await authProvider.requestDeletion();
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
              'Deletion request submitted. Your account will be removed within 30 days.'),
          duration: Duration(seconds: 5),
        ),
      );
      nav.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    } catch (_) {
      if (mounted) {
        messenger.showSnackBar(
          const SnackBar(
              content: Text('Failed to submit request. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
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
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Delete Account', style: AppType.h2),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                  color: AppColors.error.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded,
                    color: AppColors.error, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'This action is irreversible. Your data will be permanently deleted within 30 days.',
                    style: AppType.small
                        .copyWith(color: AppColors.error),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 28),

          Text('Why are you deleting your account?',
              style: AppType.bodyBold),
          const SizedBox(height: 6),
          Text('Your feedback helps us improve.',
              style: AppType.small.copyWith(color: AppColors.textSecondary)),

          const SizedBox(height: 16),

          PremiumCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: _reasons.asMap().entries.map((entry) {
                final index = entry.key;
                final reason = entry.value;
                final isLast = index == _reasons.length - 1;
                return Column(
                  children: [
                    InkWell(
                      onTap: () => setState(() => _selectedReason = reason),
                      borderRadius: BorderRadius.circular(
                          isLast && _selectedReason != 'Other' ? 0 : 0),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 14),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(reason, style: AppType.caption),
                            ),
                            const SizedBox(width: 12),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: _selectedReason == reason
                                      ? AppColors.primary
                                      : AppColors.divider,
                                  width: 2,
                                ),
                                color: _selectedReason == reason
                                    ? AppColors.primary
                                    : Colors.transparent,
                              ),
                              child: _selectedReason == reason
                                  ? const Icon(Icons.check,
                                      size: 12, color: Colors.white)
                                  : null,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (!isLast)
                      Divider(
                          height: 1,
                          indent: 20,
                          endIndent: 20,
                          color: AppColors.divider),
                  ],
                );
              }).toList(),
            ),
          ),

          if (_selectedReason == 'Other') ...[
            const SizedBox(height: 16),
            PremiumCard(
              child: TextField(
                controller: _otherController,
                maxLines: 3,
                maxLength: 200,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Tell us more...',
                  hintStyle:
                      AppType.caption.copyWith(color: AppColors.textHint),
                  border: InputBorder.none,
                  counterStyle: AppType.micro
                      .copyWith(color: AppColors.textHint),
                ),
                style: AppType.caption,
              ),
            ),
          ],

          const SizedBox(height: 36),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_canSubmit && !_submitting) ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                disabledBackgroundColor:
                    AppColors.error.withValues(alpha: 0.3),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text('Request Account Deletion',
                      style: AppType.captionBold
                          .copyWith(color: Colors.white)),
            ),
          ),

          const SizedBox(height: 16),

          Center(
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Cancel',
                  style: AppType.caption
                      .copyWith(color: AppColors.textSecondary)),
            ),
          ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
