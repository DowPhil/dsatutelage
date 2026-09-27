// 'use client'

// import { useState, useEffect, useCallback } from 'react'
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
// } from 'lucide-react'
// import { formatTime } from '@/lib/attendanceStore'
// import { getUser, getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'
// import { categoryLabel } from '@/lib/coursesStore'
// import type { CourseCategory } from '@/lib/types'

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }

// function todayKey(): string {
//   return new Date().toISOString().slice(0, 10)
// }

// // The API doesn't expose per-course check-in state on read, so remember which
// // courses the student marked present for today (per device) to keep the UI right
// // across reloads. The backend stays the source of truth for the overall rate.
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

// function Tile({ label, value, tint, icon: Icon }: any) {
//   return (
//     <Card className='p-4 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3'>
//       <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
//         <Icon size={18} strokeWidth={2.5} />
//       </div>
//       <div>
//         <p className='text-[8px] font-black text-gray-400 uppercase leading-none mb-1'>{label}</p>
//         <p className='text-lg font-black text-gray-900 leading-none'>{value}</p>
//       </div>
//     </Card>
//   )
// }

// /**
//  * Student attendance — per course.
//  *
//  * Attendance is opened by each tutor for their own course, so a student marks
//  * themselves present per enrolled course. We load the student's courses, make
//  * sure they're enrolled (check-in requires enrollment), then show one card per
//  * course with its live open/closed state. The overall rate comes from
//  * GET /attendance/me. Demo/offline sessions show a simple placeholder.
//  */
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
//       // Ensure enrolled (check-in requires it). Ignore already-enrolled/errors.
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
//       // Already checked in today counts as present.
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
//     return (
//       <div className='py-16 flex justify-center'>
//         <Loader2 className='animate-spin text-[#002EFF]' />
//       </div>
//     )
//   }

//   const absent = Math.max(0, stats.total - stats.present)

//   return (
//     <div className='space-y-6 max-w-4xl mx-auto'>
//       <div className='flex items-start justify-between gap-3'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase flex items-center gap-2'>
//             <CalendarCheck size={24} /> My Attendance
//           </h2>
//           <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
//             Mark yourself present in each class when your tutor opens attendance
//           </p>
//         </div>
//         <Badge
//           className={`text-[8px] font-black shrink-0 ${live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
//         >
//           {live ? 'Live' : 'Local'}
//         </Badge>
//       </div>

//       {/* Overall stats */}
//       <div className='grid grid-cols-3 gap-4'>
//         <Tile label='Attendance Rate' value={`${stats.rate}%`} tint='bg-blue-50 text-blue-600' icon={CalendarCheck} />
//         <Tile label='Present' value={stats.present} tint='bg-emerald-50 text-emerald-600' icon={CheckCircle2} />
//         <Tile label='Absent' value={absent} tint='bg-rose-50 text-rose-500' icon={XCircle} />
//       </div>

//       {/* Per-course sessions */}
//       {!live ? (
//         <Card className='rounded-3xl border-none shadow-sm bg-white p-8 text-center'>
//           <p className='text-[11px] font-bold text-slate-400'>
//             Sign in to your student account to mark attendance.
//           </p>
//         </Card>
//       ) : sessions.length === 0 ? (
//         <Card className='rounded-3xl border-none shadow-sm bg-white p-8 text-center'>
//           <div className='h-12 w-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3'>
//             <Lock size={22} />
//           </div>
//           <p className='text-sm font-black text-gray-800 uppercase'>No courses yet</p>
//           <p className='text-[11px] font-bold text-gray-400 mt-1'>
//             Once your programme has courses, each class will show here when its
//             tutor opens attendance.
//           </p>
//         </Card>
//       ) : (
//         <div className='space-y-3'>
//           <p className='text-[10px] font-black uppercase tracking-widest text-slate-400'>
//             Your classes
//           </p>
//           {sessions.map((s) => (
//             <Card
//               key={s.courseId}
//               className={`rounded-2xl border-none shadow-sm p-4 flex items-center gap-4 ${s.checkedIn ? 'bg-emerald-500 text-white' : s.open ? 'bg-[#002EFF] text-white' : 'bg-white'}`}
//             >
//               <div
//                 className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${s.checkedIn || s.open ? 'bg-white/15' : 'bg-slate-100 text-slate-400'}`}
//               >
//                 {s.checkedIn ? (
//                   <CheckCircle2 size={22} />
//                 ) : s.open ? (
//                   <Hand size={20} className='text-[#FCB900]' />
//                 ) : (
//                   <Lock size={18} />
//                 )}
//               </div>
//               <div className='min-w-0 flex-1'>
//                 <p className={`text-sm font-black uppercase truncate ${s.checkedIn || s.open ? 'text-white' : 'text-gray-800'}`}>
//                   {s.title}
//                 </p>
//                 <p className={`text-[10px] font-bold flex items-center gap-1 truncate ${s.checkedIn ? 'text-emerald-50' : s.open ? 'text-blue-100' : 'text-slate-400'}`}>
//                   <GraduationCap size={11} />
//                   {s.tutor || 'Tutor'}
//                   {s.checkedIn && s.activatedAt ? '' : ''}
//                 </p>
//               </div>
//               {s.checkedIn ? (
//                 <span className='text-[10px] font-black uppercase text-white/90 flex items-center gap-1 shrink-0'>
//                   <CheckCircle2 size={14} /> Present
//                 </span>
//               ) : s.open ? (
//                 <button
//                   onClick={() => markPresent(s.courseId)}
//                   disabled={busy === s.courseId}
//                   className='shrink-0 inline-flex items-center gap-1.5 px-4 h-10 bg-[#FCB900] text-[#002EFF] rounded-xl font-black text-[10px] uppercase shadow hover:brightness-105 active:scale-95 transition-all disabled:opacity-60'
//                 >
//                   {busy === s.courseId ? (
//                     <Loader2 size={13} className='animate-spin' />
//                   ) : (
//                     <CheckCircle2 size={13} />
//                   )}
//                   {busy === s.courseId ? '…' : 'Mark Present'}
//                 </button>
//               ) : (
//                 <span className='text-[9px] font-black uppercase text-slate-400 shrink-0'>
//                   Not open
//                 </span>
//               )}
//             </Card>
//           ))}
//           <div className='flex items-center gap-1.5 pt-1'>
//             <Flame size={12} className='text-amber-500' />
//             <span className='text-[10px] font-bold text-slate-400'>
//               Present in {sessions.filter((s) => s.checkedIn).length} of{' '}
//               {sessions.length} classes today
//             </span>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }


'use client'

import { useState, useEffect, useCallback, FC } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Flame,
  Hand,
  Lock,
  GraduationCap,
  Loader2,
  LucideIcon,
} from 'lucide-react'
import { getUser, getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'
import { categoryLabel } from '@/lib/coursesStore'
import type { CourseCategory } from '@/lib/types'

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function checkedStoreKey(studentKey: string): string {
  return `dsa_attend_${studentKey}_${todayKey()}`
}

function getCheckedCourses(studentKey: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(checkedStoreKey(studentKey)) || '[]')
  } catch {
    return []
  }
}

function addCheckedCourse(studentKey: string, courseId: string) {
  const arr = getCheckedCourses(studentKey)
  if (!arr.includes(courseId)) {
    arr.push(courseId)
    localStorage.setItem(checkedStoreKey(studentKey), JSON.stringify(arr))
  }
}

type CourseSession = {
  courseId: string
  title: string
  subject?: string
  tutor?: string
  open: boolean
  activatedAt?: string
  checkedIn: boolean
}

interface TileProps {
  label: string
  value: string | number
  tint: 'blue' | 'emerald' | 'rose'
  icon: LucideIcon
}

const TINT_STYLES = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  rose: 'bg-rose-50 text-rose-500 dark:bg-rose-950/50 dark:text-rose-400',
}

const Tile: FC<TileProps> = ({ label, value, tint, icon: Icon }) => (
  <Card className='p-4 rounded-2xl border-none shadow-sm bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800/60 flex items-center gap-3 transition-colors'>
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${TINT_STYLES[tint]}`}>
      <Icon size={18} strokeWidth={2.5} />
    </div>
    <div>
      <p className='text-[8px] font-black text-gray-400 dark:text-slate-500 uppercase leading-none mb-1'>{label}</p>
      <p className='text-lg font-black text-gray-900 dark:text-slate-100 leading-none'>{value}</p>
    </div>
  </Card>
)

function AttendanceSkeleton() {
  return (
    <div className='space-y-6 max-w-4xl mx-auto animate-pulse'>
      <div className='flex items-start justify-between gap-3'>
        <div className='space-y-2'>
          <Skeleton className='h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg' />
          <Skeleton className='h-3 w-80 bg-slate-200 dark:bg-slate-800 rounded-md' />
        </div>
        <Skeleton className='h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0' />
      </div>

      <div className='grid grid-cols-3 gap-4'>
        {[1, 2, 3].map((i) => (
          <Card key={i} className='p-4 rounded-2xl border-none bg-white dark:bg-slate-900 dark:border dark:border-slate-800/60 flex items-center gap-3'>
            <Skeleton className='h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0' />
            <div className='space-y-1.5 flex-1'>
              <Skeleton className='h-2.5 w-16 bg-slate-200 dark:bg-slate-800 rounded' />
              <Skeleton className='h-5 w-10 bg-slate-200 dark:bg-slate-800 rounded' />
            </div>
          </Card>
        ))}
      </div>

      <div className='space-y-3'>
        <Skeleton className='h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded' />
        {[1, 2, 3].map((i) => (
          <Card key={i} className='rounded-2xl border-none bg-white dark:bg-slate-900 dark:border dark:border-slate-800/60 p-4 flex items-center gap-4'>
            <Skeleton className='h-11 w-11 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded' />
              <Skeleton className='h-3 w-1/3 bg-slate-200 dark:bg-slate-800 rounded' />
            </div>
            <Skeleton className='h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0' />
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function StudentAttendance() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [sessions, setSessions] = useState<CourseSession[]>([])
  const [stats, setStats] = useState({ rate: 0, present: 0, total: 0 })
  const [busy, setBusy] = useState<string | null>(null)
  const [studentKey, setStudentKey] = useState('me')

  const load = useCallback(async () => {
    const u = getUser()
    const key = u?.username || u?.email || 'me'
    setStudentKey(key)

    if (!isLive()) {
      setLive(false)
      setSessions([])
      setLoading(false)
      return
    }

    try {
      const courses = (await dsaApi.courses.mine()) as Record<string, unknown>[]
      await Promise.allSettled(
        courses.map((c) =>
          dsaApi.courses.enroll(String(c.id ?? c._id ?? '')).catch(() => {}),
        ),
      )
      const checked = new Set(getCheckedCourses(key))
      const rows = await Promise.all(
        courses.map(async (c) => {
          const id = String(c.id ?? c._id ?? '')
          const tutorObj = (c.tutor ?? {}) as Record<string, unknown>
          let open = false
          let activatedAt: string | undefined
          try {
            const cur = (await dsaApi.attendance.current(id)) as Record<
              string,
              unknown
            >
            open = !!cur.active
            activatedAt = cur.activatedAt as string | undefined
          } catch {
            /* leave closed */
          }
          const baseTitle = String(c.title ?? 'Course')
          const cat = c.category ? categoryLabel(c.category as CourseCategory) : ''
          const lvl = String(c.classLevel ?? '').trim()
          const suffix = [cat, lvl && lvl !== cat ? lvl : ''].filter(Boolean).join(' · ')
          return {
            courseId: id,
            title: suffix ? `${baseTitle} · ${suffix}` : baseTitle,
            subject: c.subject ? String(c.subject) : undefined,
            tutor:
              (c.tutorName as string) ||
              (tutorObj.fullname as string) ||
              (tutorObj.fullName as string) ||
              undefined,
            open,
            activatedAt,
            checkedIn: checked.has(id),
          } as CourseSession
        }),
      )
      setSessions(rows)

      try {
        const me = (await dsaApi.attendance.me()) as Record<string, unknown>
        const present = Number(me.present ?? 0)
        const total = Number(me.total ?? 0)
        const rate = Number(me.rate ?? (total ? Math.round((present / total) * 100) : 0))
        setStats({ rate, present, total })
      } catch {
        /* keep zeros */
      }
      setLive(true)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    void load()
    if (!isLive()) return
    const id = setInterval(() => void load(), 20000)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const markPresent = async (courseId: string) => {
    if (busy) return
    setBusy(courseId)
    try {
      await dsaApi.attendance.checkIn(courseId)
      addCheckedCourse(studentKey, courseId)
      setSessions((prev) =>
        prev.map((s) => (s.courseId === courseId ? { ...s, checkedIn: true } : s)),
      )
      void load()
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('already')) {
        addCheckedCourse(studentKey, courseId)
        setSessions((prev) =>
          prev.map((s) => (s.courseId === courseId ? { ...s, checkedIn: true } : s)),
        )
      }
    } finally {
      setBusy(null)
    }
  }

  if (!mounted || loading) {
    return <AttendanceSkeleton />
  }

  const absent = Math.max(0, stats.total - stats.present)

  return (
    <div className='space-y-6 max-w-4xl mx-auto'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] dark:text-blue-500 italic uppercase flex items-center gap-2'>
            <CalendarCheck size={24} /> My Attendance
          </h2>
          <p className='text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest'>
            Mark yourself present in each class when your tutor opens attendance
          </p>
        </div>
        <Badge
          className={`text-[8px] font-black shrink-0 ${
            live 
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' 
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {live ? 'Live' : 'Local'}
        </Badge>
      </div>

      {/* Overall stats */}
      <div className='grid grid-cols-3 gap-4'>
        <Tile label='Attendance Rate' value={`${stats.rate}%`} tint='blue' icon={CalendarCheck} />
        <Tile label='Present' value={stats.present} tint='emerald' icon={CheckCircle2} />
        <Tile label='Absent' value={absent} tint='rose' icon={XCircle} />
      </div>

      {/* Per-course sessions */}
      {!live ? (
        <Card className='rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900 border dark:border-slate-800/60 p-8 text-center'>
          <p className='text-[11px] font-bold text-slate-400 dark:text-slate-500'>
            Sign in to your student account to mark attendance.
          </p>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className='rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900 border dark:border-slate-800/60 p-8 text-center'>
          <div className='h-12 w-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3'>
            <Lock size={22} />
          </div>
          <p className='text-sm font-black text-gray-800 dark:text-slate-200 uppercase'>No courses yet</p>
          <p className='text-[11px] font-bold text-gray-400 dark:text-slate-500 mt-1'>
            Once your programme has courses, each class will show here when its
            tutor opens attendance.
          </p>
        </Card>
      ) : (
        <div className='space-y-3'>
          <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500'>
            Your classes
          </p>
          {sessions.map((s) => (
            <Card
              key={s.courseId}
              className={`rounded-2xl border-none shadow-sm p-4 flex items-center gap-4 transition-colors ${
                s.checkedIn
                  ? 'bg-emerald-500 text-white dark:bg-emerald-600'
                  : s.open
                  ? 'bg-[#002EFF] text-white dark:bg-blue-600'
                  : 'bg-white dark:bg-slate-900 border dark:border-slate-800/60'
              }`}
            >
              <div
                className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  s.checkedIn || s.open 
                    ? 'bg-white/15' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                {s.checkedIn ? (
                  <CheckCircle2 size={22} />
                ) : s.open ? (
                  <Hand size={20} className='text-[#FCB900]' />
                ) : (
                  <Lock size={18} />
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <p className={`text-sm font-black uppercase truncate ${
                  s.checkedIn || s.open ? 'text-white' : 'text-gray-800 dark:text-slate-200'
                }`}>
                  {s.title}
                </p>
                <p className={`text-[10px] font-bold flex items-center gap-1 truncate ${
                  s.checkedIn ? 'text-emerald-50' : s.open ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  <GraduationCap size={11} />
                  {s.tutor || 'Tutor'}
                </p>
              </div>
              {s.checkedIn ? (
                <span className='text-[10px] font-black uppercase text-white/90 flex items-center gap-1 shrink-0'>
                  <CheckCircle2 size={14} /> Present
                </span>
              ) : s.open ? (
                <button
                  onClick={() => markPresent(s.courseId)}
                  disabled={busy === s.courseId}
                  className='shrink-0 inline-flex items-center gap-1.5 px-4 h-10 bg-[#FCB900] text-[#002EFF] rounded-xl font-black text-[10px] uppercase shadow hover:brightness-105 active:scale-95 transition-all disabled:opacity-60'
                >
                  {busy === s.courseId ? (
                    <Loader2 size={13} className='animate-spin' />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  {busy === s.courseId ? '…' : 'Mark Present'}
                </button>
              ) : (
                <span className='text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 shrink-0'>
                  Not open
                </span>
              )}
            </Card>
          ))}
          <div className='flex items-center gap-1.5 pt-1'>
            <Flame size={12} className='text-amber-500' />
            <span className='text-[10px] font-bold text-slate-400 dark:text-slate-500'>
              Present in {sessions.filter((s) => s.checkedIn).length} of{' '}
              {sessions.length} classes today
            </span>
          </div>
        </div>
      )}
    </div>
  )
}