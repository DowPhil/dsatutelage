// 'use client'

// import React, { useState, useEffect, useCallback } from 'react'
// import { useRouter } from 'next/navigation'
// import { useSecureSession } from '@/components/dashboard/useSecureSession'
// import { useTabState } from '@/components/dashboard/useTabState'
// import {
//   LayoutDashboard,
//   Users,
//   BookOpen,
//   ShieldCheck,
//   Megaphone,
//   MessagesSquare,
//   LifeBuoy,
//   Wallet,
//   LogOut,
//   Menu,
//   Bell,
//   GraduationCap,
//   AlertTriangle,
//   Search,
//   X,
//   UserPlus,
//   CalendarCheck,
//   HelpCircle,
//   HardDrive,
// } from 'lucide-react'

// // UI Components
// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { Badge } from '@/components/ui/badge'

// // Feature Imports
// import AdminHome from './components/AdminHome'
// import NotificationCenter from './components/NotificationCenter'
// import StudentRoster from './components/StudentRoster'
// import PeopleRoster from './components/PeopleRoster'
// import CourseManager from './components/CourseManager'
// import CreateTutor from './components/CreateTutor'
// import CreateGuardian from './components/CreateGuardian'
// // import QuizzeManagement from './components/QuizzeManagement'
// import Library from './components/Library'
// import TakeAttendance from '@/components/dashboard/TakeAttendance'
// import TimetableEditor from '@/components/dashboard/TimetableEditor'
// import Announcements from '@/components/dashboard/Announcements'
// import Assessments from './components/Assessments'
// import CommunityModeration from './components/CommunityModeration'
// import PaymentsAdmin from './components/PaymentsAdmin'
// import RolesPermissions from './components/RolesPermissions'
// import SupportTickets from './components/SupportTickets'
// import { AnimatePresence, motion } from 'framer-motion'
// import { isAdmin, clearSession } from '@/lib/admin-auth'

// type AdminTab =
//   | 'dashboard'
//   | 'notifications'
//   | 'students'
//   | 'create-tutor'
//   | 'create-guardian'
//   | 'view-tutors'
//   | 'view-guardians'
//   | 'courses'
//   | 'assessments'
//   | 'quizzes'
//   | 'question-bank'
//   | 'library'
//   | 'attendance'
//   | 'timetable'
//   | 'broadcast'
//   | 'community'
//   | 'support'
//   | 'payments'
//   | 'roles'

// export default function AdminAdmin() {
//   const [mounted, setMounted] = useState(false)
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false)
//   const [activeTab, setActiveTab] = useTabState<AdminTab>('dashboard')
//   const router = useRouter()

//   // End the admin session and return to sign-in.
//   const signOut = useCallback(() => {
//     clearSession()
//     router.replace('/auth/signin')
//   }, [router])

//   // Security: auto sign-out after 30 minutes idle, and trap the Back button so
//   // the admin can't leave the admin area without signing out.
//   useSecureSession({
//     onIdleTimeout: () => {
//       clearSession()
//       if (typeof window !== 'undefined') {
//         window.location.replace('/auth/signin?expired=true')
//       }
//     },
//     idleMinutes: 30,
//     lockArea: true,
//   })

//   useEffect(() => {
//     if (!isAdmin()) {
//       router.push('/unauthorized')
//     } else {
//       setMounted(true)
//     }
//   }, [router])

//   // Guard against unauthorized access and SSR hydration mismatch
//   if (!mounted) {
//     return (
//       <div className='h-screen w-full bg-[#002EFF] flex items-center justify-center'>
//         <div className='flex flex-col items-center gap-4'>
//           <GraduationCap className='text-[#FCB900] animate-bounce' size={48} />
//           <p className='text-white font-black text-xs tracking-widest uppercase italic'>
//             Verifying Authority...
//           </p>
//         </div>
//       </div>
//     )
//   }

//   const sidebarGroups = [
//     {
//       group: 'Management',
//       items: [
//         {
//           id: 'dashboard' as AdminTab,
//           label: 'Dashboard',
//           icon: LayoutDashboard,
//         },
//         { id: 'students' as AdminTab, label: 'Students', icon: Users },
//         { id: 'notifications' as AdminTab, label: 'Notifications', icon: Bell },
//       ],
//     },
//     {
//       group: 'People',
//       items: [
//         { id: 'view-tutors' as AdminTab, label: 'Tutors', icon: GraduationCap },
//         { id: 'view-guardians' as AdminTab, label: 'Guardians', icon: Users },
//       ],
//     },
//     {
//       group: 'Academics',
//       items: [
//         { id: 'courses' as AdminTab, label: 'Courses', icon: BookOpen },
//         {
//           id: 'assessments' as AdminTab,
//           label: 'Quizzes & Questions',
//           icon: HelpCircle,
//         },
//         { id: 'library' as AdminTab, label: 'Library Pro', icon: HardDrive },
//         {
//           id: 'attendance' as AdminTab,
//           label: 'Take Attendance',
//           icon: CalendarCheck,
//         },
//         {
//           id: 'timetable' as AdminTab,
//           label: 'Timetable',
//           icon: CalendarCheck,
//         },
//       ],
//     },
//     {
//       group: 'Engagement',
//       items: [
//         {
//           id: 'broadcast' as AdminTab,
//           label: 'Announcements',
//           icon: Megaphone,
//         },
//         {
//           id: 'support' as AdminTab,
//           label: 'Support',
//           icon: LifeBuoy,
//         },
//       ],
//     },
//     {
//       group: 'System',
//       items: [
//         { id: 'payments' as AdminTab, label: 'Payments', icon: Wallet },
//         { id: 'roles' as AdminTab, label: 'Permissions', icon: ShieldCheck },
//       ],
//     },
//   ]

//   const renderContent = () => {
//     switch (activeTab) {
//       case 'dashboard':
//         return <AdminHome onNavigate={(tab) => setActiveTab(tab as AdminTab)} />
//       case 'students':
//         return <StudentRoster />
//       case 'view-tutors':
//         return <PeopleRoster kind='tutors' />
//       case 'view-guardians':
//         return <PeopleRoster kind='guardians' />
//       case 'courses':
//         return <CourseManager />
//       case 'assessments':
//       case 'quizzes':
//       case 'question-bank':
//         return (
//           <Assessments
//             initial={activeTab === 'question-bank' ? 'bank' : 'quizzes'}
//           />
//         )
//       case 'library':
//         return <Library />
//       case 'create-tutor':
//         return <CreateTutor />
//       case 'create-guardian':
//         return <CreateGuardian />
//       case 'attendance':
//         return <TakeAttendance />
//       case 'timetable':
//         return <TimetableEditor />
//       case 'broadcast':
//         return <Announcements mode='tutor' />
//       case 'community':
//         return <CommunityModeration />
//       case 'support':
//         return <SupportTickets />
//       case 'payments':
//         return <PaymentsAdmin />
//       case 'roles':
//         return <RolesPermissions />
//       default:
//         return <Error404 tabId={activeTab} />
//     }
//   }

//   const SidebarContent = () => (
//     <div className='flex flex-col h-full py-8 px-4'>
//       <div className='flex items-center justify-between mb-10 px-2'>
//         <div className='flex items-center gap-3'>
//           <div className='bg-[#FCB900] p-1.5 rounded-lg shadow-lg shadow-[#FCB900]/20'>
//             <GraduationCap className='text-[#002EFF]' size={20} />
//           </div>
//           <div className='flex flex-col'>
//             <span className='text-white font-black text-sm tracking-tighter uppercase leading-none'>
//               DSA.<span className='text-yellow-400'>Admin</span>
//             </span>
//             <Badge className='bg-blue-500/30 text-blue-100 text-[8px] py-0 h-4 w-fit mt-1 border-none font-bold'>
//               SUPER ADMIN
//             </Badge>
//           </div>
//         </div>
//         <button
//           onClick={() => setIsSidebarOpen(false)}
//           className='lg:hidden p-2 text-white/50 hover:text-white'
//         >
//           <X size={20} />
//         </button>
//       </div>

//       <nav className='flex-1 space-y-6 overflow-y-auto pr-2 nav-custom-scrollbar'>
//         {sidebarGroups.map((group, idx) => (
//           <div key={idx} className='space-y-1.5'>
//             <h3 className='px-4 text-[9px] font-black uppercase tracking-[0.2em] text-blue-200/40'>
//               {group.group}
//             </h3>
//             {group.items.map((item) => (
//               <button
//                 key={item.id}
//                 onClick={() => {
//                   setActiveTab(item.id)
//                   setIsSidebarOpen(false)
//                 }}
//                 className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
//                   activeTab === item.id
//                     ? 'bg-[#FCB900] text-[#002EFF] font-black shadow-xl shadow-[#FCB900]/20 scale-[1.02]'
//                     : 'text-white/60 hover:bg-white/10 hover:text-white'
//                 }`}
//               >
//                 <item.icon
//                   size={16}
//                   className={
//                     activeTab === item.id
//                       ? 'animate-pulse'
//                       : 'opacity-70 group-hover:scale-110 transition-transform'
//                   }
//                 />
//                 <span className='text-[11px] uppercase tracking-wider font-bold'>
//                   {item.label}
//                 </span>
//               </button>
//             ))}
//           </div>
//         ))}
//       </nav>

//       <div className='mt-auto pt-6 border-t border-white/10'>
//         <button
//           onClick={signOut}
//           className='w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-200/50 hover:bg-rose-500 hover:text-white transition-all group font-bold text-[11px] uppercase tracking-widest'
//         >
//           <LogOut
//             size={16}
//             className='group-hover:-translate-x-1 transition-transform'
//           />
//           Sign Out
//         </button>
//       </div>
//     </div>
//   )

//   return (
//     <div className='flex h-screen bg-[#F8FAFF] overflow-hidden font-sans selection:bg-blue-100'>
//       <style
//         dangerouslySetInnerHTML={{
//           __html: `
//           .nav-custom-scrollbar::-webkit-scrollbar { width: 4px; }
//           .nav-custom-scrollbar::-webkit-scrollbar-thumb { background: #fcb900; border-radius: 10px; }
//           .main-scrollbar::-webkit-scrollbar { width: 6px; }
//           .main-scrollbar::-webkit-scrollbar-thumb { background: #002EFF; border-radius: 10px; }
//         `,
//         }}
//       />

//       <AnimatePresence>
//         {isSidebarOpen && (
//           <>
//             <motion.div
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               onClick={() => setIsSidebarOpen(false)}
//               className='fixed inset-0 bg-[#002EFF]/20 backdrop-blur-sm z-60 lg:hidden'
//             />
//             <motion.aside
//               initial={{ x: '-100%' }}
//               animate={{ x: 0 }}
//               exit={{ x: '-100%' }}
//               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
//               className='fixed inset-y-0 left-0 w-72 bg-[#002EFF] z-70 lg:hidden shadow-2xl'
//             >
//               <SidebarContent />
//             </motion.aside>
//           </>
//         )}
//       </AnimatePresence>

//       <aside className='hidden lg:flex w-64 bg-[#002EFF] m-4 rounded-[2.5rem] flex-col shadow-2xl border border-blue-400/20 shrink-0'>
//         <SidebarContent />
//       </aside>

//       <main className='flex-1 flex flex-col min-w-0 overflow-hidden lg:py-4 lg:pr-4'>
//         <header className='flex items-center justify-between px-6 py-4'>
//           <div className='flex items-center gap-4'>
//             <button
//               onClick={() => setIsSidebarOpen(true)}
//               className='lg:hidden p-2 text-[#002EFF] bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors'
//             >
//               <Menu size={20} />
//             </button>
//             <div className='relative hidden md:block w-64 xl:w-80 group'>
//               <Search
//                 className='absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#002EFF]'
//                 size={14}
//               />
//               <Input
//                 className='pl-9 bg-white border-zinc-100 rounded-xl focus-visible:ring-[#002EFF]/20 shadow-sm text-xs'
//                 placeholder='Search administration...'
//               />
//             </div>
//           </div>

//           <div className='flex items-center gap-4'>
//             <div className='hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-zinc-100 shadow-sm'>
//               <div className='w-2 h-2 bg-emerald-500 rounded-full animate-pulse' />
//               <span className='text-[9px] font-black uppercase text-zinc-500'>
//                 System Live
//               </span>
//             </div>
//             <Button
//               variant='ghost'
//               size='icon'
//               className='relative text-zinc-400 hover:text-blue-600 bg-white rounded-xl shadow-sm border border-zinc-100'
//             >
//               <Bell size={18} />
//               <span className='absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white' />
//             </Button>
//             <div className='flex items-center gap-3 pl-3 border-l border-zinc-200'>
//               <div className='text-right hidden xs:block'>
//                 <p className='text-[10px] font-black text-zinc-900 leading-none uppercase tracking-tighter'>
//                   Dr. Philip
//                 </p>
//                 <p className='text-[9px] text-blue-600 font-bold uppercase mt-1'>
//                   Admin Authority
//                 </p>
//               </div>
//               <div className='w-10 h-10 rounded-2xl bg-[#002EFF] text-[#FCB900] flex items-center justify-center font-black shadow-lg shadow-blue-600/20 border-2 border-white cursor-pointer hover:scale-105 transition-transform'>
//                 AD
//               </div>
//             </div>
//           </div>
//         </header>

//         <div className='flex-1 overflow-y-auto px-4 md:px-6 pb-6 main-scrollbar'>
//           <div className='max-w-400 mx-auto'>
//             <AnimatePresence mode='wait'>
//               <motion.div
//                 key={activeTab}
//                 initial={{ opacity: 0, y: 10 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 exit={{ opacity: 0, y: -10 }}
//                 transition={{ duration: 0.2 }}
//               >
//                 {renderContent()}
//               </motion.div>
//             </AnimatePresence>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }

// function Error404({ tabId }: { tabId: string }) {
//   return (
//     <div className='flex flex-col items-center justify-center min-h-[50vh] text-center bg-white rounded-[2.5rem] border border-dashed border-zinc-200 p-8'>
//       <div className='w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4 border border-rose-100 shadow-inner'>
//         <AlertTriangle size={32} />
//       </div>
//       <h2 className='text-sm font-black text-slate-900 uppercase tracking-widest'>
//         Admin Endpoint Missing
//       </h2>
//       <p className='text-[10px] text-slate-500 mt-2 max-w-64 font-bold'>
//         The module <span className='text-blue-600'>"{tabId}"</span> has not been
//         initialized in the Admin core.
//       </p>
//     </div>
//   )
// }




'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSecureSession } from '@/components/dashboard/useSecureSession'
import { useTabState } from '@/components/dashboard/useTabState'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ShieldCheck,
  Megaphone,
  MessagesSquare,
  LifeBuoy,
  Wallet,
  LogOut,
  Menu,
  Bell,
  GraduationCap,
  AlertTriangle,
  Search,
  X,
  UserPlus,
  CalendarCheck,
  HelpCircle,
  HardDrive,
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// Feature Imports
import AdminHome from './components/AdminHome'
import NotificationCenter from './components/NotificationCenter'
import StudentRoster from './components/StudentRoster'
import PeopleRoster from './components/PeopleRoster'
import CourseManager from './components/CourseManager'
import CreateTutor from './components/CreateTutor'
import CreateGuardian from './components/CreateGuardian'
import Library from './components/Library'
import TakeAttendance from '@/components/dashboard/TakeAttendance'
import TimetableEditor from '@/components/dashboard/TimetableEditor'
import Announcements from '@/components/dashboard/Announcements'
import Assessments from './components/Assessments'
import CommunityModeration from './components/CommunityModeration'
import PaymentsAdmin from './components/PaymentsAdmin'
import RolesPermissions from './components/RolesPermissions'
import SupportTickets from './components/SupportTickets'
import { AnimatePresence, motion } from 'framer-motion'
import { isAdmin, clearSession } from '@/lib/admin-auth'

type AdminTab =
  | 'dashboard'
  | 'notifications'
  | 'students'
  | 'create-tutor'
  | 'create-guardian'
  | 'view-tutors'
  | 'view-guardians'
  | 'courses'
  | 'assessments'
  | 'quizzes'
  | 'question-bank'
  | 'library'
  | 'attendance'
  | 'timetable'
  | 'broadcast'
  | 'community'
  | 'support'
  | 'payments'
  | 'roles'

export default function AdminAdmin() {
  const [mounted, setMounted] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useTabState<AdminTab>('dashboard')
  const router = useRouter()

  // End the admin session and return to sign-in.
  const signOut = useCallback(() => {
    clearSession()
    router.replace('/auth/signin')
  }, [router])

  // Security: auto sign-out after 30 minutes idle
  useSecureSession({
    onIdleTimeout: () => {
      clearSession()
      if (typeof window !== 'undefined') {
        window.location.replace('/auth/signin?expired=true')
      }
    },
    idleMinutes: 30,
    lockArea: true,
  })

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/unauthorized')
    } else {
      setMounted(true)
    }
  }, [router])

  if (!mounted) {
    return (
      <div className='h-screen w-full bg-[#002EFF] flex items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <GraduationCap className='text-[#FCB900] animate-bounce' size={48} />
          <p className='text-white font-black text-xs tracking-widest uppercase italic'>
            Verifying Authority...
          </p>
        </div>
      </div>
    )
  }

  const sidebarGroups = [
    {
      group: 'Management',
      items: [
        {
          id: 'dashboard' as AdminTab,
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
        {
          id: 'community' as AdminTab,
          label: 'Community',
          icon: MessagesSquare,
        },
        { id: 'students' as AdminTab, label: 'Students', icon: Users },
        { id: 'notifications' as AdminTab, label: 'Notifications', icon: Bell },
      ],
    },
    {
      group: 'People',
      items: [
        { id: 'view-tutors' as AdminTab, label: 'Tutors', icon: GraduationCap },
        { id: 'view-guardians' as AdminTab, label: 'Guardians', icon: Users },
      ],
    },
    {
      group: 'Academics',
      items: [
        { id: 'courses' as AdminTab, label: 'Courses', icon: BookOpen },
        {
          id: 'assessments' as AdminTab,
          label: 'Quizzes & Questions',
          icon: HelpCircle,
        },
        { id: 'library' as AdminTab, label: 'Library Pro', icon: HardDrive },
        {
          id: 'attendance' as AdminTab,
          label: 'Take Attendance',
          icon: CalendarCheck,
        },
        {
          id: 'timetable' as AdminTab,
          label: 'Timetable',
          icon: CalendarCheck,
        },
      ],
    },
    {
      group: 'Engagement',
      items: [
        {
          id: 'broadcast' as AdminTab,
          label: 'Announcements',
          icon: Megaphone,
        },
        {
          id: 'support' as AdminTab,
          label: 'Support',
          icon: LifeBuoy,
        },
      ],
    },
    {
      group: 'System',
      items: [
        { id: 'payments' as AdminTab, label: 'Payments', icon: Wallet },
        { id: 'roles' as AdminTab, label: 'Permissions', icon: ShieldCheck },
      ],
    },
  ]

  const handleTabSelect = (tabId: AdminTab) => {
    if (tabId === 'notifications') {
      setIsNotificationPanelOpen(true)
    } else {
      setActiveTab(tabId)
    }
    setIsSidebarOpen(false)
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminHome onNavigate={(tab) => setActiveTab(tab as AdminTab)} />
      case 'notifications':
        return <NotificationCenter />
      case 'students':
        return <StudentRoster />
      case 'view-tutors':
        return <PeopleRoster kind='tutors' />
      case 'view-guardians':
        return <PeopleRoster kind='guardians' />
      case 'courses':
        return <CourseManager />
      case 'assessments':
      case 'quizzes':
      case 'question-bank':
        return (
          <Assessments
            initial={activeTab === 'question-bank' ? 'bank' : 'quizzes'}
          />
        )
      case 'library':
        return <Library />
      case 'create-tutor':
        return <CreateTutor />
      case 'create-guardian':
        return <CreateGuardian />
      case 'attendance':
        return <TakeAttendance />
      case 'timetable':
        return <TimetableEditor />
      case 'broadcast':
        return <Announcements mode='tutor' />
      case 'community':
        return <CommunityModeration />
      case 'support':
        return <SupportTickets />
      case 'payments':
        return <PaymentsAdmin />
      case 'roles':
        return <RolesPermissions />
      default:
        return <Error404 tabId={activeTab} />
    }
  }

  const SidebarContent = () => (
    <div className='flex flex-col h-full py-8 px-4'>
      <div className='flex items-center justify-between mb-10 px-2'>
        <div className='flex items-center gap-3'>
          <div className='bg-[#FCB900] p-1.5 rounded-lg shadow-lg shadow-[#FCB900]/20'>
            <GraduationCap className='text-[#002EFF]' size={20} />
          </div>
          <div className='flex flex-col'>
            <span className='text-white font-black text-sm tracking-tighter uppercase leading-none'>
              DSA.<span className='text-yellow-400'>Admin</span>
            </span>
            <Badge className='bg-blue-500/30 text-blue-100 text-[8px] py-0 h-4 w-fit mt-1 border-none font-bold'>
              SUPER ADMIN
            </Badge>
          </div>
        </div>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className='lg:hidden p-2 text-white/50 hover:text-white'
        >
          <X size={20} />
        </button>
      </div>

      <nav className='flex-1 space-y-6 overflow-y-auto pr-2 nav-custom-scrollbar'>
        {sidebarGroups.map((group, idx) => (
          <div key={idx} className='space-y-1.5'>
            <h3 className='px-4 text-[9px] font-black uppercase tracking-[0.2em] text-blue-200/40'>
              {group.group}
            </h3>
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabSelect(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  activeTab === item.id ||
                  (item.id === 'notifications' && isNotificationPanelOpen)
                    ? 'bg-[#FCB900] text-[#002EFF] font-black shadow-xl shadow-[#FCB900]/20 scale-[1.02]'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon
                  size={16}
                  className={
                    activeTab === item.id ||
                    (item.id === 'notifications' && isNotificationPanelOpen)
                      ? 'animate-pulse'
                      : 'opacity-70 group-hover:scale-110 transition-transform'
                  }
                />
                <span className='text-[11px] uppercase tracking-wider font-bold'>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className='mt-auto pt-6 border-t border-white/10'>
        <button
          onClick={signOut}
          className='w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-200/50 hover:bg-rose-500 hover:text-white transition-all group font-bold text-[11px] uppercase tracking-widest'
        >
          <LogOut
            size={16}
            className='group-hover:-translate-x-1 transition-transform'
          />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className='flex h-screen bg-[#F8FAFF] overflow-hidden font-sans selection:bg-blue-100 relative'>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .nav-custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .nav-custom-scrollbar::-webkit-scrollbar-thumb { background: #fcb900; border-radius: 10px; }
          .main-scrollbar::-webkit-scrollbar { width: 6px; }
          .main-scrollbar::-webkit-scrollbar-thumb { background: #002EFF; border-radius: 10px; }
        `,
        }}
      />

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className='fixed inset-0 bg-[#002EFF]/20 backdrop-blur-sm z-60 lg:hidden'
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className='fixed inset-y-0 left-0 w-72 bg-[#002EFF] z-70 lg:hidden shadow-2xl'
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Side Notification Drawer */}
      <AnimatePresence>
        {isNotificationPanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationPanelOpen(false)}
              className='fixed inset-0 bg-black/20 backdrop-blur-sm z-80'
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className='fixed inset-y-0 right-0 w-full sm:w-100 md:w-112 bg-white z-90 shadow-2xl flex flex-col border-l border-zinc-100'
            >
              <div className='flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/50'>
                <div className='flex items-center gap-2'>
                  <Bell className='text-[#002EFF]' size={18} />
                  <h3 className='font-black text-xs uppercase tracking-widest text-zinc-800'>
                    Notifications Center
                  </h3>
                </div>
                <button
                  onClick={() => setIsNotificationPanelOpen(false)}
                  className='p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors'
                >
                  <X size={18} />
                </button>
              </div>
              <div className='flex-1 overflow-y-auto p-4 main-scrollbar'>
                <NotificationCenter />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Navigation Sidebar */}
      <aside className='hidden lg:flex w-64 bg-[#002EFF] m-4 rounded-[2.5rem] flex-col shadow-2xl border border-blue-400/20 shrink-0'>
        <SidebarContent />
      </aside>

      {/* Main Container */}
      <main className='flex-1 flex flex-col min-w-0 overflow-hidden lg:py-4 lg:pr-4'>
        <header className='flex items-center justify-between px-6 py-4'>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className='lg:hidden p-2 text-[#002EFF] bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors'
            >
              <Menu size={20} />
            </button>
            <div className='relative hidden md:block w-64 xl:w-80 group'>
              <Search
                className='absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#002EFF]'
                size={14}
              />
              <Input
                className='pl-9 bg-white border-zinc-100 rounded-xl focus-visible:ring-[#002EFF]/20 shadow-sm text-xs'
                placeholder='Search administration...'
              />
            </div>
          </div>

          <div className='flex items-center gap-4'>
            <div className='hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-zinc-100 shadow-sm'>
              <div className='w-2 h-2 bg-emerald-500 rounded-full animate-pulse' />
              <span className='text-[9px] font-black uppercase text-zinc-500'>
                System Live
              </span>
            </div>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setIsNotificationPanelOpen((prev) => !prev)}
              className={`relative text-zinc-400 hover:text-blue-600 bg-white rounded-xl shadow-sm border border-zinc-100 ${
                isNotificationPanelOpen ? 'text-[#002EFF] bg-blue-50 border-blue-200' : ''
              }`}
            >
              <Bell size={18} />
              <span className='absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white' />
            </Button>
            <div className='flex items-center gap-3 pl-3 border-l border-zinc-200'>
              <div className='text-right hidden xs:block'>
                <p className='text-[10px] font-black text-zinc-900 leading-none uppercase tracking-tighter'>
                  Dr. Philip
                </p>
                <p className='text-[9px] text-blue-600 font-bold uppercase mt-1'>
                  Admin Authority
                </p>
              </div>
              <div className='w-10 h-10 rounded-2xl bg-[#002EFF] text-[#FCB900] flex items-center justify-center font-black shadow-lg shadow-blue-600/20 border-2 border-white cursor-pointer hover:scale-105 transition-transform'>
                AD
              </div>
            </div>
          </div>
        </header>

        <div className='flex-1 overflow-y-auto px-4 md:px-6 pb-6 main-scrollbar'>
          <div className='max-w-400 mx-auto'>
            <AnimatePresence mode='wait'>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  )
}

function Error404({ tabId }: { tabId: string }) {
  return (
    <div className='flex flex-col items-center justify-center min-h-[50vh] text-center bg-white rounded-[2.5rem] border border-dashed border-zinc-200 p-8'>
      <div className='w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4 border border-rose-100 shadow-inner'>
        <AlertTriangle size={32} />
      </div>
      <h2 className='text-sm font-black text-slate-900 uppercase tracking-widest'>
        Admin Endpoint Missing
      </h2>
      <p className='text-[10px] text-slate-500 mt-2 max-w-64 font-bold'>
        The module <span className='text-blue-600'>"{tabId}"</span> has not been
        initialized in the Admin core.
      </p>
    </div>
  )
}