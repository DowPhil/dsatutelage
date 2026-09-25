'use client'

// Students' requests to move class / programme (promotion, a new exam year).
// Nothing changes on an account until someone here approves it; approving
// also drops the student's courses the new class cannot see, so their
// dashboard starts clean.

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, Loader2, RefreshCw, X } from 'lucide-react'
import { adminApi, type ChangeRequestRow } from '@/lib/admin-api'

const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) +
        ' ' +
        d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
}

const line = (s: ChangeRequestRow['current']) =>
  [s.currentLevel || '—', (s.programmes || []).join(' + ') || '—', s.department || null]
    .filter(Boolean)
    .join(' · ')

export default function ChangeRequestsPanel({
  onDecided,
}: {
  /** Called after an approval so the roster can reload the student's row. */
  onDecided?: () => void
}) {
  const [rows, setRows] = useState<ChangeRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.listChangeRequests('pending')
      setRows(res.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id)
    setError('')
    try {
      await adminApi.decideChangeRequest(id, action, action === 'reject' ? note : '')
      setRows((r) => r.filter((x) => x.id !== id))
      setRejecting(null)
      setNote('')
      if (action === 'approve') onDecided?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the decision.')
    } finally {
      setBusy(null)
    }
  }

  if (!loading && !rows.length && !error) return null

  return (
    <div className='rounded-2xl border border-amber-200 bg-amber-50/60 p-4'>
      <div className='flex items-center justify-between gap-2'>
        <button
          type='button'
          onClick={() => setOpen((o) => !o)}
          className='text-left text-[11px] font-black uppercase tracking-wide text-amber-800'
        >
          Class change requests
          {rows.length > 0 && (
            <span className='ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-white'>
              {rows.length}
            </span>
          )}
        </button>
        <button
          type='button'
          onClick={() => void load()}
          className='flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:text-amber-900'
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <p className='mt-1 text-[10px] font-medium text-amber-700'>
        Approving moves the student at once and removes courses their new class cannot see.
      </p>

      {error && (
        <p className='mt-2 text-[10px] font-bold text-rose-600'>{error}</p>
      )}

      {open && (
        <div className='mt-3 space-y-2'>
          {rows.map((r) => {
            const isBusy = busy === r.id
            return (
              <div key={r.id} className='rounded-xl border border-amber-100 bg-white p-3'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <p className='truncate text-[12px] font-black text-slate-900'>
                      {r.student?.fullname || 'Student'}
                      {r.student?.studentId && (
                        <span className='ml-2 text-[10px] font-bold text-slate-400'>{r.student.studentId}</span>
                      )}
                    </p>
                    <p className='truncate text-[10px] font-medium text-slate-500'>
                      {r.student?.email} · asked {when(r.createdAt)}
                    </p>
                  </div>
                  <div className='flex shrink-0 items-center gap-1.5'>
                    <button
                      type='button'
                      disabled={isBusy}
                      onClick={() => void decide(r.id, 'approve')}
                      className='flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[10px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-50'
                    >
                      {isBusy ? <Loader2 size={12} className='animate-spin' /> : <Check size={12} />} Approve
                    </button>
                    <button
                      type='button'
                      disabled={isBusy}
                      onClick={() => setRejecting(rejecting === r.id ? null : r.id)}
                      className='flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 text-[10px] font-black uppercase text-rose-600 hover:bg-rose-50 disabled:opacity-50'
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>

                <div className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold'>
                  <span className='text-slate-500'>{line(r.current)}</span>
                  <ArrowRight size={12} className='text-slate-400' />
                  <span className='text-[#002EFF]'>{line(r.requested)}</span>
                </div>
                {r.note && (
                  <p className='mt-1 text-[10px] font-medium text-slate-500'>“{r.note}”</p>
                )}

                {rejecting === r.id && (
                  <div className='mt-2 flex flex-col gap-2 sm:flex-row'>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                      placeholder='Why not? The student sees this.'
                      className='h-9 flex-1 rounded-lg border border-slate-200 px-3 text-[11px] font-medium outline-none focus:border-rose-300'
                    />
                    <button
                      type='button'
                      disabled={isBusy}
                      onClick={() => void decide(r.id, 'reject')}
                      className='h-9 rounded-lg bg-rose-600 px-4 text-[10px] font-black uppercase text-white hover:bg-rose-700 disabled:opacity-50'
                    >
                      Confirm reject
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {loading && !rows.length && (
            <p className='text-[10px] font-bold text-amber-700'>Checking…</p>
          )}
        </div>
      )}
    </div>
  )
}
