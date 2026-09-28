// src/app/dashboard/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Zap,
  Calendar,
  Settings,
  LogOut,
  Menu,
  Search,
  GraduationCap,
  Bell,
  Library,
  Users,
  Lock,
  Loader2,
  CalendarCheck,
  ClipboardList,
  Megaphone,
  Video,
  BarChart3,
  BookOpen,
  HelpCircle,
  Sparkles,
  LifeBuoy,
  Sun,
  Moon,
} from 'lucide-react'

// API Utility
import { dsaApi } from '@/lib/api'
import { getToken, getUser, clearSession } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import {
  resolveStudentProfile,
  applyProgramDates,
  DEFAULT_TRACK,
  DEFAULT_MODE,
  EXAM_TRACKS,
  STUDY_MODES,
  type StudentProfile,
} from '@/lib/studentProfile'

// UI Components
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

// Page Components
import SyllabusMastery from './syllabus/page'
import ExamSchedule from './schedule/page'
import SettingsView from './settings/page'
import Support from '@/components/dashboard/Support'
import OverviewUI from './OverviewUI'
import ResourcesView from './resources/page'
import CommunityView from './community/page'
import { useSecureSession } from '@/components/dashboard/useSecureSession'
import StudentAttendance from '@/components/dashboard/StudentAttendance'
import Timetable from '@/components/dashboard/Timetable'
import Assignments from '@/components/dashboard/Assignments'
import Announcements from '@/components/dashboard/Announcements'
import LiveClasses from '@/components/dashboard/LiveClasses'
import Analytics from '@/components/dashboard/Analytics'
import MyCourses from '@/components/dashboard/MyCourses'
import NotificationBell from '@/components/dashboard/NotificationBell'
import QuizRunner from '@/components/dashboard/QuizRunner'
import UnlockPlans from '@/components/dashboard/UnlockPlans'
import { useTabState } from '@/components/dashboard/useTabState'
import { useCommunityUnread } from '@/components/dashboard/useCommunityUnread'
import { useAnnouncementsUnread } from '@/components/dashboard/useAnnouncementsUnread'
import { LockedNotice } from '@/components/dashboard/LockedNotice'
import { canAccess } from '@/lib/access'
import { recordLogin } from '@/lib/loginStreak'

type ViewState =
  | 'overview'
  | 'syllabus'
  | 'attendance'
  | 'timetable'
  | 'schedule'
  | 'settings'
  | 'resources'
  | 'courses'
  | 'assignments'
  | 'announcements'
  | 'live'
  | 'analytics'
  | 'community'
  | 'quizzes'
  | 'unlock'
  | 'support'

export default function AcademyDashboard() {
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeView, setActiveView] = useTabState<ViewState>('overview')
  const communityUnread = useCommunityUnread(activeView === 'community')
  const announcementsUnread = useAnnouncementsUnread(
    activeView === 'announcements',
  )
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const router = useRouter()

  const [user, setUser] = useState({
    name: 'Student',
    isDSAite: false,
    email: '',
    avatar: '',
  })

  const [student, setStudent] = useState<StudentProfile>(() => ({
    track: DEFAULT_TRACK,
    mode: DEFAULT_MODE,
    department: null,
    trackConfig: EXAM_TRACKS[DEFAULT_TRACK],
    modeConfig: STUDY_MODES[DEFAULT_MODE],
  }))

  // Handle Theme Toggle
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('dsa-theme', newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Initialize Theme Preference
  useEffect(() => {
    const savedTheme = (localStorage.getItem('dsa-theme') as 'light' | 'dark') || 'light'
    setTheme(savedTheme)
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const handleLogout = useCallback(() => {
    clearSession()
    router.push('/auth/signin')
  }, [router])

  useSecureSession({ onIdleTimeout: handleLogout, idleMinutes: 30 })

  useEffect(() => {
    setMounted(true)

    const initDashboard = async () => {
      const token = getToken()

      if (!token) {
        router.push('/auth/signin')
        return
      }

      try {
        const profile = isDemoToken(token)
          ? getUser()
          : await dsaApi.auth.getProfile(token)

        if (!profile) {
          handleLogout()
          return
        }

        recordLogin()

        setUser({
          name: profile.fullName || profile.username || 'Student',
          isDSAite: profile.isDSAite || false,
          email: profile.email,
          avatar:
            profile.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username || 'default'}`,
        })
        const resolved = resolveStudentProfile(profile)
        setStudent(resolved)

        dsaApi.programs
          .getAll()
          .then((programs) => setStudent(applyProgramDates(resolved, programs)))
          .catch(() => {})
      } catch (error) {
        console.error('Session validation failed:', error)
        handleLogout()
      } finally {
        setIsLoading(false)
      }
    }

    initDashboard()
  }, [router, handleLogout])

  useEffect(() => {
    const onUpdated = () => {
      const u = getUser()
      if (!u) return
      setUser((prev) => ({
        ...prev,
        name: u.fullName || u.username || prev.name,
        avatar: u.avatarUrl || prev.avatar,
      }))
    }
    window.addEventListener('dsa:user-updated', onUpdated)
    return () => window.removeEventListener('dsa:user-updated', onUpdated)
  }, [])

  useEffect(() => {
    const go = () => setActiveView('unlock')
    window.addEventListener('dsa:unlock', go)
    return () => window.removeEventListener('dsa:unlock', go)
  }, [setActiveView])

  const navGroups = [
    {
      group: 'Overview',
      items: [
        { icon: LayoutDashboard, label: 'Overview', view: 'overview' as ViewState },
        {
          icon: Users,
          label: 'Community',
          view: 'community' as ViewState,
          badge: communityUnread,
        },
        { icon: BarChart3, label: 'My Performance', view: 'analytics' as ViewState },
      ],
    },
    {
      group: 'Classes',
      items: [
        { icon: BookOpen, label: 'My Courses', view: 'courses' as ViewState },
        { icon: Video, label: 'Live Class', view: 'live' as ViewState },
        { icon: CalendarCheck, label: 'Attendance', view: 'attendance' as ViewState },
        { icon: Calendar, label: 'Timetable', view: 'timetable' as ViewState },
        { icon: Calendar, label: 'Exam Schedule', view: 'schedule' as ViewState },
      ],
    },
    {
      group: 'Learning',
      items: [
        { icon: Library, label: 'E-Learning', view: 'resources' as ViewState },
        { icon: ClipboardList, label: 'Assignments', view: 'assignments' as ViewState },
        { icon: HelpCircle, label: 'Quizzes', view: 'quizzes' as ViewState },
        { icon: Zap, label: 'Syllabus Mastery', view: 'syllabus' as ViewState },
      ],
    },
    {
      group: 'Engagement',
      items: [
        {
          icon: Megaphone,
          label: 'Announcements',
          view: 'announcements' as ViewState,
          badge: announcementsUnread,
        },
      ],
    },
    {
      group: 'Account',
      items: [
        { icon: Sparkles, label: 'Unlock More', view: 'unlock' as ViewState },
        { icon: Settings, label: 'Settings', view: 'settings' as ViewState },
        { icon: LifeBuoy, label: 'Support', view: 'support' as ViewState },
      ],
    },
  ]

  const NavItem = ({
    icon: Icon,
    label,
    view,
    premium,
    badge,
  }: {
    icon: any
    label: string
    view: ViewState
    premium?: boolean
    badge?: number
  }) => {
    const isLocked = premium && !user.isDSAite

    return (
      <button
        disabled={isLocked}
        onClick={() => {
          setActiveView(view)
          setIsSheetOpen(false)
        }}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
          activeView === view
            ? 'bg-[#FCB900] text-[#002EFF] font-black shadow-lg shadow-[#FCB900]/20'
            : isLocked
              ? 'opacity-50 cursor-not-allowed'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
      >
        <div className='flex items-center gap-3'>
          <Icon
            size={18}
            className={
              activeView === view
                ? 'animate-pulse'
                : 'group-hover:scale-110 transition-transform'
            }
          />
          <span className='text-[11px] uppercase tracking-wider font-bold'>
            {label}
          </span>
        </div>
        {isLocked ? (
          <Lock size={12} className='text-white/40' />
        ) : badge ? (
          <span className='min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center'>
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </button>
    )
  }

  const SidebarContent = () => (
    <div className='flex flex-col h-full py-6 px-4'>
      <div className='flex items-center gap-3 mb-10 px-2'>
        <div className='bg-[#FCB900] p-1.5 rounded-lg'>
          <GraduationCap className='text-[#002EFF]' size={20} />
        </div>
        <div className='flex flex-col'>
          <span className='text-white font-black text-sm tracking-tighter uppercase leading-none'>
            DSA.Portal
          </span>
          <div className='flex items-center gap-1 mt-1 flex-wrap'>
            <Badge className='bg-yellow-400 text-[#002EFF] text-[8px] py-0 h-4 w-fit font-black'>
              {student.trackConfig.label}
            </Badge>
            {student.yearLabel && (
              <Badge className='bg-white/15 text-white text-[8px] py-0 h-4 w-fit font-bold'>
                {student.yearLabel}
              </Badge>
            )}
            <Badge className='bg-white/15 text-white text-[8px] py-0 h-4 w-fit font-bold'>
              {student.modeConfig.label}
            </Badge>
          </div>
        </div>
      </div>

      <nav className='flex-1 space-y-6 overflow-y-auto pr-2 nav-custom-scrollbar'>
        {navGroups.map((group) => (
          <div key={group.group} className='space-y-1.5'>
            <h3 className='px-4 text-[9px] font-black uppercase tracking-[0.2em] text-blue-200/40'>
              {group.group}
            </h3>
            {group.items.map((item) => (
              <NavItem key={item.view} {...item} />
            ))}
          </div>
        ))}
      </nav>

      <div className='mt-auto pt-6 border-t border-white/10'>
        <button
          onClick={handleLogout}
          className='w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-rose-500/10 hover:text-rose-400 transition-all group'
        >
          <LogOut
            size={18}
            className='group-hover:-translate-x-1 transition-transform'
          />
          <span className='text-[11px] uppercase tracking-wider font-bold'>
            Logout
          </span>
        </button>
      </div>
    </div>
  )

  if (isLoading && mounted) {
    return (
      <div className='h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFF] dark:bg-zinc-950'>
        <Loader2 className='text-[#002EFF] animate-spin mb-4' size={40} />
        <p className='text-[10px] font-black uppercase tracking-[0.2em] text-[#002EFF]'>
          Initializing Dashboard
        </p>
      </div>
    )
  }

  return (
    <div className='flex h-screen bg-[#F8FAFF] dark:bg-zinc-950 dark:text-zinc-100 overflow-hidden font-sans selection:bg-blue-100'>
      {mounted && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #002EFF; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #FCB900; }
            .nav-custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .nav-custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
            .nav-custom-scrollbar::-webkit-scrollbar-thumb { background: #fcb900; border-radius: 10px; }
          `,
          }}
        />
      )}

      <aside className='hidden lg:flex w-64 bg-[#002EFF] m-4 rounded-[2.5rem] flex-col shadow-2xl border border-blue-400/20'>
        <SidebarContent />
      </aside>

      <main className='flex-1 flex flex-col min-w-0 overflow-hidden lg:py-4 lg:pr-4'>
        <header className='flex items-center justify-between px-4 sm:px-6 py-4'>
          <div className='flex items-center gap-2 sm:gap-4'>
            <div className='lg:hidden'>
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='text-[#002EFF] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-900'
                  >
                    <Menu size={24} />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side='left'
                  className='bg-[#002EFF] p-0 border-none w-72'
                >
                  <SheetTitle className='sr-only'>Menu Navigation</SheetTitle>
                  <SidebarContent />
                </SheetContent>
              </Sheet>
            </div>

            <div className='relative hidden md:block w-64 xl:w-80 group'>
              <Search
                className='absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#002EFF] transition-colors'
                size={14}
              />
              <Input
                className='pl-9 bg-white dark:bg-zinc-900 dark:border-zinc-800 border-zinc-100 rounded-xl focus-visible:ring-[#002EFF]/20 shadow-sm'
                placeholder='Search modules...'
              />
            </div>
          </div>

          <div className='flex items-center gap-2 sm:gap-3'>
            {/* Dark / Light Mode Switcher */}
            <Button
              variant='ghost'
              size='icon'
              onClick={toggleTheme}
              className='text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-yellow-400 transition-colors'
              title='Toggle Theme'
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </Button>

            <NotificationBell />

            {/* Responsive User Full Name Header Profile */}
            <div className='flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-zinc-200 dark:border-zinc-800'>
              <div className='text-right max-w-[120px] sm:max-w-[200px] md:max-w-none'>
                <p className='text-[11px] sm:text-xs font-black text-zinc-900 dark:text-zinc-100 leading-tight truncate'>
                  {user.name}
                </p>
                <p className='text-[8px] sm:text-[9px] text-zinc-400 font-bold uppercase truncate hidden xs:block'>
                  {student.trackConfig.label}
                  {student.yearLabel ? ` · ${student.yearLabel}` : ''} ·{' '}
                  {student.modeConfig.label}
                </p>
              </div>
              <Avatar className='h-8 w-8 sm:h-9 sm:w-9 border-2 border-white dark:border-zinc-800 shadow-md shrink-0'>
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <div className='flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar'>
          <div className='max-w-400 mx-auto'>
            {activeView === 'overview' && (
              <OverviewUI
                setView={setActiveView}
                isDSAite={user.isDSAite}
                student={student}
              />
            )}
            {activeView === 'attendance' && <StudentAttendance />}
            {activeView === 'timetable' && (
              <Timetable
                track={student.track}
                mode={student.mode}
                department={student.department}
              />
            )}
            {activeView === 'resources' && (
              <ResourcesView isDSAite={user.isDSAite} />
            )}
            {activeView === 'assignments' &&
              (canAccess('assignments', getUser()) ? (
                <Assignments mode='student' />
              ) : (
                <LockedNotice feature='Assignments' need='tutorial' />
              ))}
            {activeView === 'announcements' && <Announcements mode='student' />}
            {activeView === 'live' && <LiveClasses mode='student' />}
            {activeView === 'courses' && <MyCourses />}
            {activeView === 'analytics' && <Analytics mode='student' />}
            {activeView === 'syllabus' && <SyllabusMastery />}
            {activeView === 'community' &&
              (canAccess('community', getUser()) ? (
                <CommunityView />
              ) : (
                <LockedNotice feature='Community' need='portal' />
              ))}
            {activeView === 'quizzes' && <QuizRunner />}
            {activeView === 'unlock' && <UnlockPlans />}
            {activeView === 'schedule' && <ExamSchedule mode={student.mode} />}
            {activeView === 'settings' && <SettingsView />}
            {activeView === 'support' && <Support />}
          </div>
        </div>
      </main>
    </div>
  )
}