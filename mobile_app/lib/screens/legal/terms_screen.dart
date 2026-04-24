import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        leading: _BackButton(context),
        title: Text('Terms of Service', style: AppType.h2),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: AppColors.divider),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        children: const [
          _PolicyHeader(
            icon: Icons.gavel_rounded,
            title: 'Terms of Service',
            subtitle:
                'By using YaduONE, you agree to these terms. Please read them — they\'re written in plain language.',
            lastUpdated: 'Last updated: April 25, 2026',
          ),
          SizedBox(height: 24),
          _Section(
            number: '1',
            title: 'Acceptance of Terms',
            children: [
              _BodyText(
                'By downloading, installing, or using the YaduONE mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, please do not use the App.',
              ),
              _BodyText(
                'These Terms apply to all users of the App, including customers who subscribe to milk delivery and order dairy products.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '2',
            title: 'About YaduONE',
            children: [
              _BodyText(
                'YaduONE ("we", "us", "our") is a dairy delivery platform that enables customers to subscribe to daily milk delivery and order fresh dairy products (curd, paneer, ghee, butter, etc.) for home delivery.',
              ),
              _BodyText(
                'The App operates on an area-based model. Delivery is available only in serviceable areas (currently Rajendranagar and Satellite). Availability may change without prior notice.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '3',
            title: 'Account Registration',
            children: [
              _BulletItem(
                  icon: Icons.phone_android_outlined,
                  text:
                      'You must provide a valid Indian mobile number to register. OTP verification is mandatory.'),
              _BulletItem(
                  icon: Icons.person_outline_rounded,
                  text:
                      'You must complete your profile (name, area, delivery address) before placing orders or creating a subscription.'),
              _BulletItem(
                  icon: Icons.lock_outline_rounded,
                  text:
                      'You are responsible for maintaining the security of your account. Do not share your OTP with anyone.'),
              _BulletItem(
                  icon: Icons.warning_amber_outlined,
                  text:
                      'One account per mobile number. Creating multiple accounts to abuse promotions or credits is prohibited.'),
              _BulletItem(
                  icon: Icons.person_off_outlined,
                  text:
                      'You must be at least 18 years old to create an account and place orders.'),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '4',
            title: 'Subscriptions',
            children: [
              _SubSection(
                title: 'Creating a Subscription',
                body:
                    'You may subscribe to daily milk delivery by selecting a milk type (Cow, Buffalo, or Toned), quantity (0.5L–10L in 0.5L increments), delivery slot (Morning, Evening, or Both), and start date.',
              ),
              _SubSection(
                title: 'Pricing',
                body:
                    'The price per litre is locked at the time you create your subscription. Future price changes by YaduONE will not affect your existing subscription until you cancel and re-subscribe.',
              ),
              _SubSection(
                title: 'Modifying Delivery',
                body:
                    'You may modify tomorrow\'s milk quantity or skip a delivery until the cutoff time (9:00 PM IST). Changes after the cutoff apply to the day after tomorrow. Modifications are free of charge.',
              ),
              _SubSection(
                title: 'Pausing & Cancellation',
                body:
                    'You may pause your subscription at any time. A paused subscription stops milk delivery but retains your preferences. Cancellation is permanent — you must create a new subscription to resume delivery. Cancelled subscriptions cannot be reinstated.',
              ),
              _SubSection(
                title: 'One Active Subscription',
                body:
                    'Only one active or paused subscription is permitted per account at any time.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '5',
            title: 'Orders & Extra Products',
            children: [
              _SubSection(
                title: 'Placing Orders',
                body:
                    'In addition to your subscription milk, you may add extra dairy products (curd, paneer, ghee, etc.) to your daily cart. Extra items are added to the same delivery as your milk.',
              ),
              _SubSection(
                title: 'Order Cutoff',
                body:
                    'All cart modifications (adding, updating, or removing extra items) must be made before 9:00 PM IST to apply to the next day\'s delivery. Orders are finalised by the nightly processing job.',
              ),
              _SubSection(
                title: 'Order Confirmation',
                body:
                    'Orders are confirmed after the nightly processing job runs (approximately 11:00 PM IST). You will receive an in-app notification once your order is confirmed.',
              ),
              _SubSection(
                title: 'Product Availability',
                body:
                    'Product availability and pricing may change. Prices shown in the app at the time of adding to cart are the prices charged.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '6',
            title: 'Payments & Dues',
            children: [
              _SubSection(
                title: 'Payment Method',
                body:
                    'YaduONE operates on a post-paid dues model. Your delivery charges accumulate as a due balance, which is settled periodically with your area delivery person (cash, UPI, or other methods as agreed).',
              ),
              _SubSection(
                title: 'Due Balance',
                body:
                    'Your current due balance is visible in the app. Payments are recorded by your area admin. You may raise a support ticket if you believe there is a discrepancy in your balance.',
              ),
              _SubSection(
                title: 'Non-Payment',
                body:
                    'YaduONE reserves the right to suspend or cancel your subscription if dues remain unpaid for an extended period. We will notify you before taking such action.',
              ),
              _SubSection(
                title: 'Price Changes',
                body:
                    'YaduONE may update milk prices at any time. New prices apply to new subscriptions only. You will be notified of price changes via in-app notification.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '7',
            title: 'Delivery',
            children: [
              _BulletItem(
                  icon: Icons.local_shipping_outlined,
                  text:
                      'Delivery is performed by area-specific delivery personnel managed by your area admin.'),
              _BulletItem(
                  icon: Icons.schedule_outlined,
                  text:
                      'Morning slot: approximately 5–7 AM. Evening slot: approximately 5–7 PM. Exact times may vary.'),
              _BulletItem(
                  icon: Icons.location_off_outlined,
                  text:
                      'Delivery is only available within serviceable areas. We are not responsible for failed deliveries due to incorrect or inaccessible addresses.'),
              _BulletItem(
                  icon: Icons.event_busy_outlined,
                  text:
                      'Deliveries may be affected by public holidays, severe weather, or other unforeseen circumstances. We will notify you of any disruptions.'),
              _BulletItem(
                  icon: Icons.replay_outlined,
                  text:
                      'If a delivery is missed due to our error, please raise a support ticket within 24 hours for resolution.'),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '8',
            title: 'Prohibited Conduct',
            children: [
              _BodyText('You agree not to:'),
              _BulletItem(
                  icon: Icons.block_outlined,
                  text:
                      'Use the App for any unlawful purpose or in violation of any applicable laws'),
              _BulletItem(
                  icon: Icons.bug_report_outlined,
                  text:
                      'Attempt to hack, reverse-engineer, or disrupt the App or its backend services'),
              _BulletItem(
                  icon: Icons.person_off_outlined,
                  text:
                      'Impersonate another user, admin, or YaduONE representative'),
              _BulletItem(
                  icon: Icons.auto_fix_off_outlined,
                  text:
                      'Use automated scripts or bots to interact with the App'),
              _BulletItem(
                  icon: Icons.report_outlined,
                  text:
                      'Submit false or misleading information in your profile or support tickets'),
              _BulletItem(
                  icon: Icons.share_outlined,
                  text:
                      'Share your account credentials or allow others to use your account'),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '9',
            title: 'Intellectual Property',
            children: [
              _BodyText(
                'All content in the YaduONE App — including the name, logo, design, text, graphics, and software — is the property of YaduONE and is protected by applicable intellectual property laws.',
              ),
              _BodyText(
                'You may not copy, reproduce, distribute, or create derivative works from any part of the App without our prior written consent.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '10',
            title: 'Disclaimers & Limitation of Liability',
            children: [
              _SubSection(
                title: 'Service Availability',
                body:
                    'The App is provided "as is". We do not guarantee uninterrupted or error-free service. We may perform maintenance that temporarily affects availability.',
              ),
              _SubSection(
                title: 'Product Quality',
                body:
                    'While we strive to deliver fresh, high-quality dairy products, YaduONE is not liable for any health issues arising from product consumption. Please inspect your delivery upon receipt and raise a ticket immediately if there is a quality concern.',
              ),
              _SubSection(
                title: 'Limitation of Liability',
                body:
                    'To the maximum extent permitted by law, YaduONE\'s total liability to you for any claim arising from use of the App shall not exceed the amount you paid for the specific order in question.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '11',
            title: 'Termination',
            children: [
              _BodyText(
                'You may stop using the App at any time. You may request account deletion by raising a support ticket.',
              ),
              _BodyText(
                'We reserve the right to suspend or terminate your account without notice if you violate these Terms, engage in fraudulent activity, or if we discontinue the service in your area.',
              ),
              _BodyText(
                'Upon termination, your subscription will be cancelled and any outstanding dues remain payable.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '12',
            title: 'Changes to Terms',
            children: [
              _BodyText(
                'We may update these Terms from time to time. When we make material changes, we will notify you via an in-app notification at least 7 days before the changes take effect.',
              ),
              _BodyText(
                'Continued use of the App after the effective date of updated Terms constitutes your acceptance of the new Terms.',
              ),
            ],
          ),
          SizedBox(height: 16),
          _Section(
            number: '13',
            title: 'Governing Law',
            children: [
              _BodyText(
                'These Terms are governed by the laws of India. Any disputes arising from these Terms or your use of the App shall be subject to the exclusive jurisdiction of the courts in Ahmedabad, Gujarat, India.',
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
          Text(title, style: AppType.h2, textAlign: TextAlign.center),
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
              Expanded(child: Text(title, style: AppType.h3)),
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

// ─── Body text ───────────────────────────────────────────────────────────────

class _BodyText extends StatelessWidget {
  final String text;
  const _BodyText(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: AppType.caption.copyWith(
            color: AppColors.textSecondary, height: 1.65),
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
                child: const Icon(Icons.help_outline_rounded,
                    size: 20, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Text('Need Help?',
                  style: AppType.h3.copyWith(color: Colors.white)),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'If you have questions about these Terms or need to report a violation, please raise a support ticket from the Dues screen or contact us directly.',
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
