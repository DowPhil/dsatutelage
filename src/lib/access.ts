// Access / entitlements — the 3-level model (see docs/payment-plan.md).
//
//   free     — account created, no payment
//   portal   — paid the ₦2,000 portal-access fee
//   tutorial — active tutorial student (paid tutorial fee, until expiry)
//
// `PAYWALL_ENABLED` is ON by default: free accounts see locked features until
// they pay to unlock a track/tier (from the dashboard's Unlock plans). Set
// NEXT_PUBLIC_PAYWALL_ENABLED=false to reopen the whole portal (e.g. for a beta).

import type { User } from './types'

export type AccessLevel = 'free' | 'portal' | 'tutorial'
export type GatedFeature =
  | 'community'
  | 'assignments'
  | 'liveClasses'
  | 'tests'
  | 'materials'

/**
 * Master paywall switch. ON by default so free accounts are gated until they
 * pay to unlock. Set NEXT_PUBLIC_PAYWALL_ENABLED=false to open the whole portal.
 */
export const PAYWALL_ENABLED =
  process.env.NEXT_PUBLIC_PAYWALL_ENABLED !== 'false'

/** Admin-editable caps for how much L1/L2 can access (L3 is unlimited). */
export interface AccessCaps {
  freeTests: number
  freeMaterials: number
  freeLiveClasses: number
  portalTests: number
  portalMaterials: number
  portalLiveClasses: number
}

export const DEFAULT_CAPS: AccessCaps = {
  freeTests: 3,
  freeMaterials: 5,
  freeLiveClasses: 5,
  portalTests: 10,
  portalMaterials: 20,
  portalLiveClasses: 10,
}

/** Resolve the effective level, honouring tutorial expiry (revert to Free). */
export function accessLevel(user?: Partial<User> | null): AccessLevel {
  if (!user) return 'free'
  if (user.accessEnabled === false) return 'free' // admin disabled → treat as free
  // Same as the server (computeEffectiveAccessLevel): a disabled payment
  // status gives no paid access, whatever level is stored.
  if (user.paymentStatus === 'disabled') return 'free'
  const lvl = user.accessLevel
  if (lvl === 'tutorial') {
    if (user.tutorialExpiry && new Date(user.tutorialExpiry).getTime() < Date.now())
      return 'free' // expired → revert to Free (L1)
    return 'tutorial'
  }
  if (lvl === 'portal') return 'portal'
  return 'free'
}

const LEVEL_RANK: Record<AccessLevel, number> = {
  free: 0,
  portal: 1,
  tutorial: 2,
}

/**
 * Whether a feature is available. Community is open to ALL students (free + paid)
 * — it's used for live classes. Assignments need L3. Count-limited features
 * (tests/materials/live classes) are "available" here — their per-level caps are
 * checked with `capFor`. Always true while the paywall is off.
 */
export function canAccess(
  feature: GatedFeature,
  user?: Partial<User> | null,
): boolean {
  // Community stays open regardless of the paywall — an admin toggle to restrict
  // it to paid users can gate this later.
  if (feature === 'community') return true
  if (!PAYWALL_ENABLED) return true
  const rank = LEVEL_RANK[accessLevel(user)]
  switch (feature) {
    case 'assignments':
      return rank >= LEVEL_RANK.tutorial
    default:
      return true // count-limited via capFor
  }
}

/** The cap for a count-limited feature at the user's level (Infinity = unlimited). */
export function capFor(
  feature: 'tests' | 'materials' | 'liveClasses',
  user?: Partial<User> | null,
  caps: AccessCaps = DEFAULT_CAPS,
): number {
  if (!PAYWALL_ENABLED) return Infinity
  const lvl = accessLevel(user)
  if (lvl === 'tutorial') return Infinity
  if (lvl === 'portal')
    return feature === 'tests'
      ? caps.portalTests
      : feature === 'materials'
        ? caps.portalMaterials
        : caps.portalLiveClasses
  return feature === 'tests'
    ? caps.freeTests
    : feature === 'materials'
      ? caps.freeMaterials
      : caps.freeLiveClasses
}

export const LEVEL_LABEL: Record<AccessLevel, string> = {
  free: 'Free',
  portal: 'Portal Access',
  tutorial: 'Tutorial Student',
}
