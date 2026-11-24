/**
 * Subscription lifecycle rules — the single source of truth shared by the
 * customer app routes, the admin panel and the nightly manifest job.
 *
 * Two ideas drive everything here:
 *
 * 1. STATE MACHINE. A subscription is `active`, `paused` or `cancelled`.
 *    Transitions are declared once, in TRANSITIONS, so every caller rejects the
 *    same impossible moves with the same message instead of each endpoint
 *    inventing its own ad-hoc `if (status !== 'active')` check.
 *
 * 2. EFFECTIVE DATE, NOT A LOCKOUT. A lifecycle change never edits a delivery
 *    that is already committed; it applies from the first delivery date still
 *    open for changes (`getCartTargetDate`, which rolls to the day after
 *    tomorrow once an area's cutoff has passed). This replaces the old
 *    behaviour of refusing pause/resume/cancel outright after the cutoff, which
 *    left customers unable to cancel for the rest of the day.
 */

const STATUSES = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
});

// Statuses a user may still act on / that occupy the "one subscription" slot.
const LIVE_STATUSES = Object.freeze([STATUSES.ACTIVE, STATUSES.PAUSED]);

const TRANSITIONS = Object.freeze({
  pause: {
    from: [STATUSES.ACTIVE],
    to: STATUSES.PAUSED,
    action: 'subscription.paused',
    error: 'Only an active subscription can be paused.',
  },
  resume: {
    from: [STATUSES.PAUSED],
    to: STATUSES.ACTIVE,
    action: 'subscription.resumed',
    error: 'Only a paused subscription can be resumed.',
  },
  cancel: {
    from: [STATUSES.ACTIVE, STATUSES.PAUSED],
    to: STATUSES.CANCELLED,
    action: 'subscription.cancelled',
    error: 'This subscription is already cancelled.',
  },
});

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

/**
 * Validate a requested transition against the current status.
 * Returns the transition descriptor; throws a 400 with a stable, user-facing
 * message when the move is not legal.
 */
function assertTransition(transitionName, currentStatus) {
  const transition = TRANSITIONS[transitionName];
  if (!transition) {
    throw badRequest(`Unknown subscription transition "${transitionName}".`);
  }
  if (!transition.from.includes(currentStatus)) {
    throw badRequest(transition.error);
  }
  return transition;
}

/**
 * Is this subscription supposed to produce a delivery on `date`?
 *
 * Consolidates the conditions that were previously checked inconsistently
 * across the nightly job, the manifest preview and the cart view: the
 * subscription must have started, and a pause/resume/cancel only counts from
 * the date it takes effect.
 *
 * A pause or cancel made after an area's cutoff takes effect the day after
 * tomorrow, so tomorrow's delivery is still owed even though the status has
 * already flipped. Such rows carry `delivery_stops_from` (first date with no
 * delivery) and `active_from` (first date of the run being stopped), and stay
 * deliverable for the dates in between. Rows written before those fields
 * existed keep the old behaviour: a paused/cancelled row is never deliverable.
 */
function isDeliverableOn(subscription, date) {
  if (!subscription) return false;
  if (subscription.start_date && subscription.start_date > date) return false;

  if (subscription.status === STATUSES.ACTIVE) {
    return !(subscription.effective_from && subscription.effective_from > date);
  }

  if (subscription.status === STATUSES.PAUSED || subscription.status === STATUSES.CANCELLED) {
    const stopsFrom = subscription.delivery_stops_from;
    if (!stopsFrom || stopsFrom <= date) return false;
    const activeFrom = subscription.active_from || null;
    return !(activeFrom && activeFrom > date);
  }

  return false;
}

/**
 * Fields to write when an active or paused subscription is paused/cancelled
 * with the change taking effect on `effectiveFrom`. Keeps the window of
 * deliveries still owed before the change applies (see isDeliverableOn).
 */
function stopWindowFields(current, effectiveFrom) {
  if (current.status === STATUSES.PAUSED) {
    // Deliveries already stopped when the pause took effect; a cancel cannot
    // move that earlier or later.
    return {
      delivery_stops_from: current.delivery_stops_from || current.effective_from || effectiveFrom,
      active_from: current.active_from || null,
    };
  }
  return {
    delivery_stops_from: effectiveFrom,
    active_from: current.effective_from || current.start_date || null,
  };
}

/**
 * The date a resumed subscription delivers from. If the pause has not yet
 * reached any committed delivery (it would only have started on the first
 * still-open date), resuming simply undoes it, so deliveries the customer was
 * already owed — e.g. tomorrow, after a post-cutoff pause — are not lost.
 */
function resumeEffectiveFrom(current, effectiveFrom) {
  const stopsFrom = current.delivery_stops_from;
  if (stopsFrom && stopsFrom >= effectiveFrom) {
    return current.active_from || current.start_date || effectiveFrom;
  }
  return effectiveFrom;
}

module.exports = {
  STATUSES,
  LIVE_STATUSES,
  TRANSITIONS,
  assertTransition,
  isDeliverableOn,
  stopWindowFields,
  resumeEffectiveFrom,
};
