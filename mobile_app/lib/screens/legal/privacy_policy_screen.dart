import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        leading: _BackButton(context),
        title: Text('Privacy Policy', style: AppType.h2),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: AppColors.divider),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        children: const [
          _PolicyHeader(
            icon: Icons.shield_outlined,
            title: 'Your Privacy Matters',
            subtitle:
                'We collect only what we need to deliver your milk. Here\'s exactly what we do with your data.',
            lastUpdated: 'Last updated: April 25, 2026',
          ),
          SizedBox(height: 24),
          _Section(
            number: '1',
            title: 'Information We Collect',
            children: [
              _SubSection(
                title: 'Account Information',
                body:
                    'When you register, we collect your mobile phone number for OTP-based authentication via Firebase. We do not collect email addresses or passwords.',
              ),
              _SubSection(
                title: 'Profile Information',
                body:
                    'To deliver to your door, we collect your full name, delivery area, and address (street, landmark, pincode). This is required to process your orders.',
              ),
              _SubSection(
                title: 'Order & Subscription Data',
                body:
                    'We store your milk subscription preferences (type, quantity, delivery slot), daily cart modifications, order history, and payment dues. This data powers your delivery experience.',
              ),
              _SubSection(
                title: 'Device & Usage Data',
                body:
                    'We collect basic device information (OS version, app version) and usage logs to diagnose errors and improve the app. We do not track your location in the background.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '2',
            title: 'How We Use Your Information',
            children: [
              _BulletItem(
                  icon: Icons.local_shipping_outlined,
                  text: 'Process and deliver your daily milk and product orders'),
              _BulletItem(
                  icon: Icons.notifications_outlined,
                  text:
                      'Send delivery reminders, order confirmations, and service updates'),
              _BulletItem(
                  icon: Icons.account_balance_wallet_outlined,
                  text: 'Track and manage your payment dues and transaction history'),
              _BulletItem(
                  icon: Icons.support_agent_outlined,
                  text: 'Respond to your support tickets and resolve disputes'),
              _BulletItem(
                  icon: Icons.bar_chart_outlined,
                  text:
                      'Generate anonymised delivery reports for operational efficiency'),
              _BulletItem(
                  icon: Icons.security_outlined,
                  text: 'Detect and prevent fraud, abuse, and unauthorised access'),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '3',
            title: 'Data Storage & Security',
            children: [
              _SubSection(
                title: 'Where Your Data Lives',
                body:
                    'Your data is stored in Google Firebase Firestore and Firebase Authentication, hosted on Google Cloud infrastructure in India. Product images are stored in Firebase Storage.',
              ),
              _SubSection(
                title: 'How We Protect It',
                body:
                    'All data is transmitted over HTTPS/TLS. Authentication uses Firebase\'s industry-standard OTP system. Admin access is protected by bcrypt-hashed passwords and JWT tokens with 24-hour expiry. We apply rate limiting to prevent brute-force attacks.',
              ),
              _SubSection(
                title: 'Retention',
                body:
                    'Order history is retained for 2 years for accounting purposes. If you delete your account, your personal profile and subscription data are removed within 30 days. Order records may be retained in anonymised form for reporting.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '4',
            title: 'Sharing Your Information',
            children: [
              _SubSection(
                title: 'We Do Not Sell Your Data',
                body:
                    'YaduONE does not sell, rent, or trade your personal information to any third party for marketing purposes.',
              ),
              _SubSection(
                title: 'Service Providers',
                body:
                    'We share data only with the following trusted service providers who help us operate the app: Google Firebase (authentication, database, storage) and Google Cloud (hosting). These providers are bound by strict data processing agreements.',
              ),
              _SubSection(
                title: 'Legal Requirements',
                body:
                    'We may disclose your information if required by law, court order, or government authority, or to protect the rights and safety of YaduONE, our users, or the public.',
              ),
              _SubSection(
                title: 'Delivery Personnel',
                body:
                    'Your name, address, and order details are shared with the area delivery team (managed by your area admin) solely for the purpose of completing your delivery.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '5',
            title: 'Your Rights',
            children: [
              _BulletItem(
                  icon: Icons.visibility_outlined,
                  text:
                      'Access: View all your personal data through the Profile screen in the app'),
              _BulletItem(
                  icon: Icons.edit_outlined,
                  text:
                      'Correction: Update your name, address, and area at any time from your profile'),
              _BulletItem(
                  icon: Icons.delete_outline_rounded,
                  text:
                      'Deletion: Request account deletion by raising a support ticket — we\'ll process it within 30 days'),
              _BulletItem(
                  icon: Icons.download_outlined,
                  text:
                      'Portability: Request a copy of your order history and account data via support'),
              _BulletItem(
                  icon: Icons.block_outlined,
                  text:
                      'Opt-out: Disable notifications at any time from your device settings'),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '6',
            title: 'Cookies & Tracking',
            children: [
              _SubSection(
                title: 'Mobile App',
                body:
                    'The YaduONE mobile app does not use browser cookies. We use Firebase Analytics (anonymised) to understand feature usage and improve the app. No cross-app tracking is performed.',
              ),
              _SubSection(
                title: 'Push Notifications',
                body:
                    'We may send push notifications for delivery updates and reminders. You can disable these at any time in your device\'s notification settings.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '7',
            title: 'Children\'s Privacy',
            children: [
              _SubSection(
                title: '',
                body:
                    'YaduONE is not directed at children under 13 years of age. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '8',
            title: 'Changes to This Policy',
            children: [
              _SubSection(
                title: '',
                body:
                    'We may update this Privacy Policy from time to time. When we make significant changes, we will notify you via an in-app notification. Continued use of the app after changes constitutes acceptance of the updated policy. The "Last updated" date at the top of this page reflects the most recent revision.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _ContactCard(),
          SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ─── Back button ─────────────────────────────────────────────────────────────

class _BackButton extends StatelessWidget {
  final BuildContext ctx;
  const _BackButton(this.ctx);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: GestureDetector(
        onTap: () => Navigator.pop(ctx),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceBg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.arrow_back_ios_new_rounded,
              size: 18, color: AppColors.textPrimary),
        ),
      ),
    );
  }
}

// ─── Header ──────────────────────────────────────────────────────────────────

class _PolicyHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String lastUpdated;

  const _PolicyHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.lastUpdated,
  });

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(icon, size: 32, color: AppColors.primary),
          ),
          const SizedBox(height: 16),
          Text(title,
              style: AppType.h2, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: AppType.caption.copyWith(
                color: AppColors.textSecondary, height: 1.6),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surfaceBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              lastUpdated,
              style: AppType.micro.copyWith(color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Section ─────────────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  final String number;
  final String title;
  final List<Widget> children;

  const _Section({
    required this.number,
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Text(
                    number,
                    style: AppType.micro.copyWith(
                        color: Colors.white, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(title, style: AppType.h3),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(height: 1),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}

// ─── Sub-section ─────────────────────────────────────────────────────────────

class _SubSection extends StatelessWidget {
  final String title;
  final String body;

  const _SubSection({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title.isNotEmpty) ...[
            Text(title, style: AppType.captionBold),
            const SizedBox(height: 4),
          ],
          Text(
            body,
            style: AppType.caption.copyWith(
                color: AppColors.textSecondary, height: 1.65),
          ),
        ],
      ),
    );
  }
}

// ─── Bullet item ─────────────────────────────────────────────────────────────

class _BulletItem extends StatelessWidget {
  final IconData icon;
  final String text;

  const _BulletItem({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 16, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                text,
                style: AppType.caption.copyWith(
                    color: AppColors.textSecondary, height: 1.55),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Contact card ─────────────────────────────────────────────────────────────

class _ContactCard extends StatelessWidget {
  const _ContactCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.mail_outline_rounded,
                    size: 20, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Text('Questions?',
                  style: AppType.h3.copyWith(color: Colors.white)),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'If you have any questions about this Privacy Policy or how we handle your data, raise a support ticket from the Dues screen or contact us directly.',
            style: AppType.caption.copyWith(
                color: Colors.white.withValues(alpha: 0.85), height: 1.6),
          ),
          const SizedBox(height: 16),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: Colors.white.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.alternate_email_rounded,
                    size: 16, color: Colors.white),
                const SizedBox(width: 8),
                Text(
                  'support@yaduone.in',
                  style: AppType.captionBold.copyWith(color: Colors.white),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
