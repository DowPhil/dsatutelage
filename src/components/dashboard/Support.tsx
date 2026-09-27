// 'use client'

// // In-app support / customer care. A student submits { subject, message } to
// // POST /support and then sees the conversation in-app: staff replies appear in
// // the thread (GET /support) and the student can reply back
// // (POST /support/:id/reply). See docs/backend-requests-2026-09-03.md §7.

// import { useCallback, useEffect, useState } from 'react'
// import { Card } from '@/components/ui/card'
// import {
//   LifeBuoy,
//   Send,
//   Loader2,
//   Check,
//   AlertCircle,
//   Mail,
//   MessageSquare,
// } from 'lucide-react'
// import { dsaApi } from '@/lib/api'
// import { getUser, getToken } from '@/lib/auth'

// const str = (v: unknown) => (v == null ? '' : String(v))

// type ThreadMessage = {
//   authorRole?: string
//   authorName?: string
//   body: string
//   createdAt?: string
// }
// type Ticket = {
//   id: string
//   subject: string
//   message: string
//   messages: ThreadMessage[]
//   status: string
//   createdAt?: string
// }

// function mapTicket(t: Record<string, unknown>): Ticket {
//   const msgs = Array.isArray(t.messages)
//     ? (t.messages as Record<string, unknown>[]).map((m) => ({
//         authorRole: m.authorRole ? str(m.authorRole) : undefined,
//         authorName: m.authorName ? str(m.authorName) : undefined,
//         body: str(m.body),
//         createdAt: m.createdAt ? str(m.createdAt) : undefined,
//       }))
//     : []
//   return {
//     id: str(t.id ?? t._id),
//     subject: str(t.subject),
//     message: str(t.message),
//     messages: msgs,
//     status: str(t.status) || 'open',
//     createdAt: t.createdAt ? str(t.createdAt) : undefined,
//   }
// }

// export default function Support() {
//   const user = getUser()
//   const name = user?.fullName || user?.username || ''
//   const email = user?.email || ''

//   const [subject, setSubject] = useState('')
//   const [message, setMessage] = useState('')
//   const [busy, setBusy] = useState(false)
//   const [sent, setSent] = useState(false)
//   const [error, setError] = useState<string | null>(null)

//   const [tickets, setTickets] = useState<Ticket[]>([])
//   const [loadingTickets, setLoadingTickets] = useState(true)
//   const [replyText, setReplyText] = useState<Record<string, string>>({})
//   const [replyingId, setReplyingId] = useState<string | null>(null)

//   const loadTickets = useCallback(async () => {
//     setLoadingTickets(true)
//     try {
//       const rows = (await dsaApi.support.listMine(
//         getToken() || undefined,
//       )) as Record<string, unknown>[]
//       setTickets(rows.map(mapTicket))
//     } catch {
//       /* endpoint may not be live yet — the form still works */
//     } finally {
//       setLoadingTickets(false)
//     }
//   }, [])

//   useEffect(() => {
//     loadTickets()
//   }, [loadTickets])

//   const submit = async () => {
//     setError(null)
//     if (subject.trim().length < 3) return setError('Add a short subject.')
//     if (message.trim().length < 10)
//       return setError('Tell us a bit more (at least 10 characters).')
//     setBusy(true)
//     try {
//       await dsaApi.support.create({
//         subject: subject.trim(),
//         message: message.trim(),
//       })
//       setSubject('')
//       setMessage('')
//       setSent(true)
//       setTimeout(() => setSent(false), 4000)
//       loadTickets()
//     } catch (e) {
//       setError(
//         e instanceof Error
//           ? e.message
//           : 'Could not send your message. Please try again.',
//       )
//     } finally {
//       setBusy(false)
//     }
//   }

//   const sendReply = async (id: string) => {
//     const body = (replyText[id] || '').trim()
//     if (!body) return
//     setReplyingId(id)
//     try {
//       const updated = (await dsaApi.support.replyMine(
//         id,
//         body,
//         getToken() || undefined,
//       )) as Record<string, unknown>
//       const shaped = mapTicket(updated)
//       setTickets((prev) => prev.map((t) => (t.id === id ? shaped : t)))
//       setReplyText((prev) => ({ ...prev, [id]: '' }))
//     } catch {
//       /* keep the draft for retry */
//     } finally {
//       setReplyingId(null)
//     }
//   }

//   return (
//     <div className='max-w-lg mx-auto space-y-4'>
//       <div>
//         <h2 className='text-2xl font-black text-[#002EFF] italic uppercase flex items-center gap-2'>
//           <LifeBuoy size={22} /> Support
//         </h2>
//         <p className='text-[11px] font-bold text-slate-400'>
//           Have a question or an issue? Send us a message — replies show up here.
//         </p>
//       </div>

//       {/* New message */}
//       <Card className='p-5 rounded-3xl border-none shadow-sm bg-white space-y-3'>
//         <div className='flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5'>
//           <Mail size={14} className='text-slate-400' />
//           <span className='text-[11px] font-bold text-slate-500 truncate'>
//             {name ? `${name} · ` : ''}
//             {email || 'your account email'}
//           </span>
//         </div>

//         <input
//           value={subject}
//           onChange={(e) => setSubject(e.target.value)}
//           placeholder='Subject — e.g. Payment not reflecting'
//           className='w-full h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
//         />
//         <textarea
//           value={message}
//           onChange={(e) => setMessage(e.target.value)}
//           placeholder='Describe your question or issue…'
//           rows={4}
//           className='w-full px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium resize-none'
//         />

//         {error && (
//           <p className='flex items-center gap-1.5 text-[11px] font-bold text-rose-600'>
//             <AlertCircle size={13} /> {error}
//           </p>
//         )}
//         {sent && (
//           <p className='flex items-center gap-1.5 text-[11px] font-bold text-emerald-600'>
//             <Check size={13} /> Message sent — we&apos;ll reply here and by email.
//           </p>
//         )}

//         <button
//           onClick={submit}
//           disabled={busy}
//           className='w-full flex items-center justify-center gap-2 h-12 bg-[#002EFF] text-white rounded-2xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50'
//         >
//           {busy ? (
//             <Loader2 size={16} className='animate-spin' />
//           ) : (
//             <Send size={16} />
//           )}
//           Send message
//         </button>
//       </Card>

//       {/* Your messages / threads */}
//       <div>
//         <p className='text-[11px] font-black uppercase tracking-widest text-slate-400 px-1 mb-2 flex items-center gap-1.5'>
//           <MessageSquare size={13} /> Your messages
//         </p>

//         {loadingTickets ? (
//           <div className='py-8 flex justify-center'>
//             <Loader2 className='animate-spin text-[#002EFF]' size={18} />
//           </div>
//         ) : tickets.length === 0 ? (
//           <p className='text-[11px] font-bold text-slate-400 px-1'>
//             No messages yet. Anything you send will appear here with our replies.
//           </p>
//         ) : (
//           <div className='space-y-2'>
//             {tickets.map((t) => {
//               const closed = t.status === 'closed'
//               return (
//                 <Card
//                   key={t.id}
//                   className='p-4 rounded-2xl border border-slate-100 shadow-sm bg-white'
//                 >
//                   <div className='flex items-center gap-2 flex-wrap'>
//                     <p className='text-sm font-black text-slate-800'>
//                       {t.subject || '(no subject)'}
//                     </p>
//                     <span
//                       className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
//                         closed
//                           ? 'bg-slate-100 text-slate-400'
//                           : 'bg-emerald-50 text-emerald-600'
//                       }`}
//                     >
//                       {closed ? 'Closed' : 'Open'}
//                     </span>
//                   </div>

//                   {/* Opener */}
//                   <div className='mt-2 rounded-xl bg-slate-50 p-3 mr-6'>
//                     <p className='text-[12px] font-medium text-slate-700 whitespace-pre-wrap break-words'>
//                       {t.message}
//                     </p>
//                   </div>

//                   {/* Thread */}
//                   {t.messages.length > 0 && (
//                     <div className='mt-2 space-y-2'>
//                       {t.messages.map((m, i) => {
//                         const fromStaff =
//                           m.authorRole === 'admin' ||
//                           m.authorRole === 'staff' ||
//                           m.authorRole === 'moderator'
//                         return (
//                           <div
//                             key={i}
//                             className={`rounded-xl p-3 ${
//                               fromStaff ? 'bg-blue-50 ml-6' : 'bg-slate-50 mr-6'
//                             }`}
//                           >
//                             <p className='text-[9px] font-black uppercase tracking-wide text-slate-400 mb-1'>
//                               {fromStaff ? 'Support' : 'You'}
//                               {m.createdAt && (
//                                 <span className='text-slate-300'>
//                                   {' '}
//                                   · {new Date(m.createdAt).toLocaleString()}
//                                 </span>
//                               )}
//                             </p>
//                             <p className='text-[12px] font-medium text-slate-700 whitespace-pre-wrap break-words'>
//                               {m.body}
//                             </p>
//                           </div>
//                         )
//                       })}
//                     </div>
//                   )}

//                   {/* Reply */}
//                   <div className='mt-3 flex items-end gap-2'>
//                     <textarea
//                       value={replyText[t.id] || ''}
//                       onChange={(e) =>
//                         setReplyText((prev) => ({
//                           ...prev,
//                           [t.id]: e.target.value,
//                         }))
//                       }
//                       placeholder='Reply…'
//                       rows={2}
//                       className='flex-1 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-[12px] font-medium text-slate-800 px-3 py-2 resize-y'
//                     />
//                     <button
//                       onClick={() => sendReply(t.id)}
//                       disabled={
//                         replyingId === t.id || !(replyText[t.id] || '').trim()
//                       }
//                       className='flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#002EFF] text-white font-black text-[10px] uppercase tracking-wide hover:bg-blue-700 disabled:opacity-40 shrink-0'
//                     >
//                       {replyingId === t.id ? (
//                         <Loader2 size={13} className='animate-spin' />
//                       ) : (
//                         <>
//                           <Send size={13} /> Reply
//                         </>
//                       )}
//                     </button>
//                   </div>
//                 </Card>
//               )
//             })}
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }




'use client'

// In-app support / customer care component with full dark mode support and enhanced UI.
import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  LifeBuoy,
  Send,
  Loader2,
  Check,
  AlertCircle,
  Mail,
  MessageSquare,
  User,
  ShieldCheck,
} from 'lucide-react'
import { dsaApi } from '@/lib/api'
import { getUser, getToken } from '@/lib/auth'

const str = (v: unknown) => (v == null ? '' : String(v))

type ThreadMessage = {
  authorRole?: string
  authorName?: string
  body: string
  createdAt?: string
}

type Ticket = {
  id: string
  subject: string
  message: string
  messages: ThreadMessage[]
  status: string
  createdAt?: string
}

function mapTicket(t: Record<string, unknown>): Ticket {
  const msgs = Array.isArray(t.messages)
    ? (t.messages as Record<string, unknown>[]).map((m) => ({
        authorRole: m.authorRole ? str(m.authorRole) : undefined,
        authorName: m.authorName ? str(m.authorName) : undefined,
        body: str(m.body),
        createdAt: m.createdAt ? str(m.createdAt) : undefined,
      }))
    : []
  return {
    id: str(t.id ?? t._id),
    subject: str(t.subject),
    message: str(t.message),
    messages: msgs,
    status: str(t.status) || 'open',
    createdAt: t.createdAt ? str(t.createdAt) : undefined,
  }
}

export default function Support() {
  const user = getUser()
  const name = user?.fullName || user?.username || ''
  const email = user?.email || ''

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replyingId, setReplyingId] = useState<string | null>(null)

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true)
    try {
      const rows = (await dsaApi.support.listMine(
        getToken() || undefined,
      )) as Record<string, unknown>[]
      setTickets(rows.map(mapTicket))
    } catch {
      /* endpoint may not be live yet — the form still works */
    } finally {
      setLoadingTickets(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const submit = async () => {
    setError(null)
    if (subject.trim().length < 3) return setError('Add a short subject.')
    if (message.trim().length < 10)
      return setError('Tell us a bit more (at least 10 characters).')
    setBusy(true)
    try {
      await dsaApi.support.create({
        subject: subject.trim(),
        message: message.trim(),
      })
      setSubject('')
      setMessage('')
      setSent(true)
      setTimeout(() => setSent(false), 4000)
      loadTickets()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not send your message. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const sendReply = async (id: string) => {
    const body = (replyText[id] || '').trim()
    if (!body) return
    setReplyingId(id)
    try {
      const updated = (await dsaApi.support.replyMine(
        id,
        body,
        getToken() || undefined,
      )) as Record<string, unknown>
      const shaped = mapTicket(updated)
      setTickets((prev) => prev.map((t) => (t.id === id ? shaped : t)))
      setReplyText((prev) => ({ ...prev, [id]: '' }))
    } catch {
      /* keep the draft for retry */
    } finally {
      setReplyingId(null)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 px-4 py-2">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-blue-600 dark:text-blue-400 italic uppercase flex items-center gap-2 tracking-tight">
          <LifeBuoy className="w-6 h-6 animate-pulse" /> Support
        </h2>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mt-1">
          Have a question or an issue? Send us a message — replies show up here in real time.
        </p>
      </div>

      {/* New Message Form */}
      <Card className="p-5 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 space-y-4 transition-colors">
        <div className="flex items-center gap-2 rounded-xl bg-slate-100/70 dark:bg-zinc-800/60 px-3 py-2.5 border border-slate-200/50 dark:border-zinc-700/40">
          <Mail size={14} className="text-slate-400 dark:text-zinc-400 shrink-0" />
          <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 truncate">
            {name ? `${name} · ` : ''}
            {email || 'your account email'}
          </span>
        </div>

        <div className="space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject — e.g. Payment not reflecting"
            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-zinc-900 outline-none text-sm font-semibold text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 transition-all"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your question or issue…"
            rows={4}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-zinc-900 outline-none text-sm font-medium text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 resize-none transition-all"
          />
        </div>

        {error && (
          <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-bold text-rose-600 dark:text-rose-400">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {sent && (
          <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <Check size={14} className="shrink-0" />
            <span>Message sent — we&apos;ll reply here and by email.</span>
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 h-11 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Send size={15} /> Send message
            </>
          )}
        </button>
      </Card>

      {/* Tickets & Conversation List */}
      <div className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 px-1 flex items-center gap-1.5">
          <MessageSquare size={13} /> Your messages
        </p>

        {loadingTickets ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={22} />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800">
            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
              No messages yet. Anything you send will appear here with our replies.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => {
              const closed = t.status === 'closed'
              return (
                <Card
                  key={t.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 space-y-3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2.5">
                    <p className="text-sm font-black text-slate-800 dark:text-zinc-100">
                      {t.subject || '(no subject)'}
                    </p>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        closed
                          ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                      }`}
                    >
                      {closed ? 'Closed' : 'Open'}
                    </span>
                  </div>

                  {/* Initial Ticket Opening Message */}
                  <div className="rounded-xl bg-slate-100/70 dark:bg-zinc-800/60 border border-slate-200/50 dark:border-zinc-700/40 p-3 ml-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400 mb-1 flex items-center gap-1">
                      <User size={11} /> You (Original Request)
                    </p>
                    <p className="text-xs font-medium text-slate-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                      {t.message}
                    </p>
                  </div>

                  {/* Thread Replies */}
                  {t.messages.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                      {t.messages.map((m, i) => {
                        const fromStaff =
                          m.authorRole === 'admin' ||
                          m.authorRole === 'staff' ||
                          m.authorRole === 'moderator'
                        return (
                          <div
                            key={i}
                            className={`rounded-xl p-3 border ${
                              fromStaff
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50 mr-4'
                                : 'bg-slate-100/70 dark:bg-zinc-800/60 border-slate-200/50 dark:border-zinc-700/40 ml-4'
                            }`}
                          >
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                              {fromStaff ? (
                                <>
                                  <ShieldCheck size={12} className="text-blue-600 dark:text-blue-400" />
                                  <span className="text-blue-600 dark:text-blue-400">Support</span>
                                </>
                              ) : (
                                <>
                                  <User size={11} /> You
                                </>
                              )}
                              {m.createdAt && (
                                <span className="text-[9px] font-medium text-slate-400 dark:text-zinc-500 ml-1">
                                  · {new Date(m.createdAt).toLocaleString()}
                                </span>
                              )}
                            </p>
                            <p className="text-xs font-medium text-slate-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                              {m.body}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Reply Input Box */}
                  {!closed && (
                    <div className="pt-2 flex items-end gap-2">
                      <textarea
                        value={replyText[t.id] || ''}
                        onChange={(e) =>
                          setReplyText((prev) => ({
                            ...prev,
                            [t.id]: e.target.value,
                          }))
                        }
                        placeholder="Type your reply…"
                        rows={2}
                        className="flex-1 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-zinc-900 outline-none text-xs font-medium text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 p-2.5 resize-y transition-all"
                      />
                      <button
                        onClick={() => sendReply(t.id)}
                        disabled={
                          replyingId === t.id || !(replyText[t.id] || '').trim()
                        }
                        className="flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      >
                        {replyingId === t.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <>
                            <Send size={12} /> Reply
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}