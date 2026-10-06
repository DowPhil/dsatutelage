// //src/components/dashboard/TakeAttendance.tsx

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CalendarCheck,
  Power,
  CheckCircle2,
  Clock,
  RefreshCw,
  Users,
  PowerOff,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { adminApi } from '@/lib/admin-api'
import { dsaApi } from '@/lib/api'
import { categoryLabel } from '@/lib/coursesStore'
import type { CourseCategory } from '@/lib/types'

interface AttendanceSession {
  active: boolean
  date: string | null
  activatedAt: string | null
}

interface CheckInUser {
  studentId: string
  fullname: string
  email: string
  studentCode: string
  status: string
  at: string
}

export default function TakeAttendance() {
  const [session, setSession] = useState<AttendanceSession>({
    active: false,
    date: null,
    activatedAt: null,
  })
  const [checkIns, setCheckIns] = useState<CheckInUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The ids of students this tutor is in charge of. null = show everyone
  // (admin, or roster unavailable). Used to scope the monitor so a tutor only
  // sees their own students' check-ins even though the session is shared.
  const [rosterIds, setRosterIds] = useState<Set<string> | null>(null)
  // Attendance is per course, so the tutor/admin picks which course to open.
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [courseId, setCourseId] = useState('')

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const roster = (await dsaApi.analytics.tutorStudents()) as Record<
          string,
          unknown
        >[]
        if (cancelled) return
        // Admin gets all students back here, so this is a no-op filter for them.
        setRosterIds(new Set(roster.map((s) => String(s.id ?? s._id ?? ''))))
      } catch {
        setRosterIds(null) // no scoping if the roster can't be read
      }
      // Load the tutor's own courses (fall back to all for admin).
      try {
        let list = (await dsaApi.courses.list({ tutorId: 'me' })) as Record<
          string,
          unknown
        >[]
        if (!list.length)
          list = (await dsaApi.courses.list({})) as Record<string, unknown>[]
        if (cancelled) return
        const mapped = list.map((c) => {
          const title = String(c.title ?? 'Course')
          // Distinguish same-named subjects across classes/tracks (e.g. three
          // "Biology" → "Biology · SS1", "Biology · JAMB") by appending the
          // course category. classLevel is added when it adds more than the
          // category already shows.
          const cat = c.category ? categoryLabel(c.category as CourseCategory) : ''
          const lvl = String(c.classLevel ?? '').trim()
          const suffix = [cat, lvl && lvl !== cat ? lvl : ''].filter(Boolean).join(' · ')
          return {
            id: String(c.id ?? c._id ?? ''),
            title: suffix ? `${title} · ${suffix}` : title,
          }
        })
        setCourses(mapped)
        setCourseId((p) => p || mapped[0]?.id || '')
      } catch {
        /* leave empty */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getTodayISO = () => new Date().toISOString().split('T')[0]

  const refresh = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true)
      setError(null)
      if (!courseId) {
        setSession({ active: false, date: null, activatedAt: null })
        setCheckIns([])
        setLoading(false)
        setRefreshing(false)
        return
      }
      try {
        const sessionRes = await adminApi.getCurrentAttendanceSession(courseId)

        if (sessionRes?.success && sessionRes.data) {
          setSession(sessionRes.data)

          if (sessionRes.data.active) {
            const targetDate = sessionRes.data.date || getTodayISO()
            const checkInsRes = await adminApi.getAttendanceCheckIns(
              targetDate,
              courseId,
            )

            if (checkInsRes?.success) {
              setCheckIns(checkInsRes.data || [])
            }
          } else {
            setCheckIns([])
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch attendance state:', err)
        setError(err?.message || 'Failed to update attendance records.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [courseId],
  )

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  // Setup auto-refresh polling every 10s while session is active
  useEffect(() => {
    if (session.active) {
      pollTimerRef.current = setInterval(() => {
        refresh(false)
      }, 10000)
    } else if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [session.active, refresh])

  const dateLabel = new Date().toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const activate = async () => {
    if (!courseId) {
      setError('Pick a course to open attendance for.')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await adminApi.activateAttendanceSession({ courseId })
      if (res?.success) {
        await refresh()
      } else {
        throw new Error('Could not activate attendance session')
      }
    } catch (err: any) {
      console.error('Failed to activate session:', err)
      setError(err?.message || 'Failed to activate attendance session.')
    } finally {
      setActionLoading(false)
    }
  }

  const close = async () => {
    const currentDate = session.date || getTodayISO()
    setActionLoading(true)
    setError(null)
    try {
      const res = await adminApi.closeAttendanceSession(currentDate, courseId)
      if (res?.success) {
        await refresh()
      } else {
        throw new Error('Could not close session')
      }
    } catch (err: any) {
      console.error('Failed to close session:', err)
      setError(err?.message || 'Failed to close attendance session.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-[350px] gap-3'>
        <Loader2 className='w-8 h-8 animate-spin text-[#002EFF]' />
        <p className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
          Loading attendance state...
        </p>
      </div>
    )
  }

  // Scope the monitor to this tutor's own students (no-op for admin).
  const visibleCheckIns = rosterIds
    ? checkIns.filter((c) => rosterIds.has(String(c.studentId)))
    : checkIns

  return (
    <div className='space-y-6 max-w-3xl mx-auto'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase flex items-center gap-2'>
            <CalendarCheck size={24} /> Attendance
          </h2>
          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
            {dateLabel}
          </p>
        </div>
        <Badge
          className={`text-[9px] font-black ${
            session.active
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {session.active ? 'ACTIVE TODAY' : 'NOT ACTIVATED'}
        </Badge>
      </div>

      {/* Course picker — attendance is opened per course */}
      <div className='flex items-center gap-2 flex-wrap'>
        <CalendarCheck size={15} className='text-slate-400' />
        <span className='text-[10px] font-black uppercase text-slate-400'>Class</span>
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value)
            setLoading(true)
          }}
          className='h-10 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
        >
          {courses.length === 0 && <option value=''>No courses assigned</option>}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2'>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!session.active ? (
        <Card className='rounded-3xl border-none shadow-sm bg-white p-8 text-center'>
          <div className='h-14 w-14 mx-auto rounded-2xl bg-blue-50 text-[#002EFF] flex items-center justify-center mb-4'>
            <Power size={26} />
          </div>
          <h3 className='text-sm font-black text-gray-800 uppercase'>
            Activate today&apos;s attendance
          </h3>
          <p className='text-[11px] font-medium text-gray-500 mt-1 max-w-sm mx-auto'>
            Once you activate, students can mark themselves present from their
            own dashboard. Do this once each day.
          </p>
          <button
            onClick={activate}
            disabled={actionLoading}
            className='mt-5 inline-flex items-center gap-2 px-6 h-11 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {actionLoading ? (
              <Loader2 size={15} className='animate-spin' />
            ) : (
              <Power size={15} />
            )}
            Activate Attendance
          </button>
        </Card>
      ) : (
        <>
          <Card className='rounded-3xl border-none shadow-sm bg-[#002EFF] text-white p-5'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center'>
                  <CheckCircle2 size={20} className='text-[#FCB900]' />
                </div>
                <div>
                  <p className='text-[10px] font-black uppercase tracking-widest text-blue-200'>
                    Attendance is open
                  </p>
                  <p className='text-xs font-bold'>
                    Students can now mark themselves present
                    {session.activatedAt
                      ? ` · opened ${formatTime(session.activatedAt)}`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                disabled={actionLoading}
                className='flex items-center gap-1 px-3 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase transition-all disabled:opacity-50'
              >
                {actionLoading ? (
                  <Loader2 size={13} className='animate-spin' />
                ) : (
                  <PowerOff size={13} />
                )}
                Close
              </button>
            </div>
          </Card>

          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2 text-gray-500'>
              <Users size={15} />
              <span className='text-[11px] font-black uppercase'>
                {visibleCheckIns.length} checked in
              </span>
            </div>
            <button
              onClick={() => refresh(true)}
              disabled={refreshing}
              className='flex items-center gap-1 text-[10px] font-black uppercase text-[#002EFF] hover:underline disabled:opacity-50'
            >
              <RefreshCw
                size={12}
                className={refreshing ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          </div>

          <Card className='rounded-3xl border-none shadow-sm bg-white overflow-hidden'>
            {visibleCheckIns.length === 0 ? (
              <div className='p-8 text-center'>
                <Clock size={26} className='text-slate-300 mx-auto mb-2' />
                <p className='text-[11px] font-bold text-slate-400'>
                  No check-ins yet. Students will appear here as they mark
                  themselves present.
                </p>
              </div>
            ) : (
              visibleCheckIns.map((c) => (
                <div
                  key={c.studentId || c.studentCode || c.email}
                  className='flex items-center justify-between px-5 py-3.5 border-t border-slate-50 first:border-t-0'
                >
                  <div className='flex items-center gap-3'>
                    <div className='h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black uppercase'>
                      {c.fullname?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <p className='text-xs font-black text-gray-800'>
                        {c.fullname}
                      </p>
                      <p className='text-[10px] font-medium text-gray-400'>
                        {c.studentCode || c.email}
                      </p>
                    </div>
                  </div>
                  <Badge className='bg-emerald-50 text-emerald-600 text-[10px] font-black flex items-center gap-1'>
                    <CheckCircle2 size={13} /> {formatTime(c.at)}
                  </Badge>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  )
}



// 'use client'

// import { useState, useEffect, useCallback, FC } from 'react'
// import { Card } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import {
//   CalendarCheck,
//   CheckCircle2,
//   XCircle,
//   Flame,
//   Hand,
//   Lock,
//   GraduationCap,
//   Loader2,
//   LucideIcon,
// } from 'lucide-react'
// import { getUser, getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'
// import { categoryLabel } from '@/lib/coursesStore'
// import type { CourseCategory } from '@/lib/types'

// // Zero-dependency Skeleton fallback in case `@/components/ui/skeleton` isn't installed
// function Skeleton({ className = '' }: { className?: string }) {
//   return (
//     <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`} />
//   )
// }

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }

// function todayKey(): string {
//   return new Date().toISOString().slice(0, 10)
// }

// function checkedStoreKey(studentKey: string): string {
//   return `dsa_attend_${studentKey}_${todayKey()}`
// }

// function getCheckedCourses(studentKey: string): string[] {
//   if (typeof window === 'undefined') return []
//   try {
//     return JSON.parse(localStorage.getItem(checkedStoreKey(studentKey)) || '[]')
//   } catch {
//     return []
//   }
// }

// function addCheckedCourse(studentKey: string, courseId: string) {
//   const arr = getCheckedCourses(studentKey)
//   if (!arr.includes(courseId)) {
//     arr.push(courseId)
//     localStorage.setItem(checkedStoreKey(studentKey), JSON.stringify(arr))
//   }
// }

// type CourseSession = {
//   courseId: string
//   title: string
//   subject?: string
//   tutor?: string
//   open: boolean
//   activatedAt?: string
//   checkedIn: boolean
// }

// interface TileProps {
//   label: string
//   value: string | number
//   tint: 'blue' | 'emerald' | 'rose'
//   icon: LucideIcon
// }

// const TINT_STYLES = {
//   blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
//   emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
//   rose: 'bg-rose-50 text-rose-500 dark:bg-rose-950/50 dark:text-rose-400',
// }

// const Tile: FC<TileProps> = ({ label, value, tint, icon: Icon }) => (
//   <Card className='p-4 rounded-2xl border-none shadow-sm bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800/60 flex items-center gap-3 transition-colors'>
//     <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${TINT_STYLES[tint]}`}>
//       <Icon size={18} strokeWidth={2.5} />
//     </div>
//     <div>
//       <p className='text-[8px] font-black text-gray-400 dark:text-slate-500 uppercase leading-none mb-1'>{label}</p>
//       <p className='text-lg font-black text-gray-900 dark:text-slate-100 leading-none'>{value}</p>
//     </div>
//   </Card>
// )

// function AttendanceSkeleton() {
//   return (
//     <div className='space-y-6 max-w-4xl mx-auto'>
//       <div className='flex items-start justify-between gap-3'>
//         <div className='space-y-2'>
//           <Skeleton className='h-7 w-48' />
//           <Skeleton className='h-3 w-80' />
//         </div>
//         <Skeleton className='h-5 w-12 rounded-full shrink-0' />
//       </div>

//       <div className='grid grid-cols-3 gap-4'>
//         {[1, 2, 3].map((i) => (
//           <Card key={i} className='p-4 rounded-2xl border-none bg-white dark:bg-slate-900 dark:border dark:border-slate-800/60 flex items-center gap-3'>
//             <Skeleton className='h-10 w-10 rounded-xl shrink-0' />
//             <div className='space-y-1.5 flex-1'>
//               <Skeleton className='h-2.5 w-16' />
//               <Skeleton className='h-5 w-10' />
//             </div>
//           </Card>
//         ))}
//       </div>

//       <div className='space-y-3'>
//         <Skeleton className='h-3 w-24' />
//         <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
//           {[1, 2, 3, 4].map((i) => (
//             <Card key={i} className='rounded-2xl border-none bg-white dark:bg-slate-900 dark:border dark:border-slate-800/60 p-4 flex items-center gap-3'>
//               <Skeleton className='h-11 w-11 rounded-2xl shrink-0' />
//               <div className='flex-1 space-y-2 min-w-0'>
//                 <Skeleton className='h-4 w-3/4' />
//                 <Skeleton className='h-3 w-1/2' />
//               </div>
//               <Skeleton className='h-9 w-20 rounded-xl shrink-0' />
//             </Card>
//           ))}
//         </div>
//       </div>
//     </div>
//   )
// }

// export default function StudentAttendance() {
//   const [mounted, setMounted] = useState(false)
//   const [loading, setLoading] = useState(true)
//   const [live, setLive] = useState(false)
//   const [sessions, setSessions] = useState<CourseSession[]>([])
//   const [stats, setStats] = useState({ rate: 0, present: 0, total: 0 })
//   const [busy, setBusy] = useState<string | null>(null)
//   const [studentKey, setStudentKey] = useState('me')

//   const load = useCallback(async () => {
//     const u = getUser()
//     const key = u?.username || u?.email || 'me'
//     setStudentKey(key)

//     if (!isLive()) {
//       setLive(false)
//       setSessions([])
//       setLoading(false)
//       return
//     }

//     try {
//       const courses = (await dsaApi.courses.mine()) as Record<string, unknown>[]
//       await Promise.allSettled(
//         courses.map((c) =>
//           dsaApi.courses.enroll(String(c.id ?? c._id ?? '')).catch(() => {}),
//         ),
//       )
//       const checked = new Set(getCheckedCourses(key))
//       const rows = await Promise.all(
//         courses.map(async (c) => {
//           const id = String(c.id ?? c._id ?? '')
//           const tutorObj = (c.tutor ?? {}) as Record<string, unknown>
//           let open = false
//           let activatedAt: string | undefined
//           try {
//             const cur = (await dsaApi.attendance.current(id)) as Record<
//               string,
//               unknown
//             >
//             open = !!cur.active
//             activatedAt = cur.activatedAt as string | undefined
//           } catch {
//             /* leave closed */
//           }
//           const baseTitle = String(c.title ?? 'Course')
//           const cat = c.category ? categoryLabel(c.category as CourseCategory) : ''
//           const lvl = String(c.classLevel ?? '').trim()
//           const suffix = [cat, lvl && lvl !== cat ? lvl : ''].filter(Boolean).join(' · ')
//           return {
//             courseId: id,
//             title: suffix ? `${baseTitle} · ${suffix}` : baseTitle,
//             subject: c.subject ? String(c.subject) : undefined,
//             tutor:
//               (c.tutorName as string) ||
//               (tutorObj.fullname as string) ||
//               (tutorObj.fullName as string) ||
//               undefined,
//             open,
//             activatedAt,
//             checkedIn: checked.has(id),
//           } as CourseSession
//         }),
//       )
//       setSessions(rows)

//       try {
//         const me = (await dsaApi.attendance.me()) as Record<string, unknown>
//         const present = Number(me.present ?? 0)
//         const total = Number(me.total ?? 0)
//         const rate = Number(me.rate ?? (total ? Math.round((present / total) * 100) : 0))
//         setStats({ rate, present, total })
//       } catch {
//         /* keep zeros */
//       }
//       setLive(true)
//     } catch {
//       setSessions([])
//     } finally {
//       setLoading(false)
//     }
//   }, [])

//   useEffect(() => {
//     setMounted(true)
//     void load()
//     if (!isLive()) return
//     const id = setInterval(() => void load(), 20000)
//     const onFocus = () => void load()
//     window.addEventListener('focus', onFocus)
//     return () => {
//       clearInterval(id)
//       window.removeEventListener('focus', onFocus)
//     }
//   }, [load])

//   const markPresent = async (courseId: string) => {
//     if (busy) return
//     setBusy(courseId)
//     try {
//       await dsaApi.attendance.checkIn(courseId)
//       addCheckedCourse(studentKey, courseId)
//       setSessions((prev) =>
//         prev.map((s) => (s.courseId === courseId ? { ...s, checkedIn: true } : s)),
//       )
//       void load()
//     } catch (err) {
//       const msg = err instanceof Error ? err.message.toLowerCase() : ''
//       if (msg.includes('already')) {
//         addCheckedCourse(studentKey, courseId)
//         setSessions((prev) =>
//           prev.map((s) => (s.courseId === courseId ? { ...s, checkedIn: true } : s)),
//         )
//       }
//     } finally {
//       setBusy(null)
//     }
//   }

//   if (!mounted || loading) {
//     return <AttendanceSkeleton />
//   }

//   const absent = Math.max(0, stats.total - stats.present)

//   return (
//     <div className='space-y-6 max-w-4xl mx-auto'>
//       <div className='flex items-start justify-between gap-3'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] dark:text-blue-500 italic uppercase flex items-center gap-2'>
//             <CalendarCheck size={24} /> My Attendance
//           </h2>
//           <p className='text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest'>
//             Mark yourself present in each class when your tutor opens attendance
//           </p>
//         </div>
//         <Badge
//           className={`text-[8px] font-black shrink-0 ${
//             live 
//               ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' 
//               : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
//           }`}
//         >
//           {live ? 'Live' : 'Local'}
//         </Badge>
//       </div>

//       {/* Overall stats */}
//       <div className='grid grid-cols-3 gap-4'>
//         <Tile label='Attendance Rate' value={`${stats.rate}%`} tint='blue' icon={CalendarCheck} />
//         <Tile label='Present' value={stats.present} tint='emerald' icon={CheckCircle2} />
//         <Tile label='Absent' value={absent} tint='rose' icon={XCircle} />
//       </div>

//       {/* Per-course sessions */}
//       {!live ? (
//         <Card className='rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900 border dark:border-slate-800/60 p-8 text-center'>
//           <p className='text-[11px] font-bold text-slate-400 dark:text-slate-500'>
//             Sign in to your student account to mark attendance.
//           </p>
//         </Card>
//       ) : sessions.length === 0 ? (
//         <Card className='rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900 border dark:border-slate-800/60 p-8 text-center'>
//           <div className='h-12 w-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3'>
//             <Lock size={22} />
//           </div>
//           <p className='text-sm font-black text-gray-800 dark:text-slate-200 uppercase'>No courses yet</p>
//           <p className='text-[11px] font-bold text-gray-400 dark:text-slate-500 mt-1'>
//             Once your programme has courses, each class will show here when its
//             tutor opens attendance.
//           </p>
//         </Card>
//       ) : (
//         <div className='space-y-3'>
//           <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500'>
//             Your classes
//           </p>

//           {/* Side-by-side grid layout */}
//           <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
//             {sessions.map((s) => (
//               <Card
//                 key={s.courseId}
//                 className={`rounded-2xl border-none shadow-sm p-4 flex items-center gap-3 transition-colors ${
//                   s.checkedIn
//                     ? 'bg-emerald-500 text-white dark:bg-emerald-600'
//                     : s.open
//                     ? 'bg-[#002EFF] text-white dark:bg-blue-600'
//                     : 'bg-white dark:bg-slate-900 border dark:border-slate-800/60'
//                 }`}
//               >
//                 <div
//                   className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
//                     s.checkedIn || s.open 
//                       ? 'bg-white/15' 
//                       : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
//                   }`}
//                 >
//                   {s.checkedIn ? (
//                     <CheckCircle2 size={22} />
//                   ) : s.open ? (
//                     <Hand size={20} className='text-[#FCB900]' />
//                   ) : (
//                     <Lock size={18} />
//                   )}
//                 </div>
//                 <div className='min-w-0 flex-1'>
//                   <p className={`text-xs font-black uppercase truncate ${
//                     s.checkedIn || s.open ? 'text-white' : 'text-gray-800 dark:text-slate-200'
//                   }`}>
//                     {s.title}
//                   </p>
//                   <p className={`text-[10px] font-bold flex items-center gap-1 truncate mt-0.5 ${
//                     s.checkedIn ? 'text-emerald-50' : s.open ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
//                   }`}>
//                     <GraduationCap size={11} />
//                     {s.tutor || 'Tutor'}
//                   </p>
//                 </div>
//                 {s.checkedIn ? (
//                   <span className='text-[10px] font-black uppercase text-white/90 flex items-center gap-1 shrink-0'>
//                     <CheckCircle2 size={14} /> Present
//                   </span>
//                 ) : s.open ? (
//                   <button
//                     onClick={() => markPresent(s.courseId)}
//                     disabled={busy === s.courseId}
//                     className='shrink-0 inline-flex items-center gap-1 px-3 h-9 bg-[#FCB900] text-[#002EFF] rounded-xl font-black text-[10px] uppercase shadow hover:brightness-105 active:scale-95 transition-all disabled:opacity-60'
//                   >
//                     {busy === s.courseId ? (
//                       <Loader2 size={12} className='animate-spin' />
//                     ) : (
//                       <CheckCircle2 size={12} />
//                     )}
//                     {busy === s.courseId ? '…' : 'Mark Present'}
//                   </button>
//                 ) : (
//                   <span className='text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 shrink-0'>
//                     Not open
//                   </span>
//                 )}
//               </Card>
//             ))}
//           </div>

//           <div className='flex items-center gap-1.5 pt-1'>
//             <Flame size={12} className='text-amber-500' />
//             <span className='text-[10px] font-bold text-slate-400 dark:text-slate-500'>
//               Present in {sessions.filter((s) => s.checkedIn).length} of{' '}
//               {sessions.length} classes today
//             </span>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }