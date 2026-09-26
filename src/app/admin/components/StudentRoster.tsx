// //src/app/admin/components/StudentRoster.tsx
// 'use client'

// import { useEffect, useState, useCallback } from 'react'
// import {
//   GraduationCap,
//   Mail,
//   Loader2,
//   Cloud,
//   HardDrive,
//   UserCheck,
//   UserX,
//   Trash2,
//   Plus,
//   Search,
//   BookOpen,
//   X,
//   AlertCircle,
//   Eye,
//   CheckCircle2,
//   ShieldAlert,
// } from 'lucide-react'
// import { Badge } from '@/components/ui/badge'
// import { adminApi, type AdminUserListItem } from '@/lib/admin-api'
// import TrackOverride from './TrackOverride'

// export interface ExtendedStudentPerson {
//   id?: string
//   key: string
//   name: string
//   email: string
//   extra?: string
//   status?: 'active' | 'suspended' | 'pending_payment' | 'pending_otp' | string
//   examTrack?: string
//   learningMode?: string
//   studentCode?: string
// }

// function mapStudent(
//   u: AdminUserListItem | Record<string, unknown>,
//   fallbackIndex: number,
// ): ExtendedStudentPerson {
//   const s = u as Record<string, unknown>
//   const derivedId = String(s.id || s._id || s.studentId || '')

//   return {
//     id: derivedId,
//     key: derivedId || `student-${fallbackIndex}`,
//     name: String(s.fullname || s.fullName || s.name || 'Student'),
//     email: String(s.email || ''),
//     extra: String(s.examTrack || s.learningMode || 'General'),
//     examTrack: typeof s.examTrack === 'string' ? s.examTrack : undefined,
//     learningMode:
//       typeof s.learningMode === 'string' ? s.learningMode : undefined,
//     studentCode:
//       typeof s.studentId === 'string'
//         ? s.studentId
//         : typeof s.studentCode === 'string'
//           ? s.studentCode
//           : undefined,
//     status: (s.status ||
//       (s.isActive === false ? 'suspended' : 'active')) as string,
//   }
// }

// export default function StudentRoster() {
//   const [loading, setLoading] = useState(true)
//   const [students, setStudents] = useState<ExtendedStudentPerson[]>([])
//   const [source, setSource] = useState<'server' | 'local'>('local')
//   const [searchQuery, setSearchQuery] = useState('')

//   // Modals state
//   const [showAddModal, setShowAddModal] = useState(false)
//   const [selectedStudent, setSelectedStudent] =
//     useState<ExtendedStudentPerson | null>(null)
//   const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

//   // Custom Alert Modal State
//   const [alertConfig, setAlertConfig] = useState<{
//     isOpen: boolean
//     title: string
//     message: string
//     type: 'info' | 'error' | 'confirm'
//     onConfirm?: () => void
//   }>({
//     isOpen: false,
//     title: '',
//     message: '',
//     type: 'info',
//   })

//   const showAlert = (
//     title: string,
//     message: string,
//     type: 'info' | 'error' = 'info',
//   ) => {
//     setAlertConfig({ isOpen: true, title, message, type })
//   }

//   const showConfirm = (
//     title: string,
//     message: string,
//     onConfirm: () => void,
//   ) => {
//     setAlertConfig({ isOpen: true, title, message, type: 'confirm', onConfirm })
//   }

//   const fetchStudents = useCallback(async (query = '') => {
//     setLoading(true)
//     try {
//       const response = await adminApi.getUsers({
//         role: 'student',
//         search: query || undefined,
//       })

//       const rows = Array.isArray(response)
//         ? response
//         : Array.isArray(response?.data)
//           ? response.data
//           : null

//       if (rows) {
//         setStudents(
//           rows.map((r: AdminUserListItem, i: number) => mapStudent(r, i)),
//         )
//         setSource('server')
//       } else {
//         throw new Error('No server data')
//       }
//     } catch {
//       const localFallback: ExtendedStudentPerson[] = []
//       setStudents(
//         localFallback.map((s: ExtendedStudentPerson, i: number) => ({
//           ...s,
//           id: s.key || `local-${i}`,
//           status: 'active',
//         })),
//       )
//       setSource('local')
//     } finally {
//       setLoading(false)
//     }
//   }, [])

//   useEffect(() => {
//     fetchStudents()
//   }, [fetchStudents])

//   const handleSearch = (e: React.FormEvent) => {
//     e.preventDefault()
//     fetchStudents(searchQuery)
//   }

//   const handleStatusChange = async (
//     person: ExtendedStudentPerson,
//     newStatus: 'active' | 'suspended',
//   ) => {
//     const targetId = person.id || person.key
//     setActionLoadingId(targetId)

//     try {
//       if (source === 'server' && person.id) {
//         const api = adminApi as unknown as {
//           updateUserStatus?: (
//             id: string,
//             body: { status: string },
//           ) => Promise<unknown>
//           updateUser?: (
//             id: string,
//             body: { status: string },
//           ) => Promise<unknown>
//         }
//         if (typeof api.updateUserStatus === 'function') {
//           await api.updateUserStatus(person.id, { status: newStatus })
//         } else if (typeof api.updateUser === 'function') {
//           await api.updateUser(person.id, { status: newStatus })
//         }
//       }

//       const updatedPerson = { ...person, status: newStatus }

//       setStudents((prev) =>
//         prev.map((p) =>
//           p.id === targetId || p.key === targetId ? updatedPerson : p,
//         ),
//       )

//       if (
//         selectedStudent &&
//         (selectedStudent.id === targetId || selectedStudent.key === targetId)
//       ) {
//         setSelectedStudent(updatedPerson)
//       }

//       showAlert(
//         'Status Updated',
//         `Student has been successfully ${newStatus === 'active' ? 'reactivated' : 'suspended'}.`,
//       )
//     } catch (err) {
//       showAlert(
//         'Action Failed',
//         `Failed to ${newStatus === 'active' ? 'reactivate' : 'suspend'} student: ${
//           err instanceof Error ? err.message : 'Unknown error'
//         }`,
//         'error',
//       )
//     } finally {
//       setActionLoadingId(null)
//     }
//   }

//   const handleDelete = async (person: ExtendedStudentPerson) => {
//     const targetId = person.id || person.key

//     showConfirm(
//       'Confirm Deletion',
//       `Are you sure you want to soft-delete ${person.name}?`,
//       async () => {
//         setActionLoadingId(targetId)
//         try {
//           if (source === 'server' && person.id) {
//             const api = adminApi as unknown as {
//               deleteUser?: (id: string) => Promise<unknown>
//             }
//             if (typeof api.deleteUser === 'function') {
//               await api.deleteUser(person.id)
//             }
//           }

//           setStudents((prev) =>
//             prev.filter((p) => (p.id ? p.id !== targetId : p.key !== targetId)),
//           )

//           if (
//             selectedStudent &&
//             (selectedStudent.id === targetId ||
//               selectedStudent.key === targetId)
//           ) {
//             setSelectedStudent(null)
//           }

//           showAlert('Student Removed', `${person.name} has been soft-deleted.`)
//         } catch (err) {
//           showAlert(
//             'Delete Failed',
//             `Failed to delete student: ${
//               err instanceof Error ? err.message : 'Unknown error'
//             }`,
//             'error',
//           )
//         } finally {
//           setActionLoadingId(null)
//         }
//       },
//     )
//   }

//   return (
//     <div className='max-w-5xl mx-auto space-y-4 px-4 py-2'>
//       {/* Header Bar */}
//       <div className='flex flex-wrap items-center justify-between gap-3'>
//         <div className='flex items-center gap-2'>
//           <GraduationCap size={22} className='text-[#002EFF]' />
//           <h1 className='text-2xl font-black text-slate-900 tracking-tight'>
//             Students
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
//             {students.length} Total
//           </span>
//         </div>

//         <button
//           onClick={() => setShowAddModal(true)}
//           className='flex items-center gap-1.5 px-3.5 py-2 bg-[#002EFF] text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95'
//         >
//           <Plus size={14} /> Add Student
//         </button>
//       </div>

//       {/* Search Bar */}
//       <form onSubmit={handleSearch} className='flex items-center gap-2'>
//         <div className='relative flex-1'>
//           <Search
//             size={14}
//             className='absolute left-3.5 top-3 text-slate-400'
//           />
//           <input
//             type='text'
//             placeholder='Search by name, email, or student ID...'
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             className='w-full h-10 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#002EFF] transition-all'
//           />
//         </div>
//         <button
//           type='submit'
//           className='px-4 h-10 bg-slate-900 text-white font-black text-[10px] uppercase rounded-xl hover:bg-slate-800 transition-all'
//         >
//           Search
//         </button>
//       </form>

//       {/* Content View: Desktop Table vs Mobile/Tablet Cards */}
//       {loading ? (
//         <div className='py-12 flex justify-center bg-white rounded-2xl border border-slate-100'>
//           <Loader2 className='animate-spin text-[#002EFF]' />
//         </div>
//       ) : students.length === 0 ? (
//         <div className='bg-white rounded-2xl border border-slate-100 p-10 text-center'>
//           <p className='text-xs font-bold text-slate-400'>No students found.</p>
//         </div>
//       ) : (
//         <>
//           {/* 1. Mobile/Tablet Card View (Visible on < md screens) */}
//           <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden'>
//             {students.map((p) => {
//               const rowId = p.id || p.key
//               const isRowLoading = actionLoadingId === rowId
//               const isSuspended = p.status === 'suspended'


//               return (
//                 <div
//                   key={p.key}
//                   className={`p-4 bg-white rounded-2xl border ${
//                     isSuspended
//                       ? 'border-amber-200 bg-amber-50/20'
//                       : 'border-slate-100'
//                   } shadow-sm space-y-3 flex flex-col justify-between`}
//                 >
//                   <div className='space-y-2'>
//                     <div className='flex items-start justify-between gap-2'>
//                       <div>
//                         <h3 className='text-xs font-black text-slate-900 line-clamp-1'>
//                           {p.name}
//                         </h3>
//                         {p.studentCode && (
//                           <span className='text-[9px] font-bold text-slate-400 block'>
//                             ID: {p.studentCode}
//                           </span>
//                         )}
//                       </div>
//                       <Badge
//                         className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
//                           isSuspended
//                             ? 'bg-amber-50 text-amber-600 border border-amber-200'
//                             : isUnverified
//                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
//                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
//                         }`}
//                       >
//                         {isSuspended ? 'Suspended' : isUnverified ? 'Unverified' : 'Active'}
//                       </Badge>
//                     </div>

//                     <div className='text-[10px] font-bold text-slate-500 space-y-1 pt-1 border-t border-slate-50'>
//                       <div className='flex items-center gap-1.5 truncate'>
//                         <Mail size={11} className='text-slate-400 shrink-0' />
//                         <span className='truncate'>{p.email}</span>
//                       </div>
//                       <div className='flex items-center gap-1.5'>
//                         <BookOpen
//                           size={11}
//                           className='text-slate-400 shrink-0'
//                         />
//                         <TrackOverride
//                           studentId={p.id || p.key}
//                           current={p.examTrack || p.extra}
//                         />
//                       </div>
//                     </div>
//                   </div>

//                   {/* Actions & View Details */}
//                   <div className='flex items-center justify-between pt-2 border-t border-slate-100 gap-2'>
//                     <button
//                       onClick={() => setSelectedStudent(p)}
//                       className='flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black transition-all'
//                     >
//                       <Eye size={12} /> View Details
//                     </button>

//                     <div className='flex items-center gap-1'>
//                       {isRowLoading ? (
//                         <Loader2
//                           size={14}
//                           className='animate-spin text-slate-400'
//                         />
//                       ) : (
//                         <>
//                           {isSuspended ? (
//                             <button
//                               onClick={() => handleStatusChange(p, 'active')}
//                               title='Activate Student'
//                               className='p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors'
//                             >
//                               <UserCheck size={14} />
//                             </button>
//                           ) : (
//                             <button
//                               onClick={() => handleStatusChange(p, 'suspended')}
//                               title='Suspend Student'
//                               className='p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors'
//                             >
//                               <UserX size={14} />
//                             </button>
//                           )}
//                           <button
//                             onClick={() => handleDelete(p)}
//                             title='Soft Delete Student'
//                             className='p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors'
//                           >
//                             <Trash2 size={14} />
//                           </button>
//                         </>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               )
//             })}
//           </div>

//           {/* 2. Desktop Table View (Visible on >= md screens) */}
//           <div className='hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden'>
//             <div className='grid grid-cols-12 px-5 py-3 bg-slate-50 text-[9px] font-black uppercase text-gray-400'>
//               <span className='col-span-4'>Student Name</span>
//               <span className='col-span-3'>Email</span>
//               <span className='col-span-2'>Track / Mode</span>
//               <span className='col-span-1 text-center'>Status</span>
//               <span className='col-span-2 text-right'>Actions</span>
//             </div>

//             {students.map((p) => {
//               const rowId = p.id || p.key
//               const isRowLoading = actionLoadingId === rowId
//               const isSuspended = p.status === 'suspended'


//               return (
//                 <div
//                   key={p.key}
//                   className={`grid grid-cols-12 items-center px-5 py-4 border-t border-slate-50 transition-colors ${
//                     isSuspended ? 'bg-slate-50/50' : ''
//                   }`}
//                 >
//                   <div className='col-span-4 flex flex-col'>
//                     <span className='text-xs font-black text-gray-800'>
//                       {p.name}
//                     </span>
//                     {p.studentCode && (
//                       <span className='text-[9px] font-bold text-slate-400'>
//                         ID: {p.studentCode}
//                       </span>
//                     )}
//                   </div>

//                   <span className='col-span-3 text-[10px] font-bold text-slate-500 flex items-center gap-1 truncate'>
//                     <Mail size={10} /> {p.email}
//                   </span>

//                   <span className='col-span-2 text-[10px] font-bold text-slate-500 flex items-center gap-1'>
//                     <BookOpen size={10} className='text-slate-400' />
//                     <TrackOverride
//                       studentId={p.id || p.key}
//                       current={p.examTrack || p.extra}
//                     />
//                   </span>

//                   <span className='col-span-1 flex justify-center'>
//                     <Badge
//                       className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
//                         isSuspended
//                           ? 'bg-amber-50 text-amber-600 border border-amber-200'
//                           : isUnverified
//                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
//                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
//                       }`}
//                     >
//                       {isSuspended ? 'Suspended' : isUnverified ? 'Unverified' : 'Active'}
//                     </Badge>
//                   </span>

//                   {/* Actions */}
//                   <span className='col-span-2 flex items-center justify-end gap-1'>
//                     <button
//                       onClick={() => setSelectedStudent(p)}
//                       title='View Details'
//                       className='p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors'
//                     >
//                       <Eye size={14} />
//                     </button>
//                     {isRowLoading ? (
//                       <Loader2
//                         size={14}
//                         className='animate-spin text-slate-400 mr-2'
//                       />
//                     ) : (
//                       <>
//                         {isSuspended ? (
//                           <button
//                             onClick={() => handleStatusChange(p, 'active')}
//                             title='Activate Student'
//                             className='p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors'
//                           >
//                             <UserCheck size={14} />
//                           </button>
//                         ) : (
//                           <button
//                             onClick={() => handleStatusChange(p, 'suspended')}
//                             title='Suspend Student'
//                             className='p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors'
//                           >
//                             <UserX size={14} />
//                           </button>
//                         )}
//                         <button
//                           onClick={() => handleDelete(p)}
//                           title='Soft Delete Student'
//                           className='p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors'
//                         >
//                           <Trash2 size={14} />
//                         </button>
//                       </>
//                     )}
//                   </span>
//                 </div>
//               )
//             })}
//           </div>
//         </>
//       )}

//       <p className='text-[10px] font-medium text-slate-400'>
//         {source === 'server'
//           ? 'Live data from GET /api/admin/users?role=student'
//           : 'Showing local fallback data. Server API not connected yet.'}
//       </p>

//       {/* Student Details Modal */}
//       {selectedStudent && (
//         <StudentDetailsModal
//           student={selectedStudent}
//           onClose={() => setSelectedStudent(null)}
//           onStatusChange={handleStatusChange}
//           onDelete={handleDelete}
//           isLoading={
//             actionLoadingId === (selectedStudent.id || selectedStudent.key)
//           }
//         />
//       )}

//       {/* Add Student Modal */}
//       {showAddModal && (
//         <CreateStudentModal
//           onClose={() => setShowAddModal(false)}
//           onSuccess={() => fetchStudents(searchQuery)}
//           showAlert={showAlert}
//         />
//       )}

//       {/* Custom Alert Modal */}
//       {alertConfig.isOpen && (
//         <AlertModal
//           title={alertConfig.title}
//           message={alertConfig.message}
//           type={alertConfig.type}
//           onConfirm={() => {
//             if (alertConfig.onConfirm) alertConfig.onConfirm()
//             setAlertConfig((prev) => ({ ...prev, isOpen: false }))
//           }}
//           onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
//         />
//       )}
//     </div>
//   )
// }

// /* ------------------------------------------------------------------ */
// /* Modal Component: Student Details                                  */
// /* ------------------------------------------------------------------ */
// function StudentDetailsModal({
//   student,
//   onClose,
//   onStatusChange,
//   onDelete,
//   isLoading,
// }: {
//   student: ExtendedStudentPerson
//   onClose: () => void
//   onStatusChange: (
//     person: ExtendedStudentPerson,
//     newStatus: 'active' | 'suspended',
//   ) => void
//   onDelete: (person: ExtendedStudentPerson) => void
//   isLoading: boolean
// }) {
//   const isSuspended = student.status === 'suspended'


//   return (
//     <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'>
//       <div className='w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden'>
//         <div className='flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50'>
//           <div className='flex items-center gap-2.5'>
//             <div className='h-8 w-8 rounded-xl bg-[#002EFF] text-white flex items-center justify-center shadow-md shadow-blue-200'>
//               <GraduationCap size={16} />
//             </div>
//             <div>
//               <h3 className='text-xs font-black text-slate-900 uppercase tracking-wider'>
//                 Student Profile
//               </h3>
//               <p className='text-[9px] font-bold text-slate-400'>
//                 {student.studentCode ? `ID: ${student.studentCode}` : 'Details'}
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

//         <div className='p-6 space-y-4'>
//           <div className='flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100'>
//             <div>
//               <h2 className='text-base font-black text-slate-900'>
//                 {student.name}
//               </h2>
//               <p className='text-xs font-bold text-slate-500 flex items-center gap-1 mt-0.5'>
//                 <Mail size={12} /> {student.email}
//               </p>
//             </div>
//             <Badge
//               className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
//                 isSuspended
//                   ? 'bg-amber-50 text-amber-600 border border-amber-200'
//                   : isUnverified
//                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
//                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
//               }`}
//             >
//               {isSuspended ? 'Suspended' : isUnverified ? 'Unverified' : 'Active'}
//             </Badge>
//           </div>

//           <div className='grid grid-cols-2 gap-3 text-xs'>
//             <div className='p-3 bg-slate-50 rounded-xl border border-slate-100'>
//               <span className='text-[9px] font-black uppercase tracking-wider text-slate-400 block'>
//                 Exam Track
//               </span>
//               <span className='font-bold text-slate-800 mt-1 block'>
//                 {student.examTrack || 'Not Specified'}
//               </span>
//             </div>

//             <div className='p-3 bg-slate-50 rounded-xl border border-slate-100'>
//               <span className='text-[9px] font-black uppercase tracking-wider text-slate-400 block'>
//                 Learning Mode
//               </span>
//               <span className='font-bold text-slate-800 mt-1 block'>
//                 {student.learningMode || 'Not Specified'}
//               </span>
//             </div>
//           </div>

//           <div className='flex items-center justify-between gap-2 pt-4 border-t border-slate-100'>
//             <button
//               type='button'
//               onClick={() => onDelete(student)}
//               disabled={isLoading}
//               className='flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50'
//             >
//               <Trash2 size={14} /> Soft Delete
//             </button>

//             <div className='flex items-center gap-2'>
//               {isSuspended ? (
//                 <button
//                   type='button'
//                   onClick={() => onStatusChange(student, 'active')}
//                   disabled={isLoading}
//                   className='flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-200 disabled:opacity-50'
//                 >
//                   {isLoading ? (
//                     <Loader2 size={14} className='animate-spin' />
//                   ) : (
//                     <UserCheck size={14} />
//                   )}{' '}
//                   Re-activate
//                 </button>
//               ) : (
//                 <button
//                   type='button'
//                   onClick={() => onStatusChange(student, 'suspended')}
//                   disabled={isLoading}
//                   className='flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-200 disabled:opacity-50'
//                 >
//                   {isLoading ? (
//                     <Loader2 size={14} className='animate-spin' />
//                   ) : (
//                     <UserX size={14} />
//                   )}{' '}
//                   Suspend
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

// /* ------------------------------------------------------------------ */
// /* Modal Component: POST /api/admin/staff (Role = Student)           */
// /* ------------------------------------------------------------------ */
// function CreateStudentModal({
//   onClose,
//   onSuccess,
//   showAlert,
// }: {
//   onClose: () => void
//   onSuccess: () => void
//   showAlert: (title: string, message: string, type?: 'info' | 'error') => void
// }) {
//   const [fullname, setFullname] = useState('')
//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('TempPass123')
//   const [examTrack, setExamTrack] = useState('UTME')
//   const [learningMode, setLearningMode] = useState('Online')

//   const [submitting, setSubmitting] = useState(false)

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()

//     if (!fullname.trim() || !email.trim() || !password.trim()) {
//       showAlert(
//         'Missing Fields',
//         'Fullname, email, and password are required.',
//         'error',
//       )
//       return
//     }

//     setSubmitting(true)
//     try {
//       const payload = {
//         fullname: fullname.trim(),
//         email: email.trim().toLowerCase(),
//         password,
//         role: 'student',
//         examTrack,
//         learningMode,
//       }

//       const api = adminApi as unknown as {
//         createStaffAccount?: (
//           data: typeof payload,
//         ) => Promise<{ success?: boolean; message?: string }>
//       }

//       const res =
//         typeof api.createStaffAccount === 'function'
//           ? await api.createStaffAccount(payload)
//           : null

//       if (res?.success) {
//         showAlert(
//           'Success',
//           `Student account created! Credentials sent to ${email}`,
//         )
//         onSuccess()
//         onClose()
//       } else {
//         throw new Error(res?.message || 'Failed to create student account')
//       }
//     } catch (err: unknown) {
//       showAlert(
//         'Creation Failed',
//         err instanceof Error ? err.message : 'Failed to create student',
//         'error',
//       )
//     } finally {
//       setSubmitting(false)
//     }
//   }

//   return (
//     <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'>
//       <div className='w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden'>
//         <div className='flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50'>
//           <div className='flex items-center gap-2.5'>
//             <div className='h-8 w-8 rounded-xl bg-[#002EFF] text-white flex items-center justify-center shadow-md shadow-blue-200'>
//               <GraduationCap size={16} />
//             </div>
//             <div>
//               <h3 className='text-xs font-black text-slate-900 uppercase tracking-wider'>
//                 Add New Student
//               </h3>
//               <p className='text-[9px] font-bold text-slate-400'>
//                 POST /api/admin/staff
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

//         <form onSubmit={handleSubmit} className='p-6 space-y-4'>
//           <div className='space-y-1'>
//             <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
//               Full Name <span className='text-rose-500'>*</span>
//             </label>
//             <input
//               type='text'
//               value={fullname}
//               onChange={(e) => setFullname(e.target.value)}
//               placeholder='e.g. John Doe'
//               className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
//             />
//           </div>

//           <div className='space-y-1'>
//             <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
//               Email Address <span className='text-rose-500'>*</span>
//             </label>
//             <input
//               type='email'
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               placeholder='e.g. student@dsa.com'
//               className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
//             />
//           </div>

//           <div className='space-y-1'>
//             <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
//               Temporary Password <span className='text-rose-500'>*</span>
//             </label>
//             <input
//               type='text'
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
//             />
//           </div>

//           <div className='grid grid-cols-2 gap-3'>
//             <div className='space-y-1'>
//               <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
//                 Exam Track
//               </label>
//               <select
//                 value={examTrack}
//                 onChange={(e) => setExamTrack(e.target.value)}
//                 className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
//               >
//                 <option value='UTME'>UTME / JAMB</option>
//                 <option value='WAEC'>WAEC / NECO</option>
//                 <option value='POST-UTME'>POST-UTME</option>
//                 <option value='A-LEVELS'>JUPEB / A-LEVELS</option>
//               </select>
//             </div>

//             <div className='space-y-1'>
//               <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
//                 Learning Mode
//               </label>
//               <select
//                 value={learningMode}
//                 onChange={(e) => setLearningMode(e.target.value)}
//                 className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
//               >
//                 <option value='Online'>Online</option>
//                 <option value='Physical'>Physical Class</option>
//                 <option value='Hybrid'>Hybrid</option>
//               </select>
//             </div>
//           </div>

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
//                 'Create Student'
//               )}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   )
// }

// /* ------------------------------------------------------------------ */
// /* Modal Component: Reusable Alert / Confirm Dialog                   */
// /* ------------------------------------------------------------------ */
// function AlertModal({
//   title,
//   message,
//   type,
//   onConfirm,
//   onClose,
// }: {
//   title: string
//   message: string
//   type: 'info' | 'error' | 'confirm'
//   onConfirm: () => void
//   onClose: () => void
// }) {
//   return (
//     <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'>
//       <div className='w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 text-center'>
//         <div className='flex justify-center'>
//           {type === 'error' ? (
//             <div className='h-12 w-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center'>
//               <AlertCircle size={24} />
//             </div>
//           ) : type === 'confirm' ? (
//             <div className='h-12 w-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center'>
//               <ShieldAlert size={24} />
//             </div>
//           ) : (
//             <div className='h-12 w-12 rounded-2xl bg-blue-50 text-[#002EFF] flex items-center justify-center'>
//               <CheckCircle2 size={24} />
//             </div>
//           )}
//         </div>

//         <div className='space-y-1'>
//           <h3 className='text-sm font-black text-slate-900'>{title}</h3>
//           <p className='text-xs font-bold text-slate-500 leading-relaxed'>
//             {message}
//           </p>
//         </div>

//         <div className='flex items-center justify-center gap-2 pt-2'>
//           {type === 'confirm' ? (
//             <>
//               <button
//                 onClick={onClose}
//                 className='w-1/2 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-all'
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={onConfirm}
//                 className='w-1/2 h-10 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shadow-md shadow-rose-200 transition-all'
//               >
//                 Confirm
//               </button>
//             </>
//           ) : (
//             <button
//               onClick={onConfirm}
//               className='w-full h-10 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all'
//             >
//               OK
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   )
// }

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  GraduationCap,
  Mail,
  Loader2,
  Cloud,
  HardDrive,
  UserCheck,
  UserX,
  Trash2,
  Plus,
  Search,
  BookOpen,
  X,
  AlertCircle,
  Eye,
  CheckCircle2,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Send,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { adminApi, type AdminUserListItem, type OtpDelivery } from '@/lib/admin-api'
import ChangeRequestsPanel from './ChangeRequestsPanel'
import {
  PROGRAMMES,
  CLASS_LEVELS,
  GENDERS,
  NIGERIAN_STATES,
} from '@/lib/registration'
import TrackOverride from './TrackOverride'
import DepartmentOverride from './DepartmentOverride'

/* ------------------------------------------------------------------ */
/* Types & Interfaces                                                 */
/* ------------------------------------------------------------------ */
export interface ExtendedStudentPerson {
  id?: string
  key: string
  name: string
  email: string
  extra?: string
  status?: 'active' | 'suspended' | 'pending_payment' | 'pending_otp' | string
  examTrack?: string
  department?: string
  learningMode?: string
  studentCode?: string
}

interface ActionModalState {
  isOpen: boolean
  type: 'suspend' | 'unsuspend' | 'delete' | null
  student: ExtendedStudentPerson | null
}

function mapStudent(
  u: AdminUserListItem | Record<string, unknown>,
  fallbackIndex: number,
): ExtendedStudentPerson {
  const s = u as Record<string, unknown>
  const derivedId = String(s.id || s._id || s.studentId || '')

  return {
    id: derivedId,
    key: derivedId || `student-${fallbackIndex}`,
    name: String(s.fullname || s.fullName || s.name || 'Student'),
    email: String(s.email || ''),
    extra: String(s.examTrack || s.learningMode || 'General'),
    examTrack: typeof s.examTrack === 'string' ? s.examTrack : undefined,
    department: typeof s.department === 'string' ? s.department : undefined,
    learningMode:
      typeof s.learningMode === 'string' ? s.learningMode : undefined,
    studentCode:
      typeof s.studentId === 'string'
        ? s.studentId
        : typeof s.studentCode === 'string'
          ? s.studentCode
          : undefined,
    status: (s.status ||
      (s.isActive === false ? 'suspended' : 'active')) as string,
  }
}

/* ------------------------------------------------------------------ */
/* Main StudentRoster Component                                       */
/* ------------------------------------------------------------------ */
export default function StudentRoster() {
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<ExtendedStudentPerson[]>([])
  const [source, setSource] = useState<'server' | 'local'>('local')
  const [searchQuery, setSearchQuery] = useState('')
  // Filter by programme / class / access tier (sent to the backend user filter).
  const [programmeFilter, setProgrammeFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [accessFilter, setAccessFilter] = useState('')
  // '' = everyone, 'pending_otp' = registered but never entered their code.
  const [statusFilter, setStatusFilter] = useState('')
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')
  // Which unverified students the admin ticked, to email just them.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalStudents, setTotalStudents] = useState(0)
  const limit = 10

  // Action Modals & Action Pending States
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedStudent, setSelectedStudent] =
    useState<ExtendedStudentPerson | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Confirmation Action Modal state
  const [actionModal, setActionModal] = useState<ActionModalState>({
    isOpen: false,
    type: null,
    student: null,
  })

  // Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'info' | 'error'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  })

  const showAlert = (
    title: string,
    message: string,
    type: 'info' | 'error' = 'info',
  ) => {
    setAlertConfig({ isOpen: true, title, message, type })
  }

  // Data Fetching logic with Pagination support
  const fetchStudents = useCallback(
    async (query = '', page = 1, programme = '', cls = '', access = '', status = '') => {
    setLoading(true)
    try {
      const response = await adminApi.getUsers({
        role: 'student',
        search: query || undefined,
        programme: programme || undefined,
        class: cls || undefined,
        accessLevel: access || undefined,
        status: status || undefined,
        page,
        limit,
      })

      // Standardize response payload format
      const resAny = response as unknown as Record<string, unknown>
      const rows = Array.isArray(response)
        ? response
        : Array.isArray(resAny?.data)
          ? (resAny.data as AdminUserListItem[])
          : Array.isArray(resAny?.users)
            ? (resAny.users as AdminUserListItem[])
            : null

      if (rows) {
        setStudents(
          rows.map((r: AdminUserListItem, i: number) => mapStudent(r, i)),
        )
        setSource('server')

        // Derive Pagination metadata safely from backend
        const total =
          typeof resAny?.total === 'number'
            ? resAny.total
            : typeof resAny?.count === 'number'
              ? resAny.count
              : rows.length

        const derivedPages =
          typeof resAny?.totalPages === 'number'
            ? resAny.totalPages
            : Math.ceil(total / limit) || 1

        setTotalStudents(total)
        setTotalPages(derivedPages)
      } else {
        throw new Error('No server data structure matched.')
      }
    } catch {
      // Local fallback in case server fails
      const localFallback: ExtendedStudentPerson[] = []
      setStudents(
        localFallback.map((s: ExtendedStudentPerson, i: number) => ({
          ...s,
          id: s.key || `local-${i}`,
          status: 'active',
        })),
      )
      setSource('local')
      setTotalStudents(localFallback.length)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStudents(searchQuery, currentPage, programmeFilter, classFilter, accessFilter, statusFilter)
    // Re-fetch on page change or when a filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStudents, currentPage, programmeFilter, classFilter, accessFilter, statusFilter])

  // Email every student still waiting on verification a fresh code and a
  // one-tap activation link. The server does 40 per call; keep calling until
  // nobody is left, and show the running total.
  // Email an activation link to just the students the admin ticked.
  const resendToSelected = async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    if (!window.confirm(`Email an activation link to ${ids.length} selected student${ids.length === 1 ? '' : 's'}?`)) return
    setBulkSending(true)
    setBulkMsg('Sending…')
    try {
      const res = await adminApi.resendActivationTo(ids)
      setBulkMsg(
        `Sent ${res.data.sent} activation email${res.data.sent === 1 ? '' : 's'}.` +
          (res.data.failed.length
            ? ` ${res.data.failed.length} could not be sent — first: ${res.data.failed[0].email} (${res.data.failed[0].reason})`
            : ''),
      )
      setSelectedIds(new Set())
    } catch (err) {
      setBulkMsg(err instanceof Error ? err.message : 'Sending stopped early.')
    } finally {
      setBulkSending(false)
    }
  }

  // Tick / untick every unverified student on this page at once.
  const pageUnverifiedIds = () =>
    students.filter((p) => p.status === 'pending_otp').map((p) => String(p.id || p.key))
  const allPageSelected = () => {
    const ids = pageUnverifiedIds()
    return ids.length > 0 && ids.every((id) => selectedIds.has(id))
  }
  const toggleSelectPage = () =>
    setSelectedIds((prev) => {
      const ids = pageUnverifiedIds()
      const next = new Set(prev)
      if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchStudents(searchQuery, 1, programmeFilter, classFilter, accessFilter, statusFilter)
  }

  /* ------------------------------------------------------------------ */
  /* Confirmed Action Handlers (Status Change & Delete)                 */
  /* ------------------------------------------------------------------ */
  const handleStatusChangeConfirmed = async (
    person: ExtendedStudentPerson,
    newStatus: 'active' | 'suspended',
  ) => {
    const targetId = person.id || person.key
    setActionLoadingId(targetId)

    try {
      if (source === 'server' && person.id) {
        const api = adminApi as unknown as {
          updateUserStatus?: (
            id: string,
            body: { status: string },
          ) => Promise<unknown>
          updateUser?: (
            id: string,
            body: { status: string },
          ) => Promise<unknown>
        }
        if (typeof api.updateUserStatus === 'function') {
          await api.updateUserStatus(person.id, { status: newStatus })
        } else if (typeof api.updateUser === 'function') {
          await api.updateUser(person.id, { status: newStatus })
        }
      }

      const updatedPerson = { ...person, status: newStatus }

      setStudents((prev) =>
        prev.map((p) =>
          p.id === targetId || p.key === targetId ? updatedPerson : p,
        ),
      )

      if (
        selectedStudent &&
        (selectedStudent.id === targetId || selectedStudent.key === targetId)
      ) {
        setSelectedStudent(updatedPerson)
      }

      showAlert(
        'Status Updated',
        `Student has been successfully ${newStatus === 'active' ? 'reactivated' : 'suspended'}.`,
      )
    } catch (err) {
      showAlert(
        'Action Failed',
        `Failed to ${newStatus === 'active' ? 'reactivate' : 'suspend'} student: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
        'error',
      )
    } finally {
      setActionLoadingId(null)
      setActionModal({ isOpen: false, type: null, student: null })
    }
  }

  const handleDeleteConfirmed = async (person: ExtendedStudentPerson) => {
    const targetId = person.id || person.key
    setActionLoadingId(targetId)

    try {
      if (source === 'server' && person.id) {
        const api = adminApi as unknown as {
          deleteUser?: (id: string) => Promise<unknown>
        }
        if (typeof api.deleteUser === 'function') {
          await api.deleteUser(person.id)
        }
      }

      setStudents((prev) =>
        prev.filter((p) => (p.id ? p.id !== targetId : p.key !== targetId)),
      )

      if (
        selectedStudent &&
        (selectedStudent.id === targetId || selectedStudent.key === targetId)
      ) {
        setSelectedStudent(null)
      }

      setTotalStudents((prev) => Math.max(0, prev - 1))
      showAlert('Student Removed', `${person.name} has been soft-deleted.`)
    } catch (err) {
      showAlert(
        'Delete Failed',
        `Failed to delete student: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
        'error',
      )
    } finally {
      setActionLoadingId(null)
      setActionModal({ isOpen: false, type: null, student: null })
    }
  }

  return (
    <div className='max-w-5xl mx-auto space-y-4 px-4 py-2'>
      {/* Header Bar */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <GraduationCap size={22} className='text-[#002EFF]' />
          <h1 className='text-2xl font-black text-slate-900 tracking-tight'>
            Students
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
            {totalStudents} Total
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className='flex items-center gap-1.5 px-3.5 py-2 bg-[#002EFF] text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95'
        >
          <Plus size={14} /> Add Student
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className='flex items-center gap-2'>
        <div className='relative flex-1'>
          <Search
            size={14}
            className='absolute left-3.5 top-3 text-slate-400'
          />
          <input
            type='text'
            placeholder='Name, email or student ID'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full h-10 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#002EFF] transition-all'
          />
        </div>
        <button
          type='submit'
          className='px-4 h-10 bg-slate-900 text-white font-black text-[10px] uppercase rounded-xl hover:bg-slate-800 transition-all'
        >
          Search
        </button>
      </form>

      {/* Students asking to move class / programme — approve here */}
      <ChangeRequestsPanel
        onDecided={() =>
          fetchStudents(searchQuery, currentPage, programmeFilter, classFilter, accessFilter, statusFilter)
        }
      />

      {/* Filters — by programme and by class/level */}
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-[9px] font-black uppercase tracking-widest text-slate-400'>
          Filter
        </span>
        <select
          value={programmeFilter}
          onChange={(e) => {
            setProgrammeFilter(e.target.value)
            setCurrentPage(1)
          }}
          className='h-9 px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-700 outline-none focus:border-[#002EFF]'
        >
          <option value=''>All programmes</option>
          {PROGRAMMES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(e) => {
            setClassFilter(e.target.value)
            setCurrentPage(1)
          }}
          className='h-9 px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-700 outline-none focus:border-[#002EFF]'
        >
          <option value=''>All classes</option>
          {CLASS_LEVELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={accessFilter}
          onChange={(e) => {
            setAccessFilter(e.target.value)
            setCurrentPage(1)
          }}
          title='Filter by what the student has paid for'
          className='h-9 px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-700 outline-none focus:border-[#002EFF]'
        >
          <option value=''>All access</option>
          <option value='tutorial'>Tutorial (subscribed)</option>
          <option value='portal'>Portal (₦2k paid)</option>
          <option value='paid'>Paid (portal + tutorial)</option>
          <option value='free'>Free</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setCurrentPage(1)
          }}
          title='Students who registered but never entered their code'
          className={`h-9 px-2 bg-white border rounded-lg text-[11px] font-black outline-none focus:border-[#002EFF] ${
            statusFilter ? 'border-amber-300 text-amber-700' : 'border-slate-200 text-slate-700'
          }`}
        >
          <option value=''>All statuses</option>
          <option value='pending_otp'>Unverified (never entered code)</option>
          <option value='active'>Active</option>
          <option value='suspended'>Suspended</option>
        </select>
        {statusFilter === 'pending_otp' && students.length > 0 && (
          <>
            <button
              type='button'
              onClick={toggleSelectPage}
              className='h-9 px-3 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase text-slate-600 hover:border-[#002EFF]/40'
            >
              {allPageSelected() ? 'Unselect page' : 'Select page'}
            </button>
            <button
              type='button'
              onClick={resendToSelected}
              disabled={bulkSending || loading || selectedIds.size === 0}
              className='h-9 px-3 rounded-lg bg-[#002EFF] text-white text-[10px] font-black uppercase hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5'
            >
              {bulkSending ? <Loader2 size={12} className='animate-spin' /> : <Send size={12} />}
              Send activation link to selected ({selectedIds.size})
            </button>
          </>
        )}
        {(programmeFilter || classFilter || accessFilter || statusFilter) && (
          <button
            type='button'
            onClick={() => {
              setProgrammeFilter('')
              setClassFilter('')
              setAccessFilter('')
              setStatusFilter('')
              setCurrentPage(1)
            }}
            className='h-9 px-3 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black uppercase hover:text-[#002EFF]'
          >
            Clear
          </button>
        )}
      </div>
      {bulkMsg && (
        <p className='rounded-xl bg-blue-50 px-3 py-2 text-[11px] font-bold text-[#002EFF]' role='status'>
          {bulkMsg}
        </p>
      )}

      {/* Content View */}
      {loading ? (
        <div className='py-12 flex justify-center bg-white rounded-2xl border border-slate-100'>
          <Loader2 className='animate-spin text-[#002EFF]' />
        </div>
      ) : students.length === 0 ? (
        <div className='bg-white rounded-2xl border border-slate-100 p-10 text-center'>
          <p className='text-xs font-bold text-slate-400'>No students found.</p>
        </div>
      ) : (
        <>
          {/* 1. Mobile Card View */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden'>
            {students.map((p) => {
              const rowId = p.id || p.key
              const isRowLoading = actionLoadingId === rowId
              const isSuspended = p.status === 'suspended'
              const isUnverified = p.status === 'pending_otp'


              return (
                <div
                  key={p.key}
                  className={`p-4 bg-white rounded-2xl border ${
                    isSuspended
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-slate-100'
                  } shadow-sm space-y-3 flex flex-col justify-between`}
                >
                  <div className='space-y-2'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex items-start gap-2'>
                        {isUnverified && (
                          <input
                            type='checkbox'
                            checked={selectedIds.has(String(p.id || p.key))}
                            onChange={() => toggleSelected(String(p.id || p.key))}
                            className='mt-0.5 h-4 w-4 shrink-0 accent-[#002EFF]'
                            aria-label={`Select ${p.name}`}
                          />
                        )}
                        <div>
                        <h3 className='text-xs font-black text-slate-900 line-clamp-1'>
                          {p.name}
                        </h3>
                        {p.studentCode && (
                          <span className='text-[9px] font-bold text-slate-400 block'>
                            ID: {p.studentCode}
                          </span>
                        )}
                        </div>
                      </div>
                      <Badge
                        className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                          isSuspended
                            ? 'bg-amber-50 text-amber-600 border border-amber-200'
                            : isUnverified
                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}
                      >
                        {isSuspended ? 'Suspended' : isUnverified ? 'Unverified' : 'Active'}
                      </Badge>
                    </div>

                    <div className='text-[10px] font-bold text-slate-500 space-y-1 pt-1 border-t border-slate-50'>
                      <div className='flex items-center gap-1.5 truncate'>
                        <Mail size={11} className='text-slate-400 shrink-0' />
                        <span className='truncate'>{p.email}</span>
                      </div>
                      <div className='flex items-center gap-1.5'>
                        <BookOpen
                          size={11}
                          className='text-slate-400 shrink-0'
                        />
                        <TrackOverride
                          studentId={p.id || p.key}
                          current={p.examTrack || p.extra}
                        />
                        <DepartmentOverride
                          studentId={p.id || p.key}
                          current={p.department}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className='flex items-center justify-between pt-2 border-t border-slate-100 gap-2'>
                    <button
                      onClick={() => setSelectedStudent(p)}
                      className='flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black transition-all'
                    >
                      <Eye size={12} /> View Details
                    </button>

                    <div className='flex items-center gap-1'>
                      {isRowLoading ? (
                        <Loader2
                          size={14}
                          className='animate-spin text-slate-400'
                        />
                      ) : (
                        <>
                          {isSuspended ? (
                            <button
                              onClick={() =>
                                setActionModal({
                                  isOpen: true,
                                  type: 'unsuspend',
                                  student: p,
                                })
                              }
                              title='Reactivate Student'
                              className='p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors'
                            >
                              <UserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setActionModal({
                                  isOpen: true,
                                  type: 'suspend',
                                  student: p,
                                })
                              }
                              title='Suspend Student'
                              className='p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors'
                            >
                              <UserX size={14} />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setActionModal({
                                isOpen: true,
                                type: 'delete',
                                student: p,
                              })
                            }
                            title='Soft Delete Student'
                            className='p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors'
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 2. Desktop Table View */}
          <div className='hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden'>
            <div className='grid grid-cols-12 px-5 py-3 bg-slate-50 text-[9px] font-black uppercase text-gray-400'>
              <span className='col-span-4'>Student Name</span>
              <span className='col-span-3'>Email</span>
              <span className='col-span-2'>Track / Mode</span>
              <span className='col-span-1 text-center'>Status</span>
              <span className='col-span-2 text-right'>Actions</span>
            </div>

            {students.map((p) => {
              const rowId = p.id || p.key
              const isRowLoading = actionLoadingId === rowId
              const isSuspended = p.status === 'suspended'
              const isUnverified = p.status === 'pending_otp'


              return (
                <div
                  key={p.key}
                  className={`grid grid-cols-12 items-center px-5 py-4 border-t border-slate-50 transition-colors ${
                    isSuspended ? 'bg-slate-50/50' : ''
                  }`}
                >
                  <div className='col-span-4 flex items-center gap-2'>
                    {isUnverified && (
                      <input
                        type='checkbox'
                        checked={selectedIds.has(String(p.id || p.key))}
                        onChange={() => toggleSelected(String(p.id || p.key))}
                        className='h-4 w-4 shrink-0 accent-[#002EFF]'
                        aria-label={`Select ${p.name}`}
                      />
                    )}
                    <div className='flex flex-col min-w-0'>
                      <span className='text-xs font-black text-gray-800 truncate'>
                        {p.name}
                      </span>
                      {p.studentCode && (
                        <span className='text-[9px] font-bold text-slate-400'>
                          ID: {p.studentCode}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className='col-span-3 text-[10px] font-bold text-slate-500 flex items-center gap-1 truncate'>
                    <Mail size={10} /> {p.email}
                  </span>

                  <span className='col-span-2 text-[10px] font-bold text-slate-500 flex flex-wrap items-center gap-1'>
                    <BookOpen size={10} className='text-slate-400' />
                    <TrackOverride
                      studentId={p.id || p.key}
                      current={p.examTrack || p.extra}
                    />
                    <DepartmentOverride
                      studentId={p.id || p.key}
                      current={p.department}
                    />
                  </span>

                  <span className='col-span-1 flex justify-center'>
                    <Badge
                      className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isSuspended
                          ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : isUnverified
                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}
                    >
                      {isSuspended ? 'Suspended' : isUnverified ? 'Unverified' : 'Active'}
                    </Badge>
                  </span>

                  {/* Desktop Actions */}
                  <span className='col-span-2 flex items-center justify-end gap-1'>
                    <button
                      onClick={() => setSelectedStudent(p)}
                      title='View Details'
                      className='p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors'
                    >
                      <Eye size={14} />
                    </button>
                    {isRowLoading ? (
                      <Loader2
                        size={14}
                        className='animate-spin text-slate-400 mr-2'
                      />
                    ) : (
                      <>
                        {isSuspended ? (
                          <button
                            onClick={() =>
                              setActionModal({
                                isOpen: true,
                                type: 'unsuspend',
                                student: p,
                              })
                            }
                            title='Reactivate Student'
                            className='p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors'
                          >
                            <UserCheck size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setActionModal({
                                isOpen: true,
                                type: 'suspend',
                                student: p,
                              })
                            }
                            title='Suspend Student'
                            className='p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors'
                          >
                            <UserX size={14} />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setActionModal({
                              isOpen: true,
                              type: 'delete',
                              student: p,
                            })
                          }
                          title='Soft Delete Student'
                          className='p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors'
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Pagination Component */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalStudents}
            itemsPerPage={limit}
            onPageChange={(page) => setCurrentPage(page)}
            isLoading={loading}
          />
        </>
      )}

      <p className='text-[10px] font-medium text-slate-400'>
        {source === 'server'
          ? 'Live data from GET /api/admin/users?role=student'
          : 'Showing local fallback data. Server API not connected yet.'}
      </p>

      {/* Student Details Modal */}
      {selectedStudent && (
        <StudentDetailsModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onStatusChangeRequest={(student, targetStatus) =>
            setActionModal({
              isOpen: true,
              type: targetStatus === 'active' ? 'unsuspend' : 'suspend',
              student,
            })
          }
          onDeleteRequest={(student) =>
            setActionModal({
              isOpen: true,
              type: 'delete',
              student,
            })
          }
          isLoading={
            actionLoadingId === (selectedStudent.id || selectedStudent.key)
          }
        />
      )}

      {/* Create Student Modal */}
      {showAddModal && (
        <CreateStudentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => fetchStudents(searchQuery, currentPage)}
          showAlert={showAlert}
        />
      )}

      {/* Confirmation Action Modal (Suspend / Reactivate / Delete) */}
      {actionModal.isOpen && actionModal.student && (
        <ActionConfirmModal
          isOpen={actionModal.isOpen}
          type={actionModal.type}
          student={actionModal.student}
          isLoading={
            actionLoadingId ===
            (actionModal.student.id || actionModal.student.key)
          }
          onClose={() =>
            setActionModal({ isOpen: false, type: null, student: null })
          }
          onConfirm={() => {
            if (!actionModal.student) return
            if (actionModal.type === 'suspend') {
              handleStatusChangeConfirmed(actionModal.student, 'suspended')
            } else if (actionModal.type === 'unsuspend') {
              handleStatusChangeConfirmed(actionModal.student, 'active')
            } else if (actionModal.type === 'delete') {
              handleDeleteConfirmed(actionModal.student)
            }
          }}
        />
      )}

      {/* Basic Alert Modal */}
      {alertConfig.isOpen && (
        <AlertModal
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Subcomponent: Pagination Controls                                  */
/* ------------------------------------------------------------------ */
function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  isLoading = false,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}) {
  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const delta = 1

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i)
      } else if (
        pages[pages.length - 1] !== '...' &&
        (i < currentPage - delta || i > currentPage + delta)
      ) {
        pages.push('...')
      }
    }
    return pages
  }

  return (
    <div className='flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 px-2'>
      <p className='text-xs font-bold text-slate-500'>
        Showing <span className='text-slate-900 font-black'>{startItem}</span>{' '}
        to <span className='text-slate-900 font-black'>{endItem}</span> of{' '}
        <span className='text-slate-900 font-black'>{totalItems}</span> students
      </p>

      <div className='flex items-center gap-1.5'>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className='flex items-center justify-center h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 transition-all'
        >
          <ChevronLeft size={14} className='mr-1' /> Previous
        </button>

        <div className='flex items-center gap-1'>
          {getPageNumbers().map((page, idx) =>
            typeof page === 'number' ? (
              <button
                key={idx}
                onClick={() => onPageChange(page)}
                disabled={isLoading}
                className={`h-9 w-9 rounded-xl text-xs font-black transition-all ${
                  currentPage === page
                    ? 'bg-[#002EFF] text-white shadow-md shadow-blue-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {page}
              </button>
            ) : (
              <span key={idx} className='px-1 text-slate-400 font-bold text-xs'>
                {page}
              </span>
            ),
          )}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className='flex items-center justify-center h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 transition-all'
        >
          Next <ChevronRight size={14} className='ml-1' />
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal Component: Action Confirmation Modal                          */
/* ------------------------------------------------------------------ */
function ActionConfirmModal({
  isOpen,
  type,
  student,
  isLoading,
  onConfirm,
  onClose,
}: {
  isOpen: boolean
  type: 'suspend' | 'unsuspend' | 'delete' | null
  student: ExtendedStudentPerson
  isLoading: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  if (!isOpen || !type) return null

  const isDelete = type === 'delete'
  const isSuspend = type === 'suspend'

  const title = isDelete
    ? 'Delete Student Account'
    : isSuspend
      ? 'Suspend Student Account'
      : 'Reactivate Student Account'

  const confirmText = isDelete
    ? 'Yes, Soft Delete'
    : isSuspend
      ? 'Yes, Suspend'
      : 'Yes, Reactivate'

  const btnBg = isDelete
    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200 text-white'
    : isSuspend
      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 text-white'
      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 text-white'

  const iconContainerClass = isDelete
    ? 'bg-rose-50 text-rose-500'
    : isSuspend
      ? 'bg-amber-50 text-amber-500'
      : 'bg-emerald-50 text-emerald-600'

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 text-center'>
        <div className='flex justify-center'>
          <div
            className={`h-12 w-12 rounded-2xl flex items-center justify-center ${iconContainerClass}`}
          >
            {isDelete ? (
              <AlertCircle size={24} />
            ) : isSuspend ? (
              <ShieldAlert size={24} />
            ) : (
              <CheckCircle2 size={24} />
            )}
          </div>
        </div>

        <div className='space-y-1.5'>
          <h3 className='text-sm font-black text-slate-900'>{title}</h3>
          <p className='text-xs font-medium text-slate-500 leading-relaxed'>
            Are you sure you want to{' '}
            {type === 'unsuspend' ? 'reactivate' : type}{' '}
            <strong className='text-slate-900'>{student.name}</strong> (
            {student.email})?
          </p>
        </div>

        <div className='flex items-center justify-center gap-2 pt-2'>
          <button
            type='button'
            onClick={onClose}
            disabled={isLoading}
            className='w-1/2 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-all disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-1/2 h-10 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${btnBg}`}
          >
            {isLoading ? (
              <Loader2 size={14} className='animate-spin' />
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal Component: Student Details                                   */
/* ------------------------------------------------------------------ */
/**
 * For a student who registered but never entered their code: did the last
 * email reach them, and a button to send a fresh code plus a one-tap link.
 */
function VerificationPanel({ id, email }: { id: string; email: string }) {
  const [delivery, setDelivery] = useState<OtpDelivery | null>(null)
  const [checking, setChecking] = useState(true)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const res = await adminApi.getOtpDelivery(id)
      setDelivery(res.data)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not check delivery.')
    } finally {
      setChecking(false)
    }
  }, [id])

  useEffect(() => {
    check()
  }, [check])

  const resend = async () => {
    setSending(true)
    setMsg('')
    try {
      await adminApi.resendActivation(id)
      setMsg(`Sent to ${email}. It carries a fresh code and a one-tap activation link.`)
      // Give the email service a moment to record the receipt.
      setTimeout(check, 2500)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not send.')
    } finally {
      setSending(false)
    }
  }

  const ev = delivery?.delivery?.lastEvent
  const tone =
    ev === 'delivered'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : ev === 'bounced' || ev === 'complained'
        ? 'bg-rose-50 text-rose-700 border-rose-100'
        : 'bg-amber-50 text-amber-700 border-amber-100'

  return (
    <div className='border-b border-slate-100 bg-amber-50/40 px-5 py-4 space-y-2'>
      <p className='text-[9px] font-black uppercase tracking-widest text-amber-700'>
        Not verified yet
      </p>
      {checking ? (
        <p className='flex items-center gap-1.5 text-[11px] font-bold text-slate-500'>
          <Loader2 size={12} className='animate-spin' /> Checking whether the code reached them…
        </p>
      ) : delivery?.delivery ? (
        <div className={`rounded-xl border px-3 py-2 ${tone}`}>
          <p className='text-[10px] font-black uppercase'>
            Last email: {String(ev).replace('_', ' ')}
            {delivery.sentAt && (
              <span className='ml-1 font-bold normal-case opacity-70'>
                · {new Date(delivery.sentAt).toLocaleString()}
              </span>
            )}
          </p>
          <p className='text-[11px] font-medium'>{delivery.delivery.meaning}</p>
        </div>
      ) : (
        <p className='text-[11px] font-medium text-slate-500'>{delivery?.note ?? msg}</p>
      )}
      <button
        type='button'
        onClick={resend}
        disabled={sending}
        className='inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#002EFF] px-3 text-[10px] font-black uppercase text-white hover:bg-blue-700 disabled:opacity-50'
      >
        {sending ? <Loader2 size={12} className='animate-spin' /> : <Send size={12} />}
        Resend activation link
      </button>
      {msg && !checking && <p className='text-[11px] font-bold text-slate-600'>{msg}</p>}
    </div>
  )
}

function StudentDetailsModal({
  student,
  onClose,
  onStatusChangeRequest,
  onDeleteRequest,
  isLoading,
}: {
  student: ExtendedStudentPerson
  onClose: () => void
  onStatusChangeRequest: (
    person: ExtendedStudentPerson,
    newStatus: 'active' | 'suspended',
  ) => void
  onDeleteRequest: (person: ExtendedStudentPerson) => void
  isLoading: boolean
}) {
  const isSuspended = student.status === 'suspended'
  const isUnverified = student.status === 'pending_otp'


  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-100'>
        {student.status === 'pending_otp' && student.id && (
          <VerificationPanel id={student.id} email={student.email} />
        )}
        <div className='flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50'>
          <div className='flex items-center gap-2.5'>
            <div className='h-8 w-8 rounded-xl bg-[#002EFF] text-white flex items-center justify-center shadow-md shadow-blue-200'>
              <GraduationCap size={16} />
            </div>
            <div>
              <h3 className='text-xs font-black text-slate-900 uppercase tracking-wider'>
                Student Profile
              </h3>
              <p className='text-[9px] font-bold text-slate-400'>
                {student.studentCode ? `ID: ${student.studentCode}` : 'Details'}
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

        <div className='p-6 space-y-4'>
          <div className='flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100'>
            <div>
              <h2 className='text-base font-black text-slate-900'>
                {student.name}
              </h2>
              <p className='text-xs font-bold text-slate-500 flex items-center gap-1 mt-0.5'>
                <Mail size={12} /> {student.email}
              </p>
            </div>
            <Badge
              className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                isSuspended
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : isUnverified
                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}
            >
              {isSuspended ? 'Suspended' : isUnverified ? 'Unverified' : 'Active'}
            </Badge>
          </div>

          <div className='grid grid-cols-2 gap-3 text-xs'>
            <div className='p-3 bg-slate-50 rounded-xl border border-slate-100'>
              <span className='text-[9px] font-black uppercase tracking-wider text-slate-400 block'>
                Exam Track
              </span>
              <span className='font-bold text-slate-800 mt-1 block'>
                {student.examTrack || 'Not Specified'}
              </span>
            </div>

            <div className='p-3 bg-slate-50 rounded-xl border border-slate-100'>
              <span className='text-[9px] font-black uppercase tracking-wider text-slate-400 block'>
                Learning Mode
              </span>
              <span className='font-bold text-slate-800 mt-1 block'>
                {student.learningMode || 'Not Specified'}
              </span>
            </div>
          </div>

          <div className='flex items-center justify-between gap-2 pt-4 border-t border-slate-100'>
            <button
              type='button'
              onClick={() => onDeleteRequest(student)}
              disabled={isLoading}
              className='flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50'
            >
              <Trash2 size={14} /> Soft Delete
            </button>

            <div className='flex items-center gap-2'>
              {isSuspended ? (
                <button
                  type='button'
                  onClick={() => onStatusChangeRequest(student, 'active')}
                  disabled={isLoading}
                  className='flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-200 disabled:opacity-50'
                >
                  {isLoading ? (
                    <Loader2 size={14} className='animate-spin' />
                  ) : (
                    <UserCheck size={14} />
                  )}{' '}
                  Re-activate
                </button>
              ) : (
                <button
                  type='button'
                  onClick={() => onStatusChangeRequest(student, 'suspended')}
                  disabled={isLoading}
                  className='flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-200 disabled:opacity-50'
                >
                  {isLoading ? (
                    <Loader2 size={14} className='animate-spin' />
                  ) : (
                    <UserX size={14} />
                  )}{' '}
                  Suspend
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal Component: Create Student Modal                              */
/* ------------------------------------------------------------------ */
function CreateStudentModal({
  onClose,
  onSuccess,
  showAlert,
}: {
  onClose: () => void
  onSuccess: () => void
  showAlert: (title: string, message: string, type?: 'info' | 'error') => void
}) {
  const [fullname, setFullname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('TempPass123')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('')
  const [dob, setDob] = useState('')
  const [stateOfResidence, setStateOfResidence] = useState('')
  const [institution, setInstitution] = useState('')
  const [classLevel, setClassLevel] = useState<string>(CLASS_LEVELS[0])
  const [learningMode, setLearningMode] = useState<'online' | 'physical'>(
    'online',
  )
  const [programmes, setProgrammes] = useState<string[]>([])
  const [department, setDepartment] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const toggleProgramme = (p: string) =>
    setProgrammes((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullname.trim() || !email.trim() || !password.trim()) {
      showAlert('Missing Fields', 'Full name, email and password are required.', 'error')
      return
    }
    if (!gender || !dob || !stateOfResidence.trim() || !institution.trim()) {
      showAlert(
        'Missing Fields',
        'Gender, date of birth, state and institution are required.',
        'error',
      )
      return
    }
    if (programmes.length === 0) {
      showAlert('Missing Fields', 'Select at least one programme.', 'error')
      return
    }
    if (!guardianName.trim() || !guardianPhone.trim()) {
      showAlert(
        'Missing Fields',
        "Guardian name and phone number are required.",
        'error',
      )
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        fullname: fullname.trim(),
        email: email.trim().toLowerCase(),
        password,
        phoneNumber: phone.trim() || undefined,
        gender,
        dateOfBirth: dob,
        stateOfResidence: stateOfResidence.trim(),
        institution: institution.trim(),
        currentLevel: classLevel,
        learningMode,
        programmes,
        department: department || undefined,
        guardianInfo: {
          fullname: guardianName.trim(),
          phoneNumber: guardianPhone.trim(),
        },
      }

      const res = await adminApi.createStudent(payload)

      if (res?.success) {
        showAlert(
          'Success',
          `Student account created on Free access. Share the login with ${email}.`,
        )
        onSuccess()
        onClose()
      } else {
        throw new Error(res?.message || 'Failed to create student account')
      }
    } catch (err: unknown) {
      showAlert(
        'Creation Failed',
        err instanceof Error ? err.message : 'Failed to create student',
        'error',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50'>
          <div className='flex items-center gap-2.5'>
            <div className='h-8 w-8 rounded-xl bg-[#002EFF] text-white flex items-center justify-center shadow-md shadow-blue-200'>
              <GraduationCap size={16} />
            </div>
            <div>
              <h3 className='text-xs font-black text-slate-900 uppercase tracking-wider'>
                Add New Student
              </h3>
              <p className='text-[9px] font-bold text-slate-400'>
                Creates an active student on Free access
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

        <form
          onSubmit={handleSubmit}
          className='p-6 space-y-4 max-h-[75vh] overflow-y-auto'
        >
          <div className='space-y-1'>
            <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
              Full Name <span className='text-rose-500'>*</span>
            </label>
            <input
              type='text'
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              placeholder='e.g. John Doe'
              className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
            />
          </div>

          <div className='space-y-1'>
            <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
              Email Address <span className='text-rose-500'>*</span>
            </label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='e.g. student@dsa.com'
              className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
            />
          </div>

          <div className='space-y-1'>
            <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
              Temporary Password <span className='text-rose-500'>*</span>
            </label>
            <input
              type='text'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
            />
          </div>

          <div className='space-y-1'>
            <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
              Phone Number
            </label>
            <input
              type='tel'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder='080…'
              className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
                Gender <span className='text-rose-500'>*</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
              >
                <option value=''>Select…</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className='space-y-1'>
              <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
                Date of Birth <span className='text-rose-500'>*</span>
              </label>
              <input
                type='date'
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
                State <span className='text-rose-500'>*</span>
              </label>
              <select
                value={stateOfResidence}
                onChange={(e) => setStateOfResidence(e.target.value)}
                className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
              >
                <option value=''>Select…</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className='space-y-1'>
              <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
                Institution <span className='text-rose-500'>*</span>
              </label>
              <input
                type='text'
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder='e.g. Test College'
                className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
                Class / Level
              </label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
              >
                {CLASS_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className='space-y-1'>
              <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
                Learning Mode
              </label>
              <select
                value={learningMode}
                onChange={(e) =>
                  setLearningMode(e.target.value as 'online' | 'physical')
                }
                className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
              >
                <option value='online'>Online</option>
                <option value='physical'>Physical Class</option>
              </select>
            </div>
          </div>

          <div className='space-y-1.5'>
            <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
              Programmes <span className='text-rose-500'>*</span>
            </label>
            <div className='flex flex-wrap gap-1.5'>
              {PROGRAMMES.map((p) => {
                const on = programmes.includes(p)
                return (
                  <button
                    key={p}
                    type='button'
                    onClick={() => toggleProgramme(p)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      on
                        ? 'bg-[#002EFF] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>

          <div className='space-y-1'>
            <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
              Department{' '}
              <span className='text-slate-300 normal-case'>
                (Science / Art / Commercial — optional)
              </span>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
            >
              <option value=''>Auto (from programmes)</option>
              <option value='science'>Science</option>
              <option value='art'>Art</option>
              <option value='commercial'>Commercial</option>
            </select>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
                Guardian Name <span className='text-rose-500'>*</span>
              </label>
              <input
                type='text'
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder='Parent / guardian'
                className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
              />
            </div>

            <div className='space-y-1'>
              <label className='text-[9px] font-black uppercase tracking-widest text-slate-400 block'>
                Guardian Phone <span className='text-rose-500'>*</span>
              </label>
              <input
                type='tel'
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder='080…'
                className='w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002EFF] focus:bg-white outline-none text-xs font-bold text-slate-800 transition-all'
              />
            </div>
          </div>

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
                'Create Student'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal Component: Standard Alert Dialog                             */
/* ------------------------------------------------------------------ */
function AlertModal({
  title,
  message,
  type,
  onClose,
}: {
  title: string
  message: string
  type: 'info' | 'error'
  onClose: () => void
}) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 text-center'>
        <div className='flex justify-center'>
          {type === 'error' ? (
            <div className='h-12 w-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center'>
              <AlertCircle size={24} />
            </div>
          ) : (
            <div className='h-12 w-12 rounded-2xl bg-blue-50 text-[#002EFF] flex items-center justify-center'>
              <CheckCircle2 size={24} />
            </div>
          )}
        </div>

        <div className='space-y-1'>
          <h3 className='text-sm font-black text-slate-900'>{title}</h3>
          <p className='text-xs font-bold text-slate-500 leading-relaxed'>
            {message}
          </p>
        </div>

        <div className='flex items-center justify-center gap-2 pt-2'>
          <button
            onClick={onClose}
            className='w-full h-10 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all'
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}