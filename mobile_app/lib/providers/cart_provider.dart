import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/error_handler.dart';

class CartProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  Map<String, dynamic>? _tomorrowStatus;
  Map<String, dynamic>? get tomorrowStatus => _tomorrowStatus;

  List<dynamic> get extraItems => _tomorrowStatus?['extra_items'] ?? [];
  Map<String, dynamic>? get effectiveMilk => _tomorrowStatus?['effective_milk'];
  bool get isSkipped => _tomorrowStatus?['is_skipped'] == true;
  bool get isLocked => _tomorrowStatus?['is_locked'] == true;
  double get totalAmount => (_tomorrowStatus?['total_amount'] ?? 0).toDouble();

  List<dynamic> _products = [];
  List<dynamic> get products => _products;
  bool _productsLoaded = false;
  Future<void>? _productsLoadFuture;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> loadTomorrowStatus() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await _api.get('/tomorrow/status');
      _tomorrowStatus = res['data'];
    } catch (e) {
      _error = ErrorHandler.message(e);
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadProducts({bool forceRefresh = false}) {
    if (!forceRefresh && _productsLoaded) return Future.value();
    if (!forceRefresh && _productsLoadFuture != null) {
      return _productsLoadFuture!;
    }

    _productsLoadFuture = _loadProducts(forceRefresh: forceRefresh);
    return _productsLoadFuture!;
  }

  Future<void> _loadProducts({required bool forceRefresh}) async {
    try {
      final res = await _api.get('/products');
      _products = res['data']?['products'] ?? [];
      _productsLoaded = true;
      notifyListeners();
    } catch (_) {
      if (forceRefresh) _productsLoaded = false;
    } finally {
      _productsLoadFuture = null;
    }
  }

  Future<bool> modifyQuantity(double quantity) async {
    try {
      final res = await _api.post('/tomorrow/modify', {'modified_quantity': quantity});
      _tomorrowStatus = res['data'];
      notifyListeners();
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      notifyListeners();
      return false;
    }
  }

  Future<bool> skipTomorrow() async {
    try {
      final res = await _api.post('/tomorrow/skip', {});
      _tomorrowStatus = res['data'];
      notifyListeners();
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      notifyListeners();
      return false;
    }
  }

  Future<bool> revertOverride() async {
    try {
      final res = await _api.delete('/tomorrow/override');
      _tomorrowStatus = res['data'];
      notifyListeners();
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      notifyListeners();
      return false;
    }
  }

  Future<bool> addItem(String productId, int quantity) async {
    try {
      final res = await _api.post('/cart/tomorrow/add-item', {
        'product_id': productId,
        'quantity': quantity,
      });
      _tomorrowStatus = res['data'];
      notifyListeners();
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      notifyListeners();
      return false;
    }
  }

  Future<bool> removeItem(String productId) async {
    try {
      final res = await _api.delete('/cart/tomorrow/remove-item/$productId');
      _tomorrowStatus = res['data'];
      notifyListeners();
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      notifyListeners();
      return false;
    }
  }
}
