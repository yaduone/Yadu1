import 'package:flutter/material.dart';
import '../services/api_service.dart';

class CalendarProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  // month -> full response data
  final Map<String, Map<String, dynamic>> _cache = {};
  String? _loadingMonth;
  String? _error;

  String? get error => _error;
  bool isLoading(String month) => _loadingMonth == month;

  Map<String, dynamic>? calendarData(String month) => _cache[month];

  /// Returns per-day map for the given month.
  Map<String, dynamic> dayMap(String month) =>
      (_cache[month]?['calendar'] as Map<String, dynamic>?) ?? {};

  Map<String, dynamic>? summary(String month) =>
      _cache[month]?['summary'] as Map<String, dynamic>?;

  Future<void> loadMonth(String month, {bool forceRefresh = false}) async {
    if (!forceRefresh && _cache.containsKey(month)) return; // already cached
    _loadingMonth = month;
    _error = null;
    notifyListeners();
    try {
      final res = await _api.get('/reports/user/calendar?month=$month');
      _cache[month] = res['data'] as Map<String, dynamic>;
    } catch (e) {
      _error = e.toString();
    }
    _loadingMonth = null;
    notifyListeners();
  }

  void invalidate(String month) {
    _cache.remove(month);
    notifyListeners();
  }
}
