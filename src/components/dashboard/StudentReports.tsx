'use client'

// Student attendance & academic performance — one screen for Admin, staff with
// reports.view (or attendance.manage, attendance only) and tutors. Every
// figure comes from GET /api/reports/*, worked out on the server from real
// check-ins and quiz results and limited there to what the viewer may see;
// this component only asks and draws. Definitions travel with each report and
// are shown under "How these are calculated".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarCheck,
  Users,
  UserX,
  TrendingUp,
  Award,
  AlertTriangle,
  ClipboardCheck,
  BarChart3,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { dsaApi } from '@/lib/api'
import { getToken } from '@/lib/auth'

type Tab = 'attendance' | 'performance' | 'at-risk'

/* ---------------- Report shapes (as the server sends them) ---------------- */

interface StudentRow {
  id: string
  fullname: string
  studentId: string | null
  track: string
  department: string
  classLevel: string
  eligibleSessions?: number
  present?: number
  attendanceRate?: number | null
  lastPresent?: string | null
  results?: number
  averageScore?: number | null
  passRate?: number | null
  expectedAssessments?: number
  completedAssessments?: number
  missed?: number
}
interface StudentList {
  total: number
  students: StudentRow[]
}
interface AttendanceGroup {
  key: string
  students: number
  trackedStudents: number
  sessionsRecorded: number
  eligibleSessions: number
  present: number
  attendanceRate: number | null
  averageStudentRate: number | null
  followUp: number
  studentsWithNoRecordedAttendance: number
  trend?: TrendPoint[]
  byDepartment?: AttendanceGroup[]
  byClass?: AttendanceGroup[]
}
interface TrendPoint {
  period: string
  sessions?: number
  eligible?: number
  present?: number
  attendanceRate?: number | null
  results?: number
  averageScore?: number | null
  passRate?: number | null
}
interface AttendanceReport {
  range: { from: string; to: string; bucket: 'day' | 'week' }
  settings: { lowThreshold: number; highThreshold: number; minSessions: number }
  overall: AttendanceGroup & {
    studentsWithAttendance: number
    studentsNotTracked: number
    notCheckedIn: number
  }
  trend: TrendPoint[]
  lowAttendance: StudentList
  excellentAttendance: StudentList
  noRecordedAttendance: StudentList
  byTrack: AttendanceGroup[]
  byCourse: {
    courseId: string
    title: string
    classLevel: string | null
    students: number
    sessionsRecorded: number
    eligibleSessions: number
    present: number
    attendanceRate: number | null
  }[]
  definitions: Record<string, string>
}
interface PerformanceGroup {
  key: string
  students: number
  participants: number
  participationRate: number | null
  results: number
  averageScore: number | null
  passRate: number | null
  completionRate: number | null
  needingSupport: number
}
interface PerformanceReport {
  range: { from: string; to: string; bucket: 'day' | 'week' }
  settings: { passMark: number; minResults: number }
  overall: PerformanceGroup & {
    resultAverage: number | null
    passes: number
    fails: number
    expectedAssessments: number
    completedAssessments: number
    notYetTaken: number
    missed: number
    distribution: { band: string; results: number }[]
  }
  trend: TrendPoint[]
  topPerformers: StudentList
  needingSupport: StudentList
  mostMissed: StudentList
  byTrack: PerformanceGroup[]
  byDepartment: PerformanceGroup[]
  byClass: PerformanceGroup[]
  bySubject: { key: string; students: number; results: number; averageScore: number | null; passRate: number | null }[]
  byCourse: { courseId: string; title: string; students: number; results: number; averageScore: number | null; passRate: number | null }[]
  definitions: Record<string, string>
}
interface AtRiskReport {
  students: number
  bothMeasured: number
  lowAttendanceAndLowScores: StudentList
  lowAttendanceOnly: number
  lowScoresOnly: number
  settings: { lowThreshold: number; passMark: number; minSessions: number; minResults: number }
  definitions: Record<string, string>
}
interface FilterChoices {
  tracks: string[]
  departments: string[]
  classLevels: string[]
  courses: { id: string; title: string; category: string | null; classLevel: string | null }[]
}

/* ---------------- Labels & formatting ---------------- */

const TRACK_LABELS: Record<string, string> = {
  jamb: 'JAMB',
  waec: 'WAEC',
  postutme: 'Post-UTME',
  undergrad: 'Undergrad',
  preclinical: 'Preclinical',
  afterschool: 'After-School',
  unassigned: 'No track',
}
const trackLabel = (k: string) => TRACK_LABELS[k] ?? k
const titleCase = (s: string) =>
  s === 'unspecified' ? 'Not set' : s.charAt(0).toUpperCase() + s.slice(1)
const pctText = (v: number | null | undefined) => (v == null ? '—' : `${v}%`)
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString())

const dayISO = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => dayISO(new Date(Date.now() - n * 86400000))

const PRESETS = [
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
  { label: '90 days', days: 89 },
]

function shortPeriod(p: string, bucket: 'day' | 'week') {
  const d = new Date(`${p}T00:00:00Z`)
  const s = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return bucket === 'week' ? `w/c ${s}` : s
}

/** Same thresholds the existing analytics bars use. */
function rateTint(v: number | null | undefined, low = 50, mid = 70) {
  if (v == null) return 'bg-slate-300 dark:bg-slate-700'
  if (v < low) return 'bg-rose-500'
  if (v < mid) return 'bg-amber-400'
  return 'bg-[#002EFF]'
}

/* ---------------- Small building blocks (existing dashboard styling) ---------------- */

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tint,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  tint: string
}) {
  return (
    <Card className='p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm bg-white dark:bg-slate-900'>
      <div className='flex items-center gap-3'>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <div className='min-w-0'>
          <p className='text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase leading-none mb-1'>
            {label}
          </p>
          <p className='text-lg font-black text-slate-900 dark:text-slate-100 leading-none'>{value}</p>
          {sub && (
            <p className='text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-1 truncate'>{sub}</p>
          )}
        </div>
      </div>
    </Card>
  )
}

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Card className='p-5 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm bg-white dark:bg-slate-900 space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <p className='flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400'>
          <Icon size={13} className='text-[#002EFF]' /> {title}
        </p>
        {action}
      </div>
      {children}
    </Card>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className='rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-4 py-6 text-center text-[11px] font-bold text-slate-400'>
      {children}
    </p>
  )
}

/**
 * Column chart for one series over time. Each column has its own hover/focus
 * tooltip; the table beside it carries the same numbers.
 */
function TrendColumns({
  points,
  bucket,
  value,
  detail,
  tint,
  label,
}: {
  points: TrendPoint[]
  bucket: 'day' | 'week'
  value: (p: TrendPoint) => number | null | undefined
  detail: (p: TrendPoint) => string
  tint: (v: number | null | undefined) => string
  label: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (!points.length) return null
  const step = Math.max(1, Math.ceil(points.length / 8))
  return (
    <figure aria-label={label} className='space-y-2'>
      <div className='relative h-40'>
        {/* Recessive guides at 50% and 100% */}
        <div className='absolute inset-x-0 top-0 border-t border-dashed border-slate-100 dark:border-slate-800' />
        <div className='absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100 dark:border-slate-800' />
        <span className='absolute -top-2 right-0 text-[8px] font-bold text-slate-300'>100%</span>
        <span className='absolute top-1/2 -mt-2 right-0 text-[8px] font-bold text-slate-300'>50%</span>
        <div className='absolute inset-0 flex items-end gap-[2px] pr-7'>
          {points.map((p, i) => {
            const v = value(p)
            return (
              <button
                type='button'
                key={p.period}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${shortPeriod(p.period, bucket)}: ${pctText(v)}. ${detail(p)}`}
                className='group relative flex h-full flex-1 items-end focus:outline-none'
              >
                <span
                  className={`block w-full rounded-t-[4px] motion-safe:transition-[height] motion-safe:duration-300 ${tint(v)} ${
                    hover === i ? 'opacity-100' : 'opacity-85'
                  } group-focus-visible:ring-2 group-focus-visible:ring-[#002EFF]/40`}
                  style={{ height: `${v == null ? 2 : Math.max(2, v)}%` }}
                />
              </button>
            )
          })}
        </div>
        {hover != null && points[hover] && (
          <div
            role='tooltip'
            className='pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-bold text-white shadow-lg'
            style={{
              left: `${Math.min(88, Math.max(12, ((hover + 0.5) / points.length) * 100))}%`,
            }}
          >
            <p className='font-black'>{shortPeriod(points[hover].period, bucket)}</p>
            <p>{pctText(value(points[hover]))}</p>
            <p className='text-slate-300'>{detail(points[hover])}</p>
          </div>
        )}
      </div>
      <div className='flex gap-[2px] pr-7'>
        {points.map((p, i) => (
          <span key={p.period} className='flex-1 truncate text-center text-[8px] font-bold text-slate-400'>
            {i % step === 0 ? shortPeriod(p.period, bucket) : ''}
          </span>
        ))}
      </div>
    </figure>
  )
}

function RateBar({ label, value, sub }: { label: string; value: number | null; sub?: string }) {
  return (
    <div className='flex items-center gap-3'>
      <span className='w-28 shrink-0 truncate text-right text-[10px] font-black uppercase text-slate-600 dark:text-slate-400'>
        {label}
      </span>
      <div className='h-6 flex-1 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/80'>
        {value != null && (
          <div
            className={`flex h-full items-center justify-end rounded-lg pr-2 motion-safe:transition-all ${rateTint(value)}`}
            style={{ width: `${Math.max(value, 8)}%` }}
          >
            <span className='text-[9px] font-black text-white'>{value}%</span>
          </div>
        )}
      </div>
      <span className='w-16 shrink-0 text-[9px] font-bold text-slate-400'>{value == null ? 'No data' : sub}</span>
    </div>
  )
}

function StudentTable({
  list,
  columns,
  empty,
}: {
  list: StudentList
  columns: { label: string; cell: (r: StudentRow) => React.ReactNode }[]
  empty: string
}) {
  if (!list.students.length) return <Empty>{empty}</Empty>
  return (
    <div className='space-y-2'>
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[480px] text-left'>
          <thead>
            <tr className='text-[9px] font-black uppercase text-slate-400'>
              <th className='py-2 pr-3'>Student</th>
              <th className='py-2 pr-3'>Track · Class</th>
              {columns.map((c) => (
                <th key={c.label} className='py-2 pr-3 text-right'>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.students.map((r) => (
              <tr key={r.id} className='border-t border-slate-50 dark:border-slate-800'>
                <td className='py-2 pr-3'>
                  <p className='text-[11px] font-black text-slate-800 dark:text-slate-100'>{r.fullname}</p>
                  <p className='text-[9px] font-bold text-slate-400'>{r.studentId || '—'}</p>
                </td>
                <td className='py-2 pr-3 text-[10px] font-bold text-slate-500'>
                  {trackLabel(r.track)} · {r.classLevel}
                  {r.department !== 'unspecified' ? ` · ${titleCase(r.department)}` : ''}
                </td>
                {columns.map((c) => (
                  <td key={c.label} className='py-2 pr-3 text-right text-[11px] font-black text-slate-700 dark:text-slate-200'>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.total > list.students.length && (
        <p className='text-[9px] font-bold text-slate-400'>
          Showing {list.students.length} of {list.total}. Narrow the filters to see the rest.
        </p>
      )}
    </div>
  )
}

function Definitions({ items }: { items: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className='rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className='flex w-full items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#002EFF]'
      >
        <span className='flex items-center gap-2'>
          <Info size={13} /> How these are calculated
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <dl className='space-y-2 border-t border-slate-100 dark:border-slate-800 px-4 py-3'>
          {Object.entries(items).map(([k, v]) => (
            <div key={k}>
              <dt className='text-[9px] font-black uppercase text-slate-400'>
                {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </dt>
              <dd className='text-[11px] font-medium text-slate-600 dark:text-slate-300'>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className='space-y-6' aria-busy='true' aria-label='Loading report'>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className='p-4 rounded-2xl border border-slate-100 shadow-sm bg-white dark:bg-slate-900'>
            <div className='flex items-center gap-3'>
              <Skeleton className='h-10 w-10 rounded-xl shrink-0' />
              <div className='space-y-1.5 flex-1'>
                <Skeleton className='h-2.5 w-16' />
                <Skeleton className='h-5 w-12' />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card className='p-6 rounded-3xl border border-slate-100 shadow-sm bg-white dark:bg-slate-900 space-y-3'>
        <Skeleton className='h-3 w-36' />
        <Skeleton className='h-40 w-full rounded-2xl' />
      </Card>
    </div>
  )
}

/* ---------------- The screen ---------------- */

export default function StudentReports({
  token,
  canSeePerformance = true,
  scopeNote,
}: {
  /** Explicit bearer token — admin passes its admin token; others omit it. */
  token?: string
  /** false for staff who may run attendance but not view academic reports. */
  canSeePerformance?: boolean
  /** One line under the title, e.g. "Students in your courses". */
  scopeNote?: string
}) {
  const [tab, setTab] = useState<Tab>('attendance')
  const [from, setFrom] = useState(() => daysAgo(29))
  const [to, setTo] = useState(() => daysAgo(0))
  const [track, setTrack] = useState('')
  const [department, setDepartment] = useState('')
  const [classLevel, setClassLevel] = useState('')
  const [courseId, setCourseId] = useState('')
  const [choices, setChoices] = useState<FilterChoices | null>(null)
  const [data, setData] = useState<unknown>(null)
  const [dataTab, setDataTab] = useState<Tab | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openTrack, setOpenTrack] = useState<string | null>(null)
  // Reports already fetched this visit, by request — switching back is instant.
  const cache = useRef(new Map<string, unknown>())
  const authToken = token || getToken() || undefined

  const params = useMemo(
    () => ({ from, to, track, department, classLevel, courseId }),
    [from, to, track, department, classLevel, courseId],
  )
  const key = `${tab}?${JSON.stringify(params)}`
  const hasFilters = !!(track || department || classLevel || courseId)

  useEffect(() => {
    let alive = true
    dsaApi.reports
      .get('filters', {}, authToken)
      .then((d) => alive && setChoices(d as FilterChoices))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [authToken])

  const load = useCallback(
    (force = false) => {
      const cached = cache.current.get(key)
      if (cached && !force) {
        setData(cached)
        setDataTab(tab)
        setLoading(false)
        setError('')
        return () => {}
      }
      const ctrl = new AbortController()
      setLoading(true)
      setError('')
      // Filters change in bursts (typing a date); wait for a pause.
      const timer = setTimeout(() => {
        dsaApi.reports
          .get(tab, params, authToken, ctrl.signal)
          .then((d) => {
            cache.current.set(key, d)
            setData(d)
            setDataTab(tab)
          })
          .catch((e) => {
            if (ctrl.signal.aborted) return
            setError(e instanceof Error ? e.message : 'The report could not be loaded.')
          })
          .finally(() => {
            if (!ctrl.signal.aborted) setLoading(false)
          })
      }, 250)
      return () => {
        clearTimeout(timer)
        ctrl.abort()
      }
    },
    [key, tab, params, authToken],
  )

  useEffect(() => load(), [load])

  const clearFilters = () => {
    setTrack('')
    setDepartment('')
    setClassLevel('')
    setCourseId('')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'attendance', label: 'Attendance' },
    ...(canSeePerformance
      ? [
          { id: 'performance' as Tab, label: 'Performance' },
          { id: 'at-risk' as Tab, label: 'Follow-up' },
        ]
      : []),
  ]

  const select =
    'h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-[#002EFF]'

  // Only draw a report for the tab it was fetched for (no flash of the wrong one).
  const shown = dataTab === tab ? data : null

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>Attendance & Performance</h2>
          <p className='text-[11px] font-bold text-slate-400'>
            {scopeNote || 'From recorded check-ins and quiz results only.'}
          </p>
        </div>
        <button
          type='button'
          onClick={() => load(true)}
          disabled={loading}
          className='flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:border-blue-200 hover:text-[#002EFF] disabled:opacity-50'
        >
          <RefreshCw size={14} className={loading ? 'motion-safe:animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div role='tablist' className='flex flex-wrap gap-1.5'>
        {tabs.map((t) => (
          <button
            key={t.id}
            role='tab'
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-all ${
              tab === t.id ? 'bg-[#002EFF] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters — one row, applied on the server */}
      <Card className='rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <label className='flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400'>
            From
            <input type='date' value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={select} />
          </label>
          <label className='flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400'>
            To
            <input type='date' value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={select} />
          </label>
          <div className='flex gap-1'>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type='button'
                onClick={() => {
                  setFrom(daysAgo(p.days))
                  setTo(daysAgo(0))
                }}
                className={`h-8 rounded-lg px-2.5 text-[9px] font-black uppercase ${
                  from === daysAgo(p.days) && to === daysAgo(0)
                    ? 'bg-blue-50 text-[#002EFF]'
                    : 'bg-slate-50 text-slate-500 hover:text-[#002EFF]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <select aria-label='Track' value={track} onChange={(e) => setTrack(e.target.value)} className={select}>
            <option value=''>All tracks</option>
            {(choices?.tracks ?? Object.keys(TRACK_LABELS).filter((k) => k !== 'unassigned')).map((t) => (
              <option key={t} value={t}>
                {trackLabel(t)}
              </option>
            ))}
          </select>
          <select aria-label='Department' value={department} onChange={(e) => setDepartment(e.target.value)} className={select}>
            <option value=''>All departments</option>
            {(choices?.departments ?? ['science', 'art', 'commercial']).map((d) => (
              <option key={d} value={d}>
                {titleCase(d)}
              </option>
            ))}
          </select>
          <select aria-label='Class' value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className={select}>
            <option value=''>All classes</option>
            {(choices?.classLevels ?? ['SS1', 'SS2', 'SS3', '100 Level', '200 Level']).map((c) => (
              <option key={c} value={c.toLowerCase()}>
                {c}
              </option>
            ))}
          </select>
          {!!choices?.courses.length && (
            <select
              aria-label='Course'
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className={`${select} max-w-[16rem]`}
            >
              <option value=''>All courses</option>
              {choices.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.classLevel ? ` (${c.classLevel})` : ''}
                </option>
              ))}
            </select>
          )}
          {hasFilters && (
            <button
              type='button'
              onClick={clearFilters}
              className='flex h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-[10px] font-black uppercase text-slate-500 hover:text-[#002EFF]'
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </Card>

      {error && (
        <Card className='rounded-2xl border border-red-200 bg-red-50 p-4'>
          <div className='flex items-start gap-3'>
            <AlertCircle size={18} className='mt-0.5 shrink-0 text-red-600' />
            <div className='flex-1'>
              <p className='text-sm font-bold text-red-700'>The report could not be loaded</p>
              <p className='mt-1 text-xs text-red-600'>{error}</p>
            </div>
            <button
              type='button'
              onClick={() => load(true)}
              className='rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-red-700 hover:bg-red-100'
            >
              Retry
            </button>
          </div>
        </Card>
      )}

      {/* Keep the last report on screen (dimmed) while the next one loads,
          so the layout does not jump on every filter change. */}
      {!shown && loading && !error ? (
        <ReportSkeleton />
      ) : shown ? (
        <div
          className={`space-y-6 motion-safe:transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}
          aria-busy={loading}
        >
          {tab === 'attendance' && (
            <AttendanceView
              r={shown as AttendanceReport}
              openTrack={openTrack}
              setOpenTrack={setOpenTrack}
            />
          )}
          {tab === 'performance' && <PerformanceView r={shown as PerformanceReport} />}
          {tab === 'at-risk' && <AtRiskView r={shown as AtRiskReport} />}
        </div>
      ) : null}
    </div>
  )
}

/* ---------------- Attendance ---------------- */

function AttendanceView({
  r,
  openTrack,
  setOpenTrack,
}: {
  r: AttendanceReport
  openTrack: string | null
  setOpenTrack: (k: string | null) => void
}) {
  const o = r.overall
  const s = r.settings
  if (!o.students) {
    return <Empty>No students match these filters.</Empty>
  }
  return (
    <>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <StatTile
          label='Attendance rate'
          value={pctText(o.attendanceRate)}
          sub={o.eligibleSessions ? `${num(o.present)} of ${num(o.eligibleSessions)} sessions` : 'No sessions recorded'}
          icon={CalendarCheck}
          tint='bg-blue-50 text-[#002EFF]'
        />
        <StatTile
          label='Students tracked'
          value={num(o.trackedStudents)}
          sub={`of ${num(o.students)} · ${num(o.studentsNotTracked)} had no sessions`}
          icon={Users}
          tint='bg-emerald-50 text-emerald-600'
        />
        <StatTile
          label='With a check-in'
          value={num(o.studentsWithAttendance)}
          sub={`${num(o.studentsWithNoRecordedAttendance)} never checked in`}
          icon={UserX}
          tint='bg-amber-50 text-amber-600'
        />
        <StatTile
          label='Sessions recorded'
          value={num(o.sessionsRecorded)}
          sub={`Average per student ${pctText(o.averageStudentRate)}`}
          icon={TrendingUp}
          tint='bg-violet-50 text-violet-600'
        />
      </div>

      {o.sessionsRecorded === 0 ? (
        <Empty>
          No attendance sessions were recorded for these students between {r.range.from} and {r.range.to}.
          There is nothing to measure yet, so no percentage is shown.
        </Empty>
      ) : (
        <>
          <Section title='Present · not checked in' icon={CalendarCheck}>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 text-center'>
              {[
                ['Present', num(o.present)],
                ['Not checked in', num(o.notCheckedIn)],
                ['Late', 'Not recorded'],
                ['Excused', 'Not recorded'],
              ].map(([k, v]) => (
                <div key={k} className='rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3'>
                  <p className='text-[8px] font-black uppercase text-slate-400'>{k}</p>
                  <p className='mt-1 text-sm font-black text-slate-800 dark:text-slate-100'>{v}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title={`Attendance rate by ${r.range.bucket}`} icon={TrendingUp}>
            <TrendColumns
              label='Attendance rate over time'
              points={r.trend}
              bucket={r.range.bucket}
              value={(p) => p.attendanceRate}
              detail={(p) => `${p.present} of ${p.eligible} check-ins · ${p.sessions} session${p.sessions === 1 ? '' : 's'}`}
              tint={(v) => rateTint(v, s.lowThreshold, s.highThreshold)}
            />
          </Section>

          <Section title='By track' icon={BarChart3}>
            <div className='overflow-x-auto'>
              <table className='w-full min-w-[640px] text-left'>
                <thead>
                  <tr className='text-[9px] font-black uppercase text-slate-400'>
                    <th className='py-2 pr-3'>Track</th>
                    <th className='py-2 pr-3 text-right'>Students</th>
                    <th className='py-2 pr-3 text-right'>Tracked</th>
                    <th className='py-2 pr-3 text-right'>Sessions</th>
                    <th className='py-2 pr-3 text-right'>Rate</th>
                    <th className='py-2 pr-3 text-right'>Avg / student</th>
                    <th className='py-2 pr-3 text-right'>Follow-up</th>
                    <th className='py-2' />
                  </tr>
                </thead>
                <tbody>
                  {r.byTrack.map((g) => {
                    const open = openTrack === g.key
                    return (
                      <TrackRows key={g.key} g={g} open={open} onToggle={() => setOpenTrack(open ? null : g.key)} bucket={r.range.bucket} />
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {r.byCourse.length > 0 && (
            <Section title='By course' icon={BarChart3}>
              <div className='space-y-2.5'>
                {r.byCourse.map((c) => (
                  <RateBar
                    key={c.courseId}
                    label={`${c.title}${c.classLevel ? ` ${c.classLevel}` : ''}`}
                    value={c.attendanceRate}
                    sub={`${c.sessionsRecorded} sess.`}
                  />
                ))}
              </div>
              <p className='text-[9px] font-bold text-slate-400'>{r.definitions.byCourse}</p>
            </Section>
          )}

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
            <Section title={`Below ${s.lowThreshold}% (${r.lowAttendance.total})`} icon={AlertTriangle}>
              <StudentTable
                list={r.lowAttendance}
                empty={`No student is below ${s.lowThreshold}% over ${s.minSessions}+ sessions.`}
                columns={[
                  { label: 'Sessions', cell: (x) => `${x.present}/${x.eligibleSessions}` },
                  { label: 'Rate', cell: (x) => pctText(x.attendanceRate) },
                ]}
              />
            </Section>
            <Section title={`${s.highThreshold}% and above (${r.excellentAttendance.total})`} icon={Award}>
              <StudentTable
                list={r.excellentAttendance}
                empty={`No student is at ${s.highThreshold}% or above over ${s.minSessions}+ sessions yet.`}
                columns={[
                  { label: 'Sessions', cell: (x) => `${x.present}/${x.eligibleSessions}` },
                  { label: 'Rate', cell: (x) => pctText(x.attendanceRate) },
                ]}
              />
            </Section>
          </div>
          <Section title={`No check-in at all (${r.noRecordedAttendance.total})`} icon={UserX}>
            <StudentTable
              list={r.noRecordedAttendance}
              empty='Every tracked student has checked in at least once.'
              columns={[{ label: 'Sessions missed', cell: (x) => num(x.eligibleSessions) }]}
            />
          </Section>
        </>
      )}
      <Definitions items={r.definitions} />
    </>
  )
}

function TrackRows({
  g,
  open,
  onToggle,
  bucket,
}: {
  g: AttendanceGroup
  open: boolean
  onToggle: () => void
  bucket: 'day' | 'week'
}) {
  return (
    <>
      <tr className='border-t border-slate-50 dark:border-slate-800'>
        <td className='py-2 pr-3 text-[11px] font-black text-slate-800 dark:text-slate-100'>{trackLabel(g.key)}</td>
        <td className='py-2 pr-3 text-right text-[11px] font-bold text-slate-600'>{num(g.students)}</td>
        <td className='py-2 pr-3 text-right text-[11px] font-bold text-slate-600'>{num(g.trackedStudents)}</td>
        <td className='py-2 pr-3 text-right text-[11px] font-bold text-slate-600'>{num(g.sessionsRecorded)}</td>
        <td className='py-2 pr-3 text-right text-[11px] font-black text-slate-800 dark:text-slate-100'>{pctText(g.attendanceRate)}</td>
        <td className='py-2 pr-3 text-right text-[11px] font-bold text-slate-600'>{pctText(g.averageStudentRate)}</td>
        <td className='py-2 pr-3 text-right'>
          {g.followUp ? (
            <span className='rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-600'>{g.followUp}</span>
          ) : (
            <span className='text-[10px] font-bold text-slate-300'>0</span>
          )}
        </td>
        <td className='py-2 text-right'>
          <button
            type='button'
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} ${trackLabel(g.key)} details`}
            className='rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-[#002EFF]'
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className='pb-4'>
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4'>
              <div className='space-y-2 lg:col-span-1'>
                <p className='text-[9px] font-black uppercase text-slate-400'>By department</p>
                {(g.byDepartment ?? []).map((d) => (
                  <RateBar key={d.key} label={titleCase(d.key)} value={d.attendanceRate} sub={`${d.students} st.`} />
                ))}
                <p className='pt-2 text-[9px] font-black uppercase text-slate-400'>By class</p>
                {(g.byClass ?? []).map((d) => (
                  <RateBar key={d.key} label={d.key} value={d.attendanceRate} sub={`${d.students} st.`} />
                ))}
              </div>
              <div className='lg:col-span-2'>
                <p className='mb-2 text-[9px] font-black uppercase text-slate-400'>Trend</p>
                {g.trend && g.trend.length ? (
                  <TrendColumns
                    label={`${trackLabel(g.key)} attendance over time`}
                    points={g.trend}
                    bucket={bucket}
                    value={(p) => p.attendanceRate}
                    detail={(p) => `${p.present} of ${p.eligible} check-ins`}
                    tint={(v) => rateTint(v)}
                  />
                ) : (
                  <Empty>No sessions for this track in the period.</Empty>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ---------------- Performance ---------------- */

function GroupTable({ rows, label }: { rows: PerformanceGroup[]; label: (k: string) => string }) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full min-w-[560px] text-left'>
        <thead>
          <tr className='text-[9px] font-black uppercase text-slate-400'>
            <th className='py-2 pr-3'>Group</th>
            <th className='py-2 pr-3 text-right'>Students</th>
            <th className='py-2 pr-3 text-right'>Taking part</th>
            <th className='py-2 pr-3 text-right'>Average</th>
            <th className='py-2 pr-3 text-right'>Pass rate</th>
            <th className='py-2 pr-3 text-right'>Completion</th>
            <th className='py-2 text-right'>Need support</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key} className='border-t border-slate-50 dark:border-slate-800 text-[11px]'>
              <td className='py-2 pr-3 font-black text-slate-800 dark:text-slate-100'>{label(g.key)}</td>
              <td className='py-2 pr-3 text-right font-bold text-slate-600'>{num(g.students)}</td>
              <td className='py-2 pr-3 text-right font-bold text-slate-600'>{pctText(g.participationRate)}</td>
              <td className='py-2 pr-3 text-right font-black text-slate-800 dark:text-slate-100'>{pctText(g.averageScore)}</td>
              <td className='py-2 pr-3 text-right font-bold text-slate-600'>{pctText(g.passRate)}</td>
              <td className='py-2 pr-3 text-right font-bold text-slate-600'>{pctText(g.completionRate)}</td>
              <td className='py-2 text-right font-bold text-slate-600'>{num(g.needingSupport)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PerformanceView({ r }: { r: PerformanceReport }) {
  const o = r.overall
  const [by, setBy] = useState<'track' | 'department' | 'class'>('track')
  if (!o.students) return <Empty>No students match these filters.</Empty>
  const maxBand = Math.max(1, ...o.distribution.map((b) => b.results))
  return (
    <>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <StatTile
          label='Average score'
          value={pctText(o.averageScore)}
          sub={o.results ? `${num(o.results)} results · all results ${pctText(o.resultAverage)}` : 'No results yet'}
          icon={TrendingUp}
          tint='bg-blue-50 text-[#002EFF]'
        />
        <StatTile
          label={`Pass rate (≥ ${r.settings.passMark}%)`}
          value={pctText(o.passRate)}
          sub={`${num(o.passes)} passed · ${num(o.fails)} below`}
          icon={Award}
          tint='bg-emerald-50 text-emerald-600'
        />
        <StatTile
          label='Taking part'
          value={pctText(o.participationRate)}
          sub={`${num(o.participants)} of ${num(o.students)} students`}
          icon={Users}
          tint='bg-amber-50 text-amber-600'
        />
        <StatTile
          label='Completion'
          value={pctText(o.completionRate)}
          sub={`${num(o.missed)} missed · ${num(o.notYetTaken)} still open`}
          icon={ClipboardCheck}
          tint='bg-violet-50 text-violet-600'
        />
      </div>

      {o.results === 0 ? (
        <Empty>
          No quiz or test results were recorded for these students between {r.range.from} and {r.range.to}, so no
          average or pass rate is shown.
        </Empty>
      ) : (
        <>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Section title={`Average score by ${r.range.bucket}`} icon={TrendingUp}>
              <TrendColumns
                label='Average score over time'
                points={r.trend}
                bucket={r.range.bucket}
                value={(p) => p.averageScore}
                detail={(p) => `${p.results} result${p.results === 1 ? '' : 's'} · pass rate ${pctText(p.passRate)}`}
                tint={(v) => rateTint(v, r.settings.passMark)}
              />
            </Section>
            <Section title='Score distribution' icon={BarChart3}>
              <div className='space-y-2.5'>
                {o.distribution.map((b) => (
                  <div key={b.band} className='flex items-center gap-3'>
                    <span className='w-14 shrink-0 text-right text-[10px] font-black text-slate-600'>{b.band}</span>
                    <div className='h-5 flex-1 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/80'>
                      <div
                        className='h-full rounded-lg bg-[#002EFF] motion-safe:transition-all'
                        style={{ width: `${(b.results / maxBand) * 100}%` }}
                      />
                    </div>
                    <span className='w-10 shrink-0 text-[10px] font-black text-slate-600'>{b.results}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <Section
            title='Breakdown'
            icon={BarChart3}
            action={
              <div className='flex gap-1'>
                {(['track', 'department', 'class'] as const).map((k) => (
                  <button
                    key={k}
                    type='button'
                    onClick={() => setBy(k)}
                    className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase ${
                      by === k ? 'bg-blue-50 text-[#002EFF]' : 'text-slate-400 hover:text-[#002EFF]'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            }
          >
            <GroupTable
              rows={by === 'track' ? r.byTrack : by === 'department' ? r.byDepartment : r.byClass}
              label={by === 'track' ? trackLabel : by === 'department' ? titleCase : (k) => k}
            />
          </Section>

          {(r.bySubject.length > 0 || r.byCourse.length > 0) && (
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              <Section title='By subject' icon={BarChart3}>
                <div className='space-y-2.5'>
                  {r.bySubject.slice(0, 12).map((x) => (
                    <RateBar key={x.key} label={x.key} value={x.averageScore} sub={`${x.results} res.`} />
                  ))}
                </div>
              </Section>
              <Section title='By course' icon={BarChart3}>
                {r.byCourse.length ? (
                  <div className='space-y-2.5'>
                    {r.byCourse.map((x) => (
                      <RateBar key={x.courseId} label={x.title} value={x.averageScore} sub={`${x.results} res.`} />
                    ))}
                  </div>
                ) : (
                  <Empty>None of these results are on course-linked quizzes.</Empty>
                )}
              </Section>
            </div>
          )}

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>
            <Section title={`Top performers (${r.topPerformers.total})`} icon={Award}>
              <StudentTable
                list={r.topPerformers}
                empty={`No student has ${r.settings.minResults}+ results yet.`}
                columns={[
                  { label: 'Results', cell: (x) => num(x.results) },
                  { label: 'Average', cell: (x) => pctText(x.averageScore) },
                ]}
              />
            </Section>
            <Section title={`Needing support (${r.needingSupport.total})`} icon={AlertTriangle}>
              <StudentTable
                list={r.needingSupport}
                empty={`No student averages below ${r.settings.passMark}%.`}
                columns={[
                  { label: 'Results', cell: (x) => num(x.results) },
                  { label: 'Average', cell: (x) => pctText(x.averageScore) },
                ]}
              />
            </Section>
          </div>
        </>
      )}

      <Section title={`Missed assessments (${r.mostMissed.total})`} icon={ClipboardCheck}>
        <StudentTable
          list={r.mostMissed}
          empty='No closed assessment was missed in this period.'
          columns={[
            { label: 'Taken', cell: (x) => `${x.completedAssessments}/${x.expectedAssessments}` },
            { label: 'Missed', cell: (x) => num(x.missed) },
          ]}
        />
      </Section>
      <Definitions items={r.definitions} />
    </>
  )
}

/* ---------------- Combined ---------------- */

function AtRiskView({ r }: { r: AtRiskReport }) {
  const s = r.settings
  return (
    <>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <StatTile label='Low on both' value={num(r.lowAttendanceAndLowScores.total)} sub='Attendance and scores' icon={AlertTriangle} tint='bg-rose-50 text-rose-600' />
        <StatTile label='Low attendance only' value={num(r.lowAttendanceOnly)} sub={`Below ${s.lowThreshold}%`} icon={CalendarCheck} tint='bg-amber-50 text-amber-600' />
        <StatTile label='Low scores only' value={num(r.lowScoresOnly)} sub={`Average below ${s.passMark}%`} icon={TrendingUp} tint='bg-violet-50 text-violet-600' />
        <StatTile label='Measured on both' value={num(r.bothMeasured)} sub={`of ${num(r.students)} students`} icon={Users} tint='bg-blue-50 text-[#002EFF]' />
      </div>
      <Section title='Low attendance and low scores' icon={AlertTriangle}>
        <p className='rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800'>
          {r.definitions.caution}
        </p>
        <StudentTable
          list={r.lowAttendanceAndLowScores}
          empty={
            r.bothMeasured
              ? 'No student is low on both.'
              : `Too little data yet: a student needs ${s.minSessions}+ sessions and ${s.minResults}+ results to be measured on both.`
          }
          columns={[
            { label: 'Attendance', cell: (x) => pctText(x.attendanceRate) },
            { label: 'Average', cell: (x) => pctText(x.averageScore) },
          ]}
        />
      </Section>
      <Definitions items={r.definitions} />
    </>
  )
}
