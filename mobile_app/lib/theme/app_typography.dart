import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// YaduONE premium type scale.
///
/// All styles use Plus Jakarta Sans for a clean, modern geometric feel.
/// Scale follows the spec: Display 32 → H1 24 → H2 20 → Body 16 → Caption 14 → Micro 12.
class AppType {
  AppType._();

  static String get _fontFamily => GoogleFonts.plusJakartaSans().fontFamily!;

  // ──── Display ────────────────────────────────────────────────
  /// 32px, weight 800, -3% tracking.  Hero headings.
  static TextStyle get display => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 32,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.96, // -3% of 32
        height: 1.15,
      );

  // ──── H1 ─────────────────────────────────────────────────────
  /// 24px, weight 800.  Section titles.
  static TextStyle get h1 => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 24,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
        height: 1.25,
      );

  // ──── H2 ─────────────────────────────────────────────────────
  /// 20px, weight 700.  Card titles.
  static TextStyle get h2 => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 20,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
        height: 1.3,
      );

  // ──── H3 ─────────────────────────────────────────────────────
  /// 17px, weight 700.  Sub-headings.
  static TextStyle get h3 => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 17,
        fontWeight: FontWeight.w700,
        height: 1.35,
      );

  // ──── Body ───────────────────────────────────────────────────
  /// 16px, weight 400.  Default paragraph text.
  static TextStyle get body => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 1.5,
      );

  /// Body bold.
  static TextStyle get bodyBold => body.copyWith(fontWeight: FontWeight.w600);

  // ──── Caption ────────────────────────────────────────────────
  /// 14px, weight 400.  Supporting text.
  static TextStyle get caption => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.45,
      );

  /// Caption bold.
  static TextStyle get captionBold =>
      caption.copyWith(fontWeight: FontWeight.w600);

  // ──── Small ──────────────────────────────────────────────────
  /// 13px, weight 500.  Hints, timestamps.
  static TextStyle get small => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 13,
        fontWeight: FontWeight.w500,
        height: 1.4,
      );

  // ──── Micro ──────────────────────────────────────────────────
  /// 12px, weight 600, uppercase.  Labels, badges.
  static TextStyle get micro => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 12,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.8,
        height: 1.3,
      );

  /// Micro uppercase.
  static TextStyle get microUpper => micro.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: 1.0,
      );

  // ──── Button ─────────────────────────────────────────────────
  /// 16px, weight 700.  Button labels.
  static TextStyle get button => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 16,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.2,
        height: 1.0,
      );

  // ──── Number ─────────────────────────────────────────────────
  /// 40px, weight 800.  Hero numbers (stepper quantity).
  static TextStyle get heroNumber => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 40,
        fontWeight: FontWeight.w800,
        letterSpacing: -1,
        height: 1.0,
      );

  /// 28px, weight 900.  Price display.
  static TextStyle get price => TextStyle(
        fontFamily: _fontFamily,
        fontSize: 28,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.5,
        height: 1.1,
      );
}
