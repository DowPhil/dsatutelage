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
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dsaApi } from '@/lib/api'
import { getToken } from '@/lib/auth'

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

const sstr = (value: unknown) =>
  value == null ? '' : String(value)

const normalizeProgramme = (value: unknown): string[] => {
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
    ),

    createdAt: sstr(
      user.createdAt,
    ),
  }
}

export default function StaffStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')

  const loadStudents = async () => {
    setLoading(true)
    setError('')

    try {
      const token = getToken() ?? undefined

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

  const tracks = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map((student) => student.track)
          .filter(Boolean),
      ),
    ).sort()
  }, [students])

  const modes = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map((student) => student.mode)
          .filter(Boolean),
      ),
    ).sort()
  }, [students])

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        student.studentId.toLowerCase().includes(query) ||
        student.department.toLowerCase().includes(query) ||
        student.programme.some((programme) =>
          programme.toLowerCase().includes(query),
        )

      const matchesTrack =
        trackFilter === 'all' ||
        student.track === trackFilter

      const matchesMode =
        modeFilter === 'all' ||
        student.mode === modeFilter

      return (
        matchesSearch &&
        matchesTrack &&
        matchesMode
      )
    })
  }, [
    students,
    search,
    trackFilter,
    modeFilter,
  ])

  const formatMode = (mode: string) => {
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

  const formatTrack = (track: string) => {
    return track
      ? track.toUpperCase()
      : '—'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#002EFF] text-white shadow-sm">
              <Users size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-[#002EFF] md:text-3xl">
                Students
              </h1>

              <p className="text-sm text-muted-foreground">
                View and manage the DSA student roster.
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={loadStudents}
          disabled={loading}
          className="gap-2"
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

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Students
              </p>

              <p className="mt-1 text-3xl font-black">
                {students.length}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#002EFF]">
              <Users size={21} />
            </div>
          </div>
        </Card>

        <Card className="border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Showing
              </p>

              <p className="mt-1 text-3xl font-black">
                {filteredStudents.length}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <Search size={21} />
            </div>
          </div>
        </Card>

        <Card className="border border-slate-200 p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Available Tracks
              </p>

              <p className="mt-1 text-3xl font-black">
                {tracks.length}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <GraduationCap size={21} />
            </div>
          </div>
        </Card>
      </div>

      {/* Search and filters */}
      <Card className="border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Search */}
          <div className="relative md:col-span-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search students..."
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-[#002EFF] focus:ring-2 focus:ring-[#002EFF]/10"
            />
          </div>

          {/* Track */}
          <select
            value={trackFilter}
            onChange={(event) =>
              setTrackFilter(event.target.value)
            }
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#002EFF] focus:ring-2 focus:ring-[#002EFF]/10"
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
              setModeFilter(event.target.value)
            }
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#002EFF] focus:ring-2 focus:ring-[#002EFF]/10"
          >
            <option value="all">
              All Learning Modes
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
        </div>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div className="flex-1">
              <p className="font-semibold text-red-700">
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

      {/* Student table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">
                Student Roster
              </h2>

              <p className="text-sm text-muted-foreground">
                Live student data from the backend.
              </p>
            </div>

            {!loading && (
              <Badge variant="secondary">
                {filteredStudents.length}{' '}
                {filteredStudents.length === 1
                  ? 'student'
                  : 'students'}
              </Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2
                size={30}
                className="animate-spin text-[#002EFF]"
              />

              <p className="text-sm">
                Loading students...
              </p>
            </div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <UserRound size={25} />
            </div>

            <h3 className="mt-4 font-bold text-slate-900">
              No students found
            </h3>

            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {students.length === 0
                ? 'There are currently no students available for your account.'
                : 'No students match your current search or filters.'}
            </p>

            {(search ||
              trackFilter !== 'all' ||
              modeFilter !== 'all') && (
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearch('')
                  setTrackFilter('all')
                  setModeFilter('all')
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                <span className="col-span-3">
                  Student
                </span>

                <span className="col-span-2">
                  Student ID
                </span>

                <span className="col-span-2">
                  Programme
                </span>

                <span className="col-span-1">
                  Level
                </span>

                <span className="col-span-1">
                  Track
                </span>

                <span className="col-span-2">
                  Mode
                </span>

                <span className="col-span-1">
                  Status
                </span>
              </div>

              {/* Rows */}
              {filteredStudents.map(
                (student) => (
                  <div
                    key={student.key}
                    className="grid grid-cols-12 gap-4 border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50 last:border-b-0"
                  >
                    {/* Student */}
                    <div className="col-span-3 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#002EFF]/10 font-bold text-[#002EFF]">
                          {student.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {student.name}
                          </p>

                          <p className="truncate text-xs text-muted-foreground">
                            {student.email || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Student ID */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-sm font-medium text-slate-700">
                        {student.studentId}
                      </span>
                    </div>

                    {/* Programme */}
                    <div className="col-span-2 flex items-center">
                      <span className="line-clamp-2 text-sm text-slate-700">
                        {student.programme.length
                          ? student.programme.join(
                              ', ',
                            )
                          : '—'}
                      </span>
                    </div>

                    {/* Level */}
                    <div className="col-span-1 flex items-center">
                      <span className="text-sm text-slate-700">
                        {student.level || '—'}
                      </span>
                    </div>

                    {/* Track */}
                    <div className="col-span-1 flex items-center">
                      <Badge
                        variant="outline"
                        className="font-semibold"
                      >
                        {formatTrack(
                          student.track,
                        )}
                      </Badge>
                    </div>

                    {/* Mode */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-sm text-slate-700">
                        {formatMode(
                          student.mode,
                        )}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-1 flex items-center">
                      <Badge
                        className={
                          student.status ===
                          'active'
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-100'
                        }
                      >
                        {student.status ||
                          '—'}
                      </Badge>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}