'use client'

// "Unlock more features" — the student picks a plan and pays online (Paystack)
// or submits proof of an offline payment. See docs/payment-plan.md. Payment
// plans are admin-managed; while the backend has none we show sensible defaults.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  Check,
  Upload,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Landmark,
  Copy,
  Phone,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { dsaApi, type PaymentStatus } from '@/lib/api'
import { getToken, getUser } from '@/lib/auth'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { accessLevel, LEVEL_LABEL } from '@/lib/access'
import { BANK, HELPLINE, HELPLINE_INTL, VERIFY_WINDOW_TEXT } from '@/lib/bank'

const str = (v: unknown) => (v == null ? '' : String(v))
const naira = (n: number) => `₦${(n || 0).toLocaleString()}`

interface Plan {
  id: string
  name: string
  kind: string // 'portal' | 'tutorial'
  amount: number // naira
  durationMonths: number
  grantsLevel: string
  note?: string
}

// Shown until the admin creates plans on the backend. The old ₦2,000 "Portal
// Access" tier is retired — signup is free and Community is open to everyone,
// so only the tutorial plans are sold.

function normalizePlan(raw: Record<string, unknown>): Plan {
  return {
    id: str(raw.id ?? raw._id),
    name: str(raw.name),
    kind: str(raw.kind) || 'tutorial',
    amount: Number(raw.amount) || 0,
    durationMonths: Number(raw.durationMonths) || 0,
    grantsLevel: str(raw.grantsLevel) || 'tutorial',
    note: raw.note ? str(raw.note) : undefined,
  }
}

export default function UnlockPlans() {
  const token = getToken() ?? undefined
  const level = accessLevel(getUser())
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Plan | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  // Offline form
  const [proofUrl, setProofUrl] = useState('')
  const [reference, setReference] = useState('')
  // Chosen subscription length for tutorial plans (1, 2 or 3 months).
  const [months, setMonths] = useState(1)
  const proofInput = useRef<HTMLInputElement | null>(null)

  // Tutorial plans are billed per month; portal access is a one-time fee.
  const isTutorial = selected?.kind === 'tutorial'
  const effectiveAmount = selected
    ? isTutorial
      ? selected.amount * months
      : selected.amount
    : 0

  const [loadError, setLoadError] = useState<string | null>(null)
  // Where my last receipt stands, so the page can say so instead of guessing.
  const [status, setStatus] = useState<PaymentStatus | null>(null)
  const loadStatus = useCallback(async () => {
    try {
      setStatus(await dsaApi.payments.mine(token))
    } catch {
      /* the page still works without it */
    }
  }, [token])
  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const rows = (await dsaApi.plans.list(token)) as Record<string, unknown>[]
      // Retired: never show the old one-time "Portal Access" tier, even if a
      // legacy portal plan is still seeded on the backend.
      const live = rows.map(normalizePlan).filter((p) => p.kind !== 'portal')
      // Only what the admin has actually created. This used to fall back to a
      // built-in list when the server had none, and a student who paid for one
      // of those was refused with "Resource not found" — the plan did not exist.
      setPlans(live)
      setLoadError(live.length ? null : 'No plans are on sale right now. Please check back soon.')
    } catch {
      setPlans([])
      setLoadError('Could not load the plans. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const openPlan = (p: Plan) => {
    setSelected(p)
    setError(null)
    setDone(null)
    setProofUrl('')
    setReference('')
    setMonths(1)
  }

  const onProof = async (file: File | null) => {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const res = await uploadToCloudinary(file, 'dsa/payments')
      setProofUrl(res.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the proof.')
    } finally {
      setUploading(false)
    }
  }

  const submitOffline = async () => {
    if (!selected) return
    if (!proofUrl) return setError('Please upload your proof of payment.')
    setError(null)
    setBusy(true)
    try {
      await dsaApi.payments.offline(
        {
          planId: selected.id,
          months: isTutorial ? months : selected.durationMonths || undefined,
          method: 'offline',
          reference: reference || undefined,
          proofUrl,
        },
        token,
      )
      setDone(
        `Receipt sent. You have access now, and the admin will confirm the transfer. If it is not confirmed within ${VERIFY_WINDOW_TEXT}, call ${HELPLINE}.`,
      )
      setSelected(null)
      setProofUrl('')
      setReference('')
      void loadStatus()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not submit your proof. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  // ----- Detail (a plan is selected) -----
  if (selected) {
    return (
      <div className='max-w-lg mx-auto space-y-4'>
        <button
          onClick={() => setSelected(null)}
          className='flex items-center gap-1.5 text-[11px] font-black uppercase text-[#002EFF]'
        >
          <ArrowLeft size={14} /> All plans
        </button>

        <Card className='p-6 rounded-3xl border-none shadow-sm bg-[#002EFF] text-white'>
          <p className='text-[10px] font-black uppercase tracking-widest text-blue-200'>
            {selected.kind === 'portal' ? 'Portal Access' : 'Tutorial Plan'}
          </p>
          <h3 className='text-xl font-black mt-1'>{selected.name}</h3>
          <p className='text-3xl font-black mt-2'>
            {naira(effectiveAmount)}
            {isTutorial && (
              <span className='text-sm font-bold text-blue-200'>
                {' '}
                / {months} month{months === 1 ? '' : 's'}
              </span>
            )}
          </p>
          {selected.note && (
            <p className='text-[12px] text-blue-100 mt-2'>{selected.note}</p>
          )}
        </Card>

        {/* Duration — tutorial plans can be bought for 1, 2 or 3 months */}
        {isTutorial && (
          <Card className='p-3 rounded-2xl border-none shadow-sm bg-white'>
            <p className='text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2'>
              Duration
            </p>
            <div className='grid grid-cols-3 gap-2'>
              {[1, 2, 3].map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={`rounded-xl px-2 py-2.5 text-center border transition-all ${
                    months === m
                      ? 'bg-[#002EFF] text-white border-[#002EFF]'
                      : 'bg-slate-50 text-slate-600 border-transparent hover:border-[#002EFF]/30'
                  }`}
                >
                  <span className='block text-[13px] font-black'>
                    {m} month{m === 1 ? '' : 's'}
                  </span>
                  <span
                    className={`block text-[10px] font-bold ${months === m ? 'text-blue-100' : 'text-slate-400'}`}
                  >
                    {naira(selected.amount * m)}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {error && <p className='text-[11px] font-bold text-rose-600 px-1'>{error}</p>}

        {/* 1. Transfer */}
        <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
          <p className='text-[11px] font-black uppercase text-slate-500 flex items-center gap-1.5'>
            <Landmark size={13} /> Step 1 · Transfer to our account
          </p>
          <div className='rounded-2xl bg-slate-50 p-3 space-y-2'>
            <BankLine label='Bank' value={BANK.bank} />
            <BankLine label='Account number' value={BANK.accountNumber} copy />
            <BankLine label='Account name' value={BANK.accountName} />
            <BankLine label='Amount' value={naira(effectiveAmount)} />
          </div>
          <p className='text-[11px] font-medium text-slate-500'>
            Use your name as the narration so we can find your transfer. Bank app, USSD or a teller at the bank all work.
          </p>
        </Card>

        {/* 2. Upload */}
        <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
          <p className='text-[11px] font-black uppercase text-slate-500 flex items-center gap-1.5'>
            <Upload size={13} /> Step 2 · Upload your receipt
          </p>
          <p className='text-[11px] font-medium text-slate-400'>
            A screenshot of the transfer, the bank alert or the teller. Your access opens straight away; the admin then confirms the payment.
          </p>
          <button
            onClick={() => proofInput.current?.click()}
            disabled={uploading}
            className={`w-full flex items-center justify-center gap-2 h-11 rounded-xl text-[11px] font-black uppercase tracking-wide ${
              proofUrl
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            } disabled:opacity-50`}
          >
            {uploading ? (
              <Loader2 size={15} className='animate-spin' />
            ) : proofUrl ? (
              <Check size={15} />
            ) : (
              <Upload size={15} />
            )}
            {proofUrl ? 'Receipt uploaded' : 'Upload receipt / teller'}
          </button>
          <input
            ref={proofInput}
            type='file'
            accept='image/*,.pdf'
            hidden
            onChange={(e) => onProof(e.target.files?.[0] ?? null)}
          />
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder='Transfer / teller reference (optional)'
            className='w-full h-11 px-3 rounded-lg bg-slate-50 outline-none text-sm font-medium'
          />
          <button
            onClick={submitOffline}
            disabled={busy}
            className='w-full flex items-center justify-center gap-2 h-12 bg-[#002EFF] text-white rounded-2xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 disabled:opacity-50'
          >
            {busy ? <Loader2 size={16} className='animate-spin' /> : <Check size={16} />}
            I have paid, submit receipt
          </button>
        </Card>

        <HelplineCard />
      </div>
    )
  }

  // ----- List -----
  return (
    <div className='max-w-2xl mx-auto space-y-4'>
      <div className='flex items-center justify-between flex-wrap gap-2'>
        <div>
          <h2 className='text-2xl font-black text-[#002EFF] italic uppercase flex items-center gap-2'>
            <Sparkles size={22} /> Unlock More
          </h2>
          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
            Choose a plan to unlock more of the portal
          </p>
        </div>
        <span className='flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-full bg-blue-50 text-[#002EFF]'>
          <ShieldCheck size={12} /> {LEVEL_LABEL[level]}
        </span>
      </div>

      {done && (
        <div className='flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3'>
          <Check size={16} className='text-emerald-600 shrink-0' />
          <p className='text-[11px] font-bold text-emerald-700'>{done}</p>
        </div>
      )}

      <PaymentStatusCard status={status} />

      {!loading && loadError && (
        <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold text-amber-700 flex items-center justify-between gap-3'>
          <span>{loadError}</span>
          <button onClick={load} className='shrink-0 rounded-lg bg-white px-3 py-1.5 text-[10px] font-black uppercase text-amber-700 ring-1 ring-amber-200'>
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <div className='py-10 flex justify-center'>
          <Loader2 className='animate-spin text-[#002EFF]' />
        </div>
      ) : (
        plans.map((p) => (
          <Card
            key={p.id}
            className='p-4 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3'
          >
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-black text-slate-800'>{p.name}</p>
              {p.note && (
                <p className='text-[11px] font-medium text-slate-400'>{p.note}</p>
              )}
            </div>
            <div className='text-right shrink-0'>
              <p className='text-base font-black text-[#002EFF]'>
                {naira(p.amount)}
              </p>
              {p.durationMonths > 0 && (
                <p className='text-[9px] font-bold text-slate-400 uppercase'>
                  / {p.durationMonths} mo
                </p>
              )}
            </div>
            <button
              onClick={() => openPlan(p)}
              className='h-10 px-4 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700'
            >
              Choose
            </button>
          </Card>
        ))
      )}
    </div>
  )
}

/* One row of the bank details, with a copy button where it helps. */
function BankLine({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false)
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* older browsers: the number is still on screen to type */
    }
  }
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='min-w-0'>
        <p className='text-[9px] font-black uppercase tracking-widest text-slate-400'>{label}</p>
        <p className={`font-black text-slate-800 ${copy ? 'text-lg tracking-wider' : 'text-[13px]'}`}>{value}</p>
      </div>
      {copy && (
        <button
          type='button'
          onClick={doCopy}
          className='flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-black uppercase text-[#002EFF] ring-1 ring-blue-100 hover:bg-blue-50'
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}

/* Who to call when a transfer is slow to be confirmed. */
function HelplineCard() {
  return (
    <Card className='p-4 rounded-2xl border border-amber-200 bg-amber-50 shadow-none'>
      <p className='text-[11px] font-black uppercase text-amber-800 flex items-center gap-1.5'>
        <Phone size={13} /> Helpline
      </p>
      <p className='mt-1 text-[12px] font-medium text-amber-900'>
        Confirmation usually takes minutes. If it takes more than {VERIFY_WINDOW_TEXT}, call or WhatsApp us on{' '}
        <a href={`tel:${HELPLINE_INTL}`} className='font-black underline'>{HELPLINE}</a>.
      </p>
      <div className='mt-2 flex flex-wrap gap-2'>
        <a
          href={`tel:${HELPLINE_INTL}`}
          className='inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[10px] font-black uppercase text-amber-800 ring-1 ring-amber-200'
        >
          <Phone size={12} /> Call
        </a>
        <a
          href={`https://wa.me/${HELPLINE_INTL.replace('+', '')}`}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[10px] font-black uppercase text-amber-800 ring-1 ring-amber-200'
        >
          WhatsApp
        </a>
      </div>
    </Card>
  )
}

const when = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* Where my last receipt stands: waiting, confirmed until a date, or not confirmed. */
function PaymentStatusCard({ status }: { status: PaymentStatus | null }) {
  if (!status?.payment) return null
  const p = status.payment
  const a = status.access
  if (p.status === 'pending') {
    return (
      <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3'>
        <p className='flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-800'>
          <Clock size={12} /> Waiting for confirmation
        </p>
        <p className='mt-1 text-[11px] font-bold text-slate-700'>
          {p.planName || 'Your plan'} · {naira(p.amount)} · sent {when(p.createdAt)}. You have access
          while we check the transfer. More than {VERIFY_WINDOW_TEXT}? Call{' '}
          <a href={`tel:${HELPLINE_INTL}`} className='underline'>{HELPLINE}</a>.
        </p>
      </div>
    )
  }
  if (p.status === 'approved' && a?.level !== 'free') {
    return (
      <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3'>
        <p className='flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-800'>
          <Check size={12} /> Payment confirmed
        </p>
        <p className='mt-1 text-[11px] font-bold text-slate-700'>
          {p.planName || 'Your plan'} is active{a?.expiresAt ? ` until ${when(a.expiresAt)}` : ''}.
          {a?.expiresAt ? ' When it ends, the portal goes back to free access until you pay again.' : ''}
        </p>
      </div>
    )
  }
  if (p.status === 'rejected') {
    return (
      <div className='rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3'>
        <p className='flex items-center gap-1.5 text-[10px] font-black uppercase text-rose-700'>
          <AlertCircle size={12} /> Payment not confirmed
        </p>
        <p className='mt-1 text-[11px] font-bold text-slate-700'>
          {p.reviewNote || 'We could not match your receipt to a transfer.'} Check the amount and account,
          then choose the plan again and upload the receipt, or call{' '}
          <a href={`tel:${HELPLINE_INTL}`} className='underline'>{HELPLINE}</a>.
        </p>
      </div>
    )
  }
  return null
}
