// 'use client'

// import { useState, useEffect, useMemo } from 'react'
// import {
//   Monitor,
//   Calculator,
//   Flag,
//   ChevronLeft,
//   ChevronRight,
//   Clock,
//   ShieldCheck,
//   Layers,
//   BookOpen,
//   Zap,
//   RotateCcw,
//   X,
//   Trophy,
//   Target,
//   AlertTriangle,
//   LogOut,
// } from 'lucide-react'
// import { Card } from '@/components/ui/card'
// import { Button } from '@/components/ui/button'
// import { Badge } from '@/components/ui/badge'
// import { pastQuestions } from './pastquestions'

// type Mode = 'jamb' | 'study' | null

// export default function ExamSimulator() {
//   const [mode, setMode] = useState<Mode>(null)
//   const [activeSubject, setActiveSubject] = useState('Biology')
//   const [currentIdx, setCurrentIdx] = useState(0)
//   const [selectedAnswers, setSelectedAnswers] = useState<
//     Record<string, number>
//   >({})
//   const [marked, setMarked] = useState<number[]>([])
//   const [timeLeft, setTimeLeft] = useState(7200)

//   const [showCalc, setShowCalc] = useState(false)
//   const [showExit, setShowExit] = useState(false)
//   const [showResults, setShowResults] = useState(false)

//   const currentQuestions = useMemo(
//     () => (pastQuestions as any)[activeSubject]?.bank || [],
//     [activeSubject],
//   )
//   const question = currentQuestions[currentIdx]

//   useEffect(() => {
//     if (!mode || mode === 'study') return
//     const timer = setInterval(
//       () => setTimeLeft((p) => (p > 0 ? p - 1 : 0)),
//       1000,
//     )
//     return () => clearInterval(timer)
//   }, [mode])

//   const formatTime = (s: number) => {
//     const m = Math.floor((s % 3600) / 60),
//       sec = s % 60
//     return `${Math.floor(s / 3600)}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
//   }

//   const handleSelect = (i: number) => {
//     if (mode === 'study') return
//     setSelectedAnswers((prev) => ({
//       ...prev,
//       [`${activeSubject}-${currentIdx}`]: i,
//     }))
//   }

//   // --- MODULAR UI COMPONENTS ---

//   if (!mode)
//     return (
//       <div className='min-h-screen flex items-center justify-center bg-zinc-50 p-6'>
//         <div className='max-w-sm w-full space-y-6'>
//           <div className='text-center'>
//             <h1 className='text-2xl font-bold text-zinc-900 tracking-tight'>
//               Exam Portal
//             </h1>
//             <p className='text-zinc-500 text-xs uppercase tracking-widest mt-1'>
//               Select your simulation mode
//             </p>
//           </div>
//           <div className='grid gap-3'>
//             <Button
//               onClick={() => setMode('jamb')}
//               className='h-20 justify-start gap-4 bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50 shadow-sm rounded-2xl px-6'
//             >
//               <Zap className='text-amber-500' />
//               <div className='text-left'>
//                 <p className='font-bold'>JAMB Mode</p>
//                 <p className='text-[10px] text-zinc-500'>
//                   Timed • Standard Rules
//                 </p>
//               </div>
//             </Button>
//             <Button
//               onClick={() => setMode('study')}
//               className='h-20 justify-start gap-4 bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50 shadow-sm rounded-2xl px-6'
//             >
//               <BookOpen className='text-blue-500' />
//               <div className='text-left'>
//                 <p className='font-bold'>Study Mode</p>
//                 <p className='text-[10px] text-zinc-500'>
//                   Untimed • Explanations
//                 </p>
//               </div>
//             </Button>
//           </div>
//         </div>
//       </div>
//     )

//   return (
//     <div className='max-w-5xl mx-auto p-4 md:p-6 space-y-4 animate-in fade-in'>
//       {/* PROFESSIONAL HEADER */}
//       <header className='flex items-center justify-between bg-white border border-zinc-200 p-2 pl-6 rounded-2xl shadow-sm'>
//         <div className='flex items-center gap-4'>
//           <Monitor size={16} className='text-zinc-400' />
//           <div className='flex gap-1'>
//             {Object.keys(pastQuestions).map((sub) => (
//               <button
//                 key={sub}
//                 onClick={() => {
//                   setActiveSubject(sub)
//                   setCurrentIdx(0)
//                 }}
//                 className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activeSubject === sub ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
//               >
//                 {sub}
//               </button>
//             ))}
//           </div>
//         </div>
//         <div className='flex items-center gap-2'>
//           {mode === 'jamb' && (
//             <div className='px-4 py-1.5 bg-zinc-50 border rounded-lg flex items-center gap-2'>
//               <Clock
//                 size={14}
//                 className={timeLeft < 600 ? 'text-red-500' : 'text-zinc-400'}
//               />
//               <span className='font-mono text-xs font-bold'>
//                 {formatTime(timeLeft)}
//               </span>
//             </div>
//           )}
//           <Button
//             size='icon'
//             variant='ghost'
//             onClick={() => setShowCalc(!showCalc)}
//           >
//             <Calculator size={18} />
//           </Button>
//           <Button
//             size='icon'
//             variant='ghost'
//             className='text-red-500'
//             onClick={() => setShowExit(true)}
//           >
//             <LogOut size={18} />
//           </Button>
//         </div>
//       </header>

//       <div className='grid grid-cols-12 gap-5'>
//         <main className='col-span-12 lg:col-span-8 space-y-4'>
//           <Card className='p-8 md:p-10 rounded-3xl border-zinc-200 shadow-sm min-h-[550px] flex flex-col'>
//             <div className='flex justify-between items-center mb-8'>
//               <Badge
//                 variant='secondary'
//                 className='rounded-md font-bold text-[10px]'
//               >
//                 {activeSubject} • Q{currentIdx + 1}
//               </Badge>
//               <button
//                 onClick={() =>
//                   setMarked((p) =>
//                     p.includes(currentIdx)
//                       ? p.filter((i) => i !== currentIdx)
//                       : [...p, currentIdx],
//                   )
//                 }
//                 className={`text-[11px] font-bold flex items-center gap-2 ${marked.includes(currentIdx) ? 'text-amber-600' : 'text-zinc-400'}`}
//               >
//                 <Flag
//                   size={14}
//                   fill={marked.includes(currentIdx) ? 'currentColor' : 'none'}
//                 />{' '}
//                 Review
//               </button>
//             </div>

//             <div className='flex-1'>
//               <h2 className='text-lg font-semibold text-zinc-800 leading-snug mb-8'>
//                 {question?.question}
//               </h2>
//               <div className='grid gap-3 max-w-xl'>
//                 {question?.options.map((opt: string, i: number) => {
//                   const isSelected =
//                     selectedAnswers[`${activeSubject}-${currentIdx}`] === i
//                   const isCorrect = i === question.answer
//                   return (
//                     <button
//                       key={i}
//                       onClick={() => handleSelect(i)}
//                       disabled={mode === 'study'}
//                       className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
//                         ${
//                           mode === 'study' && isCorrect
//                             ? 'border-emerald-500 bg-emerald-50'
//                             : isSelected
//                               ? 'border-zinc-900 bg-zinc-900 text-white'
//                               : 'border-zinc-100 hover:bg-zinc-50'
//                         }`}
//                     >
//                       <span
//                         className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold 
//                         ${isSelected ? 'bg-white/20' : 'bg-zinc-100 text-zinc-500'}`}
//                       >
//                         {String.fromCharCode(65 + i)}
//                       </span>
//                       <span className='text-sm font-medium'>{opt}</span>
//                     </button>
//                   )
//                 })}
//               </div>

//               {mode === 'study' && (
//                 <div className='mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100 animate-in fade-in'>
//                   <div className='flex items-center gap-2 mb-3 text-blue-700'>
//                     <Target size={14} />{' '}
//                     <span className='text-[11px] font-bold uppercase'>
//                       Explanation
//                     </span>
//                   </div>
//                   <p className='text-sm text-blue-900/80 mb-4'>
//                     {question?.explanation}
//                   </p>
//                   {question?.topic === 'Biology' && (
//                     <div className='mt-2'>
//                       [Image of biological cell structure diagram]
//                     </div>
//                   )}
//                 </div>
//               )}
//             </div>

//             <footer className='flex items-center justify-between mt-12 pt-6 border-t border-zinc-100'>
//               <Button
//                 variant='ghost'
//                 size='sm'
//                 onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
//                 disabled={currentIdx === 0}
//               >
//                 <ChevronLeft size={16} /> Previous
//               </Button>
//               <div className='flex gap-2'>
//                 <Button
//                   variant='outline'
//                   size='sm'
//                   onClick={() => setShowResults(true)}
//                 >
//                   Submit
//                 </Button>
//                 <Button
//                   size='sm'
//                   className='bg-zinc-900'
//                   onClick={() =>
//                     setCurrentIdx((p) =>
//                       Math.min(currentQuestions.length - 1, p + 1),
//                     )
//                   }
//                 >
//                   Next <ChevronRight size={16} />
//                 </Button>
//               </div>
//             </footer>
//           </Card>
//         </main>

//         <aside className='col-span-12 lg:col-span-4 space-y-4'>
//           <Card className='p-6 rounded-3xl border-zinc-200 shadow-sm'>
//             <div className='flex justify-between items-center mb-6'>
//               <h3 className='text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2'>
//                 <Layers size={14} /> Navigator
//               </h3>
//               <span className='text-[10px] font-bold px-2 py-0.5 bg-zinc-100 rounded-full'>
//                 {Object.keys(selectedAnswers).length}/{currentQuestions.length}
//               </span>
//             </div>
//             <div className='grid grid-cols-5 gap-2'>
//               {currentQuestions.map((_: any, i: number) => (
//                 <button
//                   key={i}
//                   onClick={() => setCurrentIdx(i)}
//                   className={`h-9 rounded-lg text-xs font-bold border transition-all ${
//                     i === currentIdx
//                       ? 'bg-zinc-900 text-white border-zinc-900'
//                       : marked.includes(i)
//                         ? 'bg-amber-100 text-amber-700 border-amber-200'
//                         : selectedAnswers[`${activeSubject}-${i}`] !== undefined
//                           ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
//                           : 'bg-white text-zinc-400 border-zinc-100'
//                   }`}
//                 >
//                   {i + 1}
//                 </button>
//               ))}
//             </div>
//           </Card>

//           <div className='p-6 bg-zinc-900 rounded-3xl text-white'>
//             <div className='flex items-center gap-3 mb-6'>
//               <ShieldCheck className='text-emerald-400' size={18} />
//               <div>
//                 <p className='text-[10px] text-zinc-500 font-bold uppercase'>
//                   Session ID
//                 </p>
//                 <p className='text-xs font-mono'>#CBT-2026-AFR</p>
//               </div>
//             </div>
//             <Button
//               variant='secondary'
//               className='w-full rounded-xl bg-white/10 text-white hover:bg-white/20 border-none'
//               onClick={() => setMode(null)}
//             >
//               <RotateCcw size={16} className='mr-2' /> Restart
//             </Button>
//           </div>
//         </aside>
//       </div>

//       {/* MODALS (Simplified) */}
//       {showResults && (
//         <div className='fixed inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4'>
//           <Card className='max-w-xs w-full p-8 rounded-3xl text-center space-y-4'>
//             <Trophy className='mx-auto text-blue-500' size={40} />
//             <h2 className='text-xl font-bold'>Review Completed</h2>
//             <p className='text-sm text-zinc-500'>
//               You've answered {Object.keys(selectedAnswers).length} questions.
//             </p>
//             <Button
//               className='w-full bg-zinc-900'
//               onClick={() => window.location.reload()}
//             >
//               Close Session
//             </Button>
//           </Card>
//         </div>
//       )}
//     </div>
//   )
// }



'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Monitor,
  Calculator,
  Flag,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldCheck,
  Layers,
  BookOpen,
  Zap,
  RotateCcw,
  X,
  Trophy,
  Target,
  LogOut,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pastQuestions } from './pastquestions'

type Mode = 'jamb' | 'study' | null

export default function ExamSimulator() {
  const [mode, setMode] = useState<Mode>(null)
  const [activeSubject, setActiveSubject] = useState('Biology')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, number>
  >({})
  const [marked, setMarked] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(7200)

  const [showCalc, setShowCalc] = useState(false)
  const [calcInput, setCalcInput] = useState('')
  const [calcResult, setCalcResult] = useState('')
  const [showExit, setShowExit] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const currentQuestions = useMemo(
    () => (pastQuestions as any)[activeSubject]?.bank || [],
    [activeSubject],
  )
  const question = currentQuestions[currentIdx]

  useEffect(() => {
    if (!mode || mode === 'study') return
    const timer = setInterval(
      () => setTimeLeft((p) => (p > 0 ? p - 1 : 0)),
      1000,
    )
    return () => clearInterval(timer)
  }, [mode])

  const formatTime = (s: number) => {
    const m = Math.floor((s % 3600) / 60),
      sec = s % 60
    return `${Math.floor(s / 3600)}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const handleSelect = (i: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [`${activeSubject}-${currentIdx}`]: i,
    }))
  }

  const handleCalcButton = (val: string) => {
    if (val === 'C') {
      setCalcInput('')
      setCalcResult('')
    } else if (val === '=') {
      try {
        // eslint-disable-next-line no-eval
        const res = eval(calcInput.replace(/×/g, '*').replace(/÷/g, '/'))
        setCalcResult(String(res))
      } catch {
        setCalcResult('Error')
      }
    } else {
      setCalcInput((prev) => prev + val)
    }
  }

  // --- MODE SELECTION SCREEN ---
  if (!mode)
    return (
      <div className='min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-slate-950 p-4 sm:p-6 transition-colors'>
        <div className='max-w-md w-full space-y-6'>
          <div className='text-center space-y-2'>
            <Badge className='bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border-none px-3 py-1 text-xs font-bold uppercase tracking-wider'>
              CBT Platform
            </Badge>
            <h1 className='text-3xl font-black text-zinc-900 dark:text-slate-100 tracking-tight'>
              Exam Simulator
            </h1>
            <p className='text-zinc-500 dark:text-slate-400 text-xs uppercase tracking-widest'>
              Choose your practice mode to begin
            </p>
          </div>
          <div className='grid gap-4'>
            <Card
              onClick={() => setMode('jamb')}
              className='p-6 cursor-pointer border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-md transition-all rounded-2xl flex items-center gap-5 group'
            >
              <div className='h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform'>
                <Zap size={24} />
              </div>
              <div className='text-left flex-1'>
                <p className='font-bold text-zinc-900 dark:text-slate-100 text-base'>
                  JAMB Mode
                </p>
                <p className='text-xs text-zinc-500 dark:text-slate-400 mt-0.5'>
                  Real exam conditions • Timed test • Standard rules
                </p>
              </div>
            </Card>

            <Card
              onClick={() => setMode('study')}
              className='p-6 cursor-pointer border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all rounded-2xl flex items-center gap-5 group'
            >
              <div className='h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform'>
                <BookOpen size={24} />
              </div>
              <div className='text-left flex-1'>
                <p className='font-bold text-zinc-900 dark:text-slate-100 text-base'>
                  Study Mode
                </p>
                <p className='text-xs text-zinc-500 dark:text-slate-400 mt-0.5'>
                  Learn at your own pace • Untimed • Instant explanations
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    )

  return (
    <div className='max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 animate-in fade-in transition-colors'>
      {/* PROFESSIONAL HEADER */}
      <header className='flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 p-2.5 sm:p-3 sm:px-5 rounded-2xl shadow-sm'>
        <div className='flex items-center gap-3 overflow-x-auto py-1 max-w-full scrollbar-none'>
          <Monitor size={18} className='text-zinc-400 dark:text-slate-500 shrink-0 hidden sm:block' />
          <div className='flex gap-1.5 shrink-0'>
            {Object.keys(pastQuestions).map((sub) => (
              <button
                key={sub}
                onClick={() => {
                  setActiveSubject(sub)
                  setCurrentIdx(0)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeSubject === sub
                    ? 'bg-zinc-900 text-white dark:bg-blue-600 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-slate-800'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        <div className='flex items-center gap-2 shrink-0 ml-auto'>
          {mode === 'jamb' && (
            <div className='px-3 py-1.5 bg-zinc-50 dark:bg-slate-800/80 border border-zinc-200 dark:border-slate-700/60 rounded-xl flex items-center gap-2'>
              <Clock
                size={15}
                className={timeLeft < 600 ? 'text-red-500 animate-pulse' : 'text-zinc-400 dark:text-slate-400'}
              />
              <span className='font-mono text-xs font-bold text-zinc-800 dark:text-slate-200'>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
          <Button
            size='icon'
            variant='ghost'
            onClick={() => setShowCalc(!showCalc)}
            className={`rounded-xl ${showCalc ? 'bg-zinc-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-slate-400'}`}
          >
            <Calculator size={18} />
          </Button>
          <Button
            size='icon'
            variant='ghost'
            className='text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl'
            onClick={() => setShowExit(true)}
          >
            <LogOut size={18} />
          </Button>
        </div>
      </header>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start'>
        {/* MAIN QUESTION DISPLAY */}
        <main className='lg:col-span-8 space-y-4'>
          <Card className='p-5 sm:p-8 rounded-3xl border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm min-h-[500px] flex flex-col justify-between'>
            <div>
              {/* Question Header Status */}
              <div className='flex justify-between items-center mb-6'>
                <Badge
                  variant='secondary'
                  className='rounded-lg px-2.5 py-1 font-bold text-[11px] bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-300 border-none'
                >
                  {activeSubject} • Question {currentIdx + 1} of {currentQuestions.length}
                </Badge>
                <button
                  onClick={() =>
                    setMarked((p) =>
                      p.includes(currentIdx)
                        ? p.filter((i) => i !== currentIdx)
                        : [...p, currentIdx],
                    )
                  }
                  className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${
                    marked.includes(currentIdx)
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                      : 'text-zinc-400 dark:text-slate-500 hover:bg-zinc-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Flag
                    size={14}
                    fill={marked.includes(currentIdx) ? 'currentColor' : 'none'}
                  />
                  {marked.includes(currentIdx) ? 'Flagged' : 'Flag'}
                </button>
              </div>

              {/* Question Text */}
              <h2 className='text-base sm:text-lg font-bold text-zinc-800 dark:text-slate-100 leading-relaxed mb-6'>
                {question?.question}
              </h2>

              {/* Side-by-side Option Grid */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6'>
                {question?.options.map((opt: string, i: number) => {
                  const selectedIdx = selectedAnswers[`${activeSubject}-${currentIdx}`]
                  const isSelected = selectedIdx === i
                  const isCorrect = i === question.answer
                  const isWrongSelection = mode === 'study' && isSelected && !isCorrect

                  let optionStyle = 'border-zinc-200 dark:border-slate-800 bg-zinc-50/50 dark:bg-slate-800/40 text-zinc-800 dark:text-slate-200 hover:bg-zinc-100 dark:hover:bg-slate-800'
                  let badgeStyle = 'bg-zinc-200 dark:bg-slate-700 text-zinc-700 dark:text-slate-300'

                  if (mode === 'study') {
                    if (isCorrect) {
                      optionStyle = 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200'
                      badgeStyle = 'bg-emerald-500 text-white'
                    } else if (isWrongSelection) {
                      optionStyle = 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 dark:border-rose-600 text-rose-900 dark:text-rose-200'
                      badgeStyle = 'bg-rose-500 text-white'
                    }
                  } else if (isSelected) {
                    optionStyle = 'border-zinc-900 dark:border-blue-500 bg-zinc-900 dark:bg-blue-600 text-white shadow-sm'
                    badgeStyle = 'bg-white/20 text-white'
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(i)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all text-left w-full ${optionStyle}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${badgeStyle}`}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className='text-xs sm:text-sm font-semibold leading-snug flex-1'>
                        {opt}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Study Mode Explanation Box */}
              {mode === 'study' && (
                <div className='p-4 sm:p-5 bg-blue-50/80 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/60 animate-in fade-in space-y-2'>
                  <div className='flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider'>
                    <Target size={15} /> Explanation
                  </div>
                  <p className='text-xs sm:text-sm text-blue-950 dark:text-blue-200/90 leading-relaxed'>
                    {question?.explanation || 'No detailed explanation provided for this question.'}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <footer className='flex items-center justify-between pt-6 border-t border-zinc-100 dark:border-slate-800/80 mt-6 gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
                disabled={currentIdx === 0}
                className='rounded-xl dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
              >
                <ChevronLeft size={16} className='mr-1' /> Previous
              </Button>
              
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setShowResults(true)}
                  className='rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                >
                  <CheckCircle2 size={15} className='mr-1.5' /> Submit
                </Button>
                <Button
                  size='sm'
                  className='bg-zinc-900 hover:bg-zinc-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl'
                  onClick={() =>
                    setCurrentIdx((p) =>
                      Math.min(currentQuestions.length - 1, p + 1),
                    )
                  }
                >
                  Next <ChevronRight size={16} className='ml-1' />
                </Button>
              </div>
            </footer>
          </Card>
        </main>

        {/* SIDEBAR NAVIGATOR & CALCULATOR */}
        <aside className='lg:col-span-4 space-y-4'>
          {/* Pop-out On-screen Calculator */}
          {showCalc && (
            <Card className='p-4 rounded-3xl border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm animate-in zoom-in-95'>
              <div className='flex justify-between items-center mb-3'>
                <p className='text-xs font-black uppercase text-zinc-500 dark:text-slate-400 flex items-center gap-1.5'>
                  <Calculator size={14} /> Calculator
                </p>
                <button
                  onClick={() => setShowCalc(false)}
                  className='text-zinc-400 hover:text-zinc-600 dark:hover:text-slate-200'
                >
                  <X size={16} />
                </button>
              </div>
              <div className='bg-zinc-100 dark:bg-slate-800 p-3 rounded-2xl mb-3 text-right font-mono'>
                <p className='text-xs text-zinc-400 dark:text-slate-500 min-h-[16px]'>
                  {calcInput || '0'}
                </p>
                <p className='text-lg font-bold text-zinc-800 dark:text-slate-100 min-h-[28px] truncate'>
                  {calcResult || calcInput || '0'}
                </p>
              </div>
              <div className='grid grid-cols-4 gap-1.5'>
                {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', 'C', '0', '=', '+'].map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleCalcButton(btn)}
                    className={`h-9 rounded-xl font-bold text-xs transition-colors ${
                      ['+', '-', '×', '÷', '='].includes(btn)
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                        : btn === 'C'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-500'
                        : 'bg-zinc-100 dark:bg-slate-800 text-zinc-800 dark:text-slate-200 hover:bg-zinc-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Question Navigator */}
          <Card className='p-5 sm:p-6 rounded-3xl border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'>
            <div className='flex justify-between items-center mb-5'>
              <h3 className='text-xs font-black text-zinc-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2'>
                <Layers size={15} /> Navigator
              </h3>
              <Badge
                variant='outline'
                className='text-[10px] font-bold dark:border-slate-800 dark:text-slate-300'
              >
                {Object.keys(selectedAnswers).filter((k) => k.startsWith(`${activeSubject}-`)).length}/{currentQuestions.length} Answered
              </Badge>
            </div>

            <div className='grid grid-cols-5 gap-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin'>
              {currentQuestions.map((_: any, i: number) => {
                const isCurrent = i === currentIdx
                const isFlagged = marked.includes(i)
                const isAnswered = selectedAnswers[`${activeSubject}-${i}`] !== undefined

                let tileStyle = 'bg-zinc-50 dark:bg-slate-800/50 text-zinc-500 dark:text-slate-400 border-zinc-200 dark:border-slate-800 hover:bg-zinc-100 dark:hover:bg-slate-800'

                if (isCurrent) {
                  tileStyle = 'bg-zinc-900 text-white dark:bg-blue-600 dark:text-white border-zinc-900 dark:border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                } else if (isFlagged) {
                  tileStyle = 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                } else if (isAnswered) {
                  tileStyle = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                }

                return (
                  <button
                    key={i}
                    onClick={() => setCurrentIdx(i)}
                    className={`h-9 rounded-xl text-xs font-bold border transition-all flex items-center justify-center ${tileStyle}`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>

            <div className='grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-zinc-100 dark:border-slate-800 text-[10px] font-bold text-zinc-400 dark:text-slate-500'>
              <div className='flex items-center gap-1.5'>
                <div className='w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0' />
                <span>Answered</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <div className='w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0' />
                <span>Flagged</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <div className='w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-slate-700 shrink-0' />
                <span>Pending</span>
              </div>
            </div>
          </Card>

          {/* Session Banner */}
          <div className='p-5 bg-zinc-900 dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-3xl text-white shadow-sm flex items-center justify-between gap-3'>
            <div className='flex items-center gap-3'>
              <div className='h-10 w-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0'>
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className='text-[10px] text-zinc-400 dark:text-slate-400 font-bold uppercase tracking-wider'>
                  Active Session
                </p>
                <p className='text-xs font-mono font-bold text-slate-200'>
                  #CBT-2026-AFR
                </p>
              </div>
            </div>
            <Button
              size='sm'
              variant='secondary'
              className='rounded-xl bg-white/10 hover:bg-white/20 text-white border-none shrink-0 text-xs font-bold'
              onClick={() => setMode(null)}
            >
              <RotateCcw size={14} className='mr-1.5' /> Reset
            </Button>
          </div>
        </aside>
      </div>

      {/* RESULTS MODAL */}
      {showResults && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in'>
          <Card className='max-w-sm w-full p-6 sm:p-8 rounded-3xl text-center space-y-5 bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-800 shadow-2xl'>
            <div className='h-16 w-16 bg-blue-50 dark:bg-blue-950/50 text-blue-500 rounded-3xl flex items-center justify-center mx-auto'>
              <Trophy size={32} />
            </div>
            <div>
              <h2 className='text-xl font-black text-zinc-900 dark:text-slate-100'>
                Submission Summary
              </h2>
              <p className='text-xs text-zinc-500 dark:text-slate-400 mt-1'>
                You have answered{' '}
                <span className='font-bold text-zinc-900 dark:text-slate-200'>
                  {Object.keys(selectedAnswers).length}
                </span>{' '}
                questions across all subjects.
              </p>
            </div>
            <div className='space-y-2 pt-2'>
              <Button
                className='w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl'
                onClick={() => setMode(null)}
              >
                End & Restart Session
              </Button>
              <Button
                variant='ghost'
                className='w-full rounded-xl text-zinc-500 dark:text-slate-400'
                onClick={() => setShowResults(false)}
              >
                Return to Exam
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* EXIT CONFIRMATION MODAL */}
      {showExit && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in'>
          <Card className='max-w-xs w-full p-6 rounded-3xl text-center space-y-4 bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-800 shadow-2xl'>
            <div className='h-12 w-12 bg-rose-50 dark:bg-rose-950/50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto'>
              <LogOut size={22} />
            </div>
            <div>
              <h2 className='text-base font-bold text-zinc-900 dark:text-slate-100'>
                Quit Session?
              </h2>
              <p className='text-xs text-zinc-500 dark:text-slate-400 mt-1'>
                Your progress for this exam run will be reset.
              </p>
            </div>
            <div className='flex gap-2 pt-2'>
              <Button
                variant='outline'
                className='flex-1 rounded-xl dark:border-slate-800 dark:text-slate-300'
                onClick={() => setShowExit(false)}
              >
                Cancel
              </Button>
              <Button
                className='flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl'
                onClick={() => {
                  setShowExit(false)
                  setMode(null)
                }}
              >
                Quit
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}