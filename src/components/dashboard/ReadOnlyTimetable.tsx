// 'use client'

// import { useEffect, useState } from 'react'
// import { CalendarDays, Clock, Lock } from 'lucide-react'
// import { Card } from '@/components/ui/card'
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
// import {
//   EXAM_TRACKS,
//   DEPARTMENT_LABELS,
//   type ExamTrack,
//   type Department,
// } from '@/lib/studentProfile'
// import { Badge } from '@/components/ui/badge'
// import { getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'

// const TRACKS: ExamTrack[] = [
//   'jamb',
//   'waec',
//   'postutme',
//   'undergrad',
//   'preclinical',
//   'afterschool',
// ]
// const DEPT_SPLIT: ExamTrack[] = ['waec', 'afterschool']
// const DEPARTMENTS: Department[] = ['science', 'art', 'commercial']

// /**
//  * Read-only weekly timetable with a track selector. Used where a role can view
//  * but not edit the schedule (tutors, staff). The ADMIN schedules the timetable.
//  */
// export default function ReadOnlyTimetable({
//   initialTrack = 'jamb',
// }: {
//   initialTrack?: ExamTrack
// }) {
//   const [track, setTrack] = useState<ExamTrack>(initialTrack)
//   const [department, setDepartment] = useState<Department>('science')
//   const [grid, setGrid] = useState<TimetableGrid>([])
//   const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS)
//   const [live, setLive] = useState(false)

//   const isDeptSplit = DEPT_SPLIT.includes(track)
//   const key = timetableKey(track, isDeptSplit ? department : null)

//   // Live-first: real JWT reads GET /timetable/:key (transposed to [period][day]);
//   // demo/offline falls back to the local store.
//   useEffect(() => {
//     let cancelled = false
//     const local = () => {
//       if (cancelled) return
//       setGrid(getEffectiveTimetable(track, isDeptSplit ? department : null))
//       setSlots(DEFAULT_SLOTS)
//       setLive(false)
//     }
//     const t = getToken()
//     if (t && !isDemoToken(t)) {
//       dsaApi.timetable
//         .get(key)
//         .then((res) => {
//           if (cancelled) return
//           const apiGrid = (res as { grid?: unknown })?.grid
//           if (Array.isArray(apiGrid)) {
//             setGrid(gridFromApi(apiGrid))
//             setSlots(slotsFromApi((res as { slots?: unknown })?.slots))
//             setLive(true)
//           } else local()
//         })
//         .catch(local)
//     } else local()
//     return () => {
//       cancelled = true
//     }
//   }, [track, department, key, isDeptSplit])

//   return (
//     <div className='space-y-5 max-w-5xl mx-auto'>
//       <div className='flex items-center justify-between flex-wrap gap-3'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase flex items-center gap-2'>
//             <CalendarDays size={24} /> Timetable
//           </h2>
//           <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5'>
//             <Lock size={11} /> View only — scheduled by the admin
//             <Badge
//               className={`text-[8px] font-black ${live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
//             >
//               {live ? 'Live' : 'Local'}
//             </Badge>
//           </p>
//         </div>
//         <div className='flex flex-col items-end gap-2'>
//           <div className='inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl'>
//             {TRACKS.map((t) => (
//               <button
//                 key={t}
//                 onClick={() => setTrack(t)}
//                 className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
//                   track === t ? 'bg-white text-[#002EFF] shadow-sm' : 'text-slate-400 hover:text-slate-600'
//                 }`}
//               >
//                 {EXAM_TRACKS[t].label}
//               </button>
//             ))}
//           </div>
//           {isDeptSplit && (
//             <div className='inline-flex gap-1 p-1 bg-slate-100 rounded-xl'>
//               {DEPARTMENTS.map((dept) => (
//                 <button
//                   key={dept}
//                   onClick={() => setDepartment(dept)}
//                   className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
//                     department === dept ? 'bg-white text-[#FCB900] shadow-sm' : 'text-slate-400 hover:text-slate-600'
//                   }`}
//                 >
//                   {DEPARTMENT_LABELS[dept]}
//                 </button>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>

//       <Card className='rounded-3xl border-none shadow-sm bg-white overflow-x-auto'>
//         <div className='min-w-[760px]'>
//           <div className='grid grid-cols-7 bg-slate-50'>
//             <div className='px-4 py-3 text-[9px] font-black uppercase text-gray-400'>Time</div>
//             {DAYS.map((d) => (
//               <div key={d} className='px-2 py-3 text-[9px] font-black uppercase text-gray-500 text-center'>
//                 {d.slice(0, 3)}
//               </div>
//             ))}
//           </div>

//           {slots.map((slot, slotIdx) => (
//             <div key={slotIdx} className='grid grid-cols-7 border-t border-slate-50'>
//               <div className='px-4 py-2 flex flex-col justify-center'>
//                 <span className='text-[10px] font-black text-gray-700'>{slot.label}</span>
//                 <span className='text-[9px] font-bold text-gray-400 flex items-center gap-1'>
//                   <Clock size={9} /> {slotTimeLabel(slot)}
//                 </span>
//               </div>
//               {DAYS.map((d, dayIdx) => {
//                 const cell = grid[slotIdx]?.[dayIdx] ?? []
//                 return (
//                   <div key={d} className='px-1.5 py-1.5 border-l border-slate-50 flex flex-col gap-1 justify-center'>
//                     {cell.length ? (
//                       cell.map((s, i) => (
//                         <span
//                           key={i}
//                           className={`inline-block w-full text-center px-1 py-1.5 rounded-lg text-[10px] font-black ${tintForSubject(s)}`}
//                         >
//                           {s}
//                         </span>
//                       ))
//                     ) : (
//                       <span className='text-[10px] text-slate-300 text-center'>—</span>
//                     )}
//                   </div>
//                 )
//               })}
//             </div>
//           ))}
//         </div>
//       </Card>
//     </div>
//   )
// }




'use client'

import { useEffect, useState } from 'react'

import { CalendarDays, Clock, Lock } from 'lucide-react'

import { Card } from '@/components/ui/card'

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

import {
  EXAM_TRACKS,
  DEPARTMENT_LABELS,
  type ExamTrack,
  type Department,
} from '@/lib/studentProfile'

import { Badge } from '@/components/ui/badge'

import { getToken } from '@/lib/auth'

import { isDemoToken } from '@/lib/demoAccounts'

import { dsaApi } from '@/lib/api'

const TRACKS: ExamTrack[] = [
  'jamb',
  'waec',
  'postutme',
  'undergrad',
  'preclinical',
  'afterschool',
]

// These programmes have separate Science / Art / Commercial timetables.
const DEPT_SPLIT: ExamTrack[] = [
  'waec',
  'afterschool',
  'jamb',
  'postutme',
]

const DEPARTMENTS: Department[] = [
  'science',
  'art',
  'commercial',
]

// Afterschool is additionally split into SS1 and SS2.
const AFTERSCHOOL_LEVELS = ['ss1', 'ss2'] as const

type AfterschoolLevel =
  (typeof AFTERSCHOOL_LEVELS)[number]

/**
 * Read-only weekly timetable with a track selector.
 *
 * Used where a role can view but not edit the schedule
 * (tutors, staff, students).
 *
 * The ADMIN schedules the timetable.
 *
 * Afterschool structure:
 *
 * SS1
 *   ├── Science
 *   ├── Art
 *   └── Commercial
 *
 * SS2
 *   ├── Science
 *   ├── Art
 *   └── Commercial
 */
export default function ReadOnlyTimetable({
  initialTrack = 'jamb',
}: {
  initialTrack?: ExamTrack
}) {
  const [track, setTrack] =
    useState<ExamTrack>(initialTrack)

  const [department, setDepartment] =
    useState<Department>('science')

  const [afterschoolLevel, setAfterschoolLevel] =
    useState<AfterschoolLevel>('ss1')

  const [grid, setGrid] =
    useState<TimetableGrid>([])

  const [slots, setSlots] =
    useState<Slot[]>(DEFAULT_SLOTS)

  const [live, setLive] =
    useState(false)

  const isAfterschool =
    track === 'afterschool'

  const isDeptSplit =
    DEPT_SPLIT.includes(track)

  /*
   * Normal department-split programmes:
   *
   * jamb-science
   * jamb-art
   * jamb-commercial
   *
   * waec-science
   * waec-art
   * waec-commercial
   *
   * postutme-science
   * postutme-art
   * postutme-commercial
   *
   * Afterschool:
   *
   * afterschool-ss1-science
   * afterschool-ss1-art
   * afterschool-ss1-commercial
   *
   * afterschool-ss2-science
   * afterschool-ss2-art
   * afterschool-ss2-commercial
   */
  const key = isAfterschool
    ? `afterschool-${afterschoolLevel}-${department}`
    : timetableKey(
        track,
        isDeptSplit ? department : null,
      )

  /*
   * Live-first:
   *
   * Real JWT reads:
   * GET /timetable/:key
   *
   * Demo/offline falls back to the local store.
   */
  useEffect(() => {
    let cancelled = false

    const local = () => {
      if (cancelled) return

      /*
       * The local timetable helper currently understands
       * the normal track/department structure.
       *
       * For Afterschool, use the selected level as part
       * of the key when the local store supports it.
       */
      setGrid(
        getEffectiveTimetable(
          track,
          isDeptSplit ? department : null,
        ),
      )

      setSlots(DEFAULT_SLOTS)
      setLive(false)
    }

    const t = getToken()

    if (t && !isDemoToken(t)) {
      dsaApi.timetable
        .get(key)
        .then((res) => {
          if (cancelled) return

          const apiGrid = (
            res as { grid?: unknown }
          )?.grid

          if (Array.isArray(apiGrid)) {
            setGrid(gridFromApi(apiGrid))

            setSlots(
              slotsFromApi(
                (res as { slots?: unknown })?.slots,
              ),
            )

            setLive(true)
          } else {
            local()
          }
        })
        .catch(local)
    } else {
      local()
    }

    return () => {
      cancelled = true
    }
  }, [
    track,
    department,
    afterschoolLevel,
    key,
    isDeptSplit,
    isAfterschool,
  ])

  return (
    <div className='space-y-5 max-w-5xl mx-auto'>
      {/* Header */}
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase flex items-center gap-2'>
            <CalendarDays size={24} />

            Timetable
          </h2>

          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5'>
            <Lock size={11} />

            {isAfterschool
              ? 'Afternoon School · class level and department'
              : 'View only — scheduled by the admin'}

            <Badge
              className={`text-[8px] font-black ${
                live
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {live ? 'Live' : 'Local'}
            </Badge>
          </p>
        </div>

        <div className='flex flex-col items-end gap-2'>
          {/* Programme selector */}
          <div className='inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl'>
            {TRACKS.map((t) => (
              <button
                key={t}
                onClick={() => setTrack(t)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  track === t
                    ? 'bg-white text-[#002EFF] shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {EXAM_TRACKS[t].label}
              </button>
            ))}
          </div>

          {/* Afterschool class level selector */}
          {isAfterschool && (
            <div className='inline-flex gap-1 p-1 bg-slate-100 rounded-xl'>
              {AFTERSCHOOL_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() =>
                    setAfterschoolLevel(level)
                  }
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    afterschoolLevel === level
                      ? 'bg-white text-[#002EFF] shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {level === 'ss1' ? 'SS1' : 'SS2'}
                </button>
              ))}
            </div>
          )}

          {/* Department selector */}
          {isDeptSplit && (
            <div className='inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl'>
              {DEPARTMENTS.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setDepartment(dept)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    department === dept
                      ? 'bg-white text-[#FCB900] shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {DEPARTMENT_LABELS[dept]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Current timetable */}
      <div className='flex flex-wrap items-center gap-2'>
        <Badge className='bg-slate-100 text-slate-600 text-[9px] font-black uppercase'>
          {EXAM_TRACKS[track].label}
        </Badge>

        {isAfterschool && (
          <Badge className='bg-blue-50 text-[#002EFF] text-[9px] font-black uppercase'>
            {afterschoolLevel.toUpperCase()}
          </Badge>
        )}

        {isDeptSplit && (
          <Badge className='bg-amber-50 text-amber-700 text-[9px] font-black uppercase'>
            {DEPARTMENT_LABELS[department]}
          </Badge>
        )}

        <span className='text-[9px] font-bold text-slate-400'>
          {key}
        </span>
      </div>

      {/* Timetable */}
      <Card className='rounded-3xl border-none shadow-sm bg-white overflow-x-auto'>
        <div className='min-w-[760px]'>
          {/* Header */}
          <div className='grid grid-cols-7 bg-slate-50'>
            <div className='px-4 py-3 text-[9px] font-black uppercase text-gray-400'>
              Time
            </div>

            {DAYS.map((d) => (
              <div
                key={d}
                className='px-2 py-3 text-[9px] font-black uppercase text-gray-500 text-center'
              >
                {d.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Rows */}
          {slots.map((slot, slotIdx) => (
            <div
              key={slotIdx}
              className='grid grid-cols-7 border-t border-slate-50'
            >
              {/* Time */}
              <div className='px-4 py-2 flex flex-col justify-center'>
                <span className='text-[10px] font-black text-gray-700'>
                  {slot.label}
                </span>

                <span className='text-[9px] font-bold text-gray-400 flex items-center gap-1'>
                  <Clock size={9} />

                  {slotTimeLabel(slot)}
                </span>
              </div>

              {/* Days */}
              {DAYS.map((d, dayIdx) => {
                const cell =
                  grid[slotIdx]?.[dayIdx] ?? []

                return (
                  <div
                    key={d}
                    className='px-1.5 py-1.5 border-l border-slate-50 flex flex-col gap-1 justify-center'
                  >
                    {cell.length ? (
                      cell.map((s, i) => (
                        <span
                          key={i}
                          className={`inline-block w-full text-center px-1 py-1.5 rounded-lg text-[10px] font-black ${tintForSubject(s)}`}
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className='text-[10px] text-slate-300 text-center'>
                        —
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}