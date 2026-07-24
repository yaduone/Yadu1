import 'dart:async';

import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/error_handler.dart';
import '../models/cart_charge.dart';

/// State for the Instant Delivery storefront + its server-persisted cart.
/// Mirrors [CartProvider] conventions: each mutation calls the API and replaces
/// the cart with the server's fresh copy.
class InstantProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  /// Allowed delivery-charge selections (default 0 — "free", user may raise it).
  static const List<int> deliveryChargeOptions = [0, 10, 20, 30, 40, 50];

  // ── Cart ──────────────────────────────────────────────────────────────────
  Map<String, dynamic>? _cart;
  Map<String, dynamic>? get cart => _cart;
  Future<void>? _cartLoadFuture;

  /// Quantities the user has tapped but that haven't been flushed to the server
  /// yet, keyed by product id. A value of 0 means "remove". These win over the
  /// server copy so the UI reflects taps immediately; [_flush] drains them.
  final Map<String, int> _localQty = {};

  /// Locally chosen delivery charge, pending flush.
  int? _localDeliveryCharge;

  /// The server's items with [_localQty] applied on top: overridden quantities,
  /// locally-added products appended, and anything zeroed out dropped. This is
  /// what the whole UI renders, so a tap is visible before the network responds.
  List<dynamic> get items {
    final serverItems = (_cart?['items'] as List?) ?? const [];
    if (_localQty.isEmpty) return serverItems;

    final merged = <dynamic>[];
    final seen = <String>{};
    for (final item in serverItems) {
      final id = item['product_id'] as String?;
      if (id != null) seen.add(id);
      final override = _localQty[id];
      if (override == null) {
        merged.add(item);
      } else if (override > 0) {
        final price = (item['price'] as num?)?.toDouble() ?? 0;
        merged.add({...item, 'quantity': override, 'total': override * price});
      }
      // override == 0 → dropped
    }
    for (final entry in _localQty.entries) {
      if (seen.contains(entry.key) || entry.value <= 0) continue;
      final item = _itemFromProduct(entry.key, entry.value);
      if (item != null) merged.add(item);
    }
    return merged;
  }

  /// Builds a cart-item map for a product the server cart doesn't know about
  /// yet, matching the shape the backend returns so widgets need no special
  /// case. Returns null if the catalog hasn't loaded the product.
  Map<String, dynamic>? _itemFromProduct(String productId, int quantity) {
    for (final p in _products) {
      if (p['id'] != productId) continue;
      final price = (p['price'] as num?)?.toDouble() ?? 0;
      return {
        'product_id': productId,
        'product_name': p['name'],
        'quantity': quantity,
        'unit': p['unit'],
        'price': price,
        'total': quantity * price,
      };
    }
    return null;
  }

  int get deliveryCharge =>
      _localDeliveryCharge ?? (_cart?['delivery_charge'] as num?)?.toInt() ?? 0;

  /// Recomputed from [items] rather than read off the server response, so it
  /// tracks unflushed taps. Mirrors the backend's `computeTotals`.
  double get itemsTotal {
    final sum = items.fold<double>(
      0,
      (acc, item) => acc + ((item['total'] as num?)?.toDouble() ?? 0),
    );
    return (sum * 100).roundToDouble() / 100;
  }

  double get totalAmount {
    final sum = itemsTotal + deliveryCharge + extraChargesTotal;
    return (sum * 100).roundToDouble() / 100;
  }

  /// Admin-configured extra charges (platform fee, QA fees, …) for instant.
  List<CartCharge> get extraCharges =>
      CartCharge.listFromJson(_cart?['extra_charges']);
  double get extraChargesTotal =>
      (_cart?['extra_charges_total'] as num?)?.toDouble() ?? 0;

  int get itemCount => items.fold<int>(
        0,
        (sum, item) => sum + ((item['quantity'] as num?)?.toInt() ?? 0),
      );

  bool get isEmpty => items.isEmpty;

  int quantityOf(String productId) {
    final local = _localQty[productId];
    if (local != null) return local;
    for (final item in items) {
      if (item['product_id'] == productId) {
        return (item['quantity'] as num?)?.toInt() ?? 0;
      }
    }
    return 0;
  }

  // ── Catalog ───────────────────────────────────────────────────────────────
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

  bool _mutating = false;
  bool get mutating => _mutating;

  final Set<String> _pendingProductIds = {};
  bool isPending(String productId) => _pendingProductIds.contains(productId);

  String? _error;
  String? get error => _error;

  // ── Order history ────────────────────────────────────────────────────────
  List<dynamic> _orders = [];
  List<dynamic> get orders => _orders;
  bool _ordersLoaded = false;
  bool get ordersLoaded => _ordersLoaded;
  Future<void>? _ordersLoadFuture;

  /// Orders not yet delivered/cancelled/rejected — awaiting the store or on the way.
  List<dynamic> get activeOrders => _orders
      .where((o) => o['status'] == 'pending' || o['status'] == 'acknowledged')
      .toList();

  // ── Availability window ───────────────────────────────────────────────────
  Map<String, dynamic>? _availability;
  Map<String, dynamic>? get availability => _availability;

  /// Whether instant delivery is accepting orders right now. Defaults to true
  /// until the first fetch lands so the storefront doesn't flash a false
  /// "closed" banner on cold start.
  bool get isInstantOpen => _availability?['available'] as bool? ?? true;

  /// e.g. "8:00 AM – 9:00 PM" — always shown, open or closed.
  String? get windowLabel =>
      (_availability?['window'] as Map<String, dynamic>?)?['label'] as String?;

  /// Set when instant delivery is switched off entirely, vs merely out of hours.
  bool get isInstantDisabled => _availability?['reason'] == 'closed';

  int? get minutesUntilClose => (_availability?['minutes_until_close'] as num?)?.toInt();
  int? get minutesUntilOpen => (_availability?['minutes_until_open'] as num?)?.toInt();

  /// Promised delivery time in minutes, shown as "delivered in N minutes".
  int get etaMinutes =>
      ((_availability?['hours'] as Map<String, dynamic>?)?['eta_minutes'] as num?)
          ?.toInt() ??
      30;

  Future<void> loadAvailability() async {
    try {
      final res = await _api.get('/settings/instant-hours/app');
      _availability = res['data'];
      notifyListeners();
    } catch (_) {
      // Non-fatal: keep whatever window we last knew about.
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  Future<void> ensureLoaded() async {
    await Future.wait([
      loadCart(),
      loadProducts(),
      loadCategories(),
      loadAvailability(),
    ]);
  }

  Future<void> loadOrders({bool forceRefresh = false}) {
    if (!forceRefresh && _ordersLoaded) return Future.value();
    if (!forceRefresh && _ordersLoadFuture != null) return _ordersLoadFuture!;
    _ordersLoadFuture = _loadOrders();
    return _ordersLoadFuture!;
  }

  Future<void> _loadOrders() async {
    try {
      final res = await _api.get('/instant/orders?limit=100');
      _orders = res['data']?['orders'] ?? [];
      _ordersLoaded = true;
      notifyListeners();
    } catch (_) {
      // keep previous list
    } finally {
      _ordersLoadFuture = null;
    }
  }

  Future<void> loadCart({bool forceRefresh = false}) {
    if (!forceRefresh && _cartLoadFuture != null) return _cartLoadFuture!;
    _cartLoadFuture = _loadCart();
    return _cartLoadFuture!;
  }

  Future<void> _loadCart() async {
    try {
      final res = await _api.get('/instant/cart');
      _cart = res['data'];
      notifyListeners();
    } catch (e) {
      _error = ErrorHandler.message(e);
      notifyListeners();
    } finally {
      _cartLoadFuture = null;
    }
  }

  Future<void> loadProducts({bool forceRefresh = false}) {
    if (!forceRefresh && _productsLoaded) return Future.value();
    if (!forceRefresh && _productsLoadFuture != null) return _productsLoadFuture!;
    _productsLoadFuture = _loadProducts();
    return _productsLoadFuture!;
  }

  Future<void> _loadProducts() async {
    try {
      final res = await _api.get('/products?availability=instant');
      _products = res['data']?['products'] ?? [];
      _productsLoaded = true;
      notifyListeners();
    } catch (_) {
      // keep previous list
    } finally {
      _productsLoadFuture = null;
    }
  }

  Future<void> loadCategories({bool forceRefresh = false}) {
    if (!forceRefresh && _categoriesLoaded) return Future.value();
    if (!forceRefresh && _categoriesLoadFuture != null) {
      return _categoriesLoadFuture!;
    }
    _categoriesLoadFuture = _loadCategories();
    return _categoriesLoadFuture!;
  }

  Future<void> _loadCategories() async {
    try {
      final res = await _api.get('/categories');
      _categories = res['data']?['categories'] ?? [];
      _categoriesLoaded = true;
      notifyListeners();
    } catch (_) {
      // keep previous list
    } finally {
      _categoriesLoadFuture = null;
    }
  }

  // ── Mutations ───────────────────────────────────────────────────────────────

  Timer? _flushTimer;
  Future<void>? _flushInFlight;

  /// True while unflushed local edits exist — the confirm button uses this to
  /// know the server copy is behind.
  bool get hasUnsyncedChanges =>
      _localQty.isNotEmpty || _localDeliveryCharge != null;

  void setQuantity(String productId, int quantity) {
    _localQty[productId] = quantity < 0 ? 0 : quantity;
    _error = null;
    notifyListeners();
    // Intentionally not flushed here: cart edits stay local (no per-tap network
    // call, so the button never shows a spinner). They're pushed to the server
    // in one batch by [confirm] via [flushNow].
  }

  void addItem(String productId, {int quantity = 1}) =>
      setQuantity(productId, quantityOf(productId) + quantity);

  void increment(String productId) =>
      setQuantity(productId, quantityOf(productId) + 1);

  void decrement(String productId) =>
      setQuantity(productId, quantityOf(productId) - 1);

  void removeItem(String productId) => setQuantity(productId, 0);

  void setDeliveryCharge(int charge) {
    _localDeliveryCharge = charge;
    _error = null;
    notifyListeners();
    // Kept local; flushed with the rest of the cart on [confirm].
  }

  /// Pushes every pending local edit to the server now, cancelling any timer.
  /// Safe to call repeatedly: concurrent callers await the same flush.
  Future<void> flushNow() {
    _flushTimer?.cancel();
    _flushTimer = null;
    if (!hasUnsyncedChanges) return _flushInFlight ?? Future.value();
    // A flush is already running; chain after it so edits made mid-flight
    // aren't skipped.
    if (_flushInFlight != null) {
      return _flushInFlight = _flushInFlight!.then((_) => flushNow());
    }
    return _flushInFlight = _flush().whenComplete(() => _flushInFlight = null);
  }

  Future<void> _flush() async {
    // Snapshot and clear: edits arriving during the flush land in a fresh map
    // and are picked up by the follow-up flush rather than being lost.
    final pending = Map<String, int>.from(_localQty);
    final pendingCharge = _localDeliveryCharge;
    _localQty.clear();
    _localDeliveryCharge = null;

    _mutating = true;
    _pendingProductIds.addAll(pending.keys);
    notifyListeners();

    try {
      for (final entry in pending.entries) {
        final onServer = _serverQuantityOf(entry.key) > 0;
        Map<String, dynamic> res;
        if (entry.value <= 0) {
          if (!onServer) continue;
          res = await _api.delete('/instant/cart/remove-item/${entry.key}');
        } else if (onServer) {
          res = await _api.put('/instant/cart/update-item', {
            'product_id': entry.key,
            'quantity': entry.value,
          });
        } else {
          res = await _api.post('/instant/cart/add-item', {
            'product_id': entry.key,
            'quantity': entry.value,
          });
        }
        _cart = res['data'];
      }
      if (pendingCharge != null) {
        final res = await _api.put('/instant/cart/delivery-charge', {
          'delivery_charge': pendingCharge,
        });
        _cart = res['data'];
      }
    } catch (e) {
      // Roll back to the server's copy rather than leaving the UI showing
      // quantities that were never persisted.
      _error = ErrorHandler.message(e);
      _localQty.clear();
      _localDeliveryCharge = null;
      await _loadCart();
    } finally {
      _mutating = false;
      _pendingProductIds.removeAll(pending.keys);
      notifyListeners();
    }
  }

  int _serverQuantityOf(String productId) {
    for (final item in (_cart?['items'] as List?) ?? const []) {
      if (item['product_id'] == productId) {
        return (item['quantity'] as num?)?.toInt() ?? 0;
      }
    }
    return 0;
  }

  @override
  void dispose() {
    _flushTimer?.cancel();
    super.dispose();
  }

  /// Confirm the cart → creates an instant order; returns it on success.
  Future<Map<String, dynamic>?> confirm() async {
    // Any taps still sitting in the debounce window must reach the server
    // before it turns the cart into an order.
    await flushNow();
    if (_error != null) return null;

    _mutating = true;
    notifyListeners();
    try {
      final res = await _api.post('/instant/cart/confirm', {});
      final order = res['data']?['order'] as Map<String, dynamic>?;
      // Server empties the cart; reflect that locally.
      await _loadCart();
      await loadOrders(forceRefresh: true);
      return order;
    } catch (e) {
      _error = ErrorHandler.message(e);
      return null;
    } finally {
      _mutating = false;
      notifyListeners();
    }
  }

  /// How late the customer may cancel: 'until_delivery' (default),
  /// 'until_acceptance', or 'disabled'. Admin-configured.
  String get cancelWindow =>
      (_availability?['hours'] as Map<String, dynamic>?)?['customer_cancel_window']
              as String? ??
      'until_delivery';

  /// Whether a cancel action should be offered for an order in [status].
  bool canCancel(String? status) {
    if (cancelWindow == 'disabled') return false;
    if (status == 'pending') return true;
    if (status == 'acknowledged') return cancelWindow == 'until_delivery';
    return false; // delivered / cancelled / rejected are final
  }

  /// Cancel the customer's own order. Returns null on success, or the error
  /// message to show — the server is the authority on whether it is still
  /// allowed, since the window may have passed while the screen sat open.
  Future<String?> cancelOrder(String orderId) async {
    try {
      await _api.put('/instant/orders/$orderId/cancel', {});
      await loadOrders(forceRefresh: true);
      return null;
    } catch (e) {
      return ErrorHandler.message(e);
    }
  }

  /// Fetch one order — polled by the live order-status screen.
  /// Returns null only if every route failed, so the poller keeps the last state.
  Future<Map<String, dynamic>?> fetchOrder(String orderId) async {
    try {
      final res = await _api.get('/instant/orders/$orderId');
      final order = res['data']?['order'] as Map<String, dynamic>?;
      if (order != null) return order;
    } catch (_) {
      // Fall through to the list endpoint below.
    }

    // Fallback: the single-order endpoint is newer than the rest of the instant
    // API, so a backend that hasn't been redeployed yet answers it with a 404.
    // The history endpoint carries the same order and has always existed, which
    // keeps the status screen live against older servers instead of stalling on
    // a permanent "can't reach the server".
    try {
      final res = await _api.get('/instant/orders?limit=100');
      final list = (res['data']?['orders'] as List?) ?? [];
      for (final entry in list) {
        if (entry is Map && entry['id'] == orderId) {
          return Map<String, dynamic>.from(entry);
        }
      }
    } catch (_) {
      // Genuinely unreachable — let the caller count this as a failure.
    }
    return null;
  }
}
