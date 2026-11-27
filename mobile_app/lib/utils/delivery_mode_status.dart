import '../providers/cart_provider.dart';
import '../providers/instant_provider.dart';
import 'cart_delivery_copy.dart';

/// How a delivery mode's status should read: green when it is taking orders,
/// amber when it is but about to stop, grey when it is not.
enum DeliveryModeTone { ok, warn, off }

/// Whether Scheduled or Instant delivery is taking orders right now, worded
/// for the status chips on the products page and the products card on Home.
///
/// The add buttons read [active] from the same object, so a chip saying
/// "Closed" and a button that still adds can never disagree.
class DeliveryModeStatus {
  /// New items may be added to this mode's cart.
  final bool active;

  /// Short state, e.g. "Active", "Open now", "Closed".
  final String title;

  /// One line of context, e.g. "Delivers Fri, 28 Nov".
  final String detail;

  /// The most compact form, for narrow chips: "Fri, 28 Nov", "In 30 min".
  final String short;

  /// Two-word reason shown on a disabled add button, e.g. "Closed now".
  final String blockedLabel;

  /// Full sentence explaining why adding is blocked, shown when a disabled
  /// add button is tapped. Empty while [active].
  final String message;

  final DeliveryModeTone tone;

  const DeliveryModeStatus({
    required this.active,
    required this.title,
    required this.detail,
    required this.short,
    required this.blockedLabel,
    required this.tone,
    this.message = '',
  });

  /// Scheduled extras go into the next delivery's cart. That cart is keyed by
  /// the target date the server returns, so nothing can be added until it has
  /// loaded: the pending-cart cache is restored per date and would otherwise
  /// overwrite items added in the meantime.
  static DeliveryModeStatus scheduled(CartProvider cart) {
    final status = cart.tomorrowStatus;
    if (status == null) {
      return cart.isLoading
          ? const DeliveryModeStatus(
              active: false,
              title: 'Checking',
              detail: 'Loading…',
              short: 'Loading…',
              blockedLabel: 'Loading',
              tone: DeliveryModeTone.off,
              message: 'Still loading your next delivery. Try again in a moment.',
            )
          : const DeliveryModeStatus(
              active: false,
              title: 'Unavailable',
              detail: 'Pull down to retry',
              short: 'Unavailable',
              blockedLabel: 'Unavailable',
              tone: DeliveryModeTone.off,
              message: "Couldn't load your next delivery. Pull down to retry.",
            );
    }
    if (cart.isLocked) {
      return DeliveryModeStatus(
        active: false,
        title: 'Locked',
        detail: 'Cutoff passed',
        short: 'Locked',
        blockedLabel: 'Locked',
        tone: DeliveryModeTone.off,
        message:
            'The cutoff for ${CartDeliveryCopy.dateLabel(status)} has passed.',
      );
    }
    return DeliveryModeStatus(
      active: true,
      title: 'Active',
      detail: 'Delivers ${CartDeliveryCopy.dateLabel(status)}',
      short: CartDeliveryCopy.dateLabel(status),
      blockedLabel: '',
      tone: DeliveryModeTone.ok,
    );
  }

  /// Instant delivery follows the admin's daily window (and master switch).
  /// It also needs the instant catalog loaded, since instant prices and the
  /// cart lines built from them come from it.
  static DeliveryModeStatus instant(InstantProvider instant) {
    if (!instant.productsLoaded) {
      return const DeliveryModeStatus(
        active: false,
        title: 'Checking',
        detail: 'Loading…',
        short: 'Loading…',
        blockedLabel: 'Loading',
        tone: DeliveryModeTone.off,
        message: 'Still loading instant delivery. Try again in a moment.',
      );
    }
    final window = instant.windowLabel;
    if (!instant.isInstantOpen) {
      if (instant.isInstantDisabled) {
        return const DeliveryModeStatus(
          active: false,
          title: 'Paused',
          detail: 'Paused by the store',
          short: 'Paused',
          blockedLabel: 'Paused',
          tone: DeliveryModeTone.off,
          message: 'Instant delivery is unavailable right now.',
        );
      }
      final untilOpen = instant.minutesUntilOpen;
      final detail = untilOpen != null
          ? 'Opens in ${formatMinutes(untilOpen)}'
          : (window != null ? 'Open daily $window' : 'Closed right now');
      return DeliveryModeStatus(
        active: false,
        title: 'Closed',
        detail: detail,
        short: untilOpen != null ? detail : 'Closed',
        blockedLabel: 'Closed now',
        tone: DeliveryModeTone.off,
        message: untilOpen != null && window != null
            ? 'Instant delivery is closed. $detail · daily $window.'
            : 'Instant delivery is closed. $detail.',
      );
    }
    final untilClose = instant.minutesUntilClose;
    if (untilClose != null && untilClose <= 60) {
      return DeliveryModeStatus(
        active: true,
        title: 'Closing soon',
        detail: 'Closes in ${formatMinutes(untilClose)}',
        short: 'Closes in ${formatMinutes(untilClose)}',
        blockedLabel: '',
        tone: DeliveryModeTone.warn,
      );
    }
    return DeliveryModeStatus(
      active: true,
      title: 'Open now',
      detail: 'Arrives in ${instant.etaMinutes} min',
      short: 'In ${instant.etaMinutes} min',
      blockedLabel: '',
      tone: DeliveryModeTone.ok,
    );
  }

  static String formatMinutes(int minutes) {
    if (minutes < 60) return '$minutes min';
    final hours = minutes ~/ 60;
    final mins = minutes % 60;
    return mins == 0 ? '$hours hr' : '$hours hr $mins min';
  }
}
