import 'package:flutter/material.dart';
import '../services/api_service.dart';

class SubscriptionProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  Map<String, dynamic>? _subscription;
  Map<String, dynamic>? get subscription => _subscription;
  bool get hasActiveSubscription =>
      _subscription != null && (_subscription!['status'] == 'active' || _subscription!['status'] == 'paused');

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  Future<void> loadSubscription() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/subscriptions/active');
      _subscription = res['data']?['subscription'];
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> createSubscription({
    required String milkType,
    required double quantity,
    required String startDate,
    required String deliverySlot,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await _api.post('/subscriptions', {
        'milk_type': milkType,
        'quantity_litres': quantity,
        'start_date': startDate,
        'delivery_slot': deliverySlot,
      });
      _subscription = res['data']?['subscription'];
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> pauseSubscription() async {
    if (_subscription == null) return false;
    try {
      await _api.put('/subscriptions/${_subscription!['id']}/pause', {});
      _subscription!['status'] = 'paused';
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> resumeSubscription() async {
    if (_subscription == null) return false;
    try {
      await _api.put('/subscriptions/${_subscription!['id']}/resume', {});
      _subscription!['status'] = 'active';
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> cancelSubscription() async {
    if (_subscription == null) return false;
    try {
      await _api.put('/subscriptions/${_subscription!['id']}/cancel', {});
      _subscription = null;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
}
