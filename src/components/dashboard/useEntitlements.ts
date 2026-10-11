'use client'

// The signed-in student's plan and this month's allowances, from the server
// (GET /entitlements/me). One request is shared by every component on the
// page; `refresh()` re-reads it after something used an allowance. The server
// enforces every limit — this only shows them.

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { dsaApi, type MyEntitlements } from '@/lib/api'
import { getToken } from '@/lib/auth'

let current: MyEntitlements | null = null
let inflight: Promise<void> | null = null
let version = 0
const listeners = new Set<() => void>()

const emit = () => {
  version += 1
  listeners.forEach((fn) => fn())
}

/** Re-read from the server (requests at the same moment share one). */
export function refreshEntitlements(): Promise<void> {
  if (inflight) return inflight
  const token = getToken() ?? undefined
  if (!token) return Promise.resolve()
  inflight = dsaApi.entitlements
    .me(token)
    .then((data) => {
      current = data
      emit()
    })
    .catch(() => {
      /* keep what we had; the server still enforces */
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Update from a response that already carries the new figure. */
export function patchEntitlements(fn: (e: MyEntitlements) => MyEntitlements): void {
  if (!current) return
  current = fn(current)
  emit()
}

export function useEntitlements(): {
  entitlements: MyEntitlements | null
  refresh: () => Promise<void>
} {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => version,
    () => 0,
  )
  useEffect(() => {
    if (!current) void refreshEntitlements()
  }, [])
  const refresh = useCallback(() => refreshEntitlements(), [])
  return { entitlements: current, refresh }
}

/** "1 November" — when an allowance resets, in the academy's timezone. */
export function resetDate(iso: string | undefined, timeZone = 'Africa/Lagos'): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone })
}
