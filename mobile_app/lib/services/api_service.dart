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

  static final List<String> _baseUrls = [
    AppConstants.apiBaseUrl,
    AppConstants.apiFallbackUrl,
  ];

  Future<Map<String, dynamic>> get(String path) => _executeWithFallback(
        (base) async => http.get(
          Uri.parse('$base$path'),
          headers: await _headers(),
        ).timeout(_timeout),
      );

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) =>
      _executeWithFallback(
        (base) async => http.post(
          Uri.parse('$base$path'),
          headers: await _headers(),
          body: jsonEncode(body),
        ).timeout(_timeout),
      );

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) =>
      _executeWithFallback(
        (base) async => http.put(
          Uri.parse('$base$path'),
          headers: await _headers(),
          body: jsonEncode(body),
        ).timeout(_timeout),
      );

  Future<Map<String, dynamic>> delete(String path) => _executeWithFallback(
        (base) async => http.delete(
          Uri.parse('$base$path'),
          headers: await _headers(),
        ).timeout(_timeout),
      );

  Future<Map<String, dynamic>> _executeWithFallback(
      Future<http.Response> Function(String baseUrl) call) async {
    Object lastError = const NetworkException();

    for (int i = 0; i < _baseUrls.length; i++) {
      try {
        final res = await call(_baseUrls[i]);
        return _handleResponse(res);
      } on SocketException {
        lastError = const NetworkException();
        // Only try fallback on network-level failures
        if (i < _baseUrls.length - 1) continue;
      } on TimeoutException {
        lastError = const TimeoutApiException();
        if (i < _baseUrls.length - 1) continue;
      } on ApiException catch (e) {
        // Fall through to next URL on 5xx server errors; rethrow 4xx immediately
        if (e.statusCode >= 500 && i < _baseUrls.length - 1) {
          lastError = e;
          continue;
        }
        rethrow;
      } catch (e) {
        throw ApiException(e.toString(), 0);
      }
    }

    throw lastError;
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

class NetworkException extends ApiException {
  const NetworkException()
      : super('No internet connection. Please check your network and try again.', 0);
}

class TimeoutApiException extends ApiException {
  const TimeoutApiException()
      : super('Request timed out. Please try again.', 0);
}
