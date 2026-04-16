import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/api_service.dart';

class AppAuthProvider extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final ApiService _api = ApiService();

  User? get firebaseUser => _auth.currentUser;
  bool get isLoggedIn => _auth.currentUser != null;

  Map<String, dynamic>? _userData;
  Map<String, dynamic>? get userData => _userData;
  bool get isProfileComplete => _userData?['is_profile_complete'] == true;

  bool _profileLoaded = false;
  bool get profileLoaded => _profileLoaded;

  String? _verificationId;
  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  Future<void> sendOtp(String phoneNumber) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _auth.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        timeout: const Duration(seconds: 60),
        verificationCompleted: (credential) async {
          await _auth.signInWithCredential(credential);
          await _syncUser();
        },
        verificationFailed: (e) {
          _error = e.message ?? 'Verification failed';
          _isLoading = false;
          notifyListeners();
        },
        codeSent: (verificationId, resendToken) {
          _verificationId = verificationId;
          _isLoading = false;
          notifyListeners();
        },
        codeAutoRetrievalTimeout: (verificationId) {
          _verificationId = verificationId;
        },
      );
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> verifyOtp(String otp) async {
    if (_verificationId == null) {
      _error = 'No verification ID. Send OTP first.';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: otp,
      );
      await _auth.signInWithCredential(credential);
      _isLoading = false;
      notifyListeners();
      unawaited(_syncUser()); // fire-and-forget; loadProfile() will sync data on home load
      return true;
    } catch (e) {
      _error = 'Invalid OTP';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> _syncUser() async {
    try {
      final token = await _auth.currentUser?.getIdToken();
      if (token == null) return;

      final res = await _api.post('/auth/user/verify', {'firebase_token': token});
      _userData = res['data']?['user'];
    } catch (_) {
      // Silently ignore — Firebase sign-in already succeeded.
      // loadProfile() will sync user data when the home screen loads.
    }
    notifyListeners();
  }

  Future<void> completeProfile({
    required String name,
    required String areaId,
    required Map<String, dynamic> address,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.post('/auth/user/complete-profile', {
        'name': name,
        'area_id': areaId,
        'address': address,
      });
      _userData = res['data']?['user'];
    } catch (e) {
      _error = e.toString();
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadProfile() async {
    try {
      final res = await _api.get('/users/profile');
      final user = res['data']?['user'];
      if (user != null) {
        _userData = user;
      }
    } catch (e) {
      debugPrint('loadProfile failed: $e');
      _error = e.toString();
      // Keep existing _userData from _syncUser() if loadProfile fails
    }
    _profileLoaded = true;
    notifyListeners();
  }

  Future<void> logout() async {
    await _auth.signOut();
    _userData = null;
    _verificationId = null;
    _profileLoaded = false;
    notifyListeners();
  }
}
