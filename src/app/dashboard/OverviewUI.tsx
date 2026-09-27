// 'use client'

// import { useState, useEffect } from 'react'
// import { Card } from '@/components/ui/card'
// import { Button } from '@/components/ui/button'
// import { Badge } from '@/components/ui/badge'
// import {
//   Timer,
//   Zap,
//   Trophy,
//   CheckCircle2,
//   Flame,
//   Target,
//   MapPin,
//   Video,
//   CalendarClock,
//   CalendarCheck,
// } from 'lucide-react'
// import {
//   examCountdown,
//   DEPARTMENT_LABELS,
//   type StudentProfile,
//   type Countdown,
// } from '@/lib/studentProfile'
// import { getMeetLink } from '@/lib/liveClass'
// import {
//   getEffectiveTimetable,
//   getNextClass,
//   getTodayClasses,
//   gridFromApi,
//   slotsFromApi,
//   timetableKey,
//   DEFAULT_SLOTS,
//   type NextClass,
//   type Slot,
//   type TimetableGrid,
// } from '@/lib/timetable'
// import { getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'
// import { recordLogin, getLoginStreak } from '@/lib/loginStreak'
// import { getDailyQuote, publicHolidayName } from '@/lib/dailyQuote'

// interface OverviewUIProps {
//   setView: (view: any) => void
//   isDSAite: boolean
//   student: StudentProfile
// }

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }


// function SmallStat({ label, value, icon: Icon, color }: any) {
//   return (
//     <Card className='p-3 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3'>
//       <div
//         className={`h-9 w-9 bg-blue-50/50 ${color} rounded-xl flex items-center justify-center shrink-0 shadow-inner`}
//       >
//         <Icon size={18} strokeWidth={3} />
//       </div>
//       <div>
//         <p className='text-[8px] font-black text-gray-400 uppercase leading-none mb-0.5'>
//           {label}
//         </p>
//         <p className='text-xs font-black text-gray-900 leading-none'>{value}</p>
//       </div>
//     </Card>
//   )
// }

// /**
//  * Mode-specific card. Physical students see their next on-campus class + venue;
//  * online students get a live-class join card. Same slot, different content.
//  */
// function ModeCard({ student }: { student: StudentProfile }) {
//   // Google Meet link + next class (client-only to avoid a hydration mismatch —
//   // getNextClass reads the current time). Live-first: a real JWT reads the live
//   // timetable (GET /timetable/:track) for the next class and GET
//   // /live-classes/next for the Meet link + join state; demo/offline falls back
//   // to the local stores.
//   const [meetLink, setMeetLink] = useState('')
//   const [canJoin, setCanJoin] = useState(false)
//   const [live, setLive] = useState(false)
//   const [grid, setGrid] = useState<TimetableGrid | null>(null)
//   const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS)
//   useEffect(() => {
//     let cancelled = false
//     const local = () => {
//       if (cancelled) return
//       setMeetLink(getMeetLink(student.track))
//       setCanJoin(false)
//       setLive(false)
//       setGrid(getEffectiveTimetable(student.track, student.department))
//       setSlots(DEFAULT_SLOTS)
//     }
//     const t = getToken()
//     if (t && !isDemoToken(t)) {
//       Promise.allSettled([
//         // Fetch the SAME timetable the admin edits — the department-split key
//         // (e.g. jamb-science), not the bare track, or the card reads a different
//         // timetable that still has the default morning times.
//         dsaApi.timetable.get(timetableKey(student.track, student.department)),
//         dsaApi.liveClasses.next(student.track),
//       ])
//         .then(([tt, lc]) => {
//           if (cancelled) return
//           setLive(true)
//           const ttVal =
//             tt.status === 'fulfilled'
//               ? (tt.value as { grid?: unknown; slots?: unknown })
//               : undefined
//           setGrid(
//             Array.isArray(ttVal?.grid)
//               ? gridFromApi(ttVal.grid)
//               : getEffectiveTimetable(student.track, student.department),
//           )
//           setSlots(ttVal?.slots ? slotsFromApi(ttVal.slots) : DEFAULT_SLOTS)
//           const d =
//             lc.status === 'fulfilled' && lc.value && typeof lc.value === 'object'
//               ? (lc.value as { meetLink?: string; canJoin?: boolean })
//               : null
//           setMeetLink(d?.meetLink || '')
//           setCanJoin(!!d?.canJoin)
//         })
//         .catch(local)
//     } else local()
//     return () => {
//       cancelled = true
//     }
//   }, [student.track, student.department])

//   // Today's remaining classes (both periods), else the next upcoming class.
//   const todays = grid ? getTodayClasses(grid, slots) : []
//   const next: NextClass | null = grid ? getNextClass(grid, slots) : null
//   const title = next ? `${next.subject}` : 'No class scheduled'
//   const timing = next ? `${next.when} · ${next.time}` : 'Check your timetable'
//   // Live: the backend decides join state (status === "live" and a link exists).
//   // Local fallback: any known link is joinable, as before.
//   const joinable = live ? canJoin : !!meetLink
//   const linkUploadedNotLive = live && !!meetLink && !canJoin

//   if (student.mode === 'physical') {
//     return (
//       <Card className='rounded-4xl p-6 bg-white border-none shadow-sm flex flex-col justify-between'>
//         <div className='flex items-center justify-between mb-4'>
//           <p className='text-[10px] font-black uppercase tracking-widest text-blue-400'>
//             Next Campus Class
//           </p>
//           <Badge className='bg-emerald-50 text-emerald-600 text-[8px] font-black'>
//             ON-CAMPUS
//           </Badge>
//         </div>
//         <div className='space-y-1'>
//           <h3 className='text-lg font-black text-gray-900 uppercase leading-tight'>
//             {title}
//           </h3>
//           <div className='flex items-center gap-2 text-gray-400'>
//             <CalendarClock size={13} />
//             <span className='text-[11px] font-bold'>{timing}</span>
//           </div>
//           <div className='flex items-center gap-2 text-gray-400'>
//             <MapPin size={13} />
//             <span className='text-[11px] font-bold'>DSA Campus</span>
//           </div>
//         </div>
//         <div className='mt-4 flex items-center justify-between p-3 bg-blue-50/60 rounded-2xl'>
//           <div>
//             <p className='text-[8px] font-black text-blue-400 uppercase leading-none'>
//               Attendance
//             </p>
//             <p className='text-sm font-black text-[#002EFF] mt-0.5'>
//               18 / 20 classes
//             </p>
//           </div>
//           <div className='flex items-center gap-1 text-emerald-500'>
//             <Flame size={14} />
//             <span className='text-xs font-black'>90%</span>
//           </div>
//         </div>
//       </Card>
//     )
//   }

//   return (
//     <Card className='rounded-4xl p-6 bg-white border-none shadow-sm flex flex-col justify-between'>
//       <div className='flex items-center justify-between mb-4'>
//         <p className='text-[10px] font-black uppercase tracking-widest text-blue-400'>
//           Next Live Class
//         </p>
//         <Badge className='bg-rose-50 text-rose-500 text-[8px] font-black animate-pulse'>
//           ONLINE
//         </Badge>
//       </div>
//       <div className='space-y-2'>
//         {todays.length > 0 ? (
//           <div className='space-y-2'>
//             {todays.map((c, i) => (
//               <div
//                 key={c.slotIndex}
//                 className='flex items-start justify-between gap-2'
//               >
//                 <div className='min-w-0'>
//                   <h3 className='text-base font-black text-gray-900 uppercase leading-tight break-words'>
//                     {c.subject}
//                   </h3>
//                   <div className='flex items-center gap-1.5 text-gray-400'>
//                     <CalendarClock size={12} />
//                     <span className='text-[11px] font-bold'>
//                       Today · {c.time} (WAT)
//                     </span>
//                   </div>
//                 </div>
//                 {c.ongoing ? (
//                   <span className='shrink-0 text-[8px] font-black uppercase bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded animate-pulse'>
//                     Live now
//                   </span>
//                 ) : i === 0 ? (
//                   <span className='shrink-0 text-[8px] font-black uppercase bg-blue-50 text-[#002EFF] px-1.5 py-0.5 rounded'>
//                     Up next
//                   </span>
//                 ) : null}
//               </div>
//             ))}
//           </div>
//         ) : (
//           <>
//             <h3 className='text-lg font-black text-gray-900 uppercase leading-tight'>
//               {title}
//             </h3>
//             <div className='flex items-center gap-2 text-gray-400'>
//               <CalendarClock size={13} />
//               <span className='text-[11px] font-bold'>{timing} (WAT)</span>
//             </div>
//           </>
//         )}
//         <div className='flex items-center gap-2 text-gray-400'>
//           <Video size={13} />
//           <span className='text-[11px] font-bold'>
//             {meetLink ? 'Live on Google Meet' : 'Live on DSA Portal'}
//           </span>
//         </div>
//       </div>
//       {joinable ? (
//         <a
//           href={meetLink}
//           target='_blank'
//           rel='noopener noreferrer'
//           className='mt-4 flex items-center justify-center bg-[#002EFF] text-white font-black rounded-xl text-[10px] h-10 shadow-lg shadow-blue-200 active:scale-95 transition-transform hover:bg-blue-700'
//         >
//           JOIN LIVE CLASS <Video className='ml-2' size={14} />
//         </a>
//       ) : (
//         <Button
//           disabled
//           className='mt-4 bg-slate-200 text-slate-400 font-black rounded-xl text-[10px] h-10 cursor-not-allowed'
//         >
//           {linkUploadedNotLive ? 'WAITING TO GO LIVE' : 'LINK NOT SET YET'}
//           <Video className='ml-2' size={14} />
//         </Button>
//       )}
//     </Card>
//   )
// }

// export default function OverviewUI({
//   setView,
//   isDSAite,
//   student,
// }: OverviewUIProps) {
//   const { trackConfig, modeConfig } = student
//   const ModeIcon = modeConfig.icon

//   // Start with a static value so the server-rendered HTML matches the first
//   // client render (examCountdown uses Date.now(), which would otherwise differ
//   // by a second and cause a hydration mismatch). The real value is computed on
//   // the client in the effect below.
//   const [time, setTime] = useState<Countdown>({
//     days: 0,
//     hours: 0,
//     minutes: 0,
//     seconds: 0,
//     elapsed: false,
//   })

//   // Real performance figures (null until loaded / for demo sessions).
//   const [perf, setPerf] = useState<{
//     avg: number | null
//     progress: number
//     rate: number
//     present: number
//     total: number
//   } | null>(null)
//   const [streak, setStreak] = useState(0)
//   // Live clock — drives the date/day/holiday label and the dynamic quote. Null
//   // on the server / first render so SSR and the first client render agree.
//   const [now, setNow] = useState<Date | null>(null)

//   useEffect(() => {
//     setNow(new Date())
//     const id = setInterval(() => setNow(new Date()), 1000)
//     return () => clearInterval(id)
//   }, [])

//   // Login streak: record today's visit, then count consecutive login days.
//   useEffect(() => {
//     recordLogin()
//     setStreak(getLoginStreak())
//   }, [])

//   useEffect(() => {
//     setTime(examCountdown(trackConfig.nextExamDate))
//     const id = setInterval(
//       () => setTime(examCountdown(trackConfig.nextExamDate)),
//       1000,
//     )
//     return () => clearInterval(id)
//   }, [trackConfig.nextExamDate])

//   useEffect(() => {
//     if (!isLive()) return
//     let cancelled = false
//     ;(async () => {
//       try {
//         const a = (await dsaApi.analytics.me()) as Record<string, unknown>
//         if (cancelled) return
//         setPerf({
//           avg: typeof a.averageScore === 'number' ? a.averageScore : null,
//           progress: typeof a.progressPercent === 'number' ? a.progressPercent : 0,
//           rate: typeof a.attendanceRate === 'number' ? a.attendanceRate : 0,
//           present: typeof a.present === 'number' ? a.present : 0,
//           total: typeof a.totalSessions === 'number' ? a.totalSessions : 0,
//         })
//       } catch {
//         /* leave figures blank */
//       }
//     })()
//     return () => {
//       cancelled = true
//     }
//   }, [])

//   // Live, holiday-aware date/time label + the dynamic quote (fall back to the
//   // track tagline for the very first paint before the clock is set).
//   const holiday = now ? publicHolidayName(now) : null
//   const quote = now ? getDailyQuote(now) : trackConfig.tagline
//   const dateLabel = now
//     ? now.toLocaleDateString('en-NG', {
//         weekday: 'long',
//         day: 'numeric',
//         month: 'long',
//         year: 'numeric',
//       })
//     : ''
//   const timeLabel = now
//     ? now.toLocaleTimeString('en-NG', {
//         hour: '2-digit',
//         minute: '2-digit',
//         second: '2-digit',
//       })
//     : ''

//   return (
//     <div className='space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-6xl mx-auto'>
//       <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
//         {/* --- MAIN WELCOME BANNER --- */}
//         <section className='lg:col-span-2 relative overflow-hidden bg-[#002EFF] rounded-4xl p-6 sm:p-8 text-white shadow-lg'>
//           <div className='relative z-10 space-y-4'>
//             {now && (
//               <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-blue-100 text-[11px] font-bold'>
//                 <CalendarClock size={13} className='text-[#FCB900]' />
//                 <span>{dateLabel}</span>
//                 <span className='opacity-50'>·</span>
//                 <span className='tabular-nums'>{timeLabel}</span>
//                 {holiday && (
//                   <span className='inline-flex items-center gap-1 bg-[#FCB900] text-[#002EFF] font-black px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wide'>
//                     🎉 {holiday}
//                   </span>
//                 )}
//               </div>
//             )}
//             <div className='flex flex-wrap items-center gap-2'>
//               {streak > 0 && (
//                 <Badge className='bg-[#FCB900] text-[#002EFF] hover:bg-[#FCB900] border-none font-black px-3 py-1'>
//                   <Flame size={12} className='mr-1 fill-[#002EFF]' /> {streak} DAY
//                   STREAK
//                 </Badge>
//               )}
//               <Badge className='bg-white/15 text-white border-none font-bold px-3 py-1'>
//                 <ModeIcon size={11} className='mr-1' />
//                 {modeConfig.label}
//               </Badge>
//               {student.department && (
//                 <Badge className='bg-white/15 text-white border-none font-bold px-3 py-1'>
//                   {DEPARTMENT_LABELS[student.department]}
//                 </Badge>
//               )}
//               {student.yearLabel && (
//                 <Badge className='bg-white/15 text-white border-none font-bold px-3 py-1'>
//                   {student.yearLabel}
//                 </Badge>
//               )}
//             </div>
//             <h1 className='text-3xl md:text-4xl font-black uppercase italic tracking-tight'>
//               {trackConfig.hasExam ? (
//                 <>
//                   Road to{' '}
//                   <span className='text-[#FCB900]'>{trackConfig.label}</span>
//                 </>
//               ) : (
//                 <span className='text-[#FCB900]'>{trackConfig.fullName}</span>
//               )}
//             </h1>
//             <p className='text-blue-100 text-xs md:text-sm max-w-sm font-medium'>
//               &ldquo;{quote}&rdquo;
//             </p>
//             <div className='flex flex-wrap items-center gap-3'>
//               <Button
//                 onClick={() => setView('attendance')}
//                 className='bg-[#FCB900] text-[#002EFF] font-black rounded-xl text-[10px] px-8 h-10 shadow-lg shadow-yellow-400/20 active:scale-95 transition-transform'
//               >
//                 VIEW ATTENDANCE <CalendarCheck className='ml-2' size={14} />
//               </Button>

//               {isDSAite && (
//                 <Badge
//                   variant='outline'
//                   className='border-white/20 text-white font-bold px-4'
//                 >
//                   PRO MEMBER
//                 </Badge>
//               )}
//             </div>
//           </div>
//           <Target
//             size={180}
//             className='text-white/10 absolute -right-8 -bottom-8 rotate-12 pointer-events-none'
//           />
//         </section>

//         {/* --- DYNAMIC COUNTDOWN / PROGRAMME CARD --- */}
//         <Card className='rounded-4xl p-6 bg-white border-none shadow-sm flex flex-col items-center justify-center text-center overflow-hidden'>
//           {!trackConfig.hasExam ? (
//             // Programme tracks (undergrad / preclinical / after-school) have no
//             // external exam — show the programme + year focus, not a countdown.
//             <div className='flex flex-col items-center gap-2 py-2'>
//               <p className='text-[10px] font-black uppercase tracking-widest text-blue-400'>
//                 {trackConfig.examLabel} FOCUS
//               </p>
//               <div className='h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center my-1'>
//                 <trackConfig.icon
//                   size={26}
//                   className='text-[#002EFF]'
//                   strokeWidth={2.2}
//                 />
//               </div>
//               <p className='text-base font-black text-gray-800 uppercase leading-none'>
//                 {student.yearLabel ?? trackConfig.label}
//               </p>
//               <p className='text-[10px] font-bold text-gray-400 max-w-[190px]'>
//                 {trackConfig.subjectRule}
//               </p>
//             </div>
//           ) : (
//             <>
//               <p className='text-[10px] font-black uppercase tracking-widest text-blue-400 mb-4'>
//                 {trackConfig.examLabel} COUNTDOWN
//               </p>

//               {time.elapsed ? (
//             <div className='flex flex-col items-center gap-2 py-3'>
//               <CheckCircle2 size={36} className='text-emerald-500' />
//               <p className='text-sm font-black text-gray-800 uppercase'>
//                 Exam period is here
//               </p>
//               <p className='text-[10px] font-bold text-gray-400 max-w-[180px]'>
//                 Best of luck in your {trackConfig.fullName}. Keep revising with
//                 past questions.
//               </p>
//             </div>
//           ) : (
//             <div className='flex items-center gap-1.5'>
//               <div className='flex flex-col items-center'>
//                 <span className='text-3xl sm:text-4xl font-black text-[#002EFF] tracking-tighter tabular-nums'>
//                   {time.days}
//                 </span>
//                 <span className='text-[7px] font-bold text-gray-400'>DAYS</span>
//               </div>
//               <span className='text-xl font-black text-gray-200 pb-4'>:</span>
//               <div className='flex flex-col items-center'>
//                 <span className='text-3xl sm:text-4xl font-black text-[#002EFF] tracking-tighter tabular-nums'>
//                   {String(time.hours).padStart(2, '0')}
//                 </span>
//                 <span className='text-[7px] font-bold text-gray-400'>HRS</span>
//               </div>
//               <span className='text-xl font-black text-gray-200 pb-4'>:</span>
//               <div className='flex flex-col items-center'>
//                 <span className='text-3xl sm:text-4xl font-black text-[#002EFF] tracking-tighter tabular-nums'>
//                   {String(time.minutes).padStart(2, '0')}
//                 </span>
//                 <span className='text-[7px] font-bold text-gray-400'>MIN</span>
//               </div>
//               <span className='text-xl font-black text-gray-200 pb-4'>:</span>
//               <div className='flex flex-col items-center'>
//                 <span className='text-3xl sm:text-4xl font-black text-[#FCB900] tracking-tighter tabular-nums'>
//                   {String(time.seconds).padStart(2, '0')}
//                 </span>
//                 <span className='text-[7px] font-bold text-gray-400'>SEC</span>
//               </div>
//             </div>
//               )}
//             </>
//           )}
//         </Card>
//       </div>

//       {/* --- MODE-SPECIFIC + STATS --- */}
//       <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
//         <ModeCard student={student} />

//         <div className='lg:col-span-2 grid grid-cols-2 gap-4 content-start'>
//           <SmallStat
//             label='Avg Score'
//             value={perf?.avg != null ? `${perf.avg}%` : '—'}
//             icon={Timer}
//             color='text-blue-600'
//           />
//           <SmallStat
//             label='Progress'
//             value={perf ? `${perf.progress}%` : '—'}
//             icon={Zap}
//             color='text-yellow-500'
//           />
//           <SmallStat
//             label='Attendance'
//             value={perf && perf.total ? `${perf.rate}%` : '—'}
//             icon={CheckCircle2}
//             color='text-emerald-500'
//           />
//           <SmallStat
//             label='Present'
//             value={perf ? `${perf.present}/${perf.total}` : '—'}
//             icon={CalendarCheck}
//             color='text-orange-500'
//           />
//           <Card className='col-span-2 p-4 rounded-2xl border border-blue-50 bg-blue-50/40 flex items-center gap-3'>
//             <div className='h-9 w-9 bg-white rounded-xl flex items-center justify-center shrink-0 text-[#002EFF] shadow-sm'>
//               <trackConfig.icon size={18} strokeWidth={2.5} />
//             </div>
//             <div>
//               <p className='text-[8px] font-black text-blue-400 uppercase leading-none mb-0.5'>
//                 Your Track
//               </p>
//               <p className='text-[11px] font-black text-gray-800 leading-none'>
//                 {trackConfig.fullName}
//                 {student.department
//                   ? ` · ${DEPARTMENT_LABELS[student.department]} Department`
//                   : ` · ${trackConfig.subjectRule}`}
//               </p>
//             </div>
//           </Card>
//         </div>
//       </div>
//     </div>
//   )
// }



'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Timer,
  Zap,
  CheckCircle2,
  Flame,
  Target,
  MapPin,
  Video,
  CalendarClock,
  CalendarCheck,
  BrainCircuit,
  Sparkles,
} from 'lucide-react'
import {
  examCountdown,
  DEPARTMENT_LABELS,
  type StudentProfile,
  type Countdown,
} from '@/lib/studentProfile'
import { getMeetLink } from '@/lib/liveClass'
import {
  getEffectiveTimetable,
  getNextClass,
  getTodayClasses,
  gridFromApi,
  slotsFromApi,
  timetableKey,
  DEFAULT_SLOTS,
  type NextClass,
  type Slot,
  type TimetableGrid,
} from '@/lib/timetable'
import { getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'
import { recordLogin, getLoginStreak } from '@/lib/loginStreak'
import { getDailyQuote, publicHolidayName } from '@/lib/dailyQuote'

interface OverviewUIProps {
  setView: (view: any) => void
  isDSAite: boolean
  student: StudentProfile
}

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

function SmallStat({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-xs bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs flex items-center gap-3.5 hover:-translate-y-0.5 transition-all duration-300">
      <div
        className={`h-10 w-10 sm:h-11 sm:w-11 ${bg || 'bg-slate-50 dark:bg-slate-800'} ${color} rounded-xl flex items-center justify-center shrink-0 shadow-inner`}
      >
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] sm:text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase leading-none mb-1">
          {label}
        </p>
        <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-none truncate">
          {value}
        </p>
      </div>
    </Card>
  )
}

function ModeCardSkeleton() {
  return (
    <Card className="rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between animate-pulse min-h-[220px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/3" />
          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-16" />
        </div>
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-2/3 mt-2" />
        <div className="h-3 bg-slate-150 dark:bg-slate-800/60 rounded-md w-1/2" />
        <div className="h-3 bg-slate-150 dark:bg-slate-800/60 rounded-md w-2/5" />
      </div>
      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-full mt-6" />
    </Card>
  )
}

function ModeCard({ student }: { student: StudentProfile }) {
  const [meetLink, setMeetLink] = useState('')
  const [canJoin, setCanJoin] = useState(false)
  const [live, setLive] = useState(false)
  const [grid, setGrid] = useState<TimetableGrid | null>(null)
  const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const local = () => {
      if (cancelled) return
      setMeetLink(getMeetLink(student.track))
      setCanJoin(false)
      setLive(false)
      setGrid(getEffectiveTimetable(student.track, student.department))
      setSlots(DEFAULT_SLOTS)
      setLoading(false)
    }

    const t = getToken()
    if (t && !isDemoToken(t)) {
      Promise.allSettled([
        dsaApi.timetable.get(timetableKey(student.track, student.department)),
        dsaApi.liveClasses.next(student.track),
      ])
        .then(([tt, lc]) => {
          if (cancelled) return
          setLive(true)
          const ttVal =
            tt.status === 'fulfilled'
              ? (tt.value as { grid?: unknown; slots?: unknown })
              : undefined
          setGrid(
            Array.isArray(ttVal?.grid)
              ? gridFromApi(ttVal.grid)
              : getEffectiveTimetable(student.track, student.department),
          )
          setSlots(ttVal?.slots ? slotsFromApi(ttVal.slots) : DEFAULT_SLOTS)
          const d =
            lc.status === 'fulfilled' && lc.value && typeof lc.value === 'object'
              ? (lc.value as { meetLink?: string; canJoin?: boolean })
              : null
          setMeetLink(d?.meetLink || '')
          setCanJoin(!!d?.canJoin)
        })
        .catch(local)
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    } else {
      local()
    }

    return () => {
      cancelled = true
    }
  }, [student.track, student.department])

  if (loading) {
    return <ModeCardSkeleton />
  }

  const todays = grid ? getTodayClasses(grid, slots) : []
  const next: NextClass | null = grid ? getNextClass(grid, slots) : null
  const title = next ? `${next.subject}` : 'No class scheduled'
  const timing = next ? `${next.when} · ${next.time}` : 'Check your timetable'
  const joinable = live ? canJoin : !!meetLink
  const linkUploadedNotLive = live && !!meetLink && !canJoin

  if (student.mode === 'physical') {
    return (
      <Card className="rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Next Campus Class
            </span>
            <Badge className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
              ON-CAMPUS
            </Badge>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-tight tracking-tight">
              {title}
            </h3>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <CalendarClock size={14} className="text-blue-500 shrink-0" />
              <span className="text-xs font-bold">{timing}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <MapPin size={14} className="text-rose-500 shrink-0" />
              <span className="text-xs font-bold">DSA Campus</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100/50 dark:border-blue-900/40">
          <div>
            <p className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-wider leading-none">
              Attendance
            </p>
            <p className="text-sm font-black text-[#002EFF] dark:text-blue-400 mt-0.5">
              18 / 20 classes
            </p>
          </div>
          <div className="flex items-center gap-1 bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-xl">
            <Flame size={14} className="fill-emerald-500 text-emerald-500" />
            <span className="text-xs font-black">90%</span>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Next Live Class
          </span>
          <Badge className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
            ONLINE
          </Badge>
        </div>
        <div className="space-y-3">
          {todays.length > 0 ? (
            <div className="space-y-2.5">
              {todays.map((c, i) => (
                <div
                  key={c.slotIndex}
                  className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight truncate">
                      {c.subject}
                    </h3>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mt-1">
                      <CalendarClock size={12} className="text-blue-500 shrink-0" />
                      <span className="text-[11px] font-semibold">
                        Today · {c.time} (WAT)
                      </span>
                    </div>
                  </div>
                  {c.ongoing ? (
                    <span className="shrink-0 text-[8px] font-black uppercase bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full animate-pulse">
                      Live now
                    </span>
                  ) : i === 0 ? (
                    <span className="shrink-0 text-[8px] font-black uppercase bg-blue-50 dark:bg-blue-950/50 text-[#002EFF] dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                      Up next
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-tight tracking-tight">
                {title}
              </h3>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <CalendarClock size={14} className="text-blue-500 shrink-0" />
                <span className="text-xs font-bold">{timing} (WAT)</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Video size={14} className="text-indigo-500 shrink-0" />
            <span className="text-xs font-semibold">
              {meetLink ? 'Live on Google Meet' : 'Live on DSA Portal'}
            </span>
          </div>
        </div>
      </div>

      {joinable ? (
        <a
          href={meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center justify-center gap-2 bg-[#002EFF] hover:bg-blue-700 text-white font-black rounded-2xl text-xs h-11 shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all"
        >
          <span>JOIN LIVE CLASS</span>
          <Video size={15} />
        </a>
      ) : (
        <Button
          disabled
          className="mt-5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/60 font-bold rounded-2xl text-xs h-11 cursor-not-allowed"
        >
          {linkUploadedNotLive ? 'WAITING TO GO LIVE' : 'LINK NOT SET YET'}
          <Video className="ml-2" size={15} />
        </Button>
      )}
    </Card>
  )
}

export default function OverviewUI({
  setView,
  isDSAite,
  student,
}: OverviewUIProps) {
  const { trackConfig, modeConfig } = student
  const ModeIcon = modeConfig.icon

  const [time, setTime] = useState<Countdown>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    elapsed: false,
  })

  const [perf, setPerf] = useState<{
    avg: number | null
    progress: number
    rate: number
    present: number
    total: number
  } | null>(null)
  const [streak, setStreak] = useState(0)
  const [now, setNow] = useState<Date | null>(null)
  const [isPerfLoading, setIsPerfLoading] = useState(true)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    recordLogin()
    setStreak(getLoginStreak())
  }, [])

  useEffect(() => {
    setTime(examCountdown(trackConfig.nextExamDate))
    const id = setInterval(
      () => setTime(examCountdown(trackConfig.nextExamDate)),
      1000,
    )
    return () => clearInterval(id)
  }, [trackConfig.nextExamDate])

  useEffect(() => {
    if (!isLive()) {
      setIsPerfLoading(false)
      return
    }
    let cancelled = false
    setIsPerfLoading(true)
    ;(async () => {
      try {
        const a = (await dsaApi.analytics.me()) as Record<string, unknown>
        if (cancelled) return
        setPerf({
          avg: typeof a.averageScore === 'number' ? a.averageScore : null,
          progress: typeof a.progressPercent === 'number' ? a.progressPercent : 0,
          rate: typeof a.attendanceRate === 'number' ? a.attendanceRate : 0,
          present: typeof a.present === 'number' ? a.present : 0,
          total: typeof a.totalSessions === 'number' ? a.totalSessions : 0,
        })
      } catch {
        /* leave figures blank */
      } finally {
        if (!cancelled) setIsPerfLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const holiday = now ? publicHolidayName(now) : null
  const quote = now ? getDailyQuote(now) : trackConfig.tagline

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-1 sm:px-0 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* --- MAIN WELCOME & COUNTDOWN HERO BANNER --- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#002EFF] via-blue-600 to-indigo-700 dark:from-blue-900 dark:via-indigo-900 dark:to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-600/10 dark:shadow-none border border-blue-500/20">
        <div className="relative z-10 space-y-6">
          {/* Top Badges Row */}
          <div className="flex flex-wrap items-center gap-2">
            {holiday && (
              <span className="inline-flex items-center gap-1 bg-[#FCB900] text-[#002EFF] font-black px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wide shadow-xs">
                🎉 {holiday}
              </span>
            )}
            {streak > 0 && (
              <Badge className="bg-[#FCB900] text-[#002EFF] hover:bg-[#FCB900] border-none font-black px-3 py-1 text-xs shadow-xs">
                <Flame size={13} className="mr-1 fill-[#002EFF]" /> {streak} DAY STREAK
              </Badge>
            )}
            <Badge className="bg-white/15 backdrop-blur-md text-white border border-white/20 font-bold px-3 py-1 text-xs">
              <ModeIcon size={12} className="mr-1.5" />
              {modeConfig.label}
            </Badge>
            {student.department && (
              <Badge className="bg-white/15 backdrop-blur-md text-white border border-white/20 font-bold px-3 py-1 text-xs">
                {DEPARTMENT_LABELS[student.department]}
              </Badge>
            )}
            {student.yearLabel && (
              <Badge className="bg-white/15 backdrop-blur-md text-white border border-white/20 font-bold px-3 py-1 text-xs">
                {student.yearLabel}
              </Badge>
            )}
          </div>

          {/* Title & Quote */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white drop-shadow-xs">
              {trackConfig.hasExam ? (
                <>
                  Road to <span className="text-[#FCB900]">{trackConfig.label}</span>
                </>
              ) : (
                <span className="text-[#FCB900]">{trackConfig.fullName}</span>
              )}
            </h1>
            <p className="text-blue-100 dark:text-blue-200 text-xs sm:text-sm max-w-xl font-medium leading-relaxed opacity-90 italic">
              &ldquo;{quote}&rdquo;
            </p>
          </div>

          {/* Inline Integrated Exam Countdown / Track Focus */}
          <div className="pt-2 border-t border-white/15 max-w-2xl">
            {trackConfig.hasExam ? (
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 block">
                  {trackConfig.examLabel} COUNTDOWN
                </span>
                {time.elapsed ? (
                  <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
                    <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-white uppercase leading-tight">
                        Exam period is here
                      </p>
                      <p className="text-[11px] text-blue-100 font-medium">
                        Best of luck in your {trackConfig.fullName}. Keep revising with past questions.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 min-w-[62px] sm:min-w-[70px]">
                      <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter tabular-nums">
                        {time.days}
                      </span>
                      <span className="text-[8px] font-extrabold text-blue-200 uppercase mt-0.5">DAYS</span>
                    </div>
                    <span className="text-lg font-black text-white/40">:</span>
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 min-w-[62px] sm:min-w-[70px]">
                      <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter tabular-nums">
                        {String(time.hours).padStart(2, '0')}
                      </span>
                      <span className="text-[8px] font-extrabold text-blue-200 uppercase mt-0.5">HRS</span>
                    </div>
                    <span className="text-lg font-black text-white/40">:</span>
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 min-w-[62px] sm:min-w-[70px]">
                      <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter tabular-nums">
                        {String(time.minutes).padStart(2, '0')}
                      </span>
                      <span className="text-[8px] font-extrabold text-blue-200 uppercase mt-0.5">MIN</span>
                    </div>
                    <span className="text-lg font-black text-white/40">:</span>
                    <div className="flex flex-col items-center bg-[#FCB900] text-[#002EFF] border border-yellow-300 rounded-2xl p-2.5 min-w-[62px] sm:min-w-[70px] shadow-md">
                      <span className="text-2xl sm:text-3xl font-black tracking-tighter tabular-nums">
                        {String(time.seconds).padStart(2, '0')}
                      </span>
                      <span className="text-[8px] font-black uppercase mt-0.5 opacity-80">SEC</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
                <div className="h-9 w-9 rounded-xl bg-[#FCB900] text-[#002EFF] flex items-center justify-center shrink-0">
                  <trackConfig.icon size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-xs font-black text-white uppercase leading-tight">
                    {student.yearLabel ?? trackConfig.label} • {trackConfig.examLabel} FOCUS
                  </p>
                  <p className="text-[11px] text-blue-100 font-medium mt-0.5">
                    {trackConfig.subjectRule}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setView('quizzes')}
              className="bg-[#FCB900] hover:bg-yellow-400 text-[#002EFF] font-black rounded-2xl text-xs px-6 h-11 shadow-lg shadow-yellow-500/20 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>TAKE QUIZZES</span>
              <BrainCircuit size={16} />
            </Button>

            {isDSAite && (
              <Badge
                variant="outline"
                className="border-white/30 text-white font-bold px-3.5 py-2 rounded-xl text-xs backdrop-blur-xs"
              >
                PRO MEMBER
              </Badge>
            )}
          </div>
        </div>

        <Target
          size={200}
          className="text-white/10 dark:text-white/5 absolute -right-8 -bottom-8 rotate-12 pointer-events-none"
        />
      </section>

      {/* --- MODE-SPECIFIC + STATS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ModeCard student={student} />

        <div className="lg:col-span-2 grid grid-cols-2 gap-3.5 content-start">
          {isPerfLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-2/3" />
                </div>
              </Card>
            ))
          ) : (
            <>
              <SmallStat
                label="Avg Score"
                value={perf?.avg != null ? `${perf.avg}%` : '—'}
                icon={Timer}
                color="text-blue-600 dark:text-blue-400"
                bg="bg-blue-50 dark:bg-blue-950/50"
              />
              <SmallStat
                label="Progress"
                value={perf ? `${perf.progress}%` : '—'}
                icon={Zap}
                color="text-amber-500 dark:text-amber-400"
                bg="bg-amber-50 dark:bg-amber-950/50"
              />
              <SmallStat
                label="Attendance"
                value={perf && perf.total ? `${perf.rate}%` : '—'}
                icon={CheckCircle2}
                color="text-emerald-600 dark:text-emerald-400"
                bg="bg-emerald-50 dark:bg-emerald-950/50"
              />
              <SmallStat
                label="Present"
                value={perf ? `${perf.present}/${perf.total}` : '—'}
                icon={CalendarCheck}
                color="text-orange-500 dark:text-orange-400"
                bg="bg-orange-50 dark:bg-orange-950/50"
              />
            </>
          )}

          <Card className="col-span-2 p-4 rounded-2xl border border-blue-100/60 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/40 to-indigo-50/20 dark:from-slate-900 dark:to-blue-950/20 flex items-center gap-3.5 shadow-2xs">
            <div className="h-10 w-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 text-[#002EFF] dark:text-blue-400 shadow-xs border border-blue-100 dark:border-slate-700">
              <trackConfig.icon size={20} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-wider leading-none mb-1">
                Your Track
              </p>
              <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 leading-none truncate">
                {trackConfig.fullName}
                {student.department
                  ? ` · ${DEPARTMENT_LABELS[student.department]} Department`
                  : ` · ${trackConfig.subjectRule}`}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}