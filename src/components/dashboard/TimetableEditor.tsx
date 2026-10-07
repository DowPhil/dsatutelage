// 'use client'

// import { useState, useEffect, useCallback } from 'react'
// import { Card } from '@/components/ui/card'
// import {
//   CalendarDays,
//   Save,
//   Loader2,
//   Check,
//   AlertCircle,
//   RotateCcw,
// } from 'lucide-react'
// import {
//   EXAM_TRACKS,
//   DEPARTMENT_LABELS,
//   type ExamTrack,
//   type Department,
// } from '@/lib/studentProfile'
// import {
//   DAYS,
//   gridFromApi,
//   gridToApi,
//   emptyGrid,
//   timetableKey,
//   tintForSubject,
//   slotsFromApi,
//   slotTimeLabel,
//   DEFAULT_SLOTS,
//   type TimetableGrid,
//   type Slot,
// } from '@/lib/timetable'
// import { dsaApi } from '@/lib/api'

// // Programmes, in the order the admin picks them.
// const PROGRAMMES: ExamTrack[] = [
//   'jamb',
//   'waec',
//   'postutme',
//   'undergrad',
//   'preclinical',
//   'afterschool',
// ]
// // JAMB & Post-UTME are now department-split too (science / art / commercial).
// const DEPT_SPLIT: ExamTrack[] = ['waec', 'afterschool', 'jamb', 'postutme']
// const DEPARTMENTS: Department[] = ['science', 'art', 'commercial']

// function adminToken(): string | undefined {
//   if (typeof window === 'undefined') return undefined
//   return (
//     localStorage.getItem('admin_token') ||
//     localStorage.getItem('token') ||
//     undefined
//   )
// }

// export default function TimetableEditor() {
//   const [track, setTrack] = useState<ExamTrack>('jamb')
//   const [department, setDepartment] = useState<Department>('science')
//   const [grid, setGrid] = useState<TimetableGrid>(emptyGrid())
//   const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS)
//   const [loading, setLoading] = useState(true)
//   const [saving, setSaving] = useState(false)
//   const [saved, setSaved] = useState(false)
//   const [error, setError] = useState<string | null>(null)

//   const isDeptSplit = DEPT_SPLIT.includes(track)
//   const key = timetableKey(track, isDeptSplit ? department : null)

//   const load = useCallback(async () => {
//     setLoading(true)
//     setError(null)
//     setSaved(false)
//     try {
//       const res = (await dsaApi.timetable.get(key, adminToken())) as {
//         grid?: unknown
//         slots?: unknown
//       }
//       setGrid(gridFromApi(res?.grid))
//       setSlots(slotsFromApi(res?.slots))
//     } catch {
//       // No timetable yet for this key (or offline) — start from an empty grid.
//       setGrid(emptyGrid())
//       setSlots(DEFAULT_SLOTS)
//     } finally {
//       setLoading(false)
//     }
//   }, [key])

//   useEffect(() => {
//     load()
//   }, [load])

//   // A cell holds up to two subjects, each typed freely in its own box (so names
//   // with spaces or slashes like "Use of English" or "CRK/IRK" work fine).
//   const setCell = (
//     period: number,
//     day: number,
//     slot: 0 | 1 | 2,
//     value: string,
//   ) => {
//     setGrid((prev) => {
//       const next = prev.map((row) => row.map((c) => c.slice()))
//       if (!next[period]) next[period] = []
//       if (!next[period][day]) next[period][day] = []
//       next[period][day][slot] = value
//       setSaved(false)
//       return next
//     })
//   }

//   // Edit a period's start/end time (24h "HH:MM" from <input type="time">).
//   const setSlotTime = (period: number, field: 'start' | 'end', value: string) => {
//     setSlots((prev) => {
//       const next = prev.map((s) => ({ ...s }))
//       if (next[period]) next[period][field] = value
//       return next
//     })
//     setSaved(false)
//   }

//   const save = async () => {
//     setSaving(true)
//     setError(null)
//     try {
//       await dsaApi.timetable.save(key, gridToApi(grid), adminToken(), slots)
//       setSaved(true)
//       setTimeout(() => setSaved(false), 2500)
//     } catch (e) {
//       setError(e instanceof Error ? e.message : 'Could not save the timetable.')
//     } finally {
//       setSaving(false)
//     }
//   }

//   return (
//     <div className='max-w-5xl mx-auto space-y-5 px-1'>
//       <div className='flex flex-wrap items-center justify-between gap-3'>
//         <div>
//           <h1 className='text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2'>
//             <CalendarDays size={20} className='text-[#002EFF]' /> Timetable
//           </h1>
//           <p className='text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1'>
//             Per programme · {isDeptSplit ? 'per department' : 'all students'}
//           </p>
//         </div>
//         <button
//           onClick={save}
//           disabled={saving || loading}
//           className='flex items-center gap-2 h-10 px-5 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50'
//         >
//           {saving ? (
//             <Loader2 size={15} className='animate-spin' />
//           ) : saved ? (
//             <Check size={15} />
//           ) : (
//             <Save size={15} />
//           )}
//           {saving ? 'Saving…' : saved ? 'Saved' : 'Save Timetable'}
//         </button>
//       </div>

//       {/* Programme + department pickers */}
//       <Card className='p-4 rounded-3xl border-none shadow-sm bg-white space-y-3'>
//         <div>
//           <p className='text-[9px] font-black uppercase text-slate-400 mb-1.5'>
//             Programme
//           </p>
//           <div className='flex flex-wrap gap-1.5'>
//             {PROGRAMMES.map((t) => (
//               <button
//                 key={t}
//                 onClick={() => setTrack(t)}
//                 className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
//                   track === t
//                     ? 'bg-[#002EFF] text-white shadow'
//                     : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//                 }`}
//               >
//                 {EXAM_TRACKS[t].label}
//               </button>
//             ))}
//           </div>
//         </div>
//         {isDeptSplit && (
//           <div>
//             <p className='text-[9px] font-black uppercase text-slate-400 mb-1.5'>
//               Department
//             </p>
//             <div className='flex flex-wrap gap-1.5'>
//               {DEPARTMENTS.map((d) => (
//                 <button
//                   key={d}
//                   onClick={() => setDepartment(d)}
//                   className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
//                     department === d
//                       ? 'bg-[#FCB900] text-[#002EFF] shadow'
//                       : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//                   }`}
//                 >
//                   {DEPARTMENT_LABELS[d]}
//                 </button>
//               ))}
//             </div>
//           </div>
//         )}
//         <p className='text-[10px] font-medium text-slate-400'>
//           Editing <span className='font-black text-slate-600'>{key}</span>. Type
//           the subject in each box (spaces and slashes are fine, e.g.
//           <span className='font-bold text-slate-600'> Use of English</span>). Use
//           the extra boxes only when two or three courses run in the same period
//           (e.g. JAMB Physics / Biology / Agric).
//         </p>
//       </Card>

//       {error && (
//         <div className='flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5'>
//           <AlertCircle size={15} className='text-rose-500 shrink-0' />
//           <p className='text-[11px] font-bold text-rose-600'>{error}</p>
//         </div>
//       )}

//       {/* Grid */}
//       <Card className='rounded-3xl border-none shadow-sm bg-white overflow-hidden'>
//         {loading ? (
//           <div className='py-16 flex justify-center'>
//             <Loader2 className='animate-spin text-[#002EFF]' />
//           </div>
//         ) : (
//           <div className='overflow-x-auto'>
//             <div className='min-w-[720px]'>
//               {/* Header */}
//               <div className='grid grid-cols-7 bg-slate-50'>
//                 <div className='px-3 py-2.5 text-[9px] font-black uppercase text-slate-400'>
//                   Period
//                 </div>
//                 {DAYS.map((d) => (
//                   <div
//                     key={d}
//                     className='px-3 py-2.5 text-[9px] font-black uppercase text-slate-500 text-center'
//                   >
//                     {d.slice(0, 3)}
//                   </div>
//                 ))}
//               </div>
//               {/* Rows */}
//               {slots.map((slot, period) => (
//                 <div
//                   key={period}
//                   className='grid grid-cols-7 border-t border-slate-50'
//                 >
//                   <div className='px-2 py-2 flex flex-col justify-center gap-1'>
//                     <span className='text-[10px] font-black text-slate-700'>
//                       {slot.label}
//                     </span>
//                     <div className='flex items-center gap-1'>
//                       <input
//                         type='time'
//                         value={slot.start}
//                         onChange={(e) =>
//                           setSlotTime(period, 'start', e.target.value)
//                         }
//                         title='Start time'
//                         className='w-full min-w-0 h-7 px-1 rounded-md bg-slate-50 text-[10px] font-bold text-slate-600 outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white'
//                       />
//                       <input
//                         type='time'
//                         value={slot.end}
//                         onChange={(e) =>
//                           setSlotTime(period, 'end', e.target.value)
//                         }
//                         title='End time'
//                         className='w-full min-w-0 h-7 px-1 rounded-md bg-slate-50 text-[10px] font-bold text-slate-600 outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white'
//                       />
//                     </div>
//                     <span className='text-[8px] font-bold text-slate-400'>
//                       {slotTimeLabel(slot)}
//                     </span>
//                   </div>
//                   {DAYS.map((d, day) => {
//                     const cell = grid[period]?.[day] ?? []
//                     return (
//                       <div key={d} className='p-1 space-y-1'>
//                         <input
//                           value={cell[0] ?? ''}
//                           onChange={(e) => setCell(period, day, 0, e.target.value)}
//                           placeholder='—'
//                           title='Subject'
//                           className={`w-full h-9 px-2 rounded-lg text-[11px] font-bold text-center outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white ${
//                             cell[0]?.trim()
//                               ? tintForSubject(cell[0])
//                               : 'bg-slate-50 text-slate-500'
//                           }`}
//                         />
//                         <input
//                           value={cell[1] ?? ''}
//                           onChange={(e) => setCell(period, day, 1, e.target.value)}
//                           placeholder='+ 2nd (optional)'
//                           title='Second subject for this period (optional)'
//                           className={`w-full h-8 px-2 rounded-lg text-[10px] font-bold text-center outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white ${
//                             cell[1]?.trim()
//                               ? tintForSubject(cell[1])
//                               : 'bg-slate-50/60 text-slate-400'
//                           }`}
//                         />
//                         <input
//                           value={cell[2] ?? ''}
//                           onChange={(e) => setCell(period, day, 2, e.target.value)}
//                           placeholder='+ 3rd (optional)'
//                           title='Third subject for this period (optional)'
//                           className={`w-full h-8 px-2 rounded-lg text-[10px] font-bold text-center outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white ${
//                             cell[2]?.trim()
//                               ? tintForSubject(cell[2])
//                               : 'bg-slate-50/60 text-slate-400'
//                           }`}
//                         />
//                       </div>
//                     )
//                   })}
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//       </Card>

//       <button
//         onClick={load}
//         className='flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#002EFF]'
//       >
//         <RotateCcw size={12} /> Reload from server
//       </button>
//     </div>
//   )
// }



'use client'

import { useState, useEffect, useCallback } from 'react'

import { Card } from '@/components/ui/card'

import {
  CalendarDays,
  Save,
  Loader2,
  Check,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'

import {
  EXAM_TRACKS,
  DEPARTMENT_LABELS,
  type ExamTrack,
  type Department,
} from '@/lib/studentProfile'

import {
  DAYS,
  gridFromApi,
  gridToApi,
  emptyGrid,
  timetableKey,
  tintForSubject,
  slotsFromApi,
  slotTimeLabel,
  DEFAULT_SLOTS,
  type TimetableGrid,
  type Slot,
} from '@/lib/timetable'

import { dsaApi } from '@/lib/api'

// Programmes, in the order the admin picks them.
const PROGRAMMES: ExamTrack[] = [
  'jamb',
  'waec',
  'postutme',
  'undergrad',
  'preclinical',
  'afterschool',
]

// JAMB, WAEC, Post-UTME and Afterschool are department-split.
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

// Afterschool is also split by class level.
const AFTERSCHOOL_LEVELS = ['ss1', 'ss2'] as const

type AfterschoolLevel = (typeof AFTERSCHOOL_LEVELS)[number]

function adminToken(): string | undefined {
  if (typeof window === 'undefined') return undefined

  return (
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    undefined
  )
}

export default function TimetableEditor() {
  const [track, setTrack] = useState<ExamTrack>('jamb')

  const [department, setDepartment] =
    useState<Department>('science')

  const [afterschoolLevel, setAfterschoolLevel] =
    useState<AfterschoolLevel>('ss1')

  const [grid, setGrid] =
    useState<TimetableGrid>(emptyGrid())

  const [slots, setSlots] =
    useState<Slot[]>(DEFAULT_SLOTS)

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [saved, setSaved] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const isDeptSplit = DEPT_SPLIT.includes(track)

  const isAfterschool = track === 'afterschool'

  /*
   * Normal programmes:
   *
   * JAMB + Science
   * JAMB + Art
   * JAMB + Commercial
   *
   * WAEC + Science
   * etc.
   *
   * Afterschool:
   *
   * SS1 + Science
   * SS1 + Art
   * SS1 + Commercial
   * SS2 + Science
   * SS2 + Art
   * SS2 + Commercial
   */
  const key = isAfterschool
    ? `afterschool-${afterschoolLevel}-${department}`
    : timetableKey(
        track,
        isDeptSplit ? department : null,
      )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSaved(false)

    try {
      const res = (await dsaApi.timetable.get(
        key,
        adminToken(),
      )) as {
        grid?: unknown
        slots?: unknown
      }

      setGrid(gridFromApi(res?.grid))
      setSlots(slotsFromApi(res?.slots))
    } catch {
      // No timetable yet for this key (or offline) —
      // start from an empty grid.
      setGrid(emptyGrid())
      setSlots(DEFAULT_SLOTS)
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    load()
  }, [load])

  /*
   * A cell holds up to three subjects, each typed
   * freely in its own box.
   *
   * Examples:
   * Use of English
   * CRK/IRK
   * Physics
   * Biology
   * Agric
   */
  const setCell = (
    period: number,
    day: number,
    slot: 0 | 1 | 2,
    value: string,
  ) => {
    setGrid((prev) => {
      const next = prev.map((row) =>
        row.map((c) => c.slice()),
      )

      if (!next[period]) {
        next[period] = []
      }

      if (!next[period][day]) {
        next[period][day] = []
      }

      next[period][day][slot] = value

      setSaved(false)

      return next
    })
  }

  /*
   * Edit a period's start/end time.
   * Uses 24h HH:MM from <input type="time">.
   */
  const setSlotTime = (
    period: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setSlots((prev) => {
      const next = prev.map((s) => ({ ...s }))

      if (next[period]) {
        next[period][field] = value
      }

      return next
    })

    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setError(null)

    try {
      await dsaApi.timetable.save(
        key,
        gridToApi(grid),
        adminToken(),
        slots,
      )

      setSaved(true)

      setTimeout(() => {
        setSaved(false)
      }, 2500)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not save the timetable.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='max-w-5xl mx-auto space-y-5 px-1'>
      {/* Header */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2'>
            <CalendarDays
              size={20}
              className='text-[#002EFF]'
            />

            Timetable
          </h1>

          <p className='text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1'>
            {isAfterschool
              ? 'Afternoon school · per class level and department'
              : `Per programme · ${
                  isDeptSplit
                    ? 'per department'
                    : 'all students'
                }`}
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving || loading}
          className='flex items-center gap-2 h-10 px-5 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50'
        >
          {saving ? (
            <Loader2
              size={15}
              className='animate-spin'
            />
          ) : saved ? (
            <Check size={15} />
          ) : (
            <Save size={15} />
          )}

          {saving
            ? 'Saving…'
            : saved
              ? 'Saved'
              : 'Save Timetable'}
        </button>
      </div>

      {/* Programme + class level + department pickers */}
      <Card className='p-4 rounded-3xl border-none shadow-sm bg-white space-y-4'>
        {/* Programme */}
        <div>
          <p className='text-[9px] font-black uppercase text-slate-400 mb-1.5'>
            Programme
          </p>

          <div className='flex flex-wrap gap-1.5'>
            {PROGRAMMES.map((t) => (
              <button
                key={t}
                onClick={() => setTrack(t)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                  track === t
                    ? 'bg-[#002EFF] text-white shadow'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {EXAM_TRACKS[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* Afterschool class level */}
        {isAfterschool && (
          <div>
            <p className='text-[9px] font-black uppercase text-slate-400 mb-1.5'>
              Class Level
            </p>

            <div className='flex flex-wrap gap-1.5'>
              {AFTERSCHOOL_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() =>
                    setAfterschoolLevel(level)
                  }
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                    afterschoolLevel === level
                      ? 'bg-[#FCB900] text-[#002EFF] shadow'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {level === 'ss1' ? 'SS1' : 'SS2'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Department */}
        {isDeptSplit && (
          <div>
            <p className='text-[9px] font-black uppercase text-slate-400 mb-1.5'>
              Department
            </p>

            <div className='flex flex-wrap gap-1.5'>
              {DEPARTMENTS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDepartment(d)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                    department === d
                      ? 'bg-[#FCB900] text-[#002EFF] shadow'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {DEPARTMENT_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current timetable key */}
        <div className='rounded-xl bg-slate-50 px-3 py-2'>
          <p className='text-[9px] font-black uppercase text-slate-400 mb-1'>
            Current Timetable
          </p>

          <p className='text-[11px] font-bold text-slate-500'>
            Editing{' '}
            <span className='font-black text-slate-700'>
              {key}
            </span>
          </p>
        </div>

        <p className='text-[10px] font-medium text-slate-400'>
          Type the subject in each box. Spaces and slashes
          are fine, e.g.{' '}
          <span className='font-bold text-slate-600'>
            Use of English
          </span>{' '}
          or{' '}
          <span className='font-bold text-slate-600'>
            CRK/IRK
          </span>
          . Use the extra boxes when two or three courses
          run in the same period.
        </p>
      </Card>

      {/* Error */}
      {error && (
        <div className='flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5'>
          <AlertCircle
            size={15}
            className='text-rose-500 shrink-0'
          />

          <p className='text-[11px] font-bold text-rose-600'>
            {error}
          </p>
        </div>
      )}

      {/* Grid */}
      <Card className='rounded-3xl border-none shadow-sm bg-white overflow-hidden'>
        {loading ? (
          <div className='py-16 flex justify-center'>
            <Loader2 className='animate-spin text-[#002EFF]' />
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <div className='min-w-[720px]'>
              {/* Header */}
              <div className='grid grid-cols-7 bg-slate-50'>
                <div className='px-3 py-2.5 text-[9px] font-black uppercase text-slate-400'>
                  Period
                </div>

                {DAYS.map((d) => (
                  <div
                    key={d}
                    className='px-3 py-2.5 text-[9px] font-black uppercase text-slate-500 text-center'
                  >
                    {d.slice(0, 3)}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {slots.map((slot, period) => (
                <div
                  key={period}
                  className='grid grid-cols-7 border-t border-slate-50'
                >
                  {/* Period */}
                  <div className='px-2 py-2 flex flex-col justify-center gap-1'>
                    <span className='text-[10px] font-black text-slate-700'>
                      {slot.label}
                    </span>

                    <div className='flex items-center gap-1'>
                      <input
                        type='time'
                        value={slot.start}
                        onChange={(e) =>
                          setSlotTime(
                            period,
                            'start',
                            e.target.value,
                          )
                        }
                        title='Start time'
                        className='w-full min-w-0 h-7 px-1 rounded-md bg-slate-50 text-[10px] font-bold text-slate-600 outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white'
                      />

                      <input
                        type='time'
                        value={slot.end}
                        onChange={(e) =>
                          setSlotTime(
                            period,
                            'end',
                            e.target.value,
                          )
                        }
                        title='End time'
                        className='w-full min-w-0 h-7 px-1 rounded-md bg-slate-50 text-[10px] font-bold text-slate-600 outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white'
                      />
                    </div>

                    <span className='text-[8px] font-bold text-slate-400'>
                      {slotTimeLabel(slot)}
                    </span>
                  </div>

                  {/* Days */}
                  {DAYS.map((d, day) => {
                    const cell =
                      grid[period]?.[day] ?? []

                    return (
                      <div
                        key={d}
                        className='p-1 space-y-1'
                      >
                        {/* First subject */}
                        <input
                          value={cell[0] ?? ''}
                          onChange={(e) =>
                            setCell(
                              period,
                              day,
                              0,
                              e.target.value,
                            )
                          }
                          placeholder='—'
                          title='Subject'
                          className={`w-full h-9 px-2 rounded-lg text-[11px] font-bold text-center outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white ${
                            cell[0]?.trim()
                              ? tintForSubject(cell[0])
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        />

                        {/* Second subject */}
                        <input
                          value={cell[1] ?? ''}
                          onChange={(e) =>
                            setCell(
                              period,
                              day,
                              1,
                              e.target.value,
                            )
                          }
                          placeholder='+ 2nd (optional)'
                          title='Second subject for this period (optional)'
                          className={`w-full h-8 px-2 rounded-lg text-[10px] font-bold text-center outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white ${
                            cell[1]?.trim()
                              ? tintForSubject(cell[1])
                              : 'bg-slate-50/60 text-slate-400'
                          }`}
                        />

                        {/* Third subject */}
                        <input
                          value={cell[2] ?? ''}
                          onChange={(e) =>
                            setCell(
                              period,
                              day,
                              2,
                              e.target.value,
                            )
                          }
                          placeholder='+ 3rd (optional)'
                          title='Third subject for this period (optional)'
                          className={`w-full h-8 px-2 rounded-lg text-[10px] font-bold text-center outline-none border border-transparent focus:border-[#002EFF]/40 focus:bg-white ${
                            cell[2]?.trim()
                              ? tintForSubject(cell[2])
                              : 'bg-slate-50/60 text-slate-400'
                          }`}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Reload */}
      <button
        onClick={load}
        className='flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#002EFF]'
      >
        <RotateCcw size={12} />
        Reload from server
      </button>
    </div>
  )
}