import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PremiumCard — zero-border white card with soft primary-tinted shadow
// ═══════════════════════════════════════════════════════════════════════════════

class PremiumCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? color;
  final double borderRadius;

  const PremiumCard({
    super.key,
    required this.child,
    this.padding,
    this.color,
    this.borderRadius = 24,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color ?? AppColors.cardBg,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.08),
            blurRadius: 32,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SectionLabel — uppercase section header
// ═══════════════════════════════════════════════════════════════════════════════

class SectionLabel extends StatelessWidget {
  final String text;
  const SectionLabel(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: AppType.microUpper.copyWith(color: AppColors.textHint),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HapticStepper — +/- with haptic feedback & large quantity display
// ═══════════════════════════════════════════════════════════════════════════════

class HapticStepper extends StatelessWidget {
  final double value;
  final double step;
  final double min;
  final double max;
  final ValueChanged<double> onChanged;
  final String? suffix;

  const HapticStepper({
    super.key,
    required this.value,
    required this.onChanged,
    this.step = 0.5,
    this.min = 0.5,
    this.max = 10,
    this.suffix,
  });

  void _decrement() {
    if (value > min) {
      HapticFeedback.lightImpact();
      onChanged(value - step);
    }
  }

  void _increment() {
    if (value < max) {
      HapticFeedback.lightImpact();
      onChanged(value + step);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canDec = value > min;
    final canInc = value < max;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _circleButton(Icons.remove_rounded, canDec ? _decrement : null),
        SizedBox(
          width: 100,
          child: Center(
            child: Text(
              '${value % 1 == 0 ? value.toInt() : value}${suffix ?? 'L'}',
              style: AppType.heroNumber.copyWith(color: AppColors.textPrimary),
            ),
          ),
        ),
        _circleButton(Icons.add_rounded, canInc ? _increment : null),
      ],
    );
  }

  Widget _circleButton(IconData icon, VoidCallback? onTap) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: enabled ? AppColors.primary : AppColors.border,
          shape: BoxShape.circle,
          boxShadow: enabled
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : [],
        ),
        child: Icon(icon, color: enabled ? Colors.white : AppColors.textHint, size: 26),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SkeletonLoader — shimmer placeholder mimicking card shapes
// ═══════════════════════════════════════════════════════════════════════════════

class SkeletonLoader extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const SkeletonLoader({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = 24,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.border,
      highlightColor: AppColors.surfaceBg,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// A skeleton that mimics a full card with title + subtitle + icon row.
class SkeletonCardLoader extends StatelessWidget {
  const SkeletonCardLoader({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.border,
      highlightColor: AppColors.surfaceBg,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                const SizedBox(width: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(width: 120, height: 14, color: Colors.white),
                    const SizedBox(height: 8),
                    Container(width: 80, height: 10, color: Colors.white),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(width: double.infinity, height: 44, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AutoSavePill — floating pill "✓ Updated for tomorrow"
// ═══════════════════════════════════════════════════════════════════════════════

class AutoSavePill extends StatelessWidget {
  final bool visible;
  final String text;

  const AutoSavePill({
    super.key,
    required this.visible,
    this.text = '✓ Updated for tomorrow',
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedSlide(
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
      offset: visible ? Offset.zero : const Offset(0, -2),
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 250),
        opacity: visible ? 1 : 0,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.success,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                color: AppColors.success.withValues(alpha: 0.3),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Text(
            text,
            style: AppType.small.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WalletPill — tappable wallet balance pill (green/amber)
// ═══════════════════════════════════════════════════════════════════════════════

class WalletPill extends StatelessWidget {
  final double amount;
  final VoidCallback onTap;

  const WalletPill({super.key, required this.amount, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final hasDue = amount > 0;
    final bgColor = hasDue 
        ? const Color(0xFFFFF7ED) // warm amber bg
        : const Color(0xFFECFDF5); // mint green bg
    final fgColor = hasDue ? const Color(0xFFD97706) : AppColors.success;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: fgColor.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.account_balance_wallet_rounded,
              size: 16,
              color: fgColor,
            ),
            const SizedBox(width: 6),
            Text(
              hasDue ? '₹${amount.toStringAsFixed(0)}' : 'Clear',
              style: AppType.small.copyWith(
                color: fgColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TrustBadge — "FSSAI Approved", "Farm to Door in 12 Hours", etc
// ═══════════════════════════════════════════════════════════════════════════════

class TrustBadge extends StatelessWidget {
  final IconData icon;
  final String label;

  const TrustBadge({super.key, required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.success),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppType.micro.copyWith(
              color: AppColors.success,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

/// Horizontal row of trust badges.
class TrustBadgeRow extends StatelessWidget {
  const TrustBadgeRow({super.key});

  @override
  Widget build(BuildContext context) {
    return const Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        TrustBadge(icon: Icons.verified_rounded, label: 'FSSAI Approved'),
        TrustBadge(icon: Icons.schedule_rounded, label: 'Farm to Door in 12 Hrs'),
        TrustBadge(icon: Icons.lock_rounded, label: 'Encrypted OTP'),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// StatefulAvatar — user initial with green ring when subscription active
// ═══════════════════════════════════════════════════════════════════════════════

class StatefulAvatar extends StatelessWidget {
  final String name;
  final bool isSubscriptionActive;
  final double size;

  const StatefulAvatar({
    super.key,
    required this.name,
    this.isSubscriptionActive = false,
    this.size = 72,
  });

  @override
  Widget build(BuildContext context) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';
    final ringColor = isSubscriptionActive 
        ? AppColors.success 
        : Colors.transparent;

    return Container(
      width: size + 8,
      height: size + 8,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: ringColor,
          width: isSubscriptionActive ? 3 : 0,
        ),
      ),
      child: Center(
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primary, AppColors.primaryDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              initial,
              style: TextStyle(
                fontSize: size * 0.42,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// StickyBottomBar — white-to-transparent gradient bottom bar
// ═══════════════════════════════════════════════════════════════════════════════

class StickyBottomBar extends StatelessWidget {
  final Widget child;

  const StickyBottomBar({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.white.withValues(alpha: 0),
            Colors.white.withValues(alpha: 0.9),
            Colors.white,
          ],
          stops: const [0.0, 0.3, 0.5],
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        20, 16, 20,
        MediaQuery.of(context).padding.bottom + 16,
      ),
      child: child,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GlassContainer — frosted glass effect for glassmorphism panels
// ═══════════════════════════════════════════════════════════════════════════════

class GlassContainer extends StatelessWidget {
  final Widget child;
  final double borderRadius;
  final double blur;
  final Color color;

  const GlassContainer({
    super.key,
    required this.child,
    this.borderRadius = 36,
    this.blur = 20,
    this.color = const Color(0xD9FFFFFF), // white 85% opacity
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.vertical(top: Radius.circular(borderRadius)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.vertical(top: Radius.circular(borderRadius)),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.3),
              width: 1,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
