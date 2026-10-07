// // Weekly timetable — shared constants, a default template, and a browser-local
// // store so admin/tutor edits are seen by students (demo/offline fallback).
// //
// // Timetables are keyed by PROGRAMME, and by DEPARTMENT for secondary programmes:
// //   waec-science | waec-art | waec-commercial
// //   afterschool-science | afterschool-art | afterschool-commercial
// //   jamb | postutme | undergrad | preclinical
// //
// // A single period holds UP TO TWO subjects (a `Cell`), so JAMB students who take
// // Biology instead of Physics can share the same slot.

// import type { ExamTrack, Department } from './studentProfile'

// export const DAYS = [
//   'Monday',
//   'Tuesday',
//   'Wednesday',
//   'Thursday',
//   'Friday',
//   'Saturday',
// ] as const

// export const SLOTS = [
//   { label: 'Period 1', time: '8:00 – 9:30' },
//   { label: 'Period 2', time: '9:45 – 11:15' },
//   { label: 'Period 3', time: '11:30 – 1:00' },
//   { label: 'Period 4', time: '2:00 – 3:30' },
// ] as const

// const CLASS_MINUTES = 90

// /** A period's label + start/end times (24h "HH:MM"), editable per timetable. */
// export type Slot = { label: string; start: string; end: string }

// /** Frontend defaults, mirroring the backend Timetable.DEFAULT_SLOTS. */
// export const DEFAULT_SLOTS: Slot[] = [
//   { label: 'Period 1', start: '08:00', end: '09:30' },
//   { label: 'Period 2', start: '09:45', end: '11:15' },
//   { label: 'Period 3', start: '11:30', end: '13:00' },
//   { label: 'Period 4', start: '14:00', end: '15:30' },
// ]

// /** "HH:MM" → minutes since midnight, or null if malformed. */
// export function parseHM(hm: string): number | null {
//   const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? '').trim())
//   if (!m) return null
//   const h = Number(m[1])
//   const mm = Number(m[2])
//   if (h > 23 || mm > 59) return null
//   return h * 60 + mm
// }

// /** minutes-since-midnight → "4:00 PM" (12-hour, AM/PM). */
// export function fmt12(mins: number): string {
//   let h = Math.floor(mins / 60)
//   const m = mins % 60
//   const ap = h >= 12 ? 'PM' : 'AM'
//   h %= 12
//   if (h === 0) h = 12
//   return `${h}:${String(m).padStart(2, '0')} ${ap}`
// }

// /** A slot's time range with AM/PM, e.g. "4:00 PM – 5:30 PM". */
// export function slotTimeLabel(slot: Slot): string {
//   const s = parseHM(slot.start)
//   const e = parseHM(slot.end)
//   if (s == null || e == null) return `${slot.start} – ${slot.end}`
//   return `${fmt12(s)} – ${fmt12(e)}`
// }

// /** Coerce fetched slots into a clean Slot[] (defaults fill any gaps). */
// export function slotsFromApi(raw: unknown): Slot[] {
//   const src = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
//   return DEFAULT_SLOTS.map((def, i) => {
//     const s = src[i] && typeof src[i] === 'object' ? src[i] : {}
//     const start = parseHM(String(s.start ?? '')) != null ? String(s.start) : def.start
//     const end = parseHM(String(s.end ?? '')) != null ? String(s.end) : def.end
//     const label = String(s.label ?? '').trim() || def.label
//     return { label, start, end }
//   })
// }

// // Programmes whose timetable is split by department (Science / Art / Commercial).
// // JAMB & Post-UTME are included so each department gets its own timetable.
// const DEPT_SPLIT: ExamTrack[] = ['waec', 'afterschool', 'jamb', 'postutme']

// /**
//  * The backend timetable key for a student's programme (+ department). Secondary
//  * programmes are per-department; everything else is keyed by the programme.
//  * Falls back to `science` when a department-split programme has no department.
//  */
// export function timetableKey(
//   track: ExamTrack,
//   department?: Department | null,
// ): string {
//   if (DEPT_SPLIT.includes(track)) return `${track}-${department ?? 'science'}`
//   return track
// }

// // Representative subjects used to seed a template. JAMB & Post-UTME are
// // subject-based; WAEC/after-school are department-based.
// const SUBJECTS: Record<string, string[]> = {
//   jamb: ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics'],
//   science: ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Further Maths'],
//   art: ['English', 'Mathematics', 'Literature', 'Government', 'History', 'CRS'],
//   commercial: ['English', 'Mathematics', 'Economics', 'Commerce', 'Accounting', 'Government'],
// }

// function subjectsFor(track: ExamTrack, department: Department | null): string[] {
//   if (DEPT_SPLIT.includes(track)) return SUBJECTS[department ?? 'science']
//   return SUBJECTS.jamb
// }

// /** A period holds up to three subjects (parallel courses). */
// export type Cell = string[]
// /** A grid is rows (periods) × columns (days); each cell is a `Cell`. */
// export type TimetableGrid = Cell[][]

// /** Coerce any backend cell (array | string | null) into a clean `Cell` (≤2). */
// function toCell(raw: unknown): Cell {
//   if (Array.isArray(raw)) {
//     return raw
//       .map((s) => (typeof s === 'string' ? s.trim() : ''))
//       .filter(Boolean)
//       .slice(0, 3)
//   }
//   if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
//   return []
// }

// /**
//  * Convert the backend grid into the UI grid.
//  *
//  * The API stores the grid as `[day][period]` (6 days Mon–Sat × 4 periods) with
//  * each cell an array of up to two subjects; the UI indexes `[period][day]`. This
//  * transposes and pads so a partial/empty API grid still renders a full 4×6 grid.
//  */
// export function gridFromApi(apiGrid: unknown): TimetableGrid {
//   const g = Array.isArray(apiGrid) ? (apiGrid as unknown[][]) : []
//   return SLOTS.map((_, period) =>
//     DAYS.map((_, day) => toCell(g[day]?.[period])),
//   )
// }

// /**
//  * Convert the UI grid (`[period][day]`) back to the backend layout
//  * (`[day][period]`) for saving via PUT /timetable/:key.
//  */
// export function gridToApi(uiGrid: TimetableGrid): string[][][] {
//   return DAYS.map((_, day) =>
//     SLOTS.map((_, period) =>
//       (uiGrid[period]?.[day] ?? []).map((s) => s.trim()).filter(Boolean),
//     ),
//   )
// }

// /** Build the default template by rotating through the track's subjects. */
// export function buildDefaultGrid(
//   track: ExamTrack,
//   department: Department | null = null,
// ): TimetableGrid {
//   const subjects = subjectsFor(track, department)
//   return SLOTS.map((_, slotIdx) =>
//     DAYS.map((_, dayIdx) => [
//       subjects[(dayIdx * SLOTS.length + slotIdx) % subjects.length],
//     ]),
//   )
// }

// /** An empty 4×6 grid of empty cells. */
// export function emptyGrid(): TimetableGrid {
//   return SLOTS.map(() => DAYS.map(() => [] as Cell))
// }

// const KEY = 'dsa_timetables'

// function readAll(): Record<string, TimetableGrid> {
//   if (typeof window === 'undefined') return {}
//   try {
//     return JSON.parse(localStorage.getItem(KEY) || '{}')
//   } catch {
//     return {}
//   }
// }

// export function getSavedTimetable(key: string): TimetableGrid | null {
//   const grid = readAll()[key]
//   return Array.isArray(grid) ? grid : null
// }

// export function saveLocalTimetable(key: string, grid: TimetableGrid): void {
//   if (typeof window === 'undefined') return
//   const all = readAll()
//   all[key] = grid
//   localStorage.setItem(KEY, JSON.stringify(all))
// }

// /** Saved timetable for a programme(+dept) if one was set, else the template. */
// export function getEffectiveTimetable(
//   track: ExamTrack,
//   department: Department | null = null,
// ): TimetableGrid {
//   const key = timetableKey(track, department)
//   return getSavedTimetable(key) ?? buildDefaultGrid(track, department)
// }

// export interface NextClass {
//   subject: string
//   day: string // e.g. "Monday"
//   time: string // e.g. "8:00 – 9:30"
//   when: string // "Today" | "Tomorrow" | day name
//   ongoing: boolean // true if the class is happening right now
// }

// /** Join a cell's subjects for display, e.g. "Physics / Biology". */
// export function cellLabel(cell: Cell): string {
//   return cell.filter(Boolean).join(' / ')
// }

// /**
//  * The next (or currently-running) class from a timetable grid, based on the
//  * current day/time. Skips Sundays and empty periods; returns null if nothing is
//  * scheduled in the coming week.
//  */
// export function getNextClass(
//   grid: TimetableGrid,
//   slots: Slot[] = DEFAULT_SLOTS,
//   now = new Date(),
// ): NextClass | null {
//   const jsDay = now.getDay() // 0=Sun … 6=Sat
//   const nowMins = now.getHours() * 60 + now.getMinutes()

//   for (let offset = 0; offset < 7; offset++) {
//     const weekday = (jsDay + offset) % 7
//     if (weekday === 0) continue // Sunday — no classes
//     const dayIdx = weekday - 1 // Mon(1)→0 … Sat(6)→5
//     for (let slot = 0; slot < slots.length; slot++) {
//       const start = parseHM(slots[slot].start)
//       if (start == null) continue
//       const end = parseHM(slots[slot].end) ?? start + CLASS_MINUTES
//       if (offset === 0 && nowMins >= end) continue // already finished today
//       const subject = cellLabel(grid[slot]?.[dayIdx] ?? [])
//       if (!subject) continue
//       const when = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : DAYS[dayIdx]
//       const ongoing = offset === 0 && nowMins >= start && nowMins < end
//       return {
//         subject,
//         day: DAYS[dayIdx],
//         time: slotTimeLabel(slots[slot]),
//         when,
//         ongoing,
//       }
//     }
//   }
//   return null
// }

// export interface TodayClass {
//   subject: string
//   time: string
//   ongoing: boolean
//   slotIndex: number
// }

// /**
//  * Today's classes that haven't finished yet (ongoing or still upcoming today),
//  * in period order — so the card can show the first AND second period. Empty on
//  * Sundays or when today is done.
//  */
// export function getTodayClasses(
//   grid: TimetableGrid,
//   slots: Slot[] = DEFAULT_SLOTS,
//   now = new Date(),
// ): TodayClass[] {
//   const jsDay = now.getDay()
//   if (jsDay === 0) return []
//   const dayIdx = jsDay - 1
//   const nowMins = now.getHours() * 60 + now.getMinutes()
//   const out: TodayClass[] = []
//   for (let slot = 0; slot < slots.length; slot++) {
//     const start = parseHM(slots[slot].start)
//     if (start == null) continue
//     const end = parseHM(slots[slot].end) ?? start + CLASS_MINUTES
//     if (nowMins >= end) continue // finished
//     const subject = cellLabel(grid[slot]?.[dayIdx] ?? [])
//     if (!subject) continue
//     out.push({
//       subject,
//       time: slotTimeLabel(slots[slot]),
//       ongoing: nowMins >= start && nowMins < end,
//       slotIndex: slot,
//     })
//   }
//   return out
// }

// const TINTS = [
//   'bg-blue-50 text-[#002EFF]',
//   'bg-emerald-50 text-emerald-600',
//   'bg-amber-50 text-amber-600',
//   'bg-rose-50 text-rose-500',
//   'bg-violet-50 text-violet-600',
//   'bg-cyan-50 text-cyan-600',
// ]

// /** Stable colour for any subject string, so edited subjects still colour-code. */
// export function tintForSubject(subject: string): string {
//   let hash = 0
//   for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) | 0
//   return TINTS[Math.abs(hash) % TINTS.length]
// }



// Weekly timetable — shared constants, a default template, and a browser-local
// store so admin/tutor edits are seen by students (demo/offline fallback).
//
// Timetables are keyed by PROGRAMME, and by DEPARTMENT for split programmes:
//
//   waec-science | waec-art | waec-commercial
//
//   jamb-science | jamb-art | jamb-commercial
//   postutme-science | postutme-art | postutme-commercial
//
// Afternoon School is keyed by CLASS LEVEL + DEPARTMENT:
//
//   afterschool-ss1-science
//   afterschool-ss1-art
//   afterschool-ss1-commercial
//
//   afterschool-ss2-science
//   afterschool-ss2-art
//   afterschool-ss2-commercial
//
// Other programmes are keyed directly:
//
//   undergrad | preclinical
//
// A single period holds UP TO THREE subjects (a Cell), so students who take
// different subjects can share the same slot.

import type { ExamTrack, Department } from './studentProfile'

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const SLOTS = [
  { label: 'Period 1', time: '8:00 – 9:30' },
  { label: 'Period 2', time: '9:45 – 11:15' },
  { label: 'Period 3', time: '11:30 – 1:00' },
  { label: 'Period 4', time: '2:00 – 3:30' },
] as const

const CLASS_MINUTES = 90

/** A period's label + start/end times (24h "HH:MM"), editable per timetable. */
export type Slot = {
  label: string
  start: string
  end: string
}

/** Frontend defaults, mirroring the backend Timetable.DEFAULT_SLOTS. */
export const DEFAULT_SLOTS: Slot[] = [
  { label: 'Period 1', start: '08:00', end: '09:30' },
  { label: 'Period 2', start: '09:45', end: '11:15' },
  { label: 'Period 3', start: '11:30', end: '13:00' },
  { label: 'Period 4', start: '14:00', end: '15:30' },
]

/** Supported Afternoon School class levels. */
export const AFTERSCHOOL_LEVELS = ['ss1', 'ss2'] as const

export type AfterschoolLevel = (typeof AFTERSCHOOL_LEVELS)[number]

/** "HH:MM" → minutes since midnight, or null if malformed. */
export function parseHM(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? '').trim())

  if (!m) return null

  const h = Number(m[1])
  const mm = Number(m[2])

  if (h > 23 || mm > 59) return null

  return h * 60 + mm
}

/** minutes-since-midnight → "4:00 PM" (12-hour, AM/PM). */
export function fmt12(mins: number): string {
  let h = Math.floor(mins / 60)
  const m = mins % 60
  const ap = h >= 12 ? 'PM' : 'AM'

  h %= 12

  if (h === 0) h = 12

  return `${h}:${String(m).padStart(2, '0')} ${ap}`
}

/** A slot's time range with AM/PM, e.g. "4:00 PM – 5:30 PM". */
export function slotTimeLabel(slot: Slot): string {
  const s = parseHM(slot.start)
  const e = parseHM(slot.end)

  if (s == null || e == null) {
    return `${slot.start} – ${slot.end}`
  }

  return `${fmt12(s)} – ${fmt12(e)}`
}

/** Coerce fetched slots into a clean Slot[] (defaults fill any gaps). */
export function slotsFromApi(raw: unknown): Slot[] {
  const src = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : []

  return DEFAULT_SLOTS.map((def, i) => {
    const s =
      src[i] && typeof src[i] === 'object'
        ? src[i]
        : {}

    const start =
      parseHM(String(s.start ?? '')) != null
        ? String(s.start)
        : def.start

    const end =
      parseHM(String(s.end ?? '')) != null
        ? String(s.end)
        : def.end

    const label =
      String(s.label ?? '').trim() || def.label

    return {
      label,
      start,
      end,
    }
  })
}

/**
 * Programmes whose timetable is split by department.
 *
 * JAMB, Post-UTME, WAEC and Afternoon School each have
 * separate Science / Art / Commercial timetables.
 */
const DEPT_SPLIT: ExamTrack[] = [
  'waec',
  'afterschool',
  'jamb',
  'postutme',
]

const DEPARTMENTS: Department[] = [
  'science',
  'art',
  'commercial',
]

/**
 * Check whether a value is a valid Afternoon School level.
 */
export function isAfterschoolLevel(
  value: unknown,
): value is AfterschoolLevel {
  return (
    value === 'ss1' ||
    value === 'ss2'
  )
}

/**
 * Build the backend timetable key for a student's programme.
 *
 * Examples:
 *
 *   timetableKey('jamb', 'science')
 *   → "jamb-science"
 *
 *   timetableKey('waec', 'art')
 *   → "waec-art"
 *
 *   timetableKey('postutme', 'commercial')
 *   → "postutme-commercial"
 *
 *   timetableKey('afterschool', 'science', 'ss1')
 *   → "afterschool-ss1-science"
 *
 *   timetableKey('afterschool', 'commercial', 'ss2')
 *   → "afterschool-ss2-commercial"
 *
 *   timetableKey('undergrad')
 *   → "undergrad"
 */
export function timetableKey(
  track: ExamTrack,
  department?: Department | null,
  afterschoolLevel?: AfterschoolLevel | null,
): string {
  if (track === 'afterschool') {
    const level = isAfterschoolLevel(afterschoolLevel)
      ? afterschoolLevel
      : 'ss1'

    const dept = department ?? 'science'

    return `afterschool-${level}-${dept}`
  }

  if (DEPT_SPLIT.includes(track)) {
    return `${track}-${department ?? 'science'}`
  }

  return track
}

/**
 * Representative subjects used to seed a template.
 *
 * JAMB/Post-UTME are department-based in the timetable,
 * so each department receives its own representative subjects.
 */
const SUBJECTS: Record<string, string[]> = {
  jamb: [
    'English',
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Economics',
  ],

  science: [
    'English',
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Further Maths',
  ],

  art: [
    'English',
    'Mathematics',
    'Literature',
    'Government',
    'History',
    'CRS',
  ],

  commercial: [
    'English',
    'Mathematics',
    'Economics',
    'Commerce',
    'Accounting',
    'Government',
  ],
}

/**
 * Select representative subjects for a programme/department.
 *
 * SS1 and SS2 currently use the same department subject pool.
 * Their actual saved timetables remain completely separate because
 * their timetable keys are different.
 */
function subjectsFor(
  track: ExamTrack,
  department: Department | null,
): string[] {
  if (DEPT_SPLIT.includes(track)) {
    return SUBJECTS[department ?? 'science'] ?? SUBJECTS.science
  }

  return SUBJECTS.jamb
}

/** A period holds up to three subjects (parallel courses). */
export type Cell = string[]

/** A grid is rows (periods) × columns (days); each cell is a Cell. */
export type TimetableGrid = Cell[][]

/** Coerce any backend cell (array | string | null) into a clean Cell (≤3). */
function toCell(raw: unknown): Cell {
  if (Array.isArray(raw)) {
    return raw
      .map((s) =>
        typeof s === 'string'
          ? s.trim()
          : '',
      )
      .filter(Boolean)
      .slice(0, 3)
  }

  if (
    typeof raw === 'string' &&
    raw.trim()
  ) {
    return [raw.trim()]
  }

  return []
}

/**
 * Convert the backend grid into the UI grid.
 *
 * The API stores the grid as:
 *
 *   [day][period]
 *
 * 6 days × 4 periods.
 *
 * The UI indexes it as:
 *
 *   [period][day]
 *
 * This transposes and pads so a partial/empty API grid still
 * renders a full 4×6 grid.
 */
export function gridFromApi(
  apiGrid: unknown,
): TimetableGrid {
  const g = Array.isArray(apiGrid)
    ? (apiGrid as unknown[][])
    : []

  return SLOTS.map((_, period) =>
    DAYS.map((_, day) =>
      toCell(g[day]?.[period]),
    ),
  )
}

/**
 * Convert the UI grid ([period][day]) back to the backend
 * layout ([day][period]) for saving via PUT /timetable/:key.
 */
export function gridToApi(
  uiGrid: TimetableGrid,
): string[][][] {
  return DAYS.map((_, day) =>
    SLOTS.map((_, period) =>
      (uiGrid[period]?.[day] ?? [])
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  )
}

/**
 * Build the default template by rotating through the track's subjects.
 *
 * The afterschool level is intentionally not part of the subject selection
 * because SS1 and SS2 can use the same department subject pool while still
 * having completely independent timetable keys.
 */
export function buildDefaultGrid(
  track: ExamTrack,
  department: Department | null = null,
): TimetableGrid {
  const subjects = subjectsFor(
    track,
    department,
  )

  return SLOTS.map((_, slotIdx) =>
    DAYS.map((_, dayIdx) => [
      subjects[
        (dayIdx * SLOTS.length + slotIdx) %
          subjects.length
      ],
    ]),
  )
}

/** An empty 4×6 grid of empty cells. */
export function emptyGrid(): TimetableGrid {
  return SLOTS.map(() =>
    DAYS.map(() => [] as Cell),
  )
}

const KEY = 'dsa_timetables'

function readAll(): Record<
  string,
  TimetableGrid
> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    return JSON.parse(
      localStorage.getItem(KEY) || '{}',
    )
  } catch {
    return {}
  }
}

export function getSavedTimetable(
  key: string,
): TimetableGrid | null {
  const grid = readAll()[key]

  return Array.isArray(grid)
    ? grid
    : null
}

export function saveLocalTimetable(
  key: string,
  grid: TimetableGrid,
): void {
  if (typeof window === 'undefined') {
    return
  }

  const all = readAll()

  all[key] = grid

  localStorage.setItem(
    KEY,
    JSON.stringify(all),
  )
}

/**
 * Get the saved timetable for a programme,
 * department and optional Afternoon School level.
 *
 * If nothing has been saved locally, a default template
 * is returned.
 *
 * Examples:
 *
 *   getEffectiveTimetable(
 *     'afterschool',
 *     'science',
 *     'ss1',
 *   )
 *
 *   getEffectiveTimetable(
 *     'afterschool',
 *     'science',
 *     'ss2',
 *   )
 *
 * These return different localStorage entries.
 */
export function getEffectiveTimetable(
  track: ExamTrack,
  department: Department | null = null,
  afterschoolLevel: AfterschoolLevel | null = null,
): TimetableGrid {
  const key = timetableKey(
    track,
    department,
    afterschoolLevel,
  )

  return (
    getSavedTimetable(key) ??
    buildDefaultGrid(
      track,
      department,
    )
  )
}

export interface NextClass {
  subject: string
  day: string // e.g. "Monday"
  time: string // e.g. "8:00 – 9:30"
  when: string // "Today" | "Tomorrow" | day name
  ongoing: boolean // true if the class is happening right now
}

/**
 * The next (or currently-running) class from a timetable grid,
 * based on the current day/time.
 *
 * Skips Sundays and empty periods; returns null if nothing is
 * scheduled in the coming week.
 */
export function getNextClass(
  grid: TimetableGrid,
  slots: Slot[] = DEFAULT_SLOTS,
  now = new Date(),
): NextClass | null {
  const jsDay = now.getDay()
  // 0 = Sunday … 6 = Saturday

  const nowMins =
    now.getHours() * 60 +
    now.getMinutes()

  for (let offset = 0; offset < 7; offset++) {
    const weekday =
      (jsDay + offset) % 7

    if (weekday === 0) {
      continue
    }

    const dayIdx = weekday - 1
    // Mon(1) → 0 … Sat(6) → 5

    for (
      let slot = 0;
      slot < slots.length;
      slot++
    ) {
      const start = parseHM(
        slots[slot].start,
      )

      if (start == null) {
        continue
      }

      const end =
        parseHM(slots[slot].end) ??
        start + CLASS_MINUTES

      if (
        offset === 0 &&
        nowMins >= end
      ) {
        continue
      }

      const subject = cellLabel(
        grid[slot]?.[dayIdx] ?? [],
      )

      if (!subject) {
        continue
      }

      const when =
        offset === 0
          ? 'Today'
          : offset === 1
            ? 'Tomorrow'
            : DAYS[dayIdx]

      const ongoing =
        offset === 0 &&
        nowMins >= start &&
        nowMins < end

      return {
        subject,
        day: DAYS[dayIdx],
        time: slotTimeLabel(
          slots[slot],
        ),
        when,
        ongoing,
      }
    }
  }

  return null
}

export interface TodayClass {
  subject: string
  time: string
  ongoing: boolean
  slotIndex: number
}

/**
 * Today's classes that haven't finished yet
 * (ongoing or still upcoming today), in period order.
 *
 * Empty on Sundays or when today is done.
 */
export function getTodayClasses(
  grid: TimetableGrid,
  slots: Slot[] = DEFAULT_SLOTS,
  now = new Date(),
): TodayClass[] {
  const jsDay = now.getDay()

  if (jsDay === 0) {
    return []
  }

  const dayIdx = jsDay - 1

  const nowMins =
    now.getHours() * 60 +
    now.getMinutes()

  const out: TodayClass[] = []

  for (
    let slot = 0;
    slot < slots.length;
    slot++
  ) {
    const start = parseHM(
      slots[slot].start,
    )

    if (start == null) {
      continue
    }

    const end =
      parseHM(slots[slot].end) ??
      start + CLASS_MINUTES

    if (nowMins >= end) {
      continue
    }

    const subject = cellLabel(
      grid[slot]?.[dayIdx] ?? [],
    )

    if (!subject) {
      continue
    }

    out.push({
      subject,
      time: slotTimeLabel(
        slots[slot],
      ),
      ongoing:
        nowMins >= start &&
        nowMins < end,
      slotIndex: slot,
    })
  }

  return out
}

const TINTS = [
  'bg-blue-50 text-[#002EFF]',
  'bg-emerald-50 text-emerald-600',
  'bg-amber-50 text-amber-600',
  'bg-rose-50 text-rose-500',
  'bg-violet-50 text-violet-600',
  'bg-cyan-50 text-cyan-600',
]

/** Stable colour for any subject string, so edited subjects still colour-code. */
export function tintForSubject(
  subject: string,
): string {
  let hash = 0

  for (
    let i = 0;
    i < subject.length;
    i++
  ) {
    hash =
      (hash * 31 +
        subject.charCodeAt(i)) |
      0
  }

  return TINTS[
    Math.abs(hash) % TINTS.length
  ]
}

/** Join a cell's subjects for display, e.g. "Physics / Biology". */
export function cellLabel(
  cell: Cell,
): string {
  return cell
    .filter(Boolean)
    .join(' / ')
}