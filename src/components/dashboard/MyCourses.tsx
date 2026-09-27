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
// import { BookOpen, GraduationCap, Loader2, Users, CheckCircle2 } from 'lucide-react'
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

// type TutorGroup = {
//   name: string
//   courses: UICourse[]
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
//       <div className='py-16 flex justify-center items-center min-h-[300px]'>
//         <Loader2 className='animate-spin text-[#002EFF] h-8 w-8' />
//       </div>
//     )
//   }

//   // Group courses by tutor to create distinct tutor profile cards
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
//     <div className='space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4'>
//       {/* Header section */}
//       <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100'>
//         <div>
//           <h2 className='text-2xl sm:text-3xl font-black text-[#002EFF] italic uppercase tracking-tight'>
//             My Courses
//           </h2>
//           <p className='text-xs sm:text-sm font-medium text-slate-500 mt-0.5'>
//             {categoryLabel(category)} · Courses &amp; tutors for your programme
//           </p>
//         </div>
//         <Badge
//           className={`self-start sm:self-center px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shrink-0 ${
//             live ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
//           }`}
//         >
//           {live ? 'Live Data' : 'Local Store'}
//         </Badge>
//       </div>

//       {/* Tutors section */}
//       <section className='space-y-3'>
//         <div className='flex items-center gap-2'>
//           <div className='p-1.5 rounded-lg bg-blue-50 text-[#002EFF]'>
//             <Users size={16} />
//           </div>
//           <h3 className='text-xs font-black uppercase tracking-wider text-slate-500'>
//             Your Assigned Tutors ({tutorGroups.length})
//           </h3>
//         </div>

//         {tutorGroups.length === 0 ? (
//           <Card className='p-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center'>
//             <p className='text-xs font-semibold text-slate-400'>
//               No tutor assigned yet — check back soon.
//             </p>
//           </Card>
//         ) : (
//           <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5'>
//             {tutorGroups.map((tutor) => (
//               <Card
//                 key={tutor.name}
//                 className='p-4 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow duration-200 bg-white flex flex-col justify-between space-y-3'
//               >
//                 <div className='flex items-start gap-3'>
//                   {/* Tutor Avatar representation */}
//                   <div className='h-11 w-11 rounded-full bg-gradient-to-br from-[#002EFF] to-blue-700 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm'>
//                     {tutor.name.charAt(0).toUpperCase()}
//                   </div>
//                   <div className='min-w-0 flex-1'>
//                     <h4 className='text-sm font-bold text-slate-800 truncate leading-tight'>
//                       {tutor.name}
//                     </h4>
//                     <p className='text-[11px] font-medium text-slate-400 flex items-center gap-1 mt-0.5'>
//                       <GraduationCap size={13} className='text-[#002EFF]' />
//                       {tutor.courses.length} {tutor.courses.length === 1 ? 'Course' : 'Courses'} Assigned
//                     </p>
//                   </div>
//                 </div>

//                 {/* Courses handled by this tutor */}
//                 <div className='pt-2 border-t border-slate-100 space-y-1.5'>
//                   <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>
//                     Teaches:
//                   </p>
//                   <div className='flex flex-wrap gap-1.5'>
//                     {tutor.courses.map((c) => (
//                       <span
//                         key={c.id}
//                         className='px-2 py-0.5 rounded-md bg-blue-50/80 text-[#002EFF] text-[10px] font-semibold truncate max-w-full'
//                       >
//                         {c.subject || c.title}
//                       </span>
//                     ))}
//                   </div>
//                 </div>
//               </Card>
//             ))}
//           </div>
//         )}
//       </section>

//       {/* Courses List Section */}
//       <section className='space-y-3 pt-2'>
//         <div className='flex items-center gap-2'>
//           <div className='p-1.5 rounded-lg bg-blue-50 text-[#002EFF]'>
//             <BookOpen size={16} />
//           </div>
//           <h3 className='text-xs font-black uppercase tracking-wider text-slate-500'>
//             Enrolled Courses ({courses.length})
//           </h3>
//         </div>

//         {courses.length === 0 ? (
//           <Card className='p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center'>
//             <p className='text-xs sm:text-sm font-semibold text-slate-400'>
//               No courses published for your programme yet.
//             </p>
//           </Card>
//         ) : (
//           <div className='grid grid-cols-1 md:grid-cols-2 gap-3.5'>
//             {courses.map((c) => {
//               const hasProgress = typeof c.progressPercent === 'number'
//               const progress = c.progressPercent ?? 0

//               return (
//                 <Card
//                   key={c.id}
//                   className='p-4 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 bg-white flex flex-col justify-between space-y-3'
//                 >
//                   <div className='flex items-start gap-3.5'>
//                     <div className='h-10 w-10 rounded-xl bg-blue-50 text-[#002EFF] flex items-center justify-center shrink-0 mt-0.5'>
//                       <BookOpen size={18} />
//                     </div>
//                     <div className='min-w-0 flex-1 space-y-1'>
//                       <div className='flex items-start justify-between gap-2'>
//                         <h4 className='text-sm font-bold text-slate-900 leading-snug line-clamp-1'>
//                           {c.title}
//                         </h4>
//                       </div>
                      
//                       {c.subject && (
//                         <p className='text-xs font-medium text-slate-500'>
//                           {c.subject}
//                         </p>
//                       )}
//                     </div>
//                   </div>

//                   {/* Progress bar if present */}
//                   {hasProgress && (
//                     <div className='space-y-1 pt-1'>
//                       <div className='flex justify-between items-center text-[11px] font-semibold'>
//                         <span className='text-slate-400'>Progress</span>
//                         <span className='text-[#002EFF]'>{progress}%</span>
//                       </div>
//                       <div className='w-full h-1.5 bg-slate-100 rounded-full overflow-hidden'>
//                         <div
//                           className='h-full bg-[#002EFF] rounded-full transition-all duration-300'
//                           style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
//                         />
//                       </div>
//                     </div>
//                   )}

//                   {/* Card footer details */}
//                   <div className='flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]'>
//                     <span className='text-slate-400 font-medium'>Instructor</span>
//                     {c.tutorName ? (
//                       <Badge className='bg-blue-50 text-[#002EFF] hover:bg-blue-100 border-none px-2 py-0.5 text-[10px] font-bold rounded-md'>
//                         <GraduationCap size={11} className='mr-1 inline' />
//                         {c.tutorName}
//                       </Badge>
//                     ) : (
//                       <Badge className='bg-amber-50 text-amber-600 hover:bg-amber-100 border-none px-2 py-0.5 text-[10px] font-bold rounded-md'>
//                         Unassigned
//                       </Badge>
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
import { BookOpen, GraduationCap, Loader2, Users, Percent, Tag } from 'lucide-react'
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
      <div className='py-16 flex justify-center items-center min-h-[300px]'>
        <Loader2 className='animate-spin text-[#002EFF] h-8 w-8' />
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
    <div className='space-y-6 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4'>
      {/* Header section */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100'>
        <div>
          <h2 className='text-2xl sm:text-3xl font-black text-[#002EFF] italic uppercase tracking-tight'>
            My Courses
          </h2>
          <p className='text-xs sm:text-sm font-medium text-slate-500 mt-0.5'>
            {categoryLabel(category)} · Courses &amp; tutors for your programme
          </p>
        </div>
        <Badge
          className={`self-start sm:self-center px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shrink-0 ${
            live ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}
        >
          {live ? 'Live Data' : 'Local Store'}
        </Badge>
      </div>

      {/* Tutors Box Section */}
      <section className='space-y-3'>
        <div className='flex items-center gap-2'>
          <div className='p-1.5 rounded-lg bg-blue-50 text-[#002EFF]'>
            <Users size={16} />
          </div>
          <h3 className='text-xs font-black uppercase tracking-wider text-slate-500'>
            Your Assigned Tutors ({tutorGroups.length})
          </h3>
        </div>

        {tutorGroups.length === 0 ? (
          <Card className='p-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center'>
            <p className='text-xs font-semibold text-slate-400'>
              No tutor assigned yet — check back soon.
            </p>
          </Card>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5'>
            {tutorGroups.map((tutor) => (
              <Card
                key={tutor.name}
                className='p-4 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 bg-white flex flex-col justify-between space-y-3'
              >
                <div className='flex items-start gap-3'>
                  {/* Tutor Avatar Box */}
                  <div className='h-11 w-11 rounded-xl bg-gradient-to-br from-[#002EFF] to-blue-700 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm'>
                    {tutor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <h4 className='text-sm font-bold text-slate-800 truncate leading-tight'>
                      {tutor.name}
                    </h4>
                    <p className='text-[11px] font-medium text-slate-400 flex items-center gap-1 mt-0.5'>
                      <GraduationCap size={13} className='text-[#002EFF]' />
                      {tutor.courses.length} {tutor.courses.length === 1 ? 'Course' : 'Courses'} Assigned
                    </p>
                  </div>
                </div>

                {/* Courses handled by this tutor in neat tag boxes */}
                <div className='pt-2 border-t border-slate-100 space-y-1.5'>
                  <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>
                    Teaches:
                  </p>
                  <div className='flex flex-wrap gap-1.5'>
                    {tutor.courses.map((c) => (
                      <span
                        key={c.id}
                        className='px-2.5 py-1 rounded-lg bg-blue-50/80 border border-blue-100 text-[#002EFF] text-[10px] font-bold truncate max-w-full'
                      >
                        {c.subject || c.title}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Courses List Section */}
      <section className='space-y-3 pt-2'>
        <div className='flex items-center gap-2'>
          <div className='p-1.5 rounded-lg bg-blue-50 text-[#002EFF]'>
            <BookOpen size={16} />
          </div>
          <h3 className='text-xs font-black uppercase tracking-wider text-slate-500'>
            Enrolled Courses ({courses.length})
          </h3>
        </div>

        {courses.length === 0 ? (
          <Card className='p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center'>
            <p className='text-xs sm:text-sm font-semibold text-slate-400'>
              No courses published for your programme yet.
            </p>
          </Card>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3.5'>
            {courses.map((c) => {
              const hasProgress = typeof c.progressPercent === 'number'
              const progress = c.progressPercent ?? 0

              return (
                <Card
                  key={c.id}
                  className='p-4 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 bg-white flex flex-col justify-between space-y-3.5'
                >
                  {/* Top section: Course Title and Icon */}
                  <div className='flex items-start gap-3'>
                    <div className='h-10 w-10 rounded-xl bg-blue-50 text-[#002EFF] flex items-center justify-center shrink-0 mt-0.5 border border-blue-100'>
                      <BookOpen size={18} />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <h4 className='text-sm font-bold text-slate-900 leading-snug truncate'>
                        {c.title}
                      </h4>
                    </div>
                  </div>

                  {/* Metadata Boxes Row: Subject Box & Progress Box aligned in grid/flex */}
                  <div className='grid grid-cols-2 gap-2 pt-1'>
                    {/* Subject Box */}
                    <div className='flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 min-w-0'>
                      <Tag size={12} className='text-slate-400 shrink-0' />
                      <div className='min-w-0 flex-1'>
                        <p className='text-[9px] font-extrabold uppercase text-slate-400 leading-none'>
                          Subject
                        </p>
                        <p className='text-[11px] font-bold text-slate-700 truncate mt-0.5'>
                          {c.subject || 'General'}
                        </p>
                      </div>
                    </div>

                    {/* Progress Percentage Box */}
                    <div className='flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50/50 border border-blue-100/60 min-w-0'>
                      <Percent size={12} className='text-[#002EFF] shrink-0' />
                      <div className='min-w-0 flex-1'>
                        <p className='text-[9px] font-extrabold uppercase text-[#002EFF]/70 leading-none'>
                          Progress
                        </p>
                        <p className='text-[11px] font-black text-[#002EFF] mt-0.5'>
                          {hasProgress ? `${progress}%` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visual Progress Bar (if progress exists) */}
                  {hasProgress && (
                    <div className='w-full h-1.5 bg-slate-100 rounded-full overflow-hidden'>
                      <div
                        className='h-full bg-[#002EFF] rounded-full transition-all duration-300'
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                      />
                    </div>
                  )}

                  {/* Footer Box: Tutor Alignment */}
                  <div className='flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]'>
                    <span className='text-slate-400 font-semibold text-[10px] uppercase tracking-wider'>
                      Instructor
                    </span>
                    {c.tutorName ? (
                      <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-[#002EFF] border border-blue-100 text-[10px] font-black'>
                        <GraduationCap size={12} />
                        {c.tutorName}
                      </span>
                    ) : (
                      <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black'>
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