import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../services/api_service.dart';
import '../../widgets/remote_carousel.dart';

class LivestreamScreen extends StatefulWidget {
  const LivestreamScreen({super.key});

  @override
  State<LivestreamScreen> createState() => _LivestreamScreenState();
}

class _LivestreamScreenState extends State<LivestreamScreen> {
  Map<String, dynamic>? _livestream;
  Map<String, dynamic>? _upcoming;
  bool _loading = true;
  YoutubePlayerController? _controller;
  Timer? _transitionTimer;
  double? _morningReading;
  bool _morningNA = false;
  double? _eveningReading;
  bool _eveningNA = false;

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
      final upcomingData = results[0]['data']?['upcoming'] as Map<String, dynamic>?;
      final lactData = results[1]['data'] as Map<String, dynamic>?;
      final morningVal = lactData?['lactometer_morning'];
      final eveningVal = lactData?['lactometer_evening'];

      _controller?.dispose();
      _controller = null;
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
      if (!mounted) return;
      setState(() {
        _livestream = streamData;
        _upcoming = upcomingData;
        _morningReading = morningVal != null ? (morningVal as num).toDouble() : null;
        _morningNA = lactData != null && lactData.containsKey('lactometer_morning') && morningVal == null;
        _eveningReading = eveningVal != null ? (eveningVal as num).toDouble() : null;
        _eveningNA = lactData != null && lactData.containsKey('lactometer_evening') && eveningVal == null;
        _loading = false;
      });
      _scheduleLiveRefresh(upcomingData);
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _scheduleLiveRefresh(Map<String, dynamic>? upcoming) {
    _transitionTimer?.cancel();
    final startValue = upcoming?['scheduled_start_at'] as String?;
    if (startValue == null) return;
    final start = DateTime.tryParse(startValue)?.toLocal();
    if (start == null) return;
    final delay = start.difference(DateTime.now());
    if (delay.isNegative) {
      _loadData();
      return;
    }
    _transitionTimer = Timer(delay + const Duration(seconds: 1), _loadData);
  }

  @override
  void dispose() {
    _transitionTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  // ── Shared background stack ───────────────────────────────────────────────────
  Widget _withBackground({required Widget child}) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Sticky background image
        Positioned.fill(
          child: Image.asset('assets/images/bg2.jpg', fit: BoxFit.cover, cacheWidth: 800),
        ),
        // Dark scrim for readability
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xCC000000), Color(0x99000000), Color(0xBB000000)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.0, 0.4, 1.0],
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        extendBodyBehindAppBar: true,
        appBar: _buildAppBar(),
        body: _withBackground(
          child: const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SkeletonLoader(height: 220, width: double.infinity, borderRadius: 0),
                SizedBox(height: 20),
                SkeletonLoader(height: 20, width: 160, borderRadius: 8),
              ],
            ),
          ),
        ),
      );
    }

    if (_livestream == null || _controller == null) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        extendBodyBehindAppBar: true,
        appBar: _buildAppBar(),
        body: _withBackground(
          child: SafeArea(
            child: SingleChildScrollView(
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
                              color: Colors.white.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.2)),
                            ),
                            child: const Icon(Icons.live_tv_rounded,
                                size: 36, color: Colors.white),
                          ),
                          const SizedBox(height: 20),
                          Text(_upcoming == null ? 'No live stream available' : '${_slotLabel(_upcoming!['slot'])} live stream scheduled',
                              style: AppType.h3.copyWith(color: Colors.white)),
                          const SizedBox(height: 8),
                          Text(
                            _upcoming == null
                                ? 'Check back later for live updates\nfrom your area'
                                : 'The viewing link will open automatically\nwhen the stream begins.',
                            textAlign: TextAlign.center,
                            style: AppType.caption.copyWith(
                                color: Colors.white70, height: 1.5),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_upcoming != null) ...[
                    const SizedBox(height: 28),
                    _scheduledStreamCard(_upcoming!),
                  ],
                  const SizedBox(height: 32),
                  _lactometerCard(),
                  const SizedBox(height: 24),
                  _infoSection(),
                  const SizedBox(height: 32),
                ],
              ),
            ),
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
          backgroundColor: Colors.transparent,
          extendBodyBehindAppBar: true,
          appBar: _buildAppBar(),
          body: _withBackground(
            child: SafeArea(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Video player — full width, no padding so it fills edge-to-edge
                    ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                          bottom: Radius.circular(16)),
                      child: player,
                    ),
                    const SizedBox(height: 20),
                    // LIVE badge + title
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
                              style: AppType.h3.copyWith(color: Colors.white),
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
                    _infoSection(),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _infoSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Info',
            style: AppType.h3.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 12),
          const RemoteCarousel(
            location: 'livestream',
            fallbackAssets: ['assets/images/lact.png'],
            heightDivisor: 2.0,
            borderRadius: 16,
            dotColor: Colors.white,
            fit: BoxFit.contain,
          ),
        ],
      ),
    );
  }

  Widget _scheduledStreamCard(Map<String, dynamic> stream) {
    final start = DateTime.tryParse(stream['scheduled_start_at'] as String? ?? '')?.toLocal();
    final startLabel = start == null ? 'Scheduled soon' : DateFormat('EEE, d MMM / h:mm a').format(start);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFFFB74D).withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.schedule_rounded, color: Color(0xFFFFCC80)),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${_slotLabel(stream['slot'])} Slot',
                    style: AppType.caption.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(startLabel, style: AppType.small.copyWith(color: Colors.white70)),
                const SizedBox(height: 4),
                Text('Reminder sent 30 minutes before start',
                    style: AppType.micro.copyWith(color: Colors.white60)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _slotLabel(dynamic slot) => slot == 'evening' ? 'Evening' : 'Morning';

  Widget _lactometerCard() {
    final now = DateTime.now();
    final dateStr =
        '${_weekday(now.weekday)}, ${now.day} ${_month(now.month)} ${now.year}';
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.water_drop_rounded,
                    color: Colors.white, size: 18),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Lactometer Readings',
                      style: AppType.caption.copyWith(
                          color: Colors.white, fontWeight: FontWeight.w700)),
                  Text(dateStr,
                      style: AppType.micro
                          .copyWith(color: Colors.white60)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _slotTile('Morning', _morningReading, _morningNA)),
              const SizedBox(width: 12),
              Expanded(child: _slotTile('Evening', _eveningReading, _eveningNA)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _slotTile(String label, double? reading, bool isNA) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: AppType.micro
                  .copyWith(color: Colors.white60, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          if (isNA)
            Text('N/A',
                style: AppType.body
                    .copyWith(color: Colors.white54, fontWeight: FontWeight.w600))
          else if (reading != null)
            RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: reading.toStringAsFixed(1),
                    style: AppType.h2.copyWith(color: Colors.white),
                  ),
                  TextSpan(
                    text: ' °LR',
                    style: AppType.micro.copyWith(
                        color: Colors.white70, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            )
          else
            Text('Not updated',
                style: AppType.micro.copyWith(color: Colors.white54)),
        ],
      ),
    );
  }

  String _weekday(int d) =>
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d - 1];

  String _month(int m) => [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][m - 1];

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      leading: Padding(
        padding: const EdgeInsets.all(8),
        child: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
              border:
                  Border.all(color: Colors.white.withValues(alpha: 0.3)),
            ),
            child: const Icon(Icons.arrow_back_ios_new,
                size: 16, color: Colors.white),
          ),
        ),
      ),
      title: Text(
        'Live Stream',
        style: AppType.h2.copyWith(color: Colors.white),
      ),
    );
  }
}
