'use client'

// Community — chat pods for tutors and students, laid out like Telegram:
// the list of pods on the left, the open conversation in the middle, and (for
// admins) a management pane on the right. On a phone the list and the
// conversation take turns.
//
//  • Tutors  : text, photo, video, document (pdf/doc) and voice notes.
//  • Students: text, photo, video and document (pdf/doc) — no voice notes.
//  • Admin   : read-only moderation — sees every message and can delete any.
//
// Files upload straight to Cloudinary from the browser (see lib/cloudinary.ts);
// only the hosted URL is sent to the API. Messages sync by polling the channel.
// Role rules are also enforced server-side — this component only shapes the UI.

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Send,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Mic,
  Trash2,
  Loader2,
  Plus,
  Download,
  AlertCircle,
  Lock,
  Unlock,
  Pin,
  Pencil,
  Check,
  X,
  Hash,
  Users,
  UserMinus,
  BarChart3,
  Bell,
  BellOff,
  Reply,
  SmilePlus,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowLeft,
  MoreHorizontal,
  Megaphone,
  SlidersHorizontal,
  CheckCheck,
} from 'lucide-react'
import { dsaApi } from '@/lib/api'
import { getToken, getUser } from '@/lib/auth'
import {
  acquireRealtime,
  releaseRealtime,
  type JoinAck,
  type PresenceEvent,
  type TypingEvent,
} from '@/lib/realtime'
import type { Socket } from 'socket.io-client'
import { uploadToCloudinary } from '@/lib/cloudinary'
import {
  type CommunityChannel,
  toChannel,
  channelsForCategories,
} from '@/lib/communityChannels'
import {
  COURSE_CATEGORIES,
  categoryLabel,
  categoriesForStudent,
} from '@/lib/coursesStore'
import type { CourseCategory } from '@/lib/types'

type Mode = 'tutor' | 'student' | 'admin'
type MsgType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'poll'

export interface PollOption {
  index: number
  text: string
  votes: number
  voted: boolean
}

export interface PollData {
  question: string
  options: PollOption[]
  totalVotes: number
  myVote: number | null
  isQuiz: boolean
  closed: boolean
  /** Only present once the answer is revealed (you voted, or it closed). */
  correctOption?: number
}

/** The six emoji people may react with — must match the server's list. */
const REACTIONS = ['👍', '❤️', '😂', '🔥', '👏', '😮']

export interface Reaction {
  emoji: string
  count: number
  /** Whether I am one of the people who tapped it. */
  mine: boolean
}

/** Just enough of the answered message to quote it in the bubble. */
export interface ReplyPreview {
  id: string
  senderName: string
  text: string
  type: MsgType
}

interface Msg {
  id: string
  senderId: string
  senderName: string
  senderRole: string
  type: MsgType
  text?: string
  fileUrl?: string
  fileName?: string
  fileType?: string
  fileSize?: number
  durationSec?: number
  createdAt: number
  own: boolean
  pinned: boolean
  poll?: PollData
  /** How many people have seen it ("seen by", WhatsApp-style). */
  readCount: number
  /** Emoji tallies, one row per emoji anyone has used. */
  reactions: Reaction[]
  /** Set when this message answers another one. */
  replyTo?: ReplyPreview
  /** This message names me (by name or @everyone). */
  mentionedMe: boolean
}

// Largest file we let the browser attempt (Cloudinary's unsigned preset caps it
// too; this just fails fast with a friendly message before the upload starts).
const MAX_BYTES = 50 * 1024 * 1024

const str = (v: unknown): string => (v == null ? '' : String(v))

function humanSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** One line describing a message, for reply bars and quoted blocks. */
function previewText(m: {
  type: MsgType
  text?: string
  fileName?: string
  poll?: PollData
}): string {
  if (m.type === 'poll') return `📊 ${m.poll?.question ?? 'Poll'}`
  if (m.type === 'image') return '📷 Photo'
  if (m.type === 'video') return '🎥 Video'
  if (m.type === 'audio') return '🎤 Voice note'
  if (m.type === 'file') return `📄 ${m.fileName || 'Document'}`
  return m.text || ''
}

/** Draw @names apart from the rest of the sentence. */
function withMentions(text: string, own: boolean) {
  const parts = text.split(/(@[\w][\w' -]{0,29})/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span
        key={i}
        className={`font-black ${own ? 'text-white underline decoration-white/40' : 'text-[#002EFF]'}`}
      >
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/** Messages are grouped under the day they were sent. */
const dayKey = (ms: number) => new Date(ms).toDateString()

function dayLabel(ms: number): string {
  const d = new Date(ms)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(ms) === today.toDateString()) return 'Today'
  if (dayKey(ms) === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  })
}

/** Where this browser last left each channel, so "New messages" lands right. */
const seenKey = (channelId: string) => `dsa_community_seen_${channelId}`

function clock(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function duration(sec?: number): string {
  if (!sec || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const roleLabel = (r: string): string => {
  const k = r.toLowerCase()
  if (k === 'tutor') return 'Tutor'
  if (k === 'student') return 'Student'
  if (k.includes('admin')) return 'Admin'
  return r || 'Member'
}

const roleTint = (r: string): string => {
  const k = r.toLowerCase()
  if (k === 'tutor') return 'bg-blue-50 text-[#002EFF]'
  if (k.includes('admin')) return 'bg-amber-50 text-amber-600'
  return 'bg-slate-100 text-slate-500'
}

/** Messages per page. Small on purpose: most readers are on weak networks. */
const PAGE_SIZE = 20

/** Subject symbols a student cannot type on a phone keyboard. */
const SYMBOLS = ['Δ', '°', '²', '³', '√', 'π', '∫', '≤', '≥', '≠', '→', '⇌', '×', '÷', '½']

const POD_TINTS = [
  'bg-[#002EFF]',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-600',
]

/** A stable colour for a pod's avatar, from its id. */
function podTint(c: { id: string; kind?: string }): string {
  if (c.kind === 'general' || c.id === 'general') return 'bg-[#0B2E8A]'
  let h = 0
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return POD_TINTS[h % POD_TINTS.length]
}

function podIcon(c: { id: string; kind?: string; name: string }) {
  if (c.kind === 'general' || c.id === 'general' || /announce|bulletin/i.test(c.name))
    return <Megaphone size={18} />
  return <Hash size={18} />
}

/** "3:15 PM" for today, otherwise the day. */
function rowTime(ms?: number | null): string {
  if (!ms) return ''
  const label = dayLabel(ms)
  return label === 'Today' ? clock(ms) : label
}

const DEPARTMENTS = [
  { id: 'science', label: 'Science' },
  { id: 'art', label: 'Art' },
  { id: 'commercial', label: 'Commercial' },
] as const

/** All / Science / Art / Commercial. None chosen — or all three — means everyone. */
function DeptChips({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const everyone = value.length === 0 || value.length === DEPARTMENTS.length
  const chip = (on: boolean) =>
    `px-2.5 py-1.5 rounded-full text-[10px] font-black uppercase transition-colors disabled:opacity-50 ${
      on ? 'bg-[#002EFF] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
    }`
  return (
    <div className='flex flex-wrap items-center gap-1.5' role='group' aria-label='Departments'>
      <button type='button' disabled={disabled} onClick={() => onChange([])} aria-pressed={everyone} className={chip(everyone)}>
        All
      </button>
      {DEPARTMENTS.map((d) => {
        const on = !everyone && value.includes(d.id)
        return (
          <button
            key={d.id}
            type='button'
            disabled={disabled}
            aria-pressed={on}
            onClick={() => {
              const base = everyone ? [] : value
              const next = on ? base.filter((v) => v !== d.id) : [...base, d.id]
              onChange(next.length === DEPARTMENTS.length ? [] : next)
            }}
            className={chip(on)}
          >
            {d.label}
          </button>
        )
      })}
    </div>
  )
}

export default function Community({
  mode,
  token,
}: {
  mode: Mode
  /** Explicit bearer token — admin passes its admin token; members omit it. */
  token?: string
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notReady, setNotReady] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  // The message the next send will answer (cleared once it goes out).
  const [replyTarget, setReplyTarget] = useState<Msg | null>(null)
  // Who else is in this channel right now, and who is mid-sentence.
  const [online, setOnline] = useState<
    { id: string; fullname: string; role: string }[]
  >([])
  const [typingNames, setTypingNames] = useState<string[]>([])
  const typingRef = useRef(false)
  // Push instead of poll: while the socket is joined to this channel the
  // server sends every change and the 6-second poll stands down. `liveRef`
  // is what the timers read; `live` is for anything that wants to render it.
  const socketRef = useRef<Socket | null>(null)
  const liveRef = useRef(false)
  const [live, setLive] = useState(false)
  // Who the socket says is typing → the moment their "typing" fades.
  const typersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // @mention picker state, driven by what you are typing.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const mentionedRef = useRef<Record<string, string>>({})
  // The notifications panel (unread + mentions per channel, with mute).
  const [bellOpen, setBellOpen] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  // Search across the channels this person can open.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchScope, setSearchScope] = useState<'all' | 'files' | 'links'>('all')
  const [searchHits, setSearchHits] = useState<Msg[] | null>(null)
  const [searchChannel, setSearchChannel] = useState<Record<string, string>>({})
  const [searching, setSearching] = useState(false)
  // Everything newer than this was posted since you last had the channel open.
  const [newSince, setNewSince] = useState(0)
  // Only follow new messages when you are already at the bottom — nobody wants
  // to be yanked away from something they are reading.
  const [atBottom, setAtBottom] = useState(true)
  const msgChannelRef = useRef('')
  // Poll composer (tutors / admins).
  const [pollOpen, setPollOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollIsQuiz, setPollIsQuiz] = useState(false)
  const [pollCorrect, setPollCorrect] = useState(0)

  // Channels — General + one per programme (JAMB/Post-UTME/WAEC by department,
  // etc.). Students see General + their programme's; tutors/admin see them all.
  const [channels, setChannels] = useState<CommunityChannel[]>([])
  const [activeChannel, setActiveChannel] = useState('general')
  const [membersOpen, setMembersOpen] = useState(false)
  const [members, setMembers] = useState<
    { id: string; name: string; role: string }[]
  >([])
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSubject, setNewSubject] = useState('')
  // Departments for the community being created. Empty = every department.
  const [newDepts, setNewDepts] = useState<string[]>([])
  // Admin: tutors to choose from when putting one in charge of a community.
  const [tutorList, setTutorList] = useState<{ id: string; name: string }[]>([])
  const [scopeSaving, setScopeSaving] = useState(false)
  // Admin: who may open the Community, and renaming the active channel.
  const [access, setAccess] = useState<'all' | 'paid'>('all')
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [newCategory, setNewCategory] = useState<CourseCategory | ''>('')
  // Phone layout: the pod list, then the conversation you tapped.
  const [pane, setPane] = useState<'list' | 'chat'>('list')
  const [listFilter, setListFilter] = useState('')
  // Admin: the management pane, as a drawer below `lg`.
  const [manageOpen, setManageOpen] = useState(false)
  // The last fetch of rooms or messages failed; the poll keeps trying.
  const [offline, setOffline] = useState(false)
  // One dropped request on a flaky phone network is normal; only call the
  // room offline after a few in a row, and never while the socket is live.
  const channelFailsRef = useRef(0)
  // Phone: the header only has room for the bell; the rest fold under `⋯`.
  const [moreOpen, setMoreOpen] = useState(false)
  // How tall the chat may be: from where it starts down to the bottom of the
  // screen. A fixed "screen minus header" guess was wrong on phones — the box
  // stopped short and the page's padding showed beneath it as a floating card.
  // Measuring also lets the box shrink when the keyboard opens, so the
  // composer stays in view.
  //
  // On a phone the chat also runs edge to edge, like Telegram: the page's own
  // side and bottom padding is cancelled with negative margins (measured, since
  // each dashboard shell pads differently), and the card corners go away.
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [fillHeight, setFillHeight] = useState<number | null>(null)
  const [bleed, setBleed] = useState<{ x: number; bottom: number } | null>(null)
  useEffect(() => {
    const el = shellRef.current
    if (!el) return
    const measure = () => {
      const phone = window.innerWidth < 768
      let top = el.getBoundingClientRect().top
      let gutter = 16
      let padX = 0
      for (let n = el.parentElement; n; n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (/(auto|scroll)/.test(cs.overflowY)) {
          top += n.scrollTop
          gutter = parseFloat(cs.paddingBottom) || gutter
          padX = parseFloat(cs.paddingLeft) || 0
          break
        }
      }
      const vh = window.visualViewport?.height ?? window.innerHeight
      const bottomGap = phone ? 0 : gutter
      setBleed(phone ? { x: padX, bottom: gutter } : null)
      setFillHeight(Math.max(420, Math.round(vh - top - bottomGap)))
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [])

  // Voice-note recording (tutors only).
  const [recording, setRecording] = useState(false)
  const [recSecs, setRecSecs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const imageInput = useRef<HTMLInputElement | null>(null)
  const videoInput = useRef<HTMLInputElement | null>(null)
  const docInput = useRef<HTMLInputElement | null>(null)

  // Everyone can post. Tutors and admins additionally get voice notes; admins
  // also moderate (delete any message). Students get everything except audio.
  const canCompose = true
  const canRecord = mode === 'tutor' || mode === 'admin'
  const isModerator = mode === 'admin'
  // Tutors + admins can pin messages and lock the channel (lesson mode).
  const canManage = mode === 'tutor' || mode === 'admin'

  // Channel lock (lesson / broadcast mode): when locked, students cannot post;
  // tutors and admins still can.
  const [locked, setLockedState] = useState(false)
  const postingBlocked = locked && mode === 'student'

  // Identify the current user so their own bubbles align right.
  const me = getUser() as
    | (ReturnType<typeof getUser> & { id?: string; _id?: string })
    | null
  const myId = str(me?.id || me?._id)
  const myName = str(me?.fullName || (me as { username?: string })?.username)
  // The socket needs the bearer token explicitly (no cookies on a WebSocket).
  const authToken = token || getToken() || ''

  const normalize = useCallback(
    (raw: Record<string, unknown>): Msg => {
      const sender = (raw.sender ?? raw.user ?? {}) as Record<string, unknown>
      const senderId = str(
        sender.id ?? sender._id ?? raw.senderId ?? raw.userId,
      )
      const senderName =
        str(
          sender.fullname ??
            sender.fullName ??
            sender.name ??
            sender.username ??
            raw.senderName,
        ) || 'Member'
      const senderRole = str(
        sender.role ?? raw.senderRole ?? raw.role ?? 'student',
      )
      const fileType = str(raw.fileType ?? raw.mimeType)
      let type = str(raw.type) as MsgType
      if (
        !type ||
        !['text', 'image', 'video', 'audio', 'file', 'poll'].includes(type)
      ) {
        if (fileType.startsWith('image/')) type = 'image'
        else if (fileType.startsWith('video/')) type = 'video'
        else if (fileType.startsWith('audio/')) type = 'audio'
        else if (raw.fileUrl) type = 'file'
        else type = 'text'
      }
      const createdRaw = raw.createdAt ?? raw.timestamp ?? raw.date
      const createdAt =
        (createdRaw ? Date.parse(str(createdRaw)) : NaN) || Date.now()
      const own =
        (!!myId && senderId === myId) ||
        (!myId && !!myName && senderName === myName)
      return {
        id: str(raw.id ?? raw._id),
        senderId,
        senderName,
        senderRole,
        type,
        text: raw.text ? str(raw.text) : undefined,
        fileUrl: raw.fileUrl ? str(raw.fileUrl) : undefined,
        fileName: raw.fileName ? str(raw.fileName) : undefined,
        fileType: fileType || undefined,
        fileSize: typeof raw.fileSize === 'number' ? raw.fileSize : undefined,
        durationSec:
          typeof raw.durationSec === 'number' ? raw.durationSec : undefined,
        createdAt,
        own,
        pinned: !!raw.pinned,
        poll: raw.poll ? (raw.poll as unknown as PollData) : undefined,
        readCount:
          typeof raw.readCount === 'number' ? raw.readCount : 0,
        reactions: Array.isArray(raw.reactions)
          ? (raw.reactions as Record<string, unknown>[])
              .map((r) => ({
                emoji: str(r.emoji),
                count: typeof r.count === 'number' ? r.count : 0,
                mine: !!r.mine,
              }))
              .filter((r) => r.emoji && r.count > 0)
          : [],
        // A pushed copy is formatted for nobody, so work it out from the ids.
        mentionedMe:
          !!raw.mentionedMe ||
          (!own &&
            !!myId &&
            (!!raw.mentionsEveryone ||
              (Array.isArray(raw.mentions) &&
                (raw.mentions as unknown[]).map(str).includes(myId)))),
        replyTo: raw.replyTo
          ? (() => {
              const p = raw.replyTo as Record<string, unknown>
              return {
                id: str(p.id ?? p._id),
                senderName: str(p.senderName) || 'Member',
                text: str(p.text),
                type: (str(p.type) || 'text') as MsgType,
              }
            })()
          : undefined,
      }
    },
    [myId, myName],
  )

  // Earlier pages, fetched on demand. `olderDone` means the channel's first
  // message is already on screen.
  const [olderDone, setOlderDone] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  // scrollHeight before a page of older messages was prepended, or null.
  const prependRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && prependRef.current != null) {
      el.scrollTop += el.scrollHeight - prependRef.current
      prependRef.current = null
    }
  }, [messages])
  const loadOlder = useCallback(async () => {
    const oldest = messages[0]
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    // Reading history means the reader is up top; the newest-in-view effect
    // must not drag them back down when the page arrives.
    setAtBottom(false)
    const box = scrollRef.current
    const heightBefore = box ? box.scrollHeight : 0
    try {
      const rows = (await dsaApi.community.list(
        { limit: PAGE_SIZE, channelId: activeChannel, before: oldest.id },
        token,
      )) as Record<string, unknown>[]
      const older = rows.map(normalize).sort((a, b) => a.createdAt - b.createdAt)
      setOlderDone(rows.length < PAGE_SIZE)
      if (older.length) {
        // The layout effect below puts the scroll back where it was once the
        // older messages are in the DOM.
        prependRef.current = heightBefore
        setMessages((prev) => {
          const have = new Set(prev.map((m) => m.id))
          return [...older.filter((m) => !have.has(m.id)), ...prev]
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load earlier messages.')
    } finally {
      setLoadingOlder(false)
    }
  }, [messages, loadingOlder, activeChannel, token, normalize])

  const load = useCallback(
    async (initial = false) => {
      // Switching channel: show the new room's own loading state at once and
      // drop the old room's messages, so the tap feels instant instead of
      // leaving the previous chat on screen until the fetch returns.
      const switching = msgChannelRef.current !== activeChannel
      if (initial || switching) setLoading(true)
      if (switching) {
        setMessages([])
        setOlderDone(false)
      }
      try {
        const rows = (await dsaApi.community.list(
          { limit: PAGE_SIZE, channelId: activeChannel },
          token,
        )) as Record<string, unknown>[]
        const mapped = rows.map(normalize).sort((a, b) => a.createdAt - b.createdAt)
        // Only the newest page comes back. Keep any earlier pages the reader
        // has already scrolled up into, unless this is another channel.
        const sameChannel = msgChannelRef.current === activeChannel
        setMessages((prev) => {
          if (!sameChannel || !prev.length) return mapped
          const oldestFresh = mapped[0]?.createdAt ?? 0
          const fresh = new Set(mapped.map((m) => m.id))
          const kept = prev.filter((m) => m.createdAt < oldestFresh && !fresh.has(m.id))
          return [...kept, ...mapped]
        })
        if (!sameChannel) setOlderDone(rows.length < PAGE_SIZE)
        msgChannelRef.current = activeChannel
        setNotReady(false)
      } catch {
        // The channel endpoint may not be live yet — show a soft notice rather
        // than a crash. Sending will surface the real error inline if tried.
        if (initial) setNotReady(true)
      } finally {
        setLoading(false)
      }
    },
    [normalize, token, activeChannel],
  )

  // Keep the channel lock state in sync (best-effort: if the settings endpoint
  // isn't live yet, treat the channel as unlocked so posting still works).
  const loadSettings = useCallback(async () => {
    try {
      const s = await dsaApi.community.getSettings(token, activeChannel)
      setLockedState(!!s?.locked)
    } catch {
      /* settings endpoint not available yet — stay unlocked */
    }
  }, [token, activeChannel])

  // Initial load + light polling + refresh when the tab regains focus.
  useEffect(() => {
    load(true)
    loadSettings()
    // Every open tab polls, so a class of a few hundred is a few hundred
    // pollers. Skip the tick while the tab is hidden — nobody is reading it —
    // and catch up the moment it is shown again.
    const poll = setInterval(() => {
      if (document.hidden || liveRef.current) return
      load(false)
      loadSettings()
    }, 6000)
    const onFocus = () => {
      load(false)
      loadSettings()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
    }
  }, [load, loadSettings])

  // Opening a channel: remember where this browser left it, so anything newer
  // gets the "New messages" line.
  useEffect(() => {
    setAtBottom(true)
    try {
      setNewSince(Number(localStorage.getItem(seenKey(activeChannel))) || 0)
    } catch {
      setNewSince(0)
    }
  }, [activeChannel])

  // Move the mark forward as messages arrive (the divider itself stays put
  // until you leave the channel, so it doesn't vanish while you read).
  useEffect(() => {
    if (!messages.length || msgChannelRef.current !== activeChannel) return
    try {
      localStorage.setItem(
        seenKey(activeChannel),
        String(messages[messages.length - 1].createdAt),
      )
    } catch {
      /* private mode — the divider just won't survive a reload */
    }
  }, [messages, activeChannel])

  // Keep the newest message in view, unless you have scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottom) el.scrollTop = el.scrollHeight
    // `atBottom` is a condition here, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  // One beat: tell the server we're here, hear who else is.
  const beat = useCallback(
    async (typing?: boolean) => {
      try {
        const res = await dsaApi.community.presence(
          { channelId: activeChannel, ...(typing === undefined ? {} : { typing }) },
          token,
        )
        setOnline(res.online ?? [])
        setTypingNames((res.typing ?? []).map((t) => t.fullname))
      } catch {
        /* presence endpoint not live yet — the room just looks empty */
      }
    },
    [activeChannel, token],
  )

  useEffect(() => {
    setOnline([])
    setTypingNames([])
    if (!liveRef.current) beat()
    const timer = setInterval(() => {
      if (!document.hidden && !liveRef.current) beat()
    }, 20000)
    return () => clearInterval(timer)
  }, [beat])

  // Merge a pushed copy of a message over the one on screen. The room copy
  // knows nothing about me, so what only I know stays: which reactions are
  // mine, how I voted, the quiz answer once it was shown to me.
  const mergeIncoming = useCallback(
    (prev: Msg | undefined, raw: Record<string, unknown>): Msg => {
      const next = normalize(raw)
      if (!prev) return next
      const mine = new Set(prev.reactions.filter((r) => r.mine).map((r) => r.emoji))
      const reactions = next.reactions.map((r) => ({ ...r, mine: mine.has(r.emoji) }))
      let poll = next.poll
      if (poll && prev.poll) {
        const myVote = prev.poll.myVote
        poll = {
          ...poll,
          myVote,
          options: poll.options.map((o) => ({ ...o, voted: o.index === myVote })),
          correctOption: poll.correctOption ?? prev.poll.correctOption,
        }
      }
      return {
        ...next,
        reactions,
        poll,
        mentionedMe: prev.mentionedMe || next.mentionedMe,
        readCount: Math.max(prev.readCount, next.readCount),
      }
    },
    [normalize],
  )

  // One socket for as long as the Community is open.
  useEffect(() => {
    const s = acquireRealtime(authToken)
    socketRef.current = s
    return () => {
      socketRef.current = null
      releaseRealtime()
    }
  }, [authToken])

  // Join the room for the channel on screen and act on what the server pushes.
  useEffect(() => {
    const s = socketRef.current
    if (!s) return
    const channel = activeChannel
    const typers = typersRef.current
    let joined = false

    const goLive = (on: boolean) => {
      liveRef.current = on
      setLive(on)
    }
    const join = (catchUp: boolean) => {
      s.emit('join', channel, (ack: JoinAck) => {
        if (!ack || !ack.ok) {
          goLive(false)
          return
        }
        joined = true
        goLive(true)
        setOnline(ack.online ?? [])
        setTypingNames((ack.typing ?? []).map((t) => t.fullname))
        if (catchUp) {
          // Whatever happened while the line was down.
          load(false)
          loadSettings()
        }
      })
    }
    const onConnect = () => join(true)
    const onDisconnect = () => goLive(false)
    const onNew = (raw: Record<string, unknown>) => {
      if (str(raw.channelId) !== channel) return
      const id = str(raw.id ?? raw._id)
      setMessages((prev) =>
        prev.some((m) => m.id === id)
          ? prev.map((m) => (m.id === id ? mergeIncoming(m, raw) : m))
          : [...prev, normalize(raw)],
      )
    }
    const onUpdate = (raw: Record<string, unknown>) => {
      if (str(raw.channelId) !== channel) return
      const id = str(raw.id ?? raw._id)
      setMessages((prev) => prev.map((m) => (m.id === id ? mergeIncoming(m, raw) : m)))
    }
    const onDelete = (p: { id: string; channelId: string }) => {
      if (str(p.channelId) !== channel) return
      setMessages((prev) => prev.filter((m) => m.id !== str(p.id)))
    }
    const onRead = (p: { channelId: string; counts: Record<string, number> }) => {
      if (str(p.channelId) !== channel || !p.counts) return
      setMessages((prev) =>
        prev.map((m) =>
          typeof p.counts[m.id] === 'number'
            ? { ...m, readCount: Math.max(m.readCount, p.counts[m.id]) }
            : m,
        ),
      )
    }
    const onSettings = (p: { channelId: string; locked?: boolean }) => {
      if (str(p.channelId) !== channel) return
      setLockedState(!!p.locked)
    }
    const onPresence = (p: PresenceEvent) => {
      if (str(p.channelId) !== channel) return
      setOnline(p.online ?? [])
    }
    const publishTypers = () => setTypingNames(Array.from(typers.keys()))
    const onTyping = (p: TypingEvent) => {
      if (str(p.channelId) !== channel || !p.user) return
      const name = p.user.fullname || 'Someone'
      const old = typers.get(name)
      if (old) clearTimeout(old)
      if (p.typing) {
        // If the "stopped" never arrives (they closed the tab mid-word), fade
        // it on our own.
        typers.set(name, setTimeout(() => { typers.delete(name); publishTypers() }, 8000))
      } else {
        typers.delete(name)
      }
      publishTypers()
    }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('message:new', onNew)
    s.on('message:update', onUpdate)
    s.on('message:delete', onDelete)
    s.on('message:read', onRead)
    s.on('settings', onSettings)
    s.on('presence', onPresence)
    s.on('typing', onTyping)
    if (s.connected) join(false)

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off('message:new', onNew)
      s.off('message:update', onUpdate)
      s.off('message:delete', onDelete)
      s.off('message:read', onRead)
      s.off('settings', onSettings)
      s.off('presence', onPresence)
      s.off('typing', onTyping)
      if (joined && s.connected) s.emit('leave')
      for (const t of typers.values()) clearTimeout(t)
      typers.clear()
      goLive(false)
    }
  }, [activeChannel, authToken, normalize, mergeIncoming, load, loadSettings])

  /** "I am typing" — over the socket when it is up, else the presence ping. */
  const sayTyping = useCallback(
    (typing: boolean) => {
      const s = socketRef.current
      if (liveRef.current && s && s.connected) s.emit('typing', typing)
      else beat(typing)
    },
    [beat],
  )

  /** Called as you type: says "typing" once, and stops on its own. */
  const noteTyping = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true
      sayTyping(true)
    }
    if (typingStopRef.current) clearTimeout(typingStopRef.current)
    typingStopRef.current = setTimeout(() => {
      typingRef.current = false
      sayTyping(false)
    }, 4000)
  }, [sayTyping])

  const stopTyping = useCallback(() => {
    if (typingStopRef.current) clearTimeout(typingStopRef.current)
    if (typingRef.current) {
      typingRef.current = false
      sayTyping(false)
    }
  }, [sayTyping])

  const runSearch = useCallback(async () => {
    const q = searchTerm.trim()
    if (q.length < 2) return
    setSearching(true)
    try {
      const rows = (await dsaApi.community.search(
        { q, type: searchScope },
        token,
      )) as Record<string, unknown>[]
      const channelOf: Record<string, string> = {}
      rows.forEach((r) => {
        channelOf[str(r.id ?? r._id)] = str(r.channelId || 'general')
      })
      setSearchChannel(channelOf)
      setSearchHits(rows.map(normalize))
    } catch {
      setSearchHits([])
    } finally {
      setSearching(false)
    }
  }, [searchTerm, searchScope, token, normalize])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchTerm('')
    setSearchHits(null)
  }, [])

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setAtBottom(true)
  }, [])

  const post = useCallback(
    async (body: Parameters<typeof dsaApi.community.send>[0]) => {
      setError(null)
      setSending(true)
      try {
        await dsaApi.community.send(
          {
            ...body,
            channelId: activeChannel,
            ...(replyTarget ? { replyTo: replyTarget.id } : {}),
          },
          token,
        )
        setReplyTarget(null)
        await load(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not send message.')
      } finally {
        setSending(false)
      }
    },
    [load, token, activeChannel, replyTarget],
  )

  // Tap an emoji to add it, tap it again to take it back. The bubble updates
  // straight away so it feels instant; the reload settles the real tally.
  const react = useCallback(
    async (id: string, emoji: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m
          const existing = m.reactions.find((r) => r.emoji === emoji)
          if (!existing)
            return { ...m, reactions: [...m.reactions, { emoji, count: 1, mine: true }] }
          const count = existing.count + (existing.mine ? -1 : 1)
          return {
            ...m,
            reactions: m.reactions
              .map((r) =>
                r.emoji === emoji ? { ...r, count, mine: !r.mine } : r,
              )
              .filter((r) => r.count > 0),
          }
        }),
      )
      try {
        await dsaApi.community.react(id, emoji, token)
      } catch {
        /* the next poll puts the real tally back */
      }
      load(false)
    },
    [load, token],
  )

  // Replying to a message you can no longer see (deleted mid-reply) is a dead
  // end — drop the target when it leaves the feed.
  useEffect(() => {
    if (replyTarget && !messages.some((m) => m.id === replyTarget.id))
      setReplyTarget(null)
  }, [messages, replyTarget])

  // Drop a symbol where the cursor is (not at the end), and keep the cursor
  // just after it so the next tap lands in the right place too.
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const insertSymbol = useCallback((sym: string) => {
    const el = composerRef.current
    const start = el ? el.selectionStart : text.length
    const end = el ? el.selectionEnd : text.length
    const next = text.slice(0, start) + sym + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(start + sym.length, start + sym.length)
    })
  }, [text])

  const sendText = useCallback(() => {
    const t = text.trim()
    if (!t || sending) return
    // Only send the mentions whose name is still in the text.
    const mentions = Object.entries(mentionedRef.current)
      .filter(([, name]) => t.includes(`@${name}`))
      .map(([id]) => id)
    const mentionsEveryone = /(^|\s)@everyone\b/i.test(t) && canManage
    setText('')
    setMentionQuery(null)
    mentionedRef.current = {}
    stopTyping()
    post({
      type: 'text',
      text: t,
      ...(mentions.length ? { mentions } : {}),
      ...(mentionsEveryone ? { mentionsEveryone: true } : {}),
    })
  }, [text, sending, post, canManage, stopTyping])

  const handleFile = useCallback(
    async (file: File | null, type: MsgType) => {
      setAttachOpen(false)
      if (!file) return
      setError(null)
      if (file.size > MAX_BYTES) {
        setError(`That file is too large (max ${humanSize(MAX_BYTES)}).`)
        return
      }
      setUploading(true)
      try {
        const res = await uploadToCloudinary(file, 'dsa/community')
        await post({
          type,
          fileUrl: res.url,
          fileName: file.name,
          fileType: file.type || undefined,
          fileSize: res.bytes ?? file.size,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed.')
      } finally {
        setUploading(false)
      }
    },
    [post],
  )

  // ---- Voice notes (tutors) ----
  const startRecording = useCallback(async () => {
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Voice recording is not supported on this device.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (recTimerRef.current) clearInterval(recTimerRef.current)
        const secs = recSecs
        setRecording(false)
        setRecSecs(0)
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        })
        if (blob.size === 0) return
        const ext = (rec.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm'
        const file = new File([blob], `voice-note.${ext}`, { type: blob.type })
        setUploading(true)
        try {
          const res = await uploadToCloudinary(file, 'dsa/community')
          await post({
            type: 'audio',
            fileUrl: res.url,
            fileName: file.name,
            fileType: file.type || undefined,
            fileSize: res.bytes ?? file.size,
            durationSec: secs,
          })
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not send voice note.')
        } finally {
          setUploading(false)
        }
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
      setRecSecs(0)
      recTimerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000)
    } catch {
      setError('Microphone permission was denied.')
    }
  }, [post, recSecs])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const cancelRecording = useCallback(() => {
    const rec = recorderRef.current
    if (!rec) return
    rec.onstop = null
    rec.stream?.getTracks?.().forEach((t) => t.stop())
    try {
      rec.stop()
    } catch {
      /* already stopped */
    }
    if (recTimerRef.current) clearInterval(recTimerRef.current)
    chunksRef.current = []
    setRecording(false)
    setRecSecs(0)
  }, [])

  const remove = useCallback(
    async (id: string) => {
      const prev = messages
      setMessages((m) => m.filter((x) => x.id !== id))
      try {
        await dsaApi.community.remove(id, token)
      } catch (e) {
        setMessages(prev) // put it back if the delete failed
        setError(e instanceof Error ? e.message : 'Could not delete message.')
      }
    },
    [messages, token],
  )

  // Edit own message text (author only).
  const editMessage = useCallback(
    async (id: string, newText: string) => {
      setError(null)
      try {
        await dsaApi.community.update(id, { text: newText }, token)
        await load(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not edit message.')
      }
    },
    [load, token],
  )

  // Pin / unpin a message (tutor / admin).
  const togglePin = useCallback(
    async (m: Msg) => {
      setError(null)
      try {
        await dsaApi.community.update(m.id, { pinned: !m.pinned }, token)
        await load(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not pin message.')
      }
    },
    [load, token],
  )

  // Admin: load + change who can open the Community.
  useEffect(() => {
    if (mode !== 'admin') return
    let cancelled = false
    dsaApi.community
      .getAccess(token)
      .then((a) => {
        if (!cancelled) setAccess(a === 'paid' ? 'paid' : 'all')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mode, token])

  const changeAccess = useCallback(
    async (next: 'all' | 'paid') => {
      const prev = access
      setAccess(next)
      try {
        await dsaApi.community.setAccess(next, token)
      } catch (e) {
        setAccess(prev)
        setError(
          e instanceof Error ? e.message : 'Could not change community access.',
        )
      }
    },
    [access, token],
  )

  // Post a poll — plain, or marked as a quiz with a correct option.
  const sendPoll = useCallback(async () => {
    const question = pollQuestion.trim()
    const options = pollOptions.map((o) => o.trim()).filter(Boolean)
    if (!question) return setError('Add a poll question.')
    if (options.length < 2) return setError('A poll needs at least 2 options.')
    if (pollIsQuiz && (pollCorrect < 0 || pollCorrect >= options.length)) {
      return setError('Choose which option is the correct answer.')
    }
    setError(null)
    setSending(true)
    try {
      await dsaApi.community.send(
        {
          type: 'poll',
          channelId: activeChannel,
          poll: {
            question,
            options,
            isQuiz: pollIsQuiz,
            ...(pollIsQuiz ? { correctOption: pollCorrect } : {}),
          },
        },
        token,
      )
      setPollOpen(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      setPollIsQuiz(false)
      setPollCorrect(0)
      await load(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post the poll.')
    } finally {
      setSending(false)
    }
  }, [
    pollQuestion,
    pollOptions,
    pollIsQuiz,
    pollCorrect,
    activeChannel,
    token,
    load,
  ])

  // Vote on a poll — the server returns the updated tallies.
  const votePoll = useCallback(
    async (messageId: string, option: number) => {
      setError(null)
      try {
        const updated = (await dsaApi.community.vote(
          messageId,
          option,
          token,
        )) as Record<string, unknown>
        const next = normalize(updated)
        setMessages((prev) => prev.map((m) => (m.id === next.id ? next : m)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not record your vote.')
      }
    },
    [normalize, token],
  )

  // Who has seen a message (sender taps "Seen by").
  const loadReads = useCallback(
    async (messageId: string) => {
      const rows = (await dsaApi.community.reads(messageId, token)) as Record<
        string,
        unknown
      >[]
      return rows.map((r) => ({ fullname: str(r.fullname) || 'Member' }))
    },
    [token],
  )

  // Mark everyone else's messages in this channel as seen, once they're loaded.
  useEffect(() => {
    const unseen = messages
      .filter((m) => !m.own && m.id)
      .map((m) => m.id)
      .slice(-20)
    if (!unseen.length) return
    let cancelled = false
    const id = setTimeout(() => {
      dsaApi.community
        .markRead(activeChannel, unseen, token)
        .catch(() => {})
        .finally(() => {
          if (cancelled) return
        })
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
    // Re-runs when the visible set changes; the server ignores duplicates.
  }, [messages, activeChannel, token])

  // Lock / unlock the channel (tutor / admin) — optimistic with rollback.
  const toggleLock = useCallback(async () => {
    const next = !locked
    setLockedState(next)
    setError(null)
    try {
      await dsaApi.community.setLocked(next, token, activeChannel)
    } catch (e) {
      setLockedState(!next)
      setError(
        e instanceof Error ? e.message : 'Could not change the lock state.',
      )
    }
  }, [locked, token, activeChannel])

  // ---- Channels ----
  const loadChannels = useCallback(async () => {
    let list: CommunityChannel[]
    try {
      const rows = (await dsaApi.community.channels(token)) as Record<
        string,
        unknown
      >[]
      list = rows.map(toChannel)
      channelFailsRef.current = 0
      setOffline(false)
    } catch {
      // The server could not be reached. This used to swap in a made-up list
      // (SS1, SS2, WAEC, JAMB…) so the switcher "still worked" — which looked
      // exactly like a broken deployment. Keep whatever was loaded before,
      // and only warn after a few misses in a row — a single dropped request
      // on a phone network is normal, and if the socket is live the room is
      // working anyway.
      channelFailsRef.current += 1
      if (channelFailsRef.current >= 3 && !liveRef.current) setOffline(true)
      return
    }
    let visible = list
    if (mode === 'student') {
      // Students see General + the community for each category they belong to
      // (their class AND their exam track).
      visible = channelsForCategories(list, categoriesForStudent(getUser()))
    } else if (mode === 'tutor') {
      // Tutors are scoped to the communities for the categories they teach —
      // derived from their assigned courses. Fail open (show all) if we can't
      // resolve any courses, so a tutor is never locked out of the switcher.
      try {
        const courses = (await dsaApi.courses.list(
          { tutorId: 'me' },
          token,
        )) as Record<string, unknown>[]
        const cats = [
          ...new Set(
            courses.map((c) => String(c.category ?? '')).filter(Boolean),
          ),
        ]
        if (cats.length) visible = channelsForCategories(list, cats)
      } catch {
        /* keep all channels visible */
      }
    }
    // Admin sees every channel (moderation).
    setChannels(visible)
    setActiveChannel((cur) =>
      visible.some((c) => c.id === cur) ? cur : 'general',
    )
  }, [mode, token])

  // Unread counts ride along with the channel list, so refresh it on the same
  // beat as the messages (slower — it is only a badge).
  useEffect(() => {
    loadChannels()
    const poll = setInterval(() => { if (!document.hidden) loadChannels() }, 30000)
    return () => clearInterval(poll)
  }, [loadChannels])

  const createChannel = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    const category = newCategory || undefined
    const subject = newSubject.trim() || undefined
    try {
      // The backend stores the category in its `track` string field; `subject`
      // scopes it further (e.g. a Physics class community).
      await dsaApi.community.createChannel(
        { name, track: category, subject, departments: newDepts },
        token,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the community.')
      return
    }
    setNewName('')
    setNewCategory('')
    setNewSubject('')
    setNewDepts([])
    setNewOpen(false)
    await loadChannels()
  }, [newName, newCategory, newSubject, newDepts, token, loadChannels])

  // Admin: change who may open the active community — which departments, and
  // which tutors are in charge of it.
  const saveScope = useCallback(
    async (patch: { departments?: string[]; tutors?: string[] }) => {
      setScopeSaving(true)
      setError(null)
      try {
        await dsaApi.community.updateChannel(activeChannel, patch, token)
        await loadChannels()
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not change who can open this community.',
        )
      } finally {
        setScopeSaving(false)
      }
    },
    [activeChannel, token, loadChannels],
  )

  useEffect(() => {
    if (mode !== 'admin') return
    let alive = true
    dsaApi.admin
      .listUsers('tutor', token)
      .then((rows) => {
        if (!alive) return
        setTutorList(
          (rows as Record<string, unknown>[])
            .map((r) => ({
              id: String(r.id ?? r._id ?? ''),
              name: String(r.fullname ?? r.name ?? r.username ?? 'Tutor'),
            }))
            .filter((t) => t.id),
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [mode, token])

  const deleteChannel = useCallback(
    async (id: string) => {
      if (id === 'general') return
      try {
        await dsaApi.community.removeChannel(id, token)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete the community.')
        return
      }
      if (activeChannel === id) setActiveChannel('general')
      await loadChannels()
    },
    [token, activeChannel, loadChannels],
  )

  // Admin: rename the active channel.
  const renameChannel = useCallback(async () => {
    const name = renameValue.trim()
    if (!name) return
    setRenaming(true)
    setError(null)
    try {
      await dsaApi.community.updateChannel(activeChannel, { name }, token)
      setRenameValue('')
      await loadChannels()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename the channel.')
    } finally {
      setRenaming(false)
    }
  }, [renameValue, activeChannel, token, loadChannels])

  // ---- Members (tutor / admin) ----
  const loadMembers = useCallback(async () => {
    try {
      const rows = (await dsaApi.community.members(
        activeChannel,
        token,
      )) as Record<string, unknown>[]
      if (rows.length) {
        setMembers(
          rows.map((r) => ({
            id: str(r.id ?? r._id ?? r.userId),
            name:
              str(r.fullname ?? r.fullName ?? r.name ?? r.username) || 'Member',
            role: str(r.role ?? 'student'),
          })),
        )
        return
      }
    } catch {
      /* members endpoint not live — derive from who has posted */
    }
    const seen = new Map<string, { id: string; name: string; role: string }>()
    messages.forEach((m) => {
      if (m.senderId && !seen.has(m.senderId))
        seen.set(m.senderId, {
          id: m.senderId,
          name: m.senderName,
          role: m.senderRole,
        })
    })
    setMembers([...seen.values()])
  }, [activeChannel, token, messages])

  // The roster feeds both the member panel and the @mention picker, so load it
  // with the channel rather than only when the panel opens.
  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  // Who the "@" you just typed could mean. Staff also get @everyone.
  const mentionOptions =
    mentionQuery === null
      ? []
      : [
          ...(canManage && 'everyone'.startsWith(mentionQuery.toLowerCase())
            ? [{ id: '@everyone', name: 'everyone', role: 'all' }]
            : []),
          ...members
            .filter((m) => m.id !== myId)
            .filter((m) =>
              m.name.toLowerCase().includes(mentionQuery.toLowerCase()),
            ),
        ].slice(0, 6)

  // The bell counts what a muted channel keeps to itself.
  const alertCount = channels.reduce(
    (n, c) => (c.muted ? n : n + (c.unread || 0)),
    0,
  )

  const setMute = useCallback(
    async (channelId: string, minutes?: number) => {
      // Optimistic: the badge should go quiet the moment you ask.
      setChannels((cur) =>
        cur.map((c) =>
          c.id === channelId
            ? {
                ...c,
                muted: minutes !== 0,
                mutedUntil:
                  minutes && minutes > 0 ? Date.now() + minutes * 60000 : null,
              }
            : c,
        ),
      )
      try {
        await dsaApi.community.mute(
          channelId,
          minutes === 0 ? { off: true } : { minutes },
          token,
        )
      } catch {
        /* ignore — the next channel poll restores the truth */
      }
      loadChannels()
    },
    [token, loadChannels],
  )

  const pickMention = useCallback(
    (who: { id: string; name: string }) => {
      setText((cur) => cur.replace(/@([\w' -]{0,30})$/, `@${who.name} `))
      if (who.id !== '@everyone') mentionedRef.current[who.id] = who.name
      setMentionQuery(null)
    },
    [],
  )

  const removeMember = useCallback(
    async (userId: string) => {
      setError(null)
      const prev = members
      setMembers((ms) => ms.filter((x) => x.id !== userId))
      try {
        await dsaApi.community.removeMember(activeChannel, userId, token)
      } catch (e) {
        setMembers(prev)
        setError(
          e instanceof Error
            ? e.message
            : 'Could not remove the member (needs the backend endpoint).',
        )
      }
    },
    [activeChannel, token, members],
  )

  const busy = sending || uploading
  const pinned = messages.filter((m) => m.pinned)
  const active =
    channels.find((c) => c.id === activeChannel) ??
    ({ id: 'general', name: 'General', kind: 'general' } as CommunityChannel)
  const canManageMembers = mode === 'tutor' || mode === 'admin'
  const isAdmin = mode === 'admin'

  // The pane shown on a phone: the pod list first, then the conversation you
  // tapped, Telegram-style. Both sit side by side from `md` up.
  const openChannel = (id: string) => {
    setActiveChannel(id)
    setPane('chat')
  }

  const listTerm = listFilter.trim().toLowerCase()
  const listed = channels.filter((c) =>
    listTerm ? c.name.toLowerCase().includes(listTerm) : true,
  )

  const managePanel = (
    <div className='flex h-full flex-col'>
      <div className='flex items-center justify-between border-b border-slate-100 px-4 py-3'>
        <p className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500'>
          <SlidersHorizontal size={13} /> Community management
        </p>
        <button
          onClick={() => setManageOpen(false)}
          className='rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 xl:hidden'
          aria-label='Close management'
        >
          <X size={15} />
        </button>
      </div>

      <div className='flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar'>
        {/* The room at a glance */}
        <div className='rounded-2xl bg-slate-50 p-4 text-center'>
          <div
            className={`mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl text-white ${podTint(active)}`}
          >
            {podIcon(active)}
          </div>
          <p className='text-[14px] font-black text-slate-900'>{active.name}</p>
          <p className='mt-0.5 text-[10px] font-medium text-slate-500'>
            {members.length} member{members.length === 1 ? '' : 's'} · {online.length} online
          </p>
          <div className='mt-2 flex flex-wrap justify-center gap-1'>
            {active.category && (
              <span className='rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-[#002EFF]'>
                {categoryLabel(active.category)}
              </span>
            )}
            <span className='rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-600'>
              {access === 'all' ? 'All students' : 'Paid only'}
            </span>
          </div>
        </div>

        {/* Name */}
        <div>
          <p className='mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400'>
            Channel name
          </p>
          <div className='flex items-center gap-2'>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={active.name}
              className='h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold outline-none focus:border-[#002EFF]/40'
            />
            <button
              onClick={renameChannel}
              disabled={!renameValue.trim() || renaming}
              className='h-10 shrink-0 rounded-xl bg-[#002EFF] px-3 text-[10px] font-black uppercase text-white hover:bg-blue-700 disabled:opacity-50'
            >
              {renaming ? <Loader2 size={12} className='animate-spin' /> : 'Save'}
            </button>
          </div>
        </div>

        {/* Who may open the Community at all */}
        <div>
          <p className='mb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400'>
            Access permission
          </p>
          <div className='grid grid-cols-2 gap-2'>
            {(['all', 'paid'] as const).map((a) => (
              <button
                key={a}
                onClick={() => changeAccess(a)}
                className={`h-10 rounded-xl border text-[10px] font-black uppercase transition-colors ${
                  access === a
                    ? 'border-[#002EFF] bg-blue-50 text-[#002EFF]'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {a === 'all' ? 'All students' : 'Paid only ⭐'}
              </button>
            ))}
          </div>
        </div>

        {active.id !== 'general' ? (
          <>
            {/* Departments */}
            <div>
              <p className='mb-1.5 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400'>
                Target departments
                {scopeSaving && <Loader2 size={11} className='animate-spin' />}
              </p>
              <DeptChips
                value={active.departments ?? []}
                disabled={scopeSaving}
                onChange={(departments) => saveScope({ departments })}
              />
            </div>

            {/* Tutors */}
            <div>
              <div className='mb-1.5 flex items-center justify-between'>
                <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
                  Assigned tutors
                </p>
                <select
                  value=''
                  disabled={scopeSaving}
                  onChange={(e) => {
                    const id = e.target.value
                    if (id) saveScope({ tutors: [...(active.tutors ?? []), id] })
                  }}
                  className='h-7 max-w-[140px] rounded-lg bg-transparent text-[10px] font-black text-[#002EFF] outline-none'
                  aria-label='Add a tutor'
                >
                  <option value=''>+ Add tutor</option>
                  {tutorList
                    .filter((t) => !(active.tutors ?? []).includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
              {(active.tutors ?? []).length === 0 ? (
                <p className='rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-400'>
                  No tutor assigned. Tutors who teach a subject in the room&apos;s name
                  still see it.
                </p>
              ) : (
                <div className='space-y-1'>
                  {(active.tutors ?? []).map((id) => {
                    const t = tutorList.find((x) => x.id === id)
                    const name = t?.name ?? 'Tutor'
                    return (
                      <div
                        key={id}
                        className='flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2'
                      >
                        <span className='grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#002EFF] text-[9px] font-black text-white'>
                          {name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className='min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700'>
                          {name}
                        </span>
                        <button
                          onClick={() =>
                            saveScope({
                              tutors: (active.tutors ?? []).filter((x) => x !== id),
                            })
                          }
                          disabled={scopeSaving}
                          className='rounded-lg p-1 text-slate-300 hover:bg-white hover:text-rose-500'
                          title='Remove from this community'
                          aria-label='Remove tutor'
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <p className='text-[10px] font-medium leading-snug text-slate-400'>
              Students see this community only if their department is chosen. A tutor
              sees it if assigned here, or if they teach a subject in its name.
            </p>

            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Delete the "${active.name}" community? Its messages will be removed.`,
                  )
                )
                  deleteChannel(active.id)
              }}
              className='flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-[10px] font-black uppercase text-rose-600 hover:bg-rose-100'
            >
              <Trash2 size={13} /> Delete community
            </button>
          </>
        ) : (
          <p className='text-[10px] font-medium leading-snug text-slate-400'>
            General is open to everyone and cannot be scoped or deleted.
          </p>
        )}

        {/* New community */}
        <div className='border-t border-slate-100 pt-4'>
          <button
            onClick={() => setNewOpen((o) => !o)}
            className='flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2.5 text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-100'
          >
            <Plus size={13} /> New community
          </button>
          {newOpen && (
            <div className='mt-3 space-y-2'>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='Name (e.g. JAMB Chemistry Class)'
                className='h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold outline-none focus:border-[#002EFF]/40'
              />
              <select
                value={newCategory}
                onChange={(e) => {
                  const cat = e.target.value as CourseCategory | ''
                  setNewCategory(cat)
                  if (cat && !newName.trim()) setNewName(categoryLabel(cat))
                }}
                className='h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-[12px] font-black outline-none'
              >
                <option value=''>No class/track (everyone)</option>
                {COURSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder='Subject (optional, e.g. Physics)'
                className='h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold outline-none focus:border-[#002EFF]/40'
              />
              <DeptChips value={newDepts} onChange={setNewDepts} />
              <button
                onClick={createChannel}
                disabled={!newName.trim()}
                className='h-10 w-full rounded-xl bg-[#002EFF] text-[10px] font-black uppercase text-white hover:bg-blue-700 disabled:opacity-50'
              >
                Create
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const membersPanel = (
    <div className='flex h-full flex-col'>
      <div className='flex items-center justify-between border-b border-slate-100 px-4 py-3'>
        <p className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500'>
          <Users size={13} /> Members · {members.length}
        </p>
        <button
          onClick={() => setMembersOpen(false)}
          className='rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
          aria-label='Close members'
        >
          <X size={15} />
        </button>
      </div>
      {members.length > 6 && (
        <div className='relative px-3 pt-3'>
          <Search size={13} className='absolute left-6 top-1/2 mt-1.5 -translate-y-1/2 text-zinc-400' />
          <input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder='Search members…'
            className='h-9 w-full rounded-xl bg-slate-50 pl-8 pr-2 text-[12px] font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#002EFF]/30'
          />
        </div>
      )}
      <div className='flex-1 space-y-3 overflow-y-auto p-3 custom-scrollbar'>
        {members.length === 0 ? (
          <p className='py-6 text-center text-[11px] font-medium text-slate-400'>
            No members to show yet.
          </p>
        ) : (
          (() => {
            const term = memberSearch.trim().toLowerCase()
            const shown = members.filter((m) =>
              term ? m.name.toLowerCase().includes(term) : true,
            )
            const onlineIds = new Set(online.map((o) => String(o.id)))
            const groups = [
              { label: 'Admins', rows: shown.filter((m) => m.role.toLowerCase().includes('admin')) },
              { label: 'Tutors', rows: shown.filter((m) => m.role.toLowerCase() === 'tutor') },
              { label: 'Students', rows: shown.filter((m) => m.role.toLowerCase() === 'student') },
            ].filter((g) => g.rows.length)
            if (!groups.length)
              return (
                <p className='py-6 text-center text-[11px] font-bold text-zinc-400'>
                  Nobody by that name.
                </p>
              )
            return groups.map((g) => (
              <div key={g.label}>
                <p className='px-2 pb-1 text-[9px] font-black uppercase tracking-widest text-zinc-300'>
                  {g.label} · {g.rows.length}
                </p>
                {g.rows.map((mem) => (
                  <div
                    key={mem.id}
                    className='flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50'
                  >
                    <span className='relative grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-100 text-[10px] font-black text-zinc-600'>
                      {mem.name.slice(0, 2).toUpperCase()}
                      {onlineIds.has(String(mem.id)) && (
                        <span
                          className='absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white'
                          title='Online now'
                        />
                      )}
                    </span>
                    <span className='min-w-0 flex-1 truncate text-[11px] font-bold text-zinc-700'>
                      {mem.name}
                      {mem.id === myId && <span className='ml-1 text-zinc-400'>(you)</span>}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${roleTint(mem.role)}`}>
                      {roleLabel(mem.role)}
                    </span>
                    {canManageMembers && mem.role.toLowerCase() === 'student' && (
                      <button
                        onClick={() => removeMember(mem.id)}
                        className='p-1 text-slate-300 hover:text-rose-500'
                        title='Remove from this community'
                      >
                        <UserMinus size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))
          })()
        )}
      </div>
    </div>
  )

  return (
    <div
      ref={shellRef}
      style={{
        ...(fillHeight ? { height: fillHeight } : {}),
        ...(bleed
          ? { marginLeft: -bleed.x, marginRight: -bleed.x, marginBottom: -bleed.bottom }
          : {}),
      }}
      className={`flex h-[calc(100dvh-8.5rem)] overflow-hidden bg-white ${
        bleed
          ? 'border-t border-slate-200'
          : 'rounded-3xl border border-slate-200 shadow-sm'
      }`}
    >
      {/* ── Pods list ──────────────────────────────────────────────────── */}
      <aside
        className={`w-full shrink-0 flex-col border-slate-200 md:flex md:w-64 md:border-r xl:w-72 ${
          pane === 'chat' ? 'hidden' : 'flex'
        }`}
      >
        <div className='flex items-start justify-between gap-2 px-4 pt-4 pb-2'>
          <div className='min-w-0'>
            <h2 className='text-[15px] font-black tracking-tight text-slate-900'>
              Scholars Chat Pods
            </h2>
            <p className='text-[10px] font-medium text-slate-400'>
              Telegram/WhatsApp style discussions
            </p>
          </div>
          <span className='mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-600'>
            <span className='h-1.5 w-1.5 rounded-full bg-emerald-500' /> Live
          </span>
        </div>

        <div className='px-3 pb-2'>
          <div className='relative'>
            <Search size={13} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' />
            <input
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              placeholder='Search pods…'
              className='h-9 w-full rounded-xl bg-slate-50 pl-8 pr-3 text-[12px] font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#002EFF]/30'
            />
          </div>
        </div>

        <div className='flex-1 overflow-y-auto custom-scrollbar'>
          {listed.length === 0 ? (
            <p className='px-4 py-8 text-center text-[11px] font-bold text-slate-400'>
              {channels.length === 0
                ? offline
                  ? 'Could not load the rooms. Retrying…'
                  : 'Loading rooms…'
                : 'No pod matches that.'}
            </p>
          ) : (
            listed.map((c) => {
              const on = c.id === activeChannel
              return (
                <button
                  key={c.id}
                  onClick={() => openChannel(c.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    on
                      ? 'bg-blue-50/70 md:border-l-2 md:border-[#002EFF]'
                      : 'hover:bg-slate-50 md:border-l-2 md:border-transparent'
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white ${podTint(c)}`}
                  >
                    {podIcon(c)}
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='flex items-center gap-2'>
                      <span className='min-w-0 flex-1 truncate text-[12px] font-black text-slate-800'>
                        {c.name}
                      </span>
                      <span className='shrink-0 text-[9px] font-medium text-slate-400'>
                        {rowTime(c.lastMessageAt)}
                      </span>
                    </span>
                    <span className='mt-0.5 flex items-center gap-2'>
                      <span className='min-w-0 flex-1 truncate text-[10px] font-medium text-slate-400'>
                        {c.lastMessageText
                          ? `${c.lastMessageSender ? `${c.lastMessageSender}: ` : ''}${c.lastMessageText}`
                          : 'No messages yet'}
                      </span>
                      {!on && !!c.unread && (
                        <span className='min-w-[18px] shrink-0 rounded-full bg-[#002EFF] px-1.5 py-0.5 text-center text-[9px] font-black tabular-nums text-white'>
                          {c.unread > 99 ? '99+' : c.unread}
                        </span>
                      )}
                      {c.muted && <BellOff size={10} className='shrink-0 text-slate-300' />}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>

        {isAdmin && (
          <div className='border-t border-slate-100 p-3'>
            <button
              onClick={() => {
                setNewOpen(true)
                setManageOpen(true)
              }}
              className='flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#002EFF] py-2.5 text-[10px] font-black uppercase text-white hover:bg-blue-700'
            >
              <Plus size={13} /> New room
            </button>
          </div>
        )}
      </aside>

      {/* ── Conversation ───────────────────────────────────────────────── */}
      <section
        className={`min-w-0 flex-1 flex-col md:flex ${pane === 'list' ? 'hidden' : 'flex'}`}
      >
        {/* Room header */}
        <div className='relative flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4'>
          <button
            onClick={() => setPane('list')}
            className='grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 md:hidden'
            aria-label='Back to pods'
          >
            <ArrowLeft size={18} />
          </button>
          <span
            className={`hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-white sm:grid ${podTint(active)}`}
          >
            {podIcon(active)}
          </span>
          <div className='min-w-0 flex-1'>
            <h2 className='truncate text-[13px] font-black text-slate-900 sm:text-[14px]'>
              {active.name}
            </h2>
            <p className='truncate text-[10px] font-medium text-slate-400'>
              {members.length} scholar{members.length === 1 ? '' : 's'} ·{' '}
              <span className='font-bold text-emerald-600'>
                {live && (
                  <span
                    className='mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle'
                    title='Live — new messages arrive on their own'
                    aria-label='Live'
                  />
                )}
                {online.length} online
              </span>
              {locked && <span className='ml-1 font-bold text-rose-500'>· locked</span>}
            </p>
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            <HeaderButton
              on={bellOpen}
              onClick={() => {
                setBellOpen((o) => !o)
                setMembersOpen(false)
                setSearchOpen(false)
              }}
              label='Alerts'
              badge={alertCount}
              className='sm:hidden'
            >
              <Bell size={15} />
            </HeaderButton>
            <HeaderButton
              on={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
              label='More'
              className='sm:hidden'
            >
              <MoreHorizontal size={15} />
            </HeaderButton>
            <div
              className={`${
                moreOpen ? 'flex' : 'hidden'
              } absolute right-2 top-[52px] z-30 items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg sm:static sm:flex sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
            >
            <HeaderButton
              on={membersOpen}
              onClick={() => {
                setMembersOpen((o) => !o)
                setBellOpen(false)
                setSearchOpen(false)
              }}
              label='Members'
            >
              <Users size={15} />
            </HeaderButton>
            <HeaderButton
              on={searchOpen}
              onClick={() => {
                if (searchOpen) closeSearch()
                else {
                  setSearchOpen(true)
                  setBellOpen(false)
                  setMembersOpen(false)
                }
              }}
              label='Search'
            >
              <Search size={15} />
            </HeaderButton>
            <HeaderButton
              on={bellOpen}
              onClick={() => {
                setBellOpen((o) => !o)
                setMembersOpen(false)
                setSearchOpen(false)
              }}
              label='Alerts'
              badge={alertCount}
              className='hidden sm:grid'
            >
              <Bell size={15} />
            </HeaderButton>
            {canManage && (
              <HeaderButton
                on={locked}
                onClick={toggleLock}
                label={locked ? 'Unlock' : 'Lock (lesson mode)'}
                tone='rose'
              >
                {locked ? <Lock size={15} /> : <Unlock size={15} />}
              </HeaderButton>
            )}
            {isAdmin && (
              <HeaderButton
                on={manageOpen}
                onClick={() => setManageOpen((o) => !o)}
                label='Manage'
                className='xl:hidden'
              >
                <SlidersHorizontal size={15} />
              </HeaderButton>
            )}
            </div>
          </div>
        </div>

        {/* Pinned strip */}
        {pinned.length > 0 && (
          <div className='flex items-center gap-2 border-b border-blue-100 bg-blue-50/60 px-3 py-1.5 sm:px-4'>
            <Pin size={12} className='shrink-0 text-[#002EFF]' />
            <p className='min-w-0 flex-1 truncate text-[11px] font-bold text-[#002EFF]'>
              Pinned: <span className='font-medium text-slate-700'>{previewText(pinned[pinned.length - 1])}</span>
              {pinned.length > 1 && (
                <span className='ml-1 text-slate-400'>+{pinned.length - 1}</span>
              )}
            </p>
            {canManage && (
              <button
                onClick={() => togglePin(pinned[pinned.length - 1])}
                className='shrink-0 text-slate-400 hover:text-rose-500'
                title='Unpin'
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {(notReady || offline) && !live && (
          <div className='flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2'>
            <AlertCircle size={14} className='mt-0.5 shrink-0 text-amber-600' />
            <p className='text-[11px] font-medium text-amber-700'>
              Could not reach the server just now. Check your connection — this page keeps
              retrying on its own.
            </p>
          </div>
        )}
        {locked && (
          <div className='flex items-center gap-2 border-b border-rose-100 bg-rose-50 px-4 py-2'>
            <Lock size={12} className='shrink-0 text-rose-500' />
            <p className='text-[11px] font-bold text-rose-600'>
              {canManage
                ? 'Lesson mode — students can’t post; you still can.'
                : 'Locked by a tutor. You can read but not post.'}
            </p>
          </div>
        )}

        {/* Messages, with the panels floating over them */}
        <div className='relative min-h-0 flex-1 bg-[#F4F6FB]'>
          {(membersOpen || bellOpen || searchOpen) && (
            <div className='absolute inset-x-2 top-2 z-30 max-h-[85%] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:inset-x-auto sm:right-3 sm:w-80'>
              {membersOpen && membersPanel}
              {bellOpen && (
                <div className='max-h-[70vh] overflow-y-auto p-3 custom-scrollbar'>
                  <div className='mb-2 flex items-center justify-between'>
                    <p className='text-[10px] font-black uppercase tracking-widest text-slate-400'>
                      Since you were last here
                    </p>
                    <button onClick={() => setBellOpen(false)} className='text-zinc-400 hover:text-zinc-600' aria-label='Close alerts'>
                      <X size={14} />
                    </button>
                  </div>
                  {channels.filter((c) => (c.unread || 0) > 0).length === 0 ? (
                    <p className='py-4 text-center text-[11px] font-bold text-zinc-400'>
                      You are all caught up.
                    </p>
                  ) : (
                    <div className='space-y-1.5'>
                      {channels
                        .filter((c) => (c.unread || 0) > 0)
                        .map((c) => (
                          <div key={c.id} className='flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2'>
                            <button
                              onClick={() => {
                                openChannel(c.id)
                                setBellOpen(false)
                              }}
                              className='min-w-0 flex-1 text-left'
                            >
                              <span className='flex items-center gap-1.5 text-[11px] font-black text-zinc-700'>
                                {c.name}
                                {!!c.mentions && (
                                  <span className='rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-700'>
                                    {c.mentions} mention{c.mentions === 1 ? '' : 's'}
                                  </span>
                                )}
                                {c.muted && <BellOff size={10} className='text-zinc-400' />}
                              </span>
                              <span className='mt-0.5 block truncate text-[10px] font-medium text-zinc-400'>
                                {c.unread} new
                                {c.lastMessageSender ? ` · ${c.lastMessageSender}: ${c.lastMessageText ?? ''}` : ''}
                              </span>
                            </button>
                            {c.muted ? (
                              <button onClick={() => setMute(c.id, 0)} className='shrink-0 rounded-lg bg-white px-2 py-1 text-[9px] font-black uppercase text-[#002EFF] hover:bg-blue-50'>
                                Unmute
                              </button>
                            ) : (
                              <span className='flex shrink-0 items-center gap-1'>
                                {[
                                  { label: '1h', minutes: 60 },
                                  { label: '8h', minutes: 480 },
                                  { label: 'Off', minutes: undefined },
                                ].map((opt) => (
                                  <button
                                    key={opt.label}
                                    onClick={() => setMute(c.id, opt.minutes)}
                                    title={opt.minutes ? `Mute for ${opt.label}` : 'Mute until you turn it back on'}
                                    className='rounded-lg bg-white px-2 py-1 text-[9px] font-black uppercase text-zinc-400 hover:text-[#002EFF]'
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                  <p className='pt-2 text-[9px] font-bold text-zinc-400'>
                    Muting keeps a channel quiet — it does not mark anything as read.
                  </p>
                </div>
              )}
              {searchOpen && (
                <div className='space-y-2 p-3'>
                  <div className='flex items-center gap-2'>
                    <div className='relative flex-1'>
                      <Search size={13} className='absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400' />
                      <input
                        autoFocus
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') runSearch()
                          if (e.key === 'Escape') closeSearch()
                        }}
                        placeholder='Search messages, files…'
                        className='h-9 w-full rounded-xl bg-zinc-50 pl-8 pr-3 text-[13px] font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[#002EFF]/30'
                      />
                    </div>
                    <button
                      onClick={runSearch}
                      disabled={searchTerm.trim().length < 2 || searching}
                      className='h-9 rounded-xl bg-[#002EFF] px-3 text-[10px] font-black uppercase text-white disabled:opacity-40'
                    >
                      {searching ? <Loader2 size={13} className='animate-spin' /> : 'Find'}
                    </button>
                    <button onClick={closeSearch} className='grid h-9 w-9 place-items-center rounded-xl text-zinc-400 hover:bg-zinc-100' aria-label='Close search'>
                      <X size={14} />
                    </button>
                  </div>
                  <div className='flex items-center gap-1'>
                    {(['all', 'files', 'links'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSearchScope(s)}
                        className={`h-7 rounded-lg px-2.5 text-[10px] font-black uppercase ${
                          searchScope === s ? 'bg-blue-50 text-[#002EFF]' : 'text-zinc-400 hover:text-zinc-600'
                        }`}
                      >
                        {s === 'all' ? 'Messages' : s}
                      </button>
                    ))}
                  </div>
                  {searchHits && (
                    <div className='max-h-72 space-y-1.5 overflow-y-auto custom-scrollbar'>
                      {searchHits.length === 0 ? (
                        <p className='py-4 text-center text-[11px] font-bold text-zinc-400'>
                          Nothing matched “{searchTerm.trim()}”.
                        </p>
                      ) : (
                        searchHits.map((h) => {
                          const where = searchChannel[h.id] || 'general'
                          const channelName = channels.find((c) => c.id === where)?.name || where
                          return (
                            <button
                              key={h.id}
                              onClick={() => {
                                openChannel(where)
                                closeSearch()
                              }}
                              className='w-full rounded-xl bg-zinc-50 px-3 py-2 text-left hover:bg-blue-50/60'
                            >
                              <span className='flex items-center gap-1.5 text-[10px] font-black text-[#002EFF]'>
                                {channelName}
                                <span className='font-bold text-zinc-400'>
                                  · {h.senderName} · {new Date(h.createdAt).toLocaleDateString()}
                                </span>
                              </span>
                              <span className='mt-0.5 block text-[12px] font-medium text-zinc-700 line-clamp-2'>
                                {previewText(h)}
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget
              setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
            }}
            className='h-full space-y-3 overflow-y-auto px-3 py-4 custom-scrollbar sm:px-5'
          >
            {loading ? (
              <div className='flex h-full items-center justify-center'>
                <Loader2 className='animate-spin text-[#002EFF]' size={28} />
              </div>
            ) : messages.length === 0 ? (
              <div className='flex h-full flex-col items-center justify-center px-6 text-center'>
                <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm'>
                  <Send size={20} className='text-[#002EFF]' />
                </div>
                <p className='text-sm font-bold text-zinc-700'>No messages yet</p>
                <p className='mt-1 text-[11px] font-medium text-zinc-400'>
                  {canCompose ? 'Be the first to say hello 👋' : 'Messages from tutors and students will show here.'}
                </p>
              </div>
            ) : (
              <>
              {!olderDone && messages.length >= PAGE_SIZE && (
                <div className='flex justify-center pb-1'>
                  <button
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    className='inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[10px] font-black uppercase tracking-wide text-[#002EFF] shadow-sm ring-1 ring-zinc-200 hover:bg-blue-50 disabled:opacity-60'
                  >
                    {loadingOlder ? <Loader2 size={12} className='animate-spin' /> : <ChevronUp size={12} />}
                    Load earlier messages
                  </button>
                </div>
              )}
              {(() => {
                let lastDay = ''
                let dividerPlaced = false
                return messages.map((m, i) => {
                  const day = dayKey(m.createdAt)
                  const newDay = day !== lastDay
                  lastDay = day
                  const prev = messages[i - 1]
                  const grouped =
                    !newDay &&
                    !!prev &&
                    prev.senderId === m.senderId &&
                    !m.replyTo &&
                    m.createdAt - prev.createdAt < 5 * 60 * 1000
                  const firstUnread = !dividerPlaced && !!newSince && m.createdAt > newSince && !m.own
                  if (firstUnread) dividerPlaced = true
                  return (
                    <Fragment key={m.id}>
                      {newDay && (
                        <div className='flex items-center justify-center py-1'>
                          <span className='rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-500 shadow-sm'>
                            {dayLabel(m.createdAt)}
                          </span>
                        </div>
                      )}
                      {firstUnread && (
                        <div className='flex items-center gap-2 py-0.5'>
                          <span className='h-px flex-1 bg-[#002EFF]/30' />
                          <span className='text-[9px] font-black uppercase tracking-widest text-[#002EFF]'>New messages</span>
                          <span className='h-px flex-1 bg-[#002EFF]/30' />
                        </div>
                      )}
                      <MessageBubble
                        m={m}
                        grouped={grouped}
                        showDelete={isModerator || m.own}
                        canEdit={m.own && m.type === 'text'}
                        canPin={canManage}
                        onDelete={() => remove(m.id)}
                        onEdit={(newText) => editMessage(m.id, newText)}
                        onPin={() => togglePin(m)}
                        onVote={(option) => votePoll(m.id, option)}
                        onSeen={() => loadReads(m.id)}
                        canReply={canCompose && !postingBlocked}
                        onReply={() => setReplyTarget(m)}
                        onReact={(emoji) => react(m.id, emoji)}
                      />
                    </Fragment>
                  )
                })
              })()}
              </>
            )}
          </div>

          {!atBottom && messages.length > 0 && (
            <button
              onClick={jumpToLatest}
              className='absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#002EFF] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg hover:bg-blue-700'
            >
              <ChevronDown size={13} /> Latest
            </button>
          )}
        </div>

        {typingNames.length > 0 && (
          <p className='flex items-center gap-1.5 px-4 pt-1.5 text-[11px] font-bold text-[#002EFF]'>
            <span className='flex gap-0.5' aria-hidden>
              {[0, 150, 300].map((d) => (
                <span key={d} className='h-1 w-1 animate-bounce rounded-full bg-[#002EFF]' style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
            {typingNames.length === 1
              ? `${typingNames[0]} is typing…`
              : typingNames.length === 2
                ? `${typingNames[0]} and ${typingNames[1]} are typing…`
                : `${typingNames.length} people are typing…`}
          </p>
        )}

        {error && <p className='px-4 pt-2 text-[11px] font-semibold text-rose-600'>{error}</p>}

        {/* Composer */}
        {postingBlocked ? (
          <div className='border-t border-slate-100 p-3'>
            <div className='flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-[11px] font-bold text-zinc-500'>
              <Lock size={14} className='shrink-0 text-zinc-400' />
              The community is locked. Only tutors can post right now.
            </div>
          </div>
        ) : canCompose ? (
          <div className='border-t border-slate-100 p-2.5 sm:p-3'>
            {replyTarget && !recording && (
              <div className='mb-2 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2'>
                <span className='w-0.5 self-stretch rounded-full bg-[#002EFF]' />
                <div className='min-w-0 flex-1'>
                  <p className='text-[10px] font-black uppercase tracking-wide text-[#002EFF]'>
                    Replying to {replyTarget.own ? 'yourself' : replyTarget.senderName}
                  </p>
                  <p className='truncate text-[11px] font-medium text-zinc-500'>{previewText(replyTarget)}</p>
                </div>
                <button onClick={() => setReplyTarget(null)} className='shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-white hover:text-zinc-700' aria-label='Cancel reply'>
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Subject symbols — the ΔH / ∫ row from the design, one tap to insert */}
            {!recording && (
              <div className='mb-2 flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar'>
                <span className='shrink-0 pr-1 text-[8px] font-black uppercase tracking-widest text-slate-400'>
                  Insert
                </span>
                {SYMBOLS.map((s) => (
                  <button
                    key={s}
                    type='button'
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertSymbol(s)}
                    className='h-7 shrink-0 rounded-lg bg-slate-100 px-2 font-mono text-[12px] font-bold text-slate-600 hover:bg-blue-50 hover:text-[#002EFF]'
                    aria-label={`Insert ${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {recording ? (
              <div className='flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3'>
                <span className='h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500' />
                <span className='text-xs font-black tabular-nums text-rose-600'>
                  Recording {duration(recSecs) || '0:00'}
                </span>
                <div className='ml-auto flex items-center gap-2'>
                  <button onClick={cancelRecording} className='rounded-lg px-3 py-1.5 text-[11px] font-bold text-zinc-500 hover:bg-white'>
                    Cancel
                  </button>
                  <button onClick={stopRecording} className='flex items-center gap-1.5 rounded-lg bg-[#002EFF] px-3 py-1.5 text-[11px] font-bold text-white'>
                    <Send size={12} /> Send
                  </button>
                </div>
              </div>
            ) : (
              <div className='relative flex items-end gap-2'>
                {mentionQuery !== null && mentionOptions.length > 0 && (
                  <div className='absolute bottom-14 left-0 z-30 w-64 rounded-2xl border border-zinc-200 bg-white p-1 shadow-xl'>
                    {mentionOptions.map((o) => (
                      <button
                        key={o.id}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          pickMention(o)
                        }}
                        className='flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-blue-50'
                      >
                        <span className='grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-zinc-100 text-[9px] font-black text-zinc-600'>
                          {o.id === '@everyone' ? '@' : o.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className='min-w-0 flex-1 truncate text-[12px] font-bold text-zinc-700'>{o.name}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${o.id === '@everyone' ? 'bg-amber-50 text-amber-600' : roleTint(o.role)}`}>
                          {o.id === '@everyone' ? 'All' : roleLabel(o.role)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {pollOpen && (
                  <div className='absolute bottom-14 left-0 right-0 z-20 space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl'>
                    <div className='flex items-center justify-between'>
                      <p className='flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-zinc-500'>
                        <BarChart3 size={13} className='text-[#002EFF]' /> New poll
                      </p>
                      <button onClick={() => setPollOpen(false)} className='text-zinc-400 hover:text-rose-500' aria-label='Close poll composer'>
                        <X size={15} />
                      </button>
                    </div>
                    <input
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder='Ask a question…'
                      className='h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-[13px] font-bold outline-none focus:border-[#002EFF]/40'
                    />
                    <div className='space-y-1.5'>
                      {pollOptions.map((o, i) => (
                        <div key={i} className='flex items-center gap-2'>
                          {pollIsQuiz && (
                            <input type='radio' name='poll-correct' checked={pollCorrect === i} onChange={() => setPollCorrect(i)} title='Mark as the correct answer' className='shrink-0 accent-emerald-600' />
                          )}
                          <input
                            value={o}
                            onChange={(e) => setPollOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))}
                            placeholder={`Option ${i + 1}`}
                            className='h-9 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-[12px] font-medium outline-none focus:border-[#002EFF]/40'
                          />
                          {pollOptions.length > 2 && (
                            <button onClick={() => setPollOptions((prev) => prev.filter((_, idx) => idx !== i))} className='shrink-0 text-zinc-300 hover:text-rose-500' aria-label={`Remove option ${i + 1}`}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 10 && (
                        <button onClick={() => setPollOptions((prev) => [...prev, ''])} className='inline-flex items-center gap-1 text-[10px] font-black uppercase text-[#002EFF] hover:underline'>
                          <Plus size={11} /> Add option
                        </button>
                      )}
                    </div>
                    <label className='flex cursor-pointer items-center gap-2'>
                      <input type='checkbox' checked={pollIsQuiz} onChange={(e) => setPollIsQuiz(e.target.checked)} className='h-4 w-4 accent-[#002EFF]' />
                      <span className='text-[11px] font-bold text-zinc-600'>Mark as a quiz (reveals the answer after voting)</span>
                    </label>
                    <button
                      onClick={sendPoll}
                      disabled={sending}
                      className='flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#002EFF] text-[11px] font-black uppercase tracking-wide text-white transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50'
                    >
                      {sending ? <Loader2 size={14} className='animate-spin' /> : <Send size={14} />}
                      Post poll
                    </button>
                  </div>
                )}

                <div className='relative'>
                  <button
                    type='button'
                    onClick={() => setAttachOpen((o) => !o)}
                    disabled={busy}
                    className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-blue-200 hover:text-[#002EFF] disabled:opacity-50'
                    aria-label='Attach'
                  >
                    {uploading ? <Loader2 size={18} className='animate-spin' /> : <Plus size={18} />}
                  </button>
                  {attachOpen && (
                    <div className='absolute bottom-14 left-0 z-10 w-44 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl'>
                      <AttachItem icon={ImageIcon} label='Photo' onClick={() => imageInput.current?.click()} />
                      <AttachItem icon={VideoIcon} label='Video' onClick={() => videoInput.current?.click()} />
                      <AttachItem icon={FileText} label='Document' onClick={() => docInput.current?.click()} />
                      {canManage && (
                        <AttachItem
                          icon={BarChart3}
                          label='Poll'
                          onClick={() => {
                            setAttachOpen(false)
                            setPollOpen(true)
                          }}
                        />
                      )}
                      {canRecord && (
                        <AttachItem
                          icon={Mic}
                          label='Voice note'
                          onClick={() => {
                            setAttachOpen(false)
                            startRecording()
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                <textarea
                  ref={composerRef}
                  rows={1}
                  value={text}
                  onChange={(e) => {
                    const v = e.target.value
                    setText(v)
                    noteTyping()
                    const at = v.match(/@([\w' -]{0,30})$/)
                    setMentionQuery(at ? at[1] : null)
                  }}
                  onBlur={stopTyping}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setMentionQuery(null)
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (mentionQuery !== null && mentionOptions.length) {
                        pickMention(mentionOptions[0])
                        return
                      }
                      sendText()
                    }
                  }}
                  placeholder='Type a message…'
                  className='max-h-32 flex-1 resize-none rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#002EFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002EFF]/10'
                />

                {canRecord && !text.trim() ? (
                  <button type='button' onClick={startRecording} disabled={busy} className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#002EFF] text-white transition-colors hover:bg-blue-700 disabled:opacity-50' aria-label='Record voice note'>
                    <Mic size={18} />
                  </button>
                ) : (
                  <button type='button' onClick={sendText} disabled={busy || !text.trim()} className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#002EFF] text-white transition-colors hover:bg-blue-700 disabled:opacity-40' aria-label='Send'>
                    {sending ? <Loader2 size={18} className='animate-spin' /> : <Send size={18} />}
                  </button>
                )}
              </div>
            )}

            <input ref={imageInput} type='file' accept='image/*' hidden onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'image')} />
            <input ref={videoInput} type='file' accept='video/*' hidden onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'video')} />
            <input
              ref={docInput}
              type='file'
              accept='.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              hidden
              onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'file')}
            />
          </div>
        ) : null}
      </section>

      {/* ── Management (admin) ─────────────────────────────────────────── */}
      {isAdmin && (
        <>
          <aside className='hidden w-72 shrink-0 border-l border-slate-200 xl:flex xl:flex-col'>
            {managePanel}
          </aside>
          {manageOpen && (
            <div className='fixed inset-0 z-50 xl:hidden'>
              <button
                className='absolute inset-0 bg-slate-900/40'
                onClick={() => setManageOpen(false)}
                aria-label='Close management'
              />
              <div className='absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl'>
                {managePanel}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** One of the icon buttons in the room header. */
function HeaderButton({
  on,
  onClick,
  label,
  badge,
  tone,
  className = '',
  children,
}: {
  on?: boolean
  onClick: () => void
  label: string
  badge?: number
  tone?: 'rose'
  className?: string
  children: React.ReactNode
}) {
  const active =
    tone === 'rose' ? 'bg-rose-50 text-rose-600' : 'bg-[#002EFF] text-white'
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={!!on}
      className={`relative h-9 w-9 place-items-center rounded-xl transition-colors ${
        on ? active : 'text-slate-500 hover:bg-slate-100 hover:text-[#002EFF]'
      } ${className.includes('hidden') ? className : `grid ${className}`}`}
    >
      {children}
      {!!badge && (
        <span className='absolute -right-0.5 -top-0.5 min-w-[15px] rounded-full bg-rose-500 px-1 text-[8px] font-black tabular-nums text-white'>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

/** One touch-sized action under a message on a phone. */
function ActionChip({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  onClick: () => void
  tone?: 'rose'
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[11px] font-black shadow-sm ring-1 ring-zinc-200 active:scale-95 ${
        tone === 'rose' ? 'text-rose-600' : 'text-zinc-700'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  )
}

function AttachItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[13px] font-semibold text-zinc-700 hover:bg-blue-50 hover:text-[#002EFF] transition-colors'
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

function MessageBubble({
  m,
  grouped,
  showDelete,
  canEdit,
  canPin,
  onDelete,
  onEdit,
  onPin,
  onVote,
  onSeen,
  canReply,
  onReply,
  onReact,
}: {
  m: Msg
  /** Follows another message from the same person, moments earlier. */
  grouped: boolean
  showDelete: boolean
  canEdit: boolean
  canPin: boolean
  onDelete: () => void
  onEdit: (newText: string) => void
  onPin: () => void
  onVote: (option: number) => void
  onSeen: () => Promise<{ fullname: string }[]>
  canReply: boolean
  onReply: () => void
  onReact: (emoji: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m.text ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  // Phones have no hover, so the icon row that appears on desktop never shows.
  // There, tapping the bubble opens a bar of touch-sized actions instead.
  const [actionsOpen, setActionsOpen] = useState(false)
  const closeActions = () => setActionsOpen(false)
  // "Seen by" — names are fetched only when the sender taps the row.
  const [seen, setSeen] = useState<{ fullname: string }[] | null>(null)
  const [seenLoading, setSeenLoading] = useState(false)
  const toggleSeen = async () => {
    if (seen) return setSeen(null)
    setSeenLoading(true)
    try {
      setSeen(await onSeen())
    } catch {
      setSeen([])
    } finally {
      setSeenLoading(false)
    }
  }

  const initials = m.senderName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const saveEdit = () => {
    const t = draft.trim()
    setEditing(false)
    if (t && t !== m.text) onEdit(t)
  }

  return (
    <div
      className={`flex gap-2 group sm:gap-2.5 ${m.own ? 'flex-row-reverse' : ''} ${
        grouped ? '-mt-1.5' : ''
      }`}
    >
      {/* Avatar: only for other people, and only on the first of a run */}
      {m.own ? null : grouped ? (
        <div className='h-8 w-8 shrink-0' aria-hidden />
      ) : (
        <div className='grid h-8 w-8 shrink-0 place-items-center self-end rounded-xl bg-white text-[10px] font-black text-zinc-600 shadow-sm ring-1 ring-zinc-200'>
          {initials || '?'}
        </div>
      )}

      <div className={`max-w-[85%] sm:max-w-[76%] ${m.own ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Name, role, time and the hover actions */}
        <div className={`mb-0.5 flex items-center gap-2 px-1 ${m.own ? 'flex-row-reverse' : ''}`}>
          {!grouped && (
            <>
              <span className={`text-[11px] font-black ${m.own ? 'text-[#002EFF]' : 'text-zinc-800'}`}>
                {m.own ? `${m.senderName} (You)` : m.senderName}
              </span>
              {!m.own && (
                <span
                  className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${roleTint(
                    m.senderRole,
                  )}`}
                >
                  {roleLabel(m.senderRole)}
                </span>
              )}
            </>
          )}
          <span className='font-mono text-[9px] font-medium text-zinc-400'>
            {clock(m.createdAt)}
          </span>
          {m.pinned && (
            <Pin size={11} className='text-[#002EFF] fill-[#002EFF]/20' />
          )}
          <span className='hidden items-center gap-1.5 sm:flex'>
            <span className='relative'>
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className={`transition-opacity text-zinc-300 hover:text-[#002EFF] ${
                  pickerOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                aria-label='React to message'
                aria-expanded={pickerOpen}
              >
                <SmilePlus size={12} />
              </button>
              {pickerOpen && (
                <>
                  <button
                    className='fixed inset-0 z-10 cursor-default'
                    onClick={() => setPickerOpen(false)}
                    aria-label='Close reactions'
                    tabIndex={-1}
                  />
                  <span
                    className={`absolute z-20 top-5 flex items-center gap-0.5 rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg ${
                      m.own ? 'right-0' : 'left-0'
                    }`}
                  >
                    {REACTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => {
                          setPickerOpen(false)
                          onReact(e)
                        }}
                        className='h-8 w-8 rounded-xl text-base leading-none hover:bg-zinc-100 active:scale-90 transition-transform'
                        aria-label={`React ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </span>
                </>
              )}
            </span>
            {canReply && (
              <button
                onClick={onReply}
                className='opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-[#002EFF]'
                aria-label='Reply to message'
              >
                <Reply size={12} />
              </button>
            )}
            {canPin && (
              <button
                onClick={onPin}
                className='opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-[#002EFF]'
                title={m.pinned ? 'Unpin' : 'Pin'}
              >
                <Pin size={12} />
              </button>
            )}
            {canEdit && !editing && (
              <button
                onClick={() => {
                  setDraft(m.text ?? '')
                  setEditing(true)
                }}
                className='opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-[#002EFF]'
                title='Edit'
              >
                <Pencil size={12} />
              </button>
            )}
            {showDelete && (
              <button
                onClick={onDelete}
                className='opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-rose-500'
                aria-label='Delete message'
              >
                <Trash2 size={12} />
              </button>
            )}
          </span>
        </div>

        <div
          onClick={(e) => {
            const t = e.target as HTMLElement
            if (t.closest('button, a, input, textarea, video, audio, img')) return
            setActionsOpen((v) => !v)
          }}
          className={`max-w-full overflow-hidden rounded-2xl ${
            m.own ? 'rounded-br-md' : 'rounded-bl-md'
          } ${m.mentionedMe && !m.own ? 'ring-2 ring-[#FCB900]' : ''} ${
            m.type === 'text'
              ? m.own
                ? 'bg-[#0B2E8A] px-4 py-2.5 text-white shadow-sm'
                : 'bg-white px-4 py-2.5 text-zinc-800 shadow-sm ring-1 ring-zinc-200/70'
              : m.type === 'poll'
                ? 'min-w-[250px] bg-white p-3 shadow-sm ring-1 ring-zinc-200/70'
                : 'bg-white p-1.5 shadow-sm ring-1 ring-zinc-200/70'
          }`}
        >
          {/* Quoted message — what this one is answering */}
          {m.replyTo && (
            <div
              className={`mb-2 flex gap-2 rounded-xl px-2.5 py-1.5 ${
                m.type === 'text' && m.own
                  ? 'bg-white/15'
                  : 'bg-zinc-50 border border-zinc-100'
              }`}
            >
              <span
                className={`w-0.5 shrink-0 rounded-full ${
                  m.type === 'text' && m.own ? 'bg-white/60' : 'bg-[#002EFF]'
                }`}
              />
              <span className='block min-w-0 flex-1'>
                <span
                  className={`block text-[10px] font-black ${
                    m.type === 'text' && m.own ? 'text-white/80' : 'text-[#002EFF]'
                  }`}
                >
                  {m.replyTo.senderName}
                </span>
                <span
                  className={`block text-[11px] font-medium truncate ${
                    m.type === 'text' && m.own ? 'text-white/70' : 'text-zinc-500'
                  }`}
                >
                  {previewText(m.replyTo)}
                </span>
              </span>
            </div>
          )}

          {m.type === 'poll' && m.poll && (
            <div className='space-y-2'>
              <div className='flex items-start gap-1.5'>
                <BarChart3
                  size={14}
                  className='text-[#002EFF] mt-0.5 shrink-0'
                  aria-hidden
                />
                <p className='text-[13px] font-black text-zinc-800 leading-snug break-words'>
                  {m.poll.question}
                </p>
              </div>
              {m.poll.isQuiz && (
                <span className='inline-block text-[8px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded'>
                  Quiz
                </span>
              )}
              <div className='space-y-1.5'>
                {m.poll.options.map((o) => {
                  const total = m.poll?.totalVotes ?? 0
                  const share = total ? Math.round((o.votes / total) * 100) : 0
                  const answered = m.poll?.myVote != null
                  const correct = m.poll?.correctOption
                  const isCorrect = correct != null && correct === o.index
                  const wrongPick = o.voted && correct != null && !isCorrect
                  return (
                    <button
                      key={o.index}
                      onClick={() => onVote(o.index)}
                      disabled={m.poll?.closed}
                      className={`relative w-full text-left rounded-xl px-2.5 py-2 text-[12px] font-bold overflow-hidden border transition-colors disabled:cursor-not-allowed ${
                        isCorrect && answered
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : wrongPick
                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                            : o.voted
                              ? 'border-[#002EFF] bg-blue-50 text-[#002EFF]'
                              : 'border-zinc-200 bg-white text-zinc-700 hover:border-[#002EFF]/40'
                      }`}
                    >
                      {answered && (
                        <span
                          aria-hidden
                          className='absolute inset-y-0 left-0 bg-current opacity-10'
                          style={{ width: `${share}%` }}
                        />
                      )}
                      <span className='relative flex items-center justify-between gap-2'>
                        <span className='truncate'>{o.text}</span>
                        {answered && (
                          <span className='tabular-nums shrink-0'>{share}%</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className='text-[10px] font-bold text-zinc-400 tabular-nums'>
                {m.poll.totalVotes} vote{m.poll.totalVotes === 1 ? '' : 's'}
                {m.poll.closed ? ' · closed' : ''}
              </p>
            </div>
          )}

          {m.type === 'text' &&
            (editing ? (
              <div className='min-w-[220px]'>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      saveEdit()
                    }
                    if (e.key === 'Escape') setEditing(false)
                  }}
                  autoFocus
                  rows={2}
                  className='w-full resize-none rounded-lg bg-white/90 text-zinc-800 text-[13px] p-2 outline-none'
                />
                <div className='flex items-center gap-2 mt-1 justify-end'>
                  <button
                    onClick={() => setEditing(false)}
                    className='text-[11px] font-bold text-white/70 hover:text-white'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className='flex items-center gap-1 text-[11px] font-black text-white'
                  >
                    <Check size={12} /> Save
                  </button>
                </div>
              </div>
            ) : (
              <p className='text-[13px] leading-relaxed whitespace-pre-wrap break-words'>
                {withMentions(m.text ?? '', m.own)}
              </p>
            ))}

          {m.type === 'image' && m.fileUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.fileUrl}
              alt={m.fileName || 'image'}
              className='rounded-xl max-h-72 w-auto object-cover cursor-pointer'
              onClick={() => window.open(m.fileUrl, '_blank')}
            />
          )}

          {m.type === 'video' && m.fileUrl && (
            <video
              src={m.fileUrl}
              controls
              className='rounded-xl max-h-72 w-full'
            />
          )}

          {m.type === 'audio' && m.fileUrl && (
            <div className='flex items-center gap-2 px-2 py-1 min-w-[220px]'>
              <audio src={m.fileUrl} controls className='w-full h-9' />
              {m.durationSec ? (
                <span className='text-[10px] font-bold text-zinc-400 tabular-nums'>
                  {duration(m.durationSec)}
                </span>
              ) : null}
            </div>
          )}

          {m.type === 'file' && m.fileUrl && (
            <a
              href={m.fileUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-3 px-3 py-2.5 min-w-[220px] hover:bg-blue-50/50 rounded-xl transition-colors'
            >
              <div className='h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0'>
                <FileText size={16} className='text-[#002EFF]' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='text-[12px] font-bold text-zinc-800 truncate'>
                  {m.fileName || 'Document'}
                </p>
                <p className='text-[10px] font-medium text-zinc-400'>
                  {humanSize(m.fileSize) || 'Open'}
                </p>
              </div>
              <Download size={15} className='text-zinc-400 shrink-0' />
            </a>
          )}
        </div>

        {/* Phone actions — opened by tapping the bubble */}
        {actionsOpen && !editing && (
          <div
            className={`mt-1.5 flex max-w-full flex-col gap-1.5 sm:hidden ${
              m.own ? 'items-end' : 'items-start'
            }`}
          >
            <div className='flex gap-0.5 rounded-2xl bg-white p-1 shadow-md ring-1 ring-zinc-200'>
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    closeActions()
                    onReact(e)
                  }}
                  className='h-9 w-9 rounded-xl text-lg leading-none active:scale-90'
                  aria-label={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className='flex flex-wrap gap-1.5'>
              {canReply && (
                <ActionChip icon={Reply} label='Reply' onClick={() => { closeActions(); onReply() }} />
              )}
              {canPin && (
                <ActionChip icon={Pin} label={m.pinned ? 'Unpin' : 'Pin'} onClick={() => { closeActions(); onPin() }} />
              )}
              {canEdit && (
                <ActionChip
                  icon={Pencil}
                  label='Edit'
                  onClick={() => {
                    closeActions()
                    setDraft(m.text ?? '')
                    setEditing(true)
                  }}
                />
              )}
              {showDelete && (
                <ActionChip icon={Trash2} label='Delete' tone='rose' onClick={() => { closeActions(); onDelete() }} />
              )}
              <ActionChip icon={X} label='Close' onClick={closeActions} />
            </div>
          </div>
        )}

        {/* Reactions — tap a chip to join it, tap again to take yours back */}
        {m.reactions.length > 0 && (
          <div
            className={`mt-1 flex flex-wrap gap-1 ${
              m.own ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(r.emoji)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black tabular-nums transition-colors active:scale-95 ${
                  r.mine
                    ? 'border-[#002EFF] bg-blue-50 text-[#002EFF]'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                }`}
                aria-label={`${r.emoji} ${r.count}`}
                aria-pressed={r.mine}
              >
                <span className='text-[13px] leading-none'>{r.emoji}</span>
                {r.count}
              </button>
            ))}
          </div>
        )}

        {/* Ticks — one for delivered, two in blue once someone has read it */}
        {m.own && (
          <div className='mt-0.5 px-1'>
            <button
              onClick={toggleSeen}
              className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide transition-colors hover:text-[#002EFF] ${
                m.readCount > 0 ? 'text-[#002EFF]' : 'text-zinc-400'
              }`}
              title={m.readCount > 0 ? `Seen by ${m.readCount}` : 'Delivered'}
            >
              {seenLoading ? (
                <Loader2 size={10} className='animate-spin' />
              ) : m.readCount > 0 ? (
                <CheckCheck size={13} />
              ) : (
                <Check size={13} />
              )}
              {m.readCount > 0 && <span>{m.readCount}</span>}
            </button>
            {seen && (
              <p className='mt-0.5 text-[10px] font-medium text-zinc-500 max-w-[220px] break-words'>
                {seen.length
                  ? seen.map((s) => s.fullname).join(', ')
                  : 'No one yet'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
