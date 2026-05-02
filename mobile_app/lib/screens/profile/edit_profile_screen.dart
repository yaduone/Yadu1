import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../widgets/premium_components.dart';
import '../../widgets/app_snackbar.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _line1Controller = TextEditingController();
  final _line2Controller = TextEditingController();
  final _pincodeController = TextEditingController();
  
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadCurrentData();
  }

  void _loadCurrentData() {
    final auth = context.read<AppAuthProvider>();
    final user = auth.userData;
    
    _nameController.text = user?['name'] ?? '';
    
    if (user?['address'] != null) {
      final address = user!['address'] as Map<String, dynamic>;
      _line1Controller.text = address['line1'] ?? '';
      _line2Controller.text = address['line2'] ?? '';
      _pincodeController.text = address['pincode'] ?? '';
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _line1Controller.dispose();
    _line2Controller.dispose();
    _pincodeController.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);

    try {
      final payload = {
        'name': _nameController.text.trim(),
        'address': {
          'line1': _line1Controller.text.trim(),
          'line2': _line2Controller.text.trim(),
          'pincode': _pincodeController.text.trim(),
        },
      };

      await ApiService().put('/users/profile', payload);
      
      if (!mounted) return;
      
      // Reload profile to get updated data
      await context.read<AppAuthProvider>().loadProfile();
      
      if (!mounted) return;
      
      AppSnackbar.success(context, 'Profile updated successfully');
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.error(context, 'Failed to update profile: ${e.toString()}');
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Edit Profile',
          style: AppType.h3.copyWith(color: AppColors.textPrimary),
        ),
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: Image.asset(
              'assets/images/333.jpg',
              fit: BoxFit.cover,
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.55),
                    Colors.black.withValues(alpha: 0.15),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.35, 0.65],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  const SizedBox(height: 10),
                  
                  // Name field
                  const SectionLabel('Full Name', color: Colors.white70),
                  const SizedBox(height: 10),
                  PremiumCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: TextFormField(
                      controller: _nameController,
                      style: AppType.body,
                      decoration: const InputDecoration(
                        hintText: 'Enter your full name',
                        border: InputBorder.none,
                        prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Name is required';
                        }
                        if (v.trim().length < 2) {
                          return 'Name must be at least 2 characters';
                        }
                        return null;
                      },
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Address section
                  const SectionLabel('Delivery Address', color: Colors.white70),
                  const SizedBox(height: 10),
                  
                  PremiumCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: TextFormField(
                      controller: _line1Controller,
                      style: AppType.body,
                      decoration: const InputDecoration(
                        hintText: 'House/Flat No., Building Name',
                        border: InputBorder.none,
                        prefixIcon: Icon(Icons.home_outlined, size: 20),
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Address line 1 is required';
                        }
                        return null;
                      },
                    ),
                  ),

                  const SizedBox(height: 12),

                  PremiumCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: TextFormField(
                      controller: _line2Controller,
                      style: AppType.body,
                      decoration: const InputDecoration(
                        hintText: 'Street, Area, Landmark (Optional)',
                        border: InputBorder.none,
                        prefixIcon: Icon(Icons.location_on_outlined, size: 20),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  PremiumCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: TextFormField(
                      controller: _pincodeController,
                      style: AppType.body,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        hintText: 'Pincode',
                        border: InputBorder.none,
                        prefixIcon: Icon(Icons.pin_drop_outlined, size: 20),
                        counterText: '',
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Pincode is required';
                        }
                        if (v.trim().length != 6 || !RegExp(r'^\d{6}$').hasMatch(v.trim())) {
                          return 'Enter a valid 6-digit pincode';
                        }
                        return null;
                      },
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Save button
                  SizedBox(
                    height: 54,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _saveProfile,
                      child: _saving
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2.5,
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.check_rounded, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  'Save Changes',
                                  style: AppType.button.copyWith(color: Colors.white),
                                ),
                              ],
                            ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  Center(
                    child: TextButton(
                      onPressed: _saving ? null : () => Navigator.pop(context),
                      child: Text(
                        'Cancel',
                        style: AppType.caption.copyWith(
                          color: Colors.white70,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
