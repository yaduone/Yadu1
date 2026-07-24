import 'api_service.dart';

class OnboardingPage {
  final String id;
  final String imageUrl;
  final String headline;
  final String description;

  const OnboardingPage({
    required this.id,
    required this.imageUrl,
    required this.headline,
    required this.description,
  });

  factory OnboardingPage.fromJson(Map<String, dynamic> json) {
    return OnboardingPage(
      id: json['id']?.toString() ?? '',
      imageUrl: json['image_url']?.toString() ?? '',
      headline: json['headline']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
    );
  }
}

class OnboardingService {
  static final OnboardingService instance = OnboardingService._();
  OnboardingService._();

  /// The intro is shown on every sign-in — for new and returning users alike —
  /// so nothing is persisted about whether it has been seen before.
  Future<List<OnboardingPage>> fetchPages() async {
    final res = await ApiService().get('/onboarding/app');
    final pages = (res['data']?['pages'] as List<dynamic>? ?? [])
        .map((page) => OnboardingPage.fromJson(page as Map<String, dynamic>))
        .toList();
    return pages;
  }
}
