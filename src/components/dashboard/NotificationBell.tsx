// 'use client'

// import { useCallback, useEffect, useRef, useState } from 'react'
// import {
//   Bell,
//   Megaphone,
//   CalendarCheck,
//   Award,
//   Video,
//   CheckCheck,
//   Loader2,
//   HelpCircle,
// } from 'lucide-react'
// import { getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'

// type Notif = {
//   id: string
//   type: string
//   title: string
//   body: string
//   link?: string
//   isRead: boolean
//   createdAt: string
// }

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }

// function iconFor(type: string) {
//   switch (type) {
//     case 'announcement':
//       return Megaphone
//     case 'attendance_open':
//       return CalendarCheck
//     case 'grade':
//       return Award
//     case 'class_reminder':
//       return Video
//     case 'quiz':
//       return HelpCircle
//     default:
//       return Bell
//   }
// }

// function timeAgo(iso: string): string {
//   const diff = Date.now() - new Date(iso).getTime()
//   const d = Math.floor(diff / 86_400_000)
//   if (d > 0) return `${d}d ago`
//   const h = Math.floor(diff / 3_600_000)
//   if (h > 0) return `${h}h ago`
//   const m = Math.floor(diff / 60_000)
//   return m > 1 ? `${m}m ago` : 'just now'
// }

// function mapNotif(n: Record<string, unknown>): Notif {
//   return {
//     id: String(n.id ?? n._id ?? ''),
//     type: String(n.type ?? 'info'),
//     title: String(n.title ?? ''),
//     body: String(n.body ?? ''),
//     link: n.link ? String(n.link) : undefined,
//     isRead: !!n.isRead,
//     createdAt: String(n.createdAt ?? new Date().toISOString()),
//   }
// }

// /**
//  * Notification bell + dropdown inbox. Live-only: reads GET /notifications and
//  * uses the server-side read state (PATCH /notifications/:id/read and
//  * /notifications/read-all). Renders nothing meaningful for demo/offline
//  * sessions (no backend inbox), so it stays quiet rather than showing mock data.
//  */
// export default function NotificationBell() {
//   const [open, setOpen] = useState(false)
//   const [items, setItems] = useState<Notif[]>([])
//   const [loading, setLoading] = useState(false)
//   // Gate rendering until mounted so SSR and the first client render match
//   // (isLive() reads localStorage, which is server-empty → hydration mismatch).
//   const [mounted, setMounted] = useState(false)
//   const ref = useRef<HTMLDivElement>(null)

//   useEffect(() => setMounted(true), [])

//   const load = useCallback(async () => {
//     if (!isLive()) return
//     setLoading(true)
//     try {
//       const rows = (await dsaApi.notifications.list()) as Record<
//         string,
//         unknown
//       >[]
//       setItems(rows.map(mapNotif))
//     } catch {
//       /* stay quiet on error */
//     } finally {
//       setLoading(false)
//     }
//   }, [])

//   useEffect(() => {
//     void load()
//   }, [load])

//   // Close on outside click.
//   useEffect(() => {
//     if (!open) return
//     const onDown = (e: MouseEvent) => {
//       if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
//     }
//     document.addEventListener('mousedown', onDown)
//     return () => document.removeEventListener('mousedown', onDown)
//   }, [open])

//   const unread = items.filter((n) => !n.isRead).length

//   const openAndRefresh = () => {
//     const next = !open
//     setOpen(next)
//     if (next) void load()
//   }

//   const markRead = async (id: string) => {
//     setItems((prev) =>
//       prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
//     )
//     try {
//       await dsaApi.notifications.markRead(id)
//     } catch {
//       void load() // reconcile with the server on failure
//     }
//   }

//   // Click a notification: mark it read, then follow its deep link (e.g. a quiz
//   // notification opens the Quizzes tab). A full navigation is used so the
//   // target dashboard re-reads the `?tab=` param even when it's already mounted.
//   const openNotif = (n: Notif) => {
//     if (!n.isRead) void markRead(n.id)
//     if (n.link) {
//       setOpen(false)
//       window.location.assign(n.link)
//     }
//   }

//   const markAllRead = async () => {
//     setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
//     try {
//       await dsaApi.notifications.markAllRead()
//     } catch {
//       void load()
//     }
//   }

//   // Nothing to show before mount (SSR parity) or for sessions without a real
//   // backend inbox.
//   if (!mounted || !isLive()) return null

//   return (
//     <div className='relative' ref={ref}>
//       <button
//         onClick={openAndRefresh}
//         className='relative h-9 w-9 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-500 hover:text-[#002EFF] hover:border-[#002EFF]/20 transition-colors'
//         title='Notifications'
//         aria-label='Notifications'
//       >
//         <Bell size={17} />
//         {unread > 0 && (
//           <span className='absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center'>
//             {unread > 9 ? '9+' : unread}
//           </span>
//         )}
//       </button>

//       {open && (
//         <div className='absolute right-0 mt-2 w-80 max-w-[92vw] bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden'>
//           <div className='flex items-center justify-between px-4 py-3 border-b border-slate-50'>
//             <p className='text-[11px] font-black uppercase text-gray-700'>
//               Notifications
//             </p>
//             {unread > 0 && (
//               <button
//                 onClick={markAllRead}
//                 className='flex items-center gap-1 text-[9px] font-black uppercase text-[#002EFF] hover:underline'
//               >
//                 <CheckCheck size={12} /> Mark all read
//               </button>
//             )}
//           </div>

//           <div className='max-h-[360px] overflow-y-auto'>
//             {loading ? (
//               <div className='py-8 flex justify-center'>
//                 <Loader2 className='animate-spin text-[#002EFF]' size={18} />
//               </div>
//             ) : items.length === 0 ? (
//               <p className='py-8 text-center text-[11px] font-bold text-slate-400'>
//                 You&apos;re all caught up.
//               </p>
//             ) : (
//               items.map((n) => {
//                 const Icon = iconFor(n.type)
//                 return (
//                   <button
//                     key={n.id}
//                     onClick={() => openNotif(n)}
//                     className={`w-full text-left flex gap-3 px-4 py-3 border-b border-slate-50 last:border-0 transition-colors ${n.isRead ? 'bg-white hover:bg-slate-50/60' : 'bg-blue-50/50 hover:bg-blue-50'}`}
//                   >
//                     <div
//                       className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${n.isRead ? 'bg-slate-100 text-slate-400' : 'bg-[#002EFF]/10 text-[#002EFF]'}`}
//                     >
//                       <Icon size={15} />
//                     </div>
//                     <div className='min-w-0 flex-1'>
//                       <div className='flex items-center gap-2'>
//                         <p className='text-[11px] font-black text-gray-800 truncate flex-1'>
//                           {n.title}
//                         </p>
//                         {!n.isRead && (
//                           <span className='h-2 w-2 rounded-full bg-[#002EFF] shrink-0' />
//                         )}
//                       </div>
//                       <p className='text-[10px] font-medium text-slate-500 line-clamp-2'>
//                         {n.body}
//                       </p>
//                       <p className='text-[9px] font-bold text-slate-400 mt-0.5'>
//                         {timeAgo(n.createdAt)}
//                       </p>
//                     </div>
//                   </button>
//                 )
//               })
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }



'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bell,
  Megaphone,
  CalendarCheck,
  Award,
  Video,
  CheckCheck,
  Loader2,
  HelpCircle,
} from 'lucide-react'
import { getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'

type Notif = {
  id: string
  type: string
  title: string
  body: string
  link?: string
  isRead: boolean
  createdAt: string
}

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

function iconFor(type: string) {
  switch (type) {
    case 'announcement':
      return Megaphone
    case 'attendance_open':
      return CalendarCheck
    case 'grade':
      return Award
    case 'class_reminder':
      return Video
    case 'quiz':
      return HelpCircle
    default:
      return Bell
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d > 0) return `${d}d ago`
  const h = Math.floor(diff / 3_600_000)
  if (h > 0) return `${h}h ago`
  const m = Math.floor(diff / 60_000)
  return m > 1 ? `${m}m ago` : 'just now'
}

function mapNotif(n: Record<string, unknown>): Notif {
  return {
    id: String(n.id ?? n._id ?? ''),
    type: String(n.type ?? 'info'),
    title: String(n.title ?? ''),
    body: String(n.body ?? ''),
    link: n.link ? String(n.link) : undefined,
    isRead: !!n.isRead,
    createdAt: String(n.createdAt ?? new Date().toISOString()),
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const load = useCallback(async () => {
    if (!isLive()) return
    setLoading(true)
    try {
      const rows = (await dsaApi.notifications.list()) as Record<
        string,
        unknown
      >[]
      setItems(rows.map(mapNotif))
    } catch {
      /* stay quiet on error */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const unread = items.filter((n) => !n.isRead).length

  const openAndRefresh = () => {
    const next = !open
    setOpen(next)
    if (next) void load()
  }

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    )
    try {
      await dsaApi.notifications.markRead(id)
    } catch {
      void load()
    }
  }

  const openNotif = (n: Notif) => {
    if (!n.isRead) void markRead(n.id)
    if (n.link) {
      setOpen(false)
      window.location.assign(n.link)
    }
  }

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    try {
      await dsaApi.notifications.markAllRead()
    } catch {
      void load()
    }
  }

  if (!mounted || !isLive()) return null

  return (
    <div className='relative' ref={ref}>
      <button
        onClick={openAndRefresh}
        className='relative h-9 w-9 rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-[#002EFF] dark:hover:text-yellow-400 transition-colors'
        title='Notifications'
        aria-label='Notifications'
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className='absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center'>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className='
            fixed inset-x-4 top-16 z-50 
            sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 
            bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden
          '
        >
          <div className='flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-800/80'>
            <p className='text-[11px] font-black uppercase text-gray-700 dark:text-zinc-200'>
              Notifications
            </p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className='flex items-center gap-1 text-[9px] font-black uppercase text-[#002EFF] dark:text-yellow-400 hover:underline'
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className='max-h-[360px] overflow-y-auto'>
            {loading ? (
              <div className='py-8 flex justify-center'>
                <Loader2 className='animate-spin text-[#002EFF] dark:text-yellow-400' size={18} />
              </div>
            ) : items.length === 0 ? (
              <p className='py-8 text-center text-[11px] font-bold text-slate-400 dark:text-zinc-500'>
                You&apos;re all caught up.
              </p>
            ) : (
              items.map((n) => {
                const Icon = iconFor(n.type)
                return (
                  <button
                    key={n.id}
                    onClick={() => openNotif(n)}
                    className={`w-full text-left flex gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800/60 last:border-0 transition-colors ${
                      n.isRead
                        ? 'bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                        : 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        n.isRead
                          ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-400'
                          : 'bg-[#002EFF]/10 dark:bg-yellow-400/10 text-[#002EFF] dark:text-yellow-400'
                      }`}
                    >
                      <Icon size={15} />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <p className='text-[11px] font-black text-gray-800 dark:text-zinc-200 truncate flex-1'>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className='h-2 w-2 rounded-full bg-[#002EFF] dark:bg-yellow-400 shrink-0' />
                        )}
                      </div>
                      <p className='text-[10px] font-medium text-slate-500 dark:text-zinc-400 line-clamp-2'>
                        {n.body}
                      </p>
                      <p className='text-[9px] font-bold text-slate-400 dark:text-zinc-500 mt-0.5'>
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}