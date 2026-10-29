'use client'

// Shared pieces of the student CBT Practice tab: formatting, the bottom sheet
// used for every dialog, the plans comparison and the "unlock" prompt shown for
// a feature the student's plan does not include.

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { goToUnlock } from '@/components/dashboard/LockedNotice'
import { CBT_TIERS, type CbtLimits, type CbtMeta, type CbtTier } from '@/lib/cbt-types'

export const LETTERS = ['A', 'B', 'C', 'D', 'E']
export const DIFF_LABEL: Record<string, string> = { E: 'Easy', M: 'Medium', H: 'Hard' }

export const fN = (n: number) => Number(n).toLocaleString('en')
export const unl = (n: number | null) => (n === null ? 'Unlimited' : fN(n))

/** "1 hr 30 min", "45 min". */
export const fm = (mins: number) => {
  const m = Math.round(mins)
  return m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`
}

/** "1:05:09" / "05:09". */
export const clock = (secs: number) => {
  const s = Math.max(0, Math.round(secs))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const x = s % 60
  const z = (n: number) => String(n).padStart(2, '0')
  return `${h ? `${h}:` : ''}${z(m)}:${z(x)}`
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'Student'
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ME'

export const btn =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-[#002EFF] px-5 text-[13px] font-black text-white hover:bg-blue-700 disabled:opacity-40'
export const btnAlt =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
export const chip =
  'inline-flex min-h-[34px] items-center rounded-full border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600 hover:border-[#002EFF] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
export const chipOn = 'border-[#002EFF] bg-[#002EFF] text-white hover:border-[#002EFF] dark:bg-[#002EFF] dark:text-white'
export const card =
  'min-w-0 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900'
export const label = 'mb-2 mt-6 block text-[11px] font-black uppercase tracking-widest text-slate-400'

export function Sheet({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center sm:items-center'>
      <div className='absolute inset-0 bg-slate-900/50' onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role='dialog'
        aria-modal='true'
        aria-label={title}
        className='relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 outline-none sm:rounded-3xl dark:bg-zinc-900'
      >
        <div className='mb-3 flex items-start justify-between gap-3'>
          <h3 className='text-[16px] font-black text-slate-900 dark:text-white'>{title}</h3>
          <button type='button' onClick={onClose} aria-label='Close' className='p-1 text-slate-400'>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const PLAN_ROWS: [string, (l: CbtLimits) => string][] = [
  ['Questions per day', (l) => unl(l.day)],
  ['Full JAMB mocks per month', (l) => unl(l.mocks)],
  ['Longest practice session', (l) => unl(l.sess)],
  ['Predicted score and monthly trend', (l) => (l.pred ? 'Included' : '–')],
  ['“Ones I got wrong first”', (l) => (l.missed ? 'Included' : '–')],
  ['Exam-year filter', (l) => (l.year ? 'Included' : '–')],
  ['Questions per subject (custom mode)', (l) => unl(l.ps)],
  ['Saved questions', (l) => unl(l.saved)],
]

export function PlansSheet({ meta, onClose }: { meta: CbtMeta; onClose: () => void }) {
  const tiers = CBT_TIERS
  return (
    <Sheet title='Plans' onClose={onClose}>
      <p className='text-[13px] text-slate-600 dark:text-zinc-300'>
        You are on the <b>{meta.tier}</b> plan. On every plan you can see the leaderboard, review your answers and track
        your progress.
      </p>
      <div className='mt-3'>
        <table className='w-full table-fixed text-left text-[11px] sm:text-[12px]'>
          <colgroup>
            <col className='w-[34%]' />
          </colgroup>
          <thead>
            <tr>
              <th />
              {tiers.map((t) => (
                <th key={t} className={`px-1 py-2 font-black ${t === meta.tier ? 'text-[#002EFF]' : 'text-slate-500'}`}>
                  {t}
                  {t === meta.tier && <small className='block text-[9px] font-bold'>Your plan</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_ROWS.map(([l, f]) => (
              <tr key={l} className='border-t border-slate-100 dark:border-zinc-800'>
                <td className='py-2 pr-2 font-semibold text-slate-600 dark:text-zinc-300'>{l}</td>
                {tiers.map((t) => (
                  <td key={t} className={`break-words px-1 py-2 font-bold ${t === meta.tier ? 'text-[#002EFF]' : 'text-slate-700 dark:text-zinc-200'}`}>
                    {f(meta.plans[t])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='mt-4 flex flex-wrap gap-2'>
        <button type='button' className={btnAlt} onClick={onClose}>
          Close
        </button>
        {meta.tier !== 'Elite' && (
          <button
            type='button'
            className={btn}
            onClick={() => {
              onClose()
              goToUnlock()
            }}
          >
            Upgrade your plan
          </button>
        )}
      </div>
    </Sheet>
  )
}

/** Why a feature is locked, by the code the server returns or the feature tapped. */
export const LOCKS: Record<string, [string, (meta: CbtMeta) => string]> = {
  LOCKED_YEAR: ['the exam-year filter', () => 'Practise questions from one exam year at a time, for example only 2022.'],
  LOCKED_MISSED: [
    '“ones I got wrong first”',
    () => 'Put the questions you got wrong at the top of your next session, so you fix your weak spots first.',
  ],
  pred: ['the predicted JAMB score', () => 'See the score we expect you to get in JAMB, based on your recent full mocks.'],
  trend: [
    'your monthly trend',
    () => 'See how your JAMB mock average changes month by month, and whether you are on track for your target.',
  ],
  SAVED_LIMIT: [
    'more saved questions',
    (m) => `Save more questions to revisit later. Your ${m.tier} plan lets you save up to ${unl(m.limits.saved)}.`,
  ],
  ps: [
    'more questions per subject',
    (m) => `Choose more questions from each subject in one session. Your ${m.tier} plan allows up to ${unl(m.limits.ps)} per subject.`,
  ],
  MOCK_LIMIT: [
    'more full JAMB mocks',
    (m) =>
      m.limits.mocks === 0
        ? `Full JAMB mocks are not part of the ${m.tier} plan.`
        : `Your ${m.tier} plan includes ${unl(m.limits.mocks)} full JAMB mock${m.limits.mocks === 1 ? '' : 's'} a month. The limit resets on the 1st.`,
  ],
  DAILY_LIMIT: [
    'more questions today',
    (m) => `Your ${m.tier} plan includes ${unl(m.limits.day)} questions a day. The limit resets at midnight.`,
  ],
}

export function LockSheet({ meta, lock, onClose, onPlans }: { meta: CbtMeta; lock: string; onClose: () => void; onPlans: () => void }) {
  const [what, why] = LOCKS[lock] || LOCKS.pred
  const better = CBT_TIERS.filter((t) => CBT_TIERS.indexOf(t) > CBT_TIERS.indexOf(meta.tier as CbtTier))
  return (
    <Sheet title={`Unlock ${what}`} onClose={onClose}>
      <p className='text-[13px] text-slate-600 dark:text-zinc-300'>{why(meta)}</p>
      <p className='mt-2 text-[13px] text-slate-600 dark:text-zinc-300'>
        Upgrade to {better.map((t, i) => (
          <span key={t}>
            {i ? (i === better.length - 1 ? ' or ' : ', ') : ''}
            <b>{t}</b>
          </span>
        ))}{' '}
        to get more. You are on <b>{meta.tier}</b>, and everything else on your plan still works.
      </p>
      <div className='mt-4 flex flex-wrap gap-2'>
        <button type='button' className={btnAlt} onClick={onClose}>
          Maybe later
        </button>
        <button
          type='button'
          className={btn}
          onClick={() => {
            onClose()
            goToUnlock()
          }}
        >
          Upgrade your plan
        </button>
      </div>
      <button type='button' className='mt-3 w-full text-center text-[12px] font-bold text-[#002EFF]' onClick={onPlans}>
        Compare plans
      </button>
    </Sheet>
  )
}

/** A question's picture, tap to enlarge. */
export function Figure({ src, alt }: { src: string; alt: string }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt || 'Picture for this question'} loading='lazy' className='max-h-72 max-w-full rounded-2xl border border-slate-100 bg-white' />
  )
  // Browsers refuse to open a data: picture in a new tab, so an inline diagram
  // is shown without the full-size link.
  if (src.startsWith('data:')) return <figure className='my-3'>{img}</figure>
  return (
    <figure className='my-3'>
      <a href={src} target='_blank' rel='noopener noreferrer' aria-label='Open the picture full size'>
        {img}
      </a>
      <figcaption className='mt-1 text-[11px] text-slate-400'>Tap the picture to open it full size.</figcaption>
    </figure>
  )
}

export function Passage({ text, open = true }: { text: string; open?: boolean }) {
  if (!text) return null
  return (
    <details open={open} className='mb-3 rounded-2xl bg-slate-50 p-3 dark:bg-zinc-800'>
      <summary className='cursor-pointer text-[12px] font-black text-slate-600 dark:text-zinc-300'>Read the passage</summary>
      <p className='mt-2 whitespace-pre-line text-[14px] leading-relaxed text-slate-700 dark:text-zinc-200'>{text}</p>
    </details>
  )
}
