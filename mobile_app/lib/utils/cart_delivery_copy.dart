import 'package:intl/intl.dart';

import 'constants.dart';

class CartDeliveryCopy {
  CartDeliveryCopy._();

  static String dateLabel(Map<String, dynamic>? status) {
    final rawDate = status?['date'];
    if (rawDate is! String || rawDate.isEmpty) return 'your target date';

    final parsed = DateTime.tryParse(rawDate);
    if (parsed == null) return rawDate;

    return DateFormat('EEE, d MMM').format(parsed);
  }

  static String windowLabel(Map<String, dynamic>? status) {
    final slot = _deliverySlot(status);
    if (slot == null) return 'your scheduled delivery window';

    final label = AppConstants.deliverySlotLabels[slot] ?? _titleCase(slot);
    final time = AppConstants.deliverySlotSubtitles[slot];
    if (time == null || time.isEmpty) return label;

    return '$label ($time)';
  }

  static String targetPhrase(Map<String, dynamic>? status) {
    return '${dateLabel(status)} during ${windowLabel(status)}';
  }

  static String cartContentsLabel(Map<String, dynamic>? status) {
    final hasMilk = status?['effective_milk'] != null;
    final extraCount = _extraCount(status);

    if (hasMilk && extraCount > 0) {
      return 'your subscription milk and $extraCount extra ${_itemWord(extraCount)}';
    }
    if (hasMilk) return 'your subscription milk';
    if (extraCount > 0) return '$extraCount extra ${_itemWord(extraCount)}';
    if (status?['is_skipped'] == true) return 'your skipped milk delivery';
    return 'this cart';
  }

  static String cartSummary(Map<String, dynamic>? status) {
    final hasMilk = status?['effective_milk'] != null;
    final extraCount = _extraCount(status);

    if (status?['is_skipped'] == true && extraCount == 0) {
      return 'No milk delivery is scheduled for ${dateLabel(status)}.';
    }

    if (hasMilk || extraCount > 0) {
      return 'Everything in this cart, including ${cartContentsLabel(status)}, is scheduled for delivery on ${targetPhrase(status)}.';
    }

    return 'Add dairy essentials here and they will be scheduled for ${targetPhrase(status)}.';
  }

  static String updatedMessage(
    Map<String, dynamic>? status, {
    int? addedQuantity,
  }) {
    final prefix = addedQuantity == null
        ? 'Cart modified.'
        : 'Cart modified with $addedQuantity ${_itemWord(addedQuantity)}.';
    return '$prefix ${_capitalize(cartContentsLabel(status))} will be delivered on ${targetPhrase(status)}.';
  }

  static int _extraCount(Map<String, dynamic>? status) {
    final extras = status?['extra_items'];
    if (extras is List) return extras.length;
    return 0;
  }

  static String? _deliverySlot(Map<String, dynamic>? status) {
    final effectiveMilk = status?['effective_milk'];
    if (effectiveMilk is Map && effectiveMilk['delivery_slot'] is String) {
      final slot = effectiveMilk['delivery_slot'] as String;
      if (slot.isNotEmpty) return slot;
    }

    final subscription = status?['subscription'];
    if (subscription is Map && subscription['delivery_slot'] is String) {
      final slot = subscription['delivery_slot'] as String;
      if (slot.isNotEmpty) return slot;
    }

    return null;
  }

  static String _itemWord(int quantity) => quantity == 1 ? 'item' : 'items';

  static String _capitalize(String value) {
    if (value.isEmpty) return value;
    return '${value[0].toUpperCase()}${value.substring(1)}';
  }

  static String _titleCase(String value) {
    return value
        .split('_')
        .map(
          (part) => part.isEmpty
              ? part
              : '${part[0].toUpperCase()}${part.substring(1)}',
        )
        .join(' ');
  }
}
