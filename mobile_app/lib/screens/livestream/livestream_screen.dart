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

  @override
  void initState() {
    super.initState();
    _loadLivestream();
  }

  Future<void> _loadLivestream() async {
    try {
      final res = await ApiService().get('/livestreams/active');
      final data = res['data']?['livestream'] as Map<String, dynamic>?;
      if (data != null) {
        final videoId =
            YoutubePlayer.convertUrlToId(data['youtube_url'] ?? '');
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
        _livestream = data;
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
        body: Center(
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
                Text('No live stream available', style: AppType.h3),
                const SizedBox(height: 8),
                Text(
                  'Check back later for live updates\nfrom your area',
                  textAlign: TextAlign.center,
                  style: AppType.caption
                      .copyWith(color: AppColors.textSecondary, height: 1.5),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // YoutubePlayerBuilder handles orientation/fullscreen automatically
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
          body: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Player fills full width at 16:9
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
            ],
          ),
        );
      },
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
