class AppConstants {
  // LOCAL TESTING — revert to the hosted URLs below before release builds.
  // static const String apiBaseUrl = 'http://10.0.2.2:3000/api'; // Android emulator
  // static const String apiFallbackUrl = 'http://10.0.2.2:3000/api';
  static const String apiBaseUrl = 'https://backend.yaduone111.workers.dev/api'; // production
  static const String apiFallbackUrl = 'https://yadu1.up.railway.app/api'; // production fallback
  // static const String apiBaseUrl = 'http://localhost:3000/api'; // iOS simulator / desktop
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
    'morning': '7:00 am to 10:00 am',
    'evening': '5:00 pm to 8:00 pm',
    'both': '7:00 am to 10:00 am & 5:00 pm to 8:00 pm',
  };
}
