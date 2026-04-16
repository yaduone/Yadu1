import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

class DueScreen extends StatefulWidget {
  const DueScreen({super.key});

  @override
  State<DueScreen> createState() => _DueScreenState();
}

class _DueScreenState extends State<DueScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
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
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.arrow_back_ios_new, size: 16),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Due Amount'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          indicatorSize: TabBarIndicatorSize.label,
          tabs: const [
            Tab(text: 'Balance'),
            Tab(text: 'My Tickets'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _BalanceTab(),
          _TicketsTab(),
        ],
      ),
    );
  }
}

// ─── Balance Tab ──────────────────────────────────────────────────────────────

class _BalanceTab extends StatefulWidget {
  const _BalanceTab();

  @override
  State<_BalanceTab> createState() => _BalanceTabState();
}

class _BalanceTabState extends State<_BalanceTab> {
  Map<String, dynamic>? _due;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService().get('/dues/me');
      setState(() { _due = res['data']; _loading = false; });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(strokeWidth: 2.5));

    final due = (_due?['due_amount'] as num?)?.toDouble() ?? 0;
    final billed = (_due?['total_billed'] as num?)?.toDouble() ?? 0;
    final paid = (_due?['total_paid'] as num?)?.toDouble() ?? 0;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 8),

          // Main due card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: due > 0
                    ? [const Color(0xFFFF6B6B), const Color(0xFFFF3B30)]
                    : [AppColors.primary, AppColors.primaryDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: (due > 0 ? AppColors.error : AppColors.primary).withAlpha(50),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withAlpha(30),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        due > 0 ? Icons.account_balance_wallet_outlined : Icons.check_circle_outline_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      due > 0 ? 'Outstanding Due' : 'All Clear',
                      style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  'Rs.${due.toStringAsFixed(2)}',
                  style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w800, letterSpacing: -1),
                ),
                if (due > 0)
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text(
                      'Please pay to your delivery agent',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Breakdown
          PremiumCard(
            child: Column(
              children: [
                _row('Total Billed', 'Rs.${billed.toStringAsFixed(2)}', AppColors.textPrimary),
                const Divider(height: 20),
                _row('Total Paid', 'Rs.${paid.toStringAsFixed(2)}', AppColors.success),
                const Divider(height: 20),
                _row(
                  'Balance Due',
                  'Rs.${due.toStringAsFixed(2)}',
                  due > 0 ? AppColors.error : AppColors.success,
                  bold: true,
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Raise ticket CTA
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary.withAlpha(40)),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.support_agent_rounded, color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Dispute a charge?', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                      SizedBox(height: 2),
                      Text('Raise a ticket and we\'ll look into it', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => _showRaiseTicketSheet(context),
                  child: const Text('Raise'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, Color valueColor, {bool bold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
        Text(
          value,
          style: TextStyle(
            fontSize: bold ? 16 : 14,
            fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
            color: valueColor,
          ),
        ),
      ],
    );
  }

  void _showRaiseTicketSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _RaiseTicketSheet(onSubmitted: () {
        // switch to tickets tab — navigate to DueScreen and select tab
      }),
    );
  }
}

// ─── Tickets Tab ─────────────────────────────────────────────────────────────

class _TicketsTab extends StatefulWidget {
  const _TicketsTab();

  @override
  State<_TicketsTab> createState() => _TicketsTabState();
}

class _TicketsTabState extends State<_TicketsTab> {
  List<dynamic> _tickets = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService().get('/dues/tickets/me');
      setState(() { _tickets = res['data']?['tickets'] ?? []; _loading = false; });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(strokeWidth: 2.5));

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: _tickets.isEmpty
          ? ListView(
              children: [
                const SizedBox(height: 80),
                Center(
                  child: Column(
                    children: [
                      Icon(Icons.inbox_outlined, size: 52, color: AppColors.textHint),
                      const SizedBox(height: 12),
                      const Text('No tickets raised', style: TextStyle(color: AppColors.textSecondary, fontSize: 15)),
                      const SizedBox(height: 8),
                      const Text('Raise a ticket from the Balance tab', style: TextStyle(color: AppColors.textHint, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: _tickets.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final t = _tickets[i];
                final status = t['status'] as String? ?? 'open';
                return PremiumCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              t['subject'] ?? '',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary),
                            ),
                          ),
                          _statusBadge(status),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(t['description'] ?? '', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
                      if (t['admin_notes'] != null && (t['admin_notes'] as String).isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceBg,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.admin_panel_settings_outlined, size: 14, color: AppColors.primary),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  t['admin_notes'],
                                  style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, height: 1.4),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
    );
  }

  Widget _statusBadge(String status) {
    final (color, bg) = switch (status) {
      'open'      => (AppColors.error, AppColors.error.withAlpha(15)),
      'in_review' => (AppColors.warning, AppColors.warning.withAlpha(15)),
      'resolved'  => (AppColors.success, AppColors.success.withAlpha(15)),
      _           => (AppColors.textHint, AppColors.surfaceBg),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        status.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color, letterSpacing: 0.5),
      ),
    );
  }
}

// ─── Raise Ticket Sheet ───────────────────────────────────────────────────────

class _RaiseTicketSheet extends StatefulWidget {
  final VoidCallback? onSubmitted;
  const _RaiseTicketSheet({this.onSubmitted});

  @override
  State<_RaiseTicketSheet> createState() => _RaiseTicketSheetState();
}

class _RaiseTicketSheetState extends State<_RaiseTicketSheet> {
  final _subjectCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _subjectCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_subjectCtrl.text.trim().isEmpty || _descCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Subject and description are required');
      return;
    }
    setState(() { _submitting = true; _error = null; });
    try {
      await ApiService().post('/dues/tickets', {
        'subject': _subjectCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
      });
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Ticket raised successfully'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
        widget.onSubmitted?.call();
      }
    } catch (e) {
      setState(() { _error = e.toString(); _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(width: 36, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
            ),
            const SizedBox(height: 20),
            const Text('Raise a Ticket', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            const Text('Describe your due amount concern', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 20),
            TextField(
              controller: _subjectCtrl,
              decoration: InputDecoration(
                labelText: 'Subject',
                hintText: 'e.g. Incorrect charge on 15 Apr',
                filled: true,
                fillColor: AppColors.surfaceBg,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: 'Description',
                hintText: 'Explain what seems wrong with your due amount…',
                filled: true,
                fillColor: AppColors.surfaceBg,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                ),
                alignLabelWithHint: true,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 12.5)),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                    : const Text('Submit Ticket', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
