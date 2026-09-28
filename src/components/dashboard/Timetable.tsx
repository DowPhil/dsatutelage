// 'use client'

// import { useState, useEffect } from 'react'
// import { Card } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import { CalendarDays, MapPin, Video, Clock } from 'lucide-react'
// import type { ExamTrack, StudyMode, Department } from '@/lib/studentProfile'
// import {
//   DAYS,
//   getEffectiveTimetable,
//   gridFromApi,
//   tintForSubject,
//   timetableKey,
//   slotsFromApi,
//   slotTimeLabel,
//   DEFAULT_SLOTS,
//   type TimetableGrid,
//   type Slot,
// } from '@/lib/timetable'
// import { getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'

// export default function Timetable({
//   track,
//   mode,
//   department,
// }: {
//   track: ExamTrack
//   mode: StudyMode
//   department: Department | null
// }) {
//   const isOnline = mode === 'online'

//   // Live-first: with a real JWT read GET /timetable/:track (admin-scheduled,
//   // source of truth) and transpose to the UI's [period][day] layout; on
//   // demo/offline fall back to the local store so the preview still works.
//   const [grid, setGrid] = useState<TimetableGrid>([])
//   const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS)
//   const [live, setLive] = useState(false)
//   useEffect(() => {
//     let cancelled = false
//     const local = () => {
//       if (cancelled) return
//       setGrid(getEffectiveTimetable(track, department))
//       setSlots(DEFAULT_SLOTS)
//       setLive(false)
//     }
//     const t = getToken()
//     if (t && !isDemoToken(t)) {
//       dsaApi.timetable
//         .get(timetableKey(track, department))
//         .then((res) => {
//           if (cancelled) return
//           const apiGrid = (res as { grid?: unknown })?.grid
//           const built = Array.isArray(apiGrid) ? gridFromApi(apiGrid) : null
//           // The backend auto-creates an EMPTY grid for any track+department key
//           // that hasn't been authored yet. Treat an all-empty grid as "no
//           // schedule" and show the department's local template instead of a
//           // blank table (otherwise a freshly-switched department looks empty).
//           const hasEntries = !!built?.some((row) =>
//             row.some(
//               (cell) =>
//                 Array.isArray(cell) && cell.some((s) => s && String(s).trim()),
//             ),
//           )
//           if (built && hasEntries) {
//             setGrid(built)
//             setSlots(slotsFromApi((res as { slots?: unknown })?.slots))
//             setLive(true)
//           } else local()
//         })
//         .catch(local)
//     } else local()
//     return () => {
//       cancelled = true
//     }
//   }, [track, department])

//   return (
//     <div className='space-y-6 max-w-6xl mx-auto'>
//       <div className='flex items-center justify-between'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase flex items-center gap-2'>
//             <CalendarDays size={24} /> Timetable
//           </h2>
//           <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
//             Your weekly class schedule
//           </p>
//         </div>
//         <div className='flex items-center gap-2'>
//           <Badge
//             className={`text-[8px] font-black ${live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
//           >
//             {live ? 'Live' : 'Local'}
//           </Badge>
//           <Badge
//             className={`text-[9px] font-black flex items-center gap-1 ${isOnline ? 'bg-blue-50 text-[#002EFF]' : 'bg-emerald-50 text-emerald-600'}`}
//           >
//             {isOnline ? <Video size={11} /> : <MapPin size={11} />}
//             {isOnline ? 'Live on DSA Portal' : 'On-Campus'}
//           </Badge>
//         </div>
//       </div>

//       <Card className='rounded-3xl border-none shadow-sm bg-white overflow-x-auto'>
//         <div className='min-w-[720px]'>
//           <div className='grid grid-cols-7 bg-slate-50'>
//             <div className='px-4 py-3 text-[9px] font-black uppercase text-gray-400'>
//               Time
//             </div>
//             {DAYS.map((d) => (
//               <div
//                 key={d}
//                 className='px-3 py-3 text-[9px] font-black uppercase text-gray-500 text-center'
//               >
//                 {d.slice(0, 3)}
//               </div>
//             ))}
//           </div>

//           {slots.map((slot, slotIdx) => (
//             <div key={slotIdx} className='grid grid-cols-7 border-t border-slate-50'>
//               <div className='px-4 py-3 flex flex-col justify-center'>
//                 <span className='text-[10px] font-black text-gray-700'>{slot.label}</span>
//                 <span className='text-[9px] font-bold text-gray-400 flex items-center gap-1'>
//                   <Clock size={9} /> {slotTimeLabel(slot)}
//                 </span>
//               </div>
//               {DAYS.map((d, dayIdx) => {
//                 const cell = grid[slotIdx]?.[dayIdx] ?? []
//                 return (
//                   <div key={d} className='px-2 py-2 border-l border-slate-50'>
//                     {cell.length ? (
//                       <div className='flex flex-col gap-1'>
//                         {cell.map((s, i) => (
//                           <div
//                             key={i}
//                             className={`rounded-xl px-2 py-1.5 text-center ${tintForSubject(s)}`}
//                           >
//                             <p className='text-[10px] font-black leading-tight'>
//                               {s}
//                             </p>
//                           </div>
//                         ))}
//                       </div>
//                     ) : (
//                       <div className='rounded-xl px-2 py-2 text-center min-h-[36px] flex items-center justify-center bg-slate-50 text-slate-300'>
//                         <p className='text-[10px] font-black'>—</p>
//                       </div>
//                     )}
//                   </div>
//                 )
//               })}
//             </div>
//           ))}
//         </div>
//       </Card>

//       <div className='flex items-start gap-3 p-4 bg-blue-50/60 rounded-2xl'>
//         <CalendarDays className='text-[#002EFF] shrink-0 mt-0.5' size={16} />
//         <p className='text-[10px] font-bold text-gray-500 leading-relaxed'>
//           {isOnline
//             ? 'Online classes run live on the DSA Portal at the times shown (WAT). Recordings are posted after each class.'
//             : 'On-campus classes hold at the DSA academy at the times shown (WAT). Please arrive 10 minutes early.'}
//         </p>
//       </div>
//     </div>
//   )
// }



'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, MapPin, Video, Clock } from 'lucide-react'
import type { ExamTrack, StudyMode, Department } from '@/lib/studentProfile'
import {
  DAYS,
  getEffectiveTimetable,
  gridFromApi,
  tintForSubject,
  timetableKey,
  slotsFromApi,
  slotTimeLabel,
  DEFAULT_SLOTS,
  type TimetableGrid,
  type Slot,
} from '@/lib/timetable'
import { getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'

export default function Timetable({
  track,
  mode,
  department,
}: {
  track: ExamTrack
  mode: StudyMode
  department: Department | null
}) {
  const isOnline = mode === 'online'

  // Live-first: with a real JWT read GET /timetable/:track (admin-scheduled,
  // source of truth) and transpose to the UI's [period][day] layout; on
  // demo/offline fall back to the local store so the preview still works.
  const [grid, setGrid] = useState<TimetableGrid>([])
  const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    const local = () => {
      if (cancelled) return
      setGrid(getEffectiveTimetable(track, department))
      setSlots(DEFAULT_SLOTS)
      setLive(false)
    }
    const t = getToken()
    if (t && !isDemoToken(t)) {
      dsaApi.timetable
        .get(timetableKey(track, department))
        .then((res) => {
          if (cancelled) return
          const apiGrid = (res as { grid?: unknown })?.grid
          const built = Array.isArray(apiGrid) ? gridFromApi(apiGrid) : null
          // The backend auto-creates an EMPTY grid for any track+department key
          // that hasn't been authored yet. Treat an all-empty grid as "no
          // schedule" and show the department's local template instead of a
          // blank table (otherwise a freshly-switched department looks empty).
          const hasEntries = !!built?.some((row) =>
            row.some(
              (cell) =>
                Array.isArray(cell) && cell.some((s) => s && String(s).trim()),
            ),
          )
          if (built && hasEntries) {
            setGrid(built)
            setSlots(slotsFromApi((res as { slots?: unknown })?.slots))
            setLive(true)
          } else local()
        })
        .catch(local)
    } else local()
    return () => {
      cancelled = true
    }
  }, [track, department])

  return (
    <div className='space-y-6 max-w-6xl mx-auto'>
      {/* Header Section */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] dark:text-yellow-400 italic uppercase flex items-center gap-2 transition-colors'>
            <CalendarDays size={24} /> Timetable
          </h2>
          <p className='text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-widest'>
            Your weekly class schedule
          </p>
        </div>

        {/* Status Badges */}
        <div className='flex items-center gap-2'>
          <Badge
            className={`text-[8px] font-black border transition-colors ${
              live
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
            }`}
          >
            {live ? 'Live' : 'Local'}
          </Badge>
          <Badge
            className={`text-[9px] font-black flex items-center gap-1 border transition-colors ${
              isOnline
                ? 'bg-blue-50 dark:bg-blue-950/40 text-[#002EFF] dark:text-yellow-400 border-blue-100 dark:border-blue-900/50'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
            }`}
          >
            {isOnline ? <Video size={11} /> : <MapPin size={11} />}
            {isOnline ? 'Live on DSA Portal' : 'On-Campus'}
          </Badge>
        </div>
      </div>

      {/* Main Timetable Card */}
      <Card className='rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 overflow-x-auto transition-colors'>
        <div className='min-w-[720px]'>
          {/* Table Header: Days of the Week */}
          <div className='grid grid-cols-7 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800/80 transition-colors'>
            <div className='px-4 py-3 text-[9px] font-black uppercase text-gray-400 dark:text-zinc-400'>
              Time
            </div>
            {DAYS.map((d) => (
              <div
                key={d}
                className='px-3 py-3 text-[9px] font-black uppercase text-gray-500 dark:text-zinc-300 text-center'
              >
                {d.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Table Body: Slots and Days Grid */}
          {slots.map((slot, slotIdx) => (
            <div
              key={slotIdx}
              className='grid grid-cols-7 border-t border-slate-100 dark:border-zinc-800/60 first:border-t-0'
            >
              {/* Time Column */}
              <div className='px-4 py-3 flex flex-col justify-center bg-slate-50/50 dark:bg-zinc-900/50'>
                <span className='text-[10px] font-black text-gray-700 dark:text-zinc-200'>
                  {slot.label}
                </span>
                <span className='text-[9px] font-bold text-gray-400 dark:text-zinc-400 flex items-center gap-1'>
                  <Clock size={9} /> {slotTimeLabel(slot)}
                </span>
              </div>

              {/* Days Columns */}
              {DAYS.map((d, dayIdx) => {
                const cell = grid[slotIdx]?.[dayIdx] ?? []
                return (
                  <div
                    key={d}
                    className='px-2 py-2 border-l border-slate-100 dark:border-zinc-800/60'
                  >
                    {cell.length ? (
                      <div className='flex flex-col gap-1'>
                        {cell.map((s, i) => (
                          <div
                            key={i}
                            className={`rounded-xl px-2 py-1.5 text-center shadow-xs transition-colors ${tintForSubject(
                              s,
                            )}`}
                          >
                            <p className='text-[10px] font-black leading-tight'>
                              {s}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className='rounded-xl px-2 py-2 text-center min-h-[36px] flex items-center justify-center bg-slate-50/70 dark:bg-zinc-800/40 text-slate-300 dark:text-zinc-600'>
                        <p className='text-[10px] font-black'>—</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Helper Footer Notice */}
      <div className='flex items-start gap-3 p-4 bg-blue-50/60 dark:bg-zinc-800/50 border border-blue-100/50 dark:border-zinc-800 rounded-2xl transition-colors'>
        <CalendarDays
          className='text-[#002EFF] dark:text-yellow-400 shrink-0 mt-0.5'
          size={16}
        />
        <p className='text-[10px] font-bold text-gray-500 dark:text-zinc-400 leading-relaxed'>
          {isOnline
            ? 'Online classes run live on the DSA Portal at the times shown (WAT). Recordings are posted after each class.'
            : 'On-campus classes hold at the DSA academy at the times shown (WAT). Please arrive 10 minutes early.'}
        </p>
      </div>
    </div>
  )
}