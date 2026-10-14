'use client'

// Student quiz runner — list published quizzes, take one against a countdown
// timer (auto-submits at zero), then see the score + per-question breakdown.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  Clock,
  Play,
  CheckCircle2,
  ArrowLeft,
  AlertTriangle,
  Download,
  Eye,
  RotateCcw,
  Calculator as CalculatorIcon,
  AlertCircle,
  Target,
  Home,
  BarChart3,
  History,
  Lock,
  ListChecks,
  LayoutGrid,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import RichText from '@/components/ui/RichText'
import QuizCorrections, {
  type CorrectionsData,
} from '@/components/dashboard/QuizCorrections'
import QuizLeaderboard, {
  type LeaderboardRow,
} from '@/components/dashboard/QuizLeaderboard'
import { ScientificCalculator } from '@/app/rapid-quiz/components/Calculator'
import { dsaApi } from '@/lib/api'
import { getToken, getUser } from '@/lib/auth'
import {
  useEntitlements,
  refreshEntitlements,
} from '@/components/dashboard/useEntitlements'
import { resolveStudentProfile } from '@/lib/studentProfile'
import { quizMatchesProfile } from '@/lib/quizAudience'

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const
const str = (v: unknown) => (v == null ? '' : String(v))

interface RunQuestion {
  questionId: string
  subject: string
  questionText: string
  options: string[]
  imageUrl?: string
  marks: number
}
interface ResultData {
  totalScore: number
  totalMarks: number
  percentage: number
  breakdown: {
    questionId: string
    isCorrect: boolean
    marksEarned: number
    questionText?: string
  }[]
}

function mm(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ---- Resilient submit: persist in-progress + queue offline submissions ----
// If the tab is closed mid-quiz, the saved "active" attempt is submitted on the
// next open so the student can't just restart. If the network is off, the
// submission is queued and flushed when it comes back.
const QUIZ_ACTIVE_KEY = 'dsa-quiz-active'
const QUIZ_PENDING_KEY = 'dsa-quiz-pending'
type SubmitPayload = {
  timeTaken: number
  answers: { questionId: string; selectedOption: number }[]
  /** The sitting this submission belongs to: a retried send is not charged again. */
  sessionId?: string | null
}
type PendingSubmission = { quizId: string; payload: SubmitPayload }

// A full in-progress snapshot so an accidentally-abandoned quiz can be RESUMED
// (not restarted). The timer is wall-clock (startedAtMs), so leaving doesn't
// pause it — resume with the real remaining time, and finish if it ran out.
type ResumeSnapshot = {
  quizId: string
  quiz: Record<string, unknown>
  questions: RunQuestion[]
  answers: Record<string, number>
  startedAtMs: number
  totalTimeSec: number
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* storage unavailable — best effort */
  }
}
function clearKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
function isOffline(err?: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return err instanceof TypeError // fetch network failures surface as TypeError
}

export default function QuizRunner() {
  const token = getToken() ?? undefined
  const { entitlements: ent } = useEntitlements()
  // A free-plan student: paid quizzes are shown locked. Staff/tutors (and paid
  // students) are never on the free plan here.
  const freePlan = !!ent && !ent.unrestricted && ent.category === 'free'
  const [view, setView] = useState<'list' | 'take' | 'result' | 'history'>('list')
  const [quizzes, setQuizzes] = useState<Record<string, unknown>[]>([])
  const [myResults, setMyResults] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Active attempt
  const [quiz, setQuiz] = useState<Record<string, unknown> | null>(null)
  const [questions, setQuestions] = useState<RunQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [remaining, setRemaining] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ResultData | null>(null)
  const [savedOffline, setSavedOffline] = useState(false)
  const [resumable, setResumable] = useState<ResumeSnapshot | null>(null)
  const startedAt = useRef(0)
  const totalTime = useRef(0)
  // Anti-cheating: count times the student leaves the quiz (tab switch, minimise,
  // split-screen). Auto-submit after more than two.
  const [breaches, setBreaches] = useState(0)
  const breachRef = useRef(0)
  // The server sitting this quiz is being taken in (from POST /start).
  const sessionIdRef = useRef<string | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [showCorrections, setShowCorrections] = useState(false)
  // The full Correction Page opened from the result screen's Review button.
  const [reviewData, setReviewData] = useState<CorrectionsData | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  // Pagination while taking: how many questions to show per page (0 = all).
  const [perPage, setPerPage] = useState(0)
  const [page, setPage] = useState(0)
  const [showCalc, setShowCalc] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [showMap, setShowMap] = useState(false) // mobile question-map drawer
  // Leaderboard shown on the result screen (when the admin allows it).
  const [board, setBoard] = useState<LeaderboardRow[]>([])
  const [boardLoading, setBoardLoading] = useState(false)
  const MAX_BREACHES = 5

  // Open the full Correction Page for the quiz just submitted (same view as the
  // history "View corrections"), fed by GET /quizzes/:id/corrections/me.
  const openResultReview = async () => {
    const quizId = str(quiz?.id ?? quiz?._id)
    if (!quizId) return
    setReviewLoading(true)
    setReviewError(null)
    try {
      const data = (await dsaApi.quizzes.myCorrections(
        quizId,
        token,
      )) as CorrectionsData
      setReviewData(data)
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Could not load corrections.')
    } finally {
      setReviewLoading(false)
    }
  }

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, mine] = await Promise.all([
        dsaApi.quizzes.list(token) as Promise<Record<string, unknown>[]>,
        (dsaApi.quizzes.myResults(token).catch(() => [])) as Promise<
          Record<string, unknown>[]
        >,
      ])
      // Only show quizzes for this student's programme (+ department). Untargeted
      // quizzes remain visible to everyone. The backend may already scope this;
      // filtering here keeps it correct even when it returns the full set.
      const me = getUser()
      const profile = resolveStudentProfile(me ?? undefined)
      const myId = str(
        (me as Record<string, unknown> | null)?.id ??
          (me as Record<string, unknown> | null)?._id,
      )
      setQuizzes(
        rows.filter((q) => q.isActive && quizMatchesProfile(q, profile, myId)),
      )
      setMyResults(Array.isArray(mine) ? mine : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load quizzes.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (view === 'list') loadList()
  }, [view, loadList])

  // Countdown while taking.
  const submit = useCallback(
    async (auto = false) => {
      if (submitting || !quiz) return
      setSubmitting(true)
      setError(null)
      const id = str(quiz.id ?? quiz._id)
      const timeTaken = Math.max(1, Math.round((totalTime.current || 0) - remaining))
      const payload: SubmitPayload = {
        sessionId: sessionIdRef.current,
        timeTaken,
        answers: questions.map((q) => ({
          questionId: q.questionId,
          selectedOption:
            answers[q.questionId] === undefined ? -1 : answers[q.questionId],
        })),
      }
      try {
        const res = (await dsaApi.quizzes.submit(
          id,
          payload as never,
          token,
        )) as { data?: ResultData } | ResultData
        const data = (res as { data?: ResultData }).data ?? (res as ResultData)
        clearKey(QUIZ_ACTIVE_KEY)
        setResult(data)
        setView('result')
      } catch (e) {
        if (isOffline(e)) {
          // No network — queue the submission and finish. It's sent the moment
          // the connection returns, so the attempt still counts.
          const pending = readJSON<PendingSubmission[]>(QUIZ_PENDING_KEY, [])
          pending.push({ quizId: id, payload })
          writeJSON(QUIZ_PENDING_KEY, pending)
          clearKey(QUIZ_ACTIVE_KEY)
          setSavedOffline(true)
          setResult(null)
          setView('result')
        } else {
          setError(e instanceof Error ? e.message : 'Could not submit.')
          if (auto) setView('list')
        }
      } finally {
        setSubmitting(false)
      }
    },
    [submitting, quiz, remaining, questions, answers, token],
  )

  useEffect(() => {
    if (view !== 'take' || totalTime.current === 0) return
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id)
          submit(true)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [view, submit])

  // Continuously persist the in-progress attempt so a closed tab / crash doesn't
  // lose it — it's submitted on the next open instead of letting them restart.
  useEffect(() => {
    if (view !== 'take' || !quiz) return
    const snap: ResumeSnapshot = {
      quizId: str(quiz.id ?? quiz._id),
      quiz: {
        id: str(quiz.id ?? quiz._id),
        title: str(quiz.title),
        showResults: quiz.showResults !== false,
        showCorrections: quiz.showCorrections !== false,
      },
      questions,
      answers,
      startedAtMs: startedAt.current || Date.now(),
      totalTimeSec: totalTime.current || 0,
    }
    writeJSON(QUIZ_ACTIVE_KEY, snap)
  }, [view, quiz, questions, answers, remaining])

  // Retry any queued offline submissions (on mount + when back online).
  const flushPending = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const pending = readJSON<PendingSubmission[]>(QUIZ_PENDING_KEY, [])
    if (!pending.length) return
    const stillPending: PendingSubmission[] = []
    for (const p of pending) {
      try {
        await dsaApi.quizzes.submit(p.quizId, p.payload as never, token)
      } catch (e) {
        if (isOffline(e)) stillPending.push(p) // keep for the next retry
      }
    }
    writeJSON(QUIZ_PENDING_KEY, stillPending)
  }, [token])

  // On mount: flush the offline queue, and detect an in-progress attempt left by
  // navigating away. If its timer hasn't run out, offer to RESUME it; if it has,
  // submit whatever was answered.
  useEffect(() => {
    flushPending()
    const onOnline = () => flushPending()
    window.addEventListener('online', onOnline)

    const snap = readJSON<ResumeSnapshot | null>(QUIZ_ACTIVE_KEY, null)
    if (snap && Array.isArray(snap.questions) && snap.questions.length) {
      const elapsed = (Date.now() - (snap.startedAtMs || 0)) / 1000
      const remain = (snap.totalTimeSec || 0) - elapsed
      if (snap.totalTimeSec > 0 && remain <= 0) {
        // Time ran out while away — submit what they had.
        const payload: SubmitPayload = {
          timeTaken: snap.totalTimeSec,
          answers: snap.questions.map((q) => ({
            questionId: q.questionId,
            selectedOption:
              snap.answers?.[q.questionId] === undefined
                ? -1
                : snap.answers[q.questionId],
          })),
        }
        dsaApi.quizzes
          .submit(snap.quizId, payload as never, token)
          .catch((e) => {
            if (isOffline(e)) {
              const pending = readJSON<PendingSubmission[]>(QUIZ_PENDING_KEY, [])
              pending.push({ quizId: snap.quizId, payload })
              writeJSON(QUIZ_PENDING_KEY, pending)
            }
          })
          .finally(() => clearKey(QUIZ_ACTIVE_KEY))
      } else {
        setResumable(snap)
      }
    }
    return () => window.removeEventListener('online', onOnline)
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Register a "left the quiz" breach; auto-submits once past MAX_BREACHES.
  // Within the limit, raise a blocking warning modal so the student sees it the
  // moment they return (an inline banner is easy to miss, especially on mobile
  // where switching apps hides the page entirely).
  const registerBreach = useCallback(() => {
    breachRef.current += 1
    setBreaches(breachRef.current)
    if (breachRef.current > MAX_BREACHES) {
      submit(true)
    } else {
      setShowWarning(true)
    }
  }, [submit])

  // Anti-cheating: detect tab switches, minimising and split-screen (focus loss)
  // while taking. Dedupe leave/return so one exit counts once.
  useEffect(() => {
    if (view !== 'take') return
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
  }, [view, registerBreach])

  // Leaderboard for the result screen — only when the admin left it enabled.
  useEffect(() => {
    if (view !== 'result' || !quiz) return
    if (quiz.showLeaderboard === false) {
      setBoard([])
      return
    }
    let cancelled = false
    setBoardLoading(true)
    ;(async () => {
      try {
        const rows = (await dsaApi.quizzes.getLeaderboard(
          str(quiz.id ?? quiz._id),
          token,
        )) as unknown as LeaderboardRow[]
        if (!cancelled) setBoard(Array.isArray(rows) ? rows : [])
      } catch {
        if (!cancelled) setBoard([]) // disabled or unavailable — just hide it
      } finally {
        if (!cancelled) setBoardLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [view, quiz, token])

  const start = async (q: Record<string, unknown>) => {
    setError(null)
    setSavedOffline(false)
    setResult(null)
    const qid = str(q.id ?? q._id)
    const maxA = Number(q.maxAttempts) || 0
    // Enforce the attempt limit BEFORE loading any questions — re-check a fresh
    // count (the list can be stale right after a submit), so a student who's
    // used all attempts can't reopen the quiz only to be blocked at submit.
    if (maxA > 0) {
      try {
        const mine = (await dsaApi.quizzes.myResults(token)) as Record<
          string,
          unknown
        >[]
        const used = (Array.isArray(mine) ? mine : []).filter(
          (r) => !r.withdrawn && str(r.quizId) === qid,
        ).length
        if (used >= maxA) {
          setMyResults(Array.isArray(mine) ? mine : [])
          setError(
            'You have already used all your attempts for this quiz. Open "My History" to view your last attempt’s corrections.',
          )
          setView('list')
          return
        }
      } catch {
        /* couldn't check — the backend still blocks over-limit at submit */
      }
    }
    setLoading(true)
    try {
      const full = (await dsaApi.quizzes.get(qid, token)) as Record<
        string,
        unknown
      >
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
            imageUrl: qq.imageUrl ? str(qq.imageUrl) : undefined,
            marks: Number(qq.marks ?? qq.mark) || 1,
          })
        })
      })
      if (flat.length === 0) {
        setError('This quiz has no questions yet.')
        return
      }
      // Begin the sitting on the server: this uses one of the month's quiz
      // and test attempts (resuming an open one does not). Refused when the
      // month is used up — before any time is spent on the questions.
      try {
        const started = await dsaApi.quizzes.start(qid, token)
        sessionIdRef.current = started.sessionId ?? null
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start this quiz.')
        setView('list')
        return
      } finally {
        void refreshEntitlements()
      }
      setQuiz(full)
      setQuestions(flat)
      setAnswers({})
      setResult(null)
      breachRef.current = 0
      setBreaches(0)
      setShowWarning(false)
      setShowCorrections(false)
      setPage(0)
      setShowCalc(false)
      setConfirmSubmit(false)
      const secs = (minutes || Number(full.timeLimit) || 0) * 60
      totalTime.current = secs
      setRemaining(secs)
      startedAt.current = Date.now()
      setResumable(null)
      setView('take')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the quiz.')
    } finally {
      setLoading(false)
    }
  }

  // Resume an in-progress attempt left by navigating away, with the real
  // remaining time (the clock kept running while away).
  const resume = (snap: ResumeSnapshot) => {
    setError(null)
    setSavedOffline(false)
    setResult(null)
    setQuiz(snap.quiz)
    setQuestions(snap.questions)
    setAnswers(snap.answers || {})
    breachRef.current = 0
    setBreaches(0)
    setShowWarning(false)
    setShowCorrections(false)
    setPage(0)
    setShowCalc(false)
    setConfirmSubmit(false)
    totalTime.current = snap.totalTimeSec || 0
    startedAt.current = snap.startedAtMs || Date.now()
    const elapsed = (Date.now() - startedAt.current) / 1000
    setRemaining(
      snap.totalTimeSec > 0
        ? Math.max(1, Math.round(snap.totalTimeSec - elapsed))
        : 0,
    )
    setResumable(null)
    setView('take')
  }

  // ---------- RESULT ----------
  if (view === 'result' && savedOffline) {
    return (
      <div className='max-w-2xl mx-auto'>
        <Card className='p-8 rounded-4xl border-none shadow-sm bg-white text-center'>
          <AlertCircle size={40} className='mx-auto text-amber-500 mb-2' />
          <p className='text-sm font-black text-slate-800 uppercase'>
            Saved — you&apos;re offline
          </p>
          <p className='text-[12px] font-bold text-slate-400 mt-1 max-w-sm mx-auto'>
            Your answers for “{str(quiz?.title)}” are saved on this device and
            will be submitted automatically as soon as you&apos;re back online.
            Don&apos;t retake it.
          </p>
          <button
            onClick={() => {
              setSavedOffline(false)
              setView('list')
            }}
            className='mt-5 inline-flex items-center gap-2 text-[11px] font-black uppercase text-[#002EFF]'
          >
            <ArrowLeft size={14} /> Back to quizzes
          </button>
        </Card>
      </div>
    )
  }

  if (view === 'result' && result) {
    // The Review button opens the full Correction Page over the result screen.
    if (reviewData) {
      return (
        <QuizCorrections data={reviewData} onBack={() => setReviewData(null)} />
      )
    }
    // Compute from marks so it's correct regardless of how the API scales
    // `percentage` (it returns a 0–1 ratio, not 0–100).
    const pct =
      result.totalMarks > 0
        ? Math.round((result.totalScore / result.totalMarks) * 100)
        : 0

    // Admin can hide the score, corrections and/or leaderboard for a quiz.
    const canSeeResults = quiz?.showResults !== false
    const canSeeCorrections = quiz?.showCorrections !== false && canSeeResults
    const canSeeBoard = quiz?.showLeaderboard !== false
    const meUser = getUser() as
      | (Record<string, unknown> & { fullName?: string; username?: string })
      | null
    const meId = meUser ? str(meUser.id ?? meUser._id) : null
    const meName = meUser?.fullName || meUser?.username || null

    // When results are hidden, just confirm the submission.
    if (!canSeeResults) {
      return (
        <div className='max-w-2xl mx-auto'>
          <Card className='p-8 rounded-4xl border-none shadow-sm bg-white text-center'>
            <CheckCircle2 size={40} className='mx-auto text-emerald-500 mb-2' />
            <p className='text-sm font-black text-slate-800 uppercase'>
              Answers submitted
            </p>
            <p className='text-[12px] font-bold text-slate-400 mt-1'>
              Your results for “{str(quiz?.title)}” are not shown here.
            </p>
            <button
              onClick={() => setView('list')}
              className='mt-5 inline-flex items-center gap-2 text-[11px] font-black uppercase text-[#002EFF]'
            >
              <ArrowLeft size={14} /> Back to quizzes
            </button>
          </Card>
        </div>
      )
    }

    // Their best run at this quiz — previous attempts plus the one just made.
    const quizId = str(quiz?.id ?? quiz?._id)
    const bestPctForThisQuiz = myResults.reduce((best, r) => {
      if (r.withdrawn || str(r.quizId) !== quizId) return best
      // percentage is stored as a fraction (0–1) by the API.
      const raw = Number(r.percentage)
      if (!isFinite(raw) || raw <= 0) return best
      const p = Math.round(raw <= 1 ? raw * 100 : raw)
      return p > best ? p : best
    }, pct)

    // Per-subject scores: join the breakdown (by questionId) onto the questions
    // we took (which carry the subject) and total the marks per subject.
    const marksById = new Map(
      (result.breakdown ?? []).map((b) => [b.questionId, b] as const),
    )
    const perSubject = new Map<
      string,
      { earned: number; total: number; correct: number; count: number }
    >()
    questions.forEach((q) => {
      const subj = q.subject || 'General'
      const row = perSubject.get(subj) ?? {
        earned: 0,
        total: 0,
        correct: 0,
        count: 0,
      }
      const b = marksById.get(q.questionId)
      row.total += q.marks || 1
      row.count += 1
      if (b) {
        row.earned += b.marksEarned || 0
        if (b.isCorrect) row.correct += 1
      }
      perSubject.set(subj, row)
    })
    const subjects = [...perSubject.entries()]

    const downloadResult = () => {
      const rows = subjects
        .map(
          ([name, s]) =>
            `<tr><td>${name}</td><td>${s.earned}/${s.total}</td><td>${
              s.total ? Math.round((s.earned / s.total) * 100) : 0
            }%</td></tr>`,
        )
        .join('')
      const html = `<!doctype html><meta charset="utf-8"><title>Quiz Result</title>
<body style="font-family:system-ui,Arial;max-width:640px;margin:2rem auto;color:#0f172a">
<h1 style="color:#002EFF">${str(quiz?.title) || 'Quiz'} — Result</h1>
<p><b>${getUser()?.fullName || getUser()?.username || 'Student'}</b></p>
<p style="font-size:2rem;font-weight:800">${pct}% <span style="font-size:1rem;color:#64748b">(${result.totalScore}/${result.totalMarks} marks)</span></p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
<thead><tr style="background:#f1f5f9"><th align="left">Subject</th><th align="left">Score</th><th align="left">%</th></tr></thead>
<tbody>${rows}</tbody></table>
<p style="color:#94a3b8;font-size:.8rem;margin-top:1rem">Distinguished Scholars Academy</p>
</body>`
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${(str(quiz?.title) || 'quiz').replace(/[^\w]+/g, '-')}-result.html`
      a.click()
      URL.revokeObjectURL(url)
    }

    const band =
      pct >= 75
        ? 'Excellent!'
        : pct >= 50
          ? 'Well done'
          : pct >= 40
            ? 'Keep going'
            : 'Practice required'
    return (
      <div className='max-w-2xl mx-auto space-y-5'>
        {/* Score + performance analysis card */}
        <Card className='rounded-4xl border-none shadow-sm bg-white overflow-hidden'>
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
              {result.totalScore} / {result.totalMarks} marks
            </p>
          </div>

          {subjects.length > 0 && (
            <div className='border-t border-slate-100 p-6 space-y-3'>
              <p className='text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5'>
                <BarChart3 size={12} /> Performance analysis
              </p>
              {subjects.map(([name, s]) => {
                const sp = s.total ? Math.round((s.earned / s.total) * 100) : 0
                return (
                  <div key={name}>
                    <div className='flex items-center justify-between mb-1'>
                      <span className='text-[12px] font-black text-slate-700 uppercase'>
                        {name}
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
        </Card>

        {/* Actions — Review / Report, then Try again / Dashboard */}
        <div className='grid grid-cols-2 gap-2'>
          {canSeeCorrections ? (
            <button
              onClick={openResultReview}
              disabled={reviewLoading}
              className='flex items-center justify-center gap-2 h-12 rounded-2xl bg-slate-900 text-white font-black text-[11px] uppercase tracking-wide active:scale-[0.98] disabled:opacity-60'
            >
              {reviewLoading ? (
                <Loader2 size={15} className='animate-spin' />
              ) : (
                <Eye size={15} />
              )}
              Review
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={downloadResult}
            className={`flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#002EFF] text-white font-black text-[11px] uppercase tracking-wide active:scale-[0.98] ${canSeeCorrections ? '' : 'col-span-2'}`}
          >
            <Download size={15} /> Report
          </button>
          <button
            onClick={() => quiz && start(quiz)}
            className='flex items-center justify-center gap-2 h-11 rounded-2xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-wide hover:text-[#002EFF]'
          >
            <RotateCcw size={14} /> Try again
          </button>
          <button
            onClick={() => setView('list')}
            className='flex items-center justify-center gap-2 h-11 rounded-2xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-wide hover:text-[#002EFF]'
          >
            <Home size={14} /> Dashboard
          </button>
        </div>

        {/* Leaderboard — hidden when the admin turns it off for this quiz */}
        {canSeeBoard && (boardLoading || board.length > 0) && (
          <QuizLeaderboard
            entries={board}
            meId={meId}
            meName={meName}
            loading={boardLoading}
            subtitle='How you rank on this quiz'
            me={{
              score: pct,
              // Their best across every attempt at this quiz, this one included.
              bestScore: bestPctForThisQuiz,
              questionsAttempted: result.breakdown?.length ?? questions.length,
              questionsTotal: questions.length,
            }}
          />
        )}

        {reviewError && (
          <p className='text-[11px] font-bold text-rose-600 px-1'>{reviewError}</p>
        )}
      </div>
    )
  }

  // ---------- TAKING ----------
  if (view === 'take') {
    const answered = Object.keys(answers).length
    // Pagination: show `perPage` questions at a time (0 = all on one page).
    const pp = perPage > 0 ? perPage : questions.length || 1
    const pageCount = Math.max(1, Math.ceil(questions.length / pp))
    const curPage = Math.min(page, pageCount - 1)
    const startIdx = curPage * pp
    const visible = questions
      .map((q, i) => ({ q, i }))
      .slice(startIdx, startIdx + pp)
    const paginated = perPage > 0 && pageCount > 1
    const onLastPage = curPage >= pageCount - 1

    // Jump to a question from the map: switch to its page (if paginated), then
    // scroll it into view.
    const jumpTo = (i: number) => {
      const target = Math.floor(i / pp)
      const changing = target !== curPage
      if (changing) setPage(target)
      setShowMap(false)
      setTimeout(
        () =>
          document
            .getElementById(`pq-${i}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        changing ? 90 : 0,
      )
    }

    // Group question numbers by subject (JAMB-style subject navigation).
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
    // The palette — blue = answered, amber ring = on the current page.
    const mapGrid = (
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
                const onPage = i >= startIdx && i < startIdx + pp
                return (
                  <button
                    key={q.questionId || i}
                    onClick={() => jumpTo(i)}
                    title={done ? 'Answered' : 'Not answered'}
                    className={`h-8 w-8 rounded-lg text-[11px] font-black flex items-center justify-center ${
                      done ? 'bg-[#002EFF] text-white' : 'bg-slate-100 text-slate-500'
                    } ${onPage ? 'ring-2 ring-[#FCB900]' : ''}`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )

    return (
      <div className='max-w-2xl mx-auto space-y-4'>
        <div className='sticky top-0 z-10 flex items-center justify-between bg-white/90 backdrop-blur rounded-2xl px-4 py-3 shadow-sm'>
          <div>
            <p className='text-sm font-black text-slate-800 truncate'>
              {str(quiz?.title)}
            </p>
            <p className='text-[10px] font-bold text-slate-400'>
              {answered}/{questions.length} answered
              {paginated ? ` · page ${curPage + 1}/${pageCount}` : ''}
            </p>
          </div>
          <label className='flex items-center gap-1 text-[9px] font-black uppercase text-slate-400'>
            Per page
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value))
                setPage(0)
              }}
              className='h-7 px-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-black text-slate-600 outline-none'
            >
              <option value={0}>All</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </label>
          {totalTime.current > 0 && (
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black tabular-nums text-sm ${
                remaining < 60
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-blue-50 text-[#002EFF]'
              }`}
            >
              <Clock size={15} /> {mm(remaining)}
            </span>
          )}
        </div>

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
            className={breaches > 0 ? 'text-rose-500 shrink-0' : 'text-amber-600 shrink-0'}
          />
          <p
            className={`text-[11px] font-bold ${breaches > 0 ? 'text-rose-600' : 'text-amber-700'}`}
          >
            {breaches > 0
              ? `Warning ${breaches}/${MAX_BREACHES} — leaving the quiz again will auto-submit it.`
              : `Stay on this screen — no tab-switching, minimising or split-screen. The quiz auto-submits after ${MAX_BREACHES} warnings.`}
          </p>
        </div>

        {/* Blocking warning shown the moment the student returns after leaving.
            A full-screen modal so it can't be missed (esp. on mobile). */}
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
                You left the quiz screen. Don&apos;t switch tabs, minimise, or open
                another app while taking the quiz.
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

        {error && <p className='text-[11px] font-bold text-rose-600 px-1'>{error}</p>}

        {visible.map(({ q, i }) => (
          <Card
            key={q.questionId}
            id={`pq-${i}`}
            className='p-4 rounded-2xl border-none shadow-sm bg-white scroll-mt-24'
          >
            <div className='flex items-start gap-2 mb-3'>
              <span className='text-[11px] font-black text-[#002EFF]'>{i + 1}.</span>
              <div className='flex-1'>
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
                    alt='question'
                    className='mt-2 rounded-xl max-h-52'
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
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left text-[13px] font-medium transition-colors ${
                    answers[q.questionId] === oi
                      ? 'bg-[#002EFF] text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className='font-black shrink-0'>{LETTERS[oi]}</span>
                  <RichText inline className='flex-1 min-w-0 break-words'>
                    {o}
                  </RichText>
                </button>
              ))}
            </div>
          </Card>
        ))}

        {/* Page navigation (only when paginated) */}
        {paginated && (
          <div className='flex items-center justify-between gap-2'>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={curPage === 0}
              className='h-10 px-4 rounded-xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-wide disabled:opacity-40'
            >
              ← Prev
            </button>
            <span className='text-[10px] font-black text-slate-400'>
              Page {curPage + 1} of {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={onLastPage}
              className='h-10 px-4 rounded-xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-wide disabled:opacity-40'
            >
              Next →
            </button>
          </div>
        )}

        {/* Submit — always available, but only after the last page when paginated */}
        {(!paginated || onLastPage) && (
          <button
            onClick={() => setConfirmSubmit(true)}
            disabled={submitting}
            className='w-full flex items-center justify-center gap-2 h-12 bg-[#002EFF] text-white rounded-2xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 disabled:opacity-50'
          >
            {submitting ? (
              <Loader2 size={16} className='animate-spin' />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Submit quiz
          </button>
        )}

        {/* Floating calculator toggle + the draggable calculator */}
        <button
          onClick={() => setShowCalc((v) => !v)}
          className='fixed bottom-6 right-6 z-40 h-12 w-12 rounded-2xl bg-[#002EFF] text-white shadow-xl flex items-center justify-center active:scale-95'
          title='Calculator'
        >
          <CalculatorIcon size={20} />
        </button>
        {showCalc && <ScientificCalculator onClose={() => setShowCalc(false)} />}

        {/* Question map — sticky on the SIDE on wide screens. */}
        <aside className='hidden xl:block fixed right-4 top-24 w-44 max-h-[calc(100vh-8rem)] overflow-y-auto bg-white rounded-2xl shadow-sm p-3 z-30'>
          <p className='text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2'>
            Question map
          </p>
          {mapGrid}
        </aside>

        {/* Mobile / tablet: floating toggle opens the map as a side panel. */}
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
              {mapGrid}
            </div>
          </div>
        )}

        {/* Submit confirmation */}
        {confirmSubmit && (
          <div className='fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5'>
            <div className='w-full max-w-sm bg-white rounded-4xl shadow-2xl p-7 text-center'>
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
                  <p className='text-3xl font-black text-[#002EFF]'>{answered}</p>
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
    )
  }

  // ---------- HISTORY ----------
  if (view === 'history') {
    return <QuizHistory results={myResults} onBack={() => setView('list')} />
  }

  // ---------- LIST ----------
  // Count each quiz's completed (non-withdrawn) attempts by this student.
  const attemptsByQuiz: Record<string, number> = {}
  myResults.forEach((r) => {
    if (r.withdrawn) return
    const qid = str(r.quizId)
    attemptsByQuiz[qid] = (attemptsByQuiz[qid] || 0) + 1
  })

  return (
    <div className='max-w-2xl mx-auto space-y-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
            Quizzes
          </h2>
          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
            Take a CBT and see your score instantly
          </p>
        </div>
        <button
          onClick={() => setView('history')}
          className='flex items-center gap-1.5 h-9 px-3 rounded-xl bg-blue-50 text-[#002EFF] font-black text-[10px] uppercase tracking-wide hover:bg-blue-100 shrink-0'
        >
          <History size={13} /> My History
        </button>
      </div>

      {resumable && (
        <Card className='p-4 rounded-2xl border-none shadow-sm bg-[#002EFF] text-white flex items-center gap-3'>
          <RotateCcw size={18} className='shrink-0' />
          <div className='min-w-0 flex-1'>
            <p className='text-xs font-black truncate'>
              You have a quiz in progress
            </p>
            <p className='text-[10px] font-bold text-blue-100 truncate'>
              {str(resumable.quiz?.title) || 'Quiz'} — pick up where you left off.
            </p>
          </div>
          <button
            onClick={() => resume(resumable)}
            className='h-9 px-4 rounded-xl bg-[#FCB900] text-[#002EFF] font-black text-[10px] uppercase tracking-wide hover:bg-yellow-400 shrink-0'
          >
            Resume
          </button>
        </Card>
      )}

      {error && <p className='text-[11px] font-bold text-rose-600 px-1'>{error}</p>}
      {loading ? (
        <div className='py-10 flex justify-center'>
          <Loader2 className='animate-spin text-[#002EFF]' />
        </div>
      ) : quizzes.length === 0 ? (
        <p className='text-[11px] font-bold text-slate-400 py-8 text-center'>
          No quizzes available right now. Check back soon.
        </p>
      ) : (
        <>
          {quizzes.map((q) => {
          const subjects = Array.isArray(q.subjects) ? q.subjects : []
          const qCount = subjects.reduce(
            (n: number, s: Record<string, unknown>) =>
              n + (Array.isArray(s.questions) ? s.questions.length : 0),
            0,
          )
          const mins = subjects.reduce(
            (n: number, s: Record<string, unknown>) => n + (Number(s.timeLimit) || 0),
            0,
          )
          const qid = str(q.id ?? q._id)
          const maxAttempts = Number(q.maxAttempts) || 0
          const used = attemptsByQuiz[qid] || 0
          const limitReached = maxAttempts > 0 && used >= maxAttempts
          const paidLocked = freePlan && q.paid === true
          return (
            <Card
              key={qid}
              className='p-4 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3'
            >
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-black text-slate-800 flex items-center gap-1.5 min-w-0'>
                  {/* truncate must sit on the text itself — a flex parent can't
                      truncate, which pushed long titles past the viewport. */}
                  <span className='truncate'>{str(q.title)}</span>
                  {q.paid === true && (
                    <span className='text-[8px] font-black uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0'>
                      Paid
                    </span>
                  )}
                  {used > 0 && (
                    <span className='text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0'>
                      Taken
                    </span>
                  )}
                </p>
                <p className='text-[10px] font-bold text-slate-400 break-words'>
                  {qCount} question{qCount === 1 ? '' : 's'}
                  {mins > 0 && ` · ${mins} min`}
                  {' · '}
                  {str(q.totalMarks) || 0} marks
                  {maxAttempts > 0 && ` · ${used}/${maxAttempts} attempt${maxAttempts === 1 ? '' : 's'}`}
                </p>
              </div>
              {paidLocked ? (
                <a
                  href='/dashboard?tab=unlock'
                  className='shrink-0 flex items-center gap-1.5 h-10 px-4 bg-amber-50 text-amber-700 rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-amber-100 transition-colors'
                  title='This quiz is for paid plans'
                >
                  <Lock size={14} /> Upgrade
                </a>
              ) : limitReached ? (
                <span
                  className='shrink-0 flex items-center gap-1.5 h-10 px-4 bg-slate-100 text-slate-400 rounded-xl font-black text-[11px] uppercase tracking-wide cursor-not-allowed'
                  title='You have used all your attempts for this quiz'
                >
                  <Lock size={14} /> Done
                </span>
              ) : (
                <button
                  onClick={() => start(q)}
                  className='shrink-0 flex items-center gap-1.5 h-10 px-4 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 transition-colors'
                >
                  <Play size={14} /> {used > 0 ? 'Retake' : 'Start'}
                </button>
              )}
            </Card>
          )
          })}
        </>
      )}
    </div>
  )
}

/* ---------- Quiz history — the student's past submissions ---------- */
function QuizHistory({
  results,
  onBack,
}: {
  results: Record<string, unknown>[]
  onBack: () => void
}) {
  const [reviewing, setReviewing] = useState<CorrectionsData | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [reviewErr, setReviewErr] = useState<string | null>(null)

  const openCorrections = async (quizId: string) => {
    if (!quizId) return
    setLoadingId(quizId)
    setReviewErr(null)
    try {
      const data = (await dsaApi.quizzes.myCorrections(
        quizId,
        getToken() ?? undefined,
      )) as CorrectionsData
      setReviewing(data)
    } catch (e) {
      setReviewErr(
        e instanceof Error ? e.message : 'Could not load corrections.',
      )
    } finally {
      setLoadingId(null)
    }
  }

  if (reviewing) {
    return <QuizCorrections data={reviewing} onBack={() => setReviewing(null)} />
  }

  const fmtDate = (v: unknown) => {
    const d = new Date(str(v))
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-NG', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
  }
  const pctOf = (v: unknown) => {
    const n = Number(v) || 0
    return Math.round(n <= 1 ? n * 100 : n)
  }

  return (
    <div className='max-w-2xl mx-auto space-y-4'>
      <div className='flex items-center gap-3'>
        <button
          onClick={onBack}
          className='h-9 w-9 flex items-center justify-center rounded-xl bg-blue-50 text-[#002EFF] hover:bg-blue-100 shrink-0'
          title='Back to quizzes'
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
            Quiz History
          </h2>
          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
            Your past quizzes and scores
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <Card className='p-10 rounded-2xl border-none shadow-sm bg-white flex flex-col items-center gap-2 text-center'>
          <History size={28} className='text-slate-300' />
          <p className='text-sm font-black text-slate-600'>No quizzes yet</p>
          <p className='text-[11px] font-bold text-slate-400'>
            Quizzes you complete will show up here with your score.
          </p>
        </Card>
      ) : (
        <>
          {reviewErr && (
            <p className='text-[11px] font-bold text-rose-600 px-1'>{reviewErr}</p>
          )}
          {results.map((r) => {
            const pct = pctOf(r.percentage)
            const good = pct >= 70
            const withdrawn = Boolean(r.withdrawn)
            const quizId = str(r.quizId)
            // Corrections available unless the quiz owner turned them off.
            const canReview = !withdrawn && r.showCorrections !== false && !!quizId
            return (
              <Card
                key={str(r.id)}
                className='p-4 rounded-2xl border-none shadow-sm bg-white space-y-3'
              >
                <div className='flex items-center gap-3'>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-black text-slate-800 truncate flex items-center gap-1.5'>
                      {str(r.quizTitle) || 'Quiz'}
                      {withdrawn && (
                        <span className='text-[8px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0'>
                          Withdrawn
                        </span>
                      )}
                    </p>
                    <p className='text-[10px] font-bold text-slate-400'>
                      {str(r.totalScore) || 0}/{str(r.totalMarks) || 0} marks
                      {r.submittedAt ? ` · ${fmtDate(r.submittedAt)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-black px-3 py-1.5 rounded-xl shrink-0 ${
                      withdrawn
                        ? 'bg-slate-100 text-slate-400'
                        : good
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-rose-50 text-rose-500'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
                {canReview && (
                  <div className='pt-2 border-t border-slate-50 flex justify-end'>
                    <button
                      onClick={() => openCorrections(quizId)}
                      disabled={loadingId === quizId}
                      className='inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-50 text-[#002EFF] font-black text-[10px] uppercase tracking-wide hover:bg-blue-100 disabled:opacity-50'
                    >
                      {loadingId === quizId ? (
                        <Loader2 size={13} className='animate-spin' />
                      ) : (
                        <ListChecks size={13} />
                      )}
                      View corrections
                    </button>
                  </div>
                )}
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}

