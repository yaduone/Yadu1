import 'package:flutter/material.dart';

/// Light-purple palette for the Instant Delivery experience.
///
/// Mirrors the key names of [AppColors] so instant widgets can swap palettes
/// cleanly. Applied only while Instant mode is active (storefront, instant cart,
/// the ⚡ cart pill, and the bottom-nav accent).
class InstantColors {
  InstantColors._();

  static const Color primary = Color(0xFF7C3AED); // violet-600
  static const Color primaryDark = Color(0xFF6D28D9); // violet-700
  static const Color primaryLight = Color(0xFFF3EEFF); // very light lavender

  static const Color scaffoldBg = Color(0xFFFBFAFF);
  static const Color surfaceBg = Color(0xFFF4F0FB);

  static const Color textPrimary = Color(0xFF2A1A4A);
  static const Color textSecondary = Color(0xFF7A6B96);
  static const Color textHint = Color(0xFFB1A6C8);

  static const Color border = Color(0xFFE9E2F7);

  static const Color success = Color(0xFF10B981);
  static const Color error = Color(0xFFEF4444);

  static const LinearGradient gradient = LinearGradient(
    colors: [Color(0xFF7C3AED), Color(0xFF9D5CF5)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
