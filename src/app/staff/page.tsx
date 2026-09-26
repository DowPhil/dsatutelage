'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  CreditCard,
  CalendarDays,
  CalendarCheck,
  Users,
  Megaphone,
  BarChart3,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Lock,
  Send,
  LifeBuoy,
  FileQuestion,
  Library,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import SupportTickets from '@/app/admin/components/SupportTickets'
import { OfflineQueueSection } from '@/app/admin/components/PaymentsAdmin'
import QuizBuilder from '@/app/admin/components/QuizBuilder'
import QuestionBank from '@/components/dashboard/QuestionBank'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DashboardShell, {
  type NavItem,
} from '@/components/dashboard/DashboardShell'
import { useDashboardSession } from '@/components/dashboard/useDashboardSession'
import { useTabState } from '@/components/dashboard/useTabState'
import TakeAttendance from '@/components/dashboard/TakeAttendance'
import TimetableEditor from '@/components/dashboard/TimetableEditor'
import { getStudents, type StoredStudent } from '@/lib/studentsStore'
import { dsaApi, isBackendUnreachable } from '@/lib/api'
import { getToken } from '@/lib/auth'
import {
  getRole,
  getPermissionsForStaff,
  permissionLabel,
} from '@/lib/staffStore'
import {
  DAYS,
  SLOTS,
  getEffectiveTimetable,
  tintForSubject,
  type TimetableGrid,
} from '@/lib/timetable'
import type { ExamTrack } from '@/lib/studentProfile'

// --- manual-payment status (browser-local stand-in for POST /api/payments/manual) ---
interface ManualPayment {
  method: string
  reference: string
  by: string
  at: string
}
const PAY_KEY = 'dsa_manual_payments'
function readPayments(): Record<string, ManualPayment> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(PAY_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function StaffDashboard() {
  const { user, loading, logout } = useDashboardSession('staff')
  const [view, setView] = useTabState<string>('overview')

  // Permissions resolved live from the staff member's role. The backend supplies
  // them directly on /auth/me (user.permissions) — that's authoritative for a
  // real account. The localStorage staffStore lookups are only the demo/preview
  // fallback (and can't match a backend ObjectId staffRoleId anyway).
  const permissions = useMemo(() => {
    if (!user) return []
    return (
      (user.permissions && user.permissions.length ? user.permissions : null) ||
      (user.staffRoleId && getRole(user.staffRoleId)?.permissions) ||
      getPermissionsForStaff(user.email) ||
      []
    )
  }, [user])

  const can = (p: string) => permissions.includes(p)

  const nav: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    ]
    if (can('payments.verify') || can('payments.view'))
      items.push({ key: 'payments', label: 'Payments', icon: CreditCard })
    if (can('timetable.edit') || can('timetable.view'))
      items.push({ key: 'timetable', label: 'Timetable', icon: CalendarDays })
    if (can('attendance.manage'))
      items.push({ key: 'attendance', label: 'Attendance', icon: CalendarCheck })
    if (can('students.manage') || can('students.view'))
      items.push({ key: 'students', label: 'Students', icon: Users })
    if (
      can('quizzes.create') ||
      can('quizzes.manage') ||
      can('quizzes.delete') ||
      can('quizzes.view')
    )
      items.push({ key: 'quizzes', label: 'Quizzes', icon: FileQuestion })
    if (can('questions.bank'))
      items.push({ key: 'question-bank', label: 'Question Bank', icon: Library })
    if (can('announcements.send'))
      items.push({ key: 'announcements', label: 'Announcements', icon: Megaphone })
    if (can('reports.view'))
      items.push({ key: 'reports', label: 'Reports', icon: BarChart3 })
    if (can('support.view'))
      items.push({ key: 'support', label: 'Support', icon: LifeBuoy })
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions])

  // If the active view is no longer permitted (role changed), fall back.
  useEffect(() => {
    if (!nav.some((n) => n.key === view)) setView('overview')
  }, [nav, view])

  if (loading || !user) {
    return (
      <div className='h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFF]'>
        <Loader2 className='text-[#002EFF] animate-spin mb-4' size={40} />
        <p className='text-[10px] font-black uppercase tracking-[0.2em] text-[#002EFF]'>
          Loading Staff Portal
        </p>
      </div>
    )
  }

  const roleName =
    user.staffRole ||
    (user.staffRoleId && getRole(user.staffRoleId)?.name) ||
    'Staff'
  const name = user.fullName || user.username || 'Staff'
  const firstName = name.split(' ')[0]

  return (
    <DashboardShell
      roleLabel={roleName}
      userName={name}
      userAvatar={user.avatarUrl}
      nav={nav}
      activeKey={view}
      onNavigate={setView}
      onLogout={logout}
    >
      {view === 'overview' && (
        <OverviewPanel
          firstName={firstName}
          roleName={roleName}
          permissions={permissions}
          onGo={setView}
          canPayments={can('payments.verify') || can('payments.view')}
          canTimetable={can('timetable.edit') || can('timetable.view')}
        />
      )}

      {view === 'payments' && (
        <div className='space-y-4'>
          <div>
            <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>Payments</h2>
            <p className='text-[11px] font-bold text-slate-400'>
              {can('payments.verify')
                ? 'Receipts students uploaded. Confirm the transfer to keep their access, or reject it with a reason.'
                : 'Receipts students uploaded, read only. Ask an admin for payments.verify to confirm them.'}
            </p>
          </div>
          <OfflineQueueSection token={getToken() ?? undefined} canReview={can('payments.verify')} />
        </div>
      )}

      {view === 'timetable' &&
        (can('timetable.edit') ? <TimetableEditor /> : <TimetableReadOnly />)}

      {view === 'attendance' && <TakeAttendance />}

      {view === 'students' && <StudentsPanel canManage={can('students.manage')} />}

      {view === 'quizzes' && <QuizBuilder />}

      {view === 'question-bank' && <QuestionBank />}

      {view === 'announcements' && <AnnouncementsPanel staffName={firstName} />}

      {view === 'reports' && <ReportsPanel />}

      {view === 'support' && <SupportTickets />}
    </DashboardShell>
  )
}

/* ---------------------------------------------------------------- */
function OverviewPanel({
  firstName,
  roleName,
  permissions,
  onGo,
  canPayments,
  canTimetable,
}: {
  firstName: string
  roleName: string
  permissions: string[]
  onGo: (v: string) => void
  canPayments: boolean
  canTimetable: boolean
}) {
  const [pending, setPending] = useState(0)
  useEffect(() => {
    const paid = readPayments()
    setPending(getStudents().filter((s) => !paid[s.key]).length)
  }, [])

  return (
    <div className='space-y-6'>
      <section className='relative overflow-hidden bg-[#002EFF] rounded-4xl p-8 text-white shadow-lg'>
        <h1 className='text-2xl md:text-3xl font-black uppercase italic tracking-tight'>
          Welcome, <span className='text-[#FCB900]'>{firstName}</span>
        </h1>
        <p className='text-blue-100 text-xs md:text-sm mt-2 font-medium'>
          You are signed in as{' '}
          <span className='font-black text-white'>{roleName}</span>. Your access
          is limited to the tools your role permits.
        </p>
      </section>

      <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
        {canPayments && (
          <button onClick={() => onGo('payments')} className='text-left'>
            <Card className='p-4 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3 hover:shadow-md transition-all'>
              <div className='h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600'>
                <CreditCard size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p className='text-[8px] font-black text-gray-400 uppercase leading-none mb-1'>
                  Awaiting Payment
                </p>
                <p className='text-lg font-black text-gray-900 leading-none'>
                  {pending}
                </p>
              </div>
            </Card>
          </button>
        )}
        {canTimetable && (
          <button onClick={() => onGo('timetable')} className='text-left'>
            <Card className='p-4 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3 hover:shadow-md transition-all'>
              <div className='h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600'>
                <CalendarDays size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p className='text-[8px] font-black text-gray-400 uppercase leading-none mb-1'>
                  Timetable
                </p>
                <p className='text-lg font-black text-gray-900 leading-none'>
                  Manage
                </p>
              </div>
            </Card>
          </button>
        )}
      </div>

      <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
        <div className='flex items-center gap-2 mb-4'>
          <ShieldCheck size={16} className='text-[#002EFF]' />
          <h3 className='text-sm font-black uppercase text-gray-800'>
            Your Permissions
          </h3>
        </div>
        {permissions.length === 0 ? (
          <p className='text-xs text-gray-400 font-medium'>
            No permissions assigned yet. Ask an admin to update your role in the
            admin panel.
          </p>
        ) : (
          <div className='flex flex-wrap gap-2'>
            {permissions.map((p) => (
              <span
                key={p}
                className='px-3 py-1.5 rounded-lg bg-blue-50 text-[#002EFF] text-[10px] font-black uppercase tracking-wide'
              >
                {permissionLabel(p)}
              </span>
            ))}
          </div>
        )}
        <p className='text-[10px] text-gray-400 font-medium mt-4 border-t border-slate-50 pt-3'>
          Permissions are set by an admin under <b>Permissions → Role
          Permissions</b>, and enforced by the backend on every action.
        </p>
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */
const sstr = (v: unknown) => (v == null ? '' : String(v))

type RosterStudent = {
  key: string
  name: string
  track: string
  mode: string
  isNew: boolean
  paid: boolean
}

/** Live student roster for staff (GET /staff/students). Falls back to the local
 *  cache only when the backend is genuinely unreachable. */
function useLiveStudents() {
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    const WEEK = 7 * 24 * 60 * 60 * 1000
    const normalize = (u: Record<string, unknown>): RosterStudent => {
      const created = u.createdAt ? new Date(sstr(u.createdAt)).getTime() : 0
      const lvl = sstr(u.accessLevel)
      return {
        key: sstr(u.id ?? u._id ?? u.email),
        name: sstr(u.fullname ?? u.fullName ?? u.username ?? 'Student'),
        track:
          (sstr(u.examTrack ?? u.level ?? u.currentLevel) || '—').toUpperCase(),
        mode: sstr(u.learningMode),
        isNew: created > 0 && Date.now() - created < WEEK,
        paid: lvl === 'portal' || lvl === 'tutorial',
      }
    }
    ;(async () => {
      try {
        const rows = (await dsaApi.staff.students(
          getToken() ?? undefined,
        )) as Record<string, unknown>[]
        if (!cancelled) setStudents(rows.map(normalize))
      } catch (e) {
        // Only fall back to the local cache if the backend is truly unreachable.
        if (!cancelled && isBackendUnreachable(e)) {
          setStudents(
            getStudents().map((s) => ({
              key: s.key,
              name: s.name,
              track: sstr(s.track),
              mode: sstr(s.mode),
              isNew: !!s.isNew,
              paid: false,
            })),
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return { students, loading }
}

/* ---------------------------------------------------------------- */
function StudentsPanel({ canManage }: { canManage: boolean }) {
  const { students, loading } = useLiveStudents()
  return (
    <div className='space-y-4'>
      <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
        Students {canManage ? '' : '(view only)'}
      </h2>
      <Card className='rounded-3xl border-none shadow-sm bg-white overflow-hidden'>
        <div className='grid grid-cols-12 px-5 py-3 bg-slate-50 text-[9px] font-black uppercase text-gray-400'>
          <span className='col-span-6'>Student</span>
          <span className='col-span-3'>Track</span>
          <span className='col-span-3'>Mode</span>
        </div>
        {loading ? (
          <div className='py-8 flex justify-center'>
            <Loader2 className='animate-spin text-[#002EFF]' size={18} />
          </div>
        ) : students.length === 0 ? (
          <p className='px-5 py-8 text-center text-[11px] font-bold text-slate-400'>
            No students yet.
          </p>
        ) : (
          students.map((s) => (
            <div
              key={s.key}
              className='grid grid-cols-12 items-center px-5 py-4 border-t border-slate-50'
            >
              <span className='col-span-6 text-xs font-black text-gray-800'>
                {s.name}
                {s.isNew && (
                  <span className='ml-2 text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded'>
                    New
                  </span>
                )}
              </span>
              <span className='col-span-3'>
                <Badge className='bg-blue-50 text-[#002EFF] text-[8px] font-black'>
                  {s.track}
                </Badge>
              </span>
              <span className='col-span-3 text-[10px] font-bold text-slate-500'>
                {s.mode === 'physical'
                  ? 'On-Campus'
                  : s.mode === 'online'
                    ? 'Online'
                    : '—'}
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------------- */
function AnnouncementsPanel({ staffName }: { staffName: string }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <div className='space-y-4 max-w-xl'>
      <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
        Send Announcement
      </h2>
      <Card className='p-6 rounded-3xl border-none shadow-sm bg-white space-y-4'>
        {sent && (
          <div className='flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold'>
            <CheckCircle2 size={15} /> Announcement queued (demo). The backend
            will deliver it to students.
          </div>
        )}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setSent(false)
          }}
          placeholder='Title'
          className='w-full h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
        />
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            setSent(false)
          }}
          placeholder='Write your message to students…'
          rows={5}
          className='w-full px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium resize-none'
        />
        <div className='flex items-center justify-between'>
          <p className='text-[10px] font-bold text-slate-400'>By {staffName}</p>
          <Button
            disabled={title.trim().length < 2 || body.trim().length < 2}
            onClick={() => {
              setSent(true)
              setTitle('')
              setBody('')
            }}
            className='bg-[#002EFF] text-white rounded-xl font-black text-[10px] uppercase gap-2'
          >
            <Send size={13} /> Send
          </Button>
        </div>
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------------- */
function ReportsPanel() {
  const { students } = useLiveStudents()
  const paidCount = students.filter((s) => s.paid).length
  const tiles = [
    { label: 'Total Students', value: students.length },
    { label: 'Paid (Portal/Tutorial)', value: paidCount },
    { label: 'Free (not yet paid)', value: students.length - paidCount },
  ]
  return (
    <div className='space-y-4'>
      <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
        Reports
      </h2>
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        {tiles.map((t) => (
          <Card
            key={t.label}
            className='p-6 rounded-3xl border-none shadow-sm bg-white'
          >
            <p className='text-[9px] font-black uppercase text-gray-400 mb-2'>
              {t.label}
            </p>
            <p className='text-3xl font-black text-[#002EFF]'>{t.value}</p>
          </Card>
        ))}
      </div>
      <p className='text-[10px] font-medium text-slate-400'>
        Read-only figures. Full analytics come from the backend reporting
        endpoints.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- */
function TimetableReadOnly() {
  const TRACKS: { id: ExamTrack; label: string }[] = [
    { id: 'jamb', label: 'JAMB' },
    { id: 'waec', label: 'WAEC' },
    { id: 'postutme', label: 'Post-UTME' },
  ]
  const [track, setTrack] = useState<ExamTrack>('jamb')
  const [grid, setGrid] = useState<TimetableGrid>([])
  useEffect(() => setGrid(getEffectiveTimetable(track)), [track])

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
          Timetable (view only)
        </h2>
        <div className='flex gap-1.5'>
          {TRACKS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTrack(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                track === t.id
                  ? 'bg-[#002EFF] text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Card className='rounded-3xl border-none shadow-sm bg-white overflow-x-auto'>
        <table className='w-full text-left min-w-[640px]'>
          <thead>
            <tr className='bg-slate-50'>
              <th className='px-4 py-3 text-[9px] font-black uppercase text-gray-400'>
                Period
              </th>
              {DAYS.map((d) => (
                <th
                  key={d}
                  className='px-4 py-3 text-[9px] font-black uppercase text-gray-400'
                >
                  {d.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot, r) => (
              <tr key={slot.label} className='border-t border-slate-50'>
                <td className='px-4 py-3'>
                  <p className='text-[10px] font-black text-slate-700'>
                    {slot.label}
                  </p>
                  <p className='text-[9px] font-bold text-slate-400'>
                    {slot.time}
                  </p>
                </td>
                {DAYS.map((d, c) => {
                  const cell = grid[r]?.[c] ?? []
                  return (
                    <td key={d} className='px-3 py-3'>
                      {cell.length ? (
                        <div className='flex flex-col gap-1'>
                          {cell.map((s, i) => (
                            <span
                              key={i}
                              className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black ${tintForSubject(s)}`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className='text-[10px] text-slate-300'>—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
