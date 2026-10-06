'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  Search,
  Users,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserRound,
  GraduationCap,
  Mail,
  Phone,
  Building2,
  BookOpen,
  Monitor,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  UserX,
  UserCheck,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { dsaApi } from '@/lib/api'
import { getToken } from '@/lib/auth'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Student = {
  key: string
  studentId: string
  name: string
  email: string
  phone: string
  programme: string[]
  level: string
  track: string
  mode: string
  department: string
  status: string
  createdAt: string
}

type ActionType =
  | 'suspend'
  | 'unsuspend'
  | 'delete'

type ConfirmAction = {
  type: ActionType
  student: Student
} | null

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const sstr = (value: unknown) =>
  value == null ? '' : String(value)

const normalizeProgramme = (
  value: unknown,
): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sstr(item).trim())
      .filter(Boolean)
  }

  if (value) {
    return [sstr(value)]
  }

  return []
}

const normalizeStudent = (
  user: Record<string, unknown>,
): Student => {
  return {
    key: sstr(
      user.id ??
        user._id ??
        user.studentId ??
        user.email,
    ),

    studentId: sstr(
      user.studentId ??
        user.id ??
        user._id ??
        '—',
    ),

    name: sstr(
      user.fullName ??
        user.fullname ??
        user.username ??
        'Student',
    ),

    email: sstr(user.email),

    phone: sstr(
      user.phoneNumber ??
        user.whatsappNumber ??
        user.phone,
    ),

    programme: normalizeProgramme(
      user.programmes ??
        user.programme,
    ),

    level: sstr(
      user.currentLevel ??
        user.level,
    ),

    track: sstr(
      user.examTrack ??
        user.track,
    ),

    mode: sstr(
      user.learningMode ??
        user.mode,
    ),

    department: sstr(
      user.department,
    ),

    status: sstr(
      user.status,
    ).toLowerCase(),

    createdAt: sstr(
      user.createdAt,
    ),
  }
}

// -----------------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------------

export default function StaffStudentsPage() {
  const [students, setStudents] =
    useState<Student[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [search, setSearch] =
    useState('')

  const [trackFilter, setTrackFilter] =
    useState('all')

  const [modeFilter, setModeFilter] =
    useState('all')

  const [statusFilter, setStatusFilter] =
    useState('all')

  const [expandedStudent, setExpandedStudent] =
    useState<string | null>(null)

  const [confirmAction, setConfirmAction] =
    useState<ConfirmAction>(null)

  const [actionLoading, setActionLoading] =
    useState(false)

  const [actionError, setActionError] =
    useState('')

  const [actionSuccess, setActionSuccess] =
    useState('')

  // ---------------------------------------------------------------------------
  // Load students
  // ---------------------------------------------------------------------------

  const loadStudents = async () => {
    setLoading(true)
    setError('')

    try {
      const token =
        getToken() ?? undefined

      const rows = (await dsaApi.staff.students(
        token,
      )) as Record<string, unknown>[]

      setStudents(
        Array.isArray(rows)
          ? rows.map(normalizeStudent)
          : [],
      )
    } catch (err) {
      console.error(
        'Failed to load staff students:',
        err,
      )

      setStudents([])

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load students.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudents()
  }, [])

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  const tracks = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map(
            (student) => student.track,
          )
          .filter(Boolean),
      ),
    ).sort()
  }, [students])

  const modes = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map(
            (student) => student.mode,
          )
          .filter(Boolean),
      ),
    ).sort()
  }, [students])

  const filteredStudents = useMemo(() => {
    const query =
      search.trim().toLowerCase()

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.name
          .toLowerCase()
          .includes(query) ||
        student.email
          .toLowerCase()
          .includes(query) ||
        student.studentId
          .toLowerCase()
          .includes(query) ||
        student.department
          .toLowerCase()
          .includes(query) ||
        student.programme.some(
          (programme) =>
            programme
              .toLowerCase()
              .includes(query),
        )

      const matchesTrack =
        trackFilter === 'all' ||
        student.track === trackFilter

      const matchesMode =
        modeFilter === 'all' ||
        student.mode === modeFilter

      const matchesStatus =
        statusFilter === 'all' ||
        student.status === statusFilter

      return (
        matchesSearch &&
        matchesTrack &&
        matchesMode &&
        matchesStatus
      )
    })
  }, [
    students,
    search,
    trackFilter,
    modeFilter,
    statusFilter,
  ])

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  const totalStudents =
    students.length

  const activeStudents =
    students.filter(
      (student) =>
        student.status === 'active',
    ).length

  const suspendedStudents =
    students.filter(
      (student) =>
        student.status === 'suspended',
    ).length

  const deletedStudents =
    students.filter(
      (student) =>
        student.status === 'deleted',
    ).length

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  const formatMode = (
    mode: string,
  ) => {
    switch (mode.toLowerCase()) {
      case 'physical':
        return 'On-Campus'

      case 'online':
        return 'Online'

      case 'hybrid':
        return 'Hybrid'

      default:
        return mode || '—'
    }
  }

  const formatTrack = (
    track: string,
  ) => {
    return track
      ? track.toUpperCase()
      : '—'
  }

  const formatDate = (
    date: string,
  ) => {
    if (!date) return '—'

    const parsed =
      new Date(date)

    if (
      Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return '—'
    }

    return parsed.toLocaleDateString(
      'en-NG',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      },
    )
  }

  const initials = (
    name: string,
  ) => {
    const parts =
      name.trim().split(/\s+/)

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase()
    }

    return (
      parts[0].charAt(0) +
      parts[parts.length - 1].charAt(0)
    ).toUpperCase()
  }

  const statusLabel = (
    status: string,
  ) => {
    switch (status) {
      case 'active':
        return 'Active'

      case 'suspended':
        return 'Suspended'

      case 'deleted':
        return 'Deleted'

      default:
        return status || 'Unknown'
    }
  }

  // ---------------------------------------------------------------------------
  // Student actions
  // ---------------------------------------------------------------------------
  //
  // IMPORTANT:
  // The actual backend mutation endpoints have not been provided yet.
  //
  // Do NOT fake these operations with local state because that would make the
  // UI say "suspended/deleted" while the database remains unchanged.
  //
  // Once you provide the existing backend routes / dsaApi methods, connect them
  // here.
  // ---------------------------------------------------------------------------

  const performStudentAction = async (
    action: ActionType,
    student: Student,
  ) => {
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')

    try {
      /*
       * Connect the real backend operation here.
       *
       * Example structure once your API methods exist:
       *
       * if (action === 'suspend') {
       *   await dsaApi.staff.suspendStudent(
       *     student.key,
       *     getToken() ?? undefined,
       *   )
       * }
       *
       * if (action === 'unsuspend') {
       *   await dsaApi.staff.unsuspendStudent(
       *     student.key,
       *     getToken() ?? undefined,
       *   )
       * }
       *
       * if (action === 'delete') {
       *   await dsaApi.staff.deleteStudent(
       *     student.key,
       *     getToken() ?? undefined,
       *   )
       * }
       */

      throw new Error(
        'Student management actions are not connected to the backend yet.',
      )
    } catch (err) {
      console.error(
        `Failed to ${action} student:`,
        err,
      )

      setActionError(
        err instanceof Error
          ? err.message
          : 'Unable to complete this action.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  const confirmSelectedAction =
    async () => {
      if (!confirmAction) return

      await performStudentAction(
        confirmAction.type,
        confirmAction.student,
      )
    }

  // ---------------------------------------------------------------------------
  // Clear filters
  // ---------------------------------------------------------------------------

  const clearFilters = () => {
    setSearch('')
    setTrackFilter('all')
    setModeFilter('all')
    setStatusFilter('all')
  }

  const hasFilters =
    Boolean(search) ||
    trackFilter !== 'all' ||
    modeFilter !== 'all' ||
    statusFilter !== 'all'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-full space-y-6 pb-10">

      {/* ================================================================== */}
      {/* Header */}
      {/* ================================================================== */}

      <section className="relative overflow-hidden rounded-[2rem] bg-[#002EFF] p-6 text-white shadow-xl md:p-8">

        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#FCB900]/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">

          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Users size={24} />
            </div>

            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.25em] text-blue-100">
              Staff Management
            </p>

            <h1 className="text-3xl font-black uppercase italic tracking-tight md:text-4xl">
              Students
            </h1>

            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-blue-100">
              View, search and manage the DSA
              student roster from one place.
            </p>
          </div>

          <Button
            type="button"
            onClick={loadStudents}
            disabled={loading}
            variant="outline"
            className="gap-2 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh
          </Button>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Statistics */}
      {/* ================================================================== */}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

        <StatCard
          label="Total Students"
          value={totalStudents}
          icon={Users}
          iconClass="bg-blue-50 text-[#002EFF]"
        />

        <StatCard
          label="Active"
          value={activeStudents}
          icon={UserCheck}
          iconClass="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          label="Suspended"
          value={suspendedStudents}
          icon={UserX}
          iconClass="bg-amber-50 text-amber-600"
        />

        <StatCard
          label="Deleted"
          value={deletedStudents}
          icon={Trash2}
          iconClass="bg-red-50 text-red-600"
        />

      </div>

      {/* ================================================================== */}
      {/* Search / Filters */}
      {/* ================================================================== */}

      <Card className="rounded-[1.5rem] border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">

        <div className="flex flex-col gap-4">

          <div className="flex flex-col gap-3 lg:flex-row">

            {/* Search */}
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search by name, email, ID, department or programme..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#002EFF]/40 focus:bg-white focus:ring-4 focus:ring-[#002EFF]/5"
              />
            </div>

            {/* Track */}
            <select
              value={trackFilter}
              onChange={(event) =>
                setTrackFilter(
                  event.target.value,
                )
              }
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#002EFF]/40 focus:bg-white focus:ring-4 focus:ring-[#002EFF]/5 lg:w-44"
            >
              <option value="all">
                All Tracks
              </option>

              {tracks.map((track) => (
                <option
                  key={track}
                  value={track}
                >
                  {formatTrack(track)}
                </option>
              ))}
            </select>

            {/* Mode */}
            <select
              value={modeFilter}
              onChange={(event) =>
                setModeFilter(
                  event.target.value,
                )
              }
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#002EFF]/40 focus:bg-white focus:ring-4 focus:ring-[#002EFF]/5 lg:w-48"
            >
              <option value="all">
                All Modes
              </option>

              {modes.map((mode) => (
                <option
                  key={mode}
                  value={mode}
                >
                  {formatMode(mode)}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#002EFF]/40 focus:bg-white focus:ring-4 focus:ring-[#002EFF]/5 lg:w-44"
            >
              <option value="all">
                All Statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="suspended">
                Suspended
              </option>

              <option value="deleted">
                Deleted
              </option>
            </select>

          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Search size={14} />

              <span>
                {filteredStudents.length}{' '}
                of {students.length}{' '}
                students
              </span>
            </div>

            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-2 text-xs font-bold text-slate-500 hover:text-[#002EFF]"
              >
                <X size={14} />
                Clear filters
              </Button>
            )}

          </div>
        </div>
      </Card>

      {/* ================================================================== */}
      {/* Error */}
      {/* ================================================================== */}

      {error && (
        <Card className="rounded-2xl border border-red-200 bg-red-50 p-4">

          <div className="flex items-start gap-3">

            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div className="flex-1">
              <p className="font-bold text-red-700">
                Unable to load students
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadStudents}
              className="border-red-200 bg-white text-red-700 hover:bg-red-100"
            >
              Retry
            </Button>

          </div>
        </Card>
      )}

      {/* ================================================================== */}
      {/* Action feedback */}
      {/* ================================================================== */}

      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={17} />
          {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={17} />
          {actionError}
        </div>
      )}

      {/* ================================================================== */}
      {/* Student Grid */}
      {/* ================================================================== */}

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center">

          <div className="flex flex-col items-center gap-4">

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
              <Loader2
                size={30}
                className="animate-spin text-[#002EFF]"
              />
            </div>

            <div className="text-center">
              <p className="font-bold text-slate-800">
                Loading students
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Fetching the latest student roster...
              </p>
            </div>

          </div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card className="flex min-h-[360px] flex-col items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white px-6 text-center shadow-sm">

          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <UserRound size={28} />
          </div>

          <h3 className="mt-5 text-lg font-black text-slate-900">
            No students found
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            {students.length === 0
              ? 'There are currently no students available for your account.'
              : 'No students match your current search or filter settings.'}
          </p>

          {hasFilters && (
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              className="mt-5 rounded-xl"
            >
              Clear Filters
            </Button>
          )}

        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">

          {filteredStudents.map(
            (student) => {
              const expanded =
                expandedStudent ===
                student.key

              return (
                <StudentCard
                  key={student.key}
                  student={student}
                  expanded={expanded}
                  onToggle={() =>
                    setExpandedStudent(
                      expanded
                        ? null
                        : student.key,
                    )
                  }
                  onAction={(type) => {
                    setActionError('')
                    setActionSuccess('')

                    setConfirmAction({
                      type,
                      student,
                    })
                  }}
                  formatMode={formatMode}
                  formatTrack={formatTrack}
                  formatDate={formatDate}
                  initials={initials}
                  statusLabel={statusLabel}
                />
              )
            },
          )}

        </div>
      )}

      {/* ================================================================== */}
      {/* Confirmation Modal */}
      {/* ================================================================== */}

      {confirmAction && (
        <ActionConfirmation
          action={confirmAction.type}
          student={confirmAction.student}
          loading={actionLoading}
          onCancel={() => {
            if (!actionLoading) {
              setConfirmAction(null)
              setActionError('')
            }
          }}
          onConfirm={async () => {
            await confirmSelectedAction()

            if (!actionError) {
              setConfirmAction(null)
            }
          }}
        />
      )}

    </div>
  )
}

// -----------------------------------------------------------------------------
// Stat Card
// -----------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string
  value: number
  icon: typeof Users
  iconClass: string
}) {
  return (
    <Card className="group rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">

      <div className="flex items-center justify-between gap-4">

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {value.toLocaleString()}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}
        >
          <Icon size={21} />
        </div>

      </div>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Student Card
// -----------------------------------------------------------------------------

function StudentCard({
  student,
  expanded,
  onToggle,
  onAction,
  formatMode,
  formatTrack,
  formatDate,
  initials,
  statusLabel,
}: {
  student: Student
  expanded: boolean
  onToggle: () => void
  onAction: (action: ActionType) => void
  formatMode: (mode: string) => string
  formatTrack: (track: string) => string
  formatDate: (date: string) => string
  initials: (name: string) => string
  statusLabel: (status: string) => string
}) {
  const isSuspended =
    student.status === 'suspended'

  const isDeleted =
    student.status === 'deleted'

  return (
    <Card
      className={`group overflow-hidden rounded-[1.5rem] border bg-white shadow-sm transition-all duration-300 ${
        expanded
          ? 'border-[#002EFF]/20 shadow-lg'
          : 'border-slate-200/80 hover:-translate-y-1 hover:shadow-lg'
      }`}
    >

      {/* --------------------------------------------------------------- */}
      {/* Card Header */}
      {/* --------------------------------------------------------------- */}

      <div className="p-5">

        <div className="flex items-start justify-between gap-3">

          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002EFF] to-blue-600 text-sm font-black text-white shadow-sm">
              {initials(student.name)}
            </div>

            <div className="min-w-0">
              <h3 className="truncate font-black text-slate-900">
                {student.name}
              </h3>

              <p className="mt-0.5 truncate text-xs font-medium text-slate-400">
                {student.studentId}
              </p>
            </div>

          </div>

          <StatusBadge
            status={student.status}
            label={statusLabel(
              student.status,
            )}
          />

        </div>

        {/* ------------------------------------------------------------- */}
        {/* Quick information */}
        {/* ------------------------------------------------------------- */}

        <div className="mt-5 grid grid-cols-2 gap-2">

          <InfoPill
            icon={GraduationCap}
            label="Track"
            value={formatTrack(
              student.track,
            )}
          />

          <InfoPill
            icon={Monitor}
            label="Mode"
            value={formatMode(
              student.mode,
            )}
          />

          <InfoPill
            icon={BookOpen}
            label="Level"
            value={
              student.level || '—'
            }
          />

          <InfoPill
            icon={Building2}
            label="Department"
            value={
              student.department ||
              '—'
            }
          />

        </div>

        {/* ------------------------------------------------------------- */}
        {/* Programme */}
        {/* ------------------------------------------------------------- */}

        <div className="mt-4 rounded-xl bg-slate-50 p-3">

          <div className="flex items-center gap-2">
            <GraduationCap
              size={14}
              className="text-[#002EFF]"
            />

            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
              Programme
            </span>
          </div>

          <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-700">
            {student.programme.length
              ? student.programme.join(
                  ', ',
                )
              : 'No programme specified'}
          </p>

        </div>

        {/* ------------------------------------------------------------- */}
        {/* View More */}
        {/* ------------------------------------------------------------- */}

        <Button
          type="button"
          variant="ghost"
          onClick={onToggle}
          className="mt-4 h-10 w-full rounded-xl bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600 hover:bg-blue-50 hover:text-[#002EFF]"
        >
          {expanded ? (
            <>
              Hide Details
              <ChevronUp
                size={16}
                className="ml-2"
              />
            </>
          ) : (
            <>
              View More
              <ChevronDown
                size={16}
                className="ml-2"
              />
            </>
          )}
        </Button>

      </div>

      {/* --------------------------------------------------------------- */}
      {/* Expanded Details */}
      {/* --------------------------------------------------------------- */}

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-5">

          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck
              size={16}
              className="text-[#002EFF]"
            />

            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Student Details
            </h4>
          </div>

          <div className="space-y-3">

            <DetailRow
              icon={Mail}
              label="Email"
              value={
                student.email || '—'
              }
            />

            <DetailRow
              icon={Phone}
              label="Phone"
              value={
                student.phone || '—'
              }
            />

            <DetailRow
              icon={Building2}
              label="Department"
              value={
                student.department ||
                '—'
              }
            />

            <DetailRow
              icon={GraduationCap}
              label="Programme"
              value={
                student.programme.length
                  ? student.programme.join(
                      ', ',
                    )
                  : '—'
              }
            />

            <DetailRow
              icon={BookOpen}
              label="Level"
              value={
                student.level || '—'
              }
            />

            <DetailRow
              icon={GraduationCap}
              label="Exam Track"
              value={formatTrack(
                student.track,
              )}
            />

            <DetailRow
              icon={Monitor}
              label="Learning Mode"
              value={formatMode(
                student.mode,
              )}
            />

            <DetailRow
              icon={CalendarDays}
              label="Registered"
              value={formatDate(
                student.createdAt,
              )}
            />

          </div>

          {/* ----------------------------------------------------------- */}
          {/* Management actions */}
          {/* ----------------------------------------------------------- */}

          {!isDeleted && (
            <div className="mt-5 border-t border-slate-200 pt-5">

              <p className="mb-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                Account Actions
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                {isSuspended ? (
                  <Button
                    type="button"
                    onClick={() =>
                      onAction('unsuspend')
                    }
                    className="h-10 rounded-xl bg-emerald-600 text-xs font-black uppercase text-white hover:bg-emerald-700"
                  >
                    <UserCheck
                      size={15}
                      className="mr-2"
                    />
                    Unsuspend
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() =>
                      onAction('suspend')
                    }
                    variant="outline"
                    className="h-10 rounded-xl border-amber-200 text-xs font-black uppercase text-amber-700 hover:bg-amber-50"
                  >
                    <UserX
                      size={15}
                      className="mr-2"
                    />
                    Suspend
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={() =>
                    onAction('delete')
                  }
                  variant="outline"
                  className="h-10 rounded-xl border-red-200 text-xs font-black uppercase text-red-600 hover:bg-red-50"
                >
                  <Trash2
                    size={15}
                    className="mr-2"
                  />
                  Soft Delete
                </Button>

              </div>
            </div>
          )}

          {isDeleted && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              This student account has been
              soft deleted.
            </div>
          )}

        </div>
      )}

    </Card>
  )
}

// -----------------------------------------------------------------------------
// Info Pill
// -----------------------------------------------------------------------------

function InfoPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof GraduationCap
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-white p-2.5">

      <div className="flex items-center gap-1.5">
        <Icon
          size={12}
          className="shrink-0 text-[#002EFF]"
        />

        <span className="truncate text-[8px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>

      <p className="mt-1 truncate text-[11px] font-bold text-slate-700">
        {value}
      </p>

    </div>
  )
}

// -----------------------------------------------------------------------------
// Detail Row
// -----------------------------------------------------------------------------

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white p-3">

      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#002EFF]">
        <Icon size={13} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-0.5 break-words text-xs font-bold text-slate-700">
          {value}
        </p>
      </div>

    </div>
  )
}

// -----------------------------------------------------------------------------
// Status Badge
// -----------------------------------------------------------------------------

function StatusBadge({
  status,
  label,
}: {
  status: string
  label: string
}) {
  if (status === 'active') {
    return (
      <Badge className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700 hover:bg-emerald-50">
        Active
      </Badge>
    )
  }

  if (status === 'suspended') {
    return (
      <Badge className="shrink-0 rounded-lg bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase text-amber-700 hover:bg-amber-50">
        Suspended
      </Badge>
    )
  }

  if (status === 'deleted') {
    return (
      <Badge className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase text-red-700 hover:bg-red-50">
        Deleted
      </Badge>
    )
  }

  return (
    <Badge className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase text-slate-600 hover:bg-slate-100">
      {label}
    </Badge>
  )
}

// -----------------------------------------------------------------------------
// Confirmation Modal
// -----------------------------------------------------------------------------

function ActionConfirmation({
  action,
  student,
  loading,
  onCancel,
  onConfirm,
}: {
  action: ActionType
  student: Student
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const isDelete =
    action === 'delete'

  const isUnsuspend =
    action === 'unsuspend'

  const title = isDelete
    ? 'Soft Delete Student'
    : isUnsuspend
      ? 'Unsuspend Student'
      : 'Suspend Student'

  const description = isDelete
    ? `Are you sure you want to soft delete ${student.name}? The account will no longer be treated as an active student.`
    : isUnsuspend
      ? `Are you sure you want to restore ${student.name}'s account access?`
      : `Are you sure you want to suspend ${student.name}? They will no longer be able to use their account normally.`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">

      <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] bg-white shadow-2xl">

        <div className="p-6">

          <div className="flex items-start gap-4">

            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                isDelete
                  ? 'bg-red-50 text-red-600'
                  : isUnsuspend
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
              }`}
            >
              {isDelete ? (
                <Trash2 size={22} />
              ) : isUnsuspend ? (
                <UserCheck size={22} />
              ) : (
                <AlertTriangle
                  size={22}
                />
              )}
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">
                {title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {description}
              </p>
            </div>

          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-3">

            <p className="text-xs font-black text-slate-800">
              {student.name}
            </p>

            <p className="mt-1 text-[11px] font-medium text-slate-400">
              {student.studentId}
            </p>

          </div>

          {isDelete && (
            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3">
              <p className="text-xs font-semibold leading-5 text-red-700">
                This is a soft-delete operation.
                The student's record should remain
                in the database for audit and recovery
                purposes.
              </p>
            </div>
          )}

        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4">

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onCancel}
            className="flex-1 rounded-xl"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 rounded-xl font-black ${
              isDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : isUnsuspend
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2
                  size={15}
                  className="mr-2 animate-spin"
                />
                Processing...
              </>
            ) : (
              'Confirm'
            )}
          </Button>

        </div>

      </div>
    </div>
  )
}