import 'dart:async';
import 'dart:convert';
import 'dart:io';
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

  Future<Map<String, dynamic>> get(String path) => _execute(
        () async => http.get(
          Uri.parse('${AppConstants.apiBaseUrl}$path'),
          headers: await _headers(),
        ).timeout(_timeout),
      );

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) =>
      _execute(
        () async => http.post(
          Uri.parse('${AppConstants.apiBaseUrl}$path'),
          headers: await _headers(),
          body: jsonEncode(body),
        ).timeout(_timeout),
      );

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) =>
      _execute(
        () async => http.put(
          Uri.parse('${AppConstants.apiBaseUrl}$path'),
          headers: await _headers(),
          body: jsonEncode(body),
        ).timeout(_timeout),
      );

  Future<Map<String, dynamic>> delete(String path) => _execute(
        () async => http.delete(
          Uri.parse('${AppConstants.apiBaseUrl}$path'),
          headers: await _headers(),
        ).timeout(_timeout),
      );

  /// Wraps every HTTP call with consistent error translation.
  Future<Map<String, dynamic>> _execute(
      Future<http.Response> Function() call) async {
    try {
      final res = await call();
      return _handleResponse(res);
    } on SocketException {
      throw const NetworkException();
    } on TimeoutException {
      throw const TimeoutApiException();
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(e.toString(), 0);
    }
  }

  Map<String, dynamic> _handleResponse(http.Response res) {
    Map<String, dynamic> body;
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException('Unexpected server response', res.statusCode);
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    }
    throw ApiException(
      (body['error'] as String?) ?? (body['message'] as String?) ?? 'Request failed',
      res.statusCode,
    );
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  const ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}

/// Thrown when there is no internet / socket error.
class NetworkException extends ApiException {
  const NetworkException()
      : super('No internet connection. Please check your network and try again.', 0);
}

/// Thrown when the request times out.
class TimeoutApiException extends ApiException {
  const TimeoutApiException()
      : super('Request timed out. Please try again.', 0);
}
