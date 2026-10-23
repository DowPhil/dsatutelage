'use client'

// The exam screen. Two styles, decided by the server when the session starts:
//  - practice (session.reveal): tapping an option marks it at once, shows the
//    answer and explanation, and locks it.
//  - exam: one timer for the whole session, answers hidden until submit, the
//    question grid, flags and a calculator. Answers are saved to the server as
//    the student goes, so they can leave and continue on any device.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, Calculator, Flag, Grid3x3, WifiOff } from 'lucide-react'
import { dsaApi } from '@/lib/api'
import { CBT_REPORT_REASONS, type CbtAnswerResult, type CbtResult, type CbtSession } from '@/lib/cbt-types'
import { DIFF_LABEL, Figure, LETTERS, Passage, Sheet, btn, btnAlt, chip, chipOn, clock, firstName, initials } from './shared'

type SheetKind = null | 'grid' | 'submit' | 'exit' | 'calc' | 'report'

export default function Runner({
  session,
  name,
  savedIds,
  reportedIds,
  onSaveToggle,
  onReported,
  onFinished,
  onLeave,
  toast,
}: {
  session: CbtSession
  name: string
  savedIds: Set<string>
  reportedIds: Set<string>
  onSaveToggle: (questionId: string) => void
  onReported: (questionId: string) => void
  onFinished: (result: CbtResult) => void
  onLeave: () => void
  toast: (text: string) => void
}) {
  const n = session.questions.length
  const exam = !session.reveal
  const [i, setI] = useState(Math.min(session.position || 0, n - 1))
  const [answers, setAnswers] = useState<(number | null)[]>(session.answers)
  const [flagged, setFlagged] = useState<boolean[]>(session.flagged)
  const [revealed, setRevealed] = useState<Record<number, CbtAnswerResult>>(() => {
    // Practice answers given before leaving come back with their answer key.
    const r: Record<number, CbtAnswerResult> = {}
    session.questions.forEach((q, k) => {
      const choice = session.answers[k]
      if (q.answer !== undefined && choice !== null && choice !== undefined) {
        r[k] = { index: k, choice, answer: q.answer, correct: choice === q.answer, explanation: q.explanation || '' }
      }
    })
    return r
  })
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(true)
  const [gridSubject, setGridSubject] = useState('')

  // Timer, corrected for the gap between this phone's clock and the server's.
  const skew = useMemo(() => new Date(session.serverNow).getTime() - Date.now(), [session.serverNow])
  const endsAt = session.endsAt ? new Date(session.endsAt).getTime() : 0
  const left = () => Math.max(0, Math.round((endsAt - (Date.now() + skew)) / 1000))
  const [secs, setSecs] = useState(exam && endsAt ? left() : 0)

  const q = session.questions[i]
  const subjects = useMemo(() => [...new Set(session.questions.map((x) => x.subject))], [session.questions])
  const idsIn = (s: string) => session.questions.map((_, k) => k).filter((k) => session.questions[k].subject === s)
  const inSubject = idsIn(q.subject)
  const pos = inSubject.indexOf(i) + 1
  const lastInSubject = pos === inSubject.length
  const lastSubject = subjects.indexOf(q.subject) === subjects.length - 1
  const answered = answers.filter((a) => a !== null && a !== undefined).length

  // ── Saving ──
  const pending = useRef<{ answers?: (number | null)[]; flagged?: boolean[]; position?: number }>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = useCallback(async () => {
    const body = pending.current
    pending.current = {}
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (!Object.keys(body).length) return
    try {
      const r = await dsaApi.cbt.save(session.id, body)
      if (r.submitted && r.result) onFinished(r.result)
    } catch {
      // Offline or a blip: keep it and try again with the next change.
      pending.current = { ...body, ...pending.current }
    }
  }, [session.id, onFinished])
  const queue = useCallback(
    (part: typeof pending.current) => {
      pending.current = { ...pending.current, ...part }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => void flush(), 800)
    },
    [flush],
  )
  useEffect(() => () => void flush(), [flush])

  useEffect(() => {
    const up = () => {
      setOnline(true)
      void flush()
    }
    const down = () => setOnline(false)
    setOnline(navigator.onLine)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [flush])

  // ── Finishing ──
  const finishing = useRef(false)
  const finish = useCallback(
    async (auto = false) => {
      if (finishing.current) return
      finishing.current = true
      setBusy(true)
      try {
        const r = await dsaApi.cbt.submit(session.id, { answers: exam ? answers : undefined, auto })
        onFinished(r)
      } catch (e) {
        finishing.current = false
        setBusy(false)
        toast(e instanceof Error ? e.message : 'Could not submit. Check your connection and try again.')
      }
    },
    [session.id, exam, answers, onFinished, toast],
  )

  useEffect(() => {
    if (!exam || !endsAt) return
    const warned = new Set<number>()
    const id = setInterval(() => {
      const s = left()
      setSecs(s)
      ;[600, 300, 60].forEach((w) => {
        if (s <= w && s > w - 2 && !warned.has(w)) {
          warned.add(w)
          toast(`${w / 60} minute${w > 60 ? 's' : ''} left`)
        }
      })
      if (s <= 0) {
        clearInterval(id)
        toast('Time is up. Submitting your answers.')
        void finish(true)
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, endsAt, finish])

  // ── Moving ──
  const goTo = (k: number) => {
    const next = Math.max(0, Math.min(n - 1, k))
    setI(next)
    queue({ position: next })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const next = () => {
    if (!lastInSubject) goTo(inSubject[pos])
    else if (!lastSubject) goTo(idsIn(subjects[subjects.indexOf(q.subject) + 1])[0])
  }
  const prev = () => {
    if (pos > 1) goTo(inSubject[pos - 2])
  }

  const choose = async (choice: number) => {
    if (exam) {
      const a = answers.map((x, k) => (k === i ? choice : x))
      setAnswers(a)
      queue({ answers: a })
      return
    }
    if (revealed[i] || busy) return
    setBusy(true)
    try {
      const r = await dsaApi.cbt.answer(session.id, i, choice)
      setRevealed((p) => ({ ...p, [i]: r }))
      setAnswers((p) => p.map((x, k) => (k === i ? r.choice : x)))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not check that answer. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const toggleFlag = () => {
    const f = flagged.map((x, k) => (k === i ? !x : x))
    setFlagged(f)
    queue({ flagged: f })
  }

  const chosen = answers[i]
  const shown = revealed[i]
  const isLast = lastInSubject && lastSubject

  return (
    <div className='mx-auto max-w-3xl pb-40'>
      {!online && (
        <div className='mb-3 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-[12px] font-bold text-amber-800'>
          <WifiOff size={14} /> You’re offline. Your answers will be saved when you reconnect.
        </div>
      )}

      <div className='mb-3 flex items-center gap-2'>
        <span className='flex h-9 w-9 items-center justify-center rounded-full bg-[#002EFF] text-[12px] font-black text-white'>
          {initials(name)}
        </span>
        <p className='min-w-0'>
          <b className='block truncate text-[13px] font-black text-slate-800 dark:text-white'>{name}</b>
          <small className='block truncate text-[11px] text-slate-500'>{session.label}</small>
        </p>
      </div>

      <div className='mb-4 flex items-center gap-3'>
        <button type='button' className='text-[13px] font-bold text-slate-500' onClick={() => setSheet('exit')}>
          Exit
        </button>
        <div className='h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800'>
          <div className='h-full rounded-full bg-[#002EFF]' style={{ width: `${((i + 1) / n) * 100}%` }} />
        </div>
        <span
          className={`rounded-xl px-2.5 py-1 font-mono text-[14px] font-black ${
            exam && secs <= 300 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200'
          }`}
          aria-live='off'
        >
          {exam && endsAt ? clock(secs) : `${i + 1}/${n}`}
        </span>
      </div>

      {subjects.length > 1 && (
        <div className='-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1'>
          {subjects.map((s) => {
            const ix = idsIn(s)
            const done = ix.filter((k) => answers[k] !== null && answers[k] !== undefined).length
            const on = s === q.subject
            return (
              <button
                key={s}
                type='button'
                aria-current={on ? 'true' : undefined}
                onClick={() => goTo(ix[0])}
                className={`min-w-[120px] shrink-0 rounded-2xl border p-2.5 text-left ${
                  on ? 'border-[#002EFF] bg-blue-50 dark:bg-zinc-800' : 'border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <b className='block text-[12px] font-black text-slate-800 dark:text-white'>{s}</b>
                <span className='text-[10px] font-bold text-slate-500'>
                  {done} of {ix.length} answered
                </span>
                <span className='mt-1 block h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-700'>
                  <span className='block h-full bg-[#002EFF]' style={{ width: `${(done / ix.length) * 100}%` }} />
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className='rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900'>
        <div className='mb-3 flex flex-wrap items-center gap-1.5'>
          <span className={tagCls}>
            {q.subject}
            {q.topic ? ` · ${q.topic}` : ''}
          </span>
          <span className={tagCls}>
            Question {pos} of {inSubject.length}
          </span>
          {q.exam && (
            <span className={tagCls}>
              {q.exam} {q.year || ''}
            </span>
          )}
          {!exam && DIFF_LABEL[q.difficulty] && <span className={tagCls}>{DIFF_LABEL[q.difficulty]}</span>}
          {exam && (
            <button
              type='button'
              onClick={toggleFlag}
              aria-pressed={!!flagged[i]}
              className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                flagged[i] ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500 dark:bg-zinc-800'
              }`}
            >
              <Flag size={12} /> {flagged[i] ? 'Flagged' : 'Flag'}
            </button>
          )}
        </div>

        <Passage text={q.passage} />
        <h2 className='whitespace-pre-line text-[16px] font-bold leading-relaxed text-slate-900 sm:text-[17px] dark:text-white'>
          {q.text}
        </h2>
        {q.image && <Figure src={q.image} alt={q.imageAlt} />}

        <div className='mt-4 space-y-2'>
          {q.options.map((o, k) => {
            let cls = 'border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
            let tag = ''
            if (shown) {
              if (k === shown.answer) {
                cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                tag = '✓ Correct'
              } else if (k === shown.choice) {
                cls = 'border-rose-500 bg-rose-50 dark:bg-rose-950'
                tag = '✕ Your answer'
              } else cls += ' opacity-60'
            } else if (chosen === k) cls = 'border-[#002EFF] bg-blue-50 dark:bg-zinc-800'
            return (
              <button
                key={k}
                type='button'
                disabled={!!shown || busy}
                onClick={() => choose(k)}
                aria-pressed={chosen === k}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${cls}`}
              >
                <i
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black not-italic ${
                    chosen === k && !shown ? 'bg-[#002EFF] text-white' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {LETTERS[k]}
                </i>
                <span className='min-w-0 flex-1 text-[14px] font-semibold text-slate-800 dark:text-zinc-100'>{o}</span>
                {tag && <em className='shrink-0 text-[11px] font-black not-italic text-slate-600'>{tag}</em>}
              </button>
            )
          })}
        </div>

        {shown && (
          <div
            className={`mt-4 rounded-2xl p-4 text-[14px] ${
              shown.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'
            }`}
          >
            <b className='block'>{shown.correct ? '✓ Correct' : `✕ Not quite. The answer is ${LETTERS[shown.answer]}`}</b>
            <span className='mt-1 block whitespace-pre-line'>{shown.explanation || 'No explanation has been added for this question yet.'}</span>
          </div>
        )}

        {!exam && (
          <div className='mt-4 flex flex-wrap gap-2'>
            <button type='button' className={`${chip} ${savedIds.has(q.id) ? chipOn : ''}`} onClick={() => onSaveToggle(q.id)}>
              {savedIds.has(q.id) ? <BookmarkCheck size={14} className='mr-1' /> : <Bookmark size={14} className='mr-1' />}
              {savedIds.has(q.id) ? 'Saved' : 'Save question'}
            </button>
            <button
              type='button'
              className={`${chip} ${reportedIds.has(q.id) ? chipOn : ''}`}
              onClick={() => !reportedIds.has(q.id) && setSheet('report')}
            >
              {reportedIds.has(q.id) ? '✓ Reported' : 'Report a problem'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className='fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95'>
        <div className='mx-auto max-w-3xl space-y-2'>
          <div className='flex items-center gap-2'>
            <button type='button' className={barAlt} onClick={prev} disabled={pos <= 1}>
              ‹ Prev
            </button>
            <span className='min-w-[84px] text-center text-[12px] font-black text-slate-700 dark:text-zinc-200'>
              {pos} / {inSubject.length}
              <small className='block text-[10px] font-bold text-slate-400'>
                {exam ? `${answered} of ${n} answered` : 'Saved'}
              </small>
            </span>
            {exam ? (
              <button type='button' className={barAlt} onClick={next} disabled={isLast}>
                {lastInSubject && !lastSubject ? 'Next subject ›' : 'Next ›'}
              </button>
            ) : (
              <button
                type='button'
                className={barBtn}
                disabled={chosen === null || chosen === undefined || busy}
                onClick={isLast ? () => void finish() : next}
              >
                {isLast ? 'See results' : lastInSubject ? 'Next subject ›' : 'Next ›'}
              </button>
            )}
          </div>
          {exam && (
            <div className='flex gap-2'>
              <button type='button' className={barAlt} onClick={() => setSheet('grid')}>
                <Grid3x3 size={15} /> Questions
              </button>
              <button type='button' className={barAlt} onClick={() => setSheet('calc')}>
                <Calculator size={15} /> Calculator
              </button>
              <button type='button' className={barBtn} onClick={() => setSheet('submit')} disabled={busy}>
                Submit
              </button>
            </div>
          )}
          {!exam && answered > 0 && !isLast && (
            <button type='button' className='w-full text-center text-[12px] font-bold text-[#002EFF]' onClick={() => setSheet('submit')}>
              Finish now and see results
            </button>
          )}
        </div>
      </div>

      {sheet === 'grid' && (
        <Sheet title='Questions' onClose={() => setSheet(null)}>
          <div className='mb-3 flex flex-wrap gap-3 text-[11px] font-bold text-slate-500'>
            <span className='flex items-center gap-1'><i className='h-3 w-3 rounded bg-[#002EFF]' /> Answered</span>
            <span className='flex items-center gap-1'><i className='h-3 w-3 rounded border border-slate-300' /> Unanswered</span>
            <span className='flex items-center gap-1'><i className='h-3 w-3 rounded bg-amber-400' /> Flagged</span>
            <span className='flex items-center gap-1'><i className='h-3 w-3 rounded ring-2 ring-slate-900' /> Current</span>
          </div>
          {subjects.length > 1 && (
            <div className='mb-3 flex flex-wrap gap-1.5'>
              {subjects.map((s) => (
                <button
                  key={s}
                  type='button'
                  className={`${chip} ${(gridSubject || q.subject) === s ? chipOn : ''}`}
                  onClick={() => setGridSubject(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className='grid grid-cols-6 gap-1.5 sm:grid-cols-8'>
            {idsIn(gridSubject || q.subject).map((k, j) => {
              const a = answers[k] !== null && answers[k] !== undefined
              return (
                <button
                  key={k}
                  type='button'
                  onClick={() => {
                    setSheet(null)
                    goTo(k)
                  }}
                  aria-label={`Question ${j + 1}${flagged[k] ? ', flagged' : a ? ', answered' : ', unanswered'}`}
                  className={`h-10 rounded-xl text-[12px] font-black ${
                    flagged[k]
                      ? 'bg-amber-400 text-slate-900'
                      : a
                        ? 'bg-[#002EFF] text-white'
                        : 'border border-slate-300 text-slate-600 dark:border-zinc-600 dark:text-zinc-300'
                  } ${k === i ? 'ring-2 ring-slate-900 ring-offset-1 dark:ring-white' : ''}`}
                >
                  {j + 1}
                </button>
              )
            })}
          </div>
        </Sheet>
      )}

      {sheet === 'submit' && (
        <Sheet title={`Submit your answers, ${firstName(name)}?`} onClose={() => setSheet(null)}>
          <p className='text-[13px] text-slate-600 dark:text-zinc-300'>
            You have answered {answered} of {n}. {n - answered} remain unanswered.
            {flagged.filter(Boolean).length ? ` ${flagged.filter(Boolean).length} flagged for review.` : ''}
            {exam ? ' After you submit, you cannot change your answers.' : ''}
          </p>
          <div className='mt-4 flex gap-2'>
            <button type='button' className={`${btnAlt} flex-1`} onClick={() => setSheet(null)}>
              Keep going
            </button>
            <button type='button' className={`${btn} flex-1`} disabled={busy} onClick={() => void finish()}>
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'exit' && (
        <Sheet title='Leave this attempt?' onClose={() => setSheet(null)}>
          <p className='text-[13px] text-slate-600 dark:text-zinc-300'>
            {exam && endsAt
              ? 'Your answers are saved. The timer keeps running while you are away.'
              : 'Your progress is saved. You can continue from the CBT Practice page.'}
          </p>
          <div className='mt-4 flex gap-2'>
            <button type='button' className={`${btnAlt} flex-1`} onClick={() => setSheet(null)}>
              Keep going
            </button>
            <button
              type='button'
              className={`${btn} flex-1`}
              onClick={async () => {
                await flush()
                onLeave()
              }}
            >
              Leave
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'calc' && (
        <Sheet title='Calculator' onClose={() => setSheet(null)}>
          <CalculatorPad />
        </Sheet>
      )}

      {sheet === 'report' && (
        <ReportSheet
          questionId={q.id}
          questionText={q.text}
          onClose={() => setSheet(null)}
          onSent={() => {
            onReported(q.id)
            setSheet(null)
            toast('Thanks. A tutor will check this question.')
          }}
        />
      )}
    </div>
  )
}

// The bottom bar must fit three buttons on a 360px phone, so they shrink.
const barBase = 'inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-2 text-[13px] font-black disabled:opacity-40'
const barBtn = `${barBase} bg-[#002EFF] text-white hover:bg-blue-700`
const barAlt = `${barBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200`

const tagCls =
  'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'

export function ReportSheet({
  questionId,
  questionText,
  onClose,
  onSent,
}: {
  questionId: string
  questionText: string
  onClose: () => void
  onSent: () => void
}) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <Sheet title='Report a problem' onClose={onClose}>
      <p className='text-[12px] text-slate-500'>{questionText.length > 120 ? `${questionText.slice(0, 120)}…` : questionText}</p>
      <div className='mt-3 flex flex-wrap gap-1.5'>
        {CBT_REPORT_REASONS.map((r) => (
          <button key={r} type='button' className={`${chip} ${reason === r ? chipOn : ''}`} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      <label className='mt-3 block text-[12px] font-bold text-slate-500'>
        Add a note (optional)
        <textarea
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder='Tell the tutor what you think is wrong'
          className='mt-1 min-h-[84px] w-full rounded-2xl border border-slate-200 p-3 text-[14px] text-slate-800 outline-none focus:border-[#002EFF] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
        />
      </label>
      {error && <p className='mt-2 text-[12px] font-bold text-rose-600'>{error}</p>}
      <div className='mt-3 flex gap-2'>
        <button type='button' className={`${btnAlt} flex-1`} onClick={onClose}>
          Cancel
        </button>
        <button
          type='button'
          className={`${btn} flex-1`}
          disabled={!reason || busy}
          onClick={async () => {
            setBusy(true)
            setError('')
            try {
              await dsaApi.cbt.report(questionId, { reason, note })
              onSent()
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not send the report')
              setBusy(false)
            }
          }}
        >
          {busy ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </Sheet>
  )
}

/** A basic four-function calculator, as allowed in the JAMB CBT. */
function CalculatorPad() {
  const [c, setC] = useState({ d: '0', a: null as string | null, op: null as string | null, fresh: false })
  const press = (k: string) =>
    setC((p) => {
      const s = { ...p }
      const apply = () => {
        const x = Number(s.a)
        const y = Number(s.d)
        const r = s.op === '+' ? x + y : s.op === '−' ? x - y : s.op === '×' ? x * y : x / y
        s.d = Number.isFinite(r) ? String(Number(r.toPrecision(10))) : 'Error'
      }
      if (/^\d$/.test(k)) {
        s.d = s.fresh || s.d === '0' || s.d === 'Error' ? k : s.d + k
        s.fresh = false
      } else if (k === '.') {
        if (s.fresh || s.d === 'Error') {
          s.d = '0.'
          s.fresh = false
        } else if (!s.d.includes('.')) s.d += '.'
      } else if (k === 'C') return { d: '0', a: null, op: null, fresh: false }
      else if (k === '⌫') s.d = s.fresh || s.d.length < 2 || s.d === 'Error' ? '0' : s.d.slice(0, -1)
      else if (k === '=') {
        if (s.op && s.a !== null) {
          apply()
          s.op = null
          s.a = null
          s.fresh = true
        }
      } else {
        if (s.op && !s.fresh && s.a !== null) apply()
        s.a = s.d
        s.op = k
        s.fresh = true
      }
      return s
    })
  const keys = ['C', '⌫', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.']
  return (
    <div>
      <div className='mb-3 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-right font-mono text-[28px] font-black text-white' aria-live='polite'>
        {c.d}
      </div>
      <div className='grid grid-cols-4 gap-2'>
        {keys.map((k) => (
          <button
            key={k}
            type='button'
            onClick={() => press(k)}
            className={`h-14 rounded-2xl text-[18px] font-black ${
              '÷×−+='.includes(k) ? 'bg-[#002EFF] text-white' : 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-white'
            } ${k === '0' ? 'col-span-2' : ''} ${k === '=' ? 'row-span-2 h-auto' : ''}`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}
