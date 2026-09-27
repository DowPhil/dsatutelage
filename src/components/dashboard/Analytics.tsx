// 'use client'

// import React, { useCallback, useEffect, useState } from 'react'
// import {
//   BarChart3,
//   TrendingUp,
//   CalendarCheck,
//   ClipboardCheck,
//   BookOpen,
//   Users,
//   AlertTriangle,
//   Award,
//   Loader2,
// } from 'lucide-react'
// import { Card } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import { getCourses, trackProgress } from '@/lib/coursesStore'
// import {
//   getAssignmentsForTrack,
//   getAssignments,
//   getMySubmission,
//   getSubmissions,
// } from '@/lib/assignmentsStore'
// import { getStudentAttendance } from '@/lib/attendanceStore'
// import { getStudents } from '@/lib/studentsStore'
// import { getUser, getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'
// import { normaliseTrack } from '@/lib/studentProfile'

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }

// const num = (v: unknown): number | null =>
//   typeof v === 'number' && !Number.isNaN(v) ? v : null

// function StatTile({
//   label,
//   value,
//   sub,
//   icon: Icon,
//   tint,
// }: {
//   label: string
//   value: string | number
//   sub?: string
//   icon: React.ElementType
//   tint: string
// }) {
//   return (
//     <Card className='p-4 rounded-2xl border-none shadow-sm bg-white'>
//       <div className='flex items-center gap-3'>
//         <div
//           className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}
//         >
//           <Icon size={18} strokeWidth={2.5} />
//         </div>
//         <div>
//           <p className='text-[8px] font-black text-gray-400 uppercase leading-none mb-1'>
//             {label}
//           </p>
//           <p className='text-lg font-black text-gray-900 leading-none'>{value}</p>
//           {sub && <p className='text-[9px] font-bold text-slate-400 mt-1'>{sub}</p>}
//         </div>
//       </div>
//     </Card>
//   )
// }

// function Bar({
//   label,
//   pct,
//   tintDanger = false,
// }: {
//   label: string
//   pct: number
//   tintDanger?: boolean
// }) {
//   return (
//     <div className='flex items-center gap-3'>
//       <span className='w-28 text-[10px] font-black text-gray-600 uppercase text-right truncate'>
//         {label}
//       </span>
//       <div className='flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden'>
//         <div
//           className={`h-full rounded-lg flex items-center justify-end pr-2 transition-all ${
//             tintDanger && pct < 70 ? 'bg-amber-400' : 'bg-[#002EFF]'
//           }`}
//           style={{ width: `${Math.max(pct, 6)}%` }}
//         >
//           <span className='text-[9px] font-black text-white'>{pct}%</span>
//         </div>
//       </div>
//     </div>
//   )
// }

// function LiveBadge({ live }: { live: boolean }) {
//   return (
//     <Badge
//       className={`text-[8px] font-black shrink-0 ${live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
//     >
//       {live ? 'Live' : 'Local'}
//     </Badge>
//   )
// }

// export default function Analytics({
//   mode,
//   studentKey,
//   track: trackProp,
// }: {
//   mode: 'tutor' | 'student'
//   studentKey?: string
//   track?: string
// }) {
//   const [mounted, setMounted] = useState(false)
//   useEffect(() => setMounted(true), [])
//   if (!mounted) {
//     return (
//       <div className='py-16 flex justify-center'>
//         <Loader2 className='animate-spin text-[#002EFF]' />
//       </div>
//     )
//   }
//   if (mode === 'tutor') return <TutorAnalytics />
//   const u = getUser()
//   const track = trackProp || normaliseTrack(u?.level || u?.examType || 'jamb')
//   return (
//     <StudentAnalytics track={track} studentKey={studentKey || u?.username || 'me'} />
//   )
// }

// /* ---------------- Student ---------------- */
// type StudentPerf = {
//   progress: number
//   average: number | null
//   attendanceRate: number
//   present: number
//   totalSessions: number
//   perSubject: { title: string; average: number }[]
//   grades: { key: string; title: string; score: number; maxScore: number; percent: number }[]
// }

// function StudentAnalytics({
//   track,
//   studentKey,
// }: {
//   track: string
//   studentKey: string
// }) {
//   const [loading, setLoading] = useState(true)
//   const [live, setLive] = useState(false)
//   const [perf, setPerf] = useState<StudentPerf | null>(null)

//   const buildLocal = useCallback((): StudentPerf => {
//     const groups = getAssignmentsForTrack(track)
//     const all = Object.entries(groups)
//     const grades: StudentPerf['grades'] = []
//     const perSubject: StudentPerf['perSubject'] = []
//     let scored = 0
//     let maxTotal = 0
//     all.forEach(([cid, assignments]) => {
//       const course = getCourses().find((c) => c.id === cid)
//       let cScore = 0
//       let cMax = 0
//       assignments.forEach((a) => {
//         const mine = getMySubmission(a.id, studentKey)
//         if (mine && mine.status === 'graded' && mine.score != null) {
//           scored += mine.score
//           maxTotal += a.maxScore
//           cScore += mine.score
//           cMax += a.maxScore
//           grades.push({
//             key: a.id,
//             title: a.title,
//             score: mine.score,
//             maxScore: a.maxScore,
//             percent: Math.round((mine.score / a.maxScore) * 100),
//           })
//         }
//       })
//       if (cMax)
//         perSubject.push({
//           title: course?.title ?? cid,
//           average: Math.round((cScore / cMax) * 100),
//         })
//     })
//     const att = getStudentAttendance(studentKey)
//     return {
//       progress: trackProgress(studentKey, track),
//       average: maxTotal ? Math.round((scored / maxTotal) * 100) : null,
//       attendanceRate: att.rate,
//       present: att.present,
//       totalSessions: att.total,
//       perSubject,
//       grades,
//     }
//   }, [track, studentKey])

//   useEffect(() => {
//     let cancelled = false
//     ;(async () => {
//       if (isLive()) {
//         try {
//           const [a, gradesRaw] = await Promise.all([
//             dsaApi.analytics.me() as Promise<Record<string, unknown>>,
//             dsaApi.assignments.myGrades() as Promise<Record<string, unknown>[]>,
//           ])
//           if (cancelled) return
//           const perSubject = (
//             (a.perSubject as Record<string, unknown>[]) ?? []
//           )
//             .map((s) => ({
//               title: String(s.title ?? s.subject ?? ''),
//               average: num(s.average),
//             }))
//             .filter((s): s is { title: string; average: number } => s.average !== null)
//           setPerf({
//             progress: num(a.progressPercent) ?? 0,
//             average: num(a.averageScore),
//             attendanceRate: num(a.attendanceRate) ?? 0,
//             present: num(a.present) ?? 0,
//             totalSessions: num(a.totalSessions) ?? 0,
//             perSubject,
//             grades: gradesRaw.map((g) => ({
//               key: String(g.id ?? g._id ?? g.sourceId ?? Math.random()),
//               title: String(g.title ?? 'Assignment'),
//               score: num(g.score) ?? 0,
//               maxScore: num(g.maxScore) ?? 0,
//               percent:
//                 num(g.percent) ??
//                 (num(g.maxScore)
//                   ? Math.round(((num(g.score) ?? 0) / (num(g.maxScore) as number)) * 100)
//                   : 0),
//             })),
//           })
//           setLive(true)
//           setLoading(false)
//           return
//         } catch {
//           /* fall through to local */
//         }
//       }
//       if (cancelled) return
//       setPerf(buildLocal())
//       setLive(false)
//       setLoading(false)
//     })()
//     return () => {
//       cancelled = true
//     }
//   }, [buildLocal])

//   if (loading || !perf) {
//     return (
//       <div className='py-16 flex justify-center'>
//         <Loader2 className='animate-spin text-[#002EFF]' />
//       </div>
//     )
//   }

//   return (
//     <div className='space-y-6'>
//       <div className='flex items-start justify-between gap-3'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
//             My Performance
//           </h2>
//           <p className='text-[11px] font-bold text-slate-400'>
//             Your progress, grades &amp; attendance at a glance.
//           </p>
//         </div>
//         <LiveBadge live={live} />
//       </div>

//       <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
//         <StatTile
//           label='Course Progress'
//           value={`${perf.progress}%`}
//           icon={TrendingUp}
//           tint='bg-blue-50 text-blue-600'
//         />
//         <StatTile
//           label='Average Score'
//           value={perf.average != null ? `${perf.average}%` : '—'}
//           sub={perf.average != null ? undefined : 'no grades yet'}
//           icon={Award}
//           tint='bg-emerald-50 text-emerald-600'
//         />
//         <StatTile
//           label='Attendance'
//           value={perf.totalSessions ? `${perf.attendanceRate}%` : '—'}
//           sub={
//             perf.totalSessions
//               ? `${perf.present}/${perf.totalSessions} sessions`
//               : 'no sessions yet'
//           }
//           icon={CalendarCheck}
//           tint='bg-amber-50 text-amber-600'
//         />
//         <StatTile
//           label='Graded'
//           value={perf.grades.length}
//           sub='assignments'
//           icon={ClipboardCheck}
//           tint='bg-purple-50 text-purple-600'
//         />
//       </div>

//       <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
//         <p className='text-[10px] font-black uppercase text-gray-400 mb-4 flex items-center gap-2'>
//           <BookOpen size={13} className='text-[#002EFF]' /> Average by subject
//         </p>
//         {perf.perSubject.length === 0 ? (
//           <p className='text-[11px] font-bold text-slate-400'>
//             No graded scores yet.
//           </p>
//         ) : (
//           <div className='space-y-3'>
//             {perf.perSubject.map((c) => (
//               <Bar key={c.title} label={c.title} pct={c.average} tintDanger />
//             ))}
//           </div>
//         )}
//       </Card>

//       {perf.grades.length > 0 && (
//         <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
//           <p className='text-[10px] font-black uppercase text-gray-400 mb-4'>
//             Graded assignments
//           </p>
//           <div className='space-y-2'>
//             {perf.grades.map((g) => (
//               <div
//                 key={g.key}
//                 className='flex items-center justify-between p-3 rounded-xl bg-slate-50/70'
//               >
//                 <span className='text-[11px] font-black text-gray-700'>
//                   {g.title}
//                 </span>
//                 <span
//                   className={`text-[11px] font-black ${g.percent >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}
//                 >
//                   {g.score}/{g.maxScore} · {g.percent}%
//                 </span>
//               </div>
//             ))}
//           </div>
//         </Card>
//       )}
//     </div>
//   )
// }

// /* ---------------- Tutor ---------------- */
// type TutorPerf = {
//   studentsCount: number
//   classAverage: number | null
//   toGradeCount: number
//   students: { key: string; name: string; avg: number | null }[]
//   atRisk: { key: string; name: string; avg: number }[]
//   perCourse: {
//     title: string
//     assignments: number
//     submissions: number
//     graded: number
//     average: number | null
//   }[]
// }

// function TutorAnalytics() {
//   const [loading, setLoading] = useState(true)
//   const [live, setLive] = useState(false)
//   const [perf, setPerf] = useState<TutorPerf | null>(null)

//   const buildLocal = useCallback((): TutorPerf => {
//     const students = getStudents()
//     const withAvg = students.filter((s) => s.avg != null)
//     const classAverage = withAvg.length
//       ? Math.round(
//           withAvg.reduce((n, s) => n + (s.avg ?? 0), 0) / withAvg.length,
//         )
//       : null
//     let toGrade = 0
//     const perCourse = getCourses()
//       .map((c) => {
//         const assignments = getAssignments(c.id)
//         let subs = 0
//         let graded = 0
//         let scoreSum = 0
//         let maxSum = 0
//         assignments.forEach((a) => {
//           const ss = getSubmissions(a.id)
//           subs += ss.length
//           ss.forEach((s) => {
//             if (s.status === 'graded' && s.score != null) {
//               graded++
//               scoreSum += s.score
//               maxSum += a.maxScore
//             } else {
//               toGrade++
//             }
//           })
//         })
//         return {
//           title: c.title,
//           assignments: assignments.length,
//           submissions: subs,
//           graded,
//           average: maxSum ? Math.round((scoreSum / maxSum) * 100) : null,
//         }
//       })
//       .filter((c) => c.assignments > 0)
//     return {
//       studentsCount: students.length,
//       classAverage,
//       toGradeCount: toGrade,
//       students: students.map((s) => ({
//         key: s.key,
//         name: s.name,
//         avg: s.avg ?? null,
//       })),
//       atRisk: students
//         .filter((s) => s.avg != null && (s.avg ?? 100) < 70)
//         .map((s) => ({ key: s.key, name: s.name, avg: s.avg ?? 0 })),
//       perCourse,
//     }
//   }, [])

//   useEffect(() => {
//     let cancelled = false
//     ;(async () => {
//       if (isLive()) {
//         try {
//           const [ov, roster] = await Promise.all([
//             dsaApi.analytics.tutorOverview() as Promise<Record<string, unknown>>,
//             dsaApi.analytics.tutorStudents() as Promise<Record<string, unknown>[]>,
//           ])
//           if (cancelled) return
//           const atRiskRaw = (ov.atRiskStudents as Record<string, unknown>[]) ?? []
//           const perCourseRaw = (ov.perCourse as Record<string, unknown>[]) ?? []
//           setPerf({
//             studentsCount:
//               num(ov.studentsCount) ?? roster.length,
//             classAverage: num(ov.classAverage),
//             toGradeCount: num(ov.toGradeCount) ?? 0,
//             students: roster.map((s, i) => ({
//               key: String(s.id ?? s._id ?? i),
//               name: String(s.fullname ?? s.fullName ?? 'Student'),
//               avg: num(s.averageScore) ?? num(s.avg),
//             })),
//             atRisk: atRiskRaw.map((s, i) => ({
//               key: String(s.id ?? s._id ?? i),
//               name: String(s.fullname ?? s.fullName ?? 'Student'),
//               avg: num(s.averageScore) ?? 0,
//             })),
//             perCourse: perCourseRaw.map((c) => ({
//               title: String(c.title ?? 'Course'),
//               assignments: num(c.assignments) ?? 0,
//               submissions: num(c.submissions) ?? 0,
//               graded: num(c.graded) ?? 0,
//               average: num(c.average),
//             })),
//           })
//           setLive(true)
//           setLoading(false)
//           return
//         } catch {
//           /* fall through to local */
//         }
//       }
//       if (cancelled) return
//       setPerf(buildLocal())
//       setLive(false)
//       setLoading(false)
//     })()
//     return () => {
//       cancelled = true
//     }
//   }, [buildLocal])

//   if (loading || !perf) {
//     return (
//       <div className='py-16 flex justify-center'>
//         <Loader2 className='animate-spin text-[#002EFF]' />
//       </div>
//     )
//   }

//   const withAvg = perf.students.filter((s) => s.avg != null)

//   return (
//     <div className='space-y-6'>
//       <div className='flex items-start justify-between gap-3'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
//             Class Analytics
//           </h2>
//           <p className='text-[11px] font-bold text-slate-400'>
//             How your students are performing.
//           </p>
//         </div>
//         <LiveBadge live={live} />
//       </div>

//       <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
//         <StatTile
//           label='Students'
//           value={perf.studentsCount}
//           icon={Users}
//           tint='bg-blue-50 text-blue-600'
//         />
//         <StatTile
//           label='Class Avg'
//           value={perf.classAverage != null ? `${perf.classAverage}%` : '—'}
//           icon={BarChart3}
//           tint='bg-emerald-50 text-emerald-600'
//         />
//         <StatTile
//           label='To Grade'
//           value={perf.toGradeCount}
//           sub='submissions'
//           icon={ClipboardCheck}
//           tint='bg-amber-50 text-amber-600'
//         />
//         <StatTile
//           label='At Risk'
//           value={perf.atRisk.length}
//           sub='avg below 70%'
//           icon={AlertTriangle}
//           tint='bg-rose-50 text-rose-600'
//         />
//       </div>

//       <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
//         <p className='text-[10px] font-black uppercase text-gray-400 mb-4'>
//           Average score by student
//         </p>
//         <div className='space-y-3'>
//           {withAvg.length === 0 ? (
//             <p className='text-[11px] font-bold text-slate-400'>
//               No graded scores yet.
//             </p>
//           ) : (
//             withAvg.map((s) => (
//               <Bar key={s.key} label={s.name} pct={s.avg ?? 0} tintDanger />
//             ))
//           )}
//         </div>
//       </Card>

//       <Card className='rounded-3xl border-none shadow-sm bg-white overflow-hidden'>
//         <div className='px-6 py-4 border-b border-slate-50'>
//           <p className='text-[10px] font-black uppercase text-gray-400'>
//             Assignments by course
//           </p>
//         </div>
//         {perf.perCourse.length === 0 ? (
//           <p className='px-6 py-6 text-[11px] font-bold text-slate-400'>
//             No assignments created yet.
//           </p>
//         ) : (
//           <div className='overflow-x-auto'>
//             <table className='w-full text-left min-w-[520px]'>
//               <thead>
//                 <tr className='bg-slate-50/60 text-[9px] font-black uppercase text-gray-400'>
//                   <th className='px-6 py-3'>Course</th>
//                   <th className='px-4 py-3'>Assignments</th>
//                   <th className='px-4 py-3'>Submissions</th>
//                   <th className='px-4 py-3'>Graded</th>
//                   <th className='px-4 py-3'>Avg</th>
//                 </tr>
//               </thead>
//               <tbody className='divide-y divide-slate-50'>
//                 {perf.perCourse.map((c) => (
//                   <tr key={c.title}>
//                     <td className='px-6 py-3 text-xs font-black text-gray-800'>
//                       {c.title}
//                     </td>
//                     <td className='px-4 py-3 text-xs font-bold text-slate-600'>
//                       {c.assignments}
//                     </td>
//                     <td className='px-4 py-3 text-xs font-bold text-slate-600'>
//                       {c.submissions}
//                     </td>
//                     <td className='px-4 py-3 text-xs font-bold text-slate-600'>
//                       {c.graded}
//                     </td>
//                     <td className='px-4 py-3'>
//                       {c.average == null ? (
//                         <span className='text-[10px] font-bold text-slate-300'>
//                           —
//                         </span>
//                       ) : (
//                         <Badge
//                           className={`text-[8px] font-black ${c.average >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
//                         >
//                           {c.average}%
//                         </Badge>
//                       )}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </Card>

//       {perf.atRisk.length > 0 && (
//         <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
//           <p className='text-[10px] font-black uppercase text-gray-400 mb-3 flex items-center gap-2'>
//             <AlertTriangle size={13} className='text-rose-500' /> Students needing
//             attention
//           </p>
//           <div className='space-y-2'>
//             {perf.atRisk.map((s) => (
//               <div
//                 key={s.key}
//                 className='flex items-center justify-between p-3 rounded-xl bg-rose-50/60'
//               >
//                 <span className='text-xs font-black text-gray-800'>{s.name}</span>
//                 <span className='text-xs font-black text-rose-500'>
//                   {s.avg}% avg
//                 </span>
//               </div>
//             ))}
//           </div>
//         </Card>
//       )}
//     </div>
//   )
// }




'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  CalendarCheck,
  ClipboardCheck,
  BookOpen,
  Users,
  AlertTriangle,
  Award,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCourses, trackProgress } from '@/lib/coursesStore'
import {
  getAssignmentsForTrack,
  getAssignments,
  getMySubmission,
  getSubmissions,
} from '@/lib/assignmentsStore'
import { getStudentAttendance } from '@/lib/attendanceStore'
import { getStudents } from '@/lib/studentsStore'
import { getUser, getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'
import { normaliseTrack } from '@/lib/studentProfile'

/* ---------------- Skeleton Components ---------------- */

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-lg ${className ?? ''}`}
    />
  )
}

function StatTileSkeleton() {
  return (
    <Card className='p-4 rounded-2xl border-none shadow-sm bg-white'>
      <div className='flex items-center gap-3'>
        <Skeleton className='h-10 w-10 rounded-xl shrink-0' />
        <div className='space-y-1.5 flex-1'>
          <Skeleton className='h-2.5 w-16' />
          <Skeleton className='h-5 w-12' />
          <Skeleton className='h-2 w-20' />
        </div>
      </div>
    </Card>
  )
}

function BarSkeleton() {
  return (
    <div className='flex items-center gap-3'>
      <Skeleton className='w-28 h-3 shrink-0' />
      <Skeleton className='flex-1 h-6 rounded-lg' />
    </div>
  )
}

function StudentAnalyticsSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-3'>
        <div className='space-y-2'>
          <Skeleton className='h-7 w-48' />
          <Skeleton className='h-3.5 w-64' />
        </div>
        <Skeleton className='h-5 w-12 rounded-full' />
      </div>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        {Array.from({ length: 4 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </div>

      <Card className='p-6 rounded-3xl border-none shadow-sm bg-white space-y-4'>
        <Skeleton className='h-3 w-36' />
        <div className='space-y-3'>
          {Array.from({ length: 4 }).map((_, i) => (
            <BarSkeleton key={i} />
          ))}
        </div>
      </Card>

      <Card className='p-6 rounded-3xl border-none shadow-sm bg-white space-y-3'>
        <Skeleton className='h-3 w-40 mb-2' />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className='h-10 w-full rounded-xl' />
        ))}
      </Card>
    </div>
  )
}

function TutorAnalyticsSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-3'>
        <div className='space-y-2'>
          <Skeleton className='h-7 w-48' />
          <Skeleton className='h-3.5 w-56' />
        </div>
        <Skeleton className='h-5 w-12 rounded-full' />
      </div>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        {Array.from({ length: 4 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </div>

      <Card className='p-6 rounded-3xl border-none shadow-sm bg-white space-y-4'>
        <Skeleton className='h-3 w-44' />
        <div className='space-y-3'>
          {Array.from({ length: 5 }).map((_, i) => (
            <BarSkeleton key={i} />
          ))}
        </div>
      </Card>

      <Card className='rounded-3xl border-none shadow-sm bg-white overflow-hidden p-6 space-y-4'>
        <Skeleton className='h-3 w-40' />
        <div className='space-y-2'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-8 w-full rounded-lg' />
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- Helpers ---------------- */

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && !Number.isNaN(v) ? v : null

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
    <Card className='p-4 rounded-2xl border-none shadow-sm bg-white'>
      <div className='flex items-center gap-3'>
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}
        >
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <div>
          <p className='text-[8px] font-black text-gray-400 uppercase leading-none mb-1'>
            {label}
          </p>
          <p className='text-lg font-black text-gray-900 leading-none'>{value}</p>
          {sub && <p className='text-[9px] font-bold text-slate-400 mt-1'>{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

function Bar({
  label,
  pct,
  tintDanger = false,
}: {
  label: string
  pct: number
  tintDanger?: boolean
}) {
  return (
    <div className='flex items-center gap-3'>
      <span className='w-28 text-[10px] font-black text-gray-600 uppercase text-right truncate'>
        {label}
      </span>
      <div className='flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden'>
        <div
          className={`h-full rounded-lg flex items-center justify-end pr-2 transition-all ${
            tintDanger && pct < 70 ? 'bg-amber-400' : 'bg-[#002EFF]'
          }`}
          style={{ width: `${Math.max(pct, 6)}%` }}
        >
          <span className='text-[9px] font-black text-white'>{pct}%</span>
        </div>
      </div>
    </div>
  )
}

function LiveBadge({ live }: { live: boolean }) {
  return (
    <Badge
      className={`text-[8px] font-black shrink-0 ${
        live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {live ? 'Live' : 'Local'}
    </Badge>
  )
}

export default function Analytics({
  mode,
  studentKey,
  track: trackProp,
}: {
  mode: 'tutor' | 'student'
  studentKey?: string
  track?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return mode === 'tutor' ? <TutorAnalyticsSkeleton /> : <StudentAnalyticsSkeleton />
  }

  if (mode === 'tutor') return <TutorAnalytics />
  const u = getUser()
  const track = trackProp || normaliseTrack(u?.level || u?.examType || 'jamb')
  return (
    <StudentAnalytics track={track} studentKey={studentKey || u?.username || 'me'} />
  )
}

/* ---------------- Student Analytics ---------------- */

type StudentPerf = {
  progress: number
  average: number | null
  attendanceRate: number
  present: number
  totalSessions: number
  perSubject: { title: string; average: number }[]
  grades: { key: string; title: string; score: number; maxScore: number; percent: number }[]
}

function StudentAnalytics({
  track,
  studentKey,
}: {
  track: string
  studentKey: string
}) {
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [perf, setPerf] = useState<StudentPerf | null>(null)

  const buildLocal = useCallback((): StudentPerf => {
    const groups = getAssignmentsForTrack(track)
    const all = Object.entries(groups)
    const grades: StudentPerf['grades'] = []
    const perSubject: StudentPerf['perSubject'] = []
    let scored = 0
    let maxTotal = 0
    all.forEach(([cid, assignments]) => {
      const course = getCourses().find((c) => c.id === cid)
      let cScore = 0
      let cMax = 0
      assignments.forEach((a) => {
        const mine = getMySubmission(a.id, studentKey)
        if (mine && mine.status === 'graded' && mine.score != null) {
          scored += mine.score
          maxTotal += a.maxScore
          cScore += mine.score
          cMax += a.maxScore
          grades.push({
            key: a.id,
            title: a.title,
            score: mine.score,
            maxScore: a.maxScore,
            percent: Math.round((mine.score / a.maxScore) * 100),
          })
        }
      })
      if (cMax)
        perSubject.push({
          title: course?.title ?? cid,
          average: Math.round((cScore / cMax) * 100),
        })
    })
    const att = getStudentAttendance(studentKey)
    return {
      progress: trackProgress(studentKey, track),
      average: maxTotal ? Math.round((scored / maxTotal) * 100) : null,
      attendanceRate: att.rate,
      present: att.present,
      totalSessions: att.total,
      perSubject,
      grades,
    }
  }, [track, studentKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (isLive()) {
        try {
          const [a, gradesRaw] = await Promise.all([
            dsaApi.analytics.me() as Promise<Record<string, unknown>>,
            dsaApi.assignments.myGrades() as Promise<Record<string, unknown>[]>,
          ])
          if (cancelled) return
          const perSubject = (
            (a.perSubject as Record<string, unknown>[]) ?? []
          )
            .map((s) => ({
              title: String(s.title ?? s.subject ?? ''),
              average: num(s.average),
            }))
            .filter((s): s is { title: string; average: number } => s.average !== null)
          setPerf({
            progress: num(a.progressPercent) ?? 0,
            average: num(a.averageScore),
            attendanceRate: num(a.attendanceRate) ?? 0,
            present: num(a.present) ?? 0,
            totalSessions: num(a.totalSessions) ?? 0,
            perSubject,
            grades: gradesRaw.map((g) => ({
              key: String(g.id ?? g._id ?? g.sourceId ?? Math.random()),
              title: String(g.title ?? 'Assignment'),
              score: num(g.score) ?? 0,
              maxScore: num(g.maxScore) ?? 0,
              percent:
                num(g.percent) ??
                (num(g.maxScore)
                  ? Math.round(((num(g.score) ?? 0) / (num(g.maxScore) as number)) * 100)
                  : 0),
            })),
          })
          setLive(true)
          setLoading(false)
          return
        } catch {
          /* fall through to local */
        }
      }
      if (cancelled) return
      setPerf(buildLocal())
      setLive(false)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [buildLocal])

  if (loading || !perf) return <StudentAnalyticsSkeleton />

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
            My Performance
          </h2>
          <p className='text-[11px] font-bold text-slate-400'>
            Your progress, grades &amp; attendance at a glance.
          </p>
        </div>
        <LiveBadge live={live} />
      </div>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <StatTile
          label='Course Progress'
          value={`${perf.progress}%`}
          icon={TrendingUp}
          tint='bg-blue-50 text-blue-600'
        />
        <StatTile
          label='Average Score'
          value={perf.average != null ? `${perf.average}%` : '—'}
          sub={perf.average != null ? undefined : 'no grades yet'}
          icon={Award}
          tint='bg-emerald-50 text-emerald-600'
        />
        <StatTile
          label='Attendance'
          value={perf.totalSessions ? `${perf.attendanceRate}%` : '—'}
          sub={
            perf.totalSessions
              ? `${perf.present}/${perf.totalSessions} sessions`
              : 'no sessions yet'
          }
          icon={CalendarCheck}
          tint='bg-amber-50 text-amber-600'
        />
        <StatTile
          label='Graded'
          value={perf.grades.length}
          sub='assignments'
          icon={ClipboardCheck}
          tint='bg-purple-50 text-purple-600'
        />
      </div>

      <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
        <p className='text-[10px] font-black uppercase text-gray-400 mb-4 flex items-center gap-2'>
          <BookOpen size={13} className='text-[#002EFF]' /> Average by subject
        </p>
        {perf.perSubject.length === 0 ? (
          <p className='text-[11px] font-bold text-slate-400'>
            No graded scores yet.
          </p>
        ) : (
          <div className='space-y-3'>
            {perf.perSubject.map((c) => (
              <Bar key={c.title} label={c.title} pct={c.average} tintDanger />
            ))}
          </div>
        )}
      </Card>

      {perf.grades.length > 0 && (
        <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
          <p className='text-[10px] font-black uppercase text-gray-400 mb-4'>
            Graded assignments
          </p>
          <div className='space-y-2'>
            {perf.grades.map((g) => (
              <div
                key={g.key}
                className='flex items-center justify-between p-3 rounded-xl bg-slate-50/70'
              >
                <span className='text-[11px] font-black text-gray-700'>
                  {g.title}
                </span>
                <span
                  className={`text-[11px] font-black ${
                    g.percent >= 70 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {g.score}/{g.maxScore} · {g.percent}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ---------------- Tutor Analytics ---------------- */

type TutorPerf = {
  studentsCount: number
  classAverage: number | null
  toGradeCount: number
  students: { key: string; name: string; avg: number | null }[]
  atRisk: { key: string; name: string; avg: number }[]
  perCourse: {
    title: string
    assignments: number
    submissions: number
    graded: number
    average: number | null
  }[]
}

function TutorAnalytics() {
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [perf, setPerf] = useState<TutorPerf | null>(null)

  const buildLocal = useCallback((): TutorPerf => {
    const students = getStudents()
    const withAvg = students.filter((s) => s.avg != null)
    const classAverage = withAvg.length
      ? Math.round(
          withAvg.reduce((n, s) => n + (s.avg ?? 0), 0) / withAvg.length,
        )
      : null
    let toGrade = 0
    const perCourse = getCourses()
      .map((c) => {
        const assignments = getAssignments(c.id)
        let subs = 0
        let graded = 0
        let scoreSum = 0
        let maxSum = 0
        assignments.forEach((a) => {
          const ss = getSubmissions(a.id)
          subs += ss.length
          ss.forEach((s) => {
            if (s.status === 'graded' && s.score != null) {
              graded++
              scoreSum += s.score
              maxSum += a.maxScore
            } else {
              toGrade++
            }
          })
        })
        return {
          title: c.title,
          assignments: assignments.length,
          submissions: subs,
          graded,
          average: maxSum ? Math.round((scoreSum / maxSum) * 100) : null,
        }
      })
      .filter((c) => c.assignments > 0)
    return {
      studentsCount: students.length,
      classAverage,
      toGradeCount: toGrade,
      students: students.map((s) => ({
        key: s.key,
        name: s.name,
        avg: s.avg ?? null,
      })),
      atRisk: students
        .filter((s) => s.avg != null && (s.avg ?? 100) < 70)
        .map((s) => ({ key: s.key, name: s.name, avg: s.avg ?? 0 })),
      perCourse,
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (isLive()) {
        try {
          const [ov, roster] = await Promise.all([
            dsaApi.analytics.tutorOverview() as Promise<Record<string, unknown>>,
            dsaApi.analytics.tutorStudents() as Promise<Record<string, unknown>[]>,
          ])
          if (cancelled) return
          const atRiskRaw = (ov.atRiskStudents as Record<string, unknown>[]) ?? []
          const perCourseRaw = (ov.perCourse as Record<string, unknown>[]) ?? []
          setPerf({
            studentsCount: num(ov.studentsCount) ?? roster.length,
            classAverage: num(ov.classAverage),
            toGradeCount: num(ov.toGradeCount) ?? 0,
            students: roster.map((s, i) => ({
              key: String(s.id ?? s._id ?? i),
              name: String(s.fullname ?? s.fullName ?? 'Student'),
              avg: num(s.averageScore) ?? num(s.avg),
            })),
            atRisk: atRiskRaw.map((s, i) => ({
              key: String(s.id ?? s._id ?? i),
              name: String(s.fullname ?? s.fullName ?? 'Student'),
              avg: num(s.averageScore) ?? 0,
            })),
            perCourse: perCourseRaw.map((c) => ({
              title: String(c.title ?? 'Course'),
              assignments: num(c.assignments) ?? 0,
              submissions: num(c.submissions) ?? 0,
              graded: num(c.graded) ?? 0,
              average: num(c.average),
            })),
          })
          setLive(true)
          setLoading(false)
          return
        } catch {
          /* fall through to local */
        }
      }
      if (cancelled) return
      setPerf(buildLocal())
      setLive(false)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [buildLocal])

  if (loading || !perf) return <TutorAnalyticsSkeleton />

  const withAvg = perf.students.filter((s) => s.avg != null)

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
            Class Analytics
          </h2>
          <p className='text-[11px] font-bold text-slate-400'>
            How your students are performing.
          </p>
        </div>
        <LiveBadge live={live} />
      </div>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <StatTile
          label='Students'
          value={perf.studentsCount}
          icon={Users}
          tint='bg-blue-50 text-blue-600'
        />
        <StatTile
          label='Class Avg'
          value={perf.classAverage != null ? `${perf.classAverage}%` : '—'}
          icon={BarChart3}
          tint='bg-emerald-50 text-emerald-600'
        />
        <StatTile
          label='To Grade'
          value={perf.toGradeCount}
          sub='submissions'
          icon={ClipboardCheck}
          tint='bg-amber-50 text-amber-600'
        />
        <StatTile
          label='At Risk'
          value={perf.atRisk.length}
          sub='avg below 70%'
          icon={AlertTriangle}
          tint='bg-rose-50 text-rose-600'
        />
      </div>

      <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
        <p className='text-[10px] font-black uppercase text-gray-400 mb-4'>
          Average score by student
        </p>
        <div className='space-y-3'>
          {withAvg.length === 0 ? (
            <p className='text-[11px] font-bold text-slate-400'>
              No graded scores yet.
            </p>
          ) : (
            withAvg.map((s) => (
              <Bar key={s.key} label={s.name} pct={s.avg ?? 0} tintDanger />
            ))
          )}
        </div>
      </Card>

      <Card className='rounded-3xl border-none shadow-sm bg-white overflow-hidden'>
        <div className='px-6 py-4 border-b border-slate-50'>
          <p className='text-[10px] font-black uppercase text-gray-400'>
            Assignments by course
          </p>
        </div>
        {perf.perCourse.length === 0 ? (
          <p className='px-6 py-6 text-[11px] font-bold text-slate-400'>
            No assignments created yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left min-w-[520px]'>
              <thead>
                <tr className='bg-slate-50/60 text-[9px] font-black uppercase text-gray-400'>
                  <th className='px-6 py-3'>Course</th>
                  <th className='px-4 py-3'>Assignments</th>
                  <th className='px-4 py-3'>Submissions</th>
                  <th className='px-4 py-3'>Graded</th>
                  <th className='px-4 py-3'>Avg</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-50'>
                {perf.perCourse.map((c) => (
                  <tr key={c.title}>
                    <td className='px-6 py-3 text-xs font-black text-gray-800'>
                      {c.title}
                    </td>
                    <td className='px-4 py-3 text-xs font-bold text-slate-600'>
                      {c.assignments}
                    </td>
                    <td className='px-4 py-3 text-xs font-bold text-slate-600'>
                      {c.submissions}
                    </td>
                    <td className='px-4 py-3 text-xs font-bold text-slate-600'>
                      {c.graded}
                    </td>
                    <td className='px-4 py-3'>
                      {c.average == null ? (
                        <span className='text-[10px] font-bold text-slate-300'>
                          —
                        </span>
                      ) : (
                        <Badge
                          className={`text-[8px] font-black ${
                            c.average >= 70
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {c.average}%
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {perf.atRisk.length > 0 && (
        <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
          <p className='text-[10px] font-black uppercase text-gray-400 mb-3 flex items-center gap-2'>
            <AlertTriangle size={13} className='text-rose-500' /> Students needing
            attention
          </p>
          <div className='space-y-2'>
            {perf.atRisk.map((s) => (
              <div
                key={s.key}
                className='flex items-center justify-between p-3 rounded-xl bg-rose-50/60'
              >
                <span className='text-xs font-black text-gray-800'>{s.name}</span>
                <span className='text-xs font-black text-rose-500'>
                  {s.avg}% avg
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}