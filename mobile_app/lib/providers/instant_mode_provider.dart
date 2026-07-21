import 'package:flutter/foundation.dart';

/// Tracks whether the app is currently showing the Instant Delivery experience.
/// Drives the light-purple chrome (storefront, cart, bottom-nav accent).
class InstantModeProvider extends ChangeNotifier {
  bool _isInstant = false;
  bool get isInstant => _isInstant;

  void setInstant(bool value) {
    if (_isInstant == value) return;
    _isInstant = value;
    notifyListeners();
  }

  void toggle() => setInstant(!_isInstant);
}
