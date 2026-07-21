import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:in_app_update/in_app_update.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../utils/constants.dart';

/// What the backend says about the build the user is running.
class UpdateInfo {
  final bool updateAvailable;
  final bool forceUpdate;
  final String latestVersion;
  final String releaseNotes;
  final String storeUrl;

  const UpdateInfo({
    required this.updateAvailable,
    required this.forceUpdate,
    required this.latestVersion,
    required this.releaseNotes,
    required this.storeUrl,
  });

  static const none = UpdateInfo(
    updateAvailable: false,
    forceUpdate: false,
    latestVersion: '',
    releaseNotes: '',
    storeUrl: UpdateService.fallbackStoreUrl,
  );
}

/// Two-layer update check:
///  - the backend record is the source of truth for *whether* to prompt, and
///    is the only thing that can force an update (the cutoff moves server-side,
///    no new build required);
///  - Play's own in-app update flow is preferred for actually installing, since
///    it downloads inside the app. When it is unavailable — sideloaded build,
///    Play Core not reachable, iOS — we fall back to opening the store listing.
class UpdateService {
  static const fallbackStoreUrl =
      'https://play.google.com/store/apps/details?id=in.yaduone.app';

  static const _timeout = Duration(seconds: 8);

  /// Build number of the running app (Android versionCode). Monotonic, so it
  /// orders correctly without parsing a dotted version string.
  static Future<int?> currentBuild() async {
    try {
      final info = await PackageInfo.fromPlatform();
      return int.tryParse(info.buildNumber);
    } catch (_) {
      return null;
    }
  }

  static Future<String> currentVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      return info.version;
    } catch (_) {
      return '';
    }
  }

  /// Asks the backend whether this build is behind. Never throws — a failed
  /// check must not block app startup, so any error means "no update".
  static Future<UpdateInfo> check() async {
    final build = await currentBuild();
    if (build == null) return UpdateInfo.none;

    for (final base in [AppConstants.apiBaseUrl, AppConstants.apiFallbackUrl]) {
      try {
        final res = await http
            .get(Uri.parse('$base/settings/app-version/app?build=$build'))
            .timeout(_timeout);
        if (res.statusCode != 200) continue;

        final body = jsonDecode(res.body) as Map<String, dynamic>;
        final data = (body['data'] ?? body) as Map<String, dynamic>;

        return UpdateInfo(
          updateAvailable: data['update_available'] == true,
          forceUpdate: data['force_update'] == true,
          latestVersion: (data['latest_version'] ?? '').toString(),
          releaseNotes: (data['release_notes'] ?? '').toString(),
          storeUrl: (data['store_url'] ?? fallbackStoreUrl).toString(),
        );
      } catch (_) {
        // Try the fallback host, then give up quietly.
      }
    }
    return UpdateInfo.none;
  }

  /// Runs Play's native in-app update. Returns false when the flow is not
  /// available (non-Android, sideloaded build, nothing published), so the
  /// caller can fall back to [openStore].
  static Future<bool> tryPlayInAppUpdate({required bool immediate}) async {
    if (!Platform.isAndroid) return false;
    try {
      final info = await InAppUpdate.checkForUpdate();
      if (info.updateAvailability != UpdateAvailability.updateAvailable) {
        return false;
      }
      if (immediate) {
        if (!info.immediateUpdateAllowed) return false;
        await InAppUpdate.performImmediateUpdate();
      } else {
        if (!info.flexibleUpdateAllowed) return false;
        await InAppUpdate.startFlexibleUpdate();
        await InAppUpdate.completeFlexibleUpdate();
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Opens the Play Store listing for the app. Prefers the `market://` scheme
  /// so the Play app opens directly; falls back to the https listing when the
  /// Play app is not installed.
  static Future<bool> openStore([String? url]) async {
    final storeUrl = (url == null || url.isEmpty) ? fallbackStoreUrl : url;

    if (Platform.isAndroid) {
      final market = Uri.parse('market://details?id=in.yaduone.app');
      try {
        if (await launchUrl(market, mode: LaunchMode.externalApplication)) {
          return true;
        }
      } catch (_) {
        // Play app missing — fall through to the browser listing.
      }
    }

    try {
      return await launchUrl(
        Uri.parse(storeUrl),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      return false;
    }
  }
}
