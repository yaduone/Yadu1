import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/api_service.dart';
import '../services/fcm_service.dart';
import '../utils/error_handler.dart';

class AppAuthProvider extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final ApiService _api = ApiService();

  StreamSubscription<User?>? _authSub;

  User? get firebaseUser => _auth.currentUser;
  bool get isLoggedIn => _auth.currentUser != null;

  Map<String, dynamic>? _userData;
  Map<String, dynamic>? get userData => _userData;
  bool get isProfileComplete => _userData?['is_profile_complete'] == true;

  bool _profileLoaded = false;
  bool get profileLoaded => _profileLoaded;

  String? _verificationId;
  int? _resendToken;
  String? _lastPhone;
  bool _isLoading = false;
  bool get isLoading => _isLoading;

  // Tracks the current verifyPhoneNumber call so stale codeAutoRetrievalTimeout
  // callbacks from previous calls cannot overwrite a newer _verificationId.
  int _currentCallId = 0;

  bool _autoVerified = false;
  bool get autoVerified => _autoVerified;
  bool _isAutoVerifying = false;
  bool get isAutoVerifying => _isAutoVerifying;
  String? _autoRetrievedOtp;
  String? get autoRetrievedOtp => _autoRetrievedOtp;

  String? _error;
  String? get error => _error;

  // Per-phone cooldown: tracks when the next OTP send is allowed.
  final Map<String, DateTime> _otpCooldowns = {};

  AppAuthProvider() {
    // Auto-load profile whenever Firebase auth state changes.
    // This ensures session is restored on app restart without any manual wiring.
    _authSub = _auth.authStateChanges().listen((user) {
      if (user != null) {
        if (!_profileLoaded) {
          loadProfile();
        }
      } else {
        _onSignedOut();
      }
    });
  }

  void _onSignedOut() {
    _userData = null;
    _verificationId = null;
    _resendToken = null;
    _lastPhone = null;
    _profileLoaded = false;
    _isLoading = false;
    _error = null;
    _autoVerified = false;
    _isAutoVerifying = false;
    _autoRetrievedOtp = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Returns a user-facing cooldown message if the phone is on cooldown, null otherwise.
  String? otpCooldownMessage(String phoneNumber) {
    final until = _otpCooldowns[phoneNumber];
    if (until == null) return null;
    final remaining = until.difference(DateTime.now()).inSeconds;
    if (remaining <= 0) {
      _otpCooldowns.remove(phoneNumber);
      return null;
    }
    return 'Too many attempts. Please wait ${remaining}s before trying again.';
  }

  Future<void> sendOtp(String phoneNumber) async {
    // Client-side cooldown guard — prevents burning Firebase quota on rapid retaps.
    final cooldown = otpCooldownMessage(phoneNumber);
    if (cooldown != null) {
      _error = cooldown;
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    _autoVerified = false;
    _isAutoVerifying = false;
    _autoRetrievedOtp = null;
    notifyListeners();

    // Reuse resend token when sending to the same number to avoid quota hits.
    final resendToken =
        (_lastPhone == phoneNumber) ? _resendToken : null;
    _lastPhone = phoneNumber;

    final callId = ++_currentCallId;

    try {
      await _auth.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        timeout: const Duration(seconds: 60),
        forceResendingToken: resendToken,
        verificationCompleted: (credential) async {
          await _completeAutomaticVerification(credential);
        },
        verificationFailed: (e) {
          if (callId != _currentCallId) return;
          _isLoading = false;
          if (e.code == 'too-many-requests') {
            _otpCooldowns[phoneNumber] =
                DateTime.now().add(const Duration(minutes: 5));
          }
          _error = ErrorHandler.message(e);
          notifyListeners();
        },
        codeSent: (verificationId, token) {
          if (callId != _currentCallId) return;
          _verificationId = verificationId;
          _resendToken = token;
          _isLoading = false;
          _otpCooldowns[phoneNumber] =
              DateTime.now().add(const Duration(seconds: 60));
          notifyListeners();
        },
        codeAutoRetrievalTimeout: (verificationId) {
          // Only accept timeout callbacks from the current call to prevent a
          // stale call from overwriting a newer valid _verificationId.
          if (callId != _currentCallId) return;
          _verificationId = verificationId;
        },
      );
    } catch (e) {
      _error = ErrorHandler.message(e);
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resendOtp() async {
    if (_lastPhone == null) return;

    final cooldown = otpCooldownMessage(_lastPhone!);
    if (cooldown != null) {
      _error = cooldown;
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    _autoVerified = false;
    _isAutoVerifying = false;
    _autoRetrievedOtp = null;
    notifyListeners();

    final callId = ++_currentCallId;
    final phone = _lastPhone!;

    try {
      await _auth.verifyPhoneNumber(
        phoneNumber: phone,
        timeout: const Duration(seconds: 60),
        forceResendingToken: _resendToken,
        verificationCompleted: (credential) async {
          await _completeAutomaticVerification(credential);
        },
        verificationFailed: (e) {
          if (callId != _currentCallId) return;
          if (e.code == 'too-many-requests') {
            _otpCooldowns[phone] =
                DateTime.now().add(const Duration(minutes: 5));
          }
          _error = ErrorHandler.message(e);
          _isLoading = false;
          notifyListeners();
        },
        codeSent: (verificationId, token) {
          if (callId != _currentCallId) return;
          _verificationId = verificationId;
          _resendToken = token;
          _isLoading = false;
          _otpCooldowns[phone] =
              DateTime.now().add(const Duration(seconds: 60));
          notifyListeners();
        },
        codeAutoRetrievalTimeout: (verificationId) {
          if (callId != _currentCallId) return;
          _verificationId = verificationId;
        },
      );
    } catch (e) {
      _error = ErrorHandler.message(e);
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _completeAutomaticVerification(PhoneAuthCredential credential) async {
    _autoRetrievedOtp = credential.smsCode;
    _isAutoVerifying = true;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Keep the detected code visible briefly before authenticated navigation.
      if (_autoRetrievedOtp != null) {
        await Future<void>.delayed(const Duration(milliseconds: 650));
      }
      await _auth.signInWithCredential(credential);
      await _syncUser();
      _verificationId = null;
      _autoVerified = true;
    } catch (e) {
      _error = ErrorHandler.message(e);
    }

    _isAutoVerifying = false;
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> verifyOtp(String otp) async {
    if (_verificationId == null) {
      _error = 'Session expired. Please go back and request a new OTP.';
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
      // Auth state listener fires loadProfile automatically.
      // Do a direct sync here too so userData is ready before navigation.
      await _syncUser();
      _isLoading = false;
      notifyListeners();
      return true;
    } on FirebaseAuthException catch (e) {
      _error = ErrorHandler.message(e);
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = ErrorHandler.message(e);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> _syncUser() async {
    try {
      final token = await _auth.currentUser?.getIdToken(true);
      if (token == null) return;
      final res = await _api.post('/auth/user/verify', {'firebase_token': token});
      _userData = res['data']?['user'];
      _profileLoaded = true;
    } catch (_) {
      // Silently ignore — Firebase sign-in already succeeded.
    }
  }

  Future<void> completeProfile({
    required String name,
    required String areaId,
    required Map<String, dynamic> address,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.post('/auth/user/complete-profile', {
        'name': name,
        'area_id': areaId,
        'address': address,
      });
      _userData = res['data']?['user'];
    } catch (e) {
      _error = ErrorHandler.message(e);
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadProfile() async {
    try {
      final res = await _api.get('/users/profile');
      final user = res['data']?['user'];
      if (user != null) _userData = user;
    } catch (e) {
      if (kDebugMode) debugPrint('loadProfile failed: $e');
    }
    _profileLoaded = true;
    notifyListeners();
  }

  Future<void> requestDeletion() async {
    await _api.post('/users/request-deletion', {});
  }

  Future<void> logout() async {
    await FcmService.instance.clearToken();
    await _auth.signOut();
    // _onSignedOut is called by the authStateChanges listener.
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }
}
