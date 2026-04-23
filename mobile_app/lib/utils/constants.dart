class AppConstants {
  static const String apiBaseUrl = 'http://192.168.4.239:3000/api'; // Physical device
  // static const String apiBaseUrl = 'http://10.0.2.2:3000/api'; // Android emulator
  // static const String apiBaseUrl = 'http://localhost:3000/api'; // iOS simulator
  static const String appName = 'Dairy Delivery';
  static const List<String> milkTypes = ['cow', 'buffalo', 'toned'];
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
