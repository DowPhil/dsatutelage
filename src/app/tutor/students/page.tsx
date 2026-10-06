'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  Search,
  Users,
  Wifi,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { dsaApi } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'

type Course = {
  id: string
  title: string
  subject?: string
  category?: string
  classLevel?: string
}

type TutorStudent = {
  id: string
  studentId?: string
  fullname: string
  email?: string
  phone?: string
  whatsappNumber?: string
  programmes?: string[]
  department?: string
  level?: string
  examTrack?: string
  learningMode?: string
  status?: string
  createdAt?: string | null
  averageScore?: number | null
  avg?: number | null
  progressPercent?: number
  progress?: number
  courses?: Course[]
}

const TRACK_LABEL: Record<
  string,
  string
> = {
  jamb: 'JAMB',
  waec: 'WAEC',
  postutme: 'Post-UTME',
}

function initials(
  name: string,
) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase() ??
        '',
    )
    .join('')
}

function formatTrack(
  track?: string,
) {
  if (!track) return '—'

  const key =
    track.toLowerCase()

  return (
    TRACK_LABEL[key] ??
    track
  )
}

function formatDate(
  date?: string | null,
) {
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

function scoreClass(
  score?: number | null,
) {
  if (score == null)
    return 'text-slate-400'

  if (score >= 70)
    return 'text-emerald-600'

  if (score >= 50)
    return 'text-amber-600'

  return 'text-rose-500'
}

function progressClass(
  progress: number,
) {
  if (progress >= 70)
    return 'bg-emerald-500'

  if (progress >= 40)
    return 'bg-amber-500'

  return 'bg-rose-500'
}

function StudentCard({
  student,
}: {
  student: TutorStudent
}) {
  const [
    expanded,
    setExpanded,
  ] = useState(false)

  const score =
    student.averageScore ??
    student.avg ??
    null

  const progress = Math.min(
    Math.max(
      Number(
        student.progressPercent ??
          student.progress ??
          0,
      ),
      0,
    ),
    100,
  )

  return (
    <Card className="group rounded-3xl border border-slate-100 shadow-sm bg-white overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-[#002EFF] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              {initials(
                student.fullname,
              )}
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-black text-gray-900 truncate">
                {student.fullname}
              </h3>

              <p className="text-[10px] font-medium text-gray-400 truncate mt-0.5">
                {student.studentId ||
                  'Student ID unavailable'}
              </p>
            </div>
          </div>

          <Badge
            className={`shrink-0 text-[8px] font-black ${
              student.status ===
              'active'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {student.status ??
              'active'}
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[8px] font-black uppercase text-slate-400">
              Average
            </p>

            <p
              className={`text-lg font-black mt-1 ${scoreClass(
                score,
              )}`}
            >
              {score == null
                ? '—'
                : `${score}%`}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[8px] font-black uppercase text-slate-400">
              Progress
            </p>

            <p className="text-lg font-black text-[#002EFF] mt-1">
              {progress}%
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-black uppercase text-slate-400">
              Learning progress
            </span>

            <span className="text-[9px] font-black text-slate-500">
              {progress}%
            </span>
          </div>

          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressClass(
                progress,
              )}`}
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="flex items-center gap-2 rounded-xl bg-blue-50/70 px-3 py-2">
            <GraduationCap
              size={14}
              className="text-[#002EFF] shrink-0"
            />

            <span className="text-[9px] font-bold text-slate-600 truncate">
              {formatTrack(
                student.examTrack,
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-emerald-50/70 px-3 py-2">
            <Wifi
              size={14}
              className="text-emerald-600 shrink-0"
            />

            <span className="text-[9px] font-bold text-slate-600 truncate">
              {student.learningMode ===
              'physical'
                ? 'On-Campus'
                : student.learningMode ===
                    'online'
                  ? 'Online'
                  : '—'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setExpanded(
              (value) => !value,
            )
          }
          className="w-full mt-4 h-10 rounded-xl bg-slate-50 hover:bg-blue-50 text-[#002EFF] text-[9px] font-black uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
        >
          {expanded
            ? 'Hide Details'
            : 'View More'}

          {expanded ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown
              size={14}
            />
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-5 space-y-5">
          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-3">
              Contact Information
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Mail
                  size={14}
                  className="text-[#002EFF] shrink-0"
                />

                <span className="text-[10px] font-medium text-slate-600 break-all">
                  {student.email ||
                    'No email available'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Phone
                  size={14}
                  className="text-[#002EFF] shrink-0"
                />

                <span className="text-[10px] font-medium text-slate-600">
                  {student.phone ||
                    'No phone available'}
                </span>
              </div>

              {student.whatsappNumber && (
                <div className="flex items-center gap-3">
                  <Phone
                    size={14}
                    className="text-emerald-600 shrink-0"
                  />

                  <span className="text-[10px] font-medium text-slate-600">
                    WhatsApp:{' '}
                    {
                      student.whatsappNumber
                    }
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-3">
              Academic Information
            </p>

            <div className="grid grid-cols-2 gap-2">
              <InfoItem
                label="Level"
                value={
                  student.level ||
                  '—'
                }
              />

              <InfoItem
                label="Department"
                value={
                  student.department ||
                  '—'
                }
              />

              <InfoItem
                label="Exam Track"
                value={formatTrack(
                  student.examTrack,
                )}
              />

              <InfoItem
                label="Learning Mode"
                value={
                  student.learningMode ===
                  'physical'
                    ? 'On-Campus'
                    : student.learningMode ===
                        'online'
                      ? 'Online'
                      : '—'
                }
              />
            </div>

            <div className="mt-2">
              <InfoItem
                label="Programme"
                value={
                  student.programmes
                    ?.length
                    ? student.programmes.join(
                        ', ',
                      )
                    : '—'
                }
              />
            </div>
          </div>

          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-3">
              Courses With You
            </p>

            {student.courses
                ?.length ? (
              <div className="space-y-2">
                {student.courses.map(
                  (course) => (
                    <div
                      key={
                        course.id
                      }
                      className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-100"
                    >
                      <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <BookOpen
                          size={14}
                          className="text-[#002EFF]"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-800">
                          {
                            course.title
                          }
                        </p>

                        <p className="text-[8px] text-slate-400 mt-0.5">
                          {course.subject ||
                            course.category ||
                            'Course'}

                          {course.classLevel
                            ? ` • ${course.classLevel}`
                            : ''}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">
                No course information available.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-[9px] text-slate-400">
            <Clock3 size={13} />

            <span>
              Joined{' '}
              {formatDate(
                student.createdAt,
              )}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 p-3">
      <p className="text-[7px] font-black uppercase text-slate-400">
        {label}
      </p>

      <p className="text-[9px] font-bold text-slate-700 mt-1 break-words">
        {value}
      </p>
    </div>
  )
}

export default function TutorStudentsPage() {
  const [
    students,
    setStudents,
  ] = useState<
    TutorStudent[]
  >([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    trackFilter,
    setTrackFilter,
  ] = useState('all')

  const [
    levelFilter,
    setLevelFilter,
  ] = useState('all')

  const [
    modeFilter,
    setModeFilter,
  ] = useState('all')

  useEffect(() => {
    let cancelled = false

    async function loadStudents() {
      try {
        setLoading(true)
        setError('')

        const token =
          getToken()

        if (
          !token ||
          isDemoToken(token)
        ) {
          throw new Error(
            'The tutor student roster requires a live tutor account.',
          )
        }

        const response =
          await dsaApi.analytics.tutorStudents()

        if (cancelled) return

        const rows =
          Array.isArray(response)
            ? response
            : []

        setStudents(
          rows as TutorStudent[],
        )
      } catch (err) {
        if (cancelled) return

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load students.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadStudents()

    return () => {
      cancelled = true
    }
  }, [])

  const levels =
    useMemo(() => {
      return Array.from(
        new Set(
          students
            .map(
              (student) =>
                student.level?.trim(),
            )
            .filter(Boolean),
        ),
      ).sort()
    }, [students])

  const filteredStudents =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      return students.filter(
        (student) => {
          const matchesSearch =
            !query ||
            [
              student.fullname,
              student.studentId,
              student.email,
              student.department,
              ...(student.programmes ??
                []),
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(query),
              )

          const matchesTrack =
            trackFilter ===
              'all' ||
            String(
              student.examTrack ??
                '',
            ).toLowerCase() ===
              trackFilter

          const matchesLevel =
            levelFilter ===
              'all' ||
            student.level ===
              levelFilter

          const matchesMode =
            modeFilter ===
              'all' ||
            String(
              student.learningMode ??
                '',
            ).toLowerCase() ===
              modeFilter

          return (
            matchesSearch &&
            matchesTrack &&
            matchesLevel &&
            matchesMode
          )
        },
      )
    }, [
      students,
      search,
      trackFilter,
      levelFilter,
      modeFilter,
    ])

  const average =
    students.length
      ? Math.round(
          students.reduce(
            (total, student) =>
              total +
              Number(
                student.averageScore ??
                  student.avg ??
                  0,
              ),
            0,
          ) / students.length,
        )
      : 0

  return (
    <div className="min-h-screen bg-[#F8FAFF] p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() =>
                window.location.assign(
                  '/tutor?tab=overview',
                )
              }
              className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-wide text-slate-400 hover:text-[#002EFF] transition-colors mb-3"
            >
              <ArrowLeft
                size={14}
              />
              Back to Dashboard
            </button>

            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-[#002EFF] text-white flex items-center justify-center shadow-lg">
                <Users
                  size={22}
                />
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-[#002EFF]">
                  My Students
                </h1>

                <p className="text-[10px] md:text-xs text-slate-400 font-medium mt-1">
                  Students enrolled in your assigned courses.
                </p>
              </div>
            </div>
          </div>

          <Badge className="w-fit bg-emerald-50 text-emerald-600 text-[9px] font-black px-3 py-1.5">
            Live Tutor Roster
          </Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="Total Students"
            value={students.length}
            icon={Users}
          />

          <SummaryCard
            label="Showing"
            value={
              filteredStudents.length
            }
            icon={Search}
          />

          <SummaryCard
            label="Average Score"
            value={`${average}%`}
            icon={CheckCircle2}
          />

          <SummaryCard
            label="Courses"
            value={
              new Set(
                students.flatMap(
                  (student) =>
                    (
                      student.courses ??
                      []
                    ).map(
                      (course) =>
                        course.id,
                    ),
                ),
              ).size
            }
            icon={BookOpen}
          />
        </div>

        <Card className="rounded-3xl border-none shadow-sm bg-white p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative lg:col-span-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Search students..."
                className="w-full h-11 rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-xs font-medium outline-none focus:border-[#002EFF] focus:bg-white transition"
              />
            </div>

            <select
              value={trackFilter}
              onChange={(event) =>
                setTrackFilter(
                  event.target
                    .value,
                )
              }
              className="h-11 rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none focus:border-[#002EFF]"
            >
              <option value="all">
                All Exam Tracks
              </option>

              <option value="jamb">
                JAMB
              </option>

              <option value="waec">
                WAEC
              </option>

              <option value="postutme">
                Post-UTME
              </option>
            </select>

            <select
              value={levelFilter}
              onChange={(event) =>
                setLevelFilter(
                  event.target
                    .value,
                )
              }
              className="h-11 rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none focus:border-[#002EFF]"
            >
              <option value="all">
                All Levels
              </option>

              {levels.map(
                (level) => (
                  <option
                    key={level}
                    value={level}
                  >
                    {level}
                  </option>
                ),
              )}
            </select>

            <select
              value={modeFilter}
              onChange={(event) =>
                setModeFilter(
                  event.target
                    .value,
                )
              }
              className="h-11 rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none focus:border-[#002EFF]"
            >
              <option value="all">
                All Learning Modes
              </option>

              <option value="online">
                Online
              </option>

              <option value="physical">
                On-Campus
              </option>
            </select>
          </div>
        </Card>

        {loading && (
          <Card className="rounded-3xl border-none shadow-sm bg-white p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2
                size={36}
                className="animate-spin text-[#002EFF] mb-4"
              />

              <p className="text-xs font-black uppercase tracking-wide text-[#002EFF]">
                Loading Students
              </p>

              <p className="text-[10px] text-slate-400 mt-1">
                Fetching your live tutor roster...
              </p>
            </div>
          </Card>
        )}

        {!loading &&
          error && (
            <Card className="rounded-3xl border-none shadow-sm bg-white p-8">
              <div className="text-center">
                <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
                  <Users
                    size={22}
                  />
                </div>

                <h3 className="text-sm font-black text-slate-800">
                  Unable to load students
                </h3>

                <p className="text-[10px] text-slate-400 mt-2 max-w-md mx-auto">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    window.location.reload()
                  }
                  className="mt-4 h-9 px-4 rounded-xl bg-[#002EFF] text-white text-[9px] font-black uppercase"
                >
                  Try Again
                </button>
              </div>
            </Card>
          )}

        {!loading &&
          !error &&
          filteredStudents.length ===
            0 && (
            <Card className="rounded-3xl border-none shadow-sm bg-white p-12">
              <div className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-blue-50 text-[#002EFF] flex items-center justify-center mx-auto mb-4">
                  <Users
                    size={25}
                  />
                </div>

                <h3 className="text-sm font-black text-slate-800">
                  {students.length
                    ? 'No students match your filters'
                    : 'No students yet'}
                </h3>

                <p className="text-[10px] text-slate-400 mt-2">
                  {students.length
                    ? 'Try changing your search or filters.'
                    : 'Students enrolled in your courses will appear here.'}
                </p>
              </div>
            </Card>
          )}

        {!loading &&
          !error &&
          filteredStudents.length >
            0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredStudents.map(
                (student) => (
                  <StudentCard
                    key={
                      student.id
                    }
                    student={
                      student
                    }
                  />
                ),
              )}
            </div>
          )}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: any
}) {
  return (
    <Card className="rounded-2xl border-none shadow-sm bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#002EFF] flex items-center justify-center shrink-0">
          <Icon
            size={18}
            strokeWidth={2.5}
          />
        </div>

        <div>
          <p className="text-[8px] font-black uppercase text-slate-400">
            {label}
          </p>

          <p className="text-lg font-black text-slate-900 mt-0.5">
            {value}
          </p>
        </div>
      </div>
    </Card>
  )
}