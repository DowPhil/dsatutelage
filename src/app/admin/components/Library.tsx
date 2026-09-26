// // src/app/admin/components/Library.tsx
// 'use client'

// import React, { useState, useEffect, useMemo, useRef } from 'react'
// import { motion, AnimatePresence } from 'framer-motion'
// import {
//   FileText,
//   Search,
//   Trash2,
//   Plus,
//   FolderOpen,
//   HardDrive,
//   CheckCircle2,
//   ShieldCheck,
//   Square,
//   Activity,
//   UploadCloud,
//   Loader2,
//   ExternalLink,
//   AlertCircle,
//   Inbox,
//   X,
//   AlertTriangle,
//   RefreshCw,
//   XCircle,
// } from 'lucide-react'
// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { Badge } from '@/components/ui/badge'

// import {
//   fetchLibraryMaterials,
//   deleteLibraryMaterial,
//   signUploadUrl,
//   createLibraryMaterial,
// } from '@/lib/admin-api'

// export interface Material {
//   id: string
//   title: string
//   category: string
//   size: string | number
//   uploadDate?: string
//   createdAt?: string
//   type?: string
//   fileUrl?: string
//   key?: string
// }

// interface ToastNotification {
//   id: string
//   type: 'success' | 'error' | 'info'
//   message: string
// }

// interface LibraryProps {
//   courseId?: string
// }

// const CATEGORIES = [
//   'Textbook',
//   'Handout',
//   'Syllabus',
//   'Reference',
//   'Exam Paper',
// ]

// function unwrapApiResponse<T>(res: any): T {
//   if (res && typeof res === 'object') {
//     if ('data' in res) return res.data as T
//     if ('materials' in res) return res.materials as T
//   }
//   return res as T
// }

// export default function Library({ courseId = '' }: LibraryProps) {
//   const [materials, setMaterials] = useState<Material[]>([])
//   const [isLoading, setIsLoading] = useState(true)
//   const [isSyncing, setIsSyncing] = useState(false)
//   const [fetchError, setFetchError] = useState<string | null>(null)

//   const [searchTerm, setSearchTerm] = useState('')
//   const [selectedCategory, setSelectedCategory] = useState('All')

//   // Ingest state
//   const [isUploadingModalOpen, setIsUploadingModalOpen] = useState(false)
//   const [isIngesting, setIsIngesting] = useState(false)
//   const [errorMsg, setErrorMsg] = useState<string | null>(null)
//   const [pendingFile, setPendingFile] = useState<File | null>(null)
//   const [ingestCategory, setIngestCategory] = useState(CATEGORIES[0])

//   // Delete modal state
//   const [deleteTarget, setDeleteTarget] = useState<Material | null>(null)
//   const [isDeleting, setIsDeleting] = useState(false)

//   // Toast state
//   const [toasts, setToasts] = useState<ToastNotification[]>([])

//   const fileInputRef = useRef<HTMLInputElement>(null)
//   const modalFileInputRef = useRef<HTMLInputElement>(null)

//   const addToast = (type: 'success' | 'error' | 'info', message: string) => {
//     const id = Math.random().toString(36).substring(2, 9)
//     setToasts((prev) => [...prev, { id, type, message }])
//     setTimeout(() => {
//       setToasts((prev) => prev.filter((t) => t.id !== id))
//     }, 4000)
//   }

//   const removeToast = (id: string) => {
//     setToasts((prev) => prev.filter((t) => t.id !== id))
//   }

//   // Load materials
//   const loadMaterials = async (isManualSync = false) => {
//     if (isManualSync) setIsSyncing(true)
//     else setIsLoading(true)

//     setFetchError(null)
//     try {
//       const response = await fetchLibraryMaterials(courseId)
//       const items = unwrapApiResponse<Material[]>(response)

//       if (Array.isArray(items)) {
//         setMaterials(items)
//         if (isManualSync) addToast('success', 'Library synchronized with backend.')
//       } else {
//         setMaterials([])
//       }
//     } catch (err: any) {
//       console.error('Failed to load materials:', err)
//       const msg = err?.response?.data?.message || err?.message || 'Failed to connect to backend.'
//       setFetchError(msg)
//       addToast('error', msg)
//     } finally {
//       setIsLoading(false)
//       setIsSyncing(false)
//     }
//   }

//   useEffect(() => {
//     loadMaterials()
//   }, [courseId])

//   const processFileSelection = (file: File) => {
//     if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
//       setErrorMsg('Only PDF documents are supported for ingestion.')
//       addToast('error', 'Invalid file type. Select a PDF.')
//       return
//     }

//     if (file.size > 50 * 1024 * 1024) {
//       setErrorMsg('File size exceeds maximum limit of 50 MB.')
//       addToast('error', 'File size over 50MB limit.')
//       return
//     }

//     setPendingFile(file)
//     setErrorMsg(null)
//     setIsUploadingModalOpen(true)
//   }

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files?.[0]) {
//       processFileSelection(e.target.files[0])
//     }
//   }

//   const finalizeIngest = async () => {
//     if (!pendingFile) return

//     setIsIngesting(true)
//     setErrorMsg(null)

//     try {
//       // Step A: Sign URL
//       const signResult = await signUploadUrl({
//         filename: pendingFile.name,
//         contentType: pendingFile.type || 'application/pdf',
//         folder: 'materials',
//       })

//       const signData = unwrapApiResponse<{
//         uploadUrl: string | null
//         fileUrl: string
//         key: string
//       }>(signResult)

//       const { uploadUrl, fileUrl, key } = signData || {}

//       if (!fileUrl) throw new Error('Presigned URL generation failed.')

//       // Step B: Direct storage upload
//       if (uploadUrl) {
//         const uploadRes = await fetch(uploadUrl, {
//           method: 'PUT',
//           headers: { 'Content-Type': pendingFile.type || 'application/pdf' },
//           body: pendingFile,
//         })

//         if (!uploadRes.ok) throw new Error('Failed to push file bytes to storage bucket.')
//       }

//       // Step C: Persist Record
//       const sizeFormatted = `${(pendingFile.size / (1024 * 1024)).toFixed(1)} MB`
//       const payload = {
//         title: pendingFile.name.replace(/\.[^/.]+$/, ''),
//         category: ingestCategory,
//         size: sizeFormatted,
//         type: 'PDF',
//         fileUrl: fileUrl,
//         key: key,
//       }

//       const createdNodeResponse = await createLibraryMaterial(courseId, payload)
//       const freshMaterial = unwrapApiResponse<Material>(createdNodeResponse)

//       setMaterials((prev) => [freshMaterial || (payload as Material), ...prev])
//       setIsUploadingModalOpen(false)
//       setPendingFile(null)
//       if (fileInputRef.current) fileInputRef.current.value = ''
//       if (modalFileInputRef.current) modalFileInputRef.current.value = ''

//       addToast('success', 'Asset successfully ingested into library.')
//     } catch (err: any) {
//       console.error('Ingest Error:', err)
//       const msg = err?.message || 'Failed to complete ingestion.'
//       setErrorMsg(msg)
//       addToast('error', msg)
//     } finally {
//       setIsIngesting(false)
//     }
//   }

//   const confirmDelete = async () => {
//     if (!deleteTarget) return
//     setIsDeleting(true)

//     try {
//       await deleteLibraryMaterial(deleteTarget.id)
//       setMaterials((prev) => prev.filter((m) => m.id !== deleteTarget.id))
//       addToast('info', `Removed asset: ${deleteTarget.title}`)
//       setDeleteTarget(null)
//     } catch (err: any) {
//       console.error('Delete Error:', err)
//       addToast('error', err?.message || 'Failed to delete asset.')
//     } finally {
//       setIsDeleting(false)
//     }
//   }

//   const stats = useMemo(() => {
//     const totalMB = materials.reduce((acc, curr) => {
//       const parsedSize = typeof curr.size === 'number' ? curr.size : parseFloat(curr.size || '0')
//       return acc + (isNaN(parsedSize) ? 0 : parsedSize)
//     }, 0)

//     const limitGB = 2
//     const currentGB = totalMB / 1024
//     return {
//       size: totalMB >= 1000 ? `${currentGB.toFixed(2)} GB` : `${totalMB.toFixed(2)} MB`,
//       count: materials.length,
//       percent: Math.min((currentGB / limitGB) * 100, 100).toFixed(1),
//     }
//   }, [materials])

//   const filteredMaterials = useMemo(() => {
//     return materials.filter((file) => {
//       const title = file.title || ''
//       const id = file.id || ''
//       const matchesSearch =
//         title.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         id.toLowerCase().includes(searchTerm.toLowerCase())
//       const matchesCategory = selectedCategory === 'All' || file.category === selectedCategory
//       return matchesSearch && matchesCategory
//     })
//   }, [searchTerm, selectedCategory, materials])

//   return (
//     <div className='flex h-screen w-full overflow-hidden bg-[#F8FAFC] font-sans text-slate-900 antialiased selection:bg-[#FCB900]/30 relative'>
//       {/* SIDEBAR */}
//       <aside className='w-[230px] bg-white border-r border-slate-200 flex flex-col shrink-0'>
//         <div className='p-4'>
//           <div className='flex items-center gap-2 mb-4'>
//             <div className='w-5 h-5 bg-[#002EFF] rounded flex items-center justify-center text-white font-bold text-[10px] shadow-sm'>
//               L
//             </div>
//             <h1 className='text-sm font-black tracking-tight uppercase'>
//               Library<span className='text-[#002EFF]'>Pro</span>
//             </h1>
//           </div>

//           <div className='bg-slate-950 rounded-xl p-3 text-white relative overflow-hidden border border-white/5 shadow-xl mb-6'>
//             <div className='relative z-10'>
//               <div className='flex items-center justify-between mb-2'>
//                 <div className='flex items-center gap-1.5'>
//                   <HardDrive size={10} className='text-[#FCB900]' />
//                   <span className='text-[7px] font-black uppercase tracking-[0.1em] text-slate-400'>
//                     Vault Capacity
//                   </span>
//                 </div>
//                 <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]' />
//               </div>

//               <div className='flex justify-between items-baseline mb-1'>
//                 <span className='text-[11px] font-black tracking-tighter italic'>
//                   {stats.size}
//                 </span>
//                 <span className='text-[8px] text-[#FCB900] font-black'>
//                   {stats.percent}%
//                 </span>
//               </div>

//               <div className='h-1 w-full bg-white/10 rounded-full overflow-hidden'>
//                 <motion.div
//                   initial={{ width: 0 }}
//                   animate={{ width: `${stats.percent}%` }}
//                   className='h-full bg-gradient-to-r from-[#002EFF] to-[#FCB900]'
//                 />
//               </div>
//             </div>
//           </div>

//           <nav className='space-y-0.5'>
//             <p className='px-2 py-2 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]'>
//               Data Segments
//             </p>
//             {['All', ...CATEGORIES].map((cat) => (
//               <button
//                 key={cat}
//                 onClick={() => setSelectedCategory(cat)}
//                 className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all group ${
//                   selectedCategory === cat
//                     ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
//                     : 'text-slate-500 hover:bg-slate-50'
//                 }`}
//               >
//                 <div className='flex items-center gap-2'>
//                   <FolderOpen
//                     size={12}
//                     className={
//                       selectedCategory === cat
//                         ? 'text-[#FCB900]'
//                         : 'text-slate-300 group-hover:text-slate-500'
//                     }
//                   />
//                   {cat}
//                 </div>
//               </button>
//             ))}
//           </nav>
//         </div>
//       </aside>

//       {/* MAIN VIEWPORT */}
//       <main className='flex-1 flex flex-col min-w-0'>
//         <header className='h-12 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0'>
//           <div className='relative w-full max-w-xs'>
//             <Search
//               className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300'
//               size={12}
//             />
//             <Input
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               placeholder='Filter master manifest...'
//               className='pl-8 bg-slate-50 border-none rounded-md h-7 text-[10px] focus-visible:ring-1 focus-visible:ring-[#002EFF]/20'
//             />
//           </div>

//           <div className='flex items-center gap-2'>
//             <Button
//               variant='ghost'
//               disabled={isSyncing || isLoading}
//               onClick={() => loadMaterials(true)}
//               className='h-7 rounded-md text-slate-500 text-[9px] font-black px-2 hover:bg-slate-100 uppercase'
//             >
//               <RefreshCw size={11} className={`mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
//               Sync
//             </Button>
//             <Button
//               onClick={() => fileInputRef.current?.click()}
//               className='h-7 rounded-md bg-[#002EFF] hover:bg-blue-700 text-white text-[9px] font-black px-3 shadow-md uppercase tracking-wider'
//             >
//               <Plus size={12} className='mr-1' /> Ingest PDF
//             </Button>
//           </div>
//         </header>

//         <div className='flex-1 overflow-y-auto p-6 bg-[#F8FAFC]'>
//           <div className='max-w-4xl mx-auto space-y-4'>
//             <div className='grid grid-cols-3 gap-3'>
//               <CompactStat label='Index Count' value={stats.count} icon={ShieldCheck} />
//               <CompactStat label='Latency' value='2ms' icon={Activity} />
//               <CompactStat
//                 label='Integrity'
//                 value='Verified'
//                 icon={CheckCircle2}
//                 color='text-emerald-600'
//               />
//             </div>

//             <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
//               <div className='px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between'>
//                 <span className='text-[8px] font-black text-slate-400 uppercase tracking-widest'>
//                   Master Manifest
//                 </span>
//                 <Badge className='bg-[#FCB900] text-black text-[8px] hover:bg-[#FCB900] border-none font-black'>
//                   {filteredMaterials.length} NODES
//                 </Badge>
//               </div>

//               {isLoading ? (
//                 <div className='p-12 flex flex-col items-center justify-center text-slate-400 gap-2'>
//                   <Loader2 size={24} className='animate-spin text-[#002EFF]' />
//                   <span className='text-[10px] font-bold tracking-wider uppercase'>
//                     Fetching live index from server...
//                   </span>
//                 </div>
//               ) : fetchError ? (
//                 <div className='p-8 text-center space-y-3'>
//                   <p className='text-xs font-bold text-rose-500'>{fetchError}</p>
//                   <Button
//                     onClick={() => loadMaterials()}
//                     className='h-7 bg-slate-900 text-white text-[9px] font-bold uppercase'
//                   >
//                     Retry Connection
//                   </Button>
//                 </div>
//               ) : filteredMaterials.length === 0 ? (
//                 <div className='p-12 flex flex-col items-center justify-center text-slate-300 gap-2'>
//                   <Inbox size={32} strokeWidth={1.5} />
//                   <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>
//                     No material assets found
//                   </p>
//                 </div>
//               ) : (
//                 <div className='overflow-x-auto'>
//                   <table className='w-full text-left border-collapse'>
//                     <thead>
//                       <tr className='bg-white border-b border-slate-50'>
//                         <th className='p-3 w-10'>
//                           <button className='flex justify-center w-full'>
//                             <Square size={13} className='text-slate-200' />
//                           </button>
//                         </th>
//                         <th className='text-[8px] font-black text-slate-400 uppercase tracking-widest p-3'>
//                           Resource Asset
//                         </th>
//                         <th className='text-[8px] font-black text-slate-400 uppercase tracking-widest p-3'>
//                           Classification
//                         </th>
//                         <th className='text-[8px] font-black text-slate-400 uppercase tracking-widest p-3'>
//                           Size
//                         </th>
//                         <th className='text-[8px] font-black text-slate-400 uppercase tracking-widest p-3 text-right pr-6'>
//                           Ops
//                         </th>
//                       </tr>
//                     </thead>
//                     <tbody className='divide-y divide-slate-50'>
//                       <AnimatePresence initial={false}>
//                         {filteredMaterials.map((file) => (
//                           <motion.tr
//                             key={file.id}
//                             initial={{ opacity: 0, x: -10 }}
//                             animate={{ opacity: 1, x: 0 }}
//                             exit={{ opacity: 0, x: 10 }}
//                             className='group hover:bg-slate-50/50 transition-colors'
//                           >
//                             <td className='p-3 text-center'>
//                               <Square
//                                 size={13}
//                                 className='text-slate-100 group-hover:text-slate-200 mx-auto'
//                               />
//                             </td>
//                             <td className='p-3'>
//                               <div className='flex items-center gap-2.5'>
//                                 <div className='w-6 h-6 bg-slate-50 rounded flex items-center justify-center text-slate-400 group-hover:text-[#002EFF] border border-slate-100'>
//                                   <FileText size={11} />
//                                 </div>
//                                 <div>
//                                   <p className='text-[10px] font-bold text-slate-800 leading-tight'>
//                                     {file.title}
//                                   </p>
//                                   <p className='text-[7px] font-black text-slate-300 uppercase'>
//                                     UID: {file.id}
//                                   </p>
//                                 </div>
//                               </div>
//                             </td>
//                             <td className='p-3'>
//                               <span className='text-[8px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm uppercase'>
//                                 {file.category}
//                               </span>
//                             </td>
//                             <td className='p-3 font-mono text-[9px] font-bold text-slate-400'>
//                               {file.size}
//                             </td>
//                             <td className='p-3 text-right pr-6'>
//                               <div className='flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
//                                 {file.fileUrl && (
//                                   <a
//                                     href={file.fileUrl}
//                                     target='_blank'
//                                     rel='noreferrer'
//                                     className='p-1 text-slate-300 hover:text-blue-600 rounded'
//                                   >
//                                     <ExternalLink size={11} />
//                                   </a>
//                                 )}
//                                 <Button
//                                   variant='ghost'
//                                   size='icon'
//                                   onClick={() => setDeleteTarget(file)}
//                                   className='h-6 w-6 text-slate-300 hover:text-rose-500'
//                                 >
//                                   <Trash2 size={11} />
//                                 </Button>
//                               </div>
//                             </td>
//                           </motion.tr>
//                         ))}
//                       </AnimatePresence>
//                     </tbody>
//                   </table>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </main>

//       {/* INGEST MODAL */}
//       <AnimatePresence>
//         {isUploadingModalOpen && (
//           <div className='fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4'>
//             <motion.div
//               initial={{ scale: 0.95, opacity: 0 }}
//               animate={{ scale: 1, opacity: 1 }}
//               exit={{ scale: 0.95, opacity: 0 }}
//               className='bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 relative'
//             >
//               <div className='p-1 bg-[#FCB900]' />
//               <div className='p-6'>
//                 <div className='flex items-center justify-between mb-4'>
//                   <div className='flex items-center gap-3'>
//                     <div className='w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#002EFF]'>
//                       <UploadCloud size={20} />
//                     </div>
//                     <div>
//                       <h3 className='text-sm font-black uppercase tracking-tight'>
//                         Classify & Ingest
//                       </h3>
//                       <p className='text-[10px] text-slate-400 font-bold truncate max-w-[180px]'>
//                         {pendingFile ? pendingFile.name : 'No file loaded'}
//                       </p>
//                     </div>
//                   </div>
//                   <button
//                     disabled={isIngesting}
//                     onClick={() => setIsUploadingModalOpen(false)}
//                     className='text-slate-400 hover:text-slate-600 p-1 rounded-lg'
//                   >
//                     <X size={16} />
//                   </button>
//                 </div>

//                 {/* DROP ZONE */}
//                 <div
//                   onClick={() => modalFileInputRef.current?.click()}
//                   className='border-2 border-dashed border-slate-200 hover:border-[#002EFF] bg-slate-50/50 rounded-xl p-4 mb-4 text-center cursor-pointer transition-colors'
//                 >
//                   <FileText size={20} className='mx-auto text-slate-400 mb-1' />
//                   <p className='text-[10px] font-bold text-slate-600'>
//                     {pendingFile ? pendingFile.name : 'Click to select a file'}
//                   </p>
//                   <p className='text-[8px] font-bold text-slate-400 uppercase mt-0.5'>
//                     PDF files only, max 50MB
//                   </p>
//                   <input
//                     type='file'
//                     ref={modalFileInputRef}
//                     accept='.pdf'
//                     onChange={(e) => {
//                       if (e.target.files?.[0]) processFileSelection(e.target.files[0])
//                     }}
//                     className='hidden'
//                   />
//                 </div>

//                 {errorMsg && (
//                   <div className='mb-4 p-2.5 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2 text-rose-600 text-[10px] font-bold'>
//                     <AlertCircle size={14} className='shrink-0' />
//                     <span>{errorMsg}</span>
//                   </div>
//                 )}

//                 <div className='space-y-4'>
//                   <div className='space-y-1.5'>
//                     <label className='text-[8px] font-black text-slate-400 uppercase tracking-widest'>
//                       Select Category
//                     </label>
//                     <div className='grid grid-cols-2 gap-2'>
//                       {CATEGORIES.map((cat) => (
//                         <button
//                           key={cat}
//                           disabled={isIngesting}
//                           onClick={() => setIngestCategory(cat)}
//                           className={`px-3 py-2 rounded-lg text-[9px] font-black text-left transition-all border ${
//                             ingestCategory === cat
//                               ? 'bg-slate-900 text-white border-slate-900 shadow-md'
//                               : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300'
//                           }`}
//                         >
//                           {cat}
//                         </button>
//                       ))}
//                     </div>
//                   </div>

//                   <div className='flex gap-2 pt-2'>
//                     <Button
//                       variant='ghost'
//                       disabled={isIngesting}
//                       onClick={() => setIsUploadingModalOpen(false)}
//                       className='flex-1 h-9 text-[10px] font-black uppercase tracking-widest'
//                     >
//                       Cancel
//                     </Button>
//                     <Button
//                       onClick={finalizeIngest}
//                       disabled={isIngesting || !pendingFile}
//                       className='flex-1 h-9 bg-[#002EFF] hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center justify-center gap-1.5'
//                     >
//                       {isIngesting ? (
//                         <>
//                           <Loader2 size={12} className='animate-spin' />
//                           Uploading...
//                         </>
//                       ) : (
//                         'Confirm Ingest'
//                       )}
//                     </Button>
//                   </div>
//                 </div>
//               </div>
//             </motion.div>
//           </div>
//         )}
//       </AnimatePresence>

//       {/* DELETE MODAL */}
//       <AnimatePresence>
//         {deleteTarget && (
//           <div className='fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4'>
//             <motion.div
//               initial={{ scale: 0.95, opacity: 0 }}
//               animate={{ scale: 1, opacity: 1 }}
//               exit={{ scale: 0.95, opacity: 0 }}
//               className='bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200'
//             >
//               <div className='p-6 text-center space-y-4'>
//                 <div className='w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100'>
//                   <AlertTriangle size={20} />
//                 </div>
//                 <div>
//                   <h3 className='text-sm font-black uppercase tracking-tight text-slate-900'>
//                     Delete Resource Node?
//                   </h3>
//                   <p className='text-[10px] text-slate-500 font-bold mt-1 max-w-[240px] mx-auto'>
//                     Are you sure you want to remove <span className='text-slate-900 font-black'>"{deleteTarget.title}"</span>? This action cannot be undone.
//                   </p>
//                 </div>

//                 <div className='flex gap-2 pt-2'>
//                   <Button
//                     variant='ghost'
//                     disabled={isDeleting}
//                     onClick={() => setDeleteTarget(null)}
//                     className='flex-1 h-9 text-[10px] font-black uppercase tracking-widest'
//                   >
//                     Cancel
//                   </Button>
//                   <Button
//                     onClick={confirmDelete}
//                     disabled={isDeleting}
//                     className='flex-1 h-9 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 flex items-center justify-center gap-1.5'
//                   >
//                     {isDeleting ? (
//                       <Loader2 size={12} className='animate-spin' />
//                     ) : (
//                       'Delete'
//                     )}
//                   </Button>
//                 </div>
//               </div>
//             </motion.div>
//           </div>
//         )}
//       </AnimatePresence>

//       {/* TOAST SYSTEM */}
//       <div className='fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none'>
//         <AnimatePresence>
//           {toasts.map((toast) => (
//             <motion.div
//               key={toast.id}
//               initial={{ opacity: 0, y: 20, scale: 0.9 }}
//               animate={{ opacity: 1, y: 0, scale: 1 }}
//               exit={{ opacity: 0, y: -20, scale: 0.9 }}
//               className={`pointer-events-auto p-3 rounded-xl shadow-xl border flex items-center gap-2.5 max-w-xs text-[10px] font-bold ${
//                 toast.type === 'success'
//                   ? 'bg-slate-900 text-white border-slate-800'
//                   : toast.type === 'error'
//                   ? 'bg-rose-950 text-rose-100 border-rose-900'
//                   : 'bg-white text-slate-900 border-slate-200'
//               }`}
//             >
//               {toast.type === 'success' && <CheckCircle2 size={14} className='text-emerald-400 shrink-0' />}
//               {toast.type === 'error' && <XCircle size={14} className='text-rose-400 shrink-0' />}
//               {toast.type === 'info' && <AlertCircle size={14} className='text-blue-500 shrink-0' />}
//               <span className='flex-1 leading-tight'>{toast.message}</span>
//               <button
//                 onClick={() => removeToast(toast.id)}
//                 className='opacity-60 hover:opacity-100 p-0.5'
//               >
//                 <X size={12} />
//               </button>
//             </motion.div>
//           ))}
//         </AnimatePresence>
//       </div>

//       <input
//         type='file'
//         ref={fileInputRef}
//         onChange={handleFileChange}
//         accept='.pdf'
//         className='hidden'
//       />
//     </div>
//   )
// }

// function CompactStat({
//   label,
//   value,
//   icon: Icon,
//   color = 'text-slate-900',
// }: {
//   label: string
//   value: string | number
//   icon: React.ElementType
//   color?: string
// }) {
//   return (
//     <div className='bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm'>
//       <div className='w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-[#002EFF]'>
//         <Icon size={14} />
//       </div>
//       <div>
//         <p className='text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5'>
//           {label}
//         </p>
//         <p className={`text-xs font-black ${color} tracking-tight leading-none`}>
//           {value}
//         </p>
//       </div>
//     </div>
//   )
// }

'use client'

import React, {
  useState,
  useEffect,
  useMemo,
  ChangeEvent,
  FormEvent,
} from 'react'
import {
  BookOpen,
  Plus,
  Search,
  FileText,
  Video,
  ExternalLink,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Clock,
  HardDrive,
  Filter,
} from 'lucide-react'
import {
  adminApi,
  Course,
  CourseMaterial,
  CreateMaterialPayload,
} from '@/lib/admin-api'
import { uploadToCloudinary, cloudinaryConfigured } from '@/lib/cloudinary'

// Accepts an optional `courseId` because LibraryCourseWrapper passes one; it is
// not consumed yet (course-scoped library still to be wired). Added to unbreak
// the build after the export was renamed to LibraryPage(). — flagged to owner.
export default function LibraryPage(_props?: { courseId?: string }) {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [materials, setMaterials] = useState<CourseMaterial[]>([])

  const [loadingCourses, setLoadingCourses] = useState<boolean>(true)
  const [loadingMaterials, setLoadingMaterials] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [uploadingFile, setUploadingFile] = useState<boolean>(false)

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('all')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  // Form State
  const [formData, setFormData] = useState<{
    title: string
    type: 'pdf' | 'video' | 'link'
    url: string
    description: string
    isDownloadable: boolean
    fileSizeBytes?: number
    durationSeconds?: number
  }>({
    title: '',
    type: 'pdf',
    url: '',
    description: '',
    isDownloadable: true,
  })

  const [fileToUpload, setFileToUpload] = useState<File | null>(null)

  // ==========================================
  // DATA FETCHING
  // ==========================================

  // 1. Fetch available courses on mount
  useEffect(() => {
    async function loadCourses() {
      try {
        setLoadingCourses(true)
        setError(null)
        const response = await adminApi.getCourses()
        if (response.success && response.data) {
          setCourses(response.data)
          if (response.data.length > 0) {
            setSelectedCourseId(response.data[0].id)
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load courses.')
      } finally {
        setLoadingCourses(false)
      }
    }
    loadCourses()
  }, [])

  // 2. Fetch materials whenever selectedCourseId changes
  useEffect(() => {
    if (!selectedCourseId) return

    async function loadMaterials() {
      try {
        setLoadingMaterials(true)
        setError(null)
        const response = await adminApi.getCourseMaterials(selectedCourseId)
        if (response.success && response.data) {
          setMaterials(response.data)
        } else {
          setMaterials([])
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load library materials.')
      } finally {
        setLoadingMaterials(false)
      }
    }

    loadMaterials()
  }, [selectedCourseId])

  // ==========================================
  // FILE UPLOAD HANDLER
  // ==========================================
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingFile(true)
      setError(null)
      setFileToUpload(file)

      // The browser uploads straight to Cloudinary (the backend has no object
      // storage) and we keep the hosted URL — same path used for avatars and
      // payment receipts. Handles PDFs, video and images.
      if (!cloudinaryConfigured()) {
        throw new Error('File upload is not configured. Paste a hosted link in the URL field instead.')
      }
      const uploaded = await uploadToCloudinary(file, 'materials')

      // Automatically update form fields based on the uploaded file.
      setFormData((prev) => ({
        ...prev,
        url: uploaded.url,
        fileSizeBytes: uploaded.bytes ?? file.size,
        title: prev.title ? prev.title : file.name.replace(/\.[^/.]+$/, ''),
      }))

      setSuccess('File uploaded. Finalize the form below.')
    } catch (err: any) {
      setError(err.message || 'An error occurred while uploading file.')
    } finally {
      setUploadingFile(false)
    }
  }

  // ==========================================
  // FORM SUBMISSION
  // ==========================================
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedCourseId) {
      setError('Please select a course to attach this material to.')
      return
    }
    if (!formData.title || !formData.url) {
      setError('Title and resource URL/File are required.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const payload: CreateMaterialPayload = {
        title: formData.title,
        type: formData.type,
        url: formData.url,
        description: formData.description,
        isDownloadable: formData.isDownloadable,
        fileSizeBytes: formData.fileSizeBytes,
        durationSeconds: formData.durationSeconds,
      }

      const response = await adminApi.createCourseMaterial(
        selectedCourseId,
        payload,
      )

      if (response.success) {
        setSuccess('Material added to course library successfully!')
        setMaterials((prev) => [response.data, ...prev])
        setIsModalOpen(false)
        resetForm()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save resource.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      type: 'pdf',
      url: '',
      description: '',
      isDownloadable: true,
    })
    setFileToUpload(null)
  }

  // ==========================================
  // MEMOIZED COMPUTATIONS
  // ==========================================
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesType =
        filterType === 'all' ||
        item.type.toLowerCase() === filterType.toLowerCase()
      return matchesSearch && matchesType
    })
  }, [materials, searchTerm, filterType])

  const formatBytes = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <div className='min-h-screen bg-slate-50 p-6 md:p-8 space-y-6'>
      {/* Header Banner */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm'>
        <div>
          <div className='flex items-center gap-2'>
            <BookOpen className='w-6 h-6 text-blue-600' />
            <h1 className='text-2xl font-bold text-slate-900'>
              Course Library & Resources
            </h1>
          </div>
          <p className='text-sm text-slate-500 mt-1'>
            Manage, upload, and publish learning materials for academic tracks.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null)
            setSuccess(null)
            setIsModalOpen(true)
          }}
          disabled={!selectedCourseId}
          className='inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-all'
        >
          <Plus className='w-4 h-4' />
          Add Material
        </button>
      </div>

      {/* Action Alerts */}
      {error && (
        <div className='flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm'>
          <AlertCircle className='w-5 h-5 shrink-0' />
          <span>{error}</span>
          <button onClick={() => setError(null)} className='ml-auto'>
            <X className='w-4 h-4' />
          </button>
        </div>
      )}

      {success && (
        <div className='flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm'>
          <CheckCircle2 className='w-5 h-5 shrink-0' />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className='ml-auto'>
            <X className='w-4 h-4' />
          </button>
        </div>
      )}

      {/* Controls & Selector Row */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        {/* Course Select Box */}
        <div className='bg-white p-4 rounded-xl border border-slate-200 shadow-sm'>
          <label className='block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2'>
            Select Course
          </label>
          {loadingCourses ? (
            <div className='flex items-center gap-2 text-sm text-slate-500 py-2'>
              <Loader2 className='w-4 h-4 animate-spin text-blue-600' />
              Loading courses...
            </div>
          ) : (
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className='w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none'
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title} ({course.subject})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Search Input */}
        <div className='bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center'>
          <label className='block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2'>
            Search Files
          </label>
          <div className='relative'>
            <Search className='w-4 h-4 absolute left-3 top-2.5 text-slate-400' />
            <input
              type='text'
              placeholder='Search title or description...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none'
            />
          </div>
        </div>

        {/* Material Type Filter */}
        <div className='bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center'>
          <label className='block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1'>
            <Filter className='w-3.5 h-3.5' /> Filter Type
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className='w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none'
          >
            <option value='all'>All Material Types</option>
            <option value='pdf'>PDF Documents</option>
            <option value='video'>Videos</option>
            <option value='link'>External Links</option>
          </select>
        </div>
      </div>

      {/* Library Material Grid */}
      <div className='space-y-4'>
        {loadingMaterials ? (
          <div className='bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm'>
            <Loader2 className='w-8 h-8 animate-spin text-blue-600 mx-auto mb-3' />
            <p className='text-sm font-medium text-slate-600'>
              Fetching materials for selected course...
            </p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className='bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm'>
            <BookOpen className='w-12 h-12 text-slate-300 mx-auto mb-3' />
            <h3 className='text-lg font-semibold text-slate-800'>
              No materials found
            </h3>
            <p className='text-sm text-slate-500 mt-1 max-w-md mx-auto'>
              There are currently no uploaded resources matching your filters
              for this course.
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {filteredMaterials.map((item) => (
              <div
                key={item.id}
                className='bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between'
              >
                <div>
                  <div className='flex items-start justify-between gap-3 mb-3'>
                    <div className='p-2.5 rounded-xl bg-slate-100 text-slate-700'>
                      {item.type === 'pdf' ? (
                        <FileText className='w-6 h-6 text-red-500' />
                      ) : item.type === 'video' ? (
                        <Video className='w-6 h-6 text-blue-500' />
                      ) : (
                        <ExternalLink className='w-6 h-6 text-emerald-500' />
                      )}
                    </div>
                    <span className='text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600'>
                      {item.type}
                    </span>
                  </div>

                  <h4 className='font-semibold text-slate-900 line-clamp-1'>
                    {item.title}
                  </h4>
                  <p className='text-xs text-slate-500 mt-1 line-clamp-2'>
                    {item.description || 'No description provided.'}
                  </p>
                </div>

                <div className='mt-5 pt-4 border-t border-slate-100 flex items-center justify-between'>
                  <div className='flex items-center gap-3 text-xs text-slate-400'>
                    {item.fileSizeBytes && (
                      <span className='flex items-center gap-1'>
                        <HardDrive className='w-3.5 h-3.5' />
                        {formatBytes(item.fileSizeBytes)}
                      </span>
                    )}
                    {item.durationSeconds && (
                      <span className='flex items-center gap-1'>
                        <Clock className='w-3.5 h-3.5' />
                        {Math.floor(item.durationSeconds / 60)}m
                      </span>
                    )}
                  </div>

                  <a
                    href={item.url}
                    target='_blank'
                    rel='noreferrer'
                    className='inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700'
                  >
                    {item.isDownloadable ? (
                      <>
                        <Download className='w-3.5 h-3.5' /> Download
                      </>
                    ) : (
                      <>
                        <ExternalLink className='w-3.5 h-3.5' /> View
                      </>
                    )}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE MATERIAL MODAL */}
      {isModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm'>
          <div className='bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-5'>
            <div className='flex items-center justify-between border-b border-slate-100 pb-3'>
              <h3 className='text-lg font-bold text-slate-900'>
                Add Course Material
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className='text-slate-400 hover:text-slate-600 p-1'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <form onSubmit={handleSubmit} className='space-y-4'>
              <div>
                <label className='block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1'>
                  Title
                </label>
                <input
                  type='text'
                  required
                  placeholder='e.g. Calculus Fundamentals Chapter 1'
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none'
                />
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1'>
                    Resource Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as 'pdf' | 'video' | 'link',
                      })
                    }
                    className='w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none'
                  >
                    <option value='pdf'>PDF Document</option>
                    <option value='video'>Video Stream</option>
                    <option value='link'>External URL</option>
                  </select>
                </div>

                <div className='flex items-center pt-5'>
                  <label className='flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700'>
                    <input
                      type='checkbox'
                      checked={formData.isDownloadable}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isDownloadable: e.target.checked,
                        })
                      }
                      className='rounded text-blue-600 focus:ring-blue-500 w-4 h-4'
                    />
                    Is Downloadable
                  </label>
                </div>
              </div>

              {/* Direct File Upload integration via S3 Presigned URL */}
              <div className='space-y-2'>
                <label className='block text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                  Upload File
                </label>
                <div className='relative border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors'>
                  <input
                    type='file'
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className='absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed'
                  />
                  <div className='flex flex-col items-center justify-center gap-1.5'>
                    {uploadingFile ? (
                      <Loader2 className='w-6 h-6 animate-spin text-blue-600' />
                    ) : (
                      <UploadCloud className='w-6 h-6 text-slate-400' />
                    )}
                    <p className='text-xs text-slate-600 font-medium'>
                      {uploadingFile
                        ? 'Uploading file to storage...'
                        : fileToUpload
                          ? fileToUpload.name
                          : 'Click or drag file here to upload directly'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1'>
                  Resource URL
                </label>
                <input
                  type='url'
                  required
                  placeholder='https://...'
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none'
                />
              </div>

              <div>
                <label className='block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1'>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder='Brief summary of this resource...'
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none'
                />
              </div>

              <div className='flex justify-end gap-3 pt-3 border-t border-slate-100'>
                <button
                  type='button'
                  onClick={() => setIsModalOpen(false)}
                  className='px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-sm font-semibold hover:bg-slate-50'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={submitting || uploadingFile}
                  className='inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50'
                >
                  {submitting && <Loader2 className='w-4 h-4 animate-spin' />}
                  Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}