import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/api_service.dart';
import '../services/cart_cache_service.dart';
import '../utils/error_handler.dart';
import '../models/pending_cart_item.dart';
import '../models/cart_charge.dart';

class CartProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final CartCacheService _cache = CartCacheService();

  Map<String, dynamic>? _tomorrowStatus;
  Map<String, dynamic>? get tomorrowStatus => _tomorrowStatus;
  Future<void>? _tomorrowStatusLoadFuture;

  // Confirmed cart items from the server (already sent to global cart)
  List<dynamic> get extraItems => _tomorrowStatus?['extra_items'] ?? [];
  
  // Pending cart items (not yet confirmed/sent to server)
  final List<PendingCartItem> _pendingCartItems = [];
  List<PendingCartItem> get pendingCartItems => List.unmodifiable(_pendingCartItems);
  
  // Check if there are any unconfirmed changes
  bool get hasPendingChanges => _pendingCartItems.isNotEmpty;
  
  // Combined total of confirmed + pending items
  double get totalAmount {
    final confirmedTotal = (_tomorrowStatus?['total_amount'] ?? 0).toDouble();
    final pendingTotal = _pendingCartItems.fold<double>(
      0,
      (sum, item) => sum + item.total,
    );
    return confirmedTotal + pendingTotal;
  }
  
  // Original confirmed cart total (without pending items)
  double get confirmedTotal => (_tomorrowStatus?['total_amount'] ?? 0).toDouble();
  
  // Pending cart total
  double get pendingTotal => _pendingCartItems.fold<double>(
    0,
    (sum, item) => sum + item.total,
  );

  // Configurable cart-confirmation charges for scheduled deliveries
  List<CartCharge> _charges = [];
  List<CartCharge> get charges => List.unmodifiable(_charges);
  bool _chargesLoaded = false;
  Future<void>? _chargesLoadFuture;

  double get chargesTotal => CartCharge.totalOf(_charges);

  /// Grand total including confirmed items, pending items, and extra charges.
  double get grandTotal => totalAmount + chargesTotal;

  Future<void> loadCharges({bool forceRefresh = false}) {
    if (!forceRefresh && _chargesLoaded) return Future.value();
    if (!forceRefresh && _chargesLoadFuture != null) return _chargesLoadFuture!;
    _chargesLoadFuture = _loadCharges();
    return _chargesLoadFuture!;
  }

  Future<void> _loadCharges() async {
    try {
      final res = await _api.get('/settings/charges/app?type=scheduled');
      _charges = CartCharge.listFromJson(res['data']?['charges']);
      _chargesLoaded = true;
      notifyListeners();
    } catch (_) {
      // Charges are optional — a failure just means none are shown.
    } finally {
      _chargesLoadFuture = null;
    }
  }

  Map<String, dynamic>? get effectiveMilk => _tomorrowStatus?['effective_milk'];
  bool get isSkipped => _tomorrowStatus?['is_skipped'] == true;
  bool get isLocked => _tomorrowStatus?['is_locked'] == true;

  List<dynamic> _products = [];
  List<dynamic> get products => _products;
  bool _productsLoaded = false;
  bool get productsLoaded => _productsLoaded;
  Future<void>? _productsLoadFuture;

  List<dynamic> _categories = [];
  List<dynamic> get categories => _categories;
  bool _categoriesLoaded = false;
  bool get categoriesLoaded => _categoriesLoaded;
  Future<void>? _categoriesLoadFuture;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> ensureTomorrowStatusLoaded() {
    if (_tomorrowStatus != null) return Future.value();
    return loadTomorrowStatus();
  }

  Future<void> loadTomorrowStatus() {
    if (_tomorrowStatusLoadFuture != null) {
      return _tomorrowStatusLoadFuture!;
    }

    _tomorrowStatusLoadFuture = _loadTomorrowStatus();
    return _tomorrowStatusLoadFuture!;
  }

  Future<void> _loadTomorrowStatus() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await _api.get('/tomorrow/status');
      _tomorrowStatus = res['data'];
      await _restorePendingFromCache();
    } catch (e) {
      _error = ErrorHandler.message(e);
    } finally {
      _isLoading = false;
      _tomorrowStatusLoadFuture = null;
      notifyListeners();
    }
  }

  // ── Local pending-cart persistence ──────────────────────────────────────────

  String? get _cacheUserId => FirebaseAuth.instance.currentUser?.uid;
  String? get _cacheTargetDate => _tomorrowStatus?['date'] as String?;

  /// Restores locally-saved (unconfirmed) changes for the current user and
  /// target date. Stale entries (different user/date) are dropped by the cache.
  Future<void> _restorePendingFromCache() async {
    final userId = _cacheUserId;
    final targetDate = _cacheTargetDate;
    if (userId == null || targetDate == null) return;

    final cached = await _cache.load(userId: userId, targetDate: targetDate);
    _pendingCartItems
      ..clear()
      ..addAll(cached);
    // Caller (`notifyListeners` in finally / mutation methods) refreshes the UI.
  }

  /// Persists the current pending cart to local storage (fire-and-forget).
  void _persistPendingCart() {
    final userId = _cacheUserId;
    final targetDate = _cacheTargetDate;
    if (userId == null || targetDate == null) return;
    _cache.save(
      userId: userId,
      targetDate: targetDate,
      items: _pendingCartItems,
    );
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

  Future<void> loadCategories({bool forceRefresh = false}) {
    if (!forceRefresh && _categoriesLoaded) return Future.value();
    if (!forceRefresh && _categoriesLoadFuture != null) {
      return _categoriesLoadFuture!;
    }

    _categoriesLoadFuture = _loadCategories(forceRefresh: forceRefresh);
    return _categoriesLoadFuture!;
  }

  Future<void> _loadCategories({required bool forceRefresh}) async {
    try {
      final res = await _api.get('/categories');
      _categories = res['data']?['categories'] ?? [];
      _categoriesLoaded = true;
      notifyListeners();
    } catch (_) {
      if (forceRefresh) _categoriesLoaded = false;
    } finally {
      _categoriesLoadFuture = null;
    }
  }

  Future<bool> modifyQuantity(double quantity) async {
    try {
      final res = await _api.post('/tomorrow/modify', {
        'modified_quantity': quantity,
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

  /// Add an item to the pending cart (not yet confirmed to server)
  void addPendingItem(PendingCartItem item) {
    final existingIndex = _pendingCartItems.indexWhere(
      (i) => i.productId == item.productId,
    );

    if (existingIndex >= 0) {
      _pendingCartItems[existingIndex] = _pendingCartItems[existingIndex].copyWith(
        quantity: _pendingCartItems[existingIndex].quantity + item.quantity,
      );
    } else {
      _pendingCartItems.add(item);
    }
    _persistPendingCart();
    notifyListeners();
  }

  /// Update quantity of a pending cart item
  void updatePendingItemQuantity(String productId, int quantity) {
    final index = _pendingCartItems.indexWhere(
      (i) => i.productId == productId,
    );
    
    if (index >= 0) {
      if (quantity <= 0) {
        _pendingCartItems.removeAt(index);
      } else {
        _pendingCartItems[index] = _pendingCartItems[index].copyWith(
          quantity: quantity,
        );
      }
      _persistPendingCart();
      notifyListeners();
    }
  }

  /// Remove an item from the pending cart
  void removePendingItem(String productId) {
    _pendingCartItems.removeWhere((i) => i.productId == productId);
    _persistPendingCart();
    notifyListeners();
  }

  /// Clear all pending cart items
  void clearPendingCart() {
    _pendingCartItems.clear();
    _persistPendingCart();
    notifyListeners();
  }

  /// Confirm all pending cart items and send them to the server.
  ///
  /// Items are flushed one-by-one; any that succeed are dropped from the
  /// pending cart (and the local cache) so a partial failure can be retried
  /// without re-adding already-confirmed items.
  Future<bool> confirmPendingCart() async {
    if (_pendingCartItems.isEmpty) return true;

    final confirmed = <String>[];
    try {
      for (final item in List<PendingCartItem>.from(_pendingCartItems)) {
        final res = await _api.post('/cart/tomorrow/add-item', {
          'product_id': item.productId,
          'quantity': item.quantity,
        });
        _tomorrowStatus = res['data'];
        confirmed.add(item.productId);
      }
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      return false;
    } finally {
      _pendingCartItems.removeWhere((i) => confirmed.contains(i.productId));
      _persistPendingCart();
      notifyListeners();
    }
  }

  /// Add item directly to confirmed cart (legacy method, kept for compatibility)
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

  /// Remove item from confirmed cart on the server
  Future<bool> removeItem(String productId) async {
    try {
      final res = await _api.delete('/cart/tomorrow/remove-item/$productId');
      _tomorrowStatus = res['data'];
      
      // If user removes a confirmed item, show the confirm button again
      notifyListeners();
      return true;
    } catch (e) {
      _error = ErrorHandler.message(e);
      notifyListeners();
      return false;
    }
  }
}
