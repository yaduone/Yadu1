class AppConstants {
  static const String apiBaseUrl = 'http://10.152.122.124:3000/api'; // Physical device
  // static const String apiBaseUrl = 'http://10.0.2.2:3000/api'; // Android emulator
  // static const String apiBaseUrl = 'http://localhost:3000/api'; // iOS simulator
  static const String appName = 'YaduONE';
  static const List<String> milkTypes = ['Cow', 'Buffalo', 'Toned'];
  static const Map<String, String> milkTypeLabels = {
    'cow': 'Cow Milk',
    'buffalo': 'Buffalo Milk',
    'toned': 'Toned Milk',
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
