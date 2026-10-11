// The counting rules behind the Community unread badges, with no network in
// sight: lib/communityUnread feeds this from the API and the socket, and the
// tests drive it directly. See lib/communityUnread for the overall design.

export interface RoomUnread {
  unread: number
  mentions: number
  lastMessageAt: number | null
  lastMessageText: string | null
  lastMessageSender: string | null
}

export interface ActivityEvent {
  kind: 'new' | 'delete'
  channelId: string
  messageId: string
  senderId?: string
  createdAt?: string | number
  mentionsEveryone?: boolean
  mentions?: string[]
}

const EMPTY: RoomUnread = {
  unread: 0,
  mentions: 0,
  lastMessageAt: null,
  lastMessageText: null,
  lastMessageSender: null,
}

const toMs = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Date.parse(String(v))
  return Number.isFinite(n) ? n : null
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Remember at most this many announced message ids (for de-duplication). */
const SEEN_LIMIT = 2000

/**
 * The counting rules, with no network in sight — the store below feeds it
 * from the API and the socket, and the tests drive it directly.
 */
export class UnreadTracker {
  rooms = new Map<string, RoomUnread>()
  /** Rooms this person may open (from the room list). null = not known yet. */
  visible: Set<string> | null = null
  muted = new Set<string>()
  /** The room on screen right now, if any. */
  viewing: string | null = null
  /** Messages counted from the socket since the last summary of their room. */
  private live = new Map<string, { channelId: string; at: number; mention: boolean }>()
  /** Every message id already announced, so a repeat is ignored. */
  private seen = new Set<string>()

  meId: string | null

  constructor(meId: string | null = null) {
    this.meId = meId
  }

  private room(id: string): RoomUnread {
    return this.rooms.get(id) ?? { ...EMPTY }
  }

  private remember(messageId: string) {
    this.seen.add(messageId)
    if (this.seen.size > SEEN_LIMIT) {
      const first = this.seen.values().next().value
      if (first !== undefined) this.seen.delete(first)
    }
  }

  /** The room list: which rooms exist for this person, and which are muted. */
  setRooms(ids: string[], muted: string[] = []) {
    this.visible = new Set(ids)
    this.muted = new Set(muted)
    for (const id of [...this.rooms.keys()]) {
      if (!this.visible.has(id)) this.rooms.delete(id)
    }
    for (const [mid, l] of [...this.live]) {
      if (!this.visible.has(l.channelId)) this.live.delete(mid)
    }
  }

  /**
   * A summary from the server. `only` = the rooms it covers (a partial
   * re-check); otherwise it covers every room and rooms missing from it have
   * no messages.
   */
  applySummary(data: Record<string, Record<string, unknown>>, only?: string[]) {
    const covered = only ?? [
      ...new Set([...(this.visible ?? []), ...Object.keys(data)]),
    ]
    for (const id of covered) {
      if (this.visible && !this.visible.has(id)) continue
      const raw = data[id]
      const next: RoomUnread = raw
        ? {
            unread: num(raw.unread),
            mentions: num(raw.mentions),
            lastMessageAt: toMs(raw.lastMessageAt),
            lastMessageText: raw.lastMessageText ? String(raw.lastMessageText) : null,
            lastMessageSender: raw.lastMessageSender
              ? String(raw.lastMessageSender)
              : null,
          }
        : { ...EMPTY }
      // Live messages the server had not seen yet still count; the rest are
      // in its figure already (or were read), so stop tracking them.
      for (const [mid, l] of [...this.live]) {
        if (l.channelId !== id) continue
        if (next.lastMessageAt != null && l.at <= next.lastMessageAt) {
          this.live.delete(mid)
        } else {
          next.unread += 1
          if (l.mention) next.mentions += 1
        }
      }
      if (id === this.viewing) {
        next.unread = 0
        next.mentions = 0
      }
      this.rooms.set(id, next)
    }
  }

  /**
   * Something happened in a room. Returns the room id when the server should
   * be asked again (a delete this tab cannot account for), else null.
   */
  applyActivity(e: ActivityEvent): string | null {
    const channelId = String(e.channelId || 'general').toLowerCase()
    const messageId = String(e.messageId || '')
    if (!messageId) return null
    if (this.visible && !this.visible.has(channelId)) return null

    if (e.kind === 'delete') {
      const counted = this.live.get(messageId)
      if (counted) {
        this.live.delete(messageId)
        const r = this.room(channelId)
        this.rooms.set(channelId, {
          ...r,
          unread: Math.max(0, r.unread - 1),
          mentions: counted.mention ? Math.max(0, r.mentions - 1) : r.mentions,
        })
        return null
      }
      // Our own message, or one already read, cannot move the count.
      if (this.meId && e.senderId === this.meId) return null
      return channelId
    }

    if (this.seen.has(messageId)) return null
    this.remember(messageId)
    const at = toMs(e.createdAt) ?? Date.now()
    const r = this.room(channelId)
    const lastMessageAt = Math.max(r.lastMessageAt ?? 0, at)

    if ((this.meId && e.senderId === this.meId) || channelId === this.viewing) {
      this.rooms.set(channelId, { ...r, lastMessageAt })
      return null
    }
    const mention =
      !!e.mentionsEveryone ||
      (!!this.meId && (e.mentions ?? []).map(String).includes(this.meId))
    this.live.set(messageId, { channelId, at, mention })
    this.rooms.set(channelId, {
      ...r,
      unread: r.unread + 1,
      mentions: r.mentions + (mention ? 1 : 0),
      lastMessageAt,
    })
    return null
  }

  /** Everything in the room has been read (here or on another device). */
  markRead(channelId: string) {
    const id = String(channelId).toLowerCase()
    for (const [mid, l] of [...this.live]) {
      if (l.channelId === id) this.live.delete(mid)
    }
    const r = this.rooms.get(id)
    if (r) this.rooms.set(id, { ...r, unread: 0, mentions: 0 })
  }

  setViewing(channelId: string | null) {
    this.viewing = channelId ? String(channelId).toLowerCase() : null
    if (this.viewing) this.markRead(this.viewing)
  }

  get(channelId: string): RoomUnread {
    return this.room(String(channelId).toLowerCase())
  }

  /** The nav badge: every unread message outside muted rooms. */
  total(): number {
    let n = 0
    for (const [id, r] of this.rooms) {
      if (this.visible && !this.visible.has(id)) continue
      if (!this.muted.has(id)) n += r.unread
    }
    return n
  }
}
