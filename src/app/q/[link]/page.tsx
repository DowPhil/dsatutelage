'use client'

// Public (free) quiz taker — no login. Anyone with the link enters their name
// email and phone, takes the quiz once per device, sees their result on the
// page (downloadable, never emailed), then is invited to the homepage.
// Backed by the no-auth endpoints in docs/backend-requests-2026-09-02.md §2.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  GraduationCap,
  Loader2,
  Clock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Calculator as CalculatorIcon,
  Target,
  BarChart3,
  Download,
  BookOpenCheck,
  LayoutGrid,
  X,
} from 'lucide-react'
import { dsaApi } from '@/lib/api'
import RichText from '@/components/ui/RichText'
import { ScientificCalculator } from '@/app/rapid-quiz/components/Calculator'
import type { PublicQuizResult } from '@/lib/types'
import QuizLeaderboard, {
  type LeaderboardRow,
} from '@/components/dashboard/QuizLeaderboard'
import QuizCorrections, {
  type CorrectionsData,
} from '@/components/dashboard/QuizCorrections'

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

type RunQuestion = {
  questionId: string
  subject: string
  questionText: string
  options: string[]
  /** The diagram that goes with the question. The API always sent it; this
   *  page used to throw it away, so link takers never saw a single image. */
  imageUrl?: string
  marks: number
}

const str = (v: unknown) => (v == null ? '' : String(v))

function mapQuiz(full: Record<string, unknown>): {
  title: string
  minutes: number
  questions: RunQuestion[]
} {
  const subjects = Array.isArray(full.subjects) ? full.subjects : []
  const flat: RunQuestion[] = []
  let minutes = 0
  subjects.forEach((s: Record<string, unknown>) => {
    minutes += Number(s.timeLimit) || 0
    const qs = Array.isArray(s.questions) ? s.questions : []
    qs.forEach((qq: Record<string, unknown>) => {
      const labeled = (qq.optionsLabeled ?? {}) as Record<string, string>
      flat.push({
        questionId: str(qq.id ?? qq._id),
        subject: str(s.name),
        questionText: str(qq.questionText ?? qq.body),
        options: Array.isArray(qq.options)
          ? (qq.options as string[])
          : LETTERS.map((l) => labeled[l]).filter(Boolean),
        imageUrl: qq.imageUrl || qq.image ? str(qq.imageUrl ?? qq.image) : undefined,
        marks: Number(qq.marks ?? qq.mark) || 1,
      })
    })
  })
  return { title: str(full.title ?? 'Quiz'), minutes, questions: flat }
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * The question palette, grouped by subject the way a JAMB CBT screen is —
 * so a student on a four-subject mock can see where Chemistry starts. Jump to
 * any question; blue means answered.
 */
function QuestionMap({
  questions,
  answers,
  onPick,
}: {
  questions: RunQuestion[]
  answers: Record<string, number>
  onPick?: () => void
}) {
  const bySubject: { subject: string; items: number[] }[] = []
  questions.forEach((q, i) => {
    const subj = q.subject || 'General'
    let g = bySubject.find((x) => x.subject === subj)
    if (!g) {
      g = { subject: subj, items: [] }
      bySubject.push(g)
    }
    g.items.push(i)
  })

  return (
    <div className='space-y-2.5'>
      {bySubject.map((g) => (
        <div key={g.subject}>
          {bySubject.length > 1 && (
            <p className='text-[9px] font-black uppercase tracking-wide text-[#002EFF] mb-1'>
              {g.subject}
            </p>
          )}
          <div className='flex flex-wrap gap-1.5'>
            {g.items.map((i) => {
              const q = questions[i]
              const done = answers[q.questionId] !== undefined
              return (
                <a
                  key={q.questionId || i}
                  href={`#pq-${i}`}
                  onClick={onPick}
                  title={done ? 'Answered' : 'Not answered'}
                  className={`h-8 w-8 rounded-lg text-[11px] font-black flex items-center justify-center ${
                    done ? 'bg-[#002EFF] text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {i + 1}
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** sha256 of an email, lower-cased — what the leaderboard uses to find you. */
async function emailHash(email: string): Promise<string | null> {
  try {
    const data = new TextEncoder().encode(email.trim().toLowerCase())
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return null
  }
}

export default function PublicQuizPage() {
  const params = useParams()
  const router = useRouter()
  const link = String(params?.link ?? '')

  const [step, setStep] = useState<
    'loading' | 'details' | 'quiz' | 'result' | 'unavailable'
  >('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [title, setTitle] = useState('Quiz')
  const [questions, setQuestions] = useState<RunQuestion[]>([])
  const [minutes, setMinutes] = useState(0)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [remaining, setRemaining] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PublicQuizResult | null>(null)
  const [showCalc, setShowCalc] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [alreadyTaken, setAlreadyTaken] = useState(false)
  const [showCorrections, setShowCorrections] = useState(false)
  const [showMap, setShowMap] = useState(false) // mobile question-map drawer
  // Code-locked test: the questions arrive only after a valid access code.
  const [locked, setLocked] = useState(false)
  const [lockedCount, setLockedCount] = useState(0)
  const [accessCode, setAccessCode] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  // Everyone's ranking on this quiz, signed-in and via the link together.
  const [board, setBoard] = useState<LeaderboardRow[]>([])
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardHidden, setBoardHidden] = useState(false)
  const [myHash, setMyHash] = useState<string | null>(null)

  useEffect(() => {
    if (step !== 'result' || !link) return
    let cancelled = false
    setBoardLoading(true)
    ;(async () => {
      const [rows, hash] = await Promise.all([
        dsaApi.quizzes.publicLeaderboard(link).catch(() => null),
        emailHash(email),
      ])
      if (cancelled) return
      if (rows === null) setBoardHidden(true) // disabled for this quiz, or unreachable
      else setBoard(rows as unknown as LeaderboardRow[])
      setMyHash(hash)
      setBoardLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [step, link, email])
  const totalTime = useRef(0)
  // Anti-cheating: count tab-switch / minimise / split-screen exits; auto-submit
  // once past the limit, warn before that.
  const [breaches, setBreaches] = useState(0)
  const breachRef = useRef(0)
  const [showWarning, setShowWarning] = useState(false)
  const MAX_BREACHES = 5

  // One attempt per device: a flag (with the last result) is stored under the
  // quiz link so a revisit/reload can't retake it.
  const takenKey = `dsa-freequiz-${link}`

  // Load the quiz for this link.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const full = (await dsaApi.quizzes.getPublic(link)) as unknown as Record<
          string,
          unknown
        >
        if (cancelled) return
        if (full.locked === true) {
          setTitle(String(full.title || 'Quiz'))
          setLocked(true)
          setLockedCount(Number(full.questionCount) || 0)
          setMinutes(Number(full.durationMinutes || full.timeLimit) || 0)
          // Already taken on this device? Show the stored result, no retake.
          try {
            const raw = localStorage.getItem(takenKey)
            const prior = raw ? (JSON.parse(raw) as { result?: PublicQuizResult; name?: string }) : null
            if (prior?.result) {
              setResult(prior.result)
              if (prior.name) setName(prior.name)
              setAlreadyTaken(true)
              setStep('result')
              return
            }
          } catch {
            /* storage unavailable — the backend still de-dupes by email */
          }
          setStep('details')
          return
        }
        const mapped = mapQuiz(full)
        if (mapped.questions.length === 0) {
          setErrorMsg('This quiz has no questions yet.')
          setStep('unavailable')
          return
        }
        setTitle(mapped.title)
        setQuestions(mapped.questions)
        setMinutes(mapped.minutes)
        // Already taken on this device? Show the stored result, no retake.
        let prior: { result?: PublicQuizResult; name?: string } | null = null
        try {
          const raw = localStorage.getItem(takenKey)
          if (raw) prior = JSON.parse(raw)
        } catch {
          prior = null
        }
        if (prior?.result) {
          setResult(prior.result)
          if (prior.name) setName(prior.name)
          setAlreadyTaken(true)
          setStep('result')
          return
        }
        setStep('details')
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : ''
        // 404 → the link is wrong OR the public endpoint isn't live yet.
        setErrorMsg(
          /not found|404/i.test(msg)
            ? 'This quiz link is not available.'
            : 'This quiz could not be loaded right now.',
        )
        setStep('unavailable')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [link])

  const submit = useCallback(
    async (auto = false) => {
      if (submitting) return
      setSubmitting(true)
      const timeTaken = Math.max(
        1,
        Math.round((totalTime.current || 0) - remaining),
      )
      try {
        const res = (await dsaApi.quizzes.submitPublic(link, {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          answers: questions.map((q) => ({
            questionId: q.questionId,
            selectedOption:
              answers[q.questionId] === undefined ? -1 : answers[q.questionId],
          })),
          timeTaken,
          ...(locked ? { code: accessCode.trim() } : {}),
        })) as PublicQuizResult
        setResult(res)
        // Lock this device from retaking, and keep the result for a revisit.
        try {
          localStorage.setItem(
            takenKey,
            JSON.stringify({ result: res, name: name.trim() }),
          )
        } catch {
          /* storage unavailable — the backend still de-dupes by email */
        }
        setStep('result')
      } catch (e) {
        setErrorMsg(
          e instanceof Error ? e.message : 'Could not submit your answers.',
        )
        if (!auto) setSubmitting(false)
        return
      }
      setSubmitting(false)
    },
    [answers, email, phone, link, name, questions, remaining, submitting, takenKey],
  )

  // Register a "left the quiz" breach; auto-submit once past the limit, else warn.
  const registerBreach = useCallback(() => {
    breachRef.current += 1
    setBreaches(breachRef.current)
    if (breachRef.current > MAX_BREACHES) {
      void submit(true)
    } else {
      setShowWarning(true)
    }
  }, [submit])

  // Anti-cheating: detect tab switches, minimising and split-screen (focus loss)
  // while taking. Dedupe leave/return so one exit counts once.
  useEffect(() => {
    if (step !== 'quiz') return
    let away = false
    const leave = () => {
      if (away) return
      away = true
      registerBreach()
    }
    const back = () => {
      away = false
    }
    const onVis = () => (document.hidden ? leave() : back())
    window.addEventListener('blur', leave)
    window.addEventListener('focus', back)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('blur', leave)
      window.removeEventListener('focus', back)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [step, registerBreach])

  // Countdown while taking the quiz.
  useEffect(() => {
    if (step !== 'quiz' || minutes <= 0) return
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id)
          void submit(true)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [step, minutes, submit])

  const start = async () => {
    if (name.trim().length < 2) {
      setErrorMsg('Please enter your name.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email — it is how we find your result again.')
      return
    }
    if (phone.trim().replace(/\D/g, '').length < 7) {
      setErrorMsg('Please enter a valid phone number.')
      return
    }
    let mins = minutes
    if (locked) {
      if (!accessCode.trim()) {
        setErrorMsg('Please enter the access code you were given.')
        return
      }
      setUnlocking(true)
      try {
        const full = (await dsaApi.quizzes.unlockPublic(link, {
          code: accessCode.trim(),
          email: email.trim().toLowerCase(),
          name: name.trim(),
        })) as unknown as Record<string, unknown>
        const mapped = mapQuiz(full)
        if (mapped.questions.length === 0) {
          setErrorMsg('This test has no questions yet.')
          return
        }
        setTitle(mapped.title)
        setQuestions(mapped.questions)
        if (mapped.minutes) {
          mins = mapped.minutes
          setMinutes(mapped.minutes)
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'That access code could not be checked. Try again.')
        return
      } finally {
        setUnlocking(false)
      }
    }
    setErrorMsg('')
    const secs = mins * 60
    totalTime.current = secs
    setRemaining(secs)
    setAnswers({})
    setShowCalc(false)
    setConfirmSubmit(false)
    breachRef.current = 0
    setBreaches(0)
    setShowWarning(false)
    setStep('quiz')
  }

  const answered = Object.keys(answers).length
  const pct = result
    ? result.percentage != null
      ? result.percentage <= 1
        ? Math.round(result.percentage * 100)
        : Math.round(result.percentage)
      : result.totalMarks > 0
        ? Math.round((result.totalScore / result.totalMarks) * 100)
        : 0
    : 0

  const band =
    pct >= 75
      ? 'Excellent!'
      : pct >= 50
        ? 'Well done'
        : pct >= 40
          ? 'Keep going'
          : 'Practice required'

  // Per-subject scores from the breakdown (when the backend returns per-question
  // rows with questionId + marksEarned).
  const breakdown = Array.isArray(result?.breakdown)
    ? (result!.breakdown as Record<string, unknown>[])
    : []
  const byId = new Map(
    breakdown
      .filter((b) => b && typeof b === 'object')
      .map((b) => [String(b.questionId), b] as const),
  )
  const subjMap = new Map<string, { earned: number; total: number }>()
  questions.forEach((q) => {
    const subj = q.subject || 'General'
    const row = subjMap.get(subj) ?? { earned: 0, total: 0 }
    row.total += q.marks || 1
    const b = byId.get(q.questionId)
    if (b) row.earned += Number(b.marksEarned) || 0
    subjMap.set(subj, row)
  })
  const perSubject = breakdown.length ? [...subjMap.entries()] : []

  // Full corrections (options with correct/green, wrong/red, explanations, a
  // question map + per-subject) — same component the portal quiz uses. Built by
  // joining the loaded questions with the submit breakdown.
  const canShowCorrections = breakdown.length > 0
  const correctionsData: CorrectionsData = {
    quizTitle: title,
    totalScore: result?.totalScore ?? 0,
    totalMarks: result?.totalMarks ?? 0,
    percentage: pct,
    perSubject: (() => {
      const m = new Map<
        string,
        { earned: number; total: number; correct: number; count: number }
      >()
      questions.forEach((q) => {
        const subj = q.subject || 'General'
        const row = m.get(subj) ?? { earned: 0, total: 0, correct: 0, count: 0 }
        row.total += q.marks || 1
        row.count += 1
        const b = byId.get(q.questionId)
        if (b) {
          row.earned += Number(b.marksEarned) || 0
          if (b.isCorrect) row.correct += 1
        }
        m.set(subj, row)
      })
      return [...m.entries()].map(([subject, v]) => ({
        subject,
        earned: v.earned,
        total: v.total,
        correct: v.correct,
        count: v.count,
        percentage: v.total ? (v.earned / v.total) * 100 : 0,
      }))
    })(),
    questions: questions.map((q) => {
      const b = byId.get(q.questionId)
      const sel = b && b.selectedOption != null ? Number(b.selectedOption) : -1
      return {
        questionId: q.questionId,
        subject: q.subject,
        questionText: q.questionText,
        options: q.options,
        correctIndex: b && b.correctAnswer != null ? Number(b.correctAnswer) : null,
        selectedIndex: sel >= 0 ? sel : null,
        isCorrect: b ? !!b.isCorrect : false,
        marks: q.marks,
        marksEarned: b ? Number(b.marksEarned) || 0 : 0,
        explanation: b ? str(b.explanation) : '',
      }
    }),
  }

  const downloadResult = () => {
    const rows = perSubject
      .map(([s, v]) => {
        const p = v.total ? Math.round((v.earned / v.total) * 100) : 0
        return `<tr><td>${s}</td><td>${v.earned}/${v.total}</td><td>${p}%</td></tr>`
      })
      .join('')
    const html = `<!doctype html><meta charset="utf-8"><title>Quiz Result</title>
<body style="font-family:system-ui,Arial;max-width:640px;margin:2rem auto;color:#0f172a">
<h1 style="color:#002EFF">${title} — Result</h1>
<p><b>${name || 'Student'}${email ? ` · ${email}` : ''}</b></p>
<p style="font-size:2rem;font-weight:800">${pct}% <span style="font-size:1rem;color:#64748b">(${result?.totalScore}/${result?.totalMarks} marks)</span></p>
${rows ? `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr style="background:#f1f5f9"><th align="left">Subject</th><th align="left">Score</th><th align="left">%</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
<p style="color:#94a3b8;font-size:.8rem;margin-top:1rem">Distinguished Scholars Academy</p>
</body>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'quiz').replace(/[^\w]+/g, '-')}-result.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='min-h-screen bg-[#F8FAFF] flex flex-col'>
      {/* Header */}
      {/* Sticky while taking the quiz so the countdown never scrolls away.
          Below the warning/confirm overlays (z-50), above the floating
          buttons (z-40); safe-area padding keeps it clear of phone notches. */}
      <header
        className={`flex items-center gap-3 px-5 py-4 ${
          step === 'quiz'
            ? 'sticky top-0 z-[45] bg-[#F8FAFF]/95 backdrop-blur border-b border-slate-100 pt-[max(1rem,env(safe-area-inset-top))]'
            : ''
        }`}
      >
        <div className='bg-[#FCB900] p-1.5 rounded-lg'>
          <GraduationCap className='text-[#002EFF]' size={20} />
        </div>
        <span className='text-[#002EFF] font-black text-sm tracking-tighter uppercase'>
          DSA · Quiz
        </span>
        {step === 'quiz' && minutes > 0 && (
          <span
            role='timer'
            aria-label={`Time remaining ${fmt(remaining)}`}
            className={`ml-auto flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[13px] font-black tabular-nums ${
              remaining <= 60
                ? 'bg-rose-50 text-rose-600'
                : 'bg-blue-50 text-[#002EFF]'
            }`}
          >
            <Clock size={15} /> {fmt(remaining)}
          </span>
        )}
      </header>

      <main className='flex-1 w-full max-w-2xl mx-auto px-4 pb-10'>
        {step === 'loading' && (
          <div className='py-24 flex justify-center'>
            <Loader2 className='animate-spin text-[#002EFF]' size={28} />
          </div>
        )}

        {step === 'unavailable' && (
          <div className='mt-16 bg-white rounded-3xl shadow-sm p-8 text-center'>
            <div className='h-14 w-14 mx-auto rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3'>
              <AlertCircle size={26} />
            </div>
            <p className='text-sm font-black text-slate-800 uppercase'>
              Quiz unavailable
            </p>
            <p className='text-[12px] font-bold text-slate-400 mt-1 max-w-sm mx-auto'>
              {errorMsg}
            </p>
            <button
              onClick={() => router.push('/')}
              className='mt-5 inline-flex items-center gap-2 h-11 px-6 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide'
            >
              Go to DSA <ArrowRight size={14} />
            </button>
          </div>
        )}

        {step === 'details' && (
          <div className='mt-10 bg-white rounded-3xl shadow-sm p-6 sm:p-8'>
            <p className='text-[10px] font-black uppercase tracking-widest text-[#FCB900]'>
              {locked ? 'Locked test · access code needed' : 'Free quiz'}
            </p>
            <h1 className='text-2xl font-black text-slate-900 tracking-tight mt-1'>
              {title}
            </h1>
            <p className='text-[12px] font-bold text-slate-400 mt-1'>
              {locked ? lockedCount : questions.length} question
              {(locked ? lockedCount : questions.length) === 1 ? '' : 's'}
              {minutes > 0 ? ` · ${minutes} min` : ''}
            </p>

            <div className='mt-6 space-y-3'>
              <div>
                <label className='text-[9px] font-black uppercase text-slate-400'>
                  Your name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='e.g. Amina Bello'
                  className='mt-1 w-full h-11 px-3 rounded-xl bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
                />
              </div>
              <div>
                <label className='text-[9px] font-black uppercase text-slate-400'>
                  Email <span className='text-slate-300'>· finds you on the leaderboard</span>
                </label>
                <input
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='you@example.com'
                  className='mt-1 w-full h-11 px-3 rounded-xl bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
                />
              </div>
              <div>
                <label className='text-[9px] font-black uppercase text-slate-400'>
                  Phone number
                </label>
                <input
                  type='tel'
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder='080…'
                  className='mt-1 w-full h-11 px-3 rounded-xl bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
                />
              </div>
              {locked && (
                <div>
                  <label className='text-[9px] font-black uppercase text-slate-400'>
                    Access code <span className='text-slate-300'>· sent to you after payment</span>
                  </label>
                  <input
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder='e.g. DSA-7K4PQ2'
                    autoCapitalize='characters'
                    autoComplete='off'
                    spellCheck={false}
                    className='mt-1 w-full h-11 px-3 rounded-xl bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-black tracking-wider uppercase'
                  />
                </div>
              )}
              <p className='text-[10px] font-bold text-slate-400'>
                You can only take this quiz <span className='text-[#002EFF]'>once</span> on
                this device.
              </p>
              {errorMsg && (
                <p className='text-[11px] font-bold text-rose-600'>{errorMsg}</p>
              )}
              <button
                onClick={() => void start()}
                disabled={unlocking}
                className='w-full flex items-center justify-center gap-2 h-12 bg-[#002EFF] text-white rounded-xl font-black text-[12px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60'
              >
                {unlocking ? 'Checking your code…' : locked ? 'Unlock and start' : 'Start quiz'}{' '}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {step === 'quiz' && (
          <div className='mt-4 space-y-3'>
            <p className='text-[11px] font-black uppercase tracking-widest text-slate-400'>
              {answered}/{questions.length} answered
            </p>

            {/* Question map — sticky on the SIDE (right) on wide screens. */}
            <aside className='hidden xl:block fixed right-4 top-24 w-44 max-h-[calc(100vh-8rem)] overflow-y-auto bg-white rounded-2xl shadow-sm p-3 z-30'>
              <p className='text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2'>
                Question map
              </p>
              <QuestionMap questions={questions} answers={answers} />
            </aside>

            {/* Anti-cheating notice */}
            <div
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 ${
                breaches > 0
                  ? 'bg-rose-50 border border-rose-200'
                  : 'bg-amber-50 border border-amber-100'
              }`}
            >
              <AlertTriangle
                size={15}
                className={
                  breaches > 0
                    ? 'text-rose-500 shrink-0'
                    : 'text-amber-600 shrink-0'
                }
              />
              <p
                className={`text-[11px] font-bold ${breaches > 0 ? 'text-rose-600' : 'text-amber-700'}`}
              >
                {breaches > 0
                  ? `Warning ${breaches}/${MAX_BREACHES} — leaving the quiz again will auto-submit it.`
                  : `Stay on this screen — no tab-switching, minimising or split-screen. The quiz auto-submits after ${MAX_BREACHES} warnings.`}
              </p>
            </div>

            {/* Blocking warning the moment they return after leaving. */}
            {showWarning && breaches > 0 && breaches <= MAX_BREACHES && (
              <div className='fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5'>
                <div className='w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center'>
                  <div className='h-16 w-16 mx-auto rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3'>
                    <AlertTriangle size={30} />
                  </div>
                  <p className='text-lg font-black text-slate-900'>
                    Warning {breaches} of {MAX_BREACHES}
                  </p>
                  <p className='text-[12px] font-bold text-slate-500 mt-2'>
                    You left the quiz screen. Don&apos;t switch tabs, minimise, or
                    open another app while taking the quiz.
                  </p>
                  <p className='text-[11px] font-black text-rose-600 mt-3'>
                    {MAX_BREACHES - breaches > 0
                      ? `${MAX_BREACHES - breaches} warning${
                          MAX_BREACHES - breaches === 1 ? '' : 's'
                        } left — the next leave after that auto-submits.`
                      : 'One more time and the quiz auto-submits.'}
                  </p>
                  <button
                    onClick={() => setShowWarning(false)}
                    className='mt-5 w-full h-11 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide active:scale-[0.98]'
                  >
                    Continue quiz
                  </button>
                </div>
              </div>
            )}

            {questions.map((q, i) => (
              <div
                key={q.questionId || i}
                id={`pq-${i}`}
                className='bg-white rounded-2xl shadow-sm p-4 scroll-mt-20'
              >
                <div className='flex items-start gap-2 mb-3'>
                  <span className='text-[11px] font-black text-[#002EFF]'>
                    {i + 1}.
                  </span>
                  <div className='flex-1 min-w-0'>
                    {q.subject && (
                      <span className='inline-block mb-1.5 text-[8px] font-black uppercase tracking-wide bg-blue-50 text-[#002EFF] px-1.5 py-0.5 rounded'>
                        {q.subject}
                      </span>
                    )}
                    <RichText className='text-[13px] font-bold text-slate-800'>
                      {q.questionText}
                    </RichText>
                    {q.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={q.imageUrl}
                        alt='Diagram for this question'
                        loading='lazy'
                        className='mt-2 rounded-xl max-h-60 max-w-full h-auto'
                      />
                    )}
                  </div>
                </div>
                <div className='space-y-1.5'>
                  {q.options.map((o, oi) => (
                    <button
                      key={oi}
                      onClick={() =>
                        setAnswers((a) => ({ ...a, [q.questionId]: oi }))
                      }
                      className={`w-full flex items-start gap-1.5 text-left px-3 py-2.5 rounded-xl text-[12px] font-bold border transition-all ${
                        answers[q.questionId] === oi
                          ? 'bg-[#002EFF] text-white border-[#002EFF]'
                          : 'bg-slate-50 text-slate-600 border-transparent hover:border-[#002EFF]/30'
                      }`}
                    >
                      <span className='font-black shrink-0'>{LETTERS[oi]}.</span>
                      <RichText inline className='flex-1 min-w-0 break-words'>
                        {o}
                      </RichText>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {errorMsg && (
              <p className='text-[11px] font-bold text-rose-600'>{errorMsg}</p>
            )}
            <button
              onClick={() => setConfirmSubmit(true)}
              disabled={submitting}
              className='w-full flex items-center justify-center gap-2 h-12 bg-[#002EFF] text-white rounded-xl font-black text-[12px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60'
            >
              {submitting ? (
                <Loader2 size={16} className='animate-spin' />
              ) : (
                <>Submit answers</>
              )}
            </button>

            {/* Floating calculator */}
            <button
              onClick={() => setShowCalc((v) => !v)}
              className='fixed bottom-6 right-6 z-40 h-12 w-12 rounded-2xl bg-[#002EFF] text-white shadow-xl flex items-center justify-center active:scale-95'
              title='Calculator'
            >
              <CalculatorIcon size={20} />
            </button>
            {showCalc && (
              <ScientificCalculator onClose={() => setShowCalc(false)} />
            )}

            {/* Mobile / tablet: floating toggle opens the question map as a
                side panel (kept off the top). Hidden on xl where the sticky
                sidebar is always visible. */}
            <button
              onClick={() => setShowMap(true)}
              className='xl:hidden fixed bottom-6 left-6 z-40 h-12 px-4 rounded-2xl bg-white text-[#002EFF] shadow-xl flex items-center gap-2 active:scale-95'
              title='Question map'
            >
              <LayoutGrid size={18} />
              <span className='text-[10px] font-black uppercase tracking-wide tabular-nums'>
                {answered}/{questions.length}
              </span>
            </button>
            {showMap && (
              <div className='xl:hidden fixed inset-0 z-50 flex'>
                <div
                  className='flex-1 bg-black/40'
                  onClick={() => setShowMap(false)}
                />
                <div className='w-64 max-w-[80%] h-full bg-white shadow-2xl p-4 overflow-y-auto'>
                  <div className='flex items-center justify-between mb-3'>
                    <p className='text-[10px] font-black uppercase tracking-widest text-slate-400'>
                      Question map
                    </p>
                    <button
                      onClick={() => setShowMap(false)}
                      className='h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500'
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <QuestionMap
                    questions={questions}
                    answers={answers}
                    onPick={() => setShowMap(false)}
                  />
                </div>
              </div>
            )}

            {/* Submit confirmation */}
            {confirmSubmit && (
              <div className='fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5'>
                <div className='w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 text-center'>
                  <div className='h-14 w-14 mx-auto rounded-2xl bg-blue-50 text-[#002EFF] flex items-center justify-center mb-3'>
                    <AlertCircle size={26} />
                  </div>
                  <p className='text-xl font-black text-slate-900 tracking-tight'>
                    Submit quiz?
                  </p>
                  <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1'>
                    Confirm your progress below
                  </p>
                  <div className='flex items-center justify-center gap-6 my-5'>
                    <div>
                      <p className='text-3xl font-black text-[#002EFF]'>
                        {answered}
                      </p>
                      <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
                        Solved
                      </p>
                    </div>
                    <div className='h-10 w-px bg-slate-200' />
                    <div>
                      <p className='text-3xl font-black text-rose-500'>
                        {questions.length - answered}
                      </p>
                      <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
                        Empty
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setConfirmSubmit(false)
                      submit(false)
                    }}
                    disabled={submitting}
                    className='w-full h-12 bg-[#002EFF] text-white rounded-2xl font-black text-[11px] uppercase tracking-wide active:scale-[0.98] disabled:opacity-60'
                  >
                    Confirm &amp; submit
                  </button>
                  <button
                    onClick={() => setConfirmSubmit(false)}
                    className='mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#002EFF]'
                  >
                    Review questions
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'result' && result && showCorrections && (
          <div className='mt-6'>
            <QuizCorrections
              data={correctionsData}
              onBack={() => setShowCorrections(false)}
            />
          </div>
        )}

        {step === 'result' && result && !showCorrections && (
          <div className='mt-8 space-y-4'>
            <div className='rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-center'>
              <p className='text-[11px] font-bold text-emerald-700'>
                {alreadyTaken
                  ? "You've already completed this quiz — here's your result."
                  : 'Here is your result. Download the report to keep a copy.'}
              </p>
            </div>
            {/* Actions up top, so they are seen without scrolling */}
            <div
              className={`grid gap-3 ${canShowCorrections ? 'sm:grid-cols-2' : ''}`}
            >
              {canShowCorrections && (
                <button
                  onClick={() => setShowCorrections(true)}
                  className='w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#002EFF] text-white font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all'
                >
                  <BookOpenCheck size={15} /> View corrections
                </button>
              )}

              <button
                onClick={downloadResult}
                className='w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-wide hover:bg-slate-200'
              >
                <Download size={15} /> Download report
              </button>
            </div>

            {/* Score + performance analysis */}
            <div className='bg-white rounded-3xl shadow-sm overflow-hidden'>
              <div className='p-7 text-center'>
                <div className='h-14 w-14 mx-auto rounded-2xl bg-slate-50 text-slate-700 flex items-center justify-center mb-3'>
                  <Target size={26} />
                </div>
                <p className='text-5xl font-black text-slate-900 leading-none'>
                  {pct}
                  <span className='text-2xl text-slate-400'>%</span>
                </p>
                <p className='text-[11px] font-black uppercase tracking-widest text-slate-400 mt-2'>
                  {band}
                </p>
                <p className='text-[11px] font-bold text-slate-400 mt-1'>
                  {name.split(' ')[0]}, you scored {result.totalScore}/
                  {result.totalMarks}
                </p>
              </div>
              {perSubject.length > 0 && (
                <div className='border-t border-slate-100 p-6 space-y-3'>
                  <p className='text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5'>
                    <BarChart3 size={12} /> Performance analysis
                  </p>
                  {perSubject.map(([subj, v]) => {
                    const sp = v.total ? Math.round((v.earned / v.total) * 100) : 0
                    return (
                      <div key={subj}>
                        <div className='flex items-center justify-between mb-1'>
                          <span className='text-[12px] font-black text-slate-700 uppercase'>
                            {subj}
                          </span>
                          <span
                            className={`text-[12px] font-black ${sp >= 50 ? 'text-emerald-600' : 'text-rose-500'}`}
                          >
                            {sp}%
                          </span>
                        </div>
                        <div className='h-1.5 bg-slate-100 rounded-full overflow-hidden'>
                          <div
                            className={`h-full rounded-full ${sp >= 50 ? 'bg-emerald-500' : 'bg-rose-400'}`}
                            style={{ width: `${sp}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* How they rank against everyone else who sat it */}
            {!boardHidden && (boardLoading || board.length > 0) && (
              <QuizLeaderboard
                entries={board}
                meEmailHash={myHash}
                meName={name}
                loading={boardLoading}
                subtitle='Everyone who has taken this quiz'
                me={{
                  score: pct,
                  bestScore: pct,
                  questionsAttempted: Object.keys(answers).length,
                  questionsTotal: questions.length,
                }}
              />
            )}

            {/* Join DSA → homepage */}
            <div className='rounded-3xl bg-[#002EFF] p-6 text-white text-center'>
              <Sparkles size={22} className='mx-auto text-[#FCB900] mb-2' />
              <p className='text-[13px] font-black'>Want more?</p>
              <p className='text-[11px] font-bold text-blue-100 mt-1'>
                Join Distinguished Scholars Academy for full courses, tutors,
                tracked progress and real exam prep.
              </p>
              <button
                onClick={() => router.push('/')}
                className='mt-4 inline-flex items-center gap-2 h-11 px-6 bg-[#FCB900] text-[#002EFF] rounded-xl font-black text-[11px] uppercase tracking-wide active:scale-95 transition-all'
              >
                Explore DSA <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
