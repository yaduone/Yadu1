import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A wrapper that adds a press-down scale + opacity animation to any child.
/// Drop-in replacement for [GestureDetector] / [InkWell] for premium feel.
class Tappable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scaleFactor;
  final Duration duration;
  final HapticFeedbackType haptic;
  final bool enableFeedback;

  const Tappable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scaleFactor = 0.96,
    this.duration = const Duration(milliseconds: 120),
    this.haptic = HapticFeedbackType.light,
    this.enableFeedback = true,
  });

  @override
  State<Tappable> createState() => _TappableState();
}

class _TappableState extends State<Tappable>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _scale = Tween<double>(begin: 1.0, end: widget.scaleFactor).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails _) {
    if (widget.onTap == null && widget.onLongPress == null) return;
    _ctrl.forward();
  }

  void _onTapUp(TapUpDetails _) {
    _ctrl.reverse();
    if (widget.enableFeedback) _triggerHaptic();
    widget.onTap?.call();
  }

  void _onTapCancel() => _ctrl.reverse();

  void _triggerHaptic() {
    switch (widget.haptic) {
      case HapticFeedbackType.light:
        HapticFeedback.lightImpact();
      case HapticFeedbackType.medium:
        HapticFeedback.mediumImpact();
      case HapticFeedbackType.heavy:
        HapticFeedback.heavyImpact();
      case HapticFeedbackType.selection:
        HapticFeedback.selectionClick();
      case HapticFeedbackType.none:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _onTapDown,
      onTapUp: _onTapUp,
      onTapCancel: _onTapCancel,
      onLongPress: widget.onLongPress,
      behavior: HitTestBehavior.opaque,
      child: ScaleTransition(scale: _scale, child: widget.child),
    );
  }
}

enum HapticFeedbackType { light, medium, heavy, selection, none }
