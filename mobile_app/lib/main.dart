import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:firebase_app_check/firebase_app_check.dart';
import 'firebase_options.dart';

import 'theme/app_theme.dart';
import 'theme/app_typography.dart';
import 'widgets/premium_components.dart';
import 'providers/auth_provider.dart';
import 'providers/subscription_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/calendar_provider.dart';
import 'providers/instant_provider.dart';
import 'providers/instant_mode_provider.dart';
import 'screens/splash/splash_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/complete_profile_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/dues/due_screen.dart';
import 'screens/livestream/livestream_screen.dart';
import 'screens/notifications/notifications_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'services/fcm_service.dart';
import 'services/onboarding_service.dart';
import 'utils/transitions.dart';

Future<void>? _startupInitialization;
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  FcmService.registerBackgroundHandler();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  runApp(const DairyDeliveryApp());
}

Future<void> initializeStartupServices() async {
  final inProgress = _startupInitialization;
  if (inProgress != null) return inProgress;

  final initialization = _initializeStartupServices();
  _startupInitialization = initialization;

  try {
    await initialization;
  } catch (_) {
    if (identical(_startupInitialization, initialization)) {
      _startupInitialization = null;
    }
    rethrow;
  }
}

Future<void> _initializeStartupServices() async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // App Check: Play Integrity on release, debug provider in dev.
  // IMPORTANT: Play Integrity requires Google Play App Signing SHA-1 to be
  // registered in Firebase Console.
  try {
    await FirebaseAppCheck.instance.activate(
      androidProvider: kDebugMode
          ? AndroidProvider.debug
          : AndroidProvider.playIntegrity,
    );
  } catch (_) {
    await FirebaseAppCheck.instance.activate(
      androidProvider: AndroidProvider.debug,
    );
  }

  // Platform configuration is non-critical for the first visible frame.
  unawaited(SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]));
}

class DairyDeliveryApp extends StatelessWidget {
  const DairyDeliveryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppAuthProvider()),
        ChangeNotifierProvider(create: (_) => SubscriptionProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => CalendarProvider()),
        ChangeNotifierProvider(create: (_) => InstantProvider()),
        ChangeNotifierProvider(create: (_) => InstantModeProvider()),
      ],
      child: MaterialApp(
        navigatorKey: appNavigatorKey,
        title: 'YaduONE',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const SplashScreen(initializeServices: initializeStartupServices),
      ),
    );
  }
}

/// Listens to Firebase auth state and routes accordingly.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  // Cache the stream so it is not recreated on every rebuild.
  final Stream<fb_auth.User?> _authStream =
      fb_auth.FirebaseAuth.instance.authStateChanges();

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<fb_auth.User?>(
      stream: _authStream,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Scaffold(
            backgroundColor: AppColors.scaffoldBg,
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Shimmer brand loader
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: const Icon(
                      Icons.water_drop_rounded,
                      size: 36,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'YaduONE',
                    style: AppType.h1.copyWith(
                      color: AppColors.textPrimary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Soch nayi sanskaar wahi',
                    style: AppType.small.copyWith(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        if (snapshot.data == null) {
          return const LoginScreen();
        }

        return const _ProfileGate();
      },
    );
  }
}

class _ProfileGate extends StatefulWidget {
  const _ProfileGate();

  @override
  State<_ProfileGate> createState() => _ProfileGateState();
}

class _ProfileGateState extends State<_ProfileGate> {
  /// null while the pages are still loading; true once the intro has been
  /// dismissed for this session (or there is nothing to show).
  bool? _onboardingDone;
  List<OnboardingPage> _onboardingPages = const [];

  /// True once the profile form has been skipped or saved this session.
  bool _profileStepDismissed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_initializeNotifications());
      context.read<AppAuthProvider>().loadProfile();
      unawaited(_loadOnboardingState());
    });
  }

  /// The intro is shown on every sign-in, to new and returning users alike, so
  /// this always fetches rather than checking a "seen" flag.
  Future<void> _loadOnboardingState() async {
    try {
      final pages = await OnboardingService.instance.fetchPages();
      if (!mounted) return;
      if (pages.isEmpty) {
        // Nothing configured by admin yet — nothing to show.
        setState(() => _onboardingDone = true);
      } else {
        setState(() {
          _onboardingPages = pages;
          _onboardingDone = false;
        });
      }
    } catch (_) {
      // Onboarding is a nice-to-have; never block sign-in on it.
      if (mounted) setState(() => _onboardingDone = true);
    }
  }

  Future<void> _initializeNotifications() async {
    try {
      await FcmService.instance.init(onNotificationTap: _openNotification);
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Notification setup deferred: $error');
      }
    }
  }

  void _openNotification(Map<String, dynamic> data) {
    final navigator = appNavigatorKey.currentState;
    if (navigator == null) return;

    final destination = data['destination'] as String?;
    final type = data['type'] as String?;
    final Widget page;
    if (destination == 'dues' || type == 'due_reminder' || type == 'payment_recorded') {
      page = const DueScreen();
    } else if (destination == 'livestream' ||
        type == 'livestream_reminder' ||
        type == 'livestream_started') {
      page = const LivestreamScreen();
    } else {
      page = const NotificationsScreen();
    }
    navigator.push(SlideUpRoute(page: page));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AppAuthProvider>();

    if (!auth.profileLoaded || _onboardingDone == null) {
      return const _HomeSkeletonLoadingScreen();
    }

    if (_onboardingDone == false) {
      return OnboardingScreen(
        pages: _onboardingPages,
        onDone: () => setState(() => _onboardingDone = true),
      );
    }

    // New sign-ups land on the profile form first; it can be skipped, after
    // which HomeScreen's banner keeps prompting for completion.
    if (!auth.isProfileComplete && !_profileStepDismissed) {
      return CompleteProfileScreen(
        onDone: () => setState(() => _profileStepDismissed = true),
      );
    }

    return const HomeScreen();
  }
}

class _HomeSkeletonLoadingScreen extends StatelessWidget {
  const _HomeSkeletonLoadingScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.primaryLight.withValues(alpha: 0.72),
                    AppColors.scaffoldBg,
                    AppColors.scaffoldBg,
                  ],
                  stops: const [0.0, 0.38, 1.0],
                ),
              ),
            ),
          ),
          SafeArea(
            child: ListView(
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 110),
              children: const [
                _SkeletonHomeHeader(),
                SizedBox(height: 18),
                _SkeletonHeroCard(),
                SizedBox(height: 24),
                _SkeletonSectionTitle(width: 132),
                SizedBox(height: 10),
                _SkeletonQuickActions(),
                SizedBox(height: 24),
                _SkeletonSectionTitle(width: 154),
                SizedBox(height: 10),
                _SkeletonCalendarStrip(),
                SizedBox(height: 24),
                _SkeletonSectionTitle(width: 118),
                SizedBox(height: 10),
                _SkeletonListCard(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: const _SkeletonBottomNav(),
    );
  }
}

class _SkeletonHomeHeader extends StatelessWidget {
  const _SkeletonHomeHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.68)),
      ),
      child: Row(
        children: const [
          SkeletonLoader(height: 44, width: 44, borderRadius: 14),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonLoader(height: 10, width: 92, borderRadius: 6),
                SizedBox(height: 8),
                SkeletonLoader(height: 22, width: 142, borderRadius: 8),
                SizedBox(height: 8),
                SkeletonLoader(height: 10, width: 104, borderRadius: 6),
              ],
            ),
          ),
          SizedBox(width: 10),
          SkeletonLoader(height: 38, width: 72, borderRadius: 18),
        ],
      ),
    );
  }
}

class _SkeletonHeroCard extends StatelessWidget {
  const _SkeletonHeroCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.72)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SkeletonLoader(height: 54, width: 54, borderRadius: 18),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonLoader(height: 18, width: double.infinity, borderRadius: 8),
                    SizedBox(height: 10),
                    SkeletonLoader(height: 12, width: 190, borderRadius: 6),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: SkeletonLoader(height: 66, borderRadius: 16)),
              SizedBox(width: 10),
              Expanded(child: SkeletonLoader(height: 66, borderRadius: 16)),
            ],
          ),
          SizedBox(height: 14),
          SkeletonLoader(height: 46, borderRadius: 16),
        ],
      ),
    );
  }
}

class _SkeletonSectionTitle extends StatelessWidget {
  final double width;

  const _SkeletonSectionTitle({required this.width});

  @override
  Widget build(BuildContext context) {
    return SkeletonLoader(height: 12, width: width, borderRadius: 6);
  }
}

class _SkeletonQuickActions extends StatelessWidget {
  const _SkeletonQuickActions();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: const [
        Expanded(child: SkeletonLoader(height: 104, borderRadius: 22)),
        SizedBox(width: 10),
        Expanded(child: SkeletonLoader(height: 104, borderRadius: 22)),
        SizedBox(width: 10),
        Expanded(child: SkeletonLoader(height: 104, borderRadius: 22)),
      ],
    );
  }
}

class _SkeletonCalendarStrip extends StatelessWidget {
  const _SkeletonCalendarStrip();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 98,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: const [
          Expanded(child: SkeletonLoader(height: 72, borderRadius: 16)),
          SizedBox(width: 8),
          Expanded(child: SkeletonLoader(height: 72, borderRadius: 16)),
          SizedBox(width: 8),
          Expanded(child: SkeletonLoader(height: 72, borderRadius: 16)),
          SizedBox(width: 8),
          Expanded(child: SkeletonLoader(height: 72, borderRadius: 16)),
          SizedBox(width: 8),
          Expanded(child: SkeletonLoader(height: 72, borderRadius: 16)),
        ],
      ),
    );
  }
}

class _SkeletonListCard extends StatelessWidget {
  const _SkeletonListCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(24),
      ),
      child: const Column(
        children: [
          Row(
            children: [
              SkeletonLoader(height: 48, width: 48, borderRadius: 14),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonLoader(height: 14, borderRadius: 7),
                    SizedBox(height: 8),
                    SkeletonLoader(height: 10, width: 150, borderRadius: 6),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 14),
          SkeletonLoader(height: 12, borderRadius: 6),
          SizedBox(height: 8),
          SkeletonLoader(height: 12, width: 220, borderRadius: 6),
        ],
      ),
    );
  }
}

class _SkeletonBottomNav extends StatelessWidget {
  const _SkeletonBottomNav();

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      height: 72 + bottom,
      padding: EdgeInsets.fromLTRB(28, 10, 28, bottom + 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: const [
          SkeletonLoader(height: 38, width: 38, borderRadius: 14),
          SkeletonLoader(height: 38, width: 38, borderRadius: 14),
          SkeletonLoader(height: 48, width: 48, borderRadius: 24),
          SkeletonLoader(height: 38, width: 38, borderRadius: 14),
          SkeletonLoader(height: 38, width: 38, borderRadius: 14),
        ],
      ),
    );
  }
}
