// Unread badges for the Community, WhatsApp-style: a count on the nav item and
// on each room before anyone opens it.
//
// The server is the source of truth — GET /community/channels/summary counts,
// per room, messages from other people this person has not read (read state
// lives on the message, so it survives refreshes, logouts and other devices).
// Between summaries the socket says "something new in room X"
// (`channel:activity`), and the count moves locally:
//
//  • each message counts once, however many times it is announced;
//  • your own messages never count;
//  • the room you are looking at does not count (the chat marks it read);
//  • a fresh summary replaces the counts, then re-adds only live messages
//    newer than what the server had seen (its `lastMessageAt`), so a message
//    is never counted by both;
//  • reading a room anywhere (`channel:read`) clears it everywhere;
//  • a deleted message comes off if it was counted here, otherwise that room
//    is re-checked with the server;
//  • rooms changing (`channels:changed`) and reconnecting re-sync everything.
//
// Without a socket it falls back to one summary a minute while the tab is
// visible.

import { dsaApi } from './api'
import { acquireRealtime, releaseRealtime } from './realtime'
import type { Socket } from 'socket.io-client'
import { UnreadTracker, type ActivityEvent } from './communityUnreadTracker'

export { UnreadTracker }
export type { ActivityEvent, RoomUnread } from './communityUnreadTracker'

// ---------------------------------------------------------------------------
// The shared store: one per browser tab, fed by the API and the socket.
// ---------------------------------------------------------------------------

const FALLBACK_POLL_MS = 60000
/** Focus / visibility re-syncs no more often than this. */
const MIN_RESYNC_MS = 15000

/** The user id inside a JWT (its `id` claim), to recognise our own messages. */
export function userIdFromToken(token: string): string | null {
  try {
    const part = token.replace(/^Bearer\s+/i, '').split('.')[1]
    if (!part) return null
    const json = JSON.parse(
      atob(part.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { id?: unknown; _id?: unknown; sub?: unknown }
    const id = json.id ?? json._id ?? json.sub
    return id ? String(id) : null
  } catch {
    return null
  }
}

type Listener = () => void

class UnreadStore {
  private tracker = new UnreadTracker()
  private listeners = new Set<Listener>()
  private token = ''
  private holders = 0
  private socket: Socket | null = null
  private poll: ReturnType<typeof setInterval> | null = null
  private inflight: Promise<void> | null = null
  private lastSync = 0
  private recheck = new Set<string>()
  private recheckTimer: ReturnType<typeof setTimeout> | null = null
  /** Bumped on every change, so React re-renders (useSyncExternalStore). */
  version = 0

  subscribe = (fn: Listener) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getVersion = () => this.version

  private emit() {
    this.version += 1
    this.listeners.forEach((fn) => fn())
  }

  get(channelId: string) {
    return this.tracker.get(channelId)
  }

  total() {
    return this.tracker.total()
  }

  /** Re-read the room list and every count from the server (deduplicated). */
  sync = (force = false): Promise<void> => {
    if (!this.token) return Promise.resolve()
    if (this.inflight) return this.inflight
    if (!force && Date.now() - this.lastSync < MIN_RESYNC_MS) {
      return Promise.resolve()
    }
    const token = this.token
    this.inflight = (async () => {
      try {
        const [rows, summary] = await Promise.all([
          dsaApi.community.channels(token),
          dsaApi.community.summary(token),
        ])
        if (token !== this.token) return
        const list = rows as Record<string, unknown>[]
        this.tracker.setRooms(
          list.map((r) => String(r.id ?? r.channelId ?? '')).filter(Boolean),
          list.filter((r) => r.muted).map((r) => String(r.id ?? r.channelId)),
        )
        this.tracker.applySummary(summary)
        this.lastSync = Date.now()
        this.emit()
      } catch {
        /* offline / not allowed — keep the last known counts */
      } finally {
        this.inflight = null
      }
    })()
    return this.inflight
  }

  /** Ask the server about just these rooms, batched. */
  private scheduleRecheck(channelId: string) {
    this.recheck.add(channelId)
    if (this.recheckTimer) return
    this.recheckTimer = setTimeout(async () => {
      this.recheckTimer = null
      const ids = [...this.recheck]
      this.recheck.clear()
      const token = this.token
      try {
        const data = await dsaApi.community.summary(token, ids)
        if (token !== this.token) return
        this.tracker.applySummary(data, ids)
        this.emit()
      } catch {
        /* the next full sync will settle it */
      }
    }, 1500)
  }

  private onActivity = (e: ActivityEvent) => {
    const again = this.tracker.applyActivity(e)
    if (again) this.scheduleRecheck(again)
    this.emit()
  }

  private onRead = (p: { channelId?: string }) => {
    if (!p?.channelId) return
    this.tracker.markRead(p.channelId)
    this.emit()
  }

  private onChannelsChanged = () => {
    this.socket?.emit('watch', () => {})
    void this.sync(true)
  }

  // Reconnected: whatever was missed while the line was down.
  private onConnect = () => {
    void this.sync(true)
  }

  private onFocus = () => {
    if (!document.hidden) void this.sync()
  }

  /** Start (or join) live counting for this token. Pair with `stop`. */
  start(token: string) {
    if (typeof window === 'undefined' || !token) return
    if (this.holders > 0 && token !== this.token) this.teardown()
    this.holders += 1
    if (this.holders > 1) return
    this.token = token
    this.tracker = new UnreadTracker(userIdFromToken(token))
    const s = acquireRealtime(token)
    this.socket = s
    if (s) {
      s.on('connect', this.onConnect)
      s.on('channel:activity', this.onActivity)
      s.on('channel:read', this.onRead)
      s.on('channels:changed', this.onChannelsChanged)
    }
    this.poll = setInterval(() => {
      if (document.hidden) return
      if (this.socket?.connected) return
      void this.sync(true)
    }, FALLBACK_POLL_MS)
    window.addEventListener('focus', this.onFocus)
    document.addEventListener('visibilitychange', this.onFocus)
    void this.sync(true)
  }

  stop() {
    this.holders = Math.max(0, this.holders - 1)
    if (this.holders === 0) this.teardown()
  }

  private teardown() {
    const s = this.socket
    if (s) {
      s.off('connect', this.onConnect)
      s.off('channel:activity', this.onActivity)
      s.off('channel:read', this.onRead)
      s.off('channels:changed', this.onChannelsChanged)
      releaseRealtime()
    }
    this.socket = null
    if (this.poll) clearInterval(this.poll)
    this.poll = null
    if (this.recheckTimer) clearTimeout(this.recheckTimer)
    this.recheckTimer = null
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onFocus)
      document.removeEventListener('visibilitychange', this.onFocus)
    }
    this.holders = 0
    this.token = ''
    this.lastSync = 0
  }

  /** The chat says which room is on screen (null when none is). */
  setViewing(channelId: string | null) {
    this.tracker.setViewing(channelId)
    this.emit()
  }

  /** The chat marked a room read. */
  markRead(channelId: string) {
    this.tracker.markRead(channelId)
    this.emit()
  }

  /** The chat muted / unmuted a room. */
  setMuted(channelId: string, muted: boolean) {
    if (muted) this.tracker.muted.add(channelId)
    else this.tracker.muted.delete(channelId)
    this.emit()
  }
}

export const communityUnread = new UnreadStore()
