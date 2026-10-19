import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/error_handler.dart';

class SubscriptionProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  static const Map<String, double> _fallbackPrices = {
    'cow': 60,
    'buffalo': 70,
    'toned': 50,
  };

  Map<String, dynamic>? _subscription;
  Map<String, dynamic>? get subscription => _subscription;
  bool get hasActiveSubscription =>
      _subscription != null &&
      (_subscription!['status'] == 'active' ||
          _subscription!['status'] == 'paused');

  Map<String, double> _milkPrices = Map.of(_fallbackPrices);
  Map<String, double> get milkPrices => Map.unmodifiable(_milkPrices);
  bool _pricesLoaded = false;
  bool get pricesLoaded => _pricesLoaded;
  bool _isPricesLoading = false;
  bool get isPricesLoading => _isPricesLoading;
  Future<void>? _pricesLoadFuture;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _loadingAction;
  bool get isActionLoading => _loadingAction != null;
  bool get isPausing => _loadingAction == 'pause';
  bool get isResuming => _loadingAction == 'resume';
  bool get isCancelling => _loadingAction == 'cancel';
  bool get isUpdatingQuantity => _loadingAction == 'quantity';
  bool get isSkipping => _loadingAction == 'skip';

  String? _error;
  String? get error => _error;

  // Earliest allowed subscription start date — mirrors the backend's cutoff-aware
  // cart target date, so the create-subscription date picker never offers a date
  // the server will reject.
  DateTime? _earliestStartDate;
  DateTime? get earliestStartDate => _earliestStartDate;
  Future<void>? _earliestStartDateLoadFuture;

  Future<void> loadEarliestStartDate({bool forceRefresh = false}) {
    if (!forceRefresh && _earliestStartDate != null) return Future.value();
    if (_earliestStartDateLoadFuture != null) return _earliestStartDateLoadFuture!;
    _earliestStartDateLoadFuture = _loadEarliestStartDate();
    return _earliestStartDateLoadFuture!;
  }

  Future<void> _loadEarliestStartDate() async {
    try {
      final res = await _api.get('/tomorrow/status');
      final dateStr = res['data']?['date'] as String?;
      if (dateStr != null) {
        _earliestStartDate = DateTime.parse(dateStr);
        notifyListeners();
      }
    } catch (_) {
      // Fall back silently — caller uses a same-day+1 default if this never loads.
    } finally {
      _earliestStartDateLoadFuture = null;
    }
  }

  double priceForMilkType(String milkType) {
    return _milkPrices[milkType] ?? _fallbackPrices[milkType] ?? 0;
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> loadPrices({bool forceRefresh = false}) {
    if (!forceRefresh && _pricesLoaded) return Future.value();
    if (_pricesLoadFuture != null) {
      return _pricesLoadFuture!;
    }

    _pricesLoadFuture = _loadPrices();
    return _pricesLoadFuture!;
  }

  Future<void> _loadPrices() async {
    _isPricesLoading = true;
    notifyListeners();

    try {
      final res = await _api.get('/prices');
      final prices = res['data']?['prices'];
      final nextPrices = Map<String, double>.of(_fallbackPrices);

      if (prices is List) {
        for (final item in prices) {
          if (item is! Map) continue;
          final milkType = item['milk_type'];
          final price = item['price_per_litre'];
          if (milkType is String && price is num) {
            nextPrices[milkType] = price.toDouble();
          }
        }
      }

      _milkPrices = nextPrices;
      _pricesLoaded = true;
    } catch (_) {
      _pricesLoaded = false;
    } finally {
      _isPricesLoading = false;
      _pricesLoadFuture = null;
      notifyListeners();
    }
  }

  Future<void> loadSubscription() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await _api.get('/subscriptions/active');
      _subscription = res['data']?['subscription'];
    } catch (e) {
      _error = ErrorHandler.message(e);
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
      _error = ErrorHandler.message(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // The first delivery date a lifecycle change takes effect from, as reported
  // by the backend. Past an area's cutoff this is the day after tomorrow,
  // because tomorrow's manifest is already committed — so the UI must tell the
  // customer the real date instead of implying "from tomorrow".
  String? _effectiveFrom;
  String? get effectiveFrom => _effectiveFrom;

  /// Runs a pause/resume/cancel transition.
  ///
  /// Only one action may be in flight at a time, and the new local state is
  /// adopted from the server response rather than guessed, so the screen can
  /// never disagree with the backend about the resulting status.
  Future<bool> _runLifecycleAction(
    String action,
    Future<Map<String, dynamic>> Function() request,
  ) async {
    if (_subscription == null || _loadingAction != null) return false;
    _loadingAction = action;
    _error = null;
    _effectiveFrom = null;
    notifyListeners();
    try {
      final res = await request();
      final data = res['data'];
      if (data is Map) {
        final effectiveFrom = data['effective_from'];
        if (effectiveFrom is String) _effectiveFrom = effectiveFrom;

        final status = data['status'];
        if (status == 'cancelled') {
          _subscription = null;
        } else if (status is String) {
          _subscription!['status'] = status;
          if (effectiveFrom is String) {
            _subscription!['effective_from'] = effectiveFrom;
          }
        }
      }
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      return false;
    } finally {
      _loadingAction = null;
      notifyListeners();
    }
  }

  Future<bool> pauseSubscription() => _runLifecycleAction(
        'pause',
        () => _api.put('/subscriptions/${_subscription!['id']}/pause', {}),
      );

  Future<bool> resumeSubscription() => _runLifecycleAction(
        'resume',
        () => _api.put('/subscriptions/${_subscription!['id']}/resume', {}),
      );

  Future<bool> cancelSubscription() => _runLifecycleAction(
        'cancel',
        () => _api.put('/subscriptions/${_subscription!['id']}/cancel', {}),
      );

  Future<bool> updateQuantity(double newQuantity) async {
    if (_subscription == null || _loadingAction != null) return false;
    _loadingAction = 'quantity';
    _error = null;
    notifyListeners();
    try {
      await _api.put('/subscriptions/${_subscription!['id']}/quantity', {
        'quantity_litres': newQuantity,
      });
      _subscription!['quantity_litres'] = newQuantity;
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      return false;
    } finally {
      _loadingAction = null;
      notifyListeners();
    }
  }

  Future<bool> skipTomorrow() async {
    if (_subscription == null || _loadingAction != null) return false;
    _loadingAction = 'skip';
    _error = null;
    notifyListeners();
    try {
      await _api.post('/tomorrow/skip', {});
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      return false;
    } finally {
      _loadingAction = null;
      notifyListeners();
    }
  }
}
