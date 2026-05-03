import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_service.dart';

// Top-level handler required by FCM for background/terminated messages.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // No-op: the notification is shown automatically by FCM when the app is in background.
}

class FcmService {
  FcmService._();
  static final FcmService instance = FcmService._();

  final _messaging = FirebaseMessaging.instance;
  final _localNotifications = FlutterLocalNotificationsPlugin();

  static const _channelId = 'yaduone_default';
  static const _channelName = 'YaduONE Notifications';

  Future<void> init() async {
    // Register background handler before anything else
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Request permission (iOS; Android 13+ handled via manifest)
    await _messaging.requestPermission(alert: true, badge: true, sound: true);

    // Local notifications channel (Android 8+)
    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );

    if (Platform.isAndroid) {
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(const AndroidNotificationChannel(
            _channelId,
            _channelName,
            importance: Importance.high,
            enableVibration: true,
          ));
    }

    // Show local notification when app is in foreground
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // Register token and listen for refreshes
    await _registerToken();
    _messaging.onTokenRefresh.listen(_uploadToken);
  }

  Future<void> _onForegroundMessage(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
    );
  }

  Future<void> _registerToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) await _uploadToken(token);
    } catch (e) {
      // Non-fatal — token registration retried on next app open
    }
  }

  Future<void> _uploadToken(String token) async {
    try {
      await ApiService().put('/notifications/device-token', {'token': token});
    } catch (_) {}
  }

  /// Call on logout so stale tokens don't receive notifications.
  Future<void> clearToken() async {
    try {
      await _messaging.deleteToken();
    } catch (_) {}
  }
}
