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
 * Consolidates the three conditions that were previously checked
 * inconsistently across the nightly job, the manifest preview and the cart
 * view: the status must be active, the subscription must have started, and a
 * pause/resume must not take effect after the date in question.
 */
function isDeliverableOn(subscription, date) {
  if (!subscription || subscription.status !== STATUSES.ACTIVE) return false;
  if (subscription.start_date && subscription.start_date > date) return false;
  if (subscription.effective_from && subscription.effective_from > date) return false;
  return true;
}

module.exports = {
  STATUSES,
  LIVE_STATUSES,
  TRANSITIONS,
  assertTransition,
  isDeliverableOn,
};
