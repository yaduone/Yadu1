import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../utils/constants.dart';

class ApiService {
  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;
  ApiService._();

  Future<String?> _getToken() async {
    final user = FirebaseAuth.instance.currentUser;
    return user?.getIdToken();
  }

  Future<Map<String, String>> _headers() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static const _timeout = Duration(seconds: 15);

  Future<Map<String, dynamic>> get(String path) async {
    final res = await http.get(
      Uri.parse('${AppConstants.apiBaseUrl}$path'),
      headers: await _headers(),
    ).timeout(_timeout);
    return _handleResponse(res);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('${AppConstants.apiBaseUrl}$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    ).timeout(_timeout);
    return _handleResponse(res);
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    final res = await http.put(
      Uri.parse('${AppConstants.apiBaseUrl}$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    ).timeout(_timeout);
    return _handleResponse(res);
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final res = await http.delete(
      Uri.parse('${AppConstants.apiBaseUrl}$path'),
      headers: await _headers(),
    ).timeout(_timeout);
    return _handleResponse(res);
  }

  Map<String, dynamic> _handleResponse(http.Response res) {
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    }
    throw ApiException(body['error'] ?? 'Request failed', res.statusCode);
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}
