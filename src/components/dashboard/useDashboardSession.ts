'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dsaApi } from '@/lib/api'
import {
  getToken,
  getUser,
  getRole,
  clearSession,
  dashboardPathForRole,
} from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { useSecureSession } from '@/components/dashboard/useSecureSession'
import type { User, UserRole } from '@/lib/types'

interface SessionState {
  user: User | null
  loading: boolean
  logout: () => void
}

/**
 * Guard a role-specific dashboard. Redirects to sign-in when unauthenticated,
 * and to the caller's *own* dashboard when their role doesn't match
 * `requiredRole` (so a student can't sit on the tutor page, etc.).
 *
 * Demo sessions read their profile from local storage; real sessions call
 * /auth/me.
 */
export function useDashboardSession(requiredRole: UserRole): SessionState {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = () => {
    clearSession()
    router.push('/auth/signin')
  }

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const token = getToken()
      if (!token) {
        router.push('/auth/signin')
        return
      }

      // Role gate first — cheap and avoids a needless API call.
      const role = getRole()
      if (role && role !== requiredRole) {
        router.replace(dashboardPathForRole(role))
        return
      }

      try {
        const profile = isDemoToken(token)
          ? getUser()
          : await dsaApi.auth.getProfile(token)

        if (cancelled) return
        if (!profile) {
          logout()
          return
        }
        setUser(profile)
      } catch {
        if (!cancelled) logout()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredRole, router])

  // A staff member's permissions come from their role, and an admin can change
  // the role while they are signed in. Re-read the profile once a minute and
  // whenever the tab comes back into focus, so a newly granted screen appears
  // without signing out and in. Only real sessions have anything to re-read.
  useEffect(() => {
    const token = getToken()
    if (!token || isDemoToken(token)) return
    let stale = false
    const refresh = async () => {
      try {
        const profile = await dsaApi.auth.getProfile(token)
        if (stale || !profile) return
        setUser((prev) =>
          JSON.stringify(prev) === JSON.stringify(profile) ? prev : profile,
        )
      } catch {
        /* a blip; the next check will catch up */
      }
    }
    const id = setInterval(() => {
      if (!document.hidden) refresh()
    }, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      stale = true
      clearInterval(id)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  // Auto-logout after 30 minutes of inactivity (applies to every dashboard that
  // uses this hook — tutor, guardian, staff).
  useSecureSession({ onIdleTimeout: logout, idleMinutes: 30 })

  return { user, loading, logout }
}
