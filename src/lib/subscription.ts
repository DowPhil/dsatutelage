// What a student's dashboard says about their plan. The source is the
// `subscription` block on GET /auth/me (worked out by the server from the same
// fields it authorises with); the dashboard keeps it fresh through the cached
// profile (see useCachedUser / useProfileRefresh). An uploaded receipt is
// "pending", never "active", and an end date that has passed reads as expired
// even before the next refresh.

import type { StudentSubscription, User } from './types'

export type PlanStatus = StudentSubscription['status']

export interface PlanSummary {
  status: PlanStatus
  /** Short, e.g. "JAMB Gold", "Free plan", "Pending approval". */
  title: string
  /** One line of detail, e.g. "Active until 12 Nov 2026". */
  detail: string
  /** Offer the existing Upgrade Plan action. */
  showUpgrade: boolean
}

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  })

/**
 * The subscription to show: the server's, or — for a profile cached at login,
 * before the first /auth/me refresh — the same rules applied to the access
 * fields (without a plan name).
 */
function subscriptionOf(user: Partial<User>): StudentSubscription {
  if (user.subscription) return user.subscription
  const level = user.accessLevel || 'free'
  const expiresAt = level === 'tutorial' && user.tutorialExpiry ? user.tutorialExpiry : null
  let status: PlanStatus = 'free'
  if (user.accessEnabled === false || user.paymentStatus === 'disabled') status = 'disabled'
  else if (user.paymentStatus === 'pending-offline') status = 'pending'
  else if (level === 'tutorial' && expiresAt && new Date(expiresAt).getTime() <= Date.now()) status = 'expired'
  else if (level === 'tutorial' || level === 'portal') status = 'active'
  return {
    status,
    label: status,
    effectiveLevel: status === 'free' || status === 'expired' || status === 'disabled' ? 'free' : level,
    planName: level === 'portal' ? 'Portal access' : level === 'tutorial' ? 'Tutorial plan' : 'Free',
    expiresAt,
    noExpiry: (level === 'portal' || level === 'tutorial') && !expiresAt,
  }
}

export function planSummary(
  user?: Partial<User> | null,
  now: Date = new Date(),
): PlanSummary {
  if (!user) {
    return { status: 'free', title: 'Free plan', detail: 'Upgrade to unlock more of the portal.', showUpgrade: true }
  }
  const sub = subscriptionOf(user)
  let status = sub.status
  // The server said active, but the end date has passed since it said so.
  if (status === 'active' && sub.expiresAt && new Date(sub.expiresAt).getTime() <= now.getTime()) {
    status = 'expired'
  }

  switch (status) {
    case 'active':
      return {
        status,
        title: sub.planName,
        detail: sub.expiresAt
          ? `Active until ${formatDate(sub.expiresAt)}`
          : 'Active · no expiry',
        showUpgrade: false,
      }
    case 'pending':
      return {
        status,
        title: 'Pending approval',
        detail: `${sub.pendingPlanName || 'Your plan'} is waiting for your payment to be confirmed.`,
        showUpgrade: false,
      }
    case 'expired':
      return {
        status,
        title: `${sub.planName} — expired`,
        detail: sub.expiresAt
          ? `Ended ${formatDate(sub.expiresAt)}. You are on the Free plan.`
          : 'You are on the Free plan.',
        showUpgrade: true,
      }
    case 'disabled':
      return {
        status,
        title: 'Access disabled',
        detail: 'Your access has been switched off. Contact the helpline.',
        showUpgrade: false,
      }
    default:
      return {
        status: 'free',
        title: 'Free plan',
        detail: 'Upgrade to unlock more of the portal.',
        showUpgrade: true,
      }
  }
}
