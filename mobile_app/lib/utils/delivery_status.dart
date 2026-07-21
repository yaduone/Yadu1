import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class DeliveryStatus {
  DeliveryStatus._();

  static String normalize(String? status) {
    // 'rejected' is instant-only: the store never accepted the order.
    if (status == 'skipped' || status == 'cancelled' || status == 'rejected') {
      return 'not_delivered';
    }
    // 'acknowledged' is instant-only: accepted and out for delivery, which maps
    // onto the same "in progress" bucket as a pending scheduled delivery.
    if (status == 'acknowledged') return 'pending';
    return status ?? '';
  }

  static String label(String? status) {
    switch (normalize(status)) {
      case 'delivered':
        return 'Delivered';
      case 'pending':
        return 'Pending';
      case 'not_delivered':
        return 'Not Delivered';
      default:
        return 'No Record';
    }
  }

  static Color color(String? status) {
    switch (normalize(status)) {
      case 'delivered':
        return AppColors.success;
      case 'pending':
        return AppColors.warning;
      case 'not_delivered':
        return AppColors.error;
      default:
        return AppColors.textHint;
    }
  }

  static IconData icon(String? status) {
    switch (normalize(status)) {
      case 'delivered':
        return Icons.check_circle_rounded;
      case 'pending':
        return Icons.schedule_rounded;
      case 'not_delivered':
        return Icons.cancel_rounded;
      default:
        return Icons.info_outline_rounded;
    }
  }

  static String notDeliveredExplanation(Map<String, dynamic>? data) {
    switch (data?['non_delivery_reason'] as String?) {
      case 'skipped':
        return 'Delivery was skipped.';
      case 'not_marked_delivered':
        return 'Delivery was not confirmed by the delivery team.';
      case 'cancelled':
        return 'Delivery was cancelled.';
      default:
        return 'Delivery was not completed.';
    }
  }
}
