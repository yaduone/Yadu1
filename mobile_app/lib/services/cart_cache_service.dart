import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/pending_cart_item.dart';

/// Persists the locally-staged (unconfirmed) scheduled-cart changes so they
/// survive app restarts.
///
/// The cache is scoped to a single user **and** a single target delivery date.
/// If the signed-in user changes, or the cart's target date rolls over (e.g.
/// "tomorrow" becomes a new day), the stale cache is discarded instead of being
/// shown against the wrong day.
class CartCacheService {
  static const _key = 'scheduled_cart_pending_v1';

  /// Saves [items] for [userId] + [targetDate]. Passing an empty list clears
  /// the cache so we never keep an orphaned, empty payload around.
  Future<void> save({
    required String userId,
    required String targetDate,
    required List<PendingCartItem> items,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    if (items.isEmpty) {
      await prefs.remove(_key);
      return;
    }
    final payload = jsonEncode({
      'user_id': userId,
      'target_date': targetDate,
      'items': items.map((i) => i.toJson()).toList(),
    });
    await prefs.setString(_key, payload);
  }

  /// Returns the cached pending items when they belong to [userId] and
  /// [targetDate]; otherwise discards the stale cache and returns an empty list.
  Future<List<PendingCartItem>> load({
    required String userId,
    required String targetDate,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return const [];

    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      if (decoded['user_id'] != userId ||
          decoded['target_date'] != targetDate) {
        await prefs.remove(_key);
        return const [];
      }
      final rawItems = (decoded['items'] as List?) ?? const [];
      return rawItems
          .whereType<Map<String, dynamic>>()
          .map(PendingCartItem.fromJson)
          .where((i) => i.productId.isNotEmpty && i.quantity > 0)
          .toList();
    } catch (_) {
      // Corrupt payload — drop it rather than crash on next open.
      await prefs.remove(_key);
      return const [];
    }
  }

  /// Removes any cached pending cart (e.g. after a successful confirmation or
  /// on sign-out).
  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
