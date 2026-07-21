import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../utils/transitions.dart';
import '../../widgets/premium_components.dart';
import '../dues/due_screen.dart';

class HelpSupportScreen extends StatelessWidget {
  const HelpSupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        leading: _BackButton(context),
        title: Text('Help & Support', style: AppType.h2),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: AppColors.divider),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        children: const [
          _Header(),
          SizedBox(height: 24),
          _SectionLabel('Frequently Asked Questions'),
          SizedBox(height: 12),
          _FaqGroup(
            title: 'Subscriptions',
            icon: Icons.repeat_rounded,
            faqs: [
              _Faq(
                q: 'How do I start a milk subscription?',
                a: 'Go to the Subscription tab, tap "Create Subscription", choose your milk type (Cow, Buffalo, or Child Pack), quantity (0.5 L–10 L), delivery slot (Morning, Evening, or Both), and a start date. Your first delivery will begin on the selected date.',
              ),
              _Faq(
                q: 'Can I change my milk quantity for tomorrow?',
                a: 'Yes. Open the Home screen and modify your cart quantity before 9:00 PM IST. Changes made after the cutoff will apply to the day after tomorrow.',
              ),
              _Faq(
                q: 'How do I pause or cancel my subscription?',
                a: 'Go to the Subscription tab and tap Pause or Cancel. Pausing stops deliveries but keeps your preferences. Cancellation is permanent — you will need to create a new subscription to resume delivery.',
              ),
              _Faq(
                q: 'Will the price change after I subscribe?',
                a: 'No. Your per-litre price is locked when you subscribe. Any future price updates by YaduONE only apply to new subscriptions.',
              ),
              _Faq(
                q: 'Can I have more than one subscription?',
                a: 'Only one active or paused subscription is allowed per account at a time.',
              ),
            ],
          ),
          SizedBox(height: 12),
          _FaqGroup(
            title: 'Orders & Delivery',
            icon: Icons.local_shipping_outlined,
            faqs: [
              _Faq(
                q: 'What is the order cutoff time?',
                a: 'All cart changes — adding, updating, or removing extra products — must be made before 9:00 PM IST. Orders are finalised by the nightly processing job at approximately 11:00 PM IST.',
              ),
              _Faq(
                q: 'When will my order be confirmed?',
                a: 'Orders are confirmed after the nightly job runs (~11:00 PM IST). You will receive an in-app notification once your order is confirmed.',
              ),
              _Faq(
                q: 'What are the delivery timings?',
                a: 'Morning slot: approximately 5–7 AM IST. Evening slot: approximately 5–7 PM IST. Exact times depend on your area delivery person and may vary slightly.',
              ),
              _Faq(
                q: 'What if my delivery is missed?',
                a: 'If a delivery is missed due to our error, please raise a support ticket within 24 hours. Go to the Dues screen, switch to the "My Tickets" tab, and tap "Raise a Ticket".',
              ),
              _Faq(
                q: 'Which areas do you deliver to?',
                a: 'YaduONE currently delivers in Bareilly and Satellite. We are expanding — if your area is not yet serviceable, check back soon or contact us.',
              ),
            ],
          ),
          SizedBox(height: 12),
          _FaqGroup(
            title: 'Payments & Dues',
            icon: Icons.account_balance_wallet_outlined,
            faqs: [
              _Faq(
                q: 'How does billing work?',
                a: 'YaduONE uses a post-paid dues model. Your delivery charges accumulate as a due balance, which you settle periodically with your area delivery person (cash, UPI, or any mutually agreed method).',
              ),
              _Faq(
                q: 'Where can I see my balance?',
                a: 'Your current due balance is displayed on the Dues screen (the wallet icon in the bottom navigation).',
              ),
              _Faq(
                q: 'There is a discrepancy in my balance — what do I do?',
                a: 'Raise a support ticket from the Dues screen. Describe the issue and your area admin will review and correct the balance if needed.',
              ),
            ],
          ),
          SizedBox(height: 12),
          _FaqGroup(
            title: 'Account & Profile',
            icon: Icons.person_outline_rounded,
            faqs: [
              _Faq(
                q: 'How do I update my name or address?',
                a: 'Go to Profile → tap the edit icon at the top of your profile card. You can update your name, delivery address, and area.',
              ),
              _Faq(
                q: 'How do I delete my account?',
                a: 'Raise a support ticket from the Dues screen requesting account deletion. We will process it within 30 days. All personal data will be removed; anonymised order records may be retained for reporting.',
              ),
              _Faq(
                q: 'I am not receiving notifications — how do I fix this?',
                a: 'Check that notifications are enabled for YaduONE in your device Settings → Apps → YaduONE → Notifications. Also make sure you have a stable internet connection.',
              ),
            ],
          ),
          SizedBox(height: 28),
          _SectionLabel('Contact Us'),
          SizedBox(height: 12),
          _ContactSection(),
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
          child: const Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 18,
            color: AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}

// ─── Header ──────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header();

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
            child: const Icon(
              Icons.support_agent_rounded,
              size: 32,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'We\'re here to help',
            style: AppType.h2,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Find answers to common questions below, or reach out to our support team directly.',
            style: AppType.caption.copyWith(
              color: AppColors.textSecondary,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─── Section label ────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppType.captionBold.copyWith(color: AppColors.textSecondary),
    );
  }
}

// ─── FAQ group ────────────────────────────────────────────────────────────────

class _Faq {
  final String q;
  final String a;
  const _Faq({required this.q, required this.a});
}

class _FaqGroup extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<_Faq> faqs;

  const _FaqGroup({
    required this.title,
    required this.icon,
    required this.faqs,
  });

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
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
                const SizedBox(width: 10),
                Text(title, style: AppType.h3),
              ],
            ),
          ),
          const Divider(height: 1, indent: 16),
          ...faqs.map((faq) => _FaqTile(faq: faq)),
        ],
      ),
    );
  }
}

class _FaqTile extends StatefulWidget {
  final _Faq faq;
  const _FaqTile({required this.faq});

  @override
  State<_FaqTile> createState() => _FaqTileState();
}

class _FaqTileState extends State<_FaqTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: Text(widget.faq.q, style: AppType.captionBold)),
                const SizedBox(width: 8),
                AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 20,
                    color: AppColors.textHint,
                  ),
                ),
              ],
            ),
          ),
        ),
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 200),
          crossFadeState: _expanded
              ? CrossFadeState.showFirst
              : CrossFadeState.showSecond,
          firstChild: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Text(
              widget.faq.a,
              style: AppType.caption.copyWith(
                color: AppColors.textSecondary,
                height: 1.65,
              ),
            ),
          ),
          secondChild: const SizedBox.shrink(),
        ),
        const Divider(height: 1, indent: 16),
      ],
    );
  }
}

// ─── Contact section ──────────────────────────────────────────────────────────

class _ContactSection extends StatelessWidget {
  const _ContactSection();

  Future<void> _openWhatsApp() async {
    final appUri = Uri.parse('whatsapp://send?phone=919286734980');
    final webUri = Uri.parse('https://wa.me/919286734980');

    try {
      if (await launchUrl(appUri, mode: LaunchMode.externalApplication)) {
        return;
      }
    } catch (_) {
      // Use the web handoff when WhatsApp is not installed.
    }

    await launchUrl(webUri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _ContactTile(
          icon: Icons.mail_outline_rounded,
          label: 'Email Support',
          value: 'yaduone111@gmail.com',
          onTap: () => launchUrl(Uri.parse('mailto:yaduone111@gmail.com')),
          trailing: const Icon(
            Icons.open_in_new_rounded,
            size: 16,
            color: AppColors.textHint,
          ),
        ),
        const SizedBox(height: 10),
        _ContactTile(
          icon: Icons.call_rounded,
          label: 'Call Support',
          value: '+91 92867 34980',
          onTap: () => launchUrl(Uri.parse('tel:+919286734980')),
          trailing: const Icon(
            Icons.open_in_new_rounded,
            size: 16,
            color: AppColors.textHint,
          ),
        ),
        const SizedBox(height: 10),
        _ContactTile(
          icon: Icons.chat_bubble_outline_rounded,
          label: 'WhatsApp Support',
          value: '+91 92867 34980',
          onTap: _openWhatsApp,
          trailing: const Icon(
            Icons.open_in_new_rounded,
            size: 16,
            color: AppColors.textHint,
          ),
        ),
        const SizedBox(height: 10),
        _ContactTile(
          icon: Icons.confirmation_number_outlined,
          label: 'Raise a Support Ticket',
          value: 'For billing, delivery, or account issues',
          onTap: () =>
              Navigator.push(context, SlideUpRoute(page: const DueScreen())),
          trailing: const Icon(
            Icons.arrow_forward_ios_rounded,
            size: 14,
            color: AppColors.textHint,
          ),
          valueStyle: AppType.small.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
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
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.access_time_rounded,
                  size: 22,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Support Hours',
                      style: AppType.captionBold.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Mon – Sat, 9:00 AM – 6:00 PM IST\nWe typically respond within 24 hours.',
                      style: AppType.small.copyWith(
                        color: Colors.white.withValues(alpha: 0.85),
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ContactTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;
  final Widget trailing;
  final TextStyle? valueStyle;

  const _ContactTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
    required this.trailing,
    this.valueStyle,
  });

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, size: 20, color: AppColors.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: AppType.captionBold),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      style:
                          valueStyle ??
                          AppType.caption.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
              trailing,
            ],
          ),
        ),
      ),
    );
  }
}
