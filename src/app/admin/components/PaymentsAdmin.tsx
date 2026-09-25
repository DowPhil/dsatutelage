'use client'

// Admin payments — manage plans & their amounts, set the L1/L2 access caps, and
// review offline-payment proofs. See docs/payment-plan.md & backend-request-payments.md.

import { useCallback, useEffect, useState } from 'react'
import {
  Wallet,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Check,
  X,
  Power,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { dsaApi } from '@/lib/api'
import { DEFAULT_CAPS, type AccessCaps } from '@/lib/access'

function adminToken(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    undefined
  )
}
const str = (v: unknown) => (v == null ? '' : String(v))
const naira = (n: number) => `₦${(n || 0).toLocaleString()}`

export default function PaymentsAdmin() {
  const token = adminToken()
  return (
    <div className='max-w-4xl mx-auto space-y-6 px-1'>
      <div>
        <h1 className='text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2'>
          <Wallet size={20} className='text-[#002EFF]' /> Payments
        </h1>
        <p className='text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1'>
          Plans · access caps · offline proof review
        </p>
      </div>
      <PlansSection token={token} />
      <CapsSection token={token} />
      <OfflineQueueSection token={token} />
    </div>
  )
}

/* ------------------------------ Plans ------------------------------ */
// Programme a plan is for. Empty = shown to every student. Values match the
// backend exam-track scoping (waec, jamb, postutme, undergrad, preclinical,
// afterschool).
const PLAN_TRACKS: { value: string; label: string }[] = [
  { value: '', label: 'All programmes' },
  { value: 'waec', label: 'WAEC' },
  { value: 'jamb', label: 'JAMB' },
  { value: 'postutme', label: 'Post-UTME' },
  { value: 'undergrad', label: '100 Level' },
  { value: 'preclinical', label: 'Preclinical' },
  { value: 'afterschool', label: 'After-School' },
]
const trackLabel = (v?: unknown) =>
  PLAN_TRACKS.find((t) => t.value === String(v ?? ''))?.label ?? String(v ?? '')

function PlansSection({ token }: { token?: string }) {
  const [plans, setPlans] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'portal' | 'tutorial'>('tutorial')
  const [amount, setAmount] = useState(8000)
  const [months, setMonths] = useState(1)
  const [track, setTrack] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPlans((await dsaApi.plans.adminList(token)) as Record<string, unknown>[])
      setError(null)
    } catch {
      setError('Plans endpoint not live yet — this will populate once the backend ships it.')
    } finally {
      setLoading(false)
    }
  }, [token])
  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    if (name.trim().length < 2) return setError('Enter a plan name.')
    setBusy(true)
    setError(null)
    try {
      await dsaApi.plans.create(
        {
          name: name.trim(),
          kind,
          amount: Number(amount) || 0,
          durationMonths: kind === 'portal' ? 0 : Number(months) || 1,
          grantsLevel: kind === 'portal' ? 'portal' : 'tutorial',
          track: track || undefined,
          note: note.trim() || undefined,
          active: true,
        },
        token,
      )
      setName('')
      setNote('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the plan.')
    } finally {
      setBusy(false)
    }
  }

  // Which plan is open for editing, and the values being typed into it.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState({ name: '', amount: '', durationMonths: '', note: '' })
  // Delete is two taps: the bin, then "Sure?" on the same row.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const beginEdit = (p: Record<string, unknown>) => {
    setEditingId(str(p.id ?? p._id))
    setEdit({
      name: str(p.name),
      amount: str(p.amount),
      durationMonths: str(p.durationMonths ?? ''),
      note: str(p.note ?? ''),
    })
    setError(null)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const amount = Number(edit.amount)
    if (!edit.name.trim()) return setError('Give the plan a name.')
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a valid amount.')
    setBusy(true)
    setError(null)
    try {
      await dsaApi.plans.update(
        editingId,
        {
          name: edit.name.trim(),
          amount,
          durationMonths: edit.durationMonths ? Number(edit.durationMonths) : undefined,
          note: edit.note.trim() || undefined,
        },
        token,
      )
      setEditingId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the plan.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (p: Record<string, unknown>) => {
    const id = str(p.id ?? p._id)
    setError(null)
    try {
      await dsaApi.plans.update(id, { active: !p.active }, token)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the plan.')
    }
  }

  const remove = async (id: string) => {
    setError(null)
    try {
      await dsaApi.plans.remove(id, token)
      setConfirmDeleteId(null)
      await load()
    } catch (e) {
      // The API refuses to delete a plan with payments against it and says so.
      // That message is the useful one, so it is shown as-is.
      setConfirmDeleteId(null)
      setError(e instanceof Error ? e.message : 'Could not delete the plan.')
    }
  }

  return (
    <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
      <p className='text-[11px] font-black uppercase text-slate-500'>Payment plans</p>
      {error && <p className='text-[11px] font-bold text-amber-600'>{error}</p>}

      <div className='grid grid-cols-2 sm:grid-cols-6 gap-2'>
        <label className='col-span-2 flex flex-col gap-1'>
          <span className='text-[9px] font-black uppercase text-slate-400'>Plan name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. Silver'
            className='h-10 px-3 rounded-lg bg-slate-50 outline-none text-sm font-bold'
          />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-[9px] font-black uppercase text-slate-400'>Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'portal' | 'tutorial')}
            className='h-10 px-2 rounded-lg bg-slate-50 outline-none text-[12px] font-bold'
          >
            <option value='portal'>Portal (₦2k)</option>
            <option value='tutorial'>Tutorial</option>
          </select>
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-[9px] font-black uppercase text-slate-400'>Programme</span>
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className='h-10 px-2 rounded-lg bg-slate-50 outline-none text-[12px] font-bold'
          >
            {PLAN_TRACKS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-[9px] font-black uppercase text-slate-400'>Amount (₦)</span>
          <input
            type='number'
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder='8000'
            className='h-10 px-2 rounded-lg bg-slate-50 outline-none text-sm font-bold'
          />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-[9px] font-black uppercase text-slate-400'>
            Months
          </span>
          {kind === 'tutorial' ? (
            <input
              type='number'
              value={months}
              min={1}
              onChange={(e) => setMonths(Number(e.target.value))}
              placeholder='e.g. 2'
              className='h-10 px-2 rounded-lg bg-slate-50 outline-none text-sm font-bold'
            />
          ) : (
            <div className='h-10 flex items-center text-[10px] font-bold text-slate-400'>
              one-time
            </div>
          )}
        </label>
      </div>
      {kind === 'tutorial' && (
        <p className='text-[10px] font-bold text-slate-400 px-1'>
          For a 2- or 3-month plan, set <b>Months</b> to 2 or 3 and enter that
          duration&apos;s price in <b>Amount</b>. Add one plan per duration
          (e.g. Silver 1mo, Silver 2mo, Silver 3mo).
        </p>
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder='Short description (optional) — e.g. “2 months, ₦2k discount”'
        className='w-full h-10 px-3 rounded-lg bg-slate-50 outline-none text-sm font-medium'
      />
      <button
        onClick={create}
        disabled={busy}
        className='flex items-center gap-2 h-9 px-4 bg-[#002EFF] text-white rounded-lg font-black text-[10px] uppercase tracking-wide hover:bg-blue-700 disabled:opacity-50'
      >
        {busy ? <Loader2 size={13} className='animate-spin' /> : <Plus size={13} />}
        Add plan
      </button>

      <div className='space-y-1.5 pt-1'>
        {loading ? (
          <div className='py-4 flex justify-center'>
            <Loader2 className='animate-spin text-[#002EFF]' size={18} />
          </div>
        ) : plans.length === 0 ? (
          <p className='text-[11px] font-bold text-slate-400'>No plans yet.</p>
        ) : (
          plans.map((p) => {
            const id = str(p.id ?? p._id)
            return (
              <div
                key={id}
                className='flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-50'
              >
                {editingId === id && (
                  <div className='basis-full grid grid-cols-2 sm:grid-cols-4 gap-2'>
                    <input
                      value={edit.name}
                      onChange={(e) => setEdit((v) => ({ ...v, name: e.target.value }))}
                      placeholder='Plan name'
                      className='col-span-2 h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] font-bold outline-none'
                    />
                    <input
                      type='number'
                      min={0}
                      value={edit.amount}
                      onChange={(e) => setEdit((v) => ({ ...v, amount: e.target.value }))}
                      placeholder='Amount in naira'
                      className='h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] font-bold outline-none'
                    />
                    <input
                      type='number'
                      min={0}
                      value={edit.durationMonths}
                      onChange={(e) =>
                        setEdit((v) => ({ ...v, durationMonths: e.target.value }))
                      }
                      placeholder='Months'
                      className='h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] font-bold outline-none'
                    />
                    <input
                      value={edit.note}
                      onChange={(e) => setEdit((v) => ({ ...v, note: e.target.value }))}
                      placeholder='Note (optional)'
                      className='col-span-2 sm:col-span-3 h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] outline-none'
                    />
                    <div className='flex gap-1.5'>
                      <button
                        onClick={saveEdit}
                        disabled={busy}
                        className='flex-1 h-9 rounded-lg bg-[#002EFF] text-white text-[10px] font-black uppercase disabled:opacity-50'
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className='h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-500 text-[10px] font-black uppercase'
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <div className='min-w-0 flex-1'>
                  <p className='text-xs font-black text-slate-800 truncate'>
                    {str(p.name)}
                  </p>
                  <p className='text-[10px] font-bold text-slate-400'>
                    {naira(Number(p.amount))}
                    {Number(p.durationMonths) > 0 && ` · ${str(p.durationMonths)} mo`}
                    {' · '}
                    {str(p.kind)}
                    {' · '}
                    {trackLabel(p.track)}
                  </p>
                  {p.note ? (
                    <p className='text-[10px] font-medium text-slate-500 truncate'>
                      {str(p.note)}
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={() => toggle(p)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                    p.active
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  <Power size={10} className='inline' /> {p.active ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => beginEdit(p)}
                  className='p-1 text-slate-300 hover:text-[#002EFF]'
                  title='Edit plan'
                >
                  <Pencil size={13} />
                </button>
                {confirmDeleteId === id ? (
                  <button
                    onClick={() => remove(id)}
                    className='px-2 py-1 rounded-lg bg-rose-500 text-white text-[9px] font-black uppercase'
                    title='Yes, delete it'
                  >
                    Sure?
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(id)}
                    className='p-1 text-slate-300 hover:text-rose-500'
                    title='Delete plan'
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

/* ------------------------------ Caps ------------------------------ */
function CapsSection({ token }: { token?: string }) {
  const [caps, setCaps] = useState<AccessCaps>(DEFAULT_CAPS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const c = (await dsaApi.payments.getCaps(token)) as Partial<AccessCaps>
        if (c && typeof c === 'object')
          setCaps((prev) => ({ ...prev, ...c }))
      } catch {
        /* use defaults until backend ships */
      }
    })()
  }, [token])

  const field = (key: keyof AccessCaps, label: string) => (
    <label className='flex items-center justify-between gap-2'>
      <span className='text-[11px] font-bold text-slate-500'>{label}</span>
      <input
        type='number'
        min={0}
        value={caps[key]}
        onChange={(e) =>
          setCaps((c) => ({ ...c, [key]: Number(e.target.value) }))
        }
        className='w-20 h-9 px-2 rounded-lg bg-slate-50 outline-none text-sm font-bold text-center'
      />
    </label>
  )

  const save = async () => {
    setSaving(true)
    try {
      await dsaApi.payments.setCaps(caps as unknown as Record<string, number>, token)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      /* backend not live yet */
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
      <p className='text-[11px] font-black uppercase text-slate-500 flex items-center gap-1.5'>
        <SlidersHorizontal size={14} /> Access caps (Free / Portal — Tutorial is unlimited)
      </p>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2'>
        <p className='text-[10px] font-black uppercase text-slate-400 sm:col-span-2 mt-1'>
          Free (L1)
        </p>
        {field('freeTests', 'Free tests')}
        {field('freeMaterials', 'Learning materials')}
        {field('freeLiveClasses', 'Live classes')}
        <p className='text-[10px] font-black uppercase text-slate-400 sm:col-span-2 mt-2'>
          Portal Access (L2)
        </p>
        {field('portalTests', 'Tests')}
        {field('portalMaterials', 'Learning materials')}
        {field('portalLiveClasses', 'Live classes')}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className='flex items-center gap-2 h-9 px-4 bg-[#002EFF] text-white rounded-lg font-black text-[10px] uppercase tracking-wide hover:bg-blue-700 disabled:opacity-50'
      >
        {saving ? (
          <Loader2 size={13} className='animate-spin' />
        ) : saved ? (
          <Check size={13} />
        ) : null}
        {saved ? 'Saved' : 'Save caps'}
      </button>
    </Card>
  )
}

/* ------------------------ Offline review queue ------------------------ */
/**
 * Receipts students uploaded, waiting for a yes or no. Shared with the staff
 * dashboard, where a secretary with payments.verify does the same job.
 */
export function OfflineQueueSection({
  token,
  canReview = true,
}: {
  token?: string
  /** False for staff who may only look (payments.view without payments.verify). */
  canReview?: boolean
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows((await dsaApi.payments.offlineQueue(token)) as Record<string, unknown>[])
      setNote(null)
    } catch (e) {
      setNote(
        e instanceof Error
          ? `Could not load the proofs: ${e.message}`
          : 'Could not load the proofs. Check your connection and refresh.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])
  useEffect(() => {
    load()
  }, [load])

  const review = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id)
    setNote(null)
    try {
      await dsaApi.payments.review(id, decision, token, decision === 'reject' ? reason : undefined)
      setRows((r) => r.filter((x) => str(x.id ?? x._id) !== id))
      setRejecting(null)
      setReason('')
      setFlash(decision === 'approve' ? 'Payment confirmed. The student has been told.' : 'Payment rejected. The student has been told.')
      setTimeout(() => setFlash(null), 4000)
    } catch (e) {
      // Keep the row and say why, rather than silently putting it back.
      setNote(e instanceof Error ? e.message : 'Could not save the decision.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
      <p className='text-[11px] font-black uppercase text-slate-500'>
        Offline payment proofs
      </p>
      {note && <p className='text-[11px] font-bold text-rose-600'>{note}</p>}
      {flash && <p className='text-[11px] font-bold text-emerald-600'>{flash}</p>}
      {loading ? (
        <div className='py-4 flex justify-center'>
          <Loader2 className='animate-spin text-[#002EFF]' size={18} />
        </div>
      ) : rows.length === 0 ? (
        <p className='text-[11px] font-bold text-slate-400'>
          No pending proofs.
        </p>
      ) : (
        rows.map((r) => {
          const id = str(r.id ?? r._id)
          const proof = str(r.proofUrl)
          const who =
            str(
              (r.student as Record<string, unknown>)?.fullname ??
                r.studentName ??
                r.studentId,
            ) || 'Student'
          const isBusy = busy === id
          return (
            <div key={id} className='rounded-xl bg-slate-50 p-2.5'>
              <div className='flex items-center gap-2'>
                <div className='min-w-0 flex-1'>
                  <p className='text-xs font-black text-slate-800 truncate'>{who}</p>
                  <p className='text-[10px] font-bold text-slate-400'>
                    {naira(Number(r.amount))} · {str(r.method) || 'offline'}
                    {r.reference ? ` · ${str(r.reference)}` : ''}
                  </p>
                </div>
                {proof && (
                  <a
                    href={proof}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-1 text-[10px] font-black text-[#002EFF] hover:underline'
                  >
                    <ExternalLink size={11} /> Proof
                  </a>
                )}
                {canReview && (
                  <>
                    <button
                      onClick={() => review(id, 'approve')}
                      disabled={isBusy}
                      className='p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50'
                      title='Approve'
                    >
                      {isBusy ? <Loader2 size={14} className='animate-spin' /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => setRejecting(rejecting === id ? null : id)}
                      disabled={isBusy}
                      className='p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-50'
                      title='Reject'
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
              {rejecting === id && (
                <div className='mt-2 flex flex-col gap-2 sm:flex-row'>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    placeholder='Why not? The student sees this.'
                    className='h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium outline-none focus:border-rose-300'
                  />
                  <button
                    onClick={() => review(id, 'reject')}
                    disabled={isBusy}
                    className='h-9 rounded-lg bg-rose-600 px-4 text-[10px] font-black uppercase text-white hover:bg-rose-700 disabled:opacity-50'
                  >
                    Confirm reject
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </Card>
  )
}
