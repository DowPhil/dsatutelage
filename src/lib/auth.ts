// Centralized client-side auth/session helpers.
//
// IMPORTANT: this is UX-level gating only. It decides what the browser shows.
// Real security MUST be enforced by the backend on every request via the JWT.
// Never trust `getRole()` / `isAdmin()` for anything that protects data.

import type { User, UserRole } from './types'

const TOKEN_KEY = 'dsa_token'
const USER_KEY = 'dsa_user'
const ROLE_KEY = 'user_role'
const REMEMBER_EMAIL_KEY = 'dsa_remembered_email'
const ADMIN_COOKIE = 'admin_token'

/**
 * How long a session cookie survives, in seconds. Seven days so staff aren't
 * bounced back to the login screen mid-session (the old 1-hour value meant
 * re-logging in several times a day).
 *
 * NOTE: this only controls how long the browser keeps the cookie. Real expiry
 * must be enforced by the backend on the JWT — see the warning at the top.
 */
const SESSION_MAX_AGE = 60 * 60 * 24 * 7

const isBrowser = () => typeof window !== 'undefined'

export function getToken(): string | null {
  if (!isBrowser()) return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getRole(): UserRole | null {
  if (!isBrowser()) return null
  return (localStorage.getItem(ROLE_KEY) as UserRole) || null
}

export function getUser(): User | null {
  if (!isBrowser()) return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

/** Fired on `window` whenever the cached user changes. */
export const USER_UPDATED_EVENT = 'dsa:user-updated'

/**
 * Update the cached user (e.g. after editing the profile in Settings or after
 * a fresh GET /auth/me), so the rest of the app reflects the new name/avatar —
 * and a newly paid plan — without a re-login. Listeners are told only when
 * something actually changed.
 */
export function setUser(user: User): void {
  if (!isBrowser()) return
  const raw = JSON.stringify(user)
  if (localStorage.getItem(USER_KEY) === raw) return
  localStorage.setItem(USER_KEY, raw)
  window.dispatchEvent(new Event(USER_UPDATED_EVENT))
}

/**
 * The cached user as stored (a string, so it compares by value). Paired with
 * `subscribeUser` for React's useSyncExternalStore.
 */
export function getUserSnapshot(): string | null {
  if (!isBrowser()) return null
  return localStorage.getItem(USER_KEY)
}

/** Call `onChange` whenever the cached user changes (this tab or another). */
export function subscribeUser(onChange: () => void): () => void {
  if (!isBrowser()) return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === USER_KEY) onChange()
  }
  window.addEventListener(USER_UPDATED_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(USER_UPDATED_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function isAdmin(): boolean {
  const role = getRole()
  return role === 'admin' || role === 'super_admin'
}

/**
 * Where a user lands after login, based on their role. Central so the sign-in
 * page and any guard redirect stay in sync.
 */
export function dashboardPathForRole(role?: UserRole | null): string {
  switch (role) {
    case 'tutor':
      return '/tutor'
    case 'parent':
      return '/guardian'
    case 'staff':
      return '/staff'
    case 'admin':
    case 'super_admin':
      return '/admin'
    default:
      return '/dashboard'
  }
}

/** Persist a successful login. Also sets the cookie the middleware reads. */
export function setSession(params: {
  token: string
  user?: User | null
  role?: UserRole
}): void {
  if (!isBrowser()) return
  const { token, user, role } = params
  localStorage.setItem(TOKEN_KEY, token)
  // Mirror the JWT to the generic `token` key that admin-api.ts (adminFetch /
  // getAdminSession) reads. Without this, shared components backed by adminApi
  // — e.g. TakeAttendance — send no Authorization header for tutors/staff who
  // signed in through the normal flow, and the backend returns 401.
  localStorage.setItem('token', token)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  const resolvedRole = role || user?.role || 'student'
  localStorage.setItem(ROLE_KEY, resolvedRole)
  // Cookie is what middleware.ts checks for route protection. It carries the
  // role too — a student session must not read as an admin one. Secure so it
  // never travels over plain HTTP.
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${ADMIN_COOKIE}=true; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax${secure}`
  document.cookie = `admin_role=${encodeURIComponent(resolvedRole)}; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax${secure}`
}

/** Clear all session state (logout, or an invalid/expired token). */
export function clearSession(): void {
  if (!isBrowser()) return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('token') // the adminApi mirror set in setSession
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(ROLE_KEY)
  // Also clear any admin session keys/cookies so switching roles is clean and
  // no stale session bounces the user to /adminLogin.
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')
  localStorage.removeItem('admin_role')
  document.cookie = `${ADMIN_COOKIE}=; path=/; max-age=0; SameSite=Lax`
  document.cookie = `admin_role=; path=/; max-age=0; SameSite=Lax`
}

export function rememberEmail(email: string, remember: boolean): void {
  if (!isBrowser()) return
  if (remember) localStorage.setItem(REMEMBER_EMAIL_KEY, email)
  else localStorage.removeItem(REMEMBER_EMAIL_KEY)
}

export function getRememberedEmail(): string | null {
  if (!isBrowser()) return null
  return localStorage.getItem(REMEMBER_EMAIL_KEY)
}

// The hardcoded admin bypass that used to live here has been removed. Admin
// access is a real login against /api/auth/login; the backend decides who is an
// admin (routes/adminRoutes.js applies authorize('admin')), and no credential
// in this bundle can stand in for that.
