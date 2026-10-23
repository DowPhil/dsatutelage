'use client'

// Small building blocks shared by the CBT Platform tabs: cards, charts, the
// pager, tags, a modal and a toast. Charts are plain SVG/divs so they work on
// the old Android browsers many staff phones still run.

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export const fN = (n: number | null | undefined) =>
  n === null || n === undefined ? '–' : Number(n).toLocaleString('en')

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export const DIFF_LABEL: Record<string, string> = { E: 'Easy', M: 'Medium', H: 'Hard' }

export function Panel({
  title,
  hint,
  action,
  children,
  className = '',
}: {
  title?: string
  hint?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`min-w-0 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {(title || action) && (
        <div className='mb-3 flex flex-wrap items-start justify-between gap-2'>
          {title && (
            <h3 className='text-[11px] font-black uppercase tracking-widest text-slate-500'>{title}</h3>
          )}
          {action}
        </div>
      )}
      {children}
      {hint && <p className='mt-3 text-[11px] font-medium text-slate-400'>{hint}</p>}
    </section>
  )
}

export function Kpi({ value, label, sub }: { value: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className='min-w-0 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
      <b className='block text-2xl font-black text-slate-900 dark:text-white'>{value}</b>
      <span className='mt-1 block text-[11px] font-bold text-slate-500'>{label}</span>
      {sub && <small className='mt-1 block text-[10px] font-medium text-slate-400'>{sub}</small>}
    </div>
  )
}

/** Vertical bar chart. `highlight` marks one bar (e.g. today). */
export function VBars({
  data,
  label,
  highlight,
  format = fN,
}: {
  data: { l: string; v: number }[]
  label: string
  highlight?: number
  format?: (v: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.v))
  return (
    <div role='img' aria-label={label} className='w-full'>
      <div className='flex h-44 items-end gap-1 sm:gap-1.5'>
        {data.map((d, i) => (
          <div key={d.l + i} className='flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1'>
            <span className='text-[9px] font-bold text-slate-400'>{d.v ? format(d.v) : ''}</span>
            <div
              className={`w-full max-w-[40px] rounded-t-lg ${i === highlight ? 'bg-[#FCB900]' : 'bg-[#002EFF]'}`}
              style={{ height: `${Math.max(d.v ? 3 : 0, (d.v / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className='mt-1 flex gap-1 sm:gap-1.5'>
        {data.map((d, i) => (
          <span key={d.l + i} className='min-w-0 flex-1 truncate text-center text-[9px] font-bold text-slate-400'>
            {d.l}
          </span>
        ))}
      </div>
    </div>
  )
}

/** One horizontal bar row: label, bar (0–100), value text. */
export function HBar({ label, value, text }: { label: string; value: number; text?: string }) {
  return (
    <div className='flex items-center gap-2 py-1'>
      <span className='w-28 shrink-0 truncate text-[11px] font-bold text-slate-600 sm:w-36 dark:text-slate-300' title={label}>
        {label}
      </span>
      <div className='h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800'>
        <div className='h-full rounded-full bg-[#002EFF]' style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className='w-12 shrink-0 text-right text-[11px] font-black text-slate-700 dark:text-slate-200'>
        {text ?? `${value}%`}
      </span>
    </div>
  )
}

export function Tag({ tone = 'plain', children }: { tone?: 'ok' | 'warn' | 'bad' | 'plain'; children: React.ReactNode }) {
  const cls = {
    ok: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    bad: 'bg-rose-50 text-rose-700',
    plain: 'bg-slate-100 text-slate-600',
  }[tone]
  return (
    <span className={`mr-1 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black ${cls}`}>
      {children}
    </span>
  )
}

export function Pager({
  page,
  totalPages,
  total,
  limit,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  limit: number
  onPage: (p: number) => void
}) {
  const from = total ? (page - 1) * limit + 1 : 0
  const to = Math.min(total, page * limit)
  return (
    <div className='mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500'>
      <span>
        {fN(from)} to {fN(to)} of {fN(total)}
      </span>
      <div className='flex gap-2'>
        <button type='button' className={btnAlt} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button type='button' className={btnAlt} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}

export const btn =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#002EFF] px-4 text-[10px] font-black uppercase text-white hover:bg-blue-700 disabled:opacity-50'
export const btnAlt =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
export const btnBad =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-[10px] font-black uppercase text-white hover:bg-rose-700 disabled:opacity-50'
export const input =
  'h-9 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 outline-none focus:border-[#002EFF] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
export const fieldLabel = 'flex min-w-0 flex-col gap-1 text-[11px] font-bold text-slate-500'

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
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
    <div
      className='fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 sm:items-center sm:p-4'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role='dialog'
        aria-modal='true'
        aria-label={title}
        className={`my-4 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-3xl bg-white p-5 shadow-2xl outline-none dark:bg-slate-900`}
      >
        <div className='mb-3 flex items-start justify-between gap-3'>
          <h3 className='text-sm font-black text-slate-900 dark:text-slate-100'>{title}</h3>
          <button type='button' onClick={onClose} aria-label='Close' className='text-slate-400 hover:text-slate-600'>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** A short message at the bottom of the screen. */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((text: string, bad = false) => {
    setMsg({ text, bad })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 3000)
  }, [])
  const node = msg ? (
    <div
      role='status'
      aria-live='polite'
      className={`fixed bottom-4 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-[12px] font-bold text-white shadow-lg ${msg.bad ? 'bg-rose-600' : 'bg-slate-900'}`}
    >
      {msg.text}
    </div>
  ) : null
  return { show, node }
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className='rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[12px] font-bold text-slate-400 dark:border-slate-700'>
      {children}
    </div>
  )
}

export function Loading() {
  return <div className='p-8 text-center text-[12px] font-bold text-slate-400'>Loading…</div>
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-rose-50 p-4 text-[12px] font-bold text-rose-700'>
      <span>{message}</span>
      {onRetry && (
        <button type='button' className={btnAlt} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
