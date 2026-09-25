'use client'

// Unread badge for the Announcements nav item. Counts announcements posted since
// the viewer last opened the Announcements tab (tracked in localStorage).
// Frontend-only: it polls the existing GET /announcements.

import { useCallback, useEffect, useRef, useState } from 'react'
import { dsaApi } from '@/lib/api'

const KEY = 'dsa_announcements_last_seen'

function lastSeen(): number {
  if (typeof window === 'undefined') return 0
  const v = Number(localStorage.getItem(KEY) || 0)
  return Number.isFinite(v) ? v : 0
}

function markSeenNow(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* storage unavailable */
  }
}

/**
 * @param active true while the Announcements tab is on screen — keeps the badge
 *               at zero and advances "last seen".
 * @param token  explicit bearer token (admin/tutor may pass its own).
 */
export function useAnnouncementsUnread(active: boolean, token?: string): number {
  const [unread, setUnread] = useState(0)
  const activeRef = useRef(active)
  activeRef.current = active

  const refresh = useCallback(async () => {
    try {
      const rows = (await dsaApi.announcements.list(
        {},
        token,
      )) as Record<string, unknown>[]
      if (activeRef.current) {
        markSeenNow()
        setUnread(0)
        return
      }
      const seen = lastSeen()
      let n = 0
      for (const r of rows) {
        const t = Date.parse(String(r.createdAt ?? r.timestamp ?? '')) || 0
        if (t > seen) n++
      }
      setUnread(n)
    } catch {
      /* offline / not live — leave the count as-is */
    }
  }, [token])

  useEffect(() => {
    refresh()
    // Every open dashboard tab runs this. During a class that is the whole
    // class at once, so once a minute, and never while the tab is hidden.
    const id = setInterval(() => {
      if (!document.hidden) refresh()
    }, 60000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  // Clear immediately when the Announcements tab becomes active.
  useEffect(() => {
    if (active) {
      markSeenNow()
      setUnread(0)
    }
  }, [active])

  return unread
}
