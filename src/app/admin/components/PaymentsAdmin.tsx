// 'use client'

// // Admin payments — manage plans & their amounts, set the L1/L2 access caps, and
// // review offline-payment proofs. See docs/payment-plan.md & backend-request-payments.md.

// import { useCallback, useEffect, useState } from 'react'
// import {
//   Wallet,
//   Plus,
//   Trash2,
//   Pencil,
//   Loader2,
//   Check,
//   X,
//   Power,
//   ExternalLink,
//   SlidersHorizontal,
// } from 'lucide-react'
// import { Card } from '@/components/ui/card'
// import { dsaApi } from '@/lib/api'
// import { DEFAULT_CAPS, type AccessCaps } from '@/lib/access'

// function adminToken(): string | undefined {
//   if (typeof window === 'undefined') return undefined
//   return (
//     localStorage.getItem('admin_token') ||
//     localStorage.getItem('token') ||
//     undefined
//   )
// }
// const str = (v: unknown) => (v == null ? '' : String(v))
// const naira = (n: number) => `₦${(n || 0).toLocaleString()}`

// export default function PaymentsAdmin() {
//   const token = adminToken()
//   return (
//     <div className='max-w-4xl mx-auto space-y-6 px-1'>
//       <div>
//         <h1 className='text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2'>
//           <Wallet size={20} className='text-[#002EFF]' /> Payments
//         </h1>
//         <p className='text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1'>
//           Plans · access caps · offline proof review
//         </p>
//       </div>
//       <PlansSection token={token} />
//       <CapsSection token={token} />
//       <OfflineQueueSection token={token} />
//     </div>
//   )
// }

// /* ------------------------------ Plans ------------------------------ */
// // Programme a plan is for. Empty = shown to every student. Values match the
// // backend exam-track scoping (waec, jamb, postutme, undergrad, preclinical,
// // afterschool).
// const PLAN_TRACKS: { value: string; label: string }[] = [
//   { value: '', label: 'All programmes' },
//   { value: 'waec', label: 'WAEC' },
//   { value: 'jamb', label: 'JAMB' },
//   { value: 'postutme', label: 'Post-UTME' },
//   { value: 'undergrad', label: '100 Level' },
//   { value: 'preclinical', label: 'Preclinical' },
//   { value: 'afterschool', label: 'After-School' },
// ]
// const trackLabel = (v?: unknown) =>
//   PLAN_TRACKS.find((t) => t.value === String(v ?? ''))?.label ?? String(v ?? '')

// function PlansSection({ token }: { token?: string }) {
//   const [plans, setPlans] = useState<Record<string, unknown>[]>([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   const [name, setName] = useState('')
//   const [kind, setKind] = useState<'portal' | 'tutorial'>('tutorial')
//   const [amount, setAmount] = useState(8000)
//   const [months, setMonths] = useState(1)
//   const [track, setTrack] = useState('')
//   const [note, setNote] = useState('')
//   const [busy, setBusy] = useState(false)

//   const load = useCallback(async () => {
//     setLoading(true)
//     try {
//       setPlans((await dsaApi.plans.adminList(token)) as Record<string, unknown>[])
//       setError(null)
//     } catch {
//       setError('Plans endpoint not live yet — this will populate once the backend ships it.')
//     } finally {
//       setLoading(false)
//     }
//   }, [token])
//   useEffect(() => {
//     load()
//   }, [load])

//   const create = async () => {
//     if (name.trim().length < 2) return setError('Enter a plan name.')
//     setBusy(true)
//     setError(null)
//     try {
//       await dsaApi.plans.create(
//         {
//           name: name.trim(),
//           kind,
//           amount: Number(amount) || 0,
//           durationMonths: kind === 'portal' ? 0 : Number(months) || 1,
//           grantsLevel: kind === 'portal' ? 'portal' : 'tutorial',
//           track: track || undefined,
//           note: note.trim() || undefined,
//           active: true,
//         },
//         token,
//       )
//       setName('')
//       setNote('')
//       load()
//     } catch (e) {
//       setError(e instanceof Error ? e.message : 'Could not create the plan.')
//     } finally {
//       setBusy(false)
//     }
//   }

//   // Which plan is open for editing, and the values being typed into it.
//   const [editingId, setEditingId] = useState<string | null>(null)
//   const [edit, setEdit] = useState({ name: '', amount: '', durationMonths: '', note: '' })
//   // Delete is two taps: the bin, then "Sure?" on the same row.
//   const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

//   const beginEdit = (p: Record<string, unknown>) => {
//     setEditingId(str(p.id ?? p._id))
//     setEdit({
//       name: str(p.name),
//       amount: str(p.amount),
//       durationMonths: str(p.durationMonths ?? ''),
//       note: str(p.note ?? ''),
//     })
//     setError(null)
//   }

//   const saveEdit = async () => {
//     if (!editingId) return
//     const amount = Number(edit.amount)
//     if (!edit.name.trim()) return setError('Give the plan a name.')
//     if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a valid amount.')
//     setBusy(true)
//     setError(null)
//     try {
//       await dsaApi.plans.update(
//         editingId,
//         {
//           name: edit.name.trim(),
//           amount,
//           durationMonths: edit.durationMonths ? Number(edit.durationMonths) : undefined,
//           note: edit.note.trim() || undefined,
//         },
//         token,
//       )
//       setEditingId(null)
//       await load()
//     } catch (e) {
//       setError(e instanceof Error ? e.message : 'Could not save the plan.')
//     } finally {
//       setBusy(false)
//     }
//   }

//   const toggle = async (p: Record<string, unknown>) => {
//     const id = str(p.id ?? p._id)
//     setError(null)
//     try {
//       await dsaApi.plans.update(id, { active: !p.active }, token)
//       load()
//     } catch (e) {
//       setError(e instanceof Error ? e.message : 'Could not update the plan.')
//     }
//   }

//   const remove = async (id: string) => {
//     setError(null)
//     try {
//       await dsaApi.plans.remove(id, token)
//       setConfirmDeleteId(null)
//       await load()
//     } catch (e) {
//       // The API refuses to delete a plan with payments against it and says so.
//       // That message is the useful one, so it is shown as-is.
//       setConfirmDeleteId(null)
//       setError(e instanceof Error ? e.message : 'Could not delete the plan.')
//     }
//   }

//   return (
//     <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
//       <p className='text-[11px] font-black uppercase text-slate-500'>Payment plans</p>
//       {error && <p className='text-[11px] font-bold text-amber-600'>{error}</p>}

//       <div className='grid grid-cols-2 sm:grid-cols-6 gap-2'>
//         <label className='col-span-2 flex flex-col gap-1'>
//           <span className='text-[9px] font-black uppercase text-slate-400'>Plan name</span>
//           <input
//             value={name}
//             onChange={(e) => setName(e.target.value)}
//             placeholder='e.g. Silver'
//             className='h-10 px-3 rounded-lg bg-slate-50 outline-none text-sm font-bold'
//           />
//         </label>
//         <label className='flex flex-col gap-1'>
//           <span className='text-[9px] font-black uppercase text-slate-400'>Type</span>
//           <select
//             value={kind}
//             onChange={(e) => setKind(e.target.value as 'portal' | 'tutorial')}
//             className='h-10 px-2 rounded-lg bg-slate-50 outline-none text-[12px] font-bold'
//           >
//             <option value='portal'>Portal (₦2k)</option>
//             <option value='tutorial'>Tutorial</option>
//           </select>
//         </label>
//         <label className='flex flex-col gap-1'>
//           <span className='text-[9px] font-black uppercase text-slate-400'>Programme</span>
//           <select
//             value={track}
//             onChange={(e) => setTrack(e.target.value)}
//             className='h-10 px-2 rounded-lg bg-slate-50 outline-none text-[12px] font-bold'
//           >
//             {PLAN_TRACKS.map((t) => (
//               <option key={t.value} value={t.value}>
//                 {t.label}
//               </option>
//             ))}
//           </select>
//         </label>
//         <label className='flex flex-col gap-1'>
//           <span className='text-[9px] font-black uppercase text-slate-400'>Amount (₦)</span>
//           <input
//             type='number'
//             value={amount}
//             onChange={(e) => setAmount(Number(e.target.value))}
//             placeholder='8000'
//             className='h-10 px-2 rounded-lg bg-slate-50 outline-none text-sm font-bold'
//           />
//         </label>
//         <label className='flex flex-col gap-1'>
//           <span className='text-[9px] font-black uppercase text-slate-400'>
//             Months
//           </span>
//           {kind === 'tutorial' ? (
//             <input
//               type='number'
//               value={months}
//               min={1}
//               onChange={(e) => setMonths(Number(e.target.value))}
//               placeholder='e.g. 2'
//               className='h-10 px-2 rounded-lg bg-slate-50 outline-none text-sm font-bold'
//             />
//           ) : (
//             <div className='h-10 flex items-center text-[10px] font-bold text-slate-400'>
//               one-time
//             </div>
//           )}
//         </label>
//       </div>
//       {kind === 'tutorial' && (
//         <p className='text-[10px] font-bold text-slate-400 px-1'>
//           For a 2- or 3-month plan, set <b>Months</b> to 2 or 3 and enter that
//           duration&apos;s price in <b>Amount</b>. Add one plan per duration
//           (e.g. Silver 1mo, Silver 2mo, Silver 3mo).
//         </p>
//       )}
//       <input
//         value={note}
//         onChange={(e) => setNote(e.target.value)}
//         placeholder='Short description (optional) — e.g. “2 months, ₦2k discount”'
//         className='w-full h-10 px-3 rounded-lg bg-slate-50 outline-none text-sm font-medium'
//       />
//       <button
//         onClick={create}
//         disabled={busy}
//         className='flex items-center gap-2 h-9 px-4 bg-[#002EFF] text-white rounded-lg font-black text-[10px] uppercase tracking-wide hover:bg-blue-700 disabled:opacity-50'
//       >
//         {busy ? <Loader2 size={13} className='animate-spin' /> : <Plus size={13} />}
//         Add plan
//       </button>

//       <div className='space-y-1.5 pt-1'>
//         {loading ? (
//           <div className='py-4 flex justify-center'>
//             <Loader2 className='animate-spin text-[#002EFF]' size={18} />
//           </div>
//         ) : plans.length === 0 ? (
//           <p className='text-[11px] font-bold text-slate-400'>No plans yet.</p>
//         ) : (
//           plans.map((p) => {
//             const id = str(p.id ?? p._id)
//             return (
//               <div
//                 key={id}
//                 className='flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-50'
//               >
//                 {editingId === id && (
//                   <div className='basis-full grid grid-cols-2 sm:grid-cols-4 gap-2'>
//                     <input
//                       value={edit.name}
//                       onChange={(e) => setEdit((v) => ({ ...v, name: e.target.value }))}
//                       placeholder='Plan name'
//                       className='col-span-2 h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] font-bold outline-none'
//                     />
//                     <input
//                       type='number'
//                       min={0}
//                       value={edit.amount}
//                       onChange={(e) => setEdit((v) => ({ ...v, amount: e.target.value }))}
//                       placeholder='Amount in naira'
//                       className='h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] font-bold outline-none'
//                     />
//                     <input
//                       type='number'
//                       min={0}
//                       value={edit.durationMonths}
//                       onChange={(e) =>
//                         setEdit((v) => ({ ...v, durationMonths: e.target.value }))
//                       }
//                       placeholder='Months'
//                       className='h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] font-bold outline-none'
//                     />
//                     <input
//                       value={edit.note}
//                       onChange={(e) => setEdit((v) => ({ ...v, note: e.target.value }))}
//                       placeholder='Note (optional)'
//                       className='col-span-2 sm:col-span-3 h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] outline-none'
//                     />
//                     <div className='flex gap-1.5'>
//                       <button
//                         onClick={saveEdit}
//                         disabled={busy}
//                         className='flex-1 h-9 rounded-lg bg-[#002EFF] text-white text-[10px] font-black uppercase disabled:opacity-50'
//                       >
//                         Save
//                       </button>
//                       <button
//                         onClick={() => setEditingId(null)}
//                         className='h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-500 text-[10px] font-black uppercase'
//                       >
//                         Cancel
//                       </button>
//                     </div>
//                   </div>
//                 )}
//                 <div className='min-w-0 flex-1'>
//                   <p className='text-xs font-black text-slate-800 truncate'>
//                     {str(p.name)}
//                   </p>
//                   <p className='text-[10px] font-bold text-slate-400'>
//                     {naira(Number(p.amount))}
//                     {Number(p.durationMonths) > 0 && ` · ${str(p.durationMonths)} mo`}
//                     {' · '}
//                     {str(p.kind)}
//                     {' · '}
//                     {trackLabel(p.track)}
//                   </p>
//                   {p.note ? (
//                     <p className='text-[10px] font-medium text-slate-500 truncate'>
//                       {str(p.note)}
//                     </p>
//                   ) : null}
//                 </div>
//                 <button
//                   onClick={() => toggle(p)}
//                   className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
//                     p.active
//                       ? 'bg-emerald-50 text-emerald-600'
//                       : 'bg-slate-200 text-slate-400'
//                   }`}
//                 >
//                   <Power size={10} className='inline' /> {p.active ? 'On' : 'Off'}
//                 </button>
//                 <button
//                   onClick={() => beginEdit(p)}
//                   className='p-1 text-slate-300 hover:text-[#002EFF]'
//                   title='Edit plan'
//                 >
//                   <Pencil size={13} />
//                 </button>
//                 {confirmDeleteId === id ? (
//                   <button
//                     onClick={() => remove(id)}
//                     className='px-2 py-1 rounded-lg bg-rose-500 text-white text-[9px] font-black uppercase'
//                     title='Yes, delete it'
//                   >
//                     Sure?
//                   </button>
//                 ) : (
//                   <button
//                     onClick={() => setConfirmDeleteId(id)}
//                     className='p-1 text-slate-300 hover:text-rose-500'
//                     title='Delete plan'
//                   >
//                     <Trash2 size={13} />
//                   </button>
//                 )}
//               </div>
//             )
//           })
//         )}
//       </div>
//     </Card>
//   )
// }

// /* ------------------------------ Caps ------------------------------ */
// function CapsSection({ token }: { token?: string }) {
//   const [caps, setCaps] = useState<AccessCaps>(DEFAULT_CAPS)
//   const [saving, setSaving] = useState(false)
//   const [saved, setSaved] = useState(false)

//   useEffect(() => {
//     ;(async () => {
//       try {
//         const c = (await dsaApi.payments.getCaps(token)) as Partial<AccessCaps>
//         if (c && typeof c === 'object')
//           setCaps((prev) => ({ ...prev, ...c }))
//       } catch {
//         /* use defaults until backend ships */
//       }
//     })()
//   }, [token])

//   const field = (key: keyof AccessCaps, label: string) => (
//     <label className='flex items-center justify-between gap-2'>
//       <span className='text-[11px] font-bold text-slate-500'>{label}</span>
//       <input
//         type='number'
//         min={0}
//         value={caps[key]}
//         onChange={(e) =>
//           setCaps((c) => ({ ...c, [key]: Number(e.target.value) }))
//         }
//         className='w-20 h-9 px-2 rounded-lg bg-slate-50 outline-none text-sm font-bold text-center'
//       />
//     </label>
//   )

//   const save = async () => {
//     setSaving(true)
//     try {
//       await dsaApi.payments.setCaps(caps as unknown as Record<string, number>, token)
//       setSaved(true)
//       setTimeout(() => setSaved(false), 2000)
//     } catch {
//       /* backend not live yet */
//     } finally {
//       setSaving(false)
//     }
//   }

//   return (
//     <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
//       <p className='text-[11px] font-black uppercase text-slate-500 flex items-center gap-1.5'>
//         <SlidersHorizontal size={14} /> Access caps (Free / Portal — Tutorial is unlimited)
//       </p>
//       <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2'>
//         <p className='text-[10px] font-black uppercase text-slate-400 sm:col-span-2 mt-1'>
//           Free (L1)
//         </p>
//         {field('freeTests', 'Free tests')}
//         {field('freeMaterials', 'Learning materials')}
//         {field('freeLiveClasses', 'Live classes')}
//         <p className='text-[10px] font-black uppercase text-slate-400 sm:col-span-2 mt-2'>
//           Portal Access (L2)
//         </p>
//         {field('portalTests', 'Tests')}
//         {field('portalMaterials', 'Learning materials')}
//         {field('portalLiveClasses', 'Live classes')}
//       </div>
//       <button
//         onClick={save}
//         disabled={saving}
//         className='flex items-center gap-2 h-9 px-4 bg-[#002EFF] text-white rounded-lg font-black text-[10px] uppercase tracking-wide hover:bg-blue-700 disabled:opacity-50'
//       >
//         {saving ? (
//           <Loader2 size={13} className='animate-spin' />
//         ) : saved ? (
//           <Check size={13} />
//         ) : null}
//         {saved ? 'Saved' : 'Save caps'}
//       </button>
//     </Card>
//   )
// }

// /* ------------------------ Offline review queue ------------------------ */
// /**
//  * Receipts students uploaded, waiting for a yes or no. Shared with the staff
//  * dashboard, where a secretary with payments.verify does the same job.
//  */
// export function OfflineQueueSection({
//   token,
//   canReview = true,
// }: {
//   token?: string
//   /** False for staff who may only look (payments.view without payments.verify). */
//   canReview?: boolean
// }) {
//   const [rows, setRows] = useState<Record<string, unknown>[]>([])
//   const [loading, setLoading] = useState(true)
//   const [note, setNote] = useState<string | null>(null)
//   const [busy, setBusy] = useState<string | null>(null)
//   const [rejecting, setRejecting] = useState<string | null>(null)
//   const [reason, setReason] = useState('')
//   const [flash, setFlash] = useState<string | null>(null)

//   const load = useCallback(async () => {
//     setLoading(true)
//     try {
//       setRows((await dsaApi.payments.offlineQueue(token)) as Record<string, unknown>[])
//       setNote(null)
//     } catch (e) {
//       setNote(
//         e instanceof Error
//           ? `Could not load the proofs: ${e.message}`
//           : 'Could not load the proofs. Check your connection and refresh.',
//       )
//     } finally {
//       setLoading(false)
//     }
//   }, [token])
//   useEffect(() => {
//     load()
//   }, [load])

//   const review = async (id: string, decision: 'approve' | 'reject') => {
//     setBusy(id)
//     setNote(null)
//     try {
//       await dsaApi.payments.review(id, decision, token, decision === 'reject' ? reason : undefined)
//       setRows((r) => r.filter((x) => str(x.id ?? x._id) !== id))
//       setRejecting(null)
//       setReason('')
//       setFlash(decision === 'approve' ? 'Payment confirmed. The student has been told.' : 'Payment rejected. The student has been told.')
//       setTimeout(() => setFlash(null), 4000)
//     } catch (e) {
//       // Keep the row and say why, rather than silently putting it back.
//       setNote(e instanceof Error ? e.message : 'Could not save the decision.')
//     } finally {
//       setBusy(null)
//     }
//   }

//   return (
//     <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
//       <p className='text-[11px] font-black uppercase text-slate-500'>
//         Offline payment proofs
//       </p>
//       {note && <p className='text-[11px] font-bold text-rose-600'>{note}</p>}
//       {flash && <p className='text-[11px] font-bold text-emerald-600'>{flash}</p>}
//       {loading ? (
//         <div className='py-4 flex justify-center'>
//           <Loader2 className='animate-spin text-[#002EFF]' size={18} />
//         </div>
//       ) : rows.length === 0 ? (
//         <p className='text-[11px] font-bold text-slate-400'>
//           No pending proofs.
//         </p>
//       ) : (
//         rows.map((r) => {
//           const id = str(r.id ?? r._id)
//           const proof = str(r.proofUrl)
//           const who =
//             str(
//               (r.student as Record<string, unknown>)?.fullname ??
//                 r.studentName ??
//                 r.studentId,
//             ) || 'Student'
//           const isBusy = busy === id
//           return (
//             <div key={id} className='rounded-xl bg-slate-50 p-2.5'>
//               <div className='flex items-center gap-2'>
//                 <div className='min-w-0 flex-1'>
//                   <p className='text-xs font-black text-slate-800 truncate'>{who}</p>
//                   <p className='text-[10px] font-bold text-slate-400'>
//                     {naira(Number(r.amount))} · {str(r.method) || 'offline'}
//                     {r.reference ? ` · ${str(r.reference)}` : ''}
//                   </p>
//                 </div>
//                 {proof && (
//                   <a
//                     href={proof}
//                     target='_blank'
//                     rel='noopener noreferrer'
//                     className='flex items-center gap-1 text-[10px] font-black text-[#002EFF] hover:underline'
//                   >
//                     <ExternalLink size={11} /> Proof
//                   </a>
//                 )}
//                 {canReview && (
//                   <>
//                     <button
//                       onClick={() => review(id, 'approve')}
//                       disabled={isBusy}
//                       className='p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50'
//                       title='Approve'
//                     >
//                       {isBusy ? <Loader2 size={14} className='animate-spin' /> : <Check size={14} />}
//                     </button>
//                     <button
//                       onClick={() => setRejecting(rejecting === id ? null : id)}
//                       disabled={isBusy}
//                       className='p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-50'
//                       title='Reject'
//                     >
//                       <X size={14} />
//                     </button>
//                   </>
//                 )}
//               </div>
//               {rejecting === id && (
//                 <div className='mt-2 flex flex-col gap-2 sm:flex-row'>
//                   <input
//                     value={reason}
//                     onChange={(e) => setReason(e.target.value)}
//                     maxLength={300}
//                     placeholder='Why not? The student sees this.'
//                     className='h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium outline-none focus:border-rose-300'
//                   />
//                   <button
//                     onClick={() => review(id, 'reject')}
//                     disabled={isBusy}
//                     className='h-9 rounded-lg bg-rose-600 px-4 text-[10px] font-black uppercase text-white hover:bg-rose-700 disabled:opacity-50'
//                   >
//                     Confirm reject
//                   </button>
//                 </div>
//               )}
//             </div>
//           )
//         })
//       )}
//     </Card>
//   )
// }



'use client'

// Admin payments — manage plans & their amounts, set the L1/L2 access caps, and
// review offline-payment proofs. See docs/payment-plan.md & backend-request-payments.md.

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Search,
  Clock3,
  CheckCircle2,
  XCircle,
  Banknote,
  Eye,
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

const str = (v: unknown): string => {
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return ''
  return String(v)
}

const naira = (n: number): string =>
  `₦${(Number(n) || 0).toLocaleString()}`

const dateText = (value: unknown): string => {
  const date = new Date(str(value))

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const dateTimeText = (value: unknown): string => {
  const date = new Date(str(value))

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type PaymentRow = Record<string, unknown>

type PaymentStatus = 'pending' | 'approved' | 'rejected'

const paymentStatus = (row: PaymentRow): PaymentStatus => {
  const status = str(row.status).toLowerCase()

  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'

  return 'pending'
}

const studentName = (row: PaymentRow): string => {
  const student =
    row.student && typeof row.student === 'object'
      ? (row.student as Record<string, unknown>)
      : null

  return (
    str(student?.fullname) ||
    str(student?.fullName) ||
    str(row.studentName) ||
    str(row.studentId) ||
    'Student'
  )
}

const studentEmail = (row: PaymentRow): string => {
  const student =
    row.student && typeof row.student === 'object'
      ? (row.student as Record<string, unknown>)
      : null

  return str(student?.email) || str(row.email)
}

const studentIdText = (row: PaymentRow): string => {
  const student =
    row.student && typeof row.student === 'object'
      ? (row.student as Record<string, unknown>)
      : null

  return str(student?.studentId) || ''
}

const planName = (row: PaymentRow): string => {
  const plan =
    row.planId && typeof row.planId === 'object'
      ? (row.planId as Record<string, unknown>)
      : null

  return str(plan?.name) || str(row.planName) || 'Payment plan'
}

export default function PaymentsAdmin() {
  const token = adminToken()

  return (
    <div className='max-w-4xl mx-auto space-y-6 px-1'>
      <div>
        <h1 className='text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2'>
          <Wallet size={20} className='text-[#002EFF]' />
          Payments
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

const PLAN_TRACKS: { value: string; label: string }[] = [
  { value: '', label: 'All programmes' },
  { value: 'waec', label: 'WAEC' },
  { value: 'jamb', label: 'JAMB' },
  { value: 'postutme', label: 'Post-UTME' },
  { value: 'undergrad', label: '100 Level' },
  { value: 'preclinical', label: 'Preclinical' },
  { value: 'afterschool', label: 'After-School' },
]

const trackLabel = (v?: unknown): string =>
  PLAN_TRACKS.find((t) => t.value === String(v ?? ''))?.label ??
  String(v ?? '')

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

  const [editingId, setEditingId] = useState<string | null>(null)

  const [edit, setEdit] = useState({
    name: '',
    amount: '',
    durationMonths: '',
    note: '',
  })

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      setPlans(
        (await dsaApi.plans.adminList(token)) as Record<string, unknown>[],
      )
      setError(null)
    } catch {
      setError(
        'Plans endpoint not live yet — this will populate once the backend ships it.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    if (name.trim().length < 2) {
      setError('Enter a plan name.')
      return
    }

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
      await load()
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Could not create the plan.',
      )
    } finally {
      setBusy(false)
    }
  }

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

    const editAmount = Number(edit.amount)

    if (!edit.name.trim()) {
      setError('Give the plan a name.')
      return
    }

    if (!Number.isFinite(editAmount) || editAmount <= 0) {
      setError('Enter a valid amount.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      await dsaApi.plans.update(
        editingId,
        {
          name: edit.name.trim(),
          amount: editAmount,
          durationMonths: edit.durationMonths
            ? Number(edit.durationMonths)
            : undefined,
          note: edit.note.trim() || undefined,
        },
        token,
      )

      setEditingId(null)
      await load()
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Could not save the plan.',
      )
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (p: Record<string, unknown>) => {
    const id = str(p.id ?? p._id)

    setError(null)

    try {
      await dsaApi.plans.update(
        id,
        {
          active: !Boolean(p.active),
        },
        token,
      )

      await load()
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Could not update the plan.',
      )
    }
  }

  const remove = async (id: string) => {
    setError(null)

    try {
      await dsaApi.plans.remove(id, token)
      setConfirmDeleteId(null)
      await load()
    } catch (e: unknown) {
      setConfirmDeleteId(null)

      setError(
        e instanceof Error ? e.message : 'Could not delete the plan.',
      )
    }
  }

  return (
    <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
      <p className='text-[11px] font-black uppercase text-slate-500'>
        Payment plans
      </p>

      {error && (
        <p className='text-[11px] font-bold text-amber-600'>
          {error}
        </p>
      )}

      <div className='grid grid-cols-2 sm:grid-cols-6 gap-2'>
        <label className='col-span-2 flex flex-col gap-1'>
          <span className='text-[9px] font-black uppercase text-slate-400'>
            Plan name
          </span>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. Silver'
            className='h-10 px-3 rounded-lg bg-slate-50 outline-none text-sm font-bold'
          />
        </label>

        <label className='flex flex-col gap-1'>
          <span className='text-[9px] font-black uppercase text-slate-400'>
            Type
          </span>

          <select
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as 'portal' | 'tutorial')
            }
            className='h-10 px-2 rounded-lg bg-slate-50 outline-none text-[12px] font-bold'
          >
            <option value='portal'>Portal (₦2k)</option>
            <option value='tutorial'>Tutorial</option>
          </select>
        </label>

        <label className='flex flex-col gap-1'>
          <span className='text-[9px] font-black uppercase text-slate-400'>
            Programme
          </span>

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
          <span className='text-[9px] font-black uppercase text-slate-400'>
            Amount (₦)
          </span>

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
          For a 2- or 3-month plan, set <b>Months</b> to 2 or 3 and enter
          that duration&apos;s price in <b>Amount</b>. Add one plan per
          duration (e.g. Silver 1mo, Silver 2mo, Silver 3mo).
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
        {busy ? (
          <Loader2 size={13} className='animate-spin' />
        ) : (
          <Plus size={13} />
        )}
        Add plan
      </button>

      <div className='space-y-1.5 pt-1'>
        {loading ? (
          <div className='py-4 flex justify-center'>
            <Loader2
              className='animate-spin text-[#002EFF]'
              size={18}
            />
          </div>
        ) : plans.length === 0 ? (
          <p className='text-[11px] font-bold text-slate-400'>
            No plans yet.
          </p>
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
                      onChange={(e) =>
                        setEdit((v) => ({
                          ...v,
                          name: e.target.value,
                        }))
                      }
                      placeholder='Plan name'
                      className='col-span-2 h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] font-bold outline-none'
                    />

                    <input
                      type='number'
                      min={0}
                      value={edit.amount}
                      onChange={(e) =>
                        setEdit((v) => ({
                          ...v,
                          amount: e.target.value,
                        }))
                      }
                      placeholder='Amount in naira'
                      className='h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] font-bold outline-none'
                    />

                    <input
                      type='number'
                      min={0}
                      value={edit.durationMonths}
                      onChange={(e) =>
                        setEdit((v) => ({
                          ...v,
                          durationMonths: e.target.value,
                        }))
                      }
                      placeholder='Months'
                      className='h-9 px-2.5 rounded-lg bg-white border border-slate-200 text-[12px] font-bold outline-none'
                    />

                    <input
                      value={edit.note}
                      onChange={(e) =>
                        setEdit((v) => ({
                          ...v,
                          note: e.target.value,
                        }))
                      }
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
                    {Number(p.durationMonths) > 0 &&
                      ` · ${str(p.durationMonths)} mo`}
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
                    Boolean(p.active)
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  <Power size={10} className='inline' />{' '}
                  {Boolean(p.active) ? 'On' : 'Off'}
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
        const c = (await dsaApi.payments.getCaps(
          token,
        )) as Partial<AccessCaps>

        if (c && typeof c === 'object') {
          setCaps((prev) => ({
            ...prev,
            ...c,
          }))
        }
      } catch {
        // Use defaults until backend ships.
      }
    })()
  }, [token])

  const field = (key: keyof AccessCaps, label: string) => (
    <label className='flex items-center justify-between gap-2'>
      <span className='text-[11px] font-bold text-slate-500'>
        {label}
      </span>

      <input
        type='number'
        min={0}
        value={caps[key]}
        onChange={(e) =>
          setCaps((c) => ({
            ...c,
            [key]: Number(e.target.value),
          }))
        }
        className='w-20 h-9 px-2 rounded-lg bg-slate-50 outline-none text-sm font-bold text-center'
      />
    </label>
  )

  const save = async () => {
    setSaving(true)

    try {
      await dsaApi.payments.setCaps(
        caps as unknown as Record<string, number>,
        token,
      )

      setSaved(true)

      setTimeout(() => {
        setSaved(false)
      }, 2000)
    } catch {
      // Backend not live yet.
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
      <p className='text-[11px] font-black uppercase text-slate-500 flex items-center gap-1.5'>
        <SlidersHorizontal size={14} />
        Access caps (Free / Portal — Tutorial is unlimited)
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

export function OfflineQueueSection({
  token,
  canReview = true,
}: {
  token?: string
  canReview?: boolean
}) {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  const [note, setNote] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [busy, setBusy] = useState<string | null>(null)

  const [reviewTarget, setReviewTarget] = useState<{
    row: PaymentRow
    decision: 'approve' | 'reject'
  } | null>(null)

  const [reason, setReason] = useState('')

  const [historySearch, setHistorySearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'approved' | 'rejected'
  >('all')

  const [selectedHistory, setSelectedHistory] =
    useState<PaymentRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const response = await dsaApi.payments.offlineQueue(token)

      setRows(response as PaymentRow[])
      setNote(null)
    } catch (e: unknown) {
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

  const pendingRows = useMemo(
    () => rows.filter((row) => paymentStatus(row) === 'pending'),
    [rows],
  )

  const historyRows = useMemo(
    () =>
      rows
        .filter((row) => {
          const status = paymentStatus(row)

          return status === 'approved' || status === 'rejected'
        })
        .filter((row) => {
          const status = paymentStatus(row)

          if (
            historyFilter !== 'all' &&
            status !== historyFilter
          ) {
            return false
          }

          const search = historySearch.trim().toLowerCase()

          if (!search) return true

          return [
            studentName(row),
            studentEmail(row),
            studentIdText(row),
            str(row.reference),
            planName(row),
          ]
            .join(' ')
            .toLowerCase()
            .includes(search)
        })
        .sort(
          (a, b) =>
            new Date(str(b.createdAt)).getTime() -
            new Date(str(a.createdAt)).getTime(),
        ),
    [rows, historyFilter, historySearch],
  )

  const approvedRows = useMemo(
    () =>
      rows.filter(
        (row) => paymentStatus(row) === 'approved',
      ),
    [rows],
  )

  const rejectedRows = useMemo(
    () =>
      rows.filter(
        (row) => paymentStatus(row) === 'rejected',
      ),
    [rows],
  )

  const totalReceived = useMemo(
    () =>
      approvedRows.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
      ),
    [approvedRows],
  )

  const pendingAmount = useMemo(
    () =>
      pendingRows.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
      ),
    [pendingRows],
  )

  const dailyRevenue = useMemo(() => {
    const days: {
      label: string
      amount: number
    }[] = []

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date()

      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - i)

      const amount = approvedRows.reduce((sum, row) => {
        const paymentDate = new Date(str(row.createdAt))

        if (Number.isNaN(paymentDate.getTime())) return sum

        paymentDate.setHours(0, 0, 0, 0)

        if (paymentDate.getTime() === date.getTime()) {
          return sum + Number(row.amount || 0)
        }

        return sum
      }, 0)

      days.push({
        label: date.toLocaleDateString('en-NG', {
          weekday: 'short',
        }),
        amount,
      })
    }

    return days
  }, [approvedRows])

  const maxRevenue = Math.max(
    ...dailyRevenue.map((day) => day.amount),
    1,
  )

  const review = async (
    row: PaymentRow,
    decision: 'approve' | 'reject',
  ) => {
    const id = str(row.id ?? row._id)

    if (!id) return

    setBusy(id)
    setNote(null)

    try {
      await dsaApi.payments.review(
        id,
        decision,
        token,
        decision === 'reject' ? reason.trim() : undefined,
      )

      await load()

      setReviewTarget(null)
      setReason('')

      setFlash(
        decision === 'approve'
          ? 'Payment approved successfully.'
          : 'Payment declined successfully.',
      )

      setTimeout(() => {
        setFlash(null)
      }, 3500)
    } catch (e: unknown) {
      setNote(
        e instanceof Error
          ? e.message
          : 'Could not save the decision.',
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Card className='p-4 sm:p-5 rounded-3xl border-none shadow-sm bg-white space-y-4'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
          <div>
            <p className='text-[11px] font-black uppercase text-slate-500'>
              Offline payment proofs
            </p>

            <p className='text-[10px] font-bold text-slate-400 mt-0.5'>
              Review student payment receipts and track confirmed payments.
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className='self-start sm:self-auto h-8 px-3 rounded-lg bg-slate-50 text-slate-500 text-[9px] font-black uppercase hover:bg-slate-100 disabled:opacity-50'
          >
            {loading ? (
              <Loader2
                size={12}
                className='animate-spin inline mr-1'
              />
            ) : null}
            Refresh
          </button>
        </div>

        {note && (
          <p className='text-[11px] font-bold text-rose-600 bg-rose-50 rounded-lg px-3 py-2'>
            {note}
          </p>
        )}

        {flash && (
          <p className='text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2'>
            {flash}
          </p>
        )}

        {/* Summary */}
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
          <SummaryCard
            icon={<Banknote size={14} />}
            label='Received'
            value={naira(totalReceived)}
            className='text-emerald-600 bg-emerald-50'
          />

          <SummaryCard
            icon={<Clock3 size={14} />}
            label='Pending'
            value={String(pendingRows.length)}
            sub={naira(pendingAmount)}
            className='text-amber-600 bg-amber-50'
          />

          <SummaryCard
            icon={<CheckCircle2 size={14} />}
            label='Approved'
            value={String(approvedRows.length)}
            className='text-blue-600 bg-blue-50'
          />

          <SummaryCard
            icon={<XCircle size={14} />}
            label='Declined'
            value={String(rejectedRows.length)}
            className='text-rose-600 bg-rose-50'
          />
        </div>

        {/* Revenue graph */}
        <div className='rounded-2xl border border-slate-100 p-3.5'>
          <div className='flex items-center justify-between mb-3'>
            <div>
              <p className='text-[10px] font-black uppercase text-slate-500'>
                Payment received
              </p>

              <p className='text-[9px] font-bold text-slate-400'>
                Last 7 days
              </p>
            </div>

            <p className='text-sm font-black text-slate-800'>
              {naira(totalReceived)}
            </p>
          </div>

          <div className='h-24 flex items-end gap-1.5 sm:gap-2'>
            {dailyRevenue.map((day) => {
              const height =
                day.amount > 0
                  ? Math.max(
                      8,
                      (day.amount / maxRevenue) * 100,
                    )
                  : 3

              return (
                <div
                  key={day.label}
                  className='flex-1 h-full flex flex-col justify-end items-center gap-1'
                >
                  <div
                    className='w-full max-w-8 rounded-t-md bg-[#002EFF]/80 hover:bg-[#002EFF] transition-all'
                    style={{
                      height: `${height}%`,
                    }}
                    title={`${day.label}: ${naira(day.amount)}`}
                  />

                  <span className='text-[8px] font-bold text-slate-400'>
                    {day.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pending */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-[10px] font-black uppercase text-slate-500'>
                Pending review
              </p>

              <p className='text-[9px] font-bold text-slate-400'>
                {pendingRows.length} payment
                {pendingRows.length === 1 ? '' : 's'} waiting
              </p>
            </div>

            {pendingAmount > 0 && (
              <p className='text-[10px] font-black text-amber-600'>
                {naira(pendingAmount)}
              </p>
            )}
          </div>

          {loading ? (
            <div className='py-8 flex justify-center'>
              <Loader2
                className='animate-spin text-[#002EFF]'
                size={18}
              />
            </div>
          ) : pendingRows.length === 0 ? (
            <div className='rounded-xl bg-slate-50 py-7 text-center'>
              <CheckCircle2
                size={22}
                className='mx-auto text-emerald-400 mb-1'
              />

              <p className='text-[11px] font-black text-slate-500'>
                No pending payments
              </p>

              <p className='text-[9px] font-bold text-slate-400'>
                New offline receipts will appear here.
              </p>
            </div>
          ) : (
            <div className='max-h-[390px] overflow-y-auto space-y-1.5 pr-1'>
              {pendingRows.map((row) => {
                const id = str(row.id ?? row._id)
                const proof = str(row.proofUrl)
                const isBusy = busy === id

                return (
                  <div
                    key={id}
                    className='rounded-xl bg-slate-50 p-2.5 hover:bg-slate-100/80 transition-colors'
                  >
                    <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                      <div className='min-w-0 flex-1'>
                        <p className='text-xs font-black text-slate-800 truncate'>
                          {studentName(row)}
                        </p>

                        <p className='text-[9px] font-bold text-slate-400 truncate'>
                          {studentIdText(row) || studentEmail(row) || 'Student'}
                        </p>
                      </div>

                      <div className='sm:text-right shrink-0'>
                        <p className='text-xs font-black text-slate-800'>
                          {naira(Number(row.amount))}
                        </p>

                        <p className='text-[9px] font-bold text-slate-400'>
                          {str(row.method) || 'offline'} ·{' '}
                          {dateText(row.createdAt)}
                        </p>
                      </div>

                      <div className='flex items-center gap-1.5 sm:ml-auto'>
                        {proof && (
                          <a
                            href={proof}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center gap-1 text-[9px] font-black uppercase'
                          >
                            <ExternalLink size={11} />

                            <span className='hidden sm:inline'>
                              Proof
                            </span>
                          </a>
                        )}

                        {canReview && (
                          <>
                            <button
                              onClick={() =>
                                setReviewTarget({
                                  row,
                                  decision: 'approve',
                                })
                              }
                              disabled={isBusy}
                              className='h-8 px-2.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-[9px] font-black uppercase disabled:opacity-50'
                            >
                              {isBusy ? (
                                <Loader2
                                  size={12}
                                  className='animate-spin'
                                />
                              ) : (
                                'Approve'
                              )}
                            </button>

                            <button
                              onClick={() => {
                                setReason('')

                                setReviewTarget({
                                  row,
                                  decision: 'reject',
                                })
                              }}
                              disabled={isBusy}
                              className='h-8 px-2.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 text-[9px] font-black uppercase disabled:opacity-50'
                            >
                              Decline
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* History */}
        <div className='space-y-2 pt-1'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
            <div>
              <p className='text-[10px] font-black uppercase text-slate-500'>
                Payment history
              </p>

              <p className='text-[9px] font-bold text-slate-400'>
                Approved and declined payments remain here.
              </p>
            </div>

            <div className='flex items-center gap-1'>
              {(['all', 'approved', 'rejected'] as const).map(
                (filter) => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`h-7 px-2.5 rounded-lg text-[8px] font-black uppercase ${
                      historyFilter === filter
                        ? 'bg-[#002EFF] text-white'
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {filter === 'all'
                      ? 'All'
                      : filter === 'approved'
                        ? 'Approved'
                        : 'Declined'}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className='relative'>
            <Search
              size={13}
              className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-300'
            />

            <input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder='Search student, ID, email or reference...'
              className='w-full h-9 pl-8 pr-3 rounded-lg bg-slate-50 outline-none text-[10px] font-bold text-slate-700 placeholder:text-slate-300'
            />
          </div>

          {historyRows.length === 0 ? (
            <div className='rounded-xl bg-slate-50 py-6 text-center'>
              <p className='text-[10px] font-black text-slate-400'>
                No payment history found.
              </p>
            </div>
          ) : (
            <div className='max-h-[430px] overflow-y-auto space-y-1.5 pr-1'>
              {historyRows.map((row) => {
                const status = paymentStatus(row)

                return (
                  <button
                    key={str(row.id ?? row._id)}
                    onClick={() => setSelectedHistory(row)}
                    className='w-full text-left rounded-xl bg-slate-50 p-2.5 hover:bg-slate-100 transition-colors'
                  >
                    <div className='flex items-center gap-2'>
                      <div
                        className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${
                          status === 'approved'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-rose-50 text-rose-500'
                        }`}
                      >
                        {status === 'approved' ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <XCircle size={15} />
                        )}
                      </div>

                      <div className='min-w-0 flex-1'>
                        <p className='text-xs font-black text-slate-800 truncate'>
                          {studentName(row)}
                        </p>

                        <p className='text-[9px] font-bold text-slate-400 truncate'>
                          {str(row.method) || 'offline'} ·{' '}
                          {dateText(row.createdAt)}
                        </p>
                      </div>

                      <div className='text-right shrink-0'>
                        <p className='text-xs font-black text-slate-800'>
                          {naira(Number(row.amount))}
                        </p>

                        <span
                          className={`text-[8px] font-black uppercase ${
                            status === 'approved'
                              ? 'text-emerald-600'
                              : 'text-rose-500'
                          }`}
                        >
                          {status === 'approved'
                            ? 'Approved'
                            : 'Declined'}
                        </span>
                      </div>

                      <Eye
                        size={13}
                        className='shrink-0 text-slate-300'
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Confirmation modal */}
      {reviewTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm'>
          <div className='w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 p-5'>
            <div className='flex items-start gap-3'>
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  reviewTarget.decision === 'approve'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-500'
                }`}
              >
                {reviewTarget.decision === 'approve' ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <XCircle size={20} />
                )}
              </div>

              <div className='min-w-0 flex-1'>
                <h3 className='text-sm font-black text-slate-900'>
                  {reviewTarget.decision === 'approve'
                    ? 'Approve payment?'
                    : 'Decline payment?'}
                </h3>

                <p className='text-[10px] font-bold text-slate-400 mt-0.5'>
                  {studentName(reviewTarget.row)}
                </p>
              </div>

              <button
                onClick={() => {
                  setReviewTarget(null)
                  setReason('')
                }}
                className='p-1 text-slate-300 hover:text-slate-500'
              >
                <X size={16} />
              </button>
            </div>

            <div className='mt-4 rounded-xl bg-slate-50 p-3 space-y-2'>
              <div className='flex justify-between gap-3'>
                <span className='text-[9px] font-black uppercase text-slate-400'>
                  Amount
                </span>

                <span className='text-xs font-black text-slate-800'>
                  {naira(Number(reviewTarget.row.amount))}
                </span>
              </div>

              <div className='flex justify-between gap-3'>
                <span className='text-[9px] font-black uppercase text-slate-400'>
                  Method
                </span>

                <span className='text-[10px] font-bold text-slate-600'>
                  {str(reviewTarget.row.method) || 'Offline'}
                </span>
              </div>

              <div className='flex justify-between gap-3'>
                <span className='text-[9px] font-black uppercase text-slate-400'>
                  Reference
                </span>

                <span className='text-[10px] font-bold text-slate-600 truncate max-w-[200px]'>
                  {str(reviewTarget.row.reference) || '—'}
                </span>
              </div>
            </div>

            {reviewTarget.decision === 'reject' && (
              <div className='mt-3'>
                <label className='text-[9px] font-black uppercase text-slate-400'>
                  Reason
                </label>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder='Why is this payment being declined?'
                  className='mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium outline-none focus:border-rose-300 resize-none'
                />

                <p className='text-[8px] font-bold text-slate-400 mt-1'>
                  The student will see this reason.
                </p>
              </div>
            )}

            <div className='flex gap-2 mt-4'>
              <button
                onClick={() => {
                  setReviewTarget(null)
                  setReason('')
                }}
                className='flex-1 h-9 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black uppercase hover:bg-slate-200'
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  review(
                    reviewTarget.row,
                    reviewTarget.decision,
                  )
                }
                disabled={
                  busy ===
                  str(
                    reviewTarget.row.id ??
                      reviewTarget.row._id,
                  )
                }
                className={`flex-1 h-9 rounded-lg text-white text-[10px] font-black uppercase disabled:opacity-50 ${
                  reviewTarget.decision === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {busy ===
                str(
                  reviewTarget.row.id ??
                    reviewTarget.row._id,
                ) ? (
                  <Loader2
                    size={13}
                    className='animate-spin mx-auto'
                  />
                ) : reviewTarget.decision === 'approve' ? (
                  'Confirm approve'
                ) : (
                  'Confirm decline'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History details modal */}
      {selectedHistory && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm'>
          <div className='w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 p-5'>
            <div className='flex items-start gap-3'>
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  paymentStatus(selectedHistory) ===
                  'approved'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-500'
                }`}
              >
                {paymentStatus(selectedHistory) ===
                'approved' ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <XCircle size={20} />
                )}
              </div>

              <div className='min-w-0 flex-1'>
                <h3 className='text-sm font-black text-slate-900'>
                  Payment details
                </h3>

                <p className='text-[10px] font-bold text-slate-400'>
                  {studentName(selectedHistory)}
                </p>
              </div>

              <button
                onClick={() => setSelectedHistory(null)}
                className='p-1 text-slate-300 hover:text-slate-500'
              >
                <X size={16} />
              </button>
            </div>

            <div className='mt-4 grid grid-cols-2 gap-2'>
              <DetailItem
                label='Amount paid'
                value={naira(Number(selectedHistory.amount))}
              />

              <DetailItem
                label='Status'
                value={
                  paymentStatus(selectedHistory) ===
                  'approved'
                    ? 'Approved'
                    : 'Declined'
                }
              />

              <DetailItem
                label='Student ID'
                value={
                  studentIdText(selectedHistory) || '—'
                }
              />

              <DetailItem
                label='Method'
                value={
                  str(selectedHistory.method) || 'Offline'
                }
              />

              <DetailItem
                label='Plan'
                value={planName(selectedHistory)}
              />

              <DetailItem
                label='Date'
                value={dateTimeText(
                  selectedHistory.createdAt,
                )}
              />

              <DetailItem
                label='Reference'
                value={
                  str(selectedHistory.reference) || '—'
                }
                full
              />

              {studentEmail(selectedHistory) && (
                <DetailItem
                  label='Email'
                  value={studentEmail(selectedHistory)}
                  full
                />
              )}

              {str(selectedHistory.reviewNote) && (
                <DetailItem
                  label='Review note'
                  value={str(selectedHistory.reviewNote)}
                  full
                />
              )}
            </div>

            {str(selectedHistory.proofUrl) && (
              <a
                href={str(selectedHistory.proofUrl)}
                target='_blank'
                rel='noopener noreferrer'
                className='mt-4 h-9 w-full rounded-lg bg-[#002EFF] text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase hover:bg-blue-700'
              >
                <ExternalLink size={13} />
                View payment proof
              </a>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------ Helpers ------------------------------ */

function SummaryCard({
  icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  className: string
}) {
  return (
    <div className='rounded-xl bg-slate-50 p-2.5 min-w-0'>
      <div className='flex items-center gap-1.5'>
        <div
          className={`h-7 w-7 rounded-lg flex items-center justify-center ${className}`}
        >
          {icon}
        </div>

        <div className='min-w-0'>
          <p className='text-[8px] font-black uppercase text-slate-400 truncate'>
            {label}
          </p>

          <p className='text-xs font-black text-slate-800 truncate'>
            {value}
          </p>
        </div>
      </div>

      {sub && (
        <p className='text-[8px] font-bold text-slate-400 mt-1 pl-8'>
          {sub} pending
        </p>
      )}
    </div>
  )
}

function DetailItem({
  label,
  value,
  full = false,
}: {
  label: string
  value: string
  full?: boolean
}) {
  return (
    <div
      className={`rounded-xl bg-slate-50 p-2.5 ${
        full ? 'col-span-2' : ''
      }`}
    >
      <p className='text-[8px] font-black uppercase text-slate-400'>
        {label}
      </p>

      <p className='text-[10px] font-black text-slate-700 mt-0.5 break-words'>
        {value}
      </p>
    </div>
  )
}