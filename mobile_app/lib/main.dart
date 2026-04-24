import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:shared_preferences/shared_preferences.dart';
import 'firebase_options.dart';

import 'theme/app_theme.dart';
import 'theme/app_typography.dart';
import 'widgets/premium_components.dart';
import 'providers/auth_provider.dart';
import 'providers/subscription_provider.dart';
import 'providers/cart_provider.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Check if onboarding has been completed
  final prefs = await SharedPreferences.getInstance();
  final onboardingSeen = prefs.getBool('onboarding_seen') ?? false;

  // Premium light status bar
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  runApp(DairyDeliveryApp(showOnboarding: !onboardingSeen));
}

class DairyDeliveryApp extends StatelessWidget {
  final bool showOnboarding;

  const DairyDeliveryApp({super.key, required this.showOnboarding});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppAuthProvider()),
        ChangeNotifierProvider(create: (_) => SubscriptionProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
      ],
      child: MaterialApp(
        title: 'YaduONE',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: showOnboarding ? const OnboardingScreen() : const AuthGate(),
      ),
    );
  }
}

/// Listens to Firebase auth state and routes accordingly.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<fb_auth.User?>(
      stream: fb_auth.FirebaseAuth.instance.authStateChanges(),
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
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppAuthProvider>().loadProfile();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AppAuthProvider>();

    if (!auth.profileLoaded) {
      return Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SkeletonLoader(height: 72, width: 72, borderRadius: 22),
              const SizedBox(height: 24),
              const SkeletonLoader(height: 20, width: 120, borderRadius: 8),
            ],
          ),
        ),
      );
    }

    // Allow users with incomplete profiles to reach Home
    // HomeScreen will show a banner prompting profile completion
    return const HomeScreen();
  }
}
