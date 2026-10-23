'use client'

// "New practice session": choose an exam and how to practise, then review the
// settings (and, for a timed session, read the instructions) before the
// server draws the questions. Counts here come from the catalogue in /cbt/meta;
// the server applies the same plan limits when the session starts.

import { useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import type { CbtCatalogueRow, CbtMeta, CbtStartBody } from '@/lib/cbt-types'
import { btn, btnAlt, card, chip, chipOn, fN, firstName, fm, label, unl } from './shared'

type Kind = 'mock' | 'custom' | 'topic'

export interface SetupPlan {
  body: CbtStartBody
  title: string
  rows: [string, string][]
  questions: number
  minutes: number
  timed: boolean
  full: boolean
  tips: string[]
  note: string
  bySubject: [string, number][]
}

const TYPES: [Kind, string, string][] = [
  ['mock', 'Mock mode', 'Full exam simulation: one subject, or the full JAMB format.'],
  ['custom', 'Custom mode', 'Choose subjects, year, number of questions and time.'],
  ['topic', 'Topic practice', 'Drill one topic. See each answer straight away.'],
]
const COUNT_STEPS = [5, 10, 15, 20, 30, 40, 60, 100, 200, 500]
const MINUTE_STEPS = [5, 10, 15, 20, 30, 45, 60, 90, 120]

const selCls =
  'h-11 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-slate-800 outline-none focus:border-[#002EFF] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'

function Field({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className='flex min-w-0 flex-col gap-1.5 text-[12px] font-bold text-slate-500'>
      <span>{title}</span>
      {children}
    </label>
  )
}

function Choice({
  on,
  locked,
  title,
  text,
  onClick,
}: {
  on: boolean
  locked?: boolean
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={on}
      className={`min-w-0 rounded-2xl border-2 p-3 text-left ${
        on ? 'border-[#002EFF] bg-blue-50 dark:bg-zinc-800' : 'border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900'
      } ${locked ? 'opacity-70' : ''}`}
    >
      <b className='flex items-center gap-1 text-[14px] font-black text-slate-900 dark:text-white'>
        {title} {locked && <Lock size={13} />}
      </b>
      <span className='mt-0.5 block text-[12px] text-slate-500'>{text}</span>
    </button>
  )
}

export default function Setup({
  meta,
  name,
  initial,
  onBack,
  onReady,
  onLock,
  onPlans,
}: {
  meta: CbtMeta
  name: string
  initial?: Partial<{ kind: Kind; subject: string; topic: string }>
  onBack: () => void
  onReady: (plan: SetupPlan) => void
  onLock: (code: string) => void
  onPlans: () => void
}) {
  const cat = meta.catalogue
  const L = meta.limits
  const exams = useMemo(() => {
    const e = [...new Set(cat.map((c) => c.exam).filter(Boolean))]
    return e.sort((a, b) => (a === 'JAMB' ? -1 : b === 'JAMB' ? 1 : a.localeCompare(b)))
  }, [cat])
  const allSubjects = useMemo(() => [...new Set(cat.map((c) => c.subject))].sort(), [cat])

  const [exam, setExam] = useState(exams[0] || 'JAMB')
  const [kind, setKind] = useState<Kind>(initial?.kind || 'mock')
  const [full, setFull] = useState(false)
  const [subject, setSubject] = useState(initial?.subject || '')
  const [fsubs, setFsubs] = useState<string[]>(['', '', ''])
  const [subs, setSubs] = useState<string[]>([])
  const [style, setStyle] = useState<'practice' | 'exam'>('practice')
  const [topic, setTopic] = useState(initial?.topic || 'All')
  const [year, setYear] = useState('All')
  const [diff, setDiff] = useState('All')
  const [order, setOrder] = useState<'unseen' | 'random' | 'missed'>(meta.rules.defaultOrder === 'missed' && !L.missed ? 'unseen' : meta.rules.defaultOrder)
  const [count, setCount] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [perSubject, setPerSubject] = useState<Record<string, number>>({})
  const [stage, setStage] = useState<'setup' | 'summary' | 'instructions'>('setup')
  const [agreed, setAgreed] = useState(false)

  const examSubjects = useMemo(
    () => [...new Set(cat.filter((c) => c.exam === exam).map((c) => c.subject))].sort(),
    [cat, exam],
  )
  const subjectsFor = kind === 'topic' ? allSubjects : examSubjects
  const subj = subjectsFor.includes(subject) ? subject : subjectsFor[0] || ''
  const isJamb = exam === 'JAMB'
  const fullOk = isJamb && L.mocks !== 0
  const mocksLeft = meta.usage.mocksLeft
  const fullLocked = !fullOk || mocksLeft === 0
  const isFull = kind === 'mock' && full && !fullLocked
  const needOthers = Math.max(0, meta.rules.subjects - 1)

  const match = (c: CbtCatalogueRow, opts: { subject?: string; withYear?: boolean; withDiff?: boolean; anyExam?: boolean }) =>
    (opts.anyExam || c.exam === exam) &&
    (!opts.subject || c.subject === opts.subject) &&
    (!opts.withYear || year === 'All' || String(c.year) === year) &&
    (!opts.withDiff || diff === 'All' || c.difficulty === diff)
  const sum = (rows: CbtCatalogueRow[]) => rows.reduce((s, c) => s + c.count, 0)

  const topicsFor = useMemo(
    () => [...new Set(cat.filter((c) => c.subject === subj).map((c) => c.topic).filter(Boolean))].sort(),
    [cat, subj],
  )
  const yearsFor = useMemo(() => {
    const rows =
      kind === 'topic'
        ? cat.filter((c) => c.subject === subj && (topic === 'All' || c.topic === topic))
        : cat.filter((c) => c.exam === exam && subs.includes(c.subject))
    return [...new Set(rows.map((c) => c.year).filter(Boolean) as number[])].sort((a, b) => b - a)
  }, [cat, kind, subj, topic, exam, subs])

  // How many questions the chosen settings give, before plan caps.
  const pool = (() => {
    if (kind === 'topic')
      return sum(cat.filter((c) => match(c, { subject: subj, withYear: true, withDiff: true, anyExam: true }) && (topic === 'All' || c.topic === topic)))
    if (kind === 'mock') return sum(cat.filter((c) => match(c, { subject: subj })))
    return 0
  })()
  const availIn = (s: string) => sum(cat.filter((c) => match(c, { subject: s, withYear: true, withDiff: true })))
  const perCap = (s: string) => {
    const a = availIn(s)
    let v = perSubject[s] ?? (a > 20 ? 20 : a)
    if (L.ps !== null) v = Math.min(v, L.ps)
    return Math.min(v, a)
  }

  let n = 0
  const bySubject: [string, number][] = []
  if (isFull) {
    ;['English', ...fsubs].forEach((s) => {
      if (!s) return
      const want = s === 'English' ? meta.rules.englishQuestions : meta.rules.otherQuestions
      const got = Math.min(want, sum(cat.filter((c) => match(c, { subject: s }))))
      bySubject.push([s, got])
      n += got
    })
  } else if (kind === 'custom') {
    subs.forEach((s) => {
      const v = perCap(s)
      bySubject.push([s, v])
      n += v
    })
  } else {
    n = count ? Math.min(count, pool) : pool
    if (subj) bySubject.push([subj, n])
  }

  const remaining = meta.usage.remainingToday
  const caps = [L.sess, remaining].filter((c) => c !== null) as number[]
  const cap = caps.length ? Math.min(...caps) : null
  const nEff = isFull || cap === null ? n : Math.min(n, cap)

  const avgSec = (() => {
    const sec: Record<string, number> = { E: meta.rules.secEasy, M: meta.rules.secMedium, H: meta.rules.secHard }
    const rows = cat.filter((c) => (kind === 'topic' ? c.subject === subj : c.exam === exam))
    const total = sum(rows)
    return total ? rows.reduce((s, c) => s + (sec[c.difficulty] || meta.rules.secMedium) * c.count, 0) / total : 60
  })()
  const estMin = Math.max(1, Math.ceil((nEff * avgSec) / 60))

  const timed = isFull || kind === 'mock' || (kind === 'custom' && style === 'exam')
  const timeMin = isFull ? meta.rules.mockMinutes : minutes || Math.ceil((nEff * meta.rules.secondsPerQuestion) / 60)

  let err = ''
  if (!cat.length) err = 'No questions have been added yet'
  else if (isFull && (fsubs.some((s) => !s) || new Set(fsubs).size < fsubs.length)) err = `Choose all ${needOthers} subjects`
  else if (kind === 'custom' && !subs.length) err = 'Select at least one subject'
  else if (!n) err = 'No questions match that combination'
  else if (!isFull && remaining === 0) err = 'Daily question limit reached'

  const setLockedYear = (v: string) => {
    if (v !== 'All' && !L.year) return onLock('LOCKED_YEAR')
    setYear(v)
  }
  const setLockedOrder = (v: string) => {
    if (v === 'missed' && !L.missed) return onLock('LOCKED_MISSED')
    setOrder(v as typeof order)
  }

  const yearField = (
    <Field title={<>Exam year {!L.year && <Lock size={11} className='inline' />}</>}>
      <select className={selCls} value={year} onChange={(e) => setLockedYear(e.target.value)}>
        <option value='All'>All years</option>
        {yearsFor.map((y) => (
          <option key={y} value={String(y)}>
            {y}
            {L.year ? '' : ' 🔒'}
          </option>
        ))}
      </select>
    </Field>
  )
  const diffField = (
    <Field title='Difficulty'>
      <select className={selCls} value={diff} onChange={(e) => setDiff(e.target.value)}>
        <option value='All'>All levels</option>
        <option value='E'>Easy</option>
        <option value='M'>Medium</option>
        <option value='H'>Hard</option>
      </select>
    </Field>
  )
  const orderField = (
    <Field title='Question order'>
      <select className={selCls} value={order} onChange={(e) => setLockedOrder(e.target.value)}>
        <option value='unseen'>Unseen questions first</option>
        <option value='random'>Random</option>
        <option value='missed'>Ones I got wrong first{L.missed ? '' : ' 🔒'}</option>
      </select>
    </Field>
  )
  const countField = (
    <Field title='Number of questions'>
      <select className={selCls} value={count} onChange={(e) => setCount(Number(e.target.value))}>
        {COUNT_STEPS.filter((x) => x < pool).map((x) => (
          <option key={x} value={x}>
            {fN(x)} questions
          </option>
        ))}
        <option value={0}>All available ({fN(pool)})</option>
      </select>
    </Field>
  )
  const timeField = (
    <Field title='Time'>
      <select className={selCls} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
        <option value={0}>Auto ({Math.ceil((nEff * meta.rules.secondsPerQuestion) / 60)} min)</option>
        {MINUTE_STEPS.map((x) => (
          <option key={x} value={x}>
            {fm(x)}
          </option>
        ))}
      </select>
    </Field>
  )

  const build = (): SetupPlan => {
    const orderLabel = { unseen: 'Unseen questions first', random: 'Random', missed: 'Ones I got wrong first' }[order]
    const rows: [string, string][] = [['Candidate', name]]
    let body: CbtStartBody
    let title: string
    if (isFull) {
      body = { mode: 'mock', full: true, exam, subjects: fsubs }
      title = `${exam} full mock`
      rows.push(['Exam', exam], ['Session type', 'Full mock'], ['Subjects', ['English', ...fsubs].join(', ')], ['Marking', `${meta.rules.subjects * meta.rules.marksPerSubject} marks, ${meta.rules.marksPerSubject} per subject`])
    } else if (kind === 'mock') {
      body = { mode: 'mock', exam, subject: subj, count: count || undefined, minutes: minutes || undefined }
      title = `${exam} mock · ${subj}`
      rows.push(['Exam', exam], ['Session type', 'Mock · single subject'], ['Subject', subj])
    } else if (kind === 'custom') {
      const ps: Record<string, number> = {}
      subs.forEach((s) => (ps[s] = perCap(s)))
      body = {
        mode: 'custom',
        exam,
        subjects: subs,
        perSubject: ps,
        year: year === 'All' ? 'All' : Number(year),
        difficulty: diff === 'All' ? 'All' : (diff as CbtStartBody['difficulty']),
        order,
        style,
        minutes: style === 'exam' && minutes ? minutes : undefined,
      }
      title = `${exam} custom`
      rows.push(
        ['Exam', exam],
        ['Session type', `Custom mode · ${style === 'exam' ? 'Exam' : 'Practice'}`],
        ['Subjects', subs.join(', ')],
        ['Per subject', bySubject.map(([s, c]) => `${s} ${c}`).join(', ')],
      )
      if (year !== 'All') rows.push(['Exam year', year])
      rows.push(['Question order', orderLabel])
    } else {
      body = {
        mode: 'topic',
        subject: subj,
        topic,
        year: year === 'All' ? 'All' : Number(year),
        difficulty: diff === 'All' ? 'All' : (diff as CbtStartBody['difficulty']),
        order,
        count: count || undefined,
      }
      title = `Topic: ${topic === 'All' ? `all ${subj} topics` : topic}`
      rows.push(['Session type', 'Topic practice'], ['Subject', subj], ['Topic', topic === 'All' ? 'All topics' : topic])
      if (year !== 'All') rows.push(['Exam year', year])
      rows.push(['Question order', orderLabel])
    }
    rows.push(['Questions', fN(nEff)])
    if (!timed) rows.push(['Estimated time', `About ${estMin} min`])
    rows.push(['Time', timed ? `${fm(timeMin)}${isFull ? ' (fixed for full mock)' : !minutes ? ' (1 min per question)' : ''}` : 'No timer'])
    rows.push(['Answers', timed ? 'Shown after you submit' : 'Shown after each question'])

    const tips = timed
      ? [
          'Tap an option to choose your answer. You can change it any time before you submit.',
          'Use Previous and Next to move between questions. The Questions button shows a grid of every question, so you can jump to any of them.',
          ...(bySubject.length > 1 ? ['Use the subject cards at the top to move between subjects. Your answers are kept when you switch.'] : []),
          'Tap Flag on a question you want to check again. Flagged questions are marked in the grid.',
          'A calculator is available from the Calculator button.',
          'One timer runs for the whole exam. You get a warning at 10, 5 and 1 minutes left.',
          'When time is up, your answers are submitted automatically.',
          'You will not see any answers until you submit. After you submit, you cannot change your answers.',
          'Your progress is saved as you go. If you leave, the timer keeps running.',
        ]
      : ['Tap an option to see the correct answer and an explanation.', 'Tap Next to move on. You can exit at any time; your progress is saved.']
    if (isFull)
      tips.unshift(
        `English has ${meta.rules.englishQuestions} questions and each other subject has ${meta.rules.otherQuestions}. Each subject is marked out of ${meta.rules.marksPerSubject}.`,
      )
    let note = ''
    if (!isFull && cap !== null && n > cap)
      note =
        L.sess !== null && cap === L.sess
          ? `Shortened to ${fN(nEff)} questions. Your ${meta.tier} plan allows up to ${unl(L.sess)} questions in one session.`
          : `Shortened to ${fN(nEff)} questions. You have ${unl(remaining)} questions left today on your ${meta.tier} plan.`
    return { body, title, rows, questions: nEff, minutes: timeMin, timed, full: isFull, tips, note, bySubject }
  }

  // ── Summary and instructions ──
  if (stage !== 'setup') {
    const plan = build()
    if (stage === 'instructions') {
      return (
        <div className='mx-auto max-w-2xl pb-28'>
          <button type='button' className='mb-2 text-[13px] font-bold text-slate-500' onClick={() => setStage('summary')}>
            ‹ Back
          </button>
          <h1 className='text-[24px] font-black text-slate-900 dark:text-white'>Instructions</h1>
          <p className='text-[14px] text-slate-500'>Read these before you start, {firstName(name)}.</p>
          <div className={`${card} mt-4`}>
            <Row k='Candidate' v={name} />
            <Row k='Exam' v={plan.title} />
            {plan.bySubject.map(([s, c]) => (
              <Row key={s} k={s} v={`${fN(c)} questions${plan.full ? ` · ${meta.rules.marksPerSubject} marks` : ''}`} />
            ))}
            <Row k='Total time' v={fm(plan.minutes)} />
          </div>
          <span className={label}>How the exam works</span>
          <ul className='list-disc space-y-1.5 pl-5 text-[14px] text-slate-700 dark:text-zinc-200'>
            {plan.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <label className='mt-5 flex items-start gap-2 text-[14px] font-bold text-slate-800 dark:text-white'>
            <input type='checkbox' className='mt-0.5 h-5 w-5 accent-[#002EFF]' checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            I have read and understood these instructions.
          </label>
          <StartBar title={`${fN(plan.questions)} questions`} sub={fm(plan.minutes)}>
            <button type='button' className={btn} disabled={!agreed} onClick={() => onReady(plan)}>
              Start exam
            </button>
          </StartBar>
        </div>
      )
    }
    return (
      <div className='mx-auto max-w-2xl pb-28'>
        <button type='button' className='mb-2 text-[13px] font-bold text-slate-500' onClick={() => setStage('setup')}>
          ‹ Edit settings
        </button>
        <h1 className='text-[24px] font-black text-slate-900 dark:text-white'>Ready to start?</h1>
        <p className='text-[14px] text-slate-500'>
          Check your settings. {plan.timed ? 'The timer starts when you start the session.' : 'There is no timer, so take your time.'}
        </p>
        <div className={`${card} mt-4`}>
          {plan.rows.map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
        </div>
        <span className={label}>Good to know</span>
        <ul className='list-disc space-y-1.5 pl-5 text-[14px] text-slate-700 dark:text-zinc-200'>
          {(plan.timed ? plan.tips.slice(0, 3) : plan.tips).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {plan.note && (
          <div className='mt-4 rounded-2xl bg-amber-50 p-3 text-[13px] font-bold text-amber-800'>
            {plan.note}{' '}
            <button type='button' className='underline' onClick={onPlans}>
              See plans
            </button>
          </div>
        )}
        <StartBar title={`${fN(plan.questions)} questions`} sub={plan.timed ? fm(plan.minutes) : 'No timer'}>
          <button
            type='button'
            className={btn}
            disabled={!plan.questions}
            onClick={() => (plan.timed ? setStage('instructions') : onReady(plan))}
          >
            {plan.timed ? 'Continue' : 'Start session'}
          </button>
        </StartBar>
      </div>
    )
  }

  // ── Setup ──
  const summaryLine = isFull
    ? `${exam} · Full mock · ${fm(meta.rules.mockMinutes)}`
    : kind === 'mock'
      ? `${exam} · ${subj} · ${minutes ? fm(minutes) : `${nEff} min`}`
      : kind === 'custom'
        ? `${exam} · ${subs.length} subject${subs.length === 1 ? '' : 's'} · ${year === 'All' ? 'All years' : year} · ${style === 'exam' ? 'Exam mode' : 'Practice mode'}`
        : `${subj} · ${topic === 'All' ? 'All topics' : topic}`

  return (
    <div className='mx-auto max-w-3xl pb-28'>
      <button type='button' className='mb-2 text-[13px] font-bold text-slate-500' onClick={onBack}>
        ‹ Back
      </button>
      <h1 className='text-[24px] font-black text-slate-900 dark:text-white'>New practice session</h1>
      <p className='text-[14px] text-slate-500'>Choose an exam, then how you want to practise.</p>

      <span className={`${label} ${kind === 'topic' ? 'opacity-50' : ''}`}>Exam</span>
      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${kind === 'topic' ? 'opacity-50' : ''}`}>
        {exams.map((e) => (
          <Choice
            key={e}
            on={e === exam}
            title={e}
            text={`${fN(sum(cat.filter((c) => c.exam === e)))} questions`}
            onClick={() => {
              setExam(e)
              setSubs([])
              setFsubs(['', '', ''])
              setYear('All')
              if (e !== 'JAMB') setFull(false)
            }}
          />
        ))}
        {!exams.length && <p className='text-[13px] text-slate-400'>No questions have been added yet.</p>}
      </div>

      <span className={label}>Session type</span>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
        {TYPES.map(([k, t, d]) => (
          <Choice key={k} on={k === kind} title={t} text={d} onClick={() => setKind(k)} />
        ))}
      </div>

      {kind === 'mock' && (
        <>
          {isJamb ? (
            <>
              <span className={label}>Mock format</span>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                <Choice on={!isFull} title='Single subject' text='One subject, timed.' onClick={() => setFull(false)} />
                <Choice
                  on={isFull}
                  locked={fullLocked}
                  title='Full mock'
                  text={
                    fullLocked
                      ? L.mocks === 0
                        ? `Not part of the ${meta.tier} plan. Tap to see your options.`
                        : 'You have used this month’s full mocks. Tap to see your options.'
                      : `English (${meta.rules.englishQuestions} questions) plus ${needOthers} subjects (${meta.rules.otherQuestions} each). ${meta.rules.subjects * meta.rules.marksPerSubject} marks, ${fm(meta.rules.mockMinutes)}.`
                  }
                  onClick={() => (fullLocked ? onLock('MOCK_LIMIT') : setFull(true))}
                />
              </div>
            </>
          ) : (
            <p className='mt-4 text-[12px] text-slate-500'>{exam} mocks are taken one subject at a time.</p>
          )}
          {isFull ? (
            <>
              <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <Field title='Subject 1'>
                  <select className={selCls} disabled>
                    <option>English (compulsory)</option>
                  </select>
                </Field>
                {fsubs.map((s, k) => (
                  <Field key={k} title={`Subject ${k + 2}`}>
                    <select
                      className={selCls}
                      value={s}
                      onChange={(e) => setFsubs((p) => p.map((x, j) => (j === k ? e.target.value : x)))}
                    >
                      <option value=''>Choose a subject</option>
                      {examSubjects
                        .filter((x) => x !== 'English' && (x === s || !fsubs.includes(x)))
                        .map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                    </select>
                  </Field>
                ))}
              </div>
              <div className='mt-4 rounded-2xl bg-blue-50 p-3 text-[13px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-200'>
                <b className='block'>
                  {n} questions in {fm(meta.rules.mockMinutes)}
                </b>
                JAMB format: English {meta.rules.englishQuestions}, other subjects {meta.rules.otherQuestions} each,{' '}
                {meta.rules.subjects * meta.rules.marksPerSubject} marks. The timer is fixed. Answers appear after you submit.
                {mocksLeft !== null && ` Full mocks this month: ${meta.usage.mocksThisMonth} of ${unl(L.mocks)} used.`}
              </div>
            </>
          ) : (
            <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3'>
              <Field title='Subject'>
                <select className={selCls} value={subj} onChange={(e) => setSubject(e.target.value)}>
                  {examSubjects.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              {countField}
              {timeField}
            </div>
          )}
        </>
      )}

      {kind === 'custom' && (
        <>
          <span className={label}>Session mode</span>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            <Choice on={style === 'practice'} title='Practice mode' text='See the answer and an explanation after each question. No timer.' onClick={() => setStyle('practice')} />
            <Choice
              on={style === 'exam'}
              title='Exam mode'
              text='Timed, with no answers until you submit. Includes the question grid, flagging and calculator.'
              onClick={() => setStyle('exam')}
            />
          </div>
          <span className={label}>Subjects</span>
          <div className='flex flex-wrap gap-1.5'>
            {examSubjects.map((s) => (
              <button
                key={s}
                type='button'
                aria-pressed={subs.includes(s)}
                className={`${chip} ${subs.includes(s) ? chipOn : ''}`}
                onClick={() => setSubs((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
              >
                {s}
              </button>
            ))}
          </div>
          <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3'>
            {yearField}
            {diffField}
            {orderField}
            {style === 'exam' && timeField}
          </div>
          <span className={label}>Questions per subject</span>
          <div className={card}>
            {subs.length ? (
              subs.map((s) => {
                const a = availIn(s)
                const v = perCap(s)
                return (
                  <div key={s} className='flex items-center justify-between gap-3 border-b border-slate-50 py-2 last:border-0 dark:border-zinc-800'>
                    <span className='min-w-0'>
                      <b className='block text-[14px] font-black text-slate-800 dark:text-white'>{s}</b>
                      <small className='text-[11px] text-slate-400'>{fN(a)} available</small>
                    </span>
                    <select
                      aria-label={`Questions from ${s}`}
                      className={`${selCls} w-40`}
                      value={v}
                      onChange={(e) => {
                        const x = Number(e.target.value)
                        if (L.ps !== null && x > L.ps) return onLock('ps')
                        setPerSubject((p) => ({ ...p, [s]: x }))
                      }}
                    >
                      {[...new Set([...COUNT_STEPS.filter((x) => x < a), a, v])]
                        .sort((x, y) => x - y)
                        .map((x) => (
                          <option key={x} value={x}>
                            {x === a ? `All (${fN(a)})` : fN(x)}
                            {L.ps !== null && x > L.ps ? ' 🔒' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )
              })
            ) : (
              <p className='text-[13px] text-slate-400'>Select at least one subject above.</p>
            )}
          </div>
          <p className='mt-2 text-[12px] text-slate-500'>
            {style === 'exam'
              ? 'In exam mode, answers and explanations appear after you submit.'
              : 'In practice mode, you see each answer straight after you reply.'}
          </p>
        </>
      )}

      {kind === 'topic' && (
        <>
          <div className='mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            <Field title='Subject'>
              <select
                className={selCls}
                value={subj}
                onChange={(e) => {
                  setSubject(e.target.value)
                  setTopic('All')
                }}
              >
                {allSubjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field title='Topic'>
              <select className={selCls} value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value='All'>All topics</option>
                {topicsFor.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            {yearField}
            {diffField}
            {orderField}
            {countField}
          </div>
          <p className='mt-2 text-[12px] text-slate-500'>
            Topic practice uses questions from every exam.
            {meta.seenBySubject[subj] ? ` You have seen ${fN(meta.seenBySubject[subj])} ${subj} questions so far.` : ''}
          </p>
        </>
      )}

      {!isFull && remaining === 0 && (
        <div className='mt-4 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-800'>
          <b className='block'>You have used today’s questions</b>
          Your {meta.tier} plan includes {unl(L.day)} a day and resets at midnight. You can still review results and check progress.{' '}
          <button type='button' className='font-black underline' onClick={onPlans}>
            See plans
          </button>
        </div>
      )}
      {!isFull && cap !== null && n > cap && remaining !== 0 && (
        <div className='mt-4 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-800'>
          <b className='block'>Shortened to {fN(nEff)} questions</b>
          {L.sess !== null && cap === L.sess
            ? `Your ${meta.tier} plan allows up to ${unl(L.sess)} questions in one session.`
            : `You have ${unl(remaining)} questions left today on your ${meta.tier} plan.`}{' '}
          <button type='button' className='font-black underline' onClick={onPlans}>
            See plans
          </button>
        </div>
      )}
      {nEff > 300 && !timed && (
        <div className='mt-4 rounded-2xl bg-blue-50 p-3 text-[13px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-200'>
          <b className='block'>{fN(nEff)} questions is a long session</b>
          Your progress is saved after every answer, so you can stop and continue later.
        </div>
      )}
      {!n && year !== 'All' && (
        <p className='mt-4 text-[13px] text-slate-500'>
          No questions match that combination.{' '}
          <button type='button' className='font-black text-[#002EFF]' onClick={() => setYear('All')}>
            Show all years
          </button>
        </p>
      )}

      <StartBar title={`${fN(nEff)} question${nEff === 1 ? '' : 's'}`} sub={err || `${summaryLine}${timed ? '' : ` · about ${estMin} min`}`}>
        <button type='button' className={btn} disabled={!!err} onClick={() => setStage('summary')}>
          Review settings
        </button>
      </StartBar>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className='flex items-start justify-between gap-3 border-b border-slate-50 py-2 last:border-0 dark:border-zinc-800'>
      <span className='shrink-0 text-[13px] text-slate-500'>{k}</span>
      <b className='min-w-0 text-right text-[13px] font-black text-slate-800 dark:text-white'>{v}</b>
    </div>
  )
}

function StartBar({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className='fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95'>
      <div className='mx-auto flex max-w-3xl items-center justify-between gap-3'>
        <p className='min-w-0'>
          <b className='block text-[15px] font-black text-slate-900 dark:text-white'>{title}</b>
          <small className='block text-[12px] leading-snug text-slate-500'>{sub}</small>
        </p>
        {children}
      </div>
    </div>
  )
}

export { btnAlt }
