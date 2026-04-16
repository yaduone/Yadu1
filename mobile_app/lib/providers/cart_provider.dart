import 'package:flutter/material.dart';
import '../services/api_service.dart';

class CartProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  Map<String, dynamic>? _tomorrowStatus;
  Map<String, dynamic>? get tomorrowStatus => _tomorrowStatus;

  List<dynamic> get extraItems => _tomorrowStatus?['extra_items'] ?? [];
  Map<String, dynamic>? get effectiveMilk => _tomorrowStatus?['effective_milk'];
  bool get isSkipped => _tomorrowStatus?['is_skipped'] == true;
  double get totalAmount => (_tomorrowStatus?['total_amount'] ?? 0).toDouble();

  List<dynamic> _products = [];
  List<dynamic> get products => _products;

  bool _isLoading = false;
  bool get isLoading => _isLoading;
  String? _error;
  String? get error => _error;

  Future<void> loadTomorrowStatus() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/tomorrow/status');
      _tomorrowStatus = res['data'];
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadProducts() async {
    try {
      final res = await _api.get('/products');
      _products = res['data']?['products'] ?? [];
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> modifyQuantity(double quantity) async {
    try {
      final res = await _api.post('/tomorrow/modify', {'modified_quantity': quantity});
      _tomorrowStatus = res['data'];
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
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
      _error = e.toString();
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
      _error = e.toString();
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
      _error = e.toString();
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
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }
}
