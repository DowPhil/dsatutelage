// 'use client'

// import { useEffect, useState } from 'react'
// import {
//   Users,
//   GraduationCap,
//   Mail,
//   Loader2,
//   Cloud,
//   HardDrive,
//   ShieldCheck,
//   Plus,
//   Lock,
//   Check,
//   X,
//   AlertCircle,
//   UserCheck,
//   UserX,
//   Trash2,
//   MoreVertical,
// } from 'lucide-react'
// import { Badge } from '@/components/ui/badge'
// import {
//   getTutors,
//   getGuardians,
//   type DirectoryPerson,
// } from '@/lib/directoryStore'
// import {
//   adminApi,
//   StaffRoleItem,
//   type AdminUserListItem,
// } from '@/lib/admin-api'

// // Available permission keys as required by the backend
// export const PERMISSION_KEYS = [
//   'payments.verify',
//   'payments.view',
//   'timetable.edit',
//   'timetable.view',
//   'attendance.manage',
//   'students.manage',
//   'students.view',
//   'announcements.send',
//   'reports.view',
//   'staff.manage',
// ] as const

// export type PermissionKey = (typeof PERMISSION_KEYS)[number]

// export interface ExtendedDirectoryPerson extends DirectoryPerson {
//   id?: string
//   status?: 'active' | 'suspended' | 'inactive' | string
// }

// function mapPerson(
//   u: AdminUserListItem | Record<string, unknown>,
//   kind: 'tutors' | 'guardians',
// ): ExtendedDirectoryPerson {
//   const s = u as Record<string, any>
//   const subjects = s.subjects as string[] | undefined
//   return {
//     id: String(s.id || s._id || s.username || s.email || ''),
//     key: String(
//       s.username || s.email || s.id || s._id || s.fullname || Math.random(),
//     ),
//     name: String(
//       s.fullname ||
//         s.fullName ||
//         s.name ||
//         (kind === 'tutors' ? 'Tutor' : 'Guardian'),
//     ),
//     email: String(s.email || ''),
//     extra:
//       kind === 'tutors'
//         ? String(s.subject || (subjects && subjects[0]) || '') || undefined
//         : String(s.wardName || s.ward || '') || undefined,
//     status: (s.status ||
//       (s.isActive === false ? 'suspended' : 'active')) as string,
//   }
// }

// export default function PeopleRoster({
//   kind,
// }: {
//   kind: 'tutors' | 'guardians'
// }) {
//   const [loading, setLoading] = useState(true)
//   const [people, setPeople] = useState<ExtendedDirectoryPerson[]>([])
//   const [source, setSource] = useState<'server' | 'local'>('local')
//   const [showRoleModal, setShowRoleModal] = useState(false)
//   const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

//   useEffect(() => {
//     let cancelled = false
//     ;(async () => {
//       try {
//         const response = await adminApi.getUsers({
//           role: kind === 'tutors' ? 'tutor' : 'parent',
//         })
//         const rows = Array.isArray(response)
//           ? response
//           : Array.isArray(response?.data)
//             ? response.data
//             : null

//         if (!cancelled && rows && rows.length > 0) {
//           setPeople(rows.map((r) => mapPerson(r, kind)))
//           setSource('server')
//           return
//         }
//         throw new Error('no server data')
//       } catch {
//         if (!cancelled) {
//           setPeople(kind === 'tutors' ? getTutors() : getGuardians())
//           setSource('local')
//         }
//       } finally {
//         if (!cancelled) setLoading(false)
//       }
//     })()
//     return () => {
//       cancelled = true
//     }
//   }, [kind])

//   // Handlers for user state operations
//   const handleStatusChange = async (
//     person: ExtendedDirectoryPerson,
//     newStatus: 'active' | 'suspended',
//   ) => {
//     const targetId = person.id || person.key
//     setActionLoadingId(targetId)

//     try {
//       if (source === 'server' && person.id) {
//         if (typeof (adminApi as any).updateUserStatus === 'function') {
//           await (adminApi as any).updateUserStatus(person.id, {
//             status: newStatus,
//           })
//         } else if (typeof (adminApi as any).updateUser === 'function') {
//           await (adminApi as any).updateUser(person.id, { status: newStatus })
//         }
//       }

//       setPeople((prev) =>
//         prev.map((p) =>
//           p.id === targetId || p.key === targetId
//             ? { ...p, status: newStatus }
//             : p,
//         ),
//       )
//     } catch (err) {
//       alert(
//         `Failed to ${newStatus === 'active' ? 'activate' : 'suspend'} user: ${
//           err instanceof Error ? err.message : 'Unknown error'
//         }`,
//       )
//     } finally {
//       setActionLoadingId(null)
//     }
//   }

//   const handleDelete = async (person: ExtendedDirectoryPerson) => {
//     const targetId = person.id || person.key
//     if (!confirm(`Are you sure you want to delete ${person.name}?`)) return

//     setActionLoadingId(targetId)

//     try {
//       if (source === 'server' && person.id) {
//         if (typeof (adminApi as any).deleteUser === 'function') {
//           await (adminApi as any).deleteUser(person.id)
//         }
//       }

//       setPeople((prev) =>
//         prev.filter((p) => (p.id ? p.id !== targetId : p.key !== targetId)),
//       )
//     } catch (err) {
//       alert(
//         `Failed to delete user: ${
//           err instanceof Error ? err.message : 'Unknown error'
//         }`,
//       )
//     } finally {
//       setActionLoadingId(null)
//     }
//   }

//   if (loading) {
//     return (
//       <div className='py-20 flex justify-center'>
//         <Loader2 className='animate-spin text-[#002EFF]' />
//       </div>
//     )
//   }

//   const isTutor = kind === 'tutors'
//   const title = isTutor ? 'Tutors' : 'Guardians'
//   const extraLabel = isTutor ? 'Subject' : 'Ward'
//   const Icon = isTutor ? GraduationCap : Users

//   return (
//     <div className='max-w-5xl mx-auto space-y-4 px-4 py-2'>
//       {/* Header Bar */}
//       <div className='flex flex-wrap items-center justify-between gap-3'>
//         <div className='flex items-center gap-2'>
//           <Icon size={18} className='text-[#002EFF]' />
//           <h1 className='text-2xl font-black text-slate-900 tracking-tight'>
//             {title}
//           </h1>
//           <Badge
//             className={`text-[8px] font-black ${
//               source === 'server'
//                 ? 'bg-emerald-50 text-emerald-600'
//                 : 'bg-slate-100 text-slate-500'
//             }`}
//           >
//             {source === 'server' ? (
//               <>
//                 <Cloud size={9} className='mr-1' /> Live
//               </>
//             ) : (
//               <>
//                 <HardDrive size={9} className='mr-1' /> Local
//               </>
//             )}
//           </Badge>
//           <span className='text-[10px] font-black uppercase text-slate-400 ml-2'>
//             {people.length} total
//           </span>
//         </div>

//         {/* Modal Trigger */}
//         <button
//           onClick={() => setShowRoleModal(true)}
//           className='flex items-center gap-1.5 px-3.5 py-2 bg-[#002EFF] text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95'
//         >
//           <ShieldCheck size={14} /> Upsert Staff Role
//         </button>
//       </div>

//       {/* Roster Table */}
//       <div className='bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden'>
//         <div className='grid grid-cols-12 px-5 py-3 bg-slate-50 text-[9px] font-black uppercase text-gray-400'>
//           <span className='col-span-4'>Name</span>
//           <span className='col-span-3'>Email</span>
//           <span className='col-span-2'>{extraLabel}</span>
//           <span className='col-span-1 text-center'>Status</span>
//           <span className='col-span-2 text-right'>Actions</span>
//         </div>
//         {people.length === 0 ? (
//           <p className='px-5 py-10 text-center text-xs font-bold text-slate-400'>
//             No {title.toLowerCase()} yet.
//           </p>
//         ) : (
//           people.map((p) => {
//             const rowId = p.id || p.key
//             const isRowLoading = actionLoadingId === rowId
//             const isSuspended = p.status === 'suspended'

//             return (
//               <div
//                 key={p.key}
//                 className={`grid grid-cols-12 items-center px-5 py-4 border-t border-slate-50 transition-colors ${
//                   isSuspended ? 'bg-slate-50/50' : ''
//                 }`}
//               >
//                 <span className='col-span-4 text-xs font-black text-gray-800 flex items-center gap-1.5'>
//                   {p.name}
//                   {p.isNew && (
//                     <span className='text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded'>
//                       New
//                     </span>
//                   )}
//                 </span>
//                 <span className='col-span-3 text-[10px] font-bold text-slate-500 flex items-center gap-1 truncate'>
//                   <Mail size={10} /> {p.email}
//                 </span>
//                 <span className='col-span-2 text-[10px] font-bold text-slate-500 truncate'>
//                   {p.extra || '—'}
//                 </span>
//                 <span className='col-span-1 flex justify-center'>
//                   <Badge
//                     className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
//                       isSuspended
//                         ? 'bg-amber-50 text-amber-600 border border-amber-200'
//                         : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
//                     }`}
//                   >
//                     {isSuspended ? 'Suspended' : 'Active'}
//                   </Badge>
//                 </span>

//                 {/* Actions Dropdown / Buttons */}
//                 <span className='col-span-2 flex items-center justify-end gap-1'>
//                   {isRowLoading ? (
//                     <Loader2
//                       size={14}
//                       className='animate-spin text-slate-400 mr-2'
//                     />
//                   ) : (
//                     <>
//                       {isSuspended ? (
//                         <button
//                           onClick={() => handleStatusChange(p, 'active')}
//                           title='Activate User'
//                           className='p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors'
//                         >
//                           <UserCheck size={14} />
//                         </button>
//                       ) : (
//                         <button
//                           onClick={() => handleStatusChange(p, 'suspended')}
//                           title='Suspend User'
//                           className='p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors'
//                         >
//                           <UserX size={14} />
//                         </button>
//                       )}
//                       <button
//                         onClick={() => handleDelete(p)}
//                         title='Delete User'
//                         className='p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors'
//                       >
//                         <Trash2 size={14} />
//                       </button>
//                     </>
//                   )}
//                 </span>
//               </div>
//             )
//           })
//         )}
//       </div>

//       <p className='text-[10px] font-medium text-slate-400'>
//         {source === 'server'
//           ? 'Live from the server.'
//           : `Showing this browser’s list — the server users API (GET /api/admin/users?role=${
//               isTutor ? 'tutor' : 'parent'
//             }) is not live yet.`}
//       </p>

//       {/* Upsert Staff Role Modal */}
//       {showRoleModal && (
//         <RoleUpsertModal onClose={() => setShowRoleModal(false)} />
//       )}
//     </div>
//   )
// }

// /* ------------------------------------------------------------------ */
// /* Modal Component: POST /api/admin/roles via adminApi.upsertRole     */
// /* ------------------------------------------------------------------ */
// function RoleUpsertModal({ onClose }: { onClose: () => void }) {
//   const [roleName, setRoleName] = useState('secretary')
//   const [roleId, setRoleId] = useState('')
//   const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
//     'payments.verify',
//     'timetable.edit',
//     'announcements.send',
//   ])
//   const [submitting, setSubmitting] = useState(false)
//   const [statusMsg, setStatusMsg] = useState<{
//     type: 'error' | 'success'
//     text: string
//   } | null>(null)

//   const togglePermission = (perm: string) => {
//     setSelectedPermissions((prev) =>
//       prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
//     )
//   }

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setStatusMsg(null)

//     if (!roleName.trim()) {
//       setStatusMsg({ type: 'error', text: 'Role name is required.' })
//       return
//     }

//     setSubmitting(true)
//     const payload: Partial<StaffRoleItem> & {
//       name: string
//       permissions: string[]
//     } = {
//       name: roleName.trim().toLowerCase(),
//       permissions: selectedPermissions,
//     }
//     if (roleId.trim()) payload.id = roleId.trim()

//     try {
//       await adminApi.upsertRole(payload)

//       setStatusMsg({
//         type: 'success',
//         text: `Role "${roleName}" upserted successfully!`,
//       })
//       setTimeout(onClose, 1200)
//     } catch (err: unknown) {
//       const errorText =
//         err instanceof Error ? err.message : 'Failed to save role'
//       setStatusMsg({
//         type: 'error',
//         text: `${errorText}. (Ensure POST /api/admin/roles is registered on the API server).`,
//       })
//     } finally {
//       setSubmitting(false)
//     }
//   }

//   return (
//     <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'>
//       <div className='w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden'>
//         {/* Header */}
//         <div className='flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50'>
//           <div className='flex items-center gap-2.5'>
//             <div className='h-8 w-8 rounded-xl bg-[#002EFF] text-white flex items-center justify-center shadow-md shadow-blue-200'>
//               <ShieldCheck size={16} />
//             </div>
//             <div>
//               <h3 className='text-xs font-black text-slate-900 uppercase tracking-wider'>
//                 Upsert Staff Role
//               </h3>
//               <p className='text-[9px] font-bold text-slate-400'>
//                 POST /api/admin/roles
//               </p>
//             </div>
//           </div>
//           <button
//             onClick={onClose}
//             className='p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors'
//           >
//             <X size={16} />
//           </button>
//         </div>

//         {/* Form Body */}
//         <form onSubmit={handleSubmit} className='p-6 space-y-4'>
//           {statusMsg && (
//             <div
//               className={`flex items-start gap-2 p-3 rounded-xl text-[11px] font-bold ${
//                 statusMsg.type === 'error'
//                   ? 'bg-rose-50 text-rose-600 border border-rose-100'
//                   : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
//               }`}
//             >
//               <AlertCircle size={14} className='shrink-0 mt-0.5' />
//               <span>{statusMsg.text}</span>
//             </div>
//           )}

//           {/* Role Name Input */}
//           <div className='space-y-1'>
//             <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
//               Role Name <span className='text-rose-500'>*</span>
//             </label>
//             <input
//               type='text'
//               value={roleName}
//               onChange={(e) => setRoleName(e.target.value)}
//               placeholder='e.g. secretary, auditor'
//               className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
//             />
//           </div>

//           {/* Role ID Input */}
//           <div className='space-y-1'>
//             <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
//               Role ID{' '}
//               <span className='text-slate-300'>(Optional for updates)</span>
//             </label>
//             <input
//               type='text'
//               value={roleId}
//               onChange={(e) => setRoleId(e.target.value)}
//               placeholder='Leave empty to create new'
//               className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-medium text-slate-800 transition-all'
//             />
//           </div>

//           {/* Permissions Multi-Select */}
//           <div className='space-y-2 pt-1'>
//             <div className='flex items-center justify-between'>
//               <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
//                 Assign Permissions
//               </label>
//               <span className='text-[9px] font-bold text-slate-400'>
//                 {selectedPermissions.length} selected
//               </span>
//             </div>

//             <div className='grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1'>
//               {PERMISSION_KEYS.map((perm) => {
//                 const active = selectedPermissions.includes(perm)
//                 return (
//                   <button
//                     type='button'
//                     key={perm}
//                     onClick={() => togglePermission(perm)}
//                     className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left ${
//                       active
//                         ? 'bg-blue-50 border-blue-200 text-[#002EFF]'
//                         : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200'
//                     }`}
//                   >
//                     <span className='truncate flex items-center gap-1'>
//                       <Lock
//                         size={9}
//                         className={active ? 'text-[#002EFF]' : 'text-slate-300'}
//                       />
//                       {perm}
//                     </span>
//                     {active ? (
//                       <Check size={11} className='shrink-0' />
//                     ) : (
//                       <Plus size={10} className='shrink-0 opacity-40' />
//                     )}
//                   </button>
//                 )
//               })}
//             </div>
//           </div>

//           {/* Submit Actions */}
//           <div className='flex items-center justify-end gap-2 pt-3 border-t border-slate-100'>
//             <button
//               type='button'
//               onClick={onClose}
//               className='px-4 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-all'
//             >
//               Cancel
//             </button>
//             <button
//               type='submit'
//               disabled={submitting}
//               className='flex items-center justify-center gap-2 px-5 h-10 bg-[#002EFF] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-700 shadow-md shadow-blue-200 transition-all disabled:opacity-50 active:scale-95'
//             >
//               {submitting ? (
//                 <Loader2 size={14} className='animate-spin' />
//               ) : (
//                 'Save Role'
//               )}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   )
// }

'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  GraduationCap,
  Mail,
  Loader2,
  Cloud,
  HardDrive,
  ShieldCheck,
  Plus,
  Lock,
  Check,
  X,
  AlertCircle,
  UserCheck,
  UserX,
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
  BookOpen,
  CheckCircle2,
  XCircle,
  UserPlus,
  ArrowLeft,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  getTutors,
  getGuardians,
  type DirectoryPerson,
} from '@/lib/directoryStore'
import {
  adminApi,
  StaffRoleItem,
  type AdminUserListItem,
} from '@/lib/admin-api'
import CreateTutor from './CreateTutor'
import CreateGuardian from './CreateGuardian'

export const PERMISSION_KEYS = [
  'payments.verify',
  'payments.view',
  'timetable.edit',
  'timetable.view',
  'attendance.manage',
  'students.manage',
  'students.view',
  'announcements.send',
  'reports.view',
  'staff.manage',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export interface ExtendedDirectoryPerson extends DirectoryPerson {
  id?: string
  status?: 'active' | 'suspended' | 'inactive' | string
  raw?: Record<string, unknown>
}

function mapPerson(
  u: AdminUserListItem | Record<string, unknown>,
  kind: 'tutors' | 'guardians',
): ExtendedDirectoryPerson {
  const s = u as Record<string, any>
  const subjects = s.subjects as string[] | undefined
  return {
    id: String(s.id || s._id || s.username || s.email || ''),
    key: String(
      s.username || s.email || s.id || s._id || s.fullname || Math.random(),
    ),
    name: String(
      s.fullname ||
        s.fullName ||
        s.name ||
        (kind === 'tutors' ? 'Tutor' : 'Guardian'),
    ),
    email: String(s.email || ''),
    extra:
      kind === 'tutors'
        ? String(s.subject || (subjects && subjects[0]) || '') || undefined
        : String(s.wardName || s.ward || '') || undefined,
    status: (s.status ||
      (s.isActive === false ? 'suspended' : 'active')) as string,
    raw: s,
  }
}

export default function PeopleRoster({
  kind,
  canCreate = true,
  canManageAccounts = true,
  canManageRoles = true,
}: {
  kind: 'tutors' | 'guardians'
  /** Staff: shown only with tutors.create / guardians.create. */
  canCreate?: boolean
  /** Suspend / activate / delete — admin only by default on staff screens. */
  canManageAccounts?: boolean
  /** Staff-role editing — admin only. */
  canManageRoles?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState<ExtendedDirectoryPerson[]>([])
  const [source, setSource] = useState<'server' | 'local'>('local')
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // List-first: the "Create Tutor/Guardian" form is revealed inline (merged in
  // from the old separate nav screen). reloadKey re-fetches the roster when the
  // admin returns from creating someone, so the new person shows up.
  const [showCreate, setShowCreate] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setShowCreate(false)
    ;(async () => {
      setLoading(true)
      try {
        const response = await adminApi.getUsers({
          role: kind === 'tutors' ? 'tutor' : 'parent',
        })
        const rows = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : null

        if (!cancelled && rows && rows.length > 0) {
          setPeople(rows.map((r) => mapPerson(r, kind)))
          setSource('server')
          return
        }
        throw new Error('no server data')
      } catch {
        if (!cancelled) {
          setPeople(kind === 'tutors' ? getTutors() : getGuardians())
          setSource('local')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kind, reloadKey])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleStatusChange = async (
    e: React.MouseEvent,
    person: ExtendedDirectoryPerson,
    newStatus: 'active' | 'suspended',
  ) => {
    e.stopPropagation()
    const targetId = person.id || person.key
    setActionLoadingId(targetId)

    try {
      if (source === 'server' && person.id) {
        if (typeof (adminApi as any).updateUserStatus === 'function') {
          await (adminApi as any).updateUserStatus(person.id, {
            status: newStatus,
          })
        } else if (typeof (adminApi as any).updateUser === 'function') {
          await (adminApi as any).updateUser(person.id, { status: newStatus })
        }
      }

      setPeople((prev) =>
        prev.map((p) =>
          p.id === targetId || p.key === targetId
            ? { ...p, status: newStatus }
            : p,
        ),
      )
    } catch (err) {
      alert(
        `Failed to ${newStatus === 'active' ? 'activate' : 'suspend'} user: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async (
    e: React.MouseEvent,
    person: ExtendedDirectoryPerson,
  ) => {
    e.stopPropagation()
    const targetId = person.id || person.key
    if (!confirm(`Are you sure you want to delete ${person.name}?`)) return

    setActionLoadingId(targetId)

    try {
      if (source === 'server' && person.id) {
        if (typeof (adminApi as any).deleteUser === 'function') {
          await (adminApi as any).deleteUser(person.id)
        }
      }

      setPeople((prev) =>
        prev.filter((p) => (p.id ? p.id !== targetId : p.key !== targetId)),
      )
    } catch (err) {
      alert(
        `Failed to delete user: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className='py-20 flex justify-center'>
        <Loader2 className='animate-spin text-[#002EFF]' />
      </div>
    )
  }

  const isTutor = kind === 'tutors'
  const title = isTutor ? 'Tutors' : 'Guardians'
  const extraLabel = isTutor ? 'Subject' : 'Ward'
  const Icon = isTutor ? GraduationCap : Users
  const createLabel = isTutor ? 'Create Tutor' : 'Create Guardian'

  // Merged create screen (list-first): show the create form inline with a way
  // back to the roster, which re-fetches so the new person appears.
  if (showCreate) {
    return (
      <div className='max-w-5xl mx-auto space-y-4 px-4 py-2'>
        <button
          onClick={() => {
            setShowCreate(false)
            setReloadKey((k) => k + 1)
          }}
          className='inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#002EFF] hover:underline'
        >
          <ArrowLeft size={14} /> Back to {title}
        </button>
        {isTutor ? <CreateTutor /> : <CreateGuardian />}
      </div>
    )
  }

  return (
    <div className='max-w-5xl mx-auto space-y-4 px-4 py-2'>
      {/* Header Bar */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Icon size={18} className='text-[#002EFF]' />
          <h1 className='text-2xl font-black text-slate-900 tracking-tight'>
            {title}
          </h1>
          <Badge
            className={`text-[8px] font-black ${
              source === 'server'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {source === 'server' ? (
              <>
                <Cloud size={9} className='mr-1' /> Live
              </>
            ) : (
              <>
                <HardDrive size={9} className='mr-1' /> Local
              </>
            )}
          </Badge>
          <span className='text-[10px] font-black uppercase text-slate-400 ml-2'>
            {people.length} total
          </span>
        </div>

        <div className='flex items-center gap-2'>
          {/* Create (merged from the old separate screen) */}
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className='flex items-center gap-1.5 px-3.5 py-2 bg-[#002EFF] text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95'
            >
              <UserPlus size={14} /> {createLabel}
            </button>
          )}
          {/* Modal Trigger */}
          {canManageRoles && (
            <button
              onClick={() => setShowRoleModal(true)}
              className='flex items-center gap-1.5 px-3.5 py-2 bg-white text-[#002EFF] border border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-blue-50 transition-all active:scale-95'
            >
              <ShieldCheck size={14} /> Upsert Staff Role
            </button>
          )}
        </div>
      </div>

      {/* Cards Box Grid */}
      {people.length === 0 ? (
        <div className='bg-white rounded-2xl border border-slate-100 p-10 text-center text-xs font-bold text-slate-400 shadow-sm'>
          No {title.toLowerCase()} yet.
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {people.map((p) => {
            const rowId = p.id || p.key
            const isRowLoading = actionLoadingId === rowId
            const isSuspended = p.status === 'suspended'
            const isExpanded = expandedId === rowId

            return (
              <div
                key={p.key}
                onClick={() => toggleExpand(rowId)}
                className={`group cursor-pointer rounded-2xl border transition-all duration-200 bg-white hover:shadow-md ${
                  isExpanded
                    ? 'border-[#002EFF] ring-2 ring-blue-500/10 shadow-md'
                    : 'border-slate-200/80 hover:border-slate-300'
                } ${isSuspended ? 'bg-slate-50/50' : ''}`}
              >
                {/* Main Card View */}
                <div className='p-4 space-y-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 rounded-xl bg-blue-50 text-[#002EFF] flex items-center justify-center font-black text-sm shrink-0 border border-blue-100/50'>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className='flex items-center gap-1.5'>
                          <h3 className='text-sm font-black text-slate-900 leading-tight'>
                            {p.name}
                          </h3>
                          {p.isNew && (
                            <span className='text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded'>
                              New
                            </span>
                          )}
                        </div>
                        <p className='text-xs font-bold text-slate-500 flex items-center gap-1 mt-0.5'>
                          <Mail size={11} className='text-slate-400 shrink-0' />
                          <span className='truncate max-w-[180px]'>
                            {p.email}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <Badge
                      className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                        isSuspended
                          ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}
                    >
                      {isSuspended ? 'Suspended' : 'Active'}
                    </Badge>
                  </div>

                  {/* Summary Footer Bar */}
                  <div className='pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500'>
                    <div className='flex items-center gap-1 truncate'>
                      <BookOpen size={12} className='text-slate-400 shrink-0' />
                      <span>{extraLabel}:</span>
                      <strong className='text-slate-800 font-bold truncate'>
                        {p.extra || '—'}
                      </strong>
                    </div>

                    <div className='flex items-center gap-1 text-[#002EFF] font-bold text-[10px] uppercase tracking-wider shrink-0 ml-2'>
                      <span>{isExpanded ? 'Less' : 'Details'}</span>
                      {isExpanded ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Box */}
                {isExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className='px-4 pb-4 pt-3 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl space-y-3 text-xs'
                  >
                    <div className='grid grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-slate-100 text-slate-600'>
                      <div>
                        <span className='text-[9px] font-black text-slate-400 uppercase tracking-widest block'>
                          User ID
                        </span>
                        <span className='font-mono text-[10px] font-bold text-slate-700 truncate block'>
                          {p.id || p.key}
                        </span>
                      </div>
                      <div>
                        <span className='text-[9px] font-black text-slate-400 uppercase tracking-widest block'>
                          Role Type
                        </span>
                        <span className='font-bold text-slate-700 capitalize'>
                          {kind === 'tutors' ? 'Tutor' : 'Guardian / Parent'}
                        </span>
                      </div>
                      <div>
                        <span className='text-[9px] font-black text-slate-400 uppercase tracking-widest block'>
                          {extraLabel}
                        </span>
                        <span className='font-bold text-slate-700'>
                          {p.extra || 'Not specified'}
                        </span>
                      </div>
                      <div>
                        <span className='text-[9px] font-black text-slate-400 uppercase tracking-widest block'>
                          Account Status
                        </span>
                        <span className='font-bold flex items-center gap-1'>
                          {isSuspended ? (
                            <>
                              <XCircle size={12} className='text-amber-500' />
                              <span className='text-amber-600'>Suspended</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2
                                size={12}
                                className='text-emerald-500'
                              />
                              <span className='text-emerald-600'>Active</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Actions Row */}
                    {canManageAccounts && (
                    <div className='flex items-center justify-end gap-2 pt-1'>
                      {isRowLoading ? (
                        <div className='flex items-center gap-2 text-slate-400 font-bold text-xs py-1 px-2'>
                          <Loader2 size={14} className='animate-spin' />
                          Updating...
                        </div>
                      ) : (
                        <>
                          {isSuspended ? (
                            <button
                              onClick={(e) =>
                                handleStatusChange(e, p, 'active')
                              }
                              className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 border border-emerald-200 transition-colors text-xs'
                            >
                              <UserCheck size={14} />
                              Activate Account
                            </button>
                          ) : (
                            <button
                              onClick={(e) =>
                                handleStatusChange(e, p, 'suspended')
                              }
                              className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 font-bold hover:bg-amber-100 border border-amber-200 transition-colors text-xs'
                            >
                              <UserX size={14} />
                              Suspend Account
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDelete(e, p)}
                            className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 border border-rose-200 transition-colors text-xs'
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className='text-[10px] font-medium text-slate-400'>
        {source === 'server'
          ? 'Live from the server.'
          : `Showing this browser’s list — the server users API (GET /api/admin/users?role=${
              isTutor ? 'tutor' : 'parent'
            }) is not live yet.`}
      </p>

      {/* Upsert Staff Role Modal */}
      {showRoleModal && (
        <RoleUpsertModal onClose={() => setShowRoleModal(false)} />
      )}
    </div>
  )
}

/* Modal Component */
function RoleUpsertModal({ onClose }: { onClose: () => void }) {
  const [roleName, setRoleName] = useState('secretary')
  const [roleId, setRoleId] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'payments.verify',
    'timetable.edit',
    'announcements.send',
  ])
  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{
    type: 'error' | 'success'
    text: string
  } | null>(null)

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusMsg(null)

    if (!roleName.trim()) {
      setStatusMsg({ type: 'error', text: 'Role name is required.' })
      return
    }

    setSubmitting(true)
    const payload: Partial<StaffRoleItem> & {
      name: string
      permissions: string[]
    } = {
      name: roleName.trim().toLowerCase(),
      permissions: selectedPermissions,
    }
    if (roleId.trim()) payload.id = roleId.trim()

    try {
      await adminApi.upsertRole(payload)

      setStatusMsg({
        type: 'success',
        text: `Role "${roleName}" upserted successfully!`,
      })
      setTimeout(onClose, 1200)
    } catch (err: unknown) {
      const errorText =
        err instanceof Error ? err.message : 'Failed to save role'
      setStatusMsg({
        type: 'error',
        text: `${errorText}. (Ensure POST /api/admin/roles is registered on the API server).`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50'>
          <div className='flex items-center gap-2.5'>
            <div className='h-8 w-8 rounded-xl bg-[#002EFF] text-white flex items-center justify-center shadow-md shadow-blue-200'>
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3 className='text-xs font-black text-slate-900 uppercase tracking-wider'>
                Upsert Staff Role
              </h3>
              <p className='text-[9px] font-bold text-slate-400'>
                POST /api/admin/roles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors'
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          {statusMsg && (
            <div
              className={`flex items-start gap-2 p-3 rounded-xl text-[11px] font-bold ${
                statusMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}
            >
              <AlertCircle size={14} className='shrink-0 mt-0.5' />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Role Name Input */}
          <div className='space-y-1'>
            <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
              Role Name <span className='text-rose-500'>*</span>
            </label>
            <input
              type='text'
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder='e.g. secretary, auditor'
              className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
            />
          </div>

          {/* Role ID Input */}
          <div className='space-y-1'>
            <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
              Role ID{' '}
              <span className='text-slate-300'>(Optional for updates)</span>
            </label>
            <input
              type='text'
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              placeholder='Leave empty to create new'
              className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-medium text-slate-800 transition-all'
            />
          </div>

          {/* Permissions Multi-Select */}
          <div className='space-y-2 pt-1'>
            <div className='flex items-center justify-between'>
              <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
                Assign Permissions
              </label>
              <span className='text-[9px] font-bold text-slate-400'>
                {selectedPermissions.length} selected
              </span>
            </div>

            <div className='grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1'>
              {PERMISSION_KEYS.map((perm) => {
                const active = selectedPermissions.includes(perm)
                return (
                  <button
                    type='button'
                    key={perm}
                    onClick={() => togglePermission(perm)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left ${
                      active
                        ? 'bg-blue-50 border-blue-200 text-[#002EFF]'
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <span className='truncate flex items-center gap-1'>
                      <Lock
                        size={9}
                        className={active ? 'text-[#002EFF]' : 'text-slate-300'}
                      />
                      {perm}
                    </span>
                    {active ? (
                      <Check size={11} className='shrink-0' />
                    ) : (
                      <Plus size={10} className='shrink-0 opacity-40' />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Submit Actions */}
          <div className='flex items-center justify-end gap-2 pt-3 border-t border-slate-100'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-all'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={submitting}
              className='flex items-center justify-center gap-2 px-5 h-10 bg-[#002EFF] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-700 shadow-md shadow-blue-200 transition-all disabled:opacity-50 active:scale-95'
            >
              {submitting ? (
                <Loader2 size={14} className='animate-spin' />
              ) : (
                'Save Role'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}