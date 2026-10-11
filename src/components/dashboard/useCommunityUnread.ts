'use client'

// Unread badge for the Community nav item, shown before the Community is
// opened. Counts come from the shared store in lib/communityUnread: the server
// summary, kept current by the socket (one summary a minute without it).
// Opening the Community does not clear the badge — reading a room does.

import { useEffect, useSyncExternalStore } from 'react'
import { getToken } from '@/lib/auth'
import { communityUnread } from '@/lib/communityUnread'

/**
 * Keep live unread counting running while the component is mounted.
 * `enabled` = false waits (e.g. until the admin token has been read).
 */
export function useCommunityUnreadFeed(token?: string, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const t = token || getToken() || ''
    if (!t) return
    communityUnread.start(t)
    return () => communityUnread.stop()
  }, [token, enabled])
}

/** Re-render whenever any count changes. */
export function useCommunityUnreadVersion(): number {
  return useSyncExternalStore(
    communityUnread.subscribe,
    communityUnread.getVersion,
    () => 0,
  )
}

/**
 * @param _active  kept for callers; the badge no longer hides while the
 *                 Community is open — it drops as rooms are read.
 * @param token    explicit bearer token (admin passes its admin token).
 */
export function useCommunityUnread(
  _active: boolean,
  token?: string,
  enabled = true,
): number {
  useCommunityUnreadFeed(token, enabled)
  useCommunityUnreadVersion()
  return communityUnread.total()
}
