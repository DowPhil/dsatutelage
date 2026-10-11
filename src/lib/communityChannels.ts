// Community channels — the "General" channel plus one per course category
// (SS1, SS2, SS3, WAEC, JAMB, Post-UTME, 100 Level, 200 Level, Preclinical,
// After-School), the same taxonomy courses use. Admins create and delete
// channels; the backend is the source of truth when live, with a seeded
// browser-local list as the fallback so the switcher works before it ships.

import type { CourseCategory } from './types'
import { COURSE_CATEGORIES, categoryLabel } from './coursesStore'

export interface CommunityChannel {
  id: string
  name: string
  /** The class / exam-track this channel is for (a course category). */
  category?: CourseCategory | null
  /** 'general' = everyone; 'program' = a category; 'custom' = ad-hoc. */
  kind: 'general' | 'program' | 'custom'
  /** System channels (General) can't be deleted. */
  system?: boolean
  /** Departments allowed in (science / art / commercial). Empty = everyone. */
  departments?: string[]
  /** Tutors the admin put in charge of this community by hand (user ids). */
  tutors?: string[]
  /** How many messages in here you haven't read (backend-supplied). */
  unread?: number
  /** How many of those name you (or @everyone). */
  mentions?: number
  /** You asked this channel to stay quiet. */
  muted?: boolean
  /** You were removed from this room; you may rejoin while you qualify. */
  removed?: boolean
  mutedUntil?: number | null
  /** A one-line summary of the last message, for the channel list. */
  lastMessageText?: string | null
  lastMessageSender?: string | null
  lastMessageAt?: number | null
}

export const GENERAL_CHANNEL: CommunityChannel = {
  id: 'general',
  name: 'General',
  kind: 'general',
  system: true,
}

/** Stable channel id for a category, e.g. "ss1". */
export function programChannelId(category: CourseCategory): string {
  return category
}

/** The default set of channels: General + one per course category. */
export function defaultChannels(): CommunityChannel[] {
  return [
    GENERAL_CHANNEL,
    ...COURSE_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.label,
      category: c.id,
      kind: 'program' as const,
      system: true,
    })),
  ]
}

/** Normalise a backend/store row into a CommunityChannel. Tolerates the older
 *  `track` field (which now carries the category value). */
export function toChannel(raw: Record<string, unknown>): CommunityChannel {
  const category = raw.category
    ? (String(raw.category) as CourseCategory)
    : raw.track
      ? (String(raw.track) as CourseCategory)
      : null
  const kind =
    raw.kind === 'general' || raw.id === 'general'
      ? 'general'
      : raw.kind === 'custom'
        ? 'custom'
        : category
          ? 'program'
          : 'custom'
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: String(raw.name ?? 'Channel'),
    category,
    kind,
    system: !!raw.system || raw.id === 'general',
    departments: Array.isArray(raw.departments)
      ? (raw.departments as unknown[]).map(String)
      : raw.department
        ? [String(raw.department)]
        : [],
    tutors: Array.isArray(raw.tutors) ? (raw.tutors as unknown[]).map(String) : [],
    unread: typeof raw.unread === 'number' ? raw.unread : 0,
    mentions: typeof raw.mentions === 'number' ? raw.mentions : 0,
    muted: !!raw.muted,
    removed: !!raw.removed,
    mutedUntil: raw.mutedUntil ? Date.parse(String(raw.mutedUntil)) || null : null,
    lastMessageText: raw.lastMessageText ? String(raw.lastMessageText) : null,
    lastMessageSender: raw.lastMessageSender
      ? String(raw.lastMessageSender)
      : null,
    lastMessageAt: raw.lastMessageAt
      ? Date.parse(String(raw.lastMessageAt)) || null
      : null,
  }
}

/**
 * Which channels a viewer may see: the General channel, any custom (categoryless)
 * channel, plus the category channels matching `categories`. Students pass their
 * own categories; tutors pass the categories of the courses they teach. An empty
 * set means the caller couldn't resolve categories — it should fail open (show
 * all) rather than hide everything.
 */
export function channelsForCategories(
  channels: CommunityChannel[],
  categories: string[],
): CommunityChannel[] {
  const allowed = new Set(categories.map(String))
  return channels.filter((c) => {
    if (c.kind === 'general') return true
    if (!c.category) return true // custom channel with no category → visible to all
    return allowed.has(String(c.category))
  })
}

// ---- Browser-local fallback store (seeded with the defaults) ----
const KEY = 'dsa_community_channels'

function read(): CommunityChannel[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : null
  } catch {
    return null
  }
}

function write(list: CommunityChannel[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(list))
}

/** The local channel list, seeding the defaults on first use. */
export function getLocalChannels(): CommunityChannel[] {
  const stored = read()
  if (stored && stored.length) return stored
  const seeded = defaultChannels()
  write(seeded)
  return seeded
}

export function addLocalChannel(input: {
  name: string
  category?: CourseCategory | null
}): CommunityChannel {
  const list = getLocalChannels()
  const base = input.category
    ? programChannelId(input.category)
    : `custom-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  let id = base
  let n = 2
  while (list.some((c) => c.id === id)) id = `${base}-${n++}`
  const channel: CommunityChannel = {
    id,
    name: input.name.trim() || (input.category ? categoryLabel(input.category) : 'Channel'),
    category: input.category ?? null,
    kind: input.category ? 'program' : 'custom',
  }
  write([...list, channel])
  return channel
}

export function removeLocalChannel(id: string): void {
  if (id === 'general') return // never delete General
  write(getLocalChannels().filter((c) => c.id !== id))
}
