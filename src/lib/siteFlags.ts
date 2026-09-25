// Switches an admin flips by editing this file and pushing — no dashboard,
// no env change, one line.

/**
 * While true, /auth/signup shows a "registration is paused" notice instead of
 * the form. Set on 2026-09-22 while the OTP email problem is fixed and the
 * stuck pending accounts are cleared, so no new student registers into the
 * same trap. Flip to false and push to reopen.
 */
export const REGISTRATION_PAUSED = true

/** Shown on the paused page. Keep it to one short sentence. */
export const REGISTRATION_PAUSED_NOTE =
  'We are upgrading our sign-up system. Registration reopens shortly — check back soon or follow our WhatsApp announcements.'
