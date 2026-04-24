import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class CompleteProfileScreen extends StatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  State<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends State<CompleteProfileScreen> {
  final _nameController = TextEditingController();
  final _line1Controller = TextEditingController();
  final _line2Controller = TextEditingController();
  final _landmarkController = TextEditingController();
  final _pincodeController = TextEditingController();
  String? _selectedAreaId;
  List<Map<String, dynamic>> _areas = [];
  bool _loadingAreas = true;

  @override
  void initState() {
    super.initState();
    _loadAreas();
  }

  Future<void> _loadAreas() async {
    try {
      final res = await ApiService().get('/areas');
      final list = (res['data']?['areas'] as List?) ?? [];
      setState(() {
        _areas = list.cast<Map<String, dynamic>>();
        _loadingAreas = false;
        // Smart default: auto-select if only one area
        if (_areas.length == 1) {
          _selectedAreaId = _areas.first['id'] as String;
        }
      });
    } catch (_) {
      setState(() => _loadingAreas = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AppAuthProvider>();

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
          // Soft exit: go back without logout
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Complete Profile', style: AppType.h2),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header illustration
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: const Icon(Icons.person_outline_rounded,
                          size: 36, color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: Text(
                      'Set up your delivery profile',
                      style:
                          AppType.caption.copyWith(color: AppColors.textSecondary),
                    ),
                  ),
                  const SizedBox(height: 32),

                  _buildField(
                      'Full Name', _nameController, Icons.person_rounded),
                  const SizedBox(height: 18),

                  Text('Delivery Area', style: AppType.captionBold),
                  const SizedBox(height: 8),
                  _loadingAreas
                      ? const Center(
                          child: Padding(
                          padding: EdgeInsets.all(16),
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        ))
                      : DropdownButtonFormField<String>(
                          initialValue: _selectedAreaId,
                          items: _areas
                              .map((a) => DropdownMenuItem(
                                  value: a['id'] as String,
                                  child: Text(a['name'] as String)))
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _selectedAreaId = v),
                          decoration: InputDecoration(
                            hintText: 'Choose your area',
                            prefixIcon: const Icon(
                                Icons.location_on_outlined,
                                color: AppColors.textHint,
                                size: 20),
                            filled: true,
                            fillColor: AppColors.surfaceBg,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),

                  const SizedBox(height: 18),
                  _buildField('Address Line 1', _line1Controller,
                      Icons.home_outlined),
                  const SizedBox(height: 14),
                  _buildField('Address Line 2 (Optional)',
                      _line2Controller, Icons.apartment_outlined),
                  const SizedBox(height: 14),
                  _buildField('Landmark (Optional)', _landmarkController,
                      Icons.place_outlined),
                  const SizedBox(height: 14),
                  _buildField(
                      'Pincode', _pincodeController, Icons.pin_drop_outlined,
                      keyboardType: TextInputType.number),

                  if (auth.error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline,
                              size: 18, color: AppColors.error),
                          const SizedBox(width: 8),
                          Expanded(
                              child: Text(auth.error!,
                                  style: AppType.small
                                      .copyWith(color: AppColors.error))),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),

          // Sticky bottom CTA
          StickyBottomBar(
            child: ElevatedButton(
              onPressed: auth.isLoading ? null : _handleSave,
              child: auth.isLoading
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2.5))
                  : Text('Save Profile',
                      style: AppType.button.copyWith(color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleSave() async {
    final auth = context.read<AppAuthProvider>();
    if (_nameController.text.isEmpty ||
        _selectedAreaId == null ||
        _line1Controller.text.isEmpty ||
        _pincodeController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Fill all required fields'),
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }
    await auth.completeProfile(
      name: _nameController.text.trim(),
      areaId: _selectedAreaId!,
      address: {
        'line1': _line1Controller.text.trim(),
        'line2': _line2Controller.text.trim(),
        'landmark': _landmarkController.text.trim(),
        'pincode': _pincodeController.text.trim(),
      },
    );
    if (auth.isProfileComplete && mounted) {
      Navigator.pop(context);
    }
  }

  Widget _buildField(
      String label, TextEditingController ctrl, IconData icon,
      {TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppType.captionBold),
        const SizedBox(height: 8),
        TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          style: AppType.body,
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppColors.textHint, size: 20),
          ),
        ),
      ],
    );
  }
}
