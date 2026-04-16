import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';

class BottomNavCurvePainter extends CustomPainter {
  final Color backgroundColor;
  final double insetRadius;

  const BottomNavCurvePainter({
    this.backgroundColor = Colors.white,
    this.insetRadius = 38,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = backgroundColor
      ..style = PaintingStyle.fill;

    final path = Path()..moveTo(0, 12);

    final insetCurveBeginX = size.width / 2 - insetRadius;
    final insetCurveEndX = size.width / 2 + insetRadius;
    final transitionWidth = size.width * .05;

    path.quadraticBezierTo(
        size.width * 0.20, 0, insetCurveBeginX - transitionWidth, 0);
    path.quadraticBezierTo(
        insetCurveBeginX, 0, insetCurveBeginX, insetRadius / 2);
    path.arcToPoint(Offset(insetCurveEndX, insetRadius / 2),
        radius: const Radius.circular(10.0), clockwise: false);
    path.quadraticBezierTo(
        insetCurveEndX, 0, insetCurveEndX + transitionWidth, 0);
    path.quadraticBezierTo(size.width * 0.80, 0, size.width, 12);
    path.lineTo(size.width, size.height + 56);
    path.lineTo(0, size.height + 56);

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Curved bottom navigation bar.
///
/// [currentIndex] maps to: 0=Home, 1=Reports, 2=Cart, 3=Profile.
/// [onTap] is called with the same indices.
/// [onFabPressed] is called when the centre FAB is tapped.
class CurvedNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final VoidCallback onFabPressed;

  const CurvedNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.onFabPressed,
  });

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    const height = 56.0;

    return BottomAppBar(
      color: Colors.transparent,
      elevation: 0,
      padding: EdgeInsets.zero,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Curved white background
          CustomPaint(
            size: Size(size.width, height + 7),
            painter: const BottomNavCurvePainter(backgroundColor: Colors.white),
          ),

          // Centre FAB — Home
          Positioned(
            left: 0,
            right: 0,
            top: -(38 / 2) + 4,
            child: Center(
              child: FloatingActionButton(
                shape: const CircleBorder(),
                backgroundColor: AppColors.primary,
                elevation: 4,
                onPressed: () => onTap(0),
                child: const Icon(
                  CupertinoIcons.home,
                  color: Colors.white,
                ),
              ),
            ),
          ),

          // Nav icons
          SizedBox(
            height: height,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavIcon(
                  icon: Icons.insights_rounded,
                  label: 'Reports',
                  selected: currentIndex == 1,
                  onPressed: () => onTap(1),
                ),
                _NavIcon(
                  icon: Icons.shopping_bag_rounded,
                  label: 'Cart',
                  selected: currentIndex == 2,
                  onPressed: () => onTap(2),
                ),
                const SizedBox(width: 56), // Home FAB gap
                _NavIcon(
                  icon: Icons.live_tv_rounded,
                  label: 'Live',
                  selected: false,
                  onPressed: onFabPressed,
                ),
                _NavIcon(
                  icon: CupertinoIcons.person,
                  label: 'Profile',
                  selected: currentIndex == 3,
                  onPressed: () => onTap(3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NavIcon extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onPressed;

  const _NavIcon({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      tooltip: label,
      icon: CircleAvatar(
        backgroundColor:
            selected ? AppColors.primary.withAlpha(20) : Colors.transparent,
        child: Icon(
          icon,
          size: 22,
          color: selected ? AppColors.primary : AppColors.textHint,
        ),
      ),
    );
  }
}
