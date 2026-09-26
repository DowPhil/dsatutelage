// 'use client'

// import React, { useState, useEffect } from 'react'
// import { useRouter } from 'next/navigation'
// import {
//   Zap,
//   LayoutGrid,
//   CheckCircle2,
//   Share2,
//   BarChart3,
//   User,
//   Trash2,
//   Search,
//   Plus,
//   Clock,
//   FileQuestion,
//   Trophy,
//   EyeOff,
//   Check,
//   Save,
//   X,
//   Settings,
//   ChevronRight,
//   Sparkles,
//   ArrowLeft,
// } from 'lucide-react'
// import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'

// // --- TYPES ---
// interface Question {
//   Question: string
//   Answer: string
//   A: string
//   B: string
//   C: string
//   D: string
//   Explanation?: string
//   image?: string | null
// }

// interface Attempt {
//   studentName: string
//   score: number
//   date: string
//   status: 'Passed' | 'Failed'
// }

// interface Quiz {
//   id: string
//   title: string
//   description: string
//   totalQuestions: number
//   timeLimit: number
//   questions: Question[]
//   url: string
//   createdAt: string
//   attempts: Attempt[]
// }

// export default function MyQuizzes() {
//   const router = useRouter()
//   const [view, setView] = useState<'list' | 'results'>('list')
//   const [quizzes, setQuizzes] = useState<Quiz[]>([])
//   const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
//   const [searchQuery, setSearchQuery] = useState('')
//   const [copiedId, setCopiedId] = useState<string | null>(null)

//   const [isEditingMetadata, setIsEditingMetadata] = useState(false)
//   const [editBuffer, setEditBuffer] = useState<Partial<Quiz>>({})

//   useEffect(() => {
//     const savedQuizzes = localStorage.getItem('my_quizzes')
//     if (savedQuizzes) {
//       try {
//         setQuizzes(JSON.parse(savedQuizzes))
//       } catch (e) {
//         setQuizzes([])
//       }
//     }
//   }, [])

//   const handleCreateNew = () => {
//     localStorage.removeItem('pending_exam_questions')
//     localStorage.removeItem('draft_exam_builder')
//     // router.push('/admin/components/examBuilder') // Updated to page route
//   }

//   const handleUpdateQuiz = () => {
//     if (!selectedQuiz) return
//     const updatedQuizzes = quizzes.map((q) =>
//       q.id === selectedQuiz.id ? { ...q, ...editBuffer } : q,
//     )
//     setQuizzes(updatedQuizzes)
//     localStorage.setItem('my_quizzes', JSON.stringify(updatedQuizzes))
//     setSelectedQuiz({ ...selectedQuiz, ...editBuffer } as Quiz)
//     setIsEditingMetadata(false)
//   }

//   const handleDelete = (id: string) => {
//     if (confirm('Permanently delete this quiz?')) {
//       const updated = quizzes.filter((q) => q.id !== id)
//       setQuizzes(updated)
//       localStorage.setItem('my_quizzes', JSON.stringify(updated))
//       if (selectedQuiz?.id === id) setSelectedQuiz(null)
//     }
//   }

//   const handleShare = (relativeUrl: string, id: string) => {
//     const fullUrl = window.location.origin + (relativeUrl || '')
//     navigator.clipboard.writeText(fullUrl)
//     setCopiedId(id)
//     setTimeout(() => setCopiedId(null), 2000)
//   }

//   const filteredQuizzes = quizzes.filter(
//     (q) =>
//       (q.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
//       (q.id || '').toLowerCase().includes(searchQuery.toLowerCase()),
//   )

//   return (
//     <div className='max-w-[1600px] mx-auto p-4 md:p-10 font-sans text-slate-900 bg-[#F8FAFC] min-h-screen'>
//       {/* HEADER */}
//       <header className='flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6'>
//         <motion.div
//           initial={{ x: -20, opacity: 0 }}
//           animate={{ x: 0, opacity: 1 }}
//         >
//           <div className='flex items-center gap-3 mb-1'>
//             <div className='bg-[#002EFF] p-2 rounded-xl text-white shadow-lg shadow-blue-200'>
//               <Trophy size={20} />
//             </div>
//             <h1 className='text-3xl font-black tracking-tight text-slate-900'>
//               Quiz<span className='text-[#002EFF]'>Vault</span>
//             </h1>
//           </div>
//           <p className='text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] ml-12'>
//             Global Administration <span className='text-blue-200 mx-2'>|</span>{' '}
//             Management Console
//           </p>
//         </motion.div>

//         <motion.button
//           whileHover={{ scale: 1.02 }}
//           whileTap={{ scale: 0.98 }}
//           onClick={handleCreateNew}
//           className='flex items-center gap-3 bg-[#002EFF] hover:bg-blue-700 text-white px-8 py-4 rounded-[22px] font-black uppercase text-[11px] tracking-[0.1em] transition-all shadow-xl shadow-blue-100'
//         >
//           <Plus size={20} strokeWidth={3} /> Create New Quiz
//         </motion.button>
//       </header>

//       <LayoutGroup>
//         <div className='flex flex-col lg:flex-row gap-8 items-start'>
//           {/* LEFT COLUMN: LIST */}
//           <motion.div
//             layout
//             className={`w-full transition-all duration-500 ease-in-out ${selectedQuiz ? 'lg:w-[55%]' : 'lg:w-full'}`}
//           >
//             <div className='mb-8 relative group'>
//               <Search
//                 className='absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#002EFF] transition-colors'
//                 size={20}
//               />
//               <input
//                 type='text'
//                 placeholder='Search assessment vault...'
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className='w-full pl-14 pr-6 py-5 bg-white border-none rounded-[28px] text-sm font-bold shadow-sm focus:shadow-2xl focus:ring-4 focus:ring-blue-50 outline-none transition-all'
//               />
//             </div>

//             {filteredQuizzes.length === 0 ? (
//               <EmptyState onAction={handleCreateNew} />
//             ) : (
//               <div
//                 className={`grid gap-6 ${selectedQuiz ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}
//               >
//                 <AnimatePresence mode='popLayout'>
//                   {filteredQuizzes.map((quiz) => (
//                     <QuizCard
//                       key={quiz.id}
//                       quiz={quiz}
//                       isSelected={selectedQuiz?.id === quiz.id}
//                       onSelect={() => {
//                         setSelectedQuiz(quiz)
//                         setEditBuffer(quiz)
//                         setIsEditingMetadata(false)
//                       }}
//                       onDelete={() => handleDelete(quiz.id)}
//                       onShare={() => handleShare(quiz.url, quiz.id)}
//                       copied={copiedId === quiz.id}
//                     />
//                   ))}
//                 </AnimatePresence>
//               </div>
//             )}
//           </motion.div>

//           {/* RIGHT COLUMN: LIVE PREVIEW */}
//           <AnimatePresence>
//             {selectedQuiz && (
//               <motion.aside
//                 initial={{ opacity: 0, x: 40, scale: 0.95 }}
//                 animate={{ opacity: 1, x: 0, scale: 1 }}
//                 exit={{ opacity: 0, x: 40, scale: 0.95 }}
//                 transition={{ type: 'spring', damping: 20, stiffness: 100 }}
//                 className='w-full lg:w-[45%] lg:sticky lg:top-8'
//               >
//                 <div className='bg-white rounded-[40px] shadow-2xl shadow-blue-100/50 border border-white overflow-hidden flex flex-col max-h-[85vh]'>
//                   {/* PREVIEW HEADER */}
//                   <div className='p-8 bg-slate-900 text-white flex justify-between items-center shrink-0'>
//                     <div className='flex items-center gap-3'>
//                       <div className='bg-blue-500 p-2 rounded-lg'>
//                         <Zap size={18} />
//                       </div>
//                       <div>
//                         <h3 className='font-black uppercase text-xs tracking-widest'>
//                           Live Preview
//                         </h3>
//                         <p className='text-[10px] text-blue-300 font-bold uppercase'>
//                           {selectedQuiz.id}
//                         </p>
//                       </div>
//                     </div>
//                     <button
//                       onClick={() => setSelectedQuiz(null)}
//                       className='hover:bg-white/10 p-2 rounded-full transition-colors'
//                     >
//                       <X size={20} />
//                     </button>
//                   </div>

//                   {/* PREVIEW CONTENT */}
//                   <div className='p-8 space-y-8 overflow-y-auto custom-scrollbar'>
//                     <section className='space-y-4'>
//                       <div className='flex justify-between items-center'>
//                         <h4 className='text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2'>
//                           <Settings size={14} /> Core Configuration
//                         </h4>
//                         <div className='flex gap-3'>
//                           {!isEditingMetadata ? (
//                             <button
//                               onClick={() => setIsEditingMetadata(true)}
//                               className='text-[#002EFF] text-[10px] font-black uppercase hover:underline'
//                             >
//                               Edit Data
//                             </button>
//                           ) : (
//                             <>
//                               <button
//                                 onClick={handleUpdateQuiz}
//                                 className='text-emerald-500 text-[10px] font-black uppercase flex items-center gap-1'
//                               >
//                                 <Save size={12} /> Save
//                               </button>
//                               <button
//                                 onClick={() => setIsEditingMetadata(false)}
//                                 className='text-slate-400 text-[10px] font-black uppercase'
//                               >
//                                 Cancel
//                               </button>
//                             </>
//                           )}
//                         </div>
//                       </div>

//                       <div className='bg-slate-50 p-6 rounded-[24px] space-y-4 border border-slate-100'>
//                         <div className='space-y-1'>
//                           <label className='text-[8px] font-black text-slate-400 uppercase ml-1'>
//                             Quiz Title
//                           </label>
//                           {isEditingMetadata ? (
//                             <input
//                               className='w-full bg-white border-2 border-blue-100 rounded-xl p-3 text-sm font-bold focus:border-[#002EFF] outline-none transition-all'
//                               value={editBuffer.title || ''}
//                               onChange={(e) =>
//                                 setEditBuffer({
//                                   ...editBuffer,
//                                   title: e.target.value,
//                                 })
//                               }
//                             />
//                           ) : (
//                             <p className='text-lg font-black text-slate-800 leading-tight'>
//                               {selectedQuiz.title}
//                             </p>
//                           )}
//                         </div>
//                         <div className='space-y-1'>
//                           <label className='text-[8px] font-black text-slate-400 uppercase ml-1'>
//                             Description
//                           </label>
//                           {isEditingMetadata ? (
//                             <textarea
//                               className='w-full bg-white border-2 border-blue-100 rounded-xl p-3 text-sm font-bold h-24 focus:border-[#002EFF] outline-none transition-all'
//                               value={editBuffer.description || ''}
//                               onChange={(e) =>
//                                 setEditBuffer({
//                                   ...editBuffer,
//                                   description: e.target.value,
//                                 })
//                               }
//                             />
//                           ) : (
//                             <p className='text-xs font-medium text-slate-500 leading-relaxed'>
//                               {selectedQuiz.description}
//                             </p>
//                           )}
//                         </div>
//                       </div>
//                     </section>

//                     {/* QUESTION STACK PREVIEW */}
//                     <section className='space-y-4'>
//                       <h4 className='text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2'>
//                         <FileQuestion size={14} /> Question Stack (
//                         {(selectedQuiz.questions || []).length})
//                       </h4>
//                       <div className='space-y-3'>
//                         {(selectedQuiz.questions || []).map((q, idx) => (
//                           <motion.div
//                             initial={{ opacity: 0, y: 10 }}
//                             animate={{ opacity: 1, y: 0 }}
//                             transition={{ delay: idx * 0.05 }}
//                             key={idx}
//                             className='p-4 bg-white border border-slate-100 rounded-2xl flex gap-4 hover:border-blue-200 transition-colors group/q'
//                           >
//                             <span className='w-8 h-8 rounded-lg bg-blue-50 text-[#002EFF] flex items-center justify-center text-[10px] font-black shrink-0 group-hover/q:bg-[#002EFF] group-hover/q:text-white transition-colors'>
//                               {idx + 1}
//                             </span>
//                             <div className='space-y-2'>
//                               <p className='text-xs font-bold text-slate-700 leading-snug'>
//                                 {q.Question}
//                               </p>
//                               <div className='flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase'>
//                                 <CheckCircle2 size={12} /> Correct: {q.Answer}
//                               </div>
//                             </div>
//                           </motion.div>
//                         ))}
//                       </div>
//                     </section>
//                   </div>

//                   {/* PREVIEW FOOTER */}
//                   <div className='p-6 border-t border-slate-100 bg-white flex gap-3 shrink-0'>
//                     <button
//                       onClick={() => setView('results')}
//                       className='flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95'
//                     >
//                       <BarChart3 size={16} /> Analytics
//                     </button>
//                     <button
//                       onClick={() =>
//                         handleShare(selectedQuiz.url, selectedQuiz.id)
//                       }
//                       className='flex-1 bg-white border-2 border-slate-100 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:border-[#002EFF] hover:text-[#002EFF] transition-all active:scale-95'
//                     >
//                       <Share2 size={16} /> Share
//                     </button>
//                   </div>
//                 </div>
//               </motion.aside>
//             )}
//           </AnimatePresence>
//         </div>
//       </LayoutGroup>

//       {/* --- RESULTS OVERLAY --- */}
//       <AnimatePresence>
//         {view === 'results' && selectedQuiz && (
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: 20 }}
//             className='fixed inset-0 z-50 bg-[#F8FAFC] p-4 md:p-10 overflow-y-auto'
//           >
//             <div className='max-w-6xl mx-auto'>
//               <button
//                 onClick={() => setView('list')}
//                 className='mb-8 flex items-center gap-2 text-slate-400 hover:text-slate-800 text-xs font-black uppercase tracking-widest transition-all'
//               >
//                 <ArrowLeft size={18} /> Back to Dashboard
//               </button>

//               <div className='bg-slate-900 text-white rounded-[40px] p-10 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative overflow-hidden'>
//                 <Sparkles
//                   className='absolute top-[-20px] right-[-20px] text-blue-500/10'
//                   size={300}
//                 />
//                 <div className='relative z-10'>
//                   <p className='text-blue-400 font-black uppercase text-[10px] tracking-[0.4em] mb-3'>
//                     Performance Intelligence
//                   </p>
//                   <h2 className='text-4xl md:text-5xl font-black tracking-tighter'>
//                     {selectedQuiz.title}
//                   </h2>
//                 </div>
//                 <div className='text-right relative z-10'>
//                   <p className='text-slate-400 text-[10px] font-black uppercase mb-1'>
//                     Mean Performance
//                   </p>
//                   <p className='text-5xl font-black text-emerald-400 tracking-tighter'>
//                     {(selectedQuiz.attempts?.length || 0) > 0
//                       ? (
//                           selectedQuiz.attempts!.reduce(
//                             (a, b) => a + b.score,
//                             0,
//                           ) / selectedQuiz.attempts!.length
//                         ).toFixed(1)
//                       : '0.0'}
//                     %
//                   </p>
//                 </div>
//               </div>

//               <div className='bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-2xl'>
//                 <table className='w-full text-left border-collapse'>
//                   <thead className='bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100'>
//                     <tr>
//                       <th className='px-8 py-6'>Student</th>
//                       <th className='px-8 py-6'>Date</th>
//                       <th className='px-8 py-6 text-center'>Score</th>
//                       <th className='px-8 py-6 text-right'>Status</th>
//                     </tr>
//                   </thead>
//                   <tbody className='divide-y divide-slate-50'>
//                     {!selectedQuiz.attempts ||
//                     selectedQuiz.attempts.length === 0 ? (
//                       <EmptyResults />
//                     ) : (
//                       selectedQuiz.attempts.map((att, i) => (
//                         <motion.tr
//                           initial={{ opacity: 0, x: -10 }}
//                           animate={{ opacity: 1, x: 0 }}
//                           transition={{ delay: i * 0.05 }}
//                           key={i}
//                           className='hover:bg-blue-50/30 transition-colors group'
//                         >
//                           <td className='px-8 py-6'>
//                             <div className='flex items-center gap-3'>
//                               <div className='w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#002EFF] group-hover:text-white transition-all'>
//                                 <User size={14} />
//                               </div>
//                               <span className='font-bold text-slate-700'>
//                                 {att.studentName}
//                               </span>
//                             </div>
//                           </td>
//                           <td className='px-8 py-6 text-slate-500 font-medium text-xs'>
//                             {att.date}
//                           </td>
//                           <td className='px-8 py-6 font-black text-xl text-center text-slate-900'>
//                             {att.score}%
//                           </td>
//                           <td className='px-8 py-6 text-right'>
//                             <span
//                               className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider ${att.status === 'Passed' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}
//                             >
//                               {att.status}
//                             </span>
//                           </td>
//                         </motion.tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   )
// }

// // --- SUB-COMPONENTS ---

// function QuizCard({
//   quiz,
//   isSelected,
//   onSelect,
//   onDelete,
//   onShare,
//   copied,
// }: any) {
//   const totalQuestions = quiz?.totalQuestions || quiz?.questions?.length || 0
//   const totalAttempts = quiz?.attempts?.length || 0

//   return (
//     <motion.div
//       layout
//       whileHover={{ y: -5 }}
//       whileTap={{ scale: 0.98 }}
//       className={`relative group bg-white p-7 rounded-[32px] border-2 transition-all cursor-pointer flex flex-col h-full ${isSelected ? 'border-[#002EFF] shadow-2xl shadow-blue-100' : 'border-white shadow-sm hover:border-blue-100'}`}
//       onClick={onSelect}
//     >
//       <div className='flex justify-between items-start mb-6'>
//         <div className='flex gap-2'>
//           <span className='bg-blue-50 text-[#002EFF] px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider'>
//             {quiz.id || 'N/A'}
//           </span>
//           {totalQuestions > 20 && (
//             <div className='bg-orange-50 text-orange-500 p-1.5 rounded-lg'>
//               <Zap size={12} fill='currentColor' />
//             </div>
//           )}
//         </div>
//         <div className='flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase'>
//           <Clock size={12} className='text-blue-400' /> {quiz.timeLimit || 0}m
//         </div>
//       </div>

//       <h3 className='text-xl font-black text-slate-800 mb-2 leading-tight group-hover:text-[#002EFF] transition-colors'>
//         {quiz.title || 'Untitled Quiz'}
//       </h3>
//       <p className='text-slate-400 text-xs font-medium line-clamp-2 mb-8'>
//         {quiz.description || 'No description provided.'}
//       </p>

//       <div className='flex gap-4 mb-8 bg-slate-50/50 p-4 rounded-2xl border border-slate-50 mt-auto'>
//         <div className='flex-1 flex flex-col items-center border-r border-slate-100'>
//           <span className='text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1'>
//             Questions
//           </span>
//           <span className='text-sm font-black text-slate-700 flex items-center gap-1'>
//             <FileQuestion size={12} /> {totalQuestions}
//           </span>
//         </div>
//         <div className='flex-1 flex flex-col items-center'>
//           <span className='text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1'>
//             Attempts
//           </span>
//           <span className='text-sm font-black text-slate-700 flex items-center gap-1'>
//             <User size={12} /> {totalAttempts}
//           </span>
//         </div>
//       </div>

//       <div className='flex items-center justify-between border-t border-slate-50 pt-5'>
//         <button
//           onClick={(e) => {
//             e.stopPropagation()
//             onDelete()
//           }}
//           className='p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all'
//         >
//           <Trash2 size={16} />
//         </button>
//         <div className='flex gap-2'>
//           <button
//             onClick={(e) => {
//               e.stopPropagation()
//               onShare()
//             }}
//             className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-[#002EFF] hover:text-white'}`}
//           >
//             {copied ? <Check size={14} /> : <Share2 size={14} />}{' '}
//             {copied ? 'Copied' : 'Link'}
//           </button>
//           <div className='bg-blue-50 text-[#002EFF] p-2 rounded-xl group-hover:bg-[#002EFF] group-hover:text-white transition-all'>
//             <ChevronRight size={16} strokeWidth={3} />
//           </div>
//         </div>
//       </div>
//     </motion.div>
//   )
// }

// function EmptyState({ onAction }: { onAction: () => void }) {
//   return (
//     <div className='text-center py-32 bg-white rounded-[40px] border-2 border-dashed border-slate-200'>
//       <div className='bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6'>
//         <LayoutGrid className='text-[#002EFF]' size={40} />
//       </div>
//       <h3 className='text-slate-900 font-black text-2xl mb-2'>
//         Assessment Vault Empty
//       </h3>
//       <p className='text-slate-400 text-sm mb-10 max-w-xs mx-auto font-medium'>
//         Your global control center is ready. Start by deploying your first
//         assessment module.
//       </p>
//       <button
//         onClick={onAction}
//         className='bg-slate-900 text-white px-10 py-4 rounded-[20px] text-[11px] font-black uppercase tracking-widest hover:bg-[#002EFF] transition-all shadow-xl shadow-blue-100'
//       >
//         Launch Builder Module
//       </button>
//     </div>
//   )
// }

// function EmptyResults() {
//   return (
//     <tr>
//       <td colSpan={4} className='px-8 py-24 text-center'>
//         <div className='flex flex-col items-center opacity-40'>
//           <EyeOff size={32} className='mb-4' />
//           <p className='text-slate-800 font-black uppercase text-xs'>
//             No live signals detected
//           </p>
//           <p className='text-[10px] uppercase mt-2 tracking-widest'>
//             Students must complete the exam to populate this matrix.
//           </p>
//         </div>
//       </td>
//     </tr>
//   )
// }

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import {
  Zap,
  LayoutGrid,
  CheckCircle2,
  Share2,
  BarChart3,
  Trash2,
  Search,
  Plus,
  FileQuestion,
  Trophy,
  Check,
  Save,
  X,
  Settings,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { toast, Toaster } from 'react-hot-toast'

// Base URL for the DSA API
const API_BASE_URL = 'https://api.distinguishedscholarsacademy.com/api'

// --- DSA API ALIGNED TYPES ---
interface Question {
  _id?: string
  text: string
  options: string[]
  correctAnswer: string
  explanation?: string
}

interface Subject {
  _id?: string
  name: string
  questions: Question[]
}

interface Quiz {
  _id: string
  title: string
  description: string
  type: string
  isPaid: boolean
  amount: number
  accessCode?: string
  subjects: Subject[]
  status: 'active' | 'inactive'
  link: string // The unique slug for students
  createdAt: string
}

export default function MyQuizzes() {
  const router = useRouter()
  const [view, setView] = useState<'list' | 'results'>('list')
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isEditingMetadata, setIsEditingMetadata] = useState(false)
  const [editBuffer, setEditBuffer] = useState<Partial<Quiz>>({})
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    fetchQuizzes()
  }, [])

  const fetchQuizzes = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      // GET /api/quizzes (Admin Only)
      const { data } = await axios.get(`${API_BASE_URL}/quizzes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      // The API returns the array directly or inside a data property
      setQuizzes(Array.isArray(data) ? data : data.data || [])
    } catch (error) {
      toast.error('Failed to sync with DSA Vault')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateQuiz = async () => {
    if (!selectedQuiz) return
    setIsUpdating(true)
    const loadingToast = toast.loading('Updating DSA database...')

    try {
      const token = localStorage.getItem('admin_token')
      // PUT /api/quizzes/{id}
      await axios.put(
        `${API_BASE_URL}/quizzes/${selectedQuiz._id}`,
        editBuffer,
        { headers: { Authorization: `Bearer ${token}` } },
      )

      toast.success('Module updated successfully', { id: loadingToast })
      setIsEditingMetadata(false)
      fetchQuizzes() // Refresh list
      setSelectedQuiz({ ...selectedQuiz, ...editBuffer } as Quiz)
    } catch (error) {
      toast.error('Update failed. Ensure all fields are valid.', {
        id: loadingToast,
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this assessment from DSA?')) return

    try {
      const token = localStorage.getItem('admin_token')
      // DELETE /api/quizzes/{id}
      await axios.delete(`${API_BASE_URL}/quizzes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('Assessment purged')
      setQuizzes(quizzes.filter((q) => q._id !== id))
      if (selectedQuiz?._id === id) setSelectedQuiz(null)
    } catch (error) {
      toast.error('Deletion failed.')
    }
  }

  const handleToggleStatus = async (id: string) => {
    try {
      const token = localStorage.getItem('admin_token')
      // PATCH /api/quizzes/{id}/status
      await axios.patch(
        `${API_BASE_URL}/quizzes/${id}/status`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      toast.success('Visibility status toggled')
      fetchQuizzes()
    } catch (error) {
      toast.error('Status change failed')
    }
  }

  const handleShare = (link: string, id: string) => {
    // Uses the 'link' slug from your API
    // Whatever domain the admin is on is the domain students should get.
    const fullUrl = `${window.location.origin}/q/${link}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedId(id)
    toast.success('Student link copied!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredQuizzes = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.link.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className='max-w-7xl mx-auto p-4 md:p-10 font-sans text-slate-900 bg-[#F8FAFC] min-h-screen'>
      <Toaster position='top-center' reverseOrder={false} />

      {/* HEADER */}
      <header className='flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6'>
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          <div className='flex items-center gap-3 mb-1'>
            <div className='bg-[#002EFF] p-2 rounded-xl text-white shadow-lg shadow-blue-200'>
              <Trophy size={20} />
            </div>
            <h1 className='text-3xl font-black tracking-tight text-slate-900'>
              Quiz<span className='text-[#002EFF]'>Vault</span>
            </h1>
          </div>
          <p className='text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] ml-12'>
            DSA Global Administration{' '}
            <span className='text-blue-200 mx-2'>|</span> Management
          </p>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push('/admin/builder')}
          className='flex items-center gap-3 bg-[#002EFF] text-white px-8 py-4 rounded-[22px] font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-100'
        >
          <Plus size={20} strokeWidth={3} /> Create New Quiz
        </motion.button>
      </header>

      {loading ? (
        <div className='flex flex-col items-center justify-center py-40 gap-4'>
          <Loader2 className='animate-spin text-[#002EFF]' size={48} />
          <p className='text-slate-400 font-black uppercase text-[10px] tracking-widest'>
            Syncing with DSA Servers...
          </p>
        </div>
      ) : (
        <LayoutGroup>
          <div className='flex flex-col lg:flex-row gap-8 items-start'>
            {/* LIST SECTION */}
            <motion.div
              layout
              className={`w-full ${selectedQuiz ? 'lg:w-[55%]' : 'lg:w-full'}`}
            >
              <div className='mb-8 relative'>
                <Search
                  className='absolute left-5 top-1/2 -translate-y-1/2 text-slate-400'
                  size={20}
                />
                <input
                  type='text'
                  placeholder='Search by title or access link...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full pl-14 pr-6 py-5 bg-white border-none rounded-[28px] text-sm font-bold shadow-sm focus:shadow-2xl focus:ring-4 focus:ring-blue-50 outline-none transition-all'
                />
              </div>

              {filteredQuizzes.length === 0 ? (
                <EmptyState onAction={() => router.push('/admin/builder')} />
              ) : (
                <div
                  className={`grid gap-6 ${selectedQuiz ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}
                >
                  {filteredQuizzes.map((quiz) => (
                    <QuizCard
                      key={quiz._id}
                      quiz={quiz}
                      isSelected={selectedQuiz?._id === quiz._id}
                      onSelect={() => {
                        setSelectedQuiz(quiz)
                        setEditBuffer(quiz)
                        setIsEditingMetadata(false)
                      }}
                      onDelete={() => handleDelete(quiz._id)}
                      onShare={() => handleShare(quiz.link, quiz._id)}
                      onToggle={() => handleToggleStatus(quiz._id)}
                      copied={copiedId === quiz._id}
                    />
                  ))}
                </div>
              )}
            </motion.div>

            {/* PREVIEW PANEL */}
            <AnimatePresence>
              {selectedQuiz && (
                <motion.aside
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className='w-full lg:w-[45%] lg:sticky lg:top-8'
                >
                  <div className='bg-white rounded-[40px] shadow-2xl border border-white overflow-hidden flex flex-col max-h-[85vh]'>
                    <div className='p-8 bg-slate-900 text-white flex justify-between items-center'>
                      <div className='flex items-center gap-3'>
                        <div className='bg-blue-500 p-2 rounded-lg'>
                          <Zap size={18} />
                        </div>
                        <h3 className='font-black uppercase text-xs tracking-widest'>
                          Module Details
                        </h3>
                      </div>
                      <button
                        onClick={() => setSelectedQuiz(null)}
                        className='hover:bg-white/10 p-2 rounded-full'
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className='p-8 space-y-8 overflow-y-auto'>
                      {/* Configuration Section */}
                      <section className='space-y-4'>
                        <div className='flex justify-between items-center'>
                          <h4 className='text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2'>
                            <Settings size={14} /> Core Configuration
                          </h4>
                          <div className='flex gap-3'>
                            {!isEditingMetadata ? (
                              <button
                                onClick={() => setIsEditingMetadata(true)}
                                className='text-[#002EFF] text-[10px] font-black uppercase'
                              >
                                Edit
                              </button>
                            ) : (
                              <button
                                onClick={handleUpdateQuiz}
                                disabled={isUpdating}
                                className='text-emerald-500 text-[10px] font-black uppercase flex items-center gap-1'
                              >
                                {isUpdating ? (
                                  <Loader2 className='animate-spin' size={12} />
                                ) : (
                                  <Save size={12} />
                                )}{' '}
                                Save
                              </button>
                            )}
                          </div>
                        </div>

                        <div className='bg-slate-50 p-6 rounded-[24px] space-y-4 border border-slate-100'>
                          <div className='space-y-1'>
                            <label className='text-[8px] font-black text-slate-400 uppercase'>
                              Title
                            </label>
                            {isEditingMetadata ? (
                              <input
                                className='w-full bg-white border-2 border-blue-100 rounded-xl p-3 text-sm font-bold outline-none'
                                value={editBuffer.title}
                                onChange={(e) =>
                                  setEditBuffer({
                                    ...editBuffer,
                                    title: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <p className='text-lg font-black text-slate-800'>
                                {selectedQuiz.title}
                              </p>
                            )}
                          </div>

                          <div className='flex gap-4'>
                            <div className='flex-1'>
                              <label className='text-[8px] font-black text-slate-400 uppercase'>
                                Slug (Access Link)
                              </label>
                              <p className='text-xs font-bold text-blue-600'>
                                {selectedQuiz.link}
                              </p>
                            </div>
                            <div className='flex-1'>
                              <label className='text-[8px] font-black text-slate-400 uppercase'>
                                Status
                              </label>
                              <p
                                className={`text-xs font-bold uppercase ${selectedQuiz.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}
                              >
                                {selectedQuiz.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Content Section */}
                      <section className='space-y-4'>
                        <h4 className='text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2'>
                          <FileQuestion size={14} /> Subject Inventory
                        </h4>
                        {selectedQuiz.subjects.map((subject, sIdx) => (
                          <div key={sIdx} className='space-y-3'>
                            <h5 className='text-[9px] font-black text-[#002EFF] uppercase tracking-widest'>
                              {subject.name}
                            </h5>
                            {subject.questions.map((q, qIdx) => (
                              <div
                                key={qIdx}
                                className='p-4 bg-white border border-slate-100 rounded-2xl flex gap-4'
                              >
                                <span className='w-6 h-6 rounded-lg bg-blue-50 text-[#002EFF] flex items-center justify-center text-[10px] font-black shrink-0'>
                                  {qIdx + 1}
                                </span>
                                <div className='space-y-2'>
                                  <p className='text-xs font-bold text-slate-700'>
                                    {q.text}
                                  </p>
                                  <div className='flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase'>
                                    <CheckCircle2 size={12} /> {q.correctAnswer}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </section>
                    </div>

                    <div className='p-6 border-t border-slate-100 bg-white flex gap-3 shrink-0'>
                      <button
                        onClick={() => setView('results')}
                        className='flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2'
                      >
                        <BarChart3 size={16} /> Analytics
                      </button>
                      <button
                        onClick={() =>
                          handleShare(selectedQuiz.link, selectedQuiz._id)
                        }
                        className='flex-1 bg-white border-2 border-slate-100 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2'
                      >
                        <Share2 size={16} />{' '}
                        {copiedId === selectedQuiz._id ? 'Copied' : 'Share'}
                      </button>
                    </div>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      )}
    </div>
  )
}

function QuizCard({
  quiz,
  isSelected,
  onSelect,
  onDelete,
  onShare,
  onToggle,
  copied,
}: any) {
  const totalQuestions =
    quiz.subjects?.reduce(
      (acc: number, sub: any) => acc + (sub.questions?.length || 0),
      0,
    ) || 0

  return (
    <motion.div
      layout
      whileHover={{ y: -5 }}
      onClick={onSelect}
      className={`relative bg-white p-7 rounded-[32px] border-2 cursor-pointer flex flex-col h-full transition-all ${isSelected ? 'border-[#002EFF] shadow-2xl scale-[1.02]' : 'border-white shadow-sm hover:border-blue-100'}`}
    >
      <div className='flex justify-between items-start mb-6'>
        <span
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${quiz.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
        >
          {quiz.status}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className='text-slate-300 hover:text-[#002EFF]'
        >
          <Settings size={14} />
        </button>
      </div>

      <h3 className='text-xl font-black text-slate-800 mb-2 leading-tight'>
        {quiz.title}
      </h3>
      <p className='text-slate-400 text-xs font-medium line-clamp-2 mb-8'>
        {quiz.description}
      </p>

      <div className='flex gap-4 mb-8 bg-slate-50/50 p-4 rounded-2xl border border-slate-50 mt-auto'>
        <div className='flex-1 flex flex-col items-center border-r border-slate-100'>
          <span className='text-[8px] font-black text-slate-400 uppercase mb-1'>
            Items
          </span>
          <span className='text-sm font-black text-slate-700 flex items-center gap-1'>
            <FileQuestion size={12} /> {totalQuestions}
          </span>
        </div>
        <div className='flex-1 flex flex-col items-center'>
          <span className='text-[8px] font-black text-slate-400 uppercase mb-1'>
            Category
          </span>
          <span className='text-[10px] font-black text-slate-700 uppercase'>
            {quiz.type}
          </span>
        </div>
      </div>

      <div className='flex items-center justify-between border-t border-slate-50 pt-5'>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className='p-2 text-slate-300 hover:text-rose-500 transition-all'
        >
          <Trash2 size={16} />
        </button>
        <div className='flex gap-2'>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onShare()
            }}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-[#002EFF] hover:text-white'}`}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}{' '}
            {copied ? 'Copied' : 'Link'}
          </button>
          <div className='bg-blue-50 text-[#002EFF] p-2 rounded-xl'>
            <ChevronRight size={16} strokeWidth={3} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <div className='text-center py-32 bg-white rounded-[40px] border-2 border-dashed border-slate-200'>
      <div className='bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6'>
        <LayoutGrid className='text-[#002EFF]' size={40} />
      </div>
      <h3 className='text-slate-900 font-black text-2xl mb-2'>Vault Empty</h3>
      <button
        onClick={onAction}
        className='bg-slate-900 text-white px-10 py-4 rounded-[20px] text-[11px] font-black uppercase tracking-widest hover:bg-[#002EFF] transition-all'
      >
        Deploy First Module
      </button>
    </div>
  )
}