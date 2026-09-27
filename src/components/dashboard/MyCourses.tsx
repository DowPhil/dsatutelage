// 'use client'

// import { useCallback, useEffect, useState } from 'react'
// import { BookOpen, GraduationCap, Loader2, Users } from 'lucide-react'
// import { Card } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import {
//   getCoursesByCategory,
//   categoryForTrack,
//   categoryLabel,
// } from '@/lib/coursesStore'
// import { getUser, getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'
// import { normaliseTrack } from '@/lib/studentProfile'
// import type { CourseCategory } from '@/lib/types'

// // Display shape shared by the live API and the local store.
// type UICourse = {
//   id: string
//   title: string
//   subject?: string
//   tutorName?: string
//   progressPercent?: number
// }

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }

// /** Map a live `/courses/mine` row (tutor is nested; progressPercent present). */
// function fromLive(c: Record<string, unknown>): UICourse {
//   const tutor = (c.tutor ?? {}) as Record<string, unknown>
//   return {
//     id: String(c.id ?? c._id ?? ''),
//     title: String(c.title ?? 'Course'),
//     subject: c.subject ? String(c.subject) : undefined,
//     tutorName:
//       (c.tutorName as string) ||
//       (tutor.fullname as string) ||
//       (tutor.fullName as string) ||
//       undefined,
//     progressPercent:
//       typeof c.progressPercent === 'number' ? c.progressPercent : undefined,
//   }
// }

// /**
//  * Student "My Courses" — the courses & tutors for the student's programme.
//  *
//  * Live-first: with a real JWT it reads GET /courses/mine (the backend derives
//  * the student's category from programmes + level, so it is the source of
//  * truth). On demo/offline it falls back to the local coursesStore keyed off the
//  * student's track so the preview still works.
//  */
// export default function MyCourses({ track: trackProp }: { track?: string }) {
//   const [mounted, setMounted] = useState(false)
//   const [loading, setLoading] = useState(true)
//   const [courses, setCourses] = useState<UICourse[]>([])
//   const [live, setLive] = useState(false)
//   const [category, setCategory] = useState<CourseCategory>('jamb-putme')

//   const load = useCallback(async () => {
//     const u = getUser()
//     const track = trackProp || normaliseTrack(u?.level || u?.examType || 'jamb')
//     const localCategory = categoryForTrack(track)
//     setCategory(localCategory)

//     if (isLive()) {
//       try {
//         const rows = (await dsaApi.courses.mine()) as Record<string, unknown>[]
//         setCourses(rows.map(fromLive))
//         setLive(true)
//         setLoading(false)
//         return
//       } catch {
//         // fall through to the local store
//       }
//     }

//     const localCourses = getCoursesByCategory(localCategory).map((c) => ({
//       id: c.id,
//       title: c.title,
//       subject: c.subject,
//       tutorName: c.tutorName,
//     }))
//     setCourses(localCourses)
//     setLive(false)
//     setLoading(false)
//   }, [trackProp])

//   useEffect(() => {
//     setMounted(true)
//     void load()
//   }, [load])

//   if (!mounted || loading) {
//     return (
//       <div className='py-16 flex justify-center'>
//         <Loader2 className='animate-spin text-[#002EFF]' />
//       </div>
//     )
//   }

//   const tutors = Array.from(
//     new Set(courses.map((c) => c.tutorName).filter(Boolean) as string[]),
//   )

//   return (
//     <div className='space-y-5'>
//       <div className='flex items-start justify-between gap-3'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
//             My Courses
//           </h2>
//           <p className='text-[11px] font-bold text-slate-400'>
//             {categoryLabel(category)} · the courses &amp; tutors for your
//             programme.
//           </p>
//         </div>
//         <Badge
//           className={`text-[8px] font-black shrink-0 ${
//             live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
//           }`}
//         >
//           {live ? 'Live' : 'Local'}
//         </Badge>
//       </div>

//       {/* Your tutors */}
//       <Card className='p-4 rounded-3xl border-none shadow-sm bg-white'>
//         <p className='text-[10px] font-black uppercase text-gray-400 mb-2 flex items-center gap-2'>
//           <Users size={13} className='text-[#002EFF]' /> Your tutors
//         </p>
//         {tutors.length === 0 ? (
//           <p className='text-[11px] font-bold text-slate-400'>
//             No tutor assigned yet — check back soon.
//           </p>
//         ) : (
//           <div className='flex flex-wrap gap-2'>
//             {tutors.map((t) => (
//               <span
//                 key={t}
//                 className='px-3 py-1.5 rounded-lg bg-blue-50 text-[#002EFF] text-[10px] font-black uppercase tracking-wide flex items-center gap-1'
//               >
//                 <GraduationCap size={12} /> {t}
//               </span>
//             ))}
//           </div>
//         )}
//       </Card>

//       {courses.length === 0 ? (
//         <p className='text-xs font-bold text-slate-400 py-8 text-center'>
//           No courses published for your programme yet.
//         </p>
//       ) : (
//         <div className='space-y-2'>
//           {courses.map((c) => (
//             <Card
//               key={c.id}
//               className='p-4 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3'
//             >
//               <div className='h-10 w-10 rounded-xl bg-blue-50 text-[#002EFF] flex items-center justify-center shrink-0'>
//                 <BookOpen size={18} />
//               </div>
//               <div className='min-w-0 flex-1'>
//                 <p className='text-xs font-black text-gray-800 truncate'>
//                   {c.title}
//                 </p>
//                 <p className='text-[10px] font-bold text-slate-400'>
//                   {c.subject}
//                   {typeof c.progressPercent === 'number' && (
//                     <span className='text-[#002EFF]'>
//                       {' '}
//                       · {c.progressPercent}% complete
//                     </span>
//                   )}
//                 </p>
//               </div>
//               {c.tutorName ? (
//                 <Badge className='bg-blue-50 text-[#002EFF] text-[8px] font-black'>
//                   <GraduationCap size={9} className='mr-1' /> {c.tutorName}
//                 </Badge>
//               ) : (
//                 <Badge className='bg-amber-50 text-amber-600 text-[8px] font-black'>
//                   Unassigned
//                 </Badge>
//               )}
//             </Card>
//           ))}
//         </div>
//       )}
//     </div>
//   )
// }



// 'use client'

// import { useCallback, useEffect, useState } from 'react'
// import { BookOpen, GraduationCap, Loader2, Users, Percent } from 'lucide-react'
// import { Card } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import {
//   getCoursesByCategory,
//   categoryForTrack,
//   categoryLabel,
// } from '@/lib/coursesStore'
// import { getUser, getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'
// import { normaliseTrack } from '@/lib/studentProfile'
// import type { CourseCategory } from '@/lib/types'

// type UICourse = {
//   id: string
//   title: string
//   subject?: string
//   tutorName?: string
//   progressPercent?: number
// }

// type TutorGroup = {
//   name: string
//   courses: UICourse[]
// }

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }

// function fromLive(c: Record<string, unknown>): UICourse {
//   const tutor = (c.tutor ?? {}) as Record<string, unknown>
//   return {
//     id: String(c.id ?? c._id ?? ''),
//     title: String(c.title ?? 'Course'),
//     subject: c.subject ? String(c.subject) : undefined,
//     tutorName:
//       (c.tutorName as string) ||
//       (tutor.fullname as string) ||
//       (tutor.fullName as string) ||
//       undefined,
//     progressPercent:
//       typeof c.progressPercent === 'number' ? c.progressPercent : undefined,
//   }
// }

// export default function MyCourses({ track: trackProp }: { track?: string }) {
//   const [mounted, setMounted] = useState(false)
//   const [loading, setLoading] = useState(true)
//   const [courses, setCourses] = useState<UICourse[]>([])
//   const [live, setLive] = useState(false)
//   const [category, setCategory] = useState<CourseCategory>('jamb-putme')

//   const load = useCallback(async () => {
//     const u = getUser()
//     const track = trackProp || normaliseTrack(u?.level || u?.examType || 'jamb')
//     const localCategory = categoryForTrack(track)
//     setCategory(localCategory)

//     if (isLive()) {
//       try {
//         const rows = (await dsaApi.courses.mine()) as Record<string, unknown>[]
//         setCourses(rows.map(fromLive))
//         setLive(true)
//         setLoading(false)
//         return
//       } catch {
//         // fall through to local store
//       }
//     }

//     const localCourses = getCoursesByCategory(localCategory).map((c) => ({
//       id: c.id,
//       title: c.title,
//       subject: c.subject,
//       tutorName: c.tutorName,
//     }))
//     setCourses(localCourses)
//     setLive(false)
//     setLoading(false)
//   }, [trackProp])

//   useEffect(() => {
//     setMounted(true)
//     void load()
//   }, [load])

//   if (!mounted || loading) {
//     return (
//       <div className="py-16 flex justify-center items-center min-h-[300px]">
//         <Loader2 className="animate-spin text-[#002EFF] dark:text-blue-500 h-8 w-8" />
//       </div>
//     )
//   }

//   // Group courses by tutor
//   const tutorMap = courses.reduce<Record<string, UICourse[]>>((acc, course) => {
//     if (course.tutorName) {
//       if (!acc[course.tutorName]) acc[course.tutorName] = []
//       acc[course.tutorName].push(course)
//     }
//     return acc
//   }, {})

//   const tutorGroups: TutorGroup[] = Object.entries(tutorMap).map(
//     ([name, assignedCourses]) => ({
//       name,
//       courses: assignedCourses,
//     })
//   )

//   return (
//     <div className="space-y-6 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
//       {/* Header section */}
//       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
//         <div>
//           <h2 className="text-2xl sm:text-3xl font-black text-[#002EFF] dark:text-blue-400 italic uppercase tracking-tight">
//             My Courses
//           </h2>
//           <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
//             {categoryLabel(category)} · Courses &amp; tutors for your programme
//           </p>
//         </div>
//         <Badge
//           className={`self-start sm:self-center px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shrink-0 ${
//             live
//               ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/80'
//               : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
//           }`}
//         >
//           {live ? 'Live Data' : 'Local Store'}
//         </Badge>
//       </div>

//       {/* Vertical Tutors List Section */}
//       <section className="space-y-3">
//         <div className="flex items-center gap-2">
//           <div className="p-1.5 rounded-lg bg-blue-50 text-[#002EFF] dark:bg-blue-950/60 dark:text-blue-400">
//             <Users size={16} />
//           </div>
//           <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
//             Your Assigned Tutors ({tutorGroups.length})
//           </h3>
//         </div>

//         {tutorGroups.length === 0 ? (
//           <Card className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center">
//             <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
//               No tutor assigned yet — check back soon.
//             </p>
//           </Card>
//         ) : (
//           <Card className="rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
//             {tutorGroups.map((tutor) => (
//               <div
//                 key={tutor.name}
//                 className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors"
//               >
//                 <div className="flex items-center gap-3 min-w-0">
//                   <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#002EFF] to-blue-700 dark:from-blue-600 dark:to-blue-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
//                     {tutor.name.charAt(0).toUpperCase()}
//                   </div>
//                   <div className="min-w-0">
//                     <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
//                       {tutor.name}
//                     </h4>
//                     <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
//                       <GraduationCap size={12} className="text-[#002EFF] dark:text-blue-400" />
//                       Instructor
//                     </p>
//                   </div>
//                 </div>

//                 {/* Courses aligned in front of tutor name */}
//                 <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 max-w-[50%] sm:max-w-[60%]">
//                   {tutor.courses.map((c) => (
//                     <span
//                       key={c.id}
//                       className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[#002EFF] dark:bg-blue-950/80 dark:border-blue-900/80 dark:text-blue-300 text-[10px] font-bold truncate max-w-[140px] sm:max-w-[200px]"
//                     >
//                       {c.subject || c.title}
//                     </span>
//                   ))}
//                 </div>
//               </div>
//             ))}
//           </Card>
//         )}
//       </section>

//       {/* Courses List Section */}
//       <section className="space-y-3 pt-2">
//         <div className="flex items-center gap-2">
//           <div className="p-1.5 rounded-lg bg-blue-50 text-[#002EFF] dark:bg-blue-950/60 dark:text-blue-400">
//             <BookOpen size={16} />
//           </div>
//           <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
//             Enrolled Courses ({courses.length})
//           </h3>
//         </div>

//         {courses.length === 0 ? (
//           <Card className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center">
//             <p className="text-xs sm:text-sm font-semibold text-slate-400 dark:text-slate-500">
//               No courses published for your programme yet.
//             </p>
//           </Card>
//         ) : (
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
//             {courses.map((c) => {
//               const hasProgress = typeof c.progressPercent === 'number'
//               const progress = c.progressPercent ?? 0

//               return (
//                 <Card
//                   key={c.id}
//                   className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-3.5"
//                 >
//                   {/* Top section: Course Title and Icon */}
//                   <div className="flex items-start gap-3">
//                     <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#002EFF] dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100 dark:border-blue-900/60">
//                       <BookOpen size={18} />
//                     </div>
//                     <div className="min-w-0 flex-1">
//                       <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug truncate">
//                         {c.title}
//                       </h4>
//                       {c.subject && (
//                         <p className="text-[11px] font-medium text-slate-400 dark:text-slate-400 mt-0.5 truncate">
//                           {c.subject}
//                         </p>
//                       )}
//                     </div>
//                   </div>

//                   {/* Only Percentage Stat Box */}
//                   <div className="pt-1">
//                     <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/40 border border-blue-100/60 dark:border-blue-900/50">
//                       <div className="flex items-center gap-2">
//                         <div className="p-1 rounded-lg bg-blue-100/60 dark:bg-blue-900/60 text-[#002EFF] dark:text-blue-300">
//                           <Percent size={13} />
//                         </div>
//                         <span className="text-[10px] font-extrabold uppercase text-[#002EFF]/80 dark:text-blue-300">
//                           Course Completion
//                         </span>
//                       </div>
//                       <span className="text-xs font-black text-[#002EFF] dark:text-blue-400">
//                         {hasProgress ? `${progress}%` : 'N/A'}
//                       </span>
//                     </div>
//                   </div>

//                   {/* Visual Progress Bar (if progress exists) */}
//                   {hasProgress && (
//                     <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
//                       <div
//                         className="h-full bg-[#002EFF] dark:bg-blue-500 rounded-full transition-all duration-300"
//                         style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
//                       />
//                     </div>
//                   )}

//                   {/* Footer Box: Tutor Alignment */}
//                   <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
//                     <span className="text-slate-400 dark:text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
//                       Instructor
//                     </span>
//                     {c.tutorName ? (
//                       <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-[#002EFF] dark:text-blue-300 border border-blue-100 dark:border-blue-900/80 text-[10px] font-black">
//                         <GraduationCap size={12} />
//                         {c.tutorName}
//                       </span>
//                     ) : (
//                       <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60 text-[10px] font-black">
//                         Unassigned
//                       </span>
//                     )}
//                   </div>
//                 </Card>
//               )
//             })}
//           </div>
//         )}
//       </section>
//     </div>
//   )
// }


'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, GraduationCap, Loader2, Users, Percent } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getCoursesByCategory,
  categoryForTrack,
  categoryLabel,
} from '@/lib/coursesStore'
import { getUser, getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'
import { normaliseTrack } from '@/lib/studentProfile'
import type { CourseCategory } from '@/lib/types'

type UICourse = {
  id: string
  title: string
  subject?: string
  tutorName?: string
  progressPercent?: number
}

type TutorGroup = {
  name: string
  courses: UICourse[]
}

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

function fromLive(c: Record<string, unknown>): UICourse {
  const tutor = (c.tutor ?? {}) as Record<string, unknown>
  return {
    id: String(c.id ?? c._id ?? ''),
    title: String(c.title ?? 'Course'),
    subject: c.subject ? String(c.subject) : undefined,
    tutorName:
      (c.tutorName as string) ||
      (tutor.fullname as string) ||
      (tutor.fullName as string) ||
      undefined,
    progressPercent:
      typeof c.progressPercent === 'number' ? c.progressPercent : undefined,
  }
}

export default function MyCourses({ track: trackProp }: { track?: string }) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<UICourse[]>([])
  const [live, setLive] = useState(false)
  const [category, setCategory] = useState<CourseCategory>('jamb-putme')

  const load = useCallback(async () => {
    const u = getUser()
    const track = trackProp || normaliseTrack(u?.level || u?.examType || 'jamb')
    const localCategory = categoryForTrack(track)
    setCategory(localCategory)

    if (isLive()) {
      try {
        const rows = (await dsaApi.courses.mine()) as Record<string, unknown>[]
        setCourses(rows.map(fromLive))
        setLive(true)
        setLoading(false)
        return
      } catch {
        // fall through to local store
      }
    }

    const localCourses = getCoursesByCategory(localCategory).map((c) => ({
      id: c.id,
      title: c.title,
      subject: c.subject,
      tutorName: c.tutorName,
    }))
    setCourses(localCourses)
    setLive(false)
    setLoading(false)
  }, [trackProp])

  useEffect(() => {
    setMounted(true)
    void load()
  }, [load])

  if (!mounted || loading) {
    return (
      <div className="py-16 flex justify-center items-center min-h-[300px]">
        <Loader2 className="animate-spin text-[#002EFF] h-8 w-8" />
      </div>
    )
  }

  // Group courses by tutor
  const tutorMap = courses.reduce<Record<string, UICourse[]>>((acc, course) => {
    if (course.tutorName) {
      if (!acc[course.tutorName]) acc[course.tutorName] = []
      acc[course.tutorName].push(course)
    }
    return acc
  }, {})

  const tutorGroups: TutorGroup[] = Object.entries(tutorMap).map(
    ([name, assignedCourses]) => ({
      name,
      courses: assignedCourses,
    })
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F5F5F5] dark:border-zinc-800">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#002EFF] italic uppercase tracking-tight">
            My Courses
          </h2>
          <p className="text-xs sm:text-sm font-medium text-[#4B5563] dark:text-zinc-400 mt-0.5">
            {categoryLabel(category)} · Courses &amp; tutors for your programme
          </p>
        </div>
        <Badge
          className={`self-start sm:self-center px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shrink-0 ${
            live
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-[#F5F5F5] dark:bg-zinc-800 text-[#4B5563] dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {live ? 'Live Data' : 'Local Store'}
        </Badge>
      </div>

      {/* Vertical Tutors List Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#002EFF]/10 text-[#002EFF] dark:bg-[#002EFF]/20">
            <Users size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-[#4B5563] dark:text-zinc-400">
            Your Assigned Tutors ({tutorGroups.length})
          </h3>
        </div>

        {tutorGroups.length === 0 ? (
          <Card className="p-6 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-[#F5F5F5]/60 dark:bg-zinc-900/50 text-center">
            <p className="text-xs font-semibold text-[#4B5563] dark:text-zinc-400">
              No tutor assigned yet — check back soon.
            </p>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs bg-[#FFFFFF] dark:bg-[#000000] divide-y divide-[#F5F5F5] dark:divide-zinc-800/80 overflow-hidden">
            {tutorGroups.map((tutor) => (
              <div
                key={tutor.name}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#F5F5F5]/60 dark:hover:bg-zinc-900/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#002EFF] to-blue-700 text-[#FFFFFF] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    {tutor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-[#000000] dark:text-[#FFFFFF] truncate leading-tight">
                      {tutor.name}
                    </h4>
                    <p className="text-[10px] font-medium text-[#4B5563] dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                      <GraduationCap size={12} className="text-[#002EFF]" />
                      Instructor
                    </p>
                  </div>
                </div>

                {/* Courses aligned in front of tutor name */}
                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 max-w-[50%] sm:max-w-[60%]">
                  {tutor.courses.map((c) => (
                    <span
                      key={c.id}
                      className="px-2 py-0.5 rounded-md bg-[#FCB900]/15 dark:bg-[#FCB900]/20 border border-[#FCB900]/40 text-[#B38300] dark:text-[#FCB900] text-[10px] font-extrabold truncate max-w-[140px] sm:max-w-[200px]"
                    >
                      {c.subject || c.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Courses List Section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#002EFF]/10 text-[#002EFF] dark:bg-[#002EFF]/20">
            <BookOpen size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-[#4B5563] dark:text-zinc-400">
            Enrolled Courses ({courses.length})
          </h3>
        </div>

        {courses.length === 0 ? (
          <Card className="p-8 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-[#F5F5F5]/60 dark:bg-zinc-900/50 text-center">
            <p className="text-xs sm:text-sm font-semibold text-[#4B5563] dark:text-zinc-400">
              No courses published for your programme yet.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {courses.map((c) => {
              const hasProgress = typeof c.progressPercent === 'number'
              const progress = c.progressPercent ?? 0

              return (
                <Card
                  key={c.id}
                  className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all duration-200 bg-[#FFFFFF] dark:bg-[#000000] flex flex-col justify-between space-y-3.5"
                >
                  {/* Top section: Course Title and Icon */}
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#002EFF]/10 text-[#002EFF] dark:bg-[#002EFF]/20 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-[#002EFF]/20">
                      <BookOpen size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-[#000000] dark:text-[#FFFFFF] leading-snug truncate">
                        {c.title}
                      </h4>
                      {c.subject && (
                        <p className="text-[11px] font-medium text-[#4B5563] dark:text-zinc-400 mt-0.5 truncate">
                          {c.subject}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Single Completion Stat Box Highlighted in Yellow */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FCB900]/10 dark:bg-[#FCB900]/15 border border-[#FCB900]/30 dark:border-[#FCB900]/25">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-lg bg-[#FCB900] text-[#000000]">
                          <Percent size={13} className="stroke-[3]" />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase text-[#000000] dark:text-white">
                          Course Completion
                        </span>
                      </div>
                      <span className="text-xs font-black text-[#B38300] dark:text-[#FCB900]">
                        {hasProgress ? `${progress}%` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar Highlighted in Accent Yellow */}
                  {hasProgress && (
                    <div className="w-full h-1.5 bg-[#F5F5F5] dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FCB900] rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                      />
                    </div>
                  )}

                  {/* Footer Box: Instructor Badge */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F5] dark:border-zinc-800 text-[11px]">
                    <span className="text-[#4B5563] dark:text-zinc-400 font-semibold text-[10px] uppercase tracking-wider">
                      Instructor
                    </span>
                    {c.tutorName ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#002EFF]/10 text-[#002EFF] dark:bg-[#002EFF]/20 dark:text-blue-400 border border-[#002EFF]/20 text-[10px] font-black">
                        <GraduationCap size={12} />
                        {c.tutorName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FCB900]/15 text-[#000000] dark:text-[#FCB900] border border-[#FCB900]/30 text-[10px] font-black">
                        Unassigned
                      </span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}