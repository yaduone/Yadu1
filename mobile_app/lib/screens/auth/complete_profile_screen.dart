import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
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
      });
    } catch (_) {
      setState(() => _loadingAreas = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AppAuthProvider>();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.surfaceBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 16),
          ),
          onPressed: () async {
            final confirm = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Go back to login?'),
                content: const Text('You will be signed out and can log in with a different number.'),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Stay')),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Sign Out', style: TextStyle(color: AppColors.error)),
                  ),
                ],
              ),
            );
            if (confirm == true && mounted) {
              context.read<AppAuthProvider>().logout();
            }
          },
        ),
        title: const Text('Complete Profile'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 8),
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
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.person_outline_rounded, size: 36, color: AppColors.primary),
              ),
            ),
            const SizedBox(height: 16),
            const Center(
              child: Text(
                'Set up your delivery profile',
                style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
              ),
            ),
            const SizedBox(height: 32),

            _buildField('Full Name', _nameController, Icons.person_rounded),
            const SizedBox(height: 18),

            const Text(
              'Delivery Area',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            _loadingAreas
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2.5))
                : DropdownButtonFormField<String>(
                    value: _selectedAreaId,
                    items: _areas
                        .map((a) => DropdownMenuItem(value: a['id'] as String, child: Text(a['name'] as String)))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedAreaId = v),
                    decoration: InputDecoration(
                      hintText: 'Choose your area',
                      prefixIcon: const Icon(Icons.location_on_outlined, color: AppColors.textHint, size: 20),
                      filled: true,
                      fillColor: AppColors.surfaceBg,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),

            const SizedBox(height: 18),
            _buildField('Address Line 1', _line1Controller, Icons.home_outlined),
            const SizedBox(height: 14),
            _buildField('Address Line 2 (Optional)', _line2Controller, Icons.apartment_outlined),
            const SizedBox(height: 14),
            _buildField('Landmark (Optional)', _landmarkController, Icons.place_outlined),
            const SizedBox(height: 14),
            _buildField('Pincode', _pincodeController, Icons.pin_drop_outlined, keyboardType: TextInputType.number),

            if (auth.error != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withAlpha(15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, size: 18, color: AppColors.error),
                    const SizedBox(width: 8),
                    Expanded(child: Text(auth.error!, style: const TextStyle(color: AppColors.error, fontSize: 13))),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: auth.isLoading
                  ? null
                  : () async {
                      if (_nameController.text.isEmpty || _selectedAreaId == null || _line1Controller.text.isEmpty || _pincodeController.text.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: const Text('Fill all required fields'),
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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
                    },
              child: auth.isLoading
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                  : const Text('Save Profile'),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController ctrl, IconData icon, {TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textPrimary)),
        const SizedBox(height: 8),
        TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppColors.textHint, size: 20),
          ),
        ),
      ],
    );
  }
}
