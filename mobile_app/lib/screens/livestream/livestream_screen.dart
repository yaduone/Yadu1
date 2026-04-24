import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../services/api_service.dart';

class LivestreamScreen extends StatefulWidget {
  const LivestreamScreen({super.key});

  @override
  State<LivestreamScreen> createState() => _LivestreamScreenState();
}

class _LivestreamScreenState extends State<LivestreamScreen> {
  Map<String, dynamic>? _livestream;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadLivestream();
  }

  Future<void> _loadLivestream() async {
    try {
      final res = await ApiService().get('/livestreams/active');
      setState(() {
        _livestream = res['data']?['livestream'];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.scaffoldBg,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 16),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Live Stream', style: AppType.h2),
      ),
      body: _loading
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  SkeletonLoader(height: 200, width: 200, borderRadius: 24),
                  SizedBox(height: 20),
                  SkeletonLoader(height: 20, width: 160, borderRadius: 8),
                ],
              ),
            )
          : _livestream == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(40),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceBg,
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Icon(Icons.live_tv_rounded,
                              size: 36, color: AppColors.textHint),
                        ),
                        const SizedBox(height: 20),
                        Text('No live stream available',
                            style: AppType.h3),
                        const SizedBox(height: 8),
                        Text(
                          'Check back later for live updates\nfrom your area',
                          textAlign: TextAlign.center,
                          style: AppType.caption.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.5),
                        ),
                      ],
                    ),
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      PremiumCard(
                        child: Column(
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: AppColors.error.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(18),
                              ),
                              child: const Icon(Icons.live_tv_rounded,
                                  size: 32, color: AppColors.error),
                            ),
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.error,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                'LIVE',
                                style: AppType.microUpper.copyWith(
                                  color: Colors.white,
                                  letterSpacing: 1.5,
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              _livestream!['title'] ?? 'Livestream',
                              textAlign: TextAlign.center,
                              style: AppType.h2,
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 28),

                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton.icon(
                          onPressed: () {
                            final url =
                                _livestream!['youtube_url'] as String?;
                            if (url != null) {
                              launchUrl(Uri.parse(url),
                                  mode: LaunchMode.externalApplication);
                            }
                          },
                          icon: const Icon(Icons.play_arrow_rounded),
                          label: Text('Watch on YouTube',
                              style: AppType.button
                                  .copyWith(color: Colors.white)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.error,
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
