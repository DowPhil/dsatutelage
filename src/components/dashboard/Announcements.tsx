// 'use client'

// import React, { useCallback, useEffect, useState } from 'react'
// import {
//   Megaphone,
//   Send,
//   Trash2,
//   Pencil,
//   Check,
//   X,
//   Globe,
//   GraduationCap,
//   BookOpen,
//   CheckCheck,
//   Loader2,
// } from 'lucide-react'
// import { Card } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import { getUser, getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'
// import {
//   getAnnouncements as getLocalAnnouncements,
//   getForStudent as getLocalForStudent,
//   addAnnouncement as addLocalAnnouncement,
//   removeAnnouncement as removeLocalAnnouncement,
//   updateAnnouncement as updateLocalAnnouncement,
//   getReadIds,
//   markRead as markReadLocal,
//   markAllRead as markAllReadLocal,
// } from '@/lib/announcementsStore'
// import { normaliseTrack, EXAM_TRACKS } from '@/lib/studentProfile'
// import { getCourses } from '@/lib/coursesStore'
// import type { Announcement } from '@/lib/types'

// const TRACKS: { id: string; label: string }[] = [
//   { id: 'jamb', label: 'JAMB' },
//   { id: 'waec', label: 'WAEC' },
//   { id: 'postutme', label: 'Post-UTME' },
// ]

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }

// // The API returns { id, scope, examTrack?, authorId?, title, body, createdAt }
// // (no authorName), so default the author label.
// function mapAnnouncement(a: Record<string, unknown>): Announcement {
//   const scope: Announcement['scope'] =
//     a.scope === 'track' ? 'track' : a.scope === 'course' ? 'course' : 'global'
//   const courseRef = a.courseId as unknown
//   const courseObj =
//     courseRef && typeof courseRef === 'object'
//       ? (courseRef as Record<string, unknown>)
//       : null
//   return {
//     id: String(a.id ?? a._id ?? ''),
//     scope,
//     track: (a.track as string) || (a.examTrack as string) || undefined,
//     courseId: courseObj
//       ? String(courseObj._id ?? courseObj.id ?? '')
//       : a.courseId
//         ? String(a.courseId)
//         : undefined,
//     courseTitle:
//       (courseObj?.title as string) ||
//       (a.courseTitle as string) ||
//       undefined,
//     authorId: a.authorId ? String(a.authorId) : undefined,
//     authorName: (a.authorName as string) || 'DSA Team',
//     title: String(a.title ?? ''),
//     body: String(a.body ?? ''),
//     createdAt: String(a.createdAt ?? new Date().toISOString()),
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

// function ScopeBadge({ a }: { a: Announcement }) {
//   if (a.scope === 'course') {
//     return (
//       <Badge className='bg-violet-50 text-violet-600 text-[8px] font-black'>
//         <BookOpen size={9} className='mr-1' />
//         {a.courseTitle || 'My subject'}
//       </Badge>
//     )
//   }
//   return a.scope === 'global' ? (
//     <Badge className='bg-slate-100 text-slate-500 text-[8px] font-black'>
//       <Globe size={9} className='mr-1' /> All students
//     </Badge>
//   ) : (
//     <Badge className='bg-blue-50 text-[#002EFF] text-[8px] font-black'>
//       <GraduationCap size={9} className='mr-1' />
//       {EXAM_TRACKS[a.track as keyof typeof EXAM_TRACKS]?.label ?? a.track}
//     </Badge>
//   )
// }

// function LiveBadge({ live }: { live: boolean }) {
//   return (
//     <Badge
//       className={`text-[8px] font-black shrink-0 ${live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
//     >
//       {live ? 'Live' : 'Local'}
//     </Badge>
//   )
// }

// export default function Announcements({
//   mode,
//   studentKey,
//   track: trackProp,
// }: {
//   mode: 'tutor' | 'student'
//   studentKey?: string
//   track?: string
// }) {
//   const [mounted, setMounted] = useState(false)
//   useEffect(() => setMounted(true), [])
//   if (!mounted) {
//     return (
//       <div className='py-16 flex justify-center'>
//         <Loader2 className='animate-spin text-[#002EFF]' />
//       </div>
//     )
//   }
//   if (mode === 'tutor') return <TutorAnnouncements />

//   const u = getUser()
//   const track = trackProp || normaliseTrack(u?.level || u?.examType || 'jamb')
//   return (
//     <StudentAnnouncements track={track} studentKey={studentKey || u?.username || 'me'} />
//   )
// }

// /* ---------------- Tutor / staff: broadcast ---------------- */
// function TutorAnnouncements() {
//   const u = getUser()
//   const authorName = u?.fullName || u?.username || 'Tutor'

//   const [live, setLive] = useState(false)
//   const [loading, setLoading] = useState(true)
//   const [announcements, setAnnouncements] = useState<Announcement[]>([])
//   const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
//   const [submitting, setSubmitting] = useState(false)
//   const [title, setTitle] = useState('')
//   const [body, setBody] = useState('')
//   // 'global' | track id | 'course:<courseId>'
//   const [target, setTarget] = useState('global')
//   const [error, setError] = useState('')
//   const [sent, setSent] = useState(false)

//   // Inline edit of an existing announcement.
//   const [editingId, setEditingId] = useState<string | null>(null)
//   const [editTitle, setEditTitle] = useState('')
//   const [editBody, setEditBody] = useState('')
//   const [savingEdit, setSavingEdit] = useState(false)
//   const [rowError, setRowError] = useState('')

//   const load = useCallback(async () => {
//     setLoading(true)
//     if (isLive()) {
//       try {
//         const [rows, cs] = await Promise.all([
//           dsaApi.announcements.list() as Promise<Record<string, unknown>[]>,
//           dsaApi.courses.list({ tutorId: 'me' }) as Promise<
//             Record<string, unknown>[]
//           >,
//         ])
//         setAnnouncements(rows.map(mapAnnouncement))
//         setCourses(
//           cs.map((c) => ({
//             id: String(c.id ?? c._id ?? ''),
//             title: String(c.title ?? 'Course'),
//           })),
//         )
//         setLive(true)
//         setLoading(false)
//         return
//       } catch {
//         /* fall through to local */
//       }
//     }
//     setAnnouncements(getLocalAnnouncements())
//     setCourses(getCourses().map((c) => ({ id: c.id, title: c.title })))
//     setLive(false)
//     setLoading(false)
//   }, [])

//   useEffect(() => {
//     void load()
//   }, [load])

//   const send = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setError('')
//     setSent(false)
//     if (title.trim().length < 2) return setError('Enter a title')
//     if (body.trim().length < 3) return setError('Write a message')
//     const isCourse = target.startsWith('course:')
//     const courseId = isCourse ? target.slice('course:'.length) : undefined
//     const courseTitle = isCourse
//       ? courses.find((c) => c.id === courseId)?.title
//       : undefined
//     const scope: Announcement['scope'] = isCourse
//       ? 'course'
//       : target === 'global'
//         ? 'global'
//         : 'track'
//     setSubmitting(true)
//     try {
//       if (live) {
//         await dsaApi.announcements.create({
//           scope,
//           track: scope === 'track' ? target : undefined,
//           examTrack: scope === 'track' ? target : undefined,
//           courseId: scope === 'course' ? courseId : undefined,
//           courseTitle: scope === 'course' ? courseTitle : undefined,
//           authorName,
//           title: title.trim(),
//           body: body.trim(),
//         })
//       } else {
//         addLocalAnnouncement({
//           scope,
//           track: scope === 'track' ? target : undefined,
//           courseId: scope === 'course' ? courseId : undefined,
//           courseTitle: scope === 'course' ? courseTitle : undefined,
//           authorName,
//           title: title.trim(),
//           body: body.trim(),
//           now: Date.now(),
//         })
//       }
//       setTitle('')
//       setBody('')
//       setTarget('global')
//       setSent(true)
//       await load()
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to send announcement')
//     } finally {
//       setSubmitting(false)
//     }
//   }

//   const handleDelete = async (id: string) => {
//     setRowError('')
//     if (editingId === id) cancelEdit()
//     try {
//       if (live) await dsaApi.announcements.remove(id)
//       else removeLocalAnnouncement(id)
//       await load()
//     } catch (err) {
//       setRowError(err instanceof Error ? err.message : 'Failed to delete')
//     }
//   }

//   const startEdit = (a: Announcement) => {
//     setRowError('')
//     setEditingId(a.id)
//     setEditTitle(a.title)
//     setEditBody(a.body)
//   }

//   const cancelEdit = () => {
//     setEditingId(null)
//     setEditTitle('')
//     setEditBody('')
//   }

//   const saveEdit = async (id: string) => {
//     setRowError('')
//     if (editTitle.trim().length < 2) return setRowError('Enter a title')
//     if (editBody.trim().length < 3) return setRowError('Write a message')
//     setSavingEdit(true)
//     try {
//       const patch = { title: editTitle.trim(), body: editBody.trim() }
//       if (live) await dsaApi.announcements.update(id, patch)
//       else updateLocalAnnouncement(id, patch)
//       cancelEdit()
//       await load()
//     } catch (err) {
//       setRowError(err instanceof Error ? err.message : 'Failed to save changes')
//     } finally {
//       setSavingEdit(false)
//     }
//   }

//   return (
//     <div className='space-y-5'>
//       <div className='flex items-start justify-between gap-3'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>
//             Announcements
//           </h2>
//           <p className='text-[11px] font-bold text-slate-400'>
//             Broadcast to all students, an exam track, or only the students taking
//             one of your subjects.
//           </p>
//         </div>
//         <LiveBadge live={live} />
//       </div>

//       {/* Compose */}
//       <Card className='p-5 rounded-3xl border-none shadow-sm bg-white'>
//         <form onSubmit={send} className='space-y-3'>
//           {error && <p className='text-[11px] font-bold text-rose-600'>{error}</p>}
//           {sent && (
//             <p className='text-[11px] font-bold text-emerald-600'>
//               Announcement sent.
//             </p>
//           )}
//           <input
//             value={title}
//             onChange={(e) => setTitle(e.target.value)}
//             placeholder='Title'
//             className='w-full h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium'
//           />
//           <textarea
//             value={body}
//             onChange={(e) => setBody(e.target.value)}
//             placeholder='Message…'
//             rows={3}
//             className='w-full px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium resize-none'
//           />
//           <div className='flex items-center gap-2 flex-wrap'>
//             <span className='text-[9px] font-black uppercase text-slate-400'>
//               Send to
//             </span>
//             <select
//               value={target}
//               onChange={(e) => setTarget(e.target.value)}
//               className='h-10 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-bold'
//             >
//               <option value='global'>All students</option>
//               <optgroup label='By exam track'>
//                 {TRACKS.map((t) => (
//                   <option key={t.id} value={t.id}>
//                     {t.label}
//                   </option>
//                 ))}
//               </optgroup>
//               {courses.length > 0 && (
//                 <optgroup label='My subjects (only enrolled students)'>
//                   {courses.map((c) => (
//                     <option key={c.id} value={`course:${c.id}`}>
//                       {c.title}
//                     </option>
//                   ))}
//                 </optgroup>
//               )}
//             </select>
//             <button
//               type='submit'
//               disabled={submitting}
//               className='ml-auto flex items-center justify-center gap-2 h-11 px-6 bg-[#002EFF] text-white rounded-xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60'
//             >
//               <Send size={14} /> {submitting ? 'Sending…' : 'Send'}
//             </button>
//           </div>
//         </form>
//       </Card>

//       {/* Sent list */}
//       <div className='space-y-2'>
//         {rowError && editingId === null && (
//           <p className='text-[11px] font-bold text-rose-600'>{rowError}</p>
//         )}
//         {loading ? (
//           <div className='py-8 flex justify-center'>
//             <Loader2 className='animate-spin text-[#002EFF]' />
//           </div>
//         ) : announcements.length === 0 ? (
//           <p className='text-xs font-bold text-slate-400 py-8 text-center'>
//             No announcements yet.
//           </p>
//         ) : (
//           announcements.map((a) => {
//             const editing = editingId === a.id
//             return (
//               <Card
//                 key={a.id}
//                 className='p-4 rounded-2xl border-none shadow-sm bg-white'
//               >
//                 {editing ? (
//                   <div className='space-y-2'>
//                     {rowError && (
//                       <p className='text-[11px] font-bold text-rose-600'>
//                         {rowError}
//                       </p>
//                     )}
//                     <input
//                       value={editTitle}
//                       onChange={(e) => setEditTitle(e.target.value)}
//                       placeholder='Title'
//                       className='w-full h-10 px-3 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium'
//                     />
//                     <textarea
//                       value={editBody}
//                       onChange={(e) => setEditBody(e.target.value)}
//                       placeholder='Message…'
//                       rows={3}
//                       className='w-full px-3 py-2 rounded-lg bg-slate-50 border border-transparent focus:border-[#002EFF]/30 focus:bg-white outline-none text-sm font-medium resize-none'
//                     />
//                     <div className='flex items-center gap-2'>
//                       <button
//                         onClick={() => saveEdit(a.id)}
//                         disabled={savingEdit}
//                         className='flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#002EFF] text-white text-[10px] font-black uppercase hover:bg-blue-700 disabled:opacity-50'
//                       >
//                         {savingEdit ? (
//                           <Loader2 size={13} className='animate-spin' />
//                         ) : (
//                           <Check size={13} />
//                         )}
//                         {savingEdit ? 'Saving…' : 'Save'}
//                       </button>
//                       <button
//                         onClick={cancelEdit}
//                         disabled={savingEdit}
//                         className='flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase hover:bg-slate-200 disabled:opacity-50'
//                       >
//                         <X size={13} /> Cancel
//                       </button>
//                     </div>
//                   </div>
//                 ) : (
//                   <>
//                     <div className='flex items-center gap-2 mb-1'>
//                       <Megaphone size={14} className='text-[#002EFF]' />
//                       <p className='text-xs font-black text-gray-800 flex-1 truncate'>
//                         {a.title}
//                       </p>
//                       <ScopeBadge a={a} />
//                       <span className='text-[9px] font-bold text-slate-400'>
//                         {timeAgo(a.createdAt)}
//                       </span>
//                       <button
//                         onClick={() => startEdit(a)}
//                         className='p-1 text-slate-400 hover:text-[#002EFF]'
//                         title='Edit'
//                       >
//                         <Pencil size={14} />
//                       </button>
//                       <button
//                         onClick={() => handleDelete(a.id)}
//                         className='p-1 text-slate-400 hover:text-rose-600'
//                         title='Delete'
//                       >
//                         <Trash2 size={14} />
//                       </button>
//                     </div>
//                     <p className='text-[11px] text-slate-600'>{a.body}</p>
//                     <p className='text-[9px] font-bold text-slate-400 mt-1'>
//                       by {a.authorName}
//                     </p>
//                   </>
//                 )}
//               </Card>
//             )
//           })
//         )}
//       </div>
//     </div>
//   )
// }

// /* ---------------- Student: inbox with unread ---------------- */
// function StudentAnnouncements({
//   track,
//   studentKey,
// }: {
//   track: string
//   studentKey: string
// }) {
//   const [live, setLive] = useState(false)
//   const [loading, setLoading] = useState(true)
//   const [list, setList] = useState<Announcement[]>([])
//   const [readIds, setReadIds] = useState<string[]>([])

//   const load = useCallback(async () => {
//     setLoading(true)
//     setReadIds(getReadIds(studentKey))
//     if (isLive()) {
//       try {
//         // The backend already filters to the student's track + global.
//         const rows = (await dsaApi.announcements.list()) as Record<
//           string,
//           unknown
//         >[]
//         setList(rows.map(mapAnnouncement))
//         setLive(true)
//         setLoading(false)
//         return
//       } catch {
//         /* fall through to local */
//       }
//     }
//     setList(getLocalForStudent(track))
//     setLive(false)
//     setLoading(false)
//   }, [track, studentKey])

//   useEffect(() => {
//     void load()
//   }, [load])

//   const isRead = (id: string) => readIds.includes(id)

//   const handleMarkRead = (id: string) => {
//     markReadLocal(studentKey, id)
//     setReadIds(getReadIds(studentKey))
//   }

//   const handleMarkAllRead = () => {
//     markAllReadLocal(
//       studentKey,
//       list.map((a) => a.id),
//     )
//     setReadIds(getReadIds(studentKey))
//   }

//   const unreadCount = list.filter((a) => !isRead(a.id)).length

//   return (
//     <div className='space-y-5'>
//       <div className='flex items-center justify-between flex-wrap gap-2'>
//         <div>
//           <h2 className='text-2xl font-black text-[#002EFF] italic uppercase flex items-center gap-2'>
//             <Megaphone size={22} /> Announcements
//             {unreadCount > 0 && (
//               <span className='text-[10px] font-black bg-rose-500 text-white rounded-full px-2 py-0.5'>
//                 {unreadCount} new
//               </span>
//             )}
//           </h2>
//           <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest'>
//             Updates from your tutors &amp; the academy
//           </p>
//         </div>
//         <div className='flex items-center gap-2'>
//           <LiveBadge live={live} />
//           {unreadCount > 0 && (
//             <button
//               onClick={handleMarkAllRead}
//               className='flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase hover:bg-slate-200'
//             >
//               <CheckCheck size={13} /> Mark all read
//             </button>
//           )}
//         </div>
//       </div>

//       {loading ? (
//         <div className='py-12 flex justify-center'>
//           <Loader2 className='animate-spin text-[#002EFF]' />
//         </div>
//       ) : list.length === 0 ? (
//         <p className='text-xs font-bold text-slate-400 py-12 text-center'>
//           No announcements yet. Check back soon.
//         </p>
//       ) : (
//         <div className='space-y-2'>
//           {list.map((a) => {
//             const read = isRead(a.id)
//             return (
//               <Card
//                 key={a.id}
//                 onClick={() => !read && handleMarkRead(a.id)}
//                 className={`p-4 rounded-2xl border-none shadow-sm cursor-pointer transition-all ${read ? 'bg-white' : 'bg-blue-50/60 ring-1 ring-[#002EFF]/10'}`}
//               >
//                 <div className='flex items-center gap-2 mb-1'>
//                   {!read && (
//                     <span className='h-2 w-2 rounded-full bg-[#002EFF] shrink-0' />
//                   )}
//                   <p className='text-xs font-black text-gray-800 flex-1 truncate'>
//                     {a.title}
//                   </p>
//                   <ScopeBadge a={a} />
//                   <span className='text-[9px] font-bold text-slate-400'>
//                     {timeAgo(a.createdAt)}
//                   </span>
//                 </div>
//                 <p className='text-[11px] text-slate-600'>{a.body}</p>
//                 <p className='text-[9px] font-bold text-slate-400 mt-1'>
//                   by {a.authorName}
//                 </p>
//               </Card>
//             )
//           })}
//         </div>
//       )}
//     </div>
//   )
// }



'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Megaphone,
  Send,
  Trash2,
  Pencil,
  Check,
  X,
  Globe,
  GraduationCap,
  BookOpen,
  CheckCheck,
  Loader2,
  Sparkles,
  Inbox,
  Bell,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getUser, getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'
import {
  getAnnouncements as getLocalAnnouncements,
  getForStudent as getLocalForStudent,
  addAnnouncement as addLocalAnnouncement,
  removeAnnouncement as removeLocalAnnouncement,
  updateAnnouncement as updateLocalAnnouncement,
  getReadIds,
  markRead as markReadLocal,
  markAllRead as markAllReadLocal,
} from '@/lib/announcementsStore'
import { normaliseTrack, EXAM_TRACKS } from '@/lib/studentProfile'
import { getCourses } from '@/lib/coursesStore'
import type { Announcement } from '@/lib/types'

const TRACKS: { id: string; label: string }[] = [
  { id: 'jamb', label: 'JAMB' },
  { id: 'waec', label: 'WAEC' },
  { id: 'postutme', label: 'Post-UTME' },
]

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

function mapAnnouncement(a: Record<string, unknown>): Announcement {
  const scope: Announcement['scope'] =
    a.scope === 'track' ? 'track' : a.scope === 'course' ? 'course' : 'global'
  const courseRef = a.courseId as unknown
  const courseObj =
    courseRef && typeof courseRef === 'object'
      ? (courseRef as Record<string, unknown>)
      : null
  return {
    id: String(a.id ?? a._id ?? ''),
    scope,
    track: (a.track as string) || (a.examTrack as string) || undefined,
    courseId: courseObj
      ? String(courseObj._id ?? courseObj.id ?? '')
      : a.courseId
        ? String(a.courseId)
        : undefined,
    courseTitle:
      (courseObj?.title as string) ||
      (a.courseTitle as string) ||
      undefined,
    authorId: a.authorId ? String(a.authorId) : undefined,
    authorName: (a.authorName as string) || 'DSA Team',
    title: String(a.title ?? ''),
    body: String(a.body ?? ''),
    createdAt: String(a.createdAt ?? new Date().toISOString()),
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

function ScopeBadge({ a }: { a: Announcement }) {
  if (a.scope === 'course') {
    return (
      <Badge className='bg-violet-100/80 text-violet-700 hover:bg-violet-100 text-[10px] font-bold border border-violet-200/50 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-none'>
        <BookOpen size={10} className='text-violet-600' />
        <span className='truncate max-w-[120px]'>{a.courseTitle || 'My Subject'}</span>
      </Badge>
    )
  }
  return a.scope === 'global' ? (
    <Badge className='bg-slate-100 text-slate-600 hover:bg-slate-100 text-[10px] font-bold border border-slate-200/60 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-none'>
      <Globe size={10} className='text-slate-500' /> All Students
    </Badge>
  ) : (
    <Badge className='bg-blue-100/80 text-[#002EFF] hover:bg-blue-100 text-[10px] font-bold border border-blue-200/60 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-none'>
      <GraduationCap size={10} className='text-[#002EFF]' />
      {EXAM_TRACKS[a.track as keyof typeof EXAM_TRACKS]?.label ?? a.track}
    </Badge>
  )
}

function LiveBadge({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border uppercase ${
        live
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-50 text-slate-500 border-slate-200'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          live ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
        }`}
      />
      {live ? 'Live Mode' : 'Local Sandbox'}
    </span>
  )
}

export default function Announcements({
  mode,
  studentKey,
  track: trackProp,
}: {
  mode: 'tutor' | 'student'
  studentKey?: string
  track?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className='py-20 flex flex-col items-center justify-center gap-3'>
        <Loader2 className='animate-spin text-[#002EFF] h-7 w-7' />
        <p className='text-xs font-semibold text-slate-400'>Loading dashboard feed…</p>
      </div>
    )
  }

  if (mode === 'tutor') return <TutorAnnouncements />

  const u = getUser()
  const track = trackProp || normaliseTrack(u?.level || u?.examType || 'jamb')
  return (
    <StudentAnnouncements track={track} studentKey={studentKey || u?.username || 'me'} />
  )
}

/* ---------------- Tutor / Staff: Broadcast Interface ---------------- */
function TutorAnnouncements() {
  const u = getUser()
  const authorName = u?.fullName || u?.username || 'Tutor'

  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('global')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [rowError, setRowError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    if (isLive()) {
      try {
        const [rows, cs] = await Promise.all([
          dsaApi.announcements.list() as Promise<Record<string, unknown>[]>,
          dsaApi.courses.list({ tutorId: 'me' }) as Promise<
            Record<string, unknown>[]
          >,
        ])
        setAnnouncements(rows.map(mapAnnouncement))
        setCourses(
          cs.map((c) => ({
            id: String(c.id ?? c._id ?? ''),
            title: String(c.title ?? 'Course'),
          })),
        )
        setLive(true)
        setLoading(false)
        return
      } catch {
        /* Fall back to local store */
      }
    }
    setAnnouncements(getLocalAnnouncements())
    setCourses(getCourses().map((c) => ({ id: c.id, title: c.title })))
    setLive(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSent(false)
    if (title.trim().length < 2) return setError('Please enter a clear title')
    if (body.trim().length < 3) return setError('Please write a message body')

    const isCourse = target.startsWith('course:')
    const courseId = isCourse ? target.slice('course:'.length) : undefined
    const courseTitle = isCourse
      ? courses.find((c) => c.id === courseId)?.title
      : undefined
    const scope: Announcement['scope'] = isCourse
      ? 'course'
      : target === 'global'
        ? 'global'
        : 'track'

    setSubmitting(true)
    try {
      if (live) {
        await dsaApi.announcements.create({
          scope,
          track: scope === 'track' ? target : undefined,
          examTrack: scope === 'track' ? target : undefined,
          courseId: scope === 'course' ? courseId : undefined,
          courseTitle: scope === 'course' ? courseTitle : undefined,
          authorName,
          title: title.trim(),
          body: body.trim(),
        })
      } else {
        addLocalAnnouncement({
          scope,
          track: scope === 'track' ? target : undefined,
          courseId: scope === 'course' ? courseId : undefined,
          courseTitle: scope === 'course' ? courseTitle : undefined,
          authorName,
          title: title.trim(),
          body: body.trim(),
          now: Date.now(),
        })
      }
      setTitle('')
      setBody('')
      setTarget('global')
      setSent(true)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish announcement')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setRowError('')
    if (editingId === id) cancelEdit()
    try {
      if (live) await dsaApi.announcements.remove(id)
      else removeLocalAnnouncement(id)
      await load()
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Failed to delete entry')
    }
  }

  const startEdit = (a: Announcement) => {
    setRowError('')
    setEditingId(a.id)
    setEditTitle(a.title)
    setEditBody(a.body)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditBody('')
  }

  const saveEdit = async (id: string) => {
    setRowError('')
    if (editTitle.trim().length < 2) return setRowError('Title cannot be empty')
    if (editBody.trim().length < 3) return setRowError('Message body cannot be empty')
    setSavingEdit(true)
    try {
      const patch = { title: editTitle.trim(), body: editBody.trim() }
      if (live) await dsaApi.announcements.update(id, patch)
      else updateLocalAnnouncement(id, patch)
      cancelEdit()
      await load()
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className='max-w-4xl mx-auto space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between gap-4 pb-2 border-b border-slate-100'>
        <div>
          <h2 className='text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2'>
            <Megaphone className='text-[#002EFF] h-6 w-6' /> Broadcast Console
          </h2>
          <p className='text-xs font-medium text-slate-500 mt-0.5'>
            Publish announcements to targeted tracks, specific course cohorts, or all registered students.
          </p>
        </div>
        <LiveBadge live={live} />
      </div>

      {/* Compose Form */}
      <Card className='p-6 rounded-3xl border border-slate-200/80 shadow-sm bg-gradient-to-b from-white to-slate-50/50'>
        <form onSubmit={send} className='space-y-4'>
          <div className='flex items-center justify-between'>
            <span className='text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5'>
              <Sparkles size={14} className='text-[#002EFF]' /> Compose New Announcement
            </span>
            {sent && (
              <span className='text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1'>
                <Check size={12} /> Published successfully
              </span>
            )}
          </div>

          {error && (
            <p className='text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100'>
              {error}
            </p>
          )}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Announcement Title (e.g. Revision Schedule Update)'
            className='w-full h-11 px-4 rounded-xl bg-white border border-slate-200 focus:border-[#002EFF] focus:ring-2 focus:ring-[#002EFF]/10 outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400 transition-all'
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='Write your message here…'
            rows={3}
            className='w-full p-4 rounded-xl bg-white border border-slate-200 focus:border-[#002EFF] focus:ring-2 focus:ring-[#002EFF]/10 outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400 resize-none transition-all'
          />

          <div className='flex items-center justify-between gap-3 pt-1 flex-wrap'>
            <div className='flex items-center gap-2'>
              <span className='text-xs font-bold text-slate-500'>Recipient Audience:</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className='h-10 px-3 py-1.5 rounded-xl bg-white border border-slate-200 focus:border-[#002EFF] focus:ring-2 focus:ring-[#002EFF]/10 outline-none text-xs font-bold text-slate-700 transition-all cursor-pointer'
              >
                <option value='global'>🌐 All Academy Students</option>
                <optgroup label='Exam Tracks'>
                  {TRACKS.map((t) => (
                    <option key={t.id} value={t.id}>
                      🎓 Track: {t.label}
                    </option>
                  ))}
                </optgroup>
                {courses.length > 0 && (
                  <optgroup label='Enrolled Subjects'>
                    {courses.map((c) => (
                      <option key={c.id} value={`course:${c.id}`}>
                        📖 {c.title}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <button
              type='submit'
              disabled={submitting}
              className='flex items-center justify-center gap-2 h-10 px-6 bg-[#002EFF] text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md shadow-blue-500/10 disabled:opacity-60'
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className='animate-spin' />
                  <span>Publishing…</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Send Broadcast</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Card>

      {/* Announcements List Header */}
      <div className='pt-2'>
        <h3 className='text-xs font-bold text-slate-400 uppercase tracking-wider mb-3'>
          Sent Announcements History ({announcements.length})
        </h3>

        {rowError && editingId === null && (
          <p className='text-xs font-semibold text-rose-600 mb-3 bg-rose-50 p-2.5 rounded-xl border border-rose-100'>
            {rowError}
          </p>
        )}

        {loading ? (
          <div className='py-12 flex justify-center'>
            <Loader2 className='animate-spin text-[#002EFF] h-6 w-6' />
          </div>
        ) : announcements.length === 0 ? (
          <div className='py-12 text-center bg-slate-50/60 rounded-3xl border border-dashed border-slate-200 p-8'>
            <Inbox className='mx-auto h-8 w-8 text-slate-300 mb-2' />
            <p className='text-sm font-bold text-slate-600'>No announcements broadcasted yet</p>
            <p className='text-xs text-slate-400 mt-1'>Use the form above to send your first message.</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {announcements.map((a) => {
              const editing = editingId === a.id
              return (
                <Card
                  key={a.id}
                  className='p-5 rounded-2xl border border-slate-200/70 shadow-sm bg-white hover:border-slate-300 transition-all'
                >
                  {editing ? (
                    <div className='space-y-3'>
                      {rowError && (
                        <p className='text-xs font-semibold text-rose-600 bg-rose-50 p-2 rounded-lg'>
                          {rowError}
                        </p>
                      )}
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder='Title'
                        className='w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-[#002EFF] outline-none text-sm font-semibold'
                      />
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        placeholder='Message body…'
                        rows={3}
                        className='w-full p-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-[#002EFF] outline-none text-sm font-medium resize-none'
                      />
                      <div className='flex items-center gap-2 pt-1'>
                        <button
                          onClick={() => saveEdit(a.id)}
                          disabled={savingEdit}
                          className='flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[#002EFF] text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all'
                        >
                          {savingEdit ? (
                            <Loader2 size={13} className='animate-spin' />
                          ) : (
                            <Check size={13} />
                          )}
                          {savingEdit ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          className='flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 disabled:opacity-50 transition-all'
                        >
                          <X size={13} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className='flex items-start justify-between gap-3 mb-2'>
                        <div className='flex items-center gap-2.5 flex-wrap flex-1'>
                          <Megaphone size={16} className='text-[#002EFF] shrink-0' />
                          <h4 className='text-sm font-bold text-slate-900 leading-snug'>
                            {a.title}
                          </h4>
                          <ScopeBadge a={a} />
                        </div>
                        <div className='flex items-center gap-1 shrink-0'>
                          <span className='text-[10px] font-semibold text-slate-400 mr-2'>
                            {timeAgo(a.createdAt)}
                          </span>
                          <button
                            onClick={() => startEdit(a)}
                            className='p-1.5 rounded-md text-slate-400 hover:text-[#002EFF] hover:bg-blue-50 transition-colors'
                            title='Edit Announcement'
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            className='p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors'
                            title='Delete Announcement'
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <p className='text-xs text-slate-600 leading-relaxed font-normal pl-6'>
                        {a.body}
                      </p>

                      <div className='pl-6 mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium'>
                        <span>Published by <strong className='text-slate-600'>{a.authorName}</strong></span>
                        <span>ID: {a.id.slice(-6)}</span>
                      </div>
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

/* ---------------- Student: Inbox Feed ---------------- */
function StudentAnnouncements({
  track,
  studentKey,
}: {
  track: string
  studentKey: string
}) {
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<Announcement[]>([])
  const [readIds, setReadIds] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setReadIds(getReadIds(studentKey))
    if (isLive()) {
      try {
        const rows = (await dsaApi.announcements.list()) as Record<
          string,
          unknown
        >[]
        setList(rows.map(mapAnnouncement))
        setLive(true)
        setLoading(false)
        return
      } catch {
        /* Fall back to local store */
      }
    }
    setList(getLocalForStudent(track))
    setLive(false)
    setLoading(false)
  }, [track, studentKey])

  useEffect(() => {
    void load()
  }, [load])

  const isRead = (id: string) => readIds.includes(id)

  const handleMarkRead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // Prevent duplicate triggering if card click handles mark-read
    markReadLocal(studentKey, id)
    setReadIds(getReadIds(studentKey))
  }

  const handleMarkAllRead = () => {
    markAllReadLocal(
      studentKey,
      list.map((a) => a.id),
    )
    setReadIds(getReadIds(studentKey))
  }

  const unreadCount = list.filter((a) => !isRead(a.id)).length

  return (
    <div className='max-w-3xl mx-auto space-y-5'>
      {/* Top Header */}
      <div className='flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100'>
        <div>
          <h2 className='text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5'>
            <Bell className='text-[#002EFF] fill-[#002EFF]/10 h-6 w-6' /> Announcements
            {unreadCount > 0 && (
              <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-sm'>
                {unreadCount} new
              </span>
            )}
          </h2>
          <p className='text-xs font-semibold text-slate-400 mt-0.5'>
            Official notices and schedule updates from your instructors
          </p>
        </div>

        <div className='flex items-center gap-2.5'>
          <LiveBadge live={live} />
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className='flex items-center gap-1.5 h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold tracking-wide transition-all active:scale-95'
            >
              <CheckCheck size={14} className='text-slate-500' /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Content Stream */}
      {loading ? (
        <div className='py-16 flex flex-col items-center justify-center gap-2'>
          <Loader2 className='animate-spin text-[#002EFF] h-7 w-7' />
          <p className='text-xs font-semibold text-slate-400'>Syncing announcements…</p>
        </div>
      ) : list.length === 0 ? (
        <div className='py-16 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 p-8'>
          <Inbox className='mx-auto h-10 w-10 text-slate-300 mb-3' />
          <h3 className='text-sm font-bold text-slate-700'>Your inbox is completely clear</h3>
          <p className='text-xs text-slate-400 mt-1 max-w-sm mx-auto'>
            No new announcements are posted for your current track yet. Check back later!
          </p>
        </div>
      ) : (
        <div className='space-y-3'>
          {list.map((a) => {
            const read = isRead(a.id)
            return (
              <Card
                key={a.id}
                onClick={() => !read && markReadLocal(studentKey, a.id)}
                className={`p-5 rounded-2xl transition-all border ${
                  read
                    ? 'bg-white border-slate-200/60 shadow-none hover:border-slate-300'
                    : 'bg-blue-50/40 border-blue-200/80 shadow-sm ring-1 ring-[#002EFF]/10'
                }`}
              >
                <div className='flex items-start justify-between gap-3 mb-2'>
                  <div className='flex items-center gap-2 flex-wrap flex-1'>
                    {!read ? (
                      <span className='h-2.5 w-2.5 rounded-full bg-[#002EFF] shrink-0 animate-pulse' />
                    ) : (
                      <CheckCircle2 size={14} className='text-slate-300 shrink-0' />
                    )}
                    <h3
                      className={`text-sm leading-snug ${
                        read ? 'font-semibold text-slate-800' : 'font-extrabold text-slate-900'
                      }`}
                    >
                      {a.title}
                    </h3>
                    <ScopeBadge a={a} />
                  </div>

                  <div className='flex items-center gap-2 shrink-0'>
                    <span className='text-[10px] font-medium text-slate-400'>
                      {timeAgo(a.createdAt)}
                    </span>
                    {!read && (
                      <button
                        onClick={(e) => handleMarkRead(e, a.id)}
                        className='flex items-center gap-1 text-[10px] font-bold text-[#002EFF] bg-white border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors shadow-2xs'
                        title='Mark as read'
                      >
                        <Check size={12} />
                        <span>Mark read</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className='text-xs text-slate-600 leading-relaxed pl-4 font-normal'>
                  {a.body}
                </p>

                <div className='pl-4 mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-400 font-medium'>
                  <span>Posted by <strong className='text-slate-600'>{a.authorName}</strong></span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}