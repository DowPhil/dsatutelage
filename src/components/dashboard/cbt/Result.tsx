'use client'

// A finished session: score, breakdowns, sharing, and the full answer review
// with explanations (filters by subject, topic and outcome).

import { useMemo, useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import type { CbtResult } from '@/lib/cbt-types'
import { ReportSheet } from './Runner'
import { DIFF_LABEL, Figure, LETTERS, Passage, Sheet, btn, btnAlt, card, chip, chipOn, clock, fN, label } from './shared'

type Outcome = 'ok' | 'bad' | 'sk'

export default function Result({
  result,
  name,
  savedIds,
  reportedIds,
  onSaveToggle,
  onReported,
  onRetry,
  onPractiseTopic,
  onClose,
  toast,
}: {
  result: CbtResult
  name: string
  savedIds: Set<string>
  reportedIds: Set<string>
  onSaveToggle: (questionId: string) => void
  onReported: (questionId: string) => void
  onRetry: () => void
  onPractiseTopic: (subject: string, topic: string) => void
  onClose: () => void
  toast: (text: string) => void
}) {
  const [reviewing, setReviewing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [subjectSel, setSubjectSel] = useState('')

  const r = result
  const n = r.total
  const outcome = (k: number): Outcome => {
    const a = r.answers[k]
    if (a === null || a === undefined) return 'sk'
    return a === r.questions[k].answer ? 'ok' : 'bad'
  }
  const correct = r.correct
  const unanswered = r.questions.filter((_, k) => outcome(k) === 'sk').length
  const incorrect = n - correct - unanswered
  // For a full mock the server's percent is the average mark per subject.
  const p = r.percent
  const headline = p >= 70 ? 'Strong session' : p >= 40 ? 'Getting there' : 'Keep drilling'

  const subjects = useMemo(() => [...new Set(r.questions.map((q) => q.subject))], [r.questions])
  const sel = subjects.includes(subjectSel) ? subjectSel : subjects[0]
  const topics = [...r.byTopic].sort((a, b) => a.correct / a.total - b.correct / b.total)
  const strong = topics.filter((t) => t.correct / t.total >= 0.7).slice(-2).map((t) => t.topic).filter(Boolean)
  const weak = topics.filter((t) => t.correct / t.total < 0.5).slice(0, 2).map((t) => t.topic).filter(Boolean)
  const sentence = `${p >= 70 ? 'Good attempt.' : p >= 40 ? 'A fair start.' : 'Keep going.'}${
    strong.length ? ` You were strong in ${strong.join(' and ')}.` : ''
  }${weak.length ? ` You lost marks in ${weak.join(' and ')}.` : ''}`

  const shareText =
    r.full && r.jambScore !== null
      ? `I scored ${r.jambScore}/400 in a full JAMB mock on DSA CBT Practice. ${r.bySubject.map((s) => `${s.subject} ${s.marks}`).join(', ')}. Can you beat it? 📚`
      : `I got ${correct} out of ${n} (${r.percent}%) in ${r.label} on DSA CBT Practice. ${r.percent >= 70 ? 'Strong session! 💪' : 'Keep going! 📚'}`

  if (reviewing) {
    return (
      <Review
        result={r}
        name={name}
        outcome={outcome}
        savedIds={savedIds}
        reportedIds={reportedIds}
        onSaveToggle={onSaveToggle}
        onReported={onReported}
        onBack={() => setReviewing(false)}
        onRetry={incorrect + unanswered ? onRetry : undefined}
        toast={toast}
      />
    )
  }

  const C = 2 * Math.PI * 54
  return (
    <div className='mx-auto max-w-3xl pb-10'>
      <button type='button' className='mb-3 text-[13px] font-bold text-slate-500' onClick={onClose}>
        ‹ Back to CBT Practice
      </button>
      {r.auto && (
        <div className='mb-3 rounded-2xl bg-amber-50 p-3 text-[13px] font-bold text-amber-800'>
          Time ran out, so your answers were submitted automatically.
        </div>
      )}

      <div className={`${card} flex flex-col items-center gap-4 sm:flex-row`}>
        <div className='relative h-[132px] w-[132px] shrink-0'>
          <svg width='132' height='132' aria-hidden='true'>
            <circle cx='66' cy='66' r='54' fill='none' stroke='currentColor' className='text-slate-100 dark:text-zinc-800' strokeWidth='12' />
            <circle
              cx='66'
              cy='66'
              r='54'
              fill='none'
              stroke='#002EFF'
              strokeWidth='12'
              strokeLinecap='round'
              strokeDasharray={C}
              strokeDashoffset={C * (1 - p / 100)}
              transform='rotate(-90 66 66)'
            />
          </svg>
          <b className='absolute inset-0 flex items-center justify-center text-[26px] font-black text-slate-900 dark:text-white'>
            {r.full && r.jambScore !== null ? r.jambScore : `${r.percent}%`}
          </b>
        </div>
        <div className='min-w-0 text-center sm:text-left'>
          <p className='text-[12px] font-bold text-slate-400'>
            {name} · {r.label}
          </p>
          <h2 className='text-[22px] font-black text-slate-900 dark:text-white'>{headline}</h2>
          <p className='mt-1 text-[14px] text-slate-600 dark:text-zinc-300'>{sentence}</p>
          {r.full && r.jambScore !== null && (
            <p className='mt-1 text-[14px] font-black text-[#002EFF]'>JAMB score: {r.jambScore} out of 400</p>
          )}
        </div>
      </div>

      <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <Stat value={correct} label='Correct' />
        <Stat value={incorrect} label='Incorrect' />
        <Stat value={unanswered} label='Unanswered' />
        <Stat value={r.timed && r.timeUsedSecs !== null ? clock(r.timeUsedSecs) : n} label={r.timed ? 'Time used' : 'Questions'} />
      </div>

      <div className={`${card} mt-4 flex flex-wrap items-center justify-between gap-3`}>
        <p className='min-w-0'>
          <b className='block text-[14px] font-black text-slate-900 dark:text-white'>Review your answers</b>
          <span className='text-[12px] text-slate-500'>See every question with its options, your answer and the explanation.</span>
        </p>
        <button type='button' className={btn} onClick={() => setReviewing(true)}>
          Review answers
        </button>
      </div>

      {r.full && (
        <>
          <span className={label}>Marks by subject (out of 100)</span>
          <div className={card}>
            {r.bySubject.map((s) => (
              <Bar key={s.subject} name={s.subject} value={s.marks || 0} text={String(s.marks)} />
            ))}
          </div>
        </>
      )}

      <span className={label}>By topic</span>
      {subjects.length > 1 && (
        <div className='-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1'>
          {r.bySubject.map((s) => (
            <button
              key={s.subject}
              type='button'
              aria-pressed={s.subject === sel}
              onClick={() => setSubjectSel(s.subject)}
              className={`min-w-[130px] shrink-0 rounded-2xl border p-2.5 text-left ${
                s.subject === sel ? 'border-[#002EFF] bg-blue-50 dark:bg-zinc-800' : 'border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900'
              }`}
            >
              <b className='block text-[12px] font-black text-slate-800 dark:text-white'>{s.subject}</b>
              <span className='text-[11px] font-bold text-slate-500'>
                {s.correct} of {s.total} correct
              </span>
            </button>
          ))}
        </div>
      )}
      <div className={card}>
        {topics
          .filter((t) => subjects.length < 2 || t.subject === sel)
          .map((t) => (
            <div key={t.subject + t.topic} className='flex items-center gap-2 py-1.5'>
              <span className='w-32 shrink-0 truncate text-[12px] font-bold text-slate-700 sm:w-44 dark:text-zinc-200'>
                {t.topic || 'Other'}
                <small className='block text-[10px] font-medium text-slate-400'>{t.subject}</small>
              </span>
              <div className='h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800'>
                <div className='h-full rounded-full bg-[#002EFF]' style={{ width: `${(t.correct / t.total) * 100}%` }} />
              </div>
              <span className='w-10 shrink-0 text-right text-[12px] font-black'>
                {t.correct}/{t.total}
              </span>
              {t.correct / t.total < 0.7 && t.topic ? (
                <button type='button' className={chip} onClick={() => onPractiseTopic(t.subject, t.topic)}>
                  Practise
                </button>
              ) : (
                <span className='w-[74px] shrink-0' />
              )}
            </div>
          ))}
      </div>

      <div className='mt-5 flex flex-wrap gap-2'>
        <button type='button' className={btn} onClick={() => setSharing(true)}>
          Share my result
        </button>
        {incorrect + unanswered > 0 && (
          <button type='button' className={btnAlt} onClick={onRetry}>
            Retry missed questions
          </button>
        )}
        <button type='button' className={btnAlt} onClick={onClose}>
          Back to CBT Practice
        </button>
      </div>

      {sharing && (
        <Sheet title='Share your result' onClose={() => setSharing(false)}>
          <p className='text-[13px] text-slate-600 dark:text-zinc-300'>This is the message your friends will see:</p>
          <textarea
            readOnly
            value={shareText}
            aria-label='Message to share'
            className='mt-2 min-h-[96px] w-full rounded-2xl border border-slate-200 p-3 text-[14px] dark:border-zinc-700 dark:bg-zinc-900'
          />
          <div className='mt-3 flex gap-2'>
            <button type='button' className={`${btnAlt} flex-1`} onClick={() => setSharing(false)}>
              Close
            </button>
            <a
              className={`${btn} flex-1`}
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target='_blank'
              rel='noopener noreferrer'
            >
              Open WhatsApp
            </a>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function Stat({ value, label: l }: { value: React.ReactNode; label: string }) {
  return (
    <div className='rounded-2xl border border-slate-100 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900'>
      <b className='block text-[20px] font-black text-slate-900 dark:text-white'>{value}</b>
      <span className='text-[11px] font-bold text-slate-500'>{l}</span>
    </div>
  )
}

function Bar({ name, value, text }: { name: string; value: number; text: string }) {
  return (
    <div className='flex items-center gap-2 py-1.5'>
      <span className='w-28 shrink-0 truncate text-[12px] font-bold text-slate-700 dark:text-zinc-200'>{name}</span>
      <div className='h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800'>
        <div className='h-full rounded-full bg-[#002EFF]' style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className='w-10 shrink-0 text-right text-[12px] font-black'>{text}</span>
    </div>
  )
}

const PAGE = 20

function Review({
  result: r,
  name,
  outcome,
  savedIds,
  reportedIds,
  onSaveToggle,
  onReported,
  onBack,
  onRetry,
  toast,
}: {
  result: CbtResult
  name: string
  outcome: (k: number) => Outcome
  savedIds: Set<string>
  reportedIds: Set<string>
  onSaveToggle: (questionId: string) => void
  onReported: (questionId: string) => void
  onBack: () => void
  onRetry?: () => void
  toast: (text: string) => void
}) {
  const subjects = [...new Set(r.questions.map((q) => q.subject))]
  const [subject, setSubject] = useState(subjects[0])
  const [topic, setTopic] = useState('All')
  const [filter, setFilter] = useState<'all' | Outcome>('all')
  const [shown, setShown] = useState(PAGE)
  const [reporting, setReporting] = useState<number | null>(null)

  const all = r.questions.map((_, k) => k)
  const inSubject = all.filter((k) => subjects.length < 2 || r.questions[k].subject === subject)
  const topics = [...new Set(inSubject.map((k) => r.questions[k].topic))].filter(Boolean)
  const base = inSubject.filter((k) => topic === 'All' || r.questions[k].topic === topic)
  const count = (o: Outcome) => base.filter((k) => outcome(k) === o).length
  const items = base.filter((k) => filter === 'all' || outcome(k) === filter)
  const posIn = (k: number) => all.filter((x) => r.questions[x].subject === r.questions[k].subject).indexOf(k) + 1
  const totalIn = (k: number) => all.filter((x) => r.questions[x].subject === r.questions[k].subject).length

  const pill = (on: boolean, text: string, onClick: () => void) => (
    <button type='button' className={`${chip} ${on ? chipOn : ''}`} onClick={onClick}>
      {text}
    </button>
  )

  return (
    <div className='mx-auto max-w-3xl pb-10'>
      <button type='button' className='mb-3 text-[13px] font-bold text-slate-500' onClick={onBack}>
        ‹ Results
      </button>
      <h1 className='text-[22px] font-black text-slate-900 dark:text-white'>Review answers</h1>
      <div className={`${card} mt-3 flex items-center gap-4`}>
        <b className='text-[24px] font-black text-[#002EFF]'>{r.full && r.jambScore !== null ? `${r.jambScore}/400` : `${r.percent}%`}</b>
        <p className='min-w-0 text-[12px] text-slate-500'>
          <b className='block truncate text-[13px] text-slate-800 dark:text-white'>
            {name} · {r.label}
          </b>
          {r.correct} correct · {all.filter((k) => outcome(k) === 'bad').length} incorrect ·{' '}
          {all.filter((k) => outcome(k) === 'sk').length} unanswered
          {r.timed && r.timeUsedSecs !== null ? ` · ${clock(r.timeUsedSecs)} used` : ''}
        </p>
      </div>

      {subjects.length > 1 && (
        <div className='mt-3 flex flex-wrap gap-1.5'>
          {subjects.map((s) =>
            pill(s === subject, s, () => {
              setSubject(s)
              setTopic('All')
              setShown(PAGE)
            }),
          )}
        </div>
      )}
      {topics.length > 1 && (
        <div className='mt-2 flex flex-wrap gap-1.5'>
          {pill(topic === 'All', 'All topics', () => setTopic('All'))}
          {topics.map((t) => pill(topic === t, t, () => setTopic(t)))}
        </div>
      )}
      <div className='mb-3 mt-2 flex flex-wrap gap-1.5'>
        {pill(filter === 'all', `All (${base.length})`, () => setFilter('all'))}
        {pill(filter === 'bad', `Incorrect (${count('bad')})`, () => setFilter('bad'))}
        {count('sk') > 0 && pill(filter === 'sk', `Unanswered (${count('sk')})`, () => setFilter('sk'))}
        {pill(filter === 'ok', `Correct (${count('ok')})`, () => setFilter('ok'))}
      </div>

      <div className='space-y-3'>
        {items.slice(0, shown).map((k) => {
          const q = r.questions[k]
          const a = r.answers[k]
          const o = outcome(k)
          return (
            <article
              key={k}
              className={`${card} border-l-4 ${o === 'ok' ? 'border-l-emerald-500' : o === 'bad' ? 'border-l-rose-500' : 'border-l-slate-300'}`}
            >
              <div className='mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500'>
                <span>
                  {q.subject}
                  {q.topic ? ` · ${q.topic}` : ''}
                </span>
                <span>
                  · Question {posIn(k)} of {totalIn(k)}
                </span>
                {q.exam && (
                  <span>
                    · {q.exam} {q.year || ''}
                  </span>
                )}
                {DIFF_LABEL[q.difficulty] && <span>· {DIFF_LABEL[q.difficulty]}</span>}
                <span
                  className={`ml-auto font-black ${o === 'ok' ? 'text-emerald-600' : o === 'bad' ? 'text-rose-600' : 'text-slate-400'}`}
                >
                  {o === 'ok' ? '✓ Correct' : o === 'bad' ? '✕ Incorrect' : '– Unanswered'}
                </span>
              </div>
              <Passage text={q.passage} open={false} />
              <h2 className='whitespace-pre-line text-[15px] font-bold text-slate-900 dark:text-white'>{q.text}</h2>
              {q.image && <Figure src={q.image} alt={q.imageAlt} />}
              <div className='mt-3 space-y-1.5'>
                {q.options.map((opt, j) => {
                  const right = j === q.answer
                  const mine = j === a
                  return (
                    <div
                      key={j}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-[13px] ${
                        right
                          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950'
                          : mine
                            ? 'border-rose-400 bg-rose-50 dark:bg-rose-950'
                            : 'border-slate-100 dark:border-zinc-800'
                      }`}
                    >
                      <b className='w-5 shrink-0'>{LETTERS[j]}</b>
                      <span className='min-w-0 flex-1'>{opt}</span>
                      {right && <em className='shrink-0 text-[11px] font-black not-italic text-emerald-700'>{mine ? '✓ Your answer · Correct' : '✓ Correct answer'}</em>}
                      {!right && mine && <em className='shrink-0 text-[11px] font-black not-italic text-rose-700'>✕ Your answer</em>}
                    </div>
                  )
                })}
              </div>
              <div className='mt-3 rounded-2xl bg-slate-50 p-3 text-[13px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-200'>
                <b className='block text-[12px] font-black'>Explanation</b>
                <span className='whitespace-pre-line'>{q.explanation || 'No explanation has been added for this question yet.'}</span>
              </div>
              <div className='mt-3 flex flex-wrap gap-2'>
                <button type='button' className={`${chip} ${savedIds.has(q.id) ? chipOn : ''}`} onClick={() => onSaveToggle(q.id)}>
                  {savedIds.has(q.id) ? <BookmarkCheck size={14} className='mr-1' /> : <Bookmark size={14} className='mr-1' />}
                  {savedIds.has(q.id) ? 'Saved' : 'Save question'}
                </button>
                <button
                  type='button'
                  className={`${chip} ${reportedIds.has(q.id) ? chipOn : ''}`}
                  onClick={() => !reportedIds.has(q.id) && setReporting(k)}
                >
                  {reportedIds.has(q.id) ? '✓ Reported' : 'Report a problem'}
                </button>
              </div>
            </article>
          )
        })}
        {!items.length && <p className='rounded-2xl bg-white p-6 text-center text-[13px] text-slate-400 dark:bg-zinc-900'>No questions match this filter.</p>}
      </div>
      {items.length > shown && (
        <button type='button' className={`${btnAlt} mt-3 w-full`} onClick={() => setShown((s) => s + PAGE)}>
          Show {Math.min(PAGE, items.length - shown)} more ({fN(items.length - shown)} left)
        </button>
      )}
      <div className='mt-5 flex flex-wrap gap-2'>
        {onRetry && (
          <button type='button' className={btn} onClick={onRetry}>
            Retry missed questions
          </button>
        )}
        <button type='button' className={btnAlt} onClick={onBack}>
          Back to results
        </button>
      </div>

      {reporting !== null && (
        <ReportSheet
          questionId={r.questions[reporting].id}
          questionText={r.questions[reporting].text}
          onClose={() => setReporting(null)}
          onSent={() => {
            onReported(r.questions[reporting].id)
            setReporting(null)
            toast('Thanks. A tutor will check this question.')
          }}
        />
      )}
    </div>
  )
}
