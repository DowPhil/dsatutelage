'use client'

import { useCallback, useEffect, useState } from 'react'
import { dsaApi } from '@/lib/api'
import type { CbtInsights } from '@/lib/cbt-types'
import type { CbtNav } from './CbtPlatform'
import { ErrorNote, HBar, Kpi, Loading, Panel, VBars, btnAlt, fN, pct } from './ui'

const HOUR_BANDS: [string, number, number][] = [
  ['Before 6am', 0, 5],
  ['6 to 9am', 6, 8],
  ['9am to 12', 9, 11],
  ['12 to 3pm', 12, 14],
  ['3 to 6pm', 15, 17],
  ['6 to 9pm', 18, 20],
  ['9pm to 12', 21, 23],
]

const SCORE_BANDS: [string, number, number][] = [
  ['0 to 149', 0, 149],
  ['150 to 199', 150, 199],
  ['200 to 249', 200, 249],
  ['250 to 299', 250, 299],
  ['300 to 400', 300, 400],
]

/** Topics need this many answers before their accuracy is worth showing. */
const MIN_TOPIC_ANSWERS = 30

export default function InsightsTab({ token, go }: { token?: string; go: (n: CbtNav) => void }) {
  const [data, setData] = useState<CbtInsights | null>(null)
  const [error, setError] = useState('')

  const [reload, setReload] = useState(0)
  const load = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    let off = false
    dsaApi.cbt.admin
      .insights(token)
      .then((d) => {
        if (off) return
        setData(d)
        setError('')
      })
      .catch((e) => !off && setError(e instanceof Error ? e.message : 'Could not load insights'))
    return () => {
      off = true
    }
  }, [token, reload])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!data) return <Loading />

  const t = data.totals
  const topics = data.topics
    .filter((x) => x.answers >= MIN_TOPIC_ANSWERS)
    .map((x) => ({ ...x, p: pct(x.correct, x.answers) }))
    .sort((a, b) => a.p - b.p)
  const gaps = data.topicSizes.filter((x) => x.questions < 6)
  const hours = HOUR_BANDS.map(([l, a, b]) => ({ l, v: data.hourly.slice(a, b + 1).reduce((s, n) => s + n, 0) }))
  const hourTotal = hours.reduce((s, h) => s + h.v, 0)
  const busiest = [...hours].sort((a, b) => b.v - a.v)[0]
  const totalAnswers = data.subjects.reduce((s, x) => s + x.answers, 0)

  const finds: { title: string; body: string; nav?: CbtNav; action?: string }[] = []
  if (t.silverHit3)
    finds.push({
      title: `${t.silverHit3} Silver student${t.silverHit3 === 1 ? '' : 's'} reached the daily limit 3 or more times this week`,
      body: `That is ${pct(t.silverHit3, t.silverActive7)}% of active Silver students. They are your strongest upgrade candidates.`,
      nav: { tab: 'students', studentTier: 'candidates' },
      action: 'See students',
    })
  if (topics.length)
    finds.push({
      title: `${topics[0].subject}: ${topics[0].topic || 'No topic'} has the lowest accuracy, ${topics[0].p}%`,
      body: `Across ${fN(topics[0].answers)} answers.${topics.length > 1 ? ` Next weakest: ${topics.slice(1, 3).map((x) => `${x.topic} (${x.p}%)`).join(', ')}.` : ''} Worth a class or better explanations.`,
      nav: { tab: 'bank', bankSubject: topics[0].subject, bankTopic: topics[0].topic },
      action: 'See questions',
    })
  if (data.bank.heavilyReported)
    finds.push({
      title: `${data.bank.heavilyReported} question${data.bank.heavilyReported === 1 ? ' has' : 's have'} 3 or more reports`,
      body: 'Wrong answers are what students distrust most. Fix these first.',
      nav: { tab: 'reports' },
      action: 'Open reports',
    })
  if (data.bank.total)
    finds.push({
      title: `${pct(data.bank.unchecked, data.bank.total)}% of the bank is not yet marked as checked`,
      body: `${fN(data.bank.unchecked)} questions. ${fN(data.bank.noExplanation)} also have no explanation.`,
      nav: { tab: 'bank', bankStatus: 'unchecked' },
      action: 'Review bank',
    })
  if (gaps.length)
    finds.push({
      title: `${gaps.length} topic${gaps.length === 1 ? ' has' : 's have'} fewer than 6 questions`,
      body: `${gaps.slice(0, 3).map((x) => `${x.subject} · ${x.topic || 'No topic'} (${x.questions})`).join(', ')}. Students run out of new questions here quickly.`,
      nav: { tab: 'bank', bankSubject: gaps[0].subject, bankTopic: gaps[0].topic },
      action: 'Add questions',
    })
  if (t.quietPaying)
    finds.push({
      title: `${t.quietPaying} paying student${t.quietPaying === 1 ? ' has' : 's have'} not practised in 14 days`,
      body: 'Gold and Elite students who went quiet. A reminder from their tutor could win them back.',
      nav: { tab: 'students', studentTier: 'Gold' },
      action: 'See students',
    })
  if (hourTotal)
    finds.push({
      title: `Most practice happens ${busiest.l.toLowerCase().startsWith('before') ? busiest.l.toLowerCase() : `between ${busiest.l.replace(' to ', ' and ')}`}`,
      body: `${pct(busiest.v, hourTotal)}% of answers in the last 30 days. A good time for live classes, reminders and announcements.`,
    })

  const todayIdx = data.daily.length - 1

  return (
    <div className='min-w-0 space-y-4'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-5'>
        <Kpi value={fN(t.active7)} label='Active students, last 7 days' sub={`${pct(t.active7, t.students)}% of ${fN(t.students)}`} />
        <Kpi value={fN(t.answered7)} label='Questions answered, last 7 days' />
        <Kpi value={fN(t.mocks30)} label='Full mocks taken, last 30 days' sub={`${pct(t.mockTakers30, t.active30)}% of active students took one`} />
        <Kpi value={t.mockAverage ?? '–'} label='Average full-mock score (out of 400)' sub={`${data.mockAverages.length} students`} />
        <Kpi value={fN(t.limitHitStudents)} label='Students who hit a limit this week' sub={`${t.limitHit3} hit it 3 or more times`} />
      </div>

      <Panel title='What stands out'>
        {finds.length ? (
          <ul className='divide-y divide-slate-100 dark:divide-slate-800'>
            {finds.map((f) => (
              <li key={f.title} className='flex flex-wrap items-center justify-between gap-3 py-3'>
                <p className='min-w-0 flex-1'>
                  <b className='block text-[13px] font-black text-slate-800 dark:text-slate-100'>{f.title}</b>
                  <small className='text-[11px] font-medium text-slate-500'>{f.body}</small>
                </p>
                {f.nav && (
                  <button type='button' className={btnAlt} onClick={() => go(f.nav!)}>
                    {f.action}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-[12px] font-medium text-slate-400'>
            Nothing yet. Findings appear once students start practising.
          </p>
        )}
      </Panel>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Panel title='Questions answered per day'>
          <VBars
            label='Questions answered for each of the last 14 days'
            highlight={todayIdx}
            data={data.daily.map((d) => ({
              l: new Date(`${d.date}T12:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short' }),
              v: d.answered,
            }))}
          />
        </Panel>
        <Panel title='When students practise' hint='Answers by time of day, last 30 days (Lagos time).'>
          <VBars label='Answers by time of day' data={hours} />
        </Panel>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Panel title='Accuracy by subject' hint={`Share of answers that were correct, across ${fN(totalAnswers)} answers.`}>
          {data.subjects.length ? (
            data.subjects.map((s) => <HBar key={s.subject} label={s.subject} value={pct(s.correct, s.answers)} />)
          ) : (
            <p className='text-[12px] text-slate-400'>No answers yet.</p>
          )}
        </Panel>
        <Panel title='Average full-mock score' hint='Number of students in each score band, last 30 days.'>
          <VBars
            label='Number of students in each score band'
            data={SCORE_BANDS.map(([l, a, b]) => ({ l, v: data.mockAverages.filter((m) => m >= a && m <= b).length }))}
          />
        </Panel>
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <Panel
          title='Students by plan'
          hint={data.tiers.map((x) => `${x.tier}: ${pct(x.active7, x.students)}% active this week`).join(' · ')}
        >
          {data.tiers.map((x) => (
            <HBar key={x.tier} label={x.tier} value={pct(x.students, t.students)} text={fN(x.students)} />
          ))}
        </Panel>
        <Panel title='Weakest topics, all students' hint={`Lowest accuracy, topics with at least ${MIN_TOPIC_ANSWERS} answers.`}>
          {topics.slice(0, 7).map((x) => (
            <HBar key={x.subject + x.topic} label={`${x.topic || 'No topic'}`} value={x.p} />
          ))}
          {!topics.length && <p className='text-[12px] text-slate-400'>Not enough answers yet.</p>}
        </Panel>
        <Panel title='Strongest topics'>
          {[...topics].reverse().slice(0, 7).map((x) => (
            <HBar key={x.subject + x.topic} label={`${x.topic || 'No topic'}`} value={x.p} />
          ))}
          {!topics.length && <p className='text-[12px] text-slate-400'>Not enough answers yet.</p>}
        </Panel>
      </div>

      <Panel
        title='Hardest questions'
        hint="Very low accuracy can mean the question is hard, or that the answer key is wrong. Worth a tutor's look."
      >
        {data.hardest.length ? (
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[640px] text-left'>
              <thead>
                <tr className='text-[9px] font-black uppercase text-slate-400'>
                  <th className='py-2 pr-3'>Question</th>
                  <th className='py-2 pr-3'>Subject and topic</th>
                  <th className='py-2 pr-3 text-right'>Answers</th>
                  <th className='py-2 pr-3 text-right'>Correct</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.hardest.map((q) => (
                  <tr key={q.id} className='border-t border-slate-50 text-[12px] dark:border-slate-800'>
                    <td className='max-w-[280px] truncate py-2 pr-3 font-semibold text-slate-700 dark:text-slate-200' title={q.text}>
                      {q.text}
                    </td>
                    <td className='py-2 pr-3 text-slate-500'>
                      {q.subject} · {q.topic}
                    </td>
                    <td className='py-2 pr-3 text-right font-bold'>{fN(q.attempts)}</td>
                    <td className='py-2 pr-3 text-right font-bold'>{q.correctPct}%</td>
                    <td className='py-2 text-right'>
                      <button type='button' className={btnAlt} onClick={() => go({ tab: 'bank', editQuestion: q.id })}>
                        Check this question
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className='text-[12px] text-slate-400'>Questions appear here once they have 20 or more answers.</p>
        )}
      </Panel>
    </div>
  )
}
