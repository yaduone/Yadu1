import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../services/api_service.dart';
import '../../../theme/app_typography.dart';
import '../../../utils/constants.dart';
import '../../../widgets/app_snackbar.dart';
import '../../../widgets/tappable.dart';

/// Home-screen card for the area's latest published milk quality report
/// (lab results per milk variety + adulteration screens), with a button that
/// opens the branded YaduONE PDF in the browser.
///
/// Renders nothing until a report exists, so [header] and the trailing gap
/// only appear alongside a real report.
class MilkQualityCard extends StatefulWidget {
  final Widget header;

  const MilkQualityCard({super.key, required this.header});

  @override
  State<MilkQualityCard> createState() => MilkQualityCardState();
}

class MilkQualityCardState extends State<MilkQualityCard> {
  Map<String, dynamic>? _report;
  bool _isToday = false;
  bool _downloading = false;

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<Map<String, dynamic>?> _fetch() async {
    final res = await ApiService().get('/milk-quality/today');
    return res['data'] as Map<String, dynamic>?;
  }

  /// Re-fetch the report; called on first build and on pull-to-refresh.
  Future<void> reload() async {
    try {
      final data = await _fetch();
      if (!mounted) return;
      final report = data?['report'] as Map<String, dynamic>?;
      setState(() {
        _report = report;
        _isToday = data?['is_today'] == true;
      });
    } catch (_) {
      // Incomplete profile, offline, or a backend without this endpoint:
      // keep whatever was shown before rather than flashing an error on Home.
    }
  }

  Future<void> _downloadPdf() async {
    if (_downloading) return;
    setState(() => _downloading = true);
    try {
      // Links are short-lived, so fetch a fresh one on every tap.
      final data = await _fetch();
      final url = _pdfUri(data);
      if (url == null) {
        if (mounted) AppSnackbar.error(context, 'The report is not available right now.');
        return;
      }
      final opened = await launchUrl(url, mode: LaunchMode.externalApplication);
      if (!opened && mounted) {
        AppSnackbar.error(context, 'Could not open the PDF. Please try again.');
      }
    } catch (e) {
      if (mounted) AppSnackbar.error(context, e.toString());
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Uri? _pdfUri(Map<String, dynamic>? data) {
    final absolute = data?['pdf_url'] as String?;
    if (absolute != null && absolute.startsWith('http')) return Uri.tryParse(absolute);
    final path = data?['pdf_path'] as String?;
    if (path == null) return null;
    return Uri.tryParse('${AppConstants.apiBaseUrl}$path');
  }

  @override
  Widget build(BuildContext context) {
    final report = _report;
    if (report == null || ((report['samples'] as List?)?.isEmpty ?? true)) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        widget.header,
        const SizedBox(height: 10),
        MilkQualityReportView(
          report: report,
          isToday: _isToday,
          downloading: _downloading,
          onDownload: _downloadPdf,
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

/// The report card itself (presentation only): banner, summary, per-variety
/// metric tiles and the download button.
class MilkQualityReportView extends StatefulWidget {
  final Map<String, dynamic> report;
  final bool isToday;
  final bool downloading;
  final VoidCallback onDownload;

  const MilkQualityReportView({
    super.key,
    required this.report,
    required this.isToday,
    required this.downloading,
    required this.onDownload,
  });

  @override
  State<MilkQualityReportView> createState() => _MilkQualityReportViewState();
}

class _MilkQualityReportViewState extends State<MilkQualityReportView> {
  static const _ink = Color(0xFF082F49);
  static const _muted = Color(0xFF6B8798);
  static const _green = Color(0xFF2F9E5B);
  static const _teal = Color(0xFF1C7FA6);
  static const _navy = Color(0xFF1D3F8F);
  static const _amber = Color(0xFFD97706);

  int _variety = 0;

  @override
  Widget build(BuildContext context) {
    final report = widget.report;
    final samples = (report['samples'] as List).cast<Map<String, dynamic>>();
    final sample = samples[_variety.clamp(0, samples.length - 1)];
    final parameters = (sample['parameters'] as List).cast<Map<String, dynamic>>();
    final summary = (report['summary'] as Map?)?.cast<String, dynamic>() ?? const {};
    final tested = (summary['parameters_tested'] as num?)?.toInt() ?? 0;
    final inRange = (summary['parameters_in_range'] as num?)?.toInt() ?? 0;
    final testsDone = (summary['tests_done'] as num?)?.toInt() ?? 0;
    final testsFlagged = (summary['tests_flagged'] as num?)?.toInt() ?? 0;
    final allClear = tested > 0 && inRange == tested && testsFlagged == 0;

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.74),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.8)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF063B66).withValues(alpha: 0.10),
                blurRadius: 26,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildBanner(report),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildSummary(allClear, tested, inRange, testsDone, testsFlagged),
                    if (samples.length > 1) ...[
                      const SizedBox(height: 14),
                      _buildVarietyTabs(samples),
                    ],
                    const SizedBox(height: 12),
                    _buildMetricGrid(parameters),
                    const SizedBox(height: 14),
                    _buildDownloadButton(),
                    _buildFootnote(report),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBanner(Map<String, dynamic> report) {
    final date = DateTime.tryParse(report['date'] as String? ?? '');
    final dateText = date == null ? '' : DateFormat('EEE, d MMM').format(date);
    final grade = report['grade_label'] as String?;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_green, _teal, _navy],
          stops: [0.0, 0.55, 1.0],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Image.asset('assets/images/image.png', cacheWidth: 120),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.isToday ? "TODAY'S MILK QUALITY" : 'LATEST MILK QUALITY',
                  style: AppType.micro.copyWith(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  widget.isToday ? 'Tested $dateText' : 'Last tested $dateText',
                  style: AppType.captionBold.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          if (grade != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.workspace_premium_rounded, color: Colors.white, size: 14),
                  const SizedBox(width: 4),
                  Text(
                    grade,
                    style: AppType.micro.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSummary(bool allClear, int tested, int inRange, int testsDone, int testsFlagged) {
    final color = allClear ? _green : _amber;
    final screens = testsDone == 0
        ? null
        : testsFlagged == 0
            ? 'No adulterants detected ($testsDone checks)'
            : '$testsFlagged of $testsDone adulteration checks flagged';
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            allClear ? Icons.verified_rounded : Icons.fact_check_rounded,
            color: color,
            size: 20,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                allClear ? 'All quality checks passed' : 'Quality checks completed',
                style: AppType.captionBold.copyWith(color: _ink, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 1),
              Text(
                '$inRange of $tested parameters in range${screens == null ? '' : ' · $screens'}',
                style: AppType.micro.copyWith(color: _muted, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildVarietyTabs(List<Map<String, dynamic>> samples) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF2F8),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          for (var i = 0; i < samples.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _variety = i),
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: i == _variety ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: i == _variety
                        ? [
                            BoxShadow(
                              color: const Color(0xFF063B66).withValues(alpha: 0.08),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    (samples[i]['short_label'] ?? samples[i]['label'] ?? '') as String,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.micro.copyWith(
                      color: i == _variety ? _ink : _muted,
                      fontWeight: i == _variety ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMetricGrid(List<Map<String, dynamic>> parameters) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 8.0;
        final width = (constraints.maxWidth - gap * 2) / 3;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final p in parameters) SizedBox(width: width, child: _MetricTile(parameter: p)),
          ],
        );
      },
    );
  }

  Widget _buildDownloadButton() {
    return Tappable(
      onTap: widget.onDownload,
      scaleFactor: 0.97,
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [_green, _teal, _navy],
            stops: [0.0, 0.55, 1.0],
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: _teal.withValues(alpha: 0.28),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Center(
          child: widget.downloading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.picture_as_pdf_rounded, color: Colors.white, size: 18),
                    const SizedBox(width: 8),
                    Text(
                      'Download PDF Report',
                      style: AppType.captionBold.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _buildFootnote(Map<String, dynamic> report) {
    final testedBy = (report['tested_by'] as String?)?.trim() ?? '';
    final time = report['sample_time'] as String? ?? '';
    final parts = <String>[
      if (testedBy.isNotEmpty) 'Tested by $testedBy',
      if (time.isNotEmpty) 'Sample collected ${_formatTime(time)}',
    ];
    if (parts.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Text(
        parts.join('  ·  '),
        textAlign: TextAlign.center,
        style: AppType.micro.copyWith(color: _muted, fontWeight: FontWeight.w600, fontSize: 11),
      ),
    );
  }

  String _formatTime(String hhmm) {
    final parts = hhmm.split(':');
    if (parts.length != 2) return hhmm;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return hhmm;
    return DateFormat('h:mm a').format(DateTime(2000, 1, 1, h, m));
  }
}

class _MetricTile extends StatelessWidget {
  final Map<String, dynamic> parameter;

  const _MetricTile({required this.parameter});

  static const _labels = {
    'fat': 'Fat',
    'snf': 'SNF',
    'lactose': 'Lactose',
    'protein': 'Protein',
    'lactometer': 'Lactometer',
    'ph': 'pH',
  };

  @override
  Widget build(BuildContext context) {
    final status = parameter['status'] as String? ?? 'not_tested';
    final tested = status != 'not_tested';
    final color = switch (status) {
      'ok' => const Color(0xFF2F9E5B),
      'low' || 'high' => const Color(0xFFD97706),
      _ => const Color(0xFF94A3B8),
    };
    final statusText = switch (status) {
      'ok' => 'In range',
      'low' => 'Low',
      'high' => 'High',
      _ => 'Not tested',
    };

    return Container(
      padding: const EdgeInsets.fromLTRB(10, 9, 10, 9),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: tested ? 0.22 : 0.14)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _labels[parameter['key']] ?? (parameter['label'] as String? ?? ''),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppType.micro.copyWith(
              color: const Color(0xFF6B8798),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 3),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              tested ? (parameter['display'] as String? ?? '—') : '—',
              style: AppType.h3.copyWith(
                color: const Color(0xFF082F49),
                fontWeight: FontWeight.w900,
                letterSpacing: -0.3,
              ),
            ),
          ),
          const SizedBox(height: 3),
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  statusText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.micro.copyWith(color: color, fontSize: 10.5, fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
