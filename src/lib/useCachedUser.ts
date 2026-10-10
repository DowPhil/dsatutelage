'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { getUserSnapshot, subscribeUser } from './auth'
import type { User } from './types'

/**
 * The cached user, re-rendering whenever it changes — e.g. when the dashboard
 * re-reads /auth/me after an admin confirms a payment. Use this (not a bare
 * `getUser()` in render) for anything gated on the student's access level.
 */
export function useCachedUser(): User | null {
  const raw = useSyncExternalStore(subscribeUser, getUserSnapshot, () => null)
  return useMemo(() => {
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  }, [raw])
}
