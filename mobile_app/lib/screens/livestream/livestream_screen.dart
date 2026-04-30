import 'package:flutter/material.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';
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
  YoutubePlayerController? _controller;
  double? _lactometerReading;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        ApiService().get('/livestreams/active'),
        ApiService().get('/livestreams/lactometer'),
      ]);

      final streamData = results[0]['data']?['livestream'] as Map<String, dynamic>?;
      final lactValue = results[1]['data']?['lactometer_reading'];

      if (streamData != null) {
        final rawUrl = streamData['youtube_url'] ?? '';
        final videoId = YoutubePlayer.convertUrlToId(rawUrl) ??
            RegExp(r'youtube\.com/live/([a-zA-Z0-9_-]{11})')
                .firstMatch(rawUrl)
                ?.group(1);
        if (videoId != null) {
          _controller = YoutubePlayerController(
            initialVideoId: videoId,
            flags: const YoutubePlayerFlags(
              autoPlay: true,
              isLive: true,
              enableCaption: false,
            ),
          );
        }
      }
      setState(() {
        _livestream = streamData;
        _lactometerReading = lactValue != null ? (lactValue as num).toDouble() : null;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        appBar: _buildAppBar(),
        body: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SkeletonLoader(height: 220, width: double.infinity, borderRadius: 0),
              SizedBox(height: 20),
              SkeletonLoader(height: 20, width: 160, borderRadius: 8),
            ],
          ),
        ),
      );
    }

    if (_livestream == null || _controller == null) {
      return Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        appBar: _buildAppBar(),
        body: SingleChildScrollView(
          child: Column(
            children: [
              const SizedBox(height: 40),
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
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
                      Text('No live stream available', style: AppType.h3),
                      const SizedBox(height: 8),
                      Text(
                        'Check back later for live updates\nfrom your area',
                        textAlign: TextAlign.center,
                        style: AppType.caption.copyWith(
                            color: AppColors.textSecondary, height: 1.5),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              _lactometerCard(),
              const SizedBox(height: 24),
            ],
          ),
        ),
      );
    }

    return YoutubePlayerBuilder(
      player: YoutubePlayer(
        controller: _controller!,
        showVideoProgressIndicator: true,
        progressIndicatorColor: AppColors.error,
        progressColors: const ProgressBarColors(
          playedColor: AppColors.error,
          handleColor: AppColors.error,
        ),
        onReady: () => _controller!.play(),
      ),
      builder: (context, player) {
        return Scaffold(
          backgroundColor: AppColors.scaffoldBg,
          appBar: _buildAppBar(),
          body: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                player,
                const SizedBox(height: 20),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '● LIVE',
                          style: AppType.microUpper.copyWith(
                            color: Colors.white,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _livestream!['title'] ?? 'Livestream',
                          style: AppType.h3,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                _lactometerCard(),
                const SizedBox(height: 24),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _lactometerCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.07),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFE8F4FD),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.water_drop_rounded,
                color: AppColors.primary, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Today's Lactometer Reading",
                  style: AppType.caption.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                _lactometerReading != null
                    ? RichText(
                        text: TextSpan(
                          children: [
                            TextSpan(
                              text: _lactometerReading!.toStringAsFixed(1),
                              style: AppType.h1.copyWith(
                                  color: AppColors.primary),
                            ),
                            TextSpan(
                              text: ' °LR',
                              style: AppType.body.copyWith(
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      )
                    : Text(
                        'Not updated yet',
                        style: AppType.body.copyWith(color: AppColors.textHint),
                      ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
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
    );
  }
}
