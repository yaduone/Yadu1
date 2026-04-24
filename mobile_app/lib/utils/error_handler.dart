import 'dart:async';
import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/api_service.dart';

/// Classifies any exception into a user-friendly message.
/// Call [ErrorHandler.message] anywhere an error needs to be shown.
class ErrorHandler {
  ErrorHandler._();

  static String message(Object error) {
    // ── No internet / socket errors ──────────────────────────────
    if (error is SocketException ||
        error.toString().contains('SocketException') ||
        error.toString().contains('Failed host lookup')) {
      return 'No internet connection. Please check your network and try again.';
    }

    // ── Timeout ──────────────────────────────────────────────────
    if (error is TimeoutException ||
        error.toString().contains('TimeoutException') ||
        error.toString().contains('timed out')) {
      return 'Request timed out. The server is taking too long — please try again.';
    }

    // ── Firebase Auth errors ─────────────────────────────────────
    if (error is FirebaseAuthException) {
      return _firebaseMessage(error);
    }

    // ── API errors (our own ApiException) ────────────────────────
    if (error is ApiException) {
      return _apiMessage(error);
    }

    // ── Generic fallback ─────────────────────────────────────────
    final msg = error.toString();
    if (msg.startsWith('Exception: ')) {
      return msg.replaceFirst('Exception: ', '');
    }
    return 'Something went wrong. Please try again.';
  }

  // ── Firebase error code → human message ──────────────────────
  static String _firebaseMessage(FirebaseAuthException e) {
    switch (e.code) {
      case 'invalid-phone-number':
        return 'The phone number you entered is invalid. Please check and try again.';
      case 'too-many-requests':
        return 'Too many attempts. Please wait a few minutes before trying again.';
      case 'invalid-verification-code':
        return 'The OTP you entered is incorrect. Please check and try again.';
      case 'session-expired':
        return 'Your OTP has expired. Please go back and request a new one.';
      case 'quota-exceeded':
        return 'SMS quota exceeded. Please try again later.';
      case 'network-request-failed':
        return 'No internet connection. Please check your network and try again.';
      case 'user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'operation-not-allowed':
        return 'Phone sign-in is not enabled. Please contact support.';
      default:
        return e.message ?? 'Verification failed. Please try again.';
    }
  }

  // ── HTTP status code → human message ─────────────────────────
  static String _apiMessage(ApiException e) {
    switch (e.statusCode) {
      case 400:
        return e.message.isNotEmpty ? e.message : 'Invalid request. Please check your input.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You don\'t have permission to do that.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return e.message.isNotEmpty ? e.message : 'A conflict occurred. Please try again.';
      case 422:
        return e.message.isNotEmpty ? e.message : 'Please check your input and try again.';
      case 429:
        return 'Too many requests. Please slow down and try again in a moment.';
      case 500:
      case 502:
      case 503:
        return 'Our servers are having trouble right now. Please try again shortly.';
      default:
        return e.message.isNotEmpty ? e.message : 'Something went wrong. Please try again.';
    }
  }

  /// Returns true if the error is a connectivity issue.
  static bool isNetworkError(Object error) {
    return error is SocketException ||
        error is TimeoutException ||
        (error is FirebaseAuthException && error.code == 'network-request-failed') ||
        error.toString().contains('SocketException') ||
        error.toString().contains('Failed host lookup') ||
        error.toString().contains('timed out');
  }
}
