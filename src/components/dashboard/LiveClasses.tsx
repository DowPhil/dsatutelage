// 'use client'

// import React, { useCallback, useEffect, useState } from 'react'
// import {
//   Video,
//   Save,
//   Radio,
//   Square,
//   Clock,
//   CalendarDays,
//   Link as LinkIcon,
//   Info,
//   Loader2,
//   PlayCircle,
//   BookOpen,
// } from 'lucide-react'
// import { Card } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import {
//   getMeetLink,
//   saveMeetLink,
//   getLiveStatus,
//   setLiveStatus,
//   type LiveStatus,
// } from '@/lib/liveClass'
// import {
//   getEffectiveTimetable,
//   getNextClass,
//   gridFromApi,
//   type NextClass,
// } from '@/lib/timetable'
// import { getUser, getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'
// import { getCourses } from '@/lib/coursesStore'
// import { normaliseTrack, EXAM_TRACKS } from '@/lib/studentProfile'
// import type { ExamTrack } from '@/lib/studentProfile'

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }

// function normStatus(s: unknown): LiveStatus {
//   return s === 'live' || s === 'ended' ? s : 'scheduled'
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

// // Next class from the live timetable (transposed) when signed in, else local.
// function NextClassCard({ track }: { track: ExamTrack }) {
//   const [next, setNext] = useState<NextClass | null | undefined>(undefined)
//   useEffect(() => {
//     let cancelled = false
//     const local = () => {
//       if (!cancelled) setNext(getNextClass(getEffectiveTimetable(track)))
//     }
//     if (isLive()) {
//       dsaApi.timetable
//         .get(track)
//         .then((res) => {
//           if (cancelled) return
//           const grid = (res as { grid?: unknown })?.grid
//           setNext(
//             getNextClass(
//               Array.isArray(grid)
//                 ? gridFromApi(grid)
//                 : getEffectiveTimetable(track),
//             ),
//           )
//         })
//         .catch(local)
//     } else local()
//     return () => {
//       cancelled = true
//     }
//   }, [track])

//   if (next === undefined) {
//     return (
//       <p className='text-[11px] font-bold text-slate-400'>Loading schedule…</p>
//     )
//   }
//   if (!next) {
//     return (
//       <p className='text-[11px] font-bold text-slate-400'>
//         No class scheduled in the coming week.
//       </p>
//     )
//   }
//   return (
//     <div className='flex items-center gap-3'>
//       <div
//         className={`text-center p-3 rounded-2xl min-w-[64px] ${next.ongoing ? 'bg-[#FCB900] text-[#002EFF]' : 'bg-blue-50 text-gray-700'}`}
//       >
//         <p className='text-[9px] font-black uppercase'>{next.when}</p>
//         <p className='text-[11px] font-black'>{next.time.split(' ')[0]}</p>
//       </div>
//       <div>
//         <div className='flex items-center gap-2'>
//           <h4 className='text-sm font-black text-gray-800 uppercase'>
//             {next.subject}
//           </h4>
//           {next.ongoing && (
//             <Badge className='bg-red-500 text-white text-[8px] font-black animate-pulse'>
//               ONGOING
//             </Badge>
//           )}
//         </div>
//         <p className='text-[10px] font-bold text-gray-400 flex items-center gap-1'>
//           <Clock size={11} /> {next.day} · {next.time}
//         </p>
//       </div>
//     </div>
//   )
// }

// function StatusPill({ status }: { status: LiveStatus }) {
//   const map: Record<LiveStatus, string> = {
//     scheduled: 'bg-slate-100 text-slate-500',
//     live: 'bg-red-500 text-white animate-pulse',
//     ended: 'bg-slate-200 text-slate-500',
//   }
//   return (
//     <span
//       className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${map[status]}`}
//     >
//       {status}
//     </span>
//   )
// }

// export default function LiveClasses({
//   mode,
//   track: trackProp,
// }: {
//   mode: 'tutor' | 'student'
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

//   if (mode === 'tutor') return <TutorLive />

//   const u = getUser() as Record<string, unknown> | null
//   const s = (v: unknown) => (v == null ? '' : String(v))
//   // Prefer the resolved exam track (what live classes are keyed by); the class
//   // level (SS2, 100 Level…) is not a track and must not win here.
//   const track = (trackProp ||
//     normaliseTrack(
//       s(u?.examTrack) ||
//         s(u?.examType) ||
//         s(u?.track) ||
//         s(u?.level) ||
//         'jamb',
//     )) as ExamTrack
//   return <StudentLive track={track} />
// }

// /* ---------------- Tutor: upload link + control status (per course) ---------------- */
// type TutorCourse = { id: string; title: string; track: ExamTrack }

// function TutorLive() {
//   const live = isLive()
//   const [courses, setCourses] = useState<TutorCourse[]>([])
//   const [courseId, setCourseId] = useState('')
//   const [loadingCourses, setLoadingCourses] = useState(true)
//   const [link, setLink] = useState('')
//   const [status, setStatus] = useState<LiveStatus>('scheduled')
//   const [isFree, setIsFree] = useState(false)
//   const [saved, setSaved] = useState(false)
//   const [busy, setBusy] = useState(false)
//   const [err, setErr] = useState('')

//   const selected = courses.find((c) => c.id === courseId)
//   const track = selected?.track ?? 'jamb'

//   // Load the tutor's courses.
//   useEffect(() => {
//     let cancelled = false
//     ;(async () => {
//       if (live) {
//         try {
//           const cs = (await dsaApi.courses.list({
//             tutorId: 'me',
//           })) as Record<string, unknown>[]
//           if (cancelled) return
//           const mapped: TutorCourse[] = cs.map((c) => ({
//             id: String(c.id ?? c._id ?? ''),
//             title: String(c.title ?? 'Course'),
//             track: normaliseTrack(
//               (c.category as string) ||
//                 (c.track as string) ||
//                 (c.subject as string) ||
//                 '',
//             ),
//           }))
//           setCourses(mapped)
//           setCourseId((p) => p || mapped[0]?.id || '')
//           setLoadingCourses(false)
//           return
//         } catch {
//           /* fall through to local */
//         }
//       }
//       if (cancelled) return
//       const cs = getCourses().map((c) => ({
//         id: c.id,
//         title: c.title,
//         track: normaliseTrack(
//           (c as { track?: string; category?: string }).track ||
//             (c as { category?: string }).category ||
//             c.title,
//         ),
//       }))
//       setCourses(cs)
//       setCourseId((p) => p || cs[0]?.id || '')
//       setLoadingCourses(false)
//     })()
//     return () => {
//       cancelled = true
//     }
//   }, [live])

//   const load = useCallback(async () => {
//     setErr('')
//     if (!courseId) {
//       setLink('')
//       setStatus('scheduled')
//       setSaved(false)
//       return
//     }
//     if (live) {
//       try {
//         const rows = (await dsaApi.liveClasses.list({
//           courseId,
//         })) as Record<string, unknown>[]
//         const rec = rows.find((r) => String(r.courseId ?? '') === courseId) ?? rows[0]
//         setLink((rec?.meetLink as string) || '')
//         setStatus(normStatus(rec?.status))
//         setIsFree(!!rec?.isFree)
//         setSaved(false)
//         return
//       } catch {
//         /* fall through to local */
//       }
//     }
//     setLink(getMeetLink(track))
//     setStatus(getLiveStatus(track))
//     setSaved(false)
//   }, [courseId, track, live])

//   useEffect(() => {
//     void load()
//   }, [load])

//   const save = async () => {
//     setErr('')
//     if (!live) {
//       saveMeetLink(track, link)
//       setSaved(true)
//       return
//     }
//     if (!courseId) return
//     setBusy(true)
//     try {
//       await dsaApi.liveClasses.uploadLinkForCourse(courseId, link.trim(), isFree)
//       setSaved(true)
//     } catch (e) {
//       setErr(e instanceof Error ? e.message : 'Failed to save the link')
//     } finally {
//       setBusy(false)
//     }
//   }

//   const changeStatus = async (s: LiveStatus) => {
//     setErr('')
//     if (!live) {
//       setLiveStatus(track, s)
//       setStatus(s)
//       return
//     }
//     if (!courseId) return
//     setBusy(true)
//     try {
//       await dsaApi.liveClasses.setStatusForCourse(courseId, { status: s })
//       setStatus(s)
//     } catch (e) {
//       setErr(e instanceof Error ? e.message : 'Failed to update the class status')
//     } finally {
//       setBusy(false)
//     }
//   }

//   return (
//     <div className='space-y-5 max-w-3xl'>
//       <div className='flex items-start justify-between gap-3'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
//             Live Classes
//           </h2>
//           <p className='text-[11px] font-bold text-slate-400'>
//             Upload the class link and go live for your students.
//           </p>
//         </div>
//         <LiveBadge live={live} />
//       </div>

//       <div className='flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-100'>
//         <Info size={15} className='text-amber-600 shrink-0 mt-0.5' />
//         <p className='text-[11px] font-bold text-amber-800 leading-relaxed'>
//           The admin generates the Google Meet link and shares it with you. Paste
//           it here per course, then set the class <b>Live</b> when it starts.
//         </p>
//       </div>

//       {/* Course picker */}
//       <div className='flex items-center gap-2 flex-wrap'>
//         <BookOpen size={15} className='text-slate-400' />
//         <select
//           value={courseId}
//           onChange={(e) => setCourseId(e.target.value)}
//           className='h-10 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
//         >
//           {courses.length === 0 && (
//             <option value=''>
//               {loadingCourses ? 'Loading courses…' : 'No courses assigned'}
//             </option>
//           )}
//           {courses.map((c) => (
//             <option key={c.id} value={c.id}>
//               {c.title}
//             </option>
//           ))}
//         </select>
//       </div>

//       <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-4'>
//         <div className='flex items-center justify-between'>
//           <p className='text-[10px] font-black uppercase text-gray-400'>
//             {selected ? selected.title : EXAM_TRACKS[track].label} online class
//           </p>
//           <StatusPill status={status} />
//         </div>

//         <NextClassCard track={track} />

//         {err && <p className='text-[11px] font-bold text-rose-600'>{err}</p>}

//         <div className='space-y-1.5'>
//           <label className='text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5'>
//             <LinkIcon size={13} className='text-[#002EFF]' /> Google Meet link
//           </label>
//           <div className='flex gap-2'>
//             <input
//               value={link}
//               onChange={(e) => {
//                 setLink(e.target.value)
//                 setSaved(false)
//               }}
//               placeholder='https://meet.google.com/abc-defg-hij'
//               className='flex-1 h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:bg-white focus:border-[#002EFF]/30 outline-none text-sm font-medium transition-all'
//             />
//             <button
//               onClick={save}
//               disabled={busy || !link.trim() || !courseId}
//               className='flex items-center gap-1.5 px-4 h-11 rounded-xl bg-[#002EFF] text-white text-[10px] font-black uppercase hover:bg-blue-700 disabled:opacity-50'
//             >
//               <Save size={13} /> {saved ? 'Saved' : 'Save'}
//             </button>
//           </div>
//           <label className='flex items-center gap-2 mt-2 cursor-pointer'>
//             <input
//               type='checkbox'
//               checked={isFree}
//               onChange={(e) => {
//                 setIsFree(e.target.checked)
//                 setSaved(false)
//               }}
//               className='h-4 w-4 accent-[#002EFF]'
//             />
//             <span className='text-[11px] font-bold text-slate-600'>
//               Free class — open to all students (any plan, incl. unpaid)
//             </span>
//           </label>
//         </div>

//         <div className='flex items-center gap-2 pt-1 border-t border-slate-50 flex-wrap'>
//           <span className='text-[10px] font-black uppercase text-slate-400 mr-1'>
//             Class:
//           </span>
//           <button
//             onClick={() => changeStatus('live')}
//             disabled={busy || !link.trim() || !courseId}
//             className='flex items-center gap-1.5 h-9 px-3 rounded-lg bg-red-500 text-white text-[10px] font-black uppercase disabled:opacity-40 hover:brightness-105'
//           >
//             <Radio size={13} /> Go live
//           </button>
//           <button
//             onClick={() => changeStatus('ended')}
//             disabled={busy || !courseId}
//             className='flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase hover:bg-slate-200 disabled:opacity-50'
//           >
//             <Square size={12} /> End
//           </button>
//           {!link.trim() && (
//             <span className='text-[10px] font-bold text-slate-400'>
//               Save a link to go live
//             </span>
//           )}
//         </div>
//       </Card>
//     </div>
//   )
// }

// /* ---------------- Student: join ---------------- */
// function StudentLive({ track }: { track: ExamTrack }) {
//   const [link, setLink] = useState('')
//   const [status, setStatus] = useState<LiveStatus>('scheduled')
//   const [canJoin, setCanJoin] = useState(false)
//   const [loaded, setLoaded] = useState(false)
//   const [live, setLive] = useState(false)

//   useEffect(() => {
//     let cancelled = false
//     const local = () => {
//       if (cancelled) return
//       const l = getMeetLink(track)
//       const s = getLiveStatus(track)
//       setLink(l)
//       setStatus(s)
//       setCanJoin(s === 'live' && !!l)
//       setLive(false)
//       setLoaded(true)
//     }
//     if (isLive()) {
//       dsaApi.liveClasses
//         .next(track)
//         .then((d) => {
//           if (cancelled) return
//           const dd = d as {
//             meetLink?: string
//             status?: string
//             canJoin?: boolean
//           }
//           setLink(dd?.meetLink || '')
//           setStatus(normStatus(dd?.status))
//           setCanJoin(!!dd?.canJoin)
//           setLive(true)
//           setLoaded(true)
//         })
//         .catch(local)
//     } else local()
//     return () => {
//       cancelled = true
//     }
//   }, [track])

//   return (
//     <div className='space-y-5 max-w-2xl'>
//       <div className='flex items-start justify-between gap-3'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
//             Live Class
//           </h2>
//           <p className='text-[11px] font-bold text-slate-400'>
//             Join your online class when your tutor is live.
//           </p>
//         </div>
//         <LiveBadge live={live} />
//       </div>

//       <Card className='p-6 rounded-3xl border-none shadow-sm bg-white space-y-5'>
//         <div className='flex items-center justify-between'>
//           <div className='flex items-center gap-2'>
//             <CalendarDays size={16} className='text-[#002EFF]' />
//             <span className='text-[10px] font-black uppercase text-gray-400'>
//               {EXAM_TRACKS[track].label} · Next class
//             </span>
//           </div>
//           <StatusPill status={status} />
//         </div>

//         <NextClassCard track={track} />

//         {!loaded ? (
//           <div className='flex items-center justify-center h-14'>
//             <Loader2 className='animate-spin text-[#002EFF]' size={18} />
//           </div>
//         ) : canJoin ? (
//           <a
//             href={link}
//             target='_blank'
//             rel='noreferrer'
//             className='flex items-center justify-center gap-2 h-14 rounded-2xl bg-[#002EFF] text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all'
//           >
//             <Video size={18} /> Join Live Class
//           </a>
//         ) : (
//           <div className='flex items-center justify-center gap-2 h-14 rounded-2xl bg-slate-50 text-slate-400 font-black text-[11px] uppercase tracking-widest'>
//             <PlayCircle size={16} />
//             {!link
//               ? 'Class link not set yet'
//               : status === 'ended'
//                 ? 'This class has ended'
//                 : 'Class has not started yet'}
//           </div>
//         )}
//         <p className='text-[10px] font-medium text-slate-400 text-center'>
//           The button activates when your tutor sets the class live.
//         </p>
//       </Card>
//     </div>
//   )
// }


'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Video,
  Save,
  Radio,
  Square,
  Clock,
  CalendarDays,
  Link as LinkIcon,
  Info,
  PlayCircle,
  BookOpen,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getMeetLink,
  saveMeetLink,
  getLiveStatus,
  setLiveStatus,
  type LiveStatus,
} from '@/lib/liveClass'
import {
  getEffectiveTimetable,
  getNextClass,
  gridFromApi,
  type NextClass,
} from '@/lib/timetable'
import { getUser, getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'
import { getCourses } from '@/lib/coursesStore'
import { normaliseTrack, EXAM_TRACKS } from '@/lib/studentProfile'
import type { ExamTrack } from '@/lib/studentProfile'

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

function normStatus(s: unknown): LiveStatus {
  return s === 'live' || s === 'ended' ? s : 'scheduled'
}

function LiveBadge({ live }: { live: boolean }) {
  return (
    <Badge
      className={`text-[9px] font-black shrink-0 uppercase tracking-wider ${
        live
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          : 'bg-[#F5F5F5] dark:bg-zinc-800 text-[#4B5563] dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
      }`}
    >
      {live ? 'Live Data' : 'Local Store'}
    </Badge>
  )
}

/* ---------------- Skeleton Component ---------------- */
function NextClassSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="h-14 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-2xl shrink-0" />
      <div className="space-y-2 flex-1">
        <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
        <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
      </div>
    </div>
  )
}

function FullPageSkeleton() {
  return (
    <div className="space-y-5 max-w-2xl mx-auto py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
          <div className="h-3 w-64 bg-zinc-100 dark:bg-zinc-800/60 rounded-md animate-pulse" />
        </div>
        <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
      </div>
      <Card className="p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-[#FFFFFF] dark:bg-[#000000] space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
          <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
        </div>
        <NextClassSkeleton />
        <div className="h-14 w-full bg-zinc-200 dark:bg-zinc-800 rounded-2xl animate-pulse" />
      </Card>
    </div>
  )
}

// Next class from the live timetable (transposed) when signed in, else local.
function NextClassCard({ track }: { track: ExamTrack }) {
  const [next, setNext] = useState<NextClass | null | undefined>(undefined)
  
  useEffect(() => {
    let cancelled = false
    const local = () => {
      if (!cancelled) setNext(getNextClass(getEffectiveTimetable(track)))
    }
    if (isLive()) {
      dsaApi.timetable
        .get(track)
        .then((res) => {
          if (cancelled) return
          const grid = (res as { grid?: unknown })?.grid
          setNext(
            getNextClass(
              Array.isArray(grid)
                ? gridFromApi(grid)
                : getEffectiveTimetable(track),
            ),
          )
        })
        .catch(local)
    } else local()
    return () => {
      cancelled = true
    }
  }, [track])

  if (next === undefined) {
    return <NextClassSkeleton />
  }
  if (!next) {
    return (
      <p className="text-[11px] font-bold text-[#4B5563] dark:text-zinc-400">
        No class scheduled in the coming week.
      </p>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <div
        className={`text-center p-3 rounded-2xl min-w-[64px] border ${
          next.ongoing
            ? 'bg-[#FCB900] text-[#002EFF] border-[#FCB900]'
            : 'bg-[#002EFF]/10 text-[#002EFF] dark:bg-[#002EFF]/20 dark:text-blue-400 border-[#002EFF]/20'
        }`}
      >
        <p className="text-[9px] font-black uppercase tracking-wider">{next.when}</p>
        <p className="text-[11px] font-black">{next.time.split(' ')[0]}</p>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-black text-[#000000] dark:text-[#FFFFFF] uppercase tracking-tight">
            {next.subject}
          </h4>
          {next.ongoing && (
            <Badge className="bg-red-500 text-white text-[8px] font-black animate-pulse border-none">
              ONGOING
            </Badge>
          )}
        </div>
        <p className="text-[10px] font-bold text-[#4B5563] dark:text-zinc-400 flex items-center gap-1 mt-0.5">
          <Clock size={11} className="text-[#002EFF] dark:text-blue-400" /> {next.day} · {next.time}
        </p>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: LiveStatus }) {
  const map: Record<LiveStatus, string> = {
    scheduled:
      'bg-[#F5F5F5] dark:bg-zinc-800 text-[#4B5563] dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700',
    live: 'bg-red-500 text-white animate-pulse border-none',
    ended:
      'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700',
  }
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${map[status]}`}
    >
      {status}
    </span>
  )
}

export default function LiveClasses({
  mode,
  track: trackProp,
}: {
  mode: 'tutor' | 'student'
  track?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <FullPageSkeleton />
  }

  if (mode === 'tutor') return <TutorLive />

  const u = getUser() as Record<string, unknown> | null
  const s = (v: unknown) => (v == null ? '' : String(v))
  const track = (trackProp ||
    normaliseTrack(
      s(u?.examTrack) ||
        s(u?.examType) ||
        s(u?.track) ||
        s(u?.level) ||
        'jamb',
    )) as ExamTrack
  return <StudentLive track={track} />
}

/* ---------------- Tutor: upload link + control status ---------------- */
type TutorCourse = { id: string; title: string; track: ExamTrack }

function TutorLive() {
  const live = isLive()
  const [courses, setCourses] = useState<TutorCourse[]>([])
  const [courseId, setCourseId] = useState('')
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [link, setLink] = useState('')
  const [status, setStatus] = useState<LiveStatus>('scheduled')
  const [isFree, setIsFree] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const selected = courses.find((c) => c.id === courseId)
  const track = selected?.track ?? 'jamb'

  // Load the tutor's courses.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (live) {
        try {
          const cs = (await dsaApi.courses.list({
            tutorId: 'me',
          })) as Record<string, unknown>[]
          if (cancelled) return
          const mapped: TutorCourse[] = cs.map((c) => ({
            id: String(c.id ?? c._id ?? ''),
            title: String(c.title ?? 'Course'),
            track: normaliseTrack(
              (c.category as string) ||
                (c.track as string) ||
                (c.subject as string) ||
                '',
            ),
          }))
          setCourses(mapped)
          setCourseId((p) => p || mapped[0]?.id || '')
          setLoadingCourses(false)
          return
        } catch {
          /* fall through to local */
        }
      }
      if (cancelled) return
      const cs = getCourses().map((c) => ({
        id: c.id,
        title: c.title,
        track: normaliseTrack(
          (c as { track?: string; category?: string }).track ||
            (c as { category?: string }).category ||
            c.title,
        ),
      }))
      setCourses(cs)
      setCourseId((p) => p || cs[0]?.id || '')
      setLoadingCourses(false)
    })()
    return () => {
      cancelled = true
    }
  }, [live])

  const load = useCallback(async () => {
    setErr('')
    if (!courseId) {
      setLink('')
      setStatus('scheduled')
      setSaved(false)
      return
    }
    if (live) {
      try {
        const rows = (await dsaApi.liveClasses.list({
          courseId,
        })) as Record<string, unknown>[]
        const rec = rows.find((r) => String(r.courseId ?? '') === courseId) ?? rows[0]
        setLink((rec?.meetLink as string) || '')
        setStatus(normStatus(rec?.status))
        setIsFree(!!rec?.isFree)
        setSaved(false)
        return
      } catch {
        /* fall through to local */
      }
    }
    setLink(getMeetLink(track))
    setStatus(getLiveStatus(track))
    setSaved(false)
  }, [courseId, track, live])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setErr('')
    if (!live) {
      saveMeetLink(track, link)
      setSaved(true)
      return
    }
    if (!courseId) return
    setBusy(true)
    try {
      await dsaApi.liveClasses.uploadLinkForCourse(courseId, link.trim(), isFree)
      setSaved(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save the link')
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (s: LiveStatus) => {
    setErr('')
    if (!live) {
      setLiveStatus(track, s)
      setStatus(s)
      return
    }
    if (!courseId) return
    setBusy(true)
    try {
      await dsaApi.liveClasses.setStatusForCourse(courseId, { status: s })
      setStatus(s)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update the class status')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F5F5F5] dark:border-zinc-800">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#002EFF] italic uppercase tracking-tight">
            Live Classes
          </h2>
          <p className="text-xs sm:text-sm font-medium text-[#4B5563] dark:text-zinc-400 mt-0.5">
            Upload the class link and go live for your students.
          </p>
        </div>
        <LiveBadge live={live} />
      </div>

      <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300">
        <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold leading-relaxed">
          The admin generates the Google Meet link and shares it with you. Paste
          it here per course, then set the class <strong className="font-extrabold underline decoration-amber-500/50">Live</strong> when it starts.
        </p>
      </div>

      {/* Course picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <BookOpen size={16} className="text-[#002EFF] dark:text-blue-400" />
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="h-10 px-3 rounded-xl bg-[#FFFFFF] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-bold text-[#000000] dark:text-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#002EFF]/50 shadow-xs"
        >
          {courses.length === 0 && (
            <option value="">
              {loadingCourses ? 'Loading courses…' : 'No courses assigned'}
            </option>
          )}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <Card className="p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs bg-[#FFFFFF] dark:bg-[#000000] space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase text-[#4B5563] dark:text-zinc-400 tracking-wider">
            {selected ? selected.title : EXAM_TRACKS[track].label} online class
          </p>
          <StatusPill status={status} />
        </div>

        <NextClassCard track={track} />

        {err && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{err}</p>}

        <div className="space-y-2 pt-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#4B5563] dark:text-zinc-400 flex items-center gap-1.5">
            <LinkIcon size={13} className="text-[#002EFF] dark:text-blue-400" /> Google Meet link
          </label>
          <div className="flex gap-2">
            <input
              value={link}
              onChange={(e) => {
                setLink(e.target.value)
                setSaved(false)
              }}
              placeholder="https://meet.google.com/abc-defg-hij"
              className="flex-1 h-11 px-3.5 rounded-xl bg-[#F5F5F5] dark:bg-zinc-900 border border-transparent focus:border-[#002EFF]/40 dark:focus:border-blue-500/40 outline-none text-xs sm:text-sm font-medium text-[#000000] dark:text-[#FFFFFF] transition-all"
            />
            <button
              onClick={save}
              disabled={busy || !link.trim() || !courseId}
              className="flex items-center gap-1.5 px-4 h-11 rounded-xl bg-[#002EFF] text-white text-[10px] sm:text-xs font-black uppercase hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all shadow-xs"
            >
              <Save size={14} /> {saved ? 'Saved' : 'Save'}
            </button>
          </div>
          <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => {
                setIsFree(e.target.checked)
                setSaved(false)
              }}
              className="h-4 w-4 rounded accent-[#002EFF]"
            />
            <span className="text-xs font-semibold text-[#4B5563] dark:text-zinc-300">
              Free class — open to all students (any plan, incl. unpaid)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-[#F5F5F5] dark:border-zinc-800 flex-wrap">
          <span className="text-[10px] font-black uppercase text-[#4B5563] dark:text-zinc-400 mr-1">
            Class Action:
          </span>
          <button
            onClick={() => changeStatus('live')}
            disabled={busy || !link.trim() || !courseId}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase disabled:opacity-40 hover:bg-red-600 active:scale-95 transition-all shadow-xs"
          >
            <Radio size={13} /> Go live
          </button>
          <button
            onClick={() => changeStatus('ended')}
            disabled={busy || !courseId}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#F5F5F5] dark:bg-zinc-800 text-[#000000] dark:text-white border border-zinc-200 dark:border-zinc-700 text-[10px] font-black uppercase hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            <Square size={12} /> End
          </button>
          {!link.trim() && (
            <span className="text-[10px] font-bold text-[#4B5563] dark:text-zinc-500">
              Save a link to go live
            </span>
          )}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- Student: join ---------------- */
function StudentLive({ track }: { track: ExamTrack }) {
  const [link, setLink] = useState('')
  const [status, setStatus] = useState<LiveStatus>('scheduled')
  const [canJoin, setCanJoin] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    const local = () => {
      if (cancelled) return
      const l = getMeetLink(track)
      const s = getLiveStatus(track)
      setLink(l)
      setStatus(s)
      setCanJoin(s === 'live' && !!l)
      setLive(false)
      setLoaded(true)
    }
    if (isLive()) {
      dsaApi.liveClasses
        .next(track)
        .then((d) => {
          if (cancelled) return
          const dd = d as {
            meetLink?: string
            status?: string
            canJoin?: boolean
          }
          setLink(dd?.meetLink || '')
          setStatus(normStatus(dd?.status))
          setCanJoin(!!dd?.canJoin)
          setLive(true)
          setLoaded(true)
        })
        .catch(local)
    } else local()
    return () => {
      cancelled = true
    }
  }, [track])

  return (
    <div className="space-y-5 max-w-2xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F5F5F5] dark:border-zinc-800">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#002EFF] italic uppercase tracking-tight">
            Live Class
          </h2>
          <p className="text-xs sm:text-sm font-medium text-[#4B5563] dark:text-zinc-400 mt-0.5">
            Join your online class when your tutor is live.
          </p>
        </div>
        <LiveBadge live={live} />
      </div>

      <Card className="p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs bg-[#FFFFFF] dark:bg-[#000000] space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[#002EFF] dark:text-blue-400" />
            <span className="text-[10px] font-black uppercase text-[#4B5563] dark:text-zinc-400 tracking-wider">
              {EXAM_TRACKS[track].label} · Next class
            </span>
          </div>
          <StatusPill status={status} />
        </div>

        <NextClassCard track={track} />

        {!loaded ? (
          <div className="h-14 w-full bg-zinc-200 dark:bg-zinc-800 rounded-2xl animate-pulse" />
        ) : canJoin ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 h-14 rounded-2xl bg-[#002EFF] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <Video size={18} /> Join Live Class
          </a>
        ) : (
          <div className="flex items-center justify-center gap-2 h-14 rounded-2xl bg-[#F5F5F5] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[#4B5563] dark:text-zinc-400 font-black text-[11px] uppercase tracking-widest">
            <PlayCircle size={16} />
            {!link
              ? 'Class link not set yet'
              : status === 'ended'
                ? 'This class has ended'
                : 'Class has not started yet'}
          </div>
        )}
        <p className="text-[10px] font-semibold text-[#4B5563] dark:text-zinc-500 text-center">
          The button activates automatically when your tutor sets the class live.
        </p>
      </Card>
    </div>
  )
}