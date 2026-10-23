'use client'

// The CBT Practice home: Overview (continue / daily drill, plan, JAMB mock,
// streak, leaderboard, weak topics, saved questions, recent attempts),
// Progress (mock results, prediction, trend, accuracy by subject and topic,
// every attempt) and the Leaderboard.

import { useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { dsaApi } from '@/lib/api'
import type { CbtLeaderboard, CbtMeta, CbtProgress, CbtSession, CbtSessionSummary } from '@/lib/cbt-types'
import { btn, btnAlt, card, chip, chipOn, fN, firstName, initials, label, unl } from './shared'

export type HomeView = 'home' | 'prog' | 'lb'

const TARGET_KEY = 'dsa_cbt_target'
const readTarget = () => {
  try {
    const v = Number(localStorage.getItem(TARGET_KEY))
    return v >= 100 && v <= 400 ? v : 250
  } catch {
    return 250
  }
}

const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 3600e3).toISOString().slice(0, 10)

export default function Home({
  view,
  setView,
  meta,
  name,
  open,
  sessions,
  progress,
  savedCount,
  onNew,
  onResume,
  onDrill,
  onSaved,
  onPractiseTopic,
  onPractiseSubject,
  onOpenAttempt,
  onFullMock,
  onPlans,
  onLock,
}: {
  view: HomeView
  setView: (v: HomeView) => void
  meta: CbtMeta
  name: string
  open: CbtSession | null
  sessions: CbtSessionSummary[]
  progress: CbtProgress | null
  savedCount: number
  onNew: () => void
  onResume: () => void
  onDrill: () => void
  onSaved: () => void
  onPractiseTopic: (subject: string, topic: string) => void
  onPractiseSubject: (subject: string) => void
  onOpenAttempt: (id: string) => void
  onFullMock: () => void
  onPlans: () => void
  onLock: (code: string) => void
}) {
  const [target, setTarget] = useState(readTarget)
  const saveTarget = (v: number) => {
    const t = Math.max(100, Math.min(400, Math.round(v)))
    setTarget(t)
    try {
      localStorage.setItem(TARGET_KEY, String(t))
    } catch {
      /* a per-device convenience only */
    }
  }

  const [weekBoard, setWeekBoard] = useState<CbtLeaderboard | null>(null)
  useEffect(() => {
    dsaApi.cbt
      .leaderboard('week')
      .then(setWeekBoard)
      .catch(() => setWeekBoard(null))
  }, [sessions.length])

  const tierCls = { Free: 'bg-slate-100 text-slate-600', Silver: 'bg-slate-200 text-slate-700', Gold: 'bg-amber-100 text-amber-800', Elite: 'bg-violet-100 text-violet-800' }[meta.tier]

  return (
    <div className='mx-auto max-w-4xl pb-10'>
      {meta.banner && (
        <div className='mb-4 rounded-2xl bg-[#002EFF] p-3 text-[13px] font-bold text-white'>{meta.banner}</div>
      )}
      {meta.maintenance && (
        <div className='mb-4 rounded-2xl bg-amber-50 p-3 text-[13px] font-bold text-amber-800'>
          CBT Practice is paused for maintenance. You can still look at your results. Please try again later.
        </div>
      )}

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#002EFF] text-[15px] font-black text-white'>
            {initials(name)}
          </span>
          <div className='min-w-0'>
            <h1 className='truncate text-[20px] font-black text-slate-900 sm:text-[22px] dark:text-white'>Welcome back, {firstName(name)}</h1>
            <p className='text-[13px] text-slate-500'>
              <span className={`mr-1.5 rounded-full px-2 py-0.5 text-[11px] font-black ${tierCls}`}>{meta.tier}</span>
              Your CBT practice progress.
            </p>
          </div>
        </div>
        <button type='button' className={btnAlt} onClick={onNew} disabled={meta.maintenance}>
          New practice session
        </button>
      </div>

      <div className='mb-5 mt-4 inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-zinc-800'>
        {(
          [
            ['home', 'Overview'],
            ['prog', 'Progress'],
            ['lb', 'Leaderboard'],
          ] as [HomeView, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            type='button'
            onClick={() => setView(k)}
            aria-pressed={view === k}
            className={`min-h-[36px] rounded-xl px-4 text-[13px] font-black ${
              view === k ? 'bg-white text-[#002EFF] shadow-sm dark:bg-zinc-900' : 'text-slate-500'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {view === 'home' && (
        <Overview
          meta={meta}
          open={open}
          sessions={sessions}
          progress={progress}
          savedCount={savedCount}
          target={target}
          weekBoard={weekBoard}
          setView={setView}
          onResume={onResume}
          onDrill={onDrill}
          onSaved={onSaved}
          onPractiseTopic={onPractiseTopic}
          onOpenAttempt={onOpenAttempt}
          onFullMock={onFullMock}
          onPlans={onPlans}
          onLock={onLock}
        />
      )}
      {view === 'prog' && (
        <ProgressView
          meta={meta}
          sessions={sessions}
          progress={progress}
          target={target}
          saveTarget={saveTarget}
          onPractiseTopic={onPractiseTopic}
          onPractiseSubject={onPractiseSubject}
          onOpenAttempt={onOpenAttempt}
          onFullMock={onFullMock}
          onLock={onLock}
        />
      )}
      {view === 'lb' && <Board meta={meta} onDrill={onDrill} />}
    </div>
  )
}

function AttemptRow({ s, onOpen }: { s: CbtSessionSummary; onOpen: () => void }) {
  const p = s.percent
  const tone = p >= 70 ? 'text-emerald-600' : p >= 40 ? 'text-amber-600' : 'text-rose-600'
  const subj = s.subjects.length > 2 ? `${s.subjects.length} subjects` : s.subjects.join(' + ')
  return (
    <button
      type='button'
      onClick={onOpen}
      className='flex w-full items-center justify-between gap-3 border-b border-slate-50 py-3 text-left last:border-0 dark:border-zinc-800'
    >
      <span className='min-w-0'>
        <b className='block truncate text-[14px] font-black text-slate-800 dark:text-white'>
          {subj} · {s.label}
        </b>
        <small className='text-[12px] text-slate-500'>
          {s.timed ? 'Timed session' : 'Untimed practice'} ·{' '}
          {new Date(s.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </small>
      </span>
      <em className={`shrink-0 text-[13px] font-black not-italic ${tone}`}>
        {s.jambScore !== null ? `${s.jambScore}/400` : `${s.correct}/${s.total} · ${p}%`}
      </em>
    </button>
  )
}

function streakOf(sessions: CbtSessionSummary[], now: number) {
  const days = new Set(sessions.map((s) => dayKey(s.submittedAt)))
  const today = dayKey(new Date(now).toISOString())
  const back = (n: number) => dayKey(new Date(now - n * 864e5).toISOString())
  let streak = 0
  for (let k = days.has(today) ? 0 : 1; days.has(back(k)); k += 1) streak += 1
  return { streak, days, today, back }
}

function weakTopics(progress: CbtProgress | null) {
  if (!progress) return []
  return progress.topics.filter((t) => t.total >= progress.weakMinAttempts && t.topic && t.correct / t.total < 0.7)
}

function TopicRows({
  rows,
  max,
  onPractise,
}: {
  rows: { subject: string; topic: string; correct: number; total: number }[]
  max?: number
  onPractise: (subject: string, topic: string) => void
}) {
  const bySubject = new Map<string, typeof rows>()
  rows.forEach((r) => bySubject.set(r.subject, [...(bySubject.get(r.subject) || []), r]))
  if (!rows.length)
    return <p className={`${card} text-[13px] text-slate-400`}>Nothing yet. Finish a few sessions and your topics appear here.</p>
  return (
    <div className='space-y-3'>
      {[...bySubject.entries()].map(([s, list]) => (
        <div key={s} className={card}>
          <b className='mb-1 block text-[12px] font-black uppercase tracking-wider text-slate-400'>{s}</b>
          {list.slice(0, max ?? list.length).map((t) => {
            const p = Math.round((t.correct / t.total) * 100)
            return (
              <div key={t.topic} className='flex items-center gap-2 py-1.5'>
                <span className='min-w-0 flex-1'>
                  <b className='block truncate text-[13px] font-bold text-slate-800 dark:text-white'>{t.topic || 'Other'}</b>
                  <small className='text-[11px] text-slate-400'>
                    {t.correct} of {t.total} correct
                  </small>
                </span>
                <span className='h-2 w-16 overflow-hidden rounded-full bg-slate-100 sm:w-28 dark:bg-zinc-800'>
                  <span className='block h-full bg-[#002EFF]' style={{ width: `${p}%` }} />
                </span>
                <span className='w-10 text-right text-[12px] font-black'>{p}%</span>
                {t.topic && (
                  <button type='button' className={chip} onClick={() => onPractise(t.subject, t.topic)}>
                    Practise
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Overview({
  meta,
  open,
  sessions,
  progress,
  savedCount,
  target,
  weekBoard,
  setView,
  onResume,
  onDrill,
  onSaved,
  onPractiseTopic,
  onOpenAttempt,
  onFullMock,
  onPlans,
  onLock,
}: {
  meta: CbtMeta
  open: CbtSession | null
  sessions: CbtSessionSummary[]
  progress: CbtProgress | null
  savedCount: number
  target: number
  weekBoard: CbtLeaderboard | null
  setView: (v: HomeView) => void
  onResume: () => void
  onDrill: () => void
  onSaved: () => void
  onPractiseTopic: (subject: string, topic: string) => void
  onOpenAttempt: (id: string) => void
  onFullMock: () => void
  onPlans: () => void
  onLock: (code: string) => void
}) {
  const L = meta.limits
  const weak = weakTopics(progress)
  const [now] = useState(() => Date.now())
  const { streak, days, today, back } = streakOf(sessions, now)
  const mocks = progress?.mocks || []
  const pr = progress?.prediction

  return (
    <>
      {open ? (
        <div className={`${card} flex flex-wrap items-center justify-between gap-3 border-[#002EFF]`}>
          <p className='min-w-0'>
            <b className='block text-[15px] font-black text-slate-900 dark:text-white'>Continue your attempt</b>
            <span className='text-[13px] text-slate-500'>
              {open.label} · {open.answers.filter((a) => a !== null).length} of {open.questions.length} answered
            </span>
          </p>
          <button type='button' className={btn} onClick={onResume}>
            Continue
          </button>
        </div>
      ) : (
        <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <p className='min-w-0'>
            <b className='block text-[15px] font-black text-slate-900 dark:text-white'>{sessions.length ? 'Daily drill' : 'Start your first drill'}</b>
            <span className='text-[13px] text-slate-500'>
              {weak[0]
                ? `${meta.rules.drillQuestions} questions on ${weak[0].topic}. About ${meta.rules.drillQuestions} minutes.`
                : `${meta.rules.drillQuestions} mixed questions. About ${meta.rules.drillQuestions} minutes.`}
            </span>
          </p>
          <button type='button' className={btn} onClick={onDrill} disabled={meta.maintenance || !meta.catalogue.length}>
            Start drill
          </button>
        </div>
      )}

      <button type='button' onClick={onPlans} className={`${card} mt-3 flex w-full items-center justify-between gap-3 text-left`}>
        <span className='min-w-0'>
          <b className='block text-[14px] font-black text-slate-900 dark:text-white'>{meta.tier} plan</b>
          <small className='text-[12px] text-slate-500'>
            {meta.tier === 'Elite'
              ? 'Unlimited practice and full mocks'
              : `Today: ${fN(Math.min(L.day ?? Infinity, meta.usage.answeredToday))} of ${unl(L.day)} questions · Full mocks this month: ${meta.usage.mocksThisMonth} of ${unl(L.mocks)}`}
          </small>
        </span>
        <em className='shrink-0 text-[13px] font-black not-italic text-[#002EFF]'>{meta.tier === 'Elite' ? 'Details' : 'See plans'}</em>
      </button>

      <span className={label}>JAMB mock</span>
      {!mocks.length ? (
        <div className={card}>
          <b className='block text-[15px] font-black text-slate-900 dark:text-white'>No full JAMB mock yet</b>
          <p className='mt-1 text-[13px] text-slate-500'>Take a full mock to see your average out of 400 and a predicted score.</p>
          <button type='button' className={`${btnAlt} mt-3`} onClick={onFullMock}>
            Start a full mock
          </button>
        </div>
      ) : (
        <div className={`${card} grid gap-4 sm:grid-cols-2`}>
          {pr ? (
            <div>
              <small className='text-[12px] font-bold text-slate-500'>Predicted JAMB score</small>
              <div className='text-[40px] font-black leading-tight text-[#002EFF]'>{pr.score}</div>
              <span className='text-[12px] text-slate-500'>
                {pr.low} to {pr.high}. {pr.score - target >= 0 ? `${pr.score - target} above` : `${target - pr.score} below`} your target of {target}.
              </span>
            </div>
          ) : (
            <button type='button' className='text-left' onClick={() => onLock('pred')}>
              <small className='text-[12px] font-bold text-slate-500'>Predicted JAMB score</small>
              <div className='flex items-center gap-2 text-[32px] font-black text-slate-300'>
                <Lock size={26} /> ---
              </div>
              <span className='text-[12px] font-bold text-[#002EFF]'>Locked. Tap to unlock.</span>
            </button>
          )}
          <div className='grid grid-cols-3 gap-2 text-center'>
            {[
              [Math.round(mocks.reduce((a, m) => a + m.score, 0) / mocks.length), 'Mock average'],
              [Math.max(...mocks.map((m) => m.score)), 'Best'],
              [mocks.length, 'Full mocks'],
            ].map(([v, l]) => (
              <div key={l as string} className='rounded-2xl bg-slate-50 p-2 dark:bg-zinc-800'>
                <b className='block text-[18px] font-black text-slate-900 dark:text-white'>{v}</b>
                <span className='text-[11px] text-slate-500'>{l}</span>
              </div>
            ))}
          </div>
          <button type='button' className='text-left text-[13px] font-black text-[#002EFF] sm:col-span-2' onClick={() => setView('prog')}>
            {pr ? 'See monthly trend and details' : 'See your mock results'}
          </button>
        </div>
      )}

      <div className='mt-4 grid gap-3 sm:grid-cols-2'>
        <div className={card}>
          <b className='text-[12px] font-black uppercase tracking-wider text-slate-400'>Practice streak</b>
          <div className='mt-1 text-[24px] font-black text-slate-900 dark:text-white'>
            {streak ? `${streak} day${streak === 1 ? '' : 's'}` : 'No streak yet'}
          </div>
          <p className='text-[12px] text-slate-500'>
            {days.has(today) ? 'You’ve practised today. Keep it going tomorrow.' : `Practise today to ${streak ? 'keep it going.' : 'start one.'}`}
          </p>
          <div className='mt-3 flex justify-between'>
            {[6, 5, 4, 3, 2, 1, 0].map((k) => (
              <span key={k} className='flex flex-col items-center gap-1 text-[10px] font-bold text-slate-400'>
                <i className={`h-6 w-6 rounded-full ${days.has(back(k)) ? 'bg-[#002EFF]' : 'bg-slate-100 dark:bg-zinc-800'}`} />
                {new Date(now - k * 864e5).toLocaleDateString('en', { weekday: 'narrow' })}
              </span>
            ))}
          </div>
        </div>
        <div className={card}>
          <b className='text-[12px] font-black uppercase tracking-wider text-slate-400'>Weekly leaderboard</b>
          <div className='mt-1 text-[24px] font-black text-slate-900 dark:text-white'>
            {weekBoard?.enabled === false ? 'Off' : weekBoard?.mine ? `#${weekBoard.mine.rank}` : 'Not ranked'}
          </div>
          <p className='text-[12px] text-slate-500'>
            {weekBoard?.mine
              ? `of ${weekBoard.total} students · ${weekBoard.mine.points} points`
              : weekBoard?.enabled === false
                ? 'The leaderboard is switched off.'
                : 'Finish a session to join the ranking.'}
          </p>
          {weekBoard?.enabled !== false && (
            <button type='button' className={`${chip} mt-3`} onClick={() => setView('lb')}>
              View leaderboard
            </button>
          )}
        </div>
      </div>

      <span className={label}>Topics to work on</span>
      <TopicRows rows={weak} max={2} onPractise={onPractiseTopic} />

      {savedCount > 0 && (
        <>
          <span className={label}>Saved questions</span>
          <div className={`${card} flex items-center justify-between gap-3`}>
            <span>
              <b className='block text-[14px] font-black text-slate-900 dark:text-white'>{savedCount} saved</b>
              <small className='text-[12px] text-slate-500'>Questions you marked to revisit</small>
            </span>
            <button type='button' className={chip} onClick={onSaved}>
              Practise
            </button>
          </div>
        </>
      )}

      <span className={label}>Recent attempts</span>
      {sessions.length ? (
        <div className={card}>
          {sessions.slice(0, 3).map((s) => (
            <AttemptRow key={s.id} s={s} onOpen={() => onOpenAttempt(s.id)} />
          ))}
          <button type='button' className='mt-2 text-[13px] font-black text-[#002EFF]' onClick={() => setView('prog')}>
            See all attempts
          </button>
        </div>
      ) : (
        <p className={`${card} text-[13px] text-slate-400`}>No attempts yet. Your last attempts will appear here.</p>
      )}
    </>
  )
}

function ProgressView({
  meta,
  sessions,
  progress,
  target,
  saveTarget,
  onPractiseTopic,
  onPractiseSubject,
  onOpenAttempt,
  onFullMock,
  onLock,
}: {
  meta: CbtMeta
  sessions: CbtSessionSummary[]
  progress: CbtProgress | null
  target: number
  saveTarget: (v: number) => void
  onPractiseTopic: (subject: string, topic: string) => void
  onPractiseSubject: (subject: string) => void
  onOpenAttempt: (id: string) => void
  onFullMock: () => void
  onLock: (code: string) => void
}) {
  const mocks = progress?.mocks || []
  const pr = progress?.prediction
  const subjAll = useMemo(() => [...new Set(meta.catalogue.map((c) => c.subject))].sort(), [meta.catalogue])
  const inBank = (s: string) => meta.catalogue.filter((c) => c.subject === s).reduce((a, c) => a + c.count, 0)
  const avg = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.percent, 0) / sessions.length) : null
  const answered = sessions.reduce((a, s) => a + s.total, 0)
  const best = [...(progress?.subjects || [])].sort((a, b) => b.correct / b.total - a.correct / a.total)[0]
  const last8 = [...sessions].slice(0, 8).reverse()

  return (
    <>
      <span className={`${label} mt-0`}>JAMB mock results</span>
      {!mocks.length ? (
        <div className={card}>
          <b className='block text-[15px] font-black text-slate-900 dark:text-white'>No full JAMB mock yet</b>
          <p className='mt-1 text-[13px] text-slate-500'>Take a full mock to see your average out of 400, a predicted score and your monthly trend.</p>
          <button type='button' className={`${btn} mt-3`} onClick={onFullMock}>
            Start a full mock
          </button>
        </div>
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            <Tile
              v={Math.round(mocks.reduce((a, m) => a + m.score, 0) / mocks.length)}
              l='Mock average (out of 400)'
              s={`${mocks.length} full mock${mocks.length === 1 ? '' : 's'}`}
            />
            <Tile v={Math.max(...mocks.map((m) => m.score))} l='Best mock' />
            <Tile
              v={mocks[mocks.length - 1].score}
              l='Latest mock'
              s={
                mocks.length > 1
                  ? `${mocks[mocks.length - 1].score - mocks[mocks.length - 2].score >= 0 ? '+' : '−'}${Math.abs(mocks[mocks.length - 1].score - mocks[mocks.length - 2].score)} from the one before`
                  : ''
              }
            />
            {pr ? (
              <Tile v={pr.score} l='Predicted score' s={`${pr.low} to ${pr.high}`} />
            ) : (
              <button type='button' onClick={() => onLock('pred')} className='rounded-2xl border border-slate-100 bg-white p-3 text-left dark:border-zinc-800 dark:bg-zinc-900'>
                <b className='flex items-center gap-1 text-[20px] font-black text-slate-300'>
                  <Lock size={18} />
                </b>
                <span className='block text-[11px] font-bold text-slate-500'>Predicted score</span>
                <small className='text-[11px] font-bold text-[#002EFF]'>Tap to unlock</small>
              </button>
            )}
          </div>

          {progress?.trend ? (
            <div className={`${card} mt-3`}>
              <b className='text-[12px] font-black uppercase tracking-wider text-slate-400'>Monthly trend</b>
              <Columns
                data={progress.trend.map((t) => ({
                  l: new Date(`${t.month}-15T12:00:00Z`).toLocaleDateString('en', { month: 'short' }),
                  v: t.average,
                }))}
                max={progress.maxScore}
              />
              <p className='mt-2 text-[12px] text-slate-500'>Average full-mock score for each month, out of 400.</p>
            </div>
          ) : (
            <button type='button' onClick={() => onLock('trend')} className={`${card} mt-3 w-full text-left`}>
              <b className='text-[12px] font-black uppercase tracking-wider text-slate-400'>Monthly trend</b>
              <p className='mt-2 flex items-center gap-2 text-[13px] font-bold text-[#002EFF]'>
                <Lock size={14} /> Unlock your monthly trend
              </p>
            </button>
          )}

          {pr && (
            <div className={`${card} mt-3`}>
              <b className='text-[12px] font-black uppercase tracking-wider text-slate-400'>Where you are heading</b>
              <p className='mt-2 text-[14px] text-slate-700 dark:text-zinc-200'>
                If you sat JAMB today, you would score about <b>{pr.score}</b>, somewhere between {pr.low} and {pr.high}.{' '}
                {pr.score - target >= 0
                  ? `That is ${pr.score - target} point${pr.score - target === 1 ? '' : 's'} above your target.`
                  : `That is ${target - pr.score} point${target - pr.score === 1 ? '' : 's'} below your target.`}
              </p>
              <div className='mt-3 flex items-center justify-center gap-3'>
                <button type='button' className={btnAlt} aria-label='Lower JAMB target' onClick={() => saveTarget(target - 10)}>
                  −
                </button>
                <div className='text-center'>
                  <input
                    type='number'
                    min={100}
                    max={400}
                    inputMode='numeric'
                    value={target}
                    aria-label='Target JAMB score'
                    onChange={(e) => saveTarget(Number(e.target.value))}
                    className='h-12 w-24 rounded-2xl border border-slate-200 text-center text-[20px] font-black dark:border-zinc-700 dark:bg-zinc-900'
                  />
                  <small className='block text-[11px] text-slate-400'>Target score</small>
                </div>
                <button type='button' className={btnAlt} aria-label='Raise JAMB target' onClick={() => saveTarget(target + 10)}>
                  +
                </button>
              </div>
              <p className='mt-3 text-[12px] text-slate-500'>
                {pr.basedOn < 3 ? 'Early estimate. Take at least 3 full mocks for a steadier number. ' : ''}This is a weighted average of your
                last {pr.basedOn} full mock{pr.basedOn === 1 ? '' : 's'}, with the newest counted most. The real exam’s difficulty varies, so
                treat it as a guide.
              </p>
            </div>
          )}
        </>
      )}

      <span className={label}>All practice</span>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <Tile v={avg === null ? '–' : `${avg}%`} l='Average, all sessions' />
        <Tile v={sessions.length} l='Sessions taken' />
        <Tile v={fN(answered)} l='Questions answered' />
        <Tile v={best?.subject || '–'} l='Strongest subject' />
      </div>

      {last8.length > 1 && (
        <>
          <span className={label}>Accuracy per session</span>
          <div className={card}>
            <Columns data={last8.map((s, k) => ({ l: String(k + 1), v: s.percent }))} max={100} suffix='%' />
            <p className='mt-2 text-[12px] text-slate-500'>Oldest to newest. Shows your last {last8.length} sessions.</p>
          </div>
        </>
      )}

      <span className={label}>By subject</span>
      <div className={card}>
        {subjAll.map((s) => {
          const b = progress?.subjects.find((x) => x.subject === s)
          const p = b ? Math.round((b.correct / b.total) * 100) : null
          return (
            <div key={s} className='flex items-center gap-2 border-b border-slate-50 py-2 last:border-0 dark:border-zinc-800'>
              <span className='min-w-0 flex-1'>
                <b className='block text-[13px] font-black text-slate-800 dark:text-white'>{s}</b>
                <small className='text-[11px] text-slate-400'>
                  {fN(meta.seenBySubject[s] || 0)} of {fN(inBank(s))} questions seen{b ? ` · ${fN(b.total)} answered` : ''}
                </small>
              </span>
              <span className='hidden h-2 w-24 overflow-hidden rounded-full bg-slate-100 sm:block dark:bg-zinc-800'>
                <span className='block h-full bg-[#002EFF]' style={{ width: `${p || 0}%` }} />
              </span>
              <span className='w-10 text-right text-[12px] font-black'>{p === null ? '–' : `${p}%`}</span>
              <button type='button' className={chip} onClick={() => onPractiseSubject(s)}>
                Practise
              </button>
            </div>
          )
        })}
        {!subjAll.length && <p className='text-[13px] text-slate-400'>No questions yet.</p>}
      </div>

      <span className={label}>By topic</span>
      <TopicRows rows={progress?.topics || []} onPractise={onPractiseTopic} />

      <span className={label}>All attempts</span>
      {sessions.length ? (
        <div className={card}>
          {sessions.map((s) => (
            <AttemptRow key={s.id} s={s} onOpen={() => onOpenAttempt(s.id)} />
          ))}
        </div>
      ) : (
        <p className={`${card} text-[13px] text-slate-400`}>No attempts yet.</p>
      )}
    </>
  )
}

function Tile({ v, l, s }: { v: React.ReactNode; l: string; s?: string }) {
  return (
    <div className='min-w-0 rounded-2xl border border-slate-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900'>
      <b className='block truncate text-[20px] font-black text-slate-900 dark:text-white'>{v}</b>
      <span className='block text-[11px] font-bold text-slate-500'>{l}</span>
      {s && <small className='text-[11px] text-slate-400'>{s}</small>}
    </div>
  )
}

function Columns({ data, max, suffix = '' }: { data: { l: string; v: number }[]; max: number; suffix?: string }) {
  return (
    <div className='mt-3'>
      <div className='flex h-36 items-end gap-2'>
        {data.map((d, k) => (
          <div key={k} className='flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1'>
            <span className='text-[10px] font-bold text-slate-500'>
              {d.v}
              {suffix}
            </span>
            <div className='w-full max-w-[36px] rounded-t-lg bg-[#002EFF]' style={{ height: `${Math.max(3, (d.v / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className='mt-1 flex gap-2'>
        {data.map((d, k) => (
          <span key={k} className='min-w-0 flex-1 truncate text-center text-[10px] font-bold text-slate-400'>
            {d.l}
          </span>
        ))}
      </div>
    </div>
  )
}

const PERIOD_LABEL = { day: 'Today', week: 'This week', month: 'This month' } as const
const PERIOD_WORD = { day: 'today', week: 'this week', month: 'this month' } as const

function Board({ meta, onDrill }: { meta: CbtMeta; onDrill: () => void }) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [data, setData] = useState<CbtLeaderboard | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    dsaApi.cbt
      .leaderboard(period)
      .then((d) => {
        setData(d)
        setError('')
        setNow(Date.now())
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the leaderboard'))
  }, [period])

  if (data && !data.enabled) return <p className={`${card} text-[13px] text-slate-500`}>The leaderboard is switched off for now.</p>

  const rows = data?.rows || []
  const mine = data?.mine || null
  const top = rows.slice(0, 10)
  const resetIn = data?.resetsAt ? Math.max(0, new Date(data.resetsAt).getTime() - now) : 0
  const hrs = Math.ceil(resetIn / 36e5)
  const ahead = mine && mine.rank > 1 ? rows[mine.rank - 2] : null

  return (
    <>
      <div className='mb-3 flex flex-wrap gap-1.5'>
        {(['day', 'week', 'month'] as const).map((k) => (
          <button key={k} type='button' className={`${chip} ${period === k ? chipOn : ''}`} onClick={() => setPeriod(k)}>
            {PERIOD_LABEL[k]}
          </button>
        ))}
      </div>
      <p className='mb-3 text-[13px] text-slate-500'>
        Everyone on DSA is ranked together. Resets in {hrs < 24 ? `${hrs} hr` : `${Math.ceil(hrs / 24)} days`}. Points for each question you get
        right. Practice and exam sessions both count. Ties go to the higher accuracy.
      </p>
      {error && <p className='mb-3 rounded-2xl bg-rose-50 p-3 text-[13px] font-bold text-rose-700'>{error}</p>}
      <div className={`${card} mb-3 flex flex-wrap items-center justify-between gap-3`}>
        <p className='min-w-0'>
          <b className='block text-[15px] font-black text-slate-900 dark:text-white'>
            {!mine ? 'You are not ranked yet' : mine.rank === 1 ? `You are #1 ${PERIOD_WORD[period]}` : `You are #${mine.rank} of ${data?.total}`}
          </b>
          <span className='text-[13px] text-slate-500'>
            {!mine
              ? `Finish a session ${PERIOD_WORD[period]} to join the leaderboard.`
              : ahead
                ? `${ahead.points - mine.points + 1} more point${ahead.points - mine.points ? 's' : ''} to pass ${ahead.name}.`
                : 'Keep going to hold your place.'}
          </span>
        </p>
        <button type='button' className={btn} onClick={onDrill} disabled={meta.maintenance}>
          Start drill
        </button>
      </div>
      <div className={card}>
        {top.map((r) => (
          <LbRow key={r.rank} r={r} />
        ))}
        {mine && mine.rank > 10 && (
          <>
            <div className='py-1 text-center text-slate-300' aria-hidden='true'>
              ···
            </div>
            <LbRow r={mine} />
          </>
        )}
        {data && !rows.length && <p className='text-[13px] text-slate-400'>Nobody is ranked {PERIOD_WORD[period]} yet. Be the first.</p>}
        {!data && !error && <p className='text-[13px] text-slate-400'>Loading…</p>}
      </div>
    </>
  )
}

function LbRow({ r }: { r: CbtLeaderboard['rows'][number] }) {
  const medal = r.rank === 1 ? 'bg-amber-400 text-white' : r.rank === 2 ? 'bg-slate-300 text-white' : r.rank === 3 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-600'
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${r.me ? 'bg-blue-50 dark:bg-zinc-800' : ''}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${medal}`}>{r.rank}</span>
      <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#002EFF]/10 text-[12px] font-black text-[#002EFF]'>
        {initials(r.name)}
      </span>
      <span className='min-w-0 flex-1'>
        <b className='block truncate text-[14px] font-black text-slate-800 dark:text-white'>
          {r.name}
          {r.me ? ' (you)' : ''}
        </b>
        <small className='text-[11px] text-slate-400'>{r.accuracy}% accuracy</small>
      </span>
      <span className='text-right text-[16px] font-black text-slate-900 dark:text-white'>
        {r.points}
        <small className='block text-[10px] font-bold text-slate-400'>points</small>
      </span>
    </div>
  )
}
