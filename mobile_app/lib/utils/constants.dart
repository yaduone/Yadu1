class AppConstants {
  static const String apiBaseUrl = 'https://backend.yaduone111.workers.dev/api';
  static const String apiFallbackUrl = 'https://yadu1.up.railway.app/api';
  // static const String apiBaseUrl = 'http://10.0.2.2:3000/api'; // Android emulator
  // static const String apiBaseUrl = 'http://localhost:3000/api'; // iOS simulator
  static const String appName = 'YaduONE';
  static const List<String> milkTypes = ['Cow', 'Buffalo', 'Child Pack'];
  static const Map<String, String> milkTypeLabels = {
    'cow': 'Cow Milk',
    'buffalo': 'Buffalo Milk',
    'toned': 'Child Pack',
  };

  static const List<String> deliverySlots = ['morning', 'evening', 'both'];
  static const Map<String, String> deliverySlotLabels = {
    'morning': 'Morning',
    'evening': 'Evening',
    'both': 'Morning & Evening',
  };
  static const Map<String, String> deliverySlotSubtitles = {
    'morning': 'Delivered in the morning',
    'evening': 'Delivered in the evening',
    'both': 'Delivered twice daily',
  };
}
