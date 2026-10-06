// 'use client'

// import { useState, useEffect } from 'react'
// import {
//   LayoutDashboard,
//   Users,
//   CalendarDays,
//   CalendarCheck,
//   BarChart3,
//   Loader2,
//   Video,
//   CheckCircle2,
//   BookOpen,
//   ClipboardList,
//   Megaphone,
//   Award,
//   MessagesSquare,
//   HelpCircle,
//   Settings,
//   LifeBuoy,
// } from 'lucide-react'
// import { Card } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import DashboardShell, {
//   type NavGroup,
// } from '@/components/dashboard/DashboardShell'
// import { useDashboardSession } from '@/components/dashboard/useDashboardSession'
// import { useTabState } from '@/components/dashboard/useTabState'
// import { useCommunityUnread } from '@/components/dashboard/useCommunityUnread'
// import { useAnnouncementsUnread } from '@/components/dashboard/useAnnouncementsUnread'
// import TakeAttendance from '@/components/dashboard/TakeAttendance'
// import ReadOnlyTimetable from '@/components/dashboard/ReadOnlyTimetable'
// import LiveClasses from '@/components/dashboard/LiveClasses'
// import CourseMaterials from '@/components/dashboard/CourseMaterials'
// import Assignments from '@/components/dashboard/Assignments'
// import Gradebook from '@/components/dashboard/Gradebook'
// import Analytics from '@/components/dashboard/Analytics'
// import Announcements from '@/components/dashboard/Announcements'
// import Community from '@/components/dashboard/Community'
// import QuestionBank from '@/components/dashboard/QuestionBank'
// import SettingsView from '@/app/dashboard/settings/page'
// import Support from '@/components/dashboard/Support'
// import { getStudents, type StoredStudent } from '@/lib/studentsStore'
// import { getCourses, categoryForTrack, getCoursesForTutor } from '@/lib/coursesStore'
// import { getAssignments, getSubmissions } from '@/lib/assignmentsStore'
// import { getToken } from '@/lib/auth'
// import { isDemoToken } from '@/lib/demoAccounts'
// import { dsaApi } from '@/lib/api'

// function isLive(): boolean {
//   const t = getToken()
//   return !!t && !isDemoToken(t)
// }

// const asNum = (v: unknown): number | undefined =>
//   typeof v === 'number' && !Number.isNaN(v) ? v : undefined

// const TRACK_LABEL: Record<string, string> = {
//   jamb: 'JAMB',
//   waec: 'WAEC',
//   postutme: 'Post-UTME',
// }

// /** Map a live /tutors/me/students row to the roster row the table renders. */
// function mapRosterStudent(s: Record<string, unknown>): StoredStudent {
//   const track = String(s.examTrack ?? s.level ?? '')
//   const mode = String(s.learningMode ?? s.studyMode ?? '')
//   const level = String(s.currentLevel ?? s.level ?? '').trim()
//   return {
//     key: String(s.id ?? s._id ?? ''),
//     name: String(s.fullname ?? s.fullName ?? 'Student'),
//     track: TRACK_LABEL[track] ?? (track || '—'),
//     level: level || undefined,
//     mode: mode === 'physical' || mode === 'online' ? mode : undefined,
//     avg: asNum(s.averageScore) ?? asNum(s.avg),
//     progress: asNum(s.progressPercent) ?? asNum(s.progress),
//     isNew: false,
//   }
// }

// type TutorStats = {
//   students: number
//   courses: number
//   assignments: number
//   toGrade: number
// }

// const NAV: NavGroup[] = [
//   {
//     group: 'Overview',
//     items: [
//       { key: 'overview', label: 'Overview', icon: LayoutDashboard },
//       { key: 'community', label: 'Community', icon: MessagesSquare },
//       { key: 'students', label: 'My Students', icon: Users },
//       { key: 'analytics', label: 'Analytics', icon: BarChart3 },
//     ],
//   },
//   {
//     group: 'Academics',
//     items: [
//       { key: 'materials', label: 'Course Materials', icon: BookOpen },
//       { key: 'assignments', label: 'Assignments', icon: ClipboardList },
//       { key: 'gradebook', label: 'Gradebook', icon: Award },
//       { key: 'questions', label: 'Question Bank', icon: HelpCircle },
//     ],
//   },
//   {
//     group: 'Engagement',
//     items: [
//       { key: 'announcements', label: 'Announcements', icon: Megaphone },
//     ],
//   },
//   {
//     group: 'Schedule',
//     items: [
//       { key: 'attendance', label: 'Take Attendance', icon: CalendarCheck },
//       { key: 'live', label: 'Live Classes', icon: Video },
//       { key: 'timetable', label: 'Timetable', icon: CalendarDays },
//     ],
//   },
//   {
//     group: 'Account',
//     items: [
//       { key: 'settings', label: 'Profile & Settings', icon: Settings },
//       { key: 'support', label: 'Support', icon: LifeBuoy },
//     ],
//   },
// ]

// function StatTile({ label, value, icon: Icon, tint }: any) {
//   return (
//     <Card className='p-4 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3'>
//       <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
//         <Icon size={18} strokeWidth={2.5} />
//       </div>
//       <div>
//         <p className='text-[8px] font-black text-gray-400 uppercase leading-none mb-1'>{label}</p>
//         <p className='text-lg font-black text-gray-900 leading-none'>{value}</p>
//       </div>
//     </Card>
//   )
// }

// function TrackBadge({ track }: { track: string }) {
//   return (
//     <Badge className='bg-blue-50 text-[#002EFF] text-[8px] font-black'>{track}</Badge>
//   )
// }

// export default function TutorDashboard() {
//   const { user, loading, logout } = useDashboardSession('tutor')
//   // (30-minute idle auto-logout is handled inside useDashboardSession.)
//   // Persist the active tab in the URL (?tab=) so a browser refresh keeps you on
//   // the same screen instead of resetting to Overview.
//   const [view, setView] = useTabState<string>('overview')
//   const communityUnread = useCommunityUnread(view === 'community')
//   const announcementsUnread = useAnnouncementsUnread(view === 'announcements')
//   const nav = NAV.map((group) => ({
//     ...group,
//     items: group.items.map((n) =>
//       n.key === 'community'
//         ? { ...n, badge: communityUnread }
//         : n.key === 'announcements'
//           ? { ...n, badge: announcementsUnread }
//           : n,
//     ),
//   }))
//   // Live-first: a real JWT reads the tutor roster + overview (GET
//   // /tutors/me/students, /tutors/me/analytics); demo/offline falls back to the
//   // local stores keyed off the tutor's assigned courses.
//   const [roster, setRoster] = useState<StoredStudent[]>([])
//   const [stats, setStats] = useState<TutorStats>({
//     students: 0,
//     courses: 0,
//     assignments: 0,
//     toGrade: 0,
//   })
//   const [live, setLive] = useState(false)

//   useEffect(() => {
//     if (!user) return
//     let cancelled = false
//     const name = user.fullName || user.username || 'Tutor'
//     ;(async () => {
//       if (isLive()) {
//         try {
//           const [ov, rosterRaw] = await Promise.all([
//             dsaApi.analytics.tutorOverview() as Promise<Record<string, unknown>>,
//             dsaApi.analytics.tutorStudents() as Promise<Record<string, unknown>[]>,
//           ])
//           if (cancelled) return
//           const mapped = rosterRaw.map(mapRosterStudent)
//           setRoster(mapped)
//           setStats({
//             students: asNum(ov.studentsCount) ?? mapped.length,
//             courses: asNum(ov.coursesCount) ?? 0,
//             assignments: asNum(ov.assignmentsCount) ?? 0,
//             toGrade: asNum(ov.toGradeCount) ?? 0,
//           })
//           setLive(true)
//           return
//         } catch {
//           /* fall through to local */
//         }
//       }
//       if (cancelled) return
//       const students = getStudents()
//       const myCourseCats = new Set(
//         getCoursesForTutor(user.username, name).map((c) => c.category),
//       )
//       const myStudents = myCourseCats.size
//         ? students.filter((s) => myCourseCats.has(categoryForTrack(s.track)))
//         : students
//       let totalAssignments = 0
//       let pendingGrading = 0
//       getCourses().forEach((c) =>
//         getAssignments(c.id).forEach((a) => {
//           totalAssignments++
//           getSubmissions(a.id).forEach((s) => {
//             if (s.status !== 'graded') pendingGrading++
//           })
//         }),
//       )
//       setRoster(myStudents)
//       setStats({
//         students: myStudents.length,
//         courses: getCourses().length,
//         assignments: totalAssignments,
//         toGrade: pendingGrading,
//       })
//       setLive(false)
//     })()
//     return () => {
//       cancelled = true
//     }
//   }, [user])

//   if (loading || !user) {
//     return (
//       <div className='h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFF]'>
//         <Loader2 className='text-[#002EFF] animate-spin mb-4' size={40} />
//         <p className='text-[10px] font-black uppercase tracking-[0.2em] text-[#002EFF]'>
//           Loading Tutor Portal
//         </p>
//       </div>
//     )
//   }

//   const name = user.fullName || user.username || 'Tutor'
//   // Drop any "(Tutor)" suffix demo names carry, and any leading title.
//   const greeting = name.replace(/\s*\(.*\)$/, '').replace(/^(Mr|Mrs|Ms|Dr)\.?\s+/i, '')
//   // Roster + counts come from the loader effect above (live or local fallback).
//   const myStudents = roster
//   const pendingGrading = stats.toGrade

//   return (
//     <DashboardShell
//       roleLabel='Tutor'
//       userName={name}
//       userAvatar={user.avatarUrl}
//       nav={nav}
//       activeKey={view}
//       onNavigate={setView}
//       onLogout={logout}
//     >
//       {view === 'overview' && (
//         <div className='space-y-6'>
//           <section className='relative overflow-hidden bg-[#002EFF] rounded-4xl p-8 text-white shadow-lg'>
//             <h1 className='text-2xl md:text-3xl font-black uppercase italic tracking-tight'>
//               Welcome, <span className='text-[#FCB900]'>{greeting}</span>
//             </h1>
//             <p className='text-blue-100 text-xs md:text-sm mt-2 font-medium'>
//               You have {pendingGrading} submission{pendingGrading === 1 ? '' : 's'}{' '}
//               waiting to be graded.
//             </p>
//             {pendingGrading > 0 && (
//               <button
//                 onClick={() => setView('assignments')}
//                 className='mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[#FCB900] text-[#002EFF] font-black text-[11px] uppercase tracking-wide hover:bg-yellow-400 active:scale-[0.98] transition-all shadow-md'
//               >
//                 <CheckCircle2 size={15} /> Grade now
//               </button>
//             )}
//           </section>

//           <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
//             <StatTile label='My Students' value={stats.students} icon={Users} tint='bg-blue-50 text-blue-600' />
//             <StatTile label='Courses' value={stats.courses} icon={BookOpen} tint='bg-emerald-50 text-emerald-600' />
//             <StatTile label='Assignments' value={stats.assignments} icon={ClipboardList} tint='bg-amber-50 text-amber-600' />
//             <StatTile label='To Grade' value={stats.toGrade} icon={CheckCircle2} tint='bg-rose-50 text-rose-600' />
//           </div>

//           <Card className='p-6 rounded-3xl border-none shadow-sm bg-white'>
//             <div className='flex items-center justify-between mb-4'>
//               <h3 className='text-sm font-black uppercase text-gray-800'>Students Needing Attention</h3>
//               <button onClick={() => setView('students')} className='text-[10px] font-black text-[#002EFF] uppercase'>
//                 View all
//               </button>
//             </div>
//             <div className='space-y-2'>
//               {myStudents.filter((s) => (s.avg ?? 100) < 70).map((s) => (
//                 <div key={s.key} className='flex items-center justify-between p-3 rounded-2xl bg-rose-50/50'>
//                   <div className='flex items-center gap-2'>
//                     <span className='text-xs font-black text-gray-800'>{s.name}</span>
//                     <TrackBadge track={s.track} />
//                   </div>
//                   <span className='text-xs font-black text-rose-500'>{s.avg}% avg</span>
//                 </div>
//               ))}
//             </div>
//           </Card>
//         </div>
//       )}

//       {view === 'students' && (
//         <div className='space-y-4'>
//           <div className='flex items-center gap-2'>
//             <h2 className='text-2xl font-black text-[#002EFF] italic uppercase'>My Students</h2>
//             <Badge
//               className={`text-[8px] font-black ${live ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
//             >
//               {live ? 'Live' : 'Local'}
//             </Badge>
//           </div>
//           <Card className='rounded-3xl border-none shadow-sm bg-white overflow-x-auto'>
//             <div className='min-w-[640px]'>
//             <div className='grid grid-cols-12 px-5 py-3 bg-slate-50 text-[9px] font-black uppercase text-gray-400'>
//               <span className='col-span-4'>Student</span>
//               <span className='col-span-2'>Track</span>
//               <span className='col-span-2'>Mode</span>
//               <span className='col-span-2'>Avg</span>
//               <span className='col-span-2'>Progress</span>
//             </div>
//             {myStudents.map((s) => (
//               <div key={s.key} className='grid grid-cols-12 items-center px-5 py-4 border-t border-slate-50'>
//                 <span className='col-span-4 text-xs font-black text-gray-800'>
//                   {s.name}
//                   {s.level && (
//                     <span className='ml-2 text-[8px] font-black uppercase text-[#002EFF] bg-blue-50 px-1.5 py-0.5 rounded'>
//                       {s.level}
//                     </span>
//                   )}
//                   {s.isNew && (
//                     <span className='ml-2 text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded'>
//                       New
//                     </span>
//                   )}
//                 </span>
//                 <span className='col-span-2'><TrackBadge track={s.track} /></span>
//                 <span className='col-span-2'>
//                   {s.mode ? (
//                     <Badge
//                       className={`text-[8px] font-black ${s.mode === 'physical' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-[#002EFF]'}`}
//                     >
//                       {s.mode === 'physical' ? 'On-Campus' : 'Online'}
//                     </Badge>
//                   ) : (
//                     <span className='text-[10px] font-bold text-slate-300'>—</span>
//                   )}
//                 </span>
//                 <span className={`col-span-2 text-xs font-black ${s.avg == null ? 'text-slate-400' : s.avg >= 70 ? 'text-emerald-600' : 'text-rose-500'}`}>
//                   {s.avg == null ? '—' : `${s.avg}%`}
//                 </span>
//                 <div className='col-span-2'>
//                   <div className='h-2 bg-slate-100 rounded-full overflow-hidden'>
//                     <div className='h-full bg-[#002EFF] rounded-full' style={{ width: `${s.progress ?? 0}%` }} />
//                   </div>
//                 </div>
//               </div>
//             ))}
//             </div>
//           </Card>
//         </div>
//       )}

//       {view === 'materials' && <CourseMaterials mode='tutor' />}

//       {view === 'assignments' && <Assignments mode='tutor' />}

//       {view === 'gradebook' && <Gradebook />}

//       {view === 'questions' && <QuestionBank />}

//       {view === 'announcements' && <Announcements mode='tutor' />}

//       {view === 'community' && <Community mode='tutor' />}

//       {view === 'attendance' && <TakeAttendance />}

//       {view === 'live' && <LiveClasses mode='tutor' />}

//       {view === 'timetable' && <ReadOnlyTimetable />}

//       {view === 'analytics' && <Analytics mode='tutor' />}
//       {view === 'settings' && <SettingsView />}
//       {view === 'support' && <Support />}
//     </DashboardShell>
//   )
// }



'use client'

import { useState, useEffect } from 'react'

import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CalendarCheck,
  BarChart3,
  Loader2,
  Video,
  CheckCircle2,
  BookOpen,
  ClipboardList,
  Megaphone,
  Award,
  MessagesSquare,
  HelpCircle,
  Settings,
  LifeBuoy,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import DashboardShell, {
  type NavGroup,
} from '@/components/dashboard/DashboardShell'

import { useDashboardSession } from '@/components/dashboard/useDashboardSession'
import { useTabState } from '@/components/dashboard/useTabState'
import { useCommunityUnread } from '@/components/dashboard/useCommunityUnread'
import { useAnnouncementsUnread } from '@/components/dashboard/useAnnouncementsUnread'

import TakeAttendance from '@/components/dashboard/TakeAttendance'
import ReadOnlyTimetable from '@/components/dashboard/ReadOnlyTimetable'
import LiveClasses from '@/components/dashboard/LiveClasses'
import CourseMaterials from '@/components/dashboard/CourseMaterials'
import Assignments from '@/components/dashboard/Assignments'
import Gradebook from '@/components/dashboard/Gradebook'
import Analytics from '@/components/dashboard/Analytics'
import Announcements from '@/components/dashboard/Announcements'
import Community from '@/components/dashboard/Community'
import QuestionBank from '@/components/dashboard/QuestionBank'
import SettingsView from '@/app/dashboard/settings/page'
import Support from '@/components/dashboard/Support'

import { getStudents, type StoredStudent } from '@/lib/studentsStore'
import {
  getCourses,
  categoryForTrack,
  getCoursesForTutor,
} from '@/lib/coursesStore'
import { getAssignments, getSubmissions } from '@/lib/assignmentsStore'

import { getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

const asNum = (v: unknown): number | undefined =>
  typeof v === 'number' && !Number.isNaN(v) ? v : undefined

const TRACK_LABEL: Record<string, string> = {
  jamb: 'JAMB',
  waec: 'WAEC',
  postutme: 'Post-UTME',
}

/**
 * Map a live /tutors/me/students row to the compact
 * roster row used by the dashboard overview.
 */
function mapRosterStudent(
  s: Record<string, unknown>,
): StoredStudent {
  const track = String(s.examTrack ?? s.level ?? '').toLowerCase()
  const mode = String(
    s.learningMode ?? s.studyMode ?? '',
  ).toLowerCase()

  const level = String(
    s.currentLevel ?? s.level ?? '',
  ).trim()

  return {
    key: String(s.id ?? s._id ?? ''),
    name: String(
      s.fullname ?? s.fullName ?? 'Student',
    ),
    track:
      TRACK_LABEL[track] ??
      (track || '—'),
    level: level || undefined,
    mode:
      mode === 'physical' ||
      mode === 'online'
        ? mode
        : undefined,
    avg:
      asNum(s.averageScore) ??
      asNum(s.avg),
    progress:
      asNum(s.progressPercent) ??
      asNum(s.progress),
    isNew: false,
  }
}

type TutorStats = {
  students: number
  courses: number
  assignments: number
  toGrade: number
}

const NAV: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      {
        key: 'overview',
        label: 'Overview',
        icon: LayoutDashboard,
      },
      {
        key: 'community',
        label: 'Community',
        icon: MessagesSquare,
      },
      {
        key: 'students',
        label: 'My Students',
        icon: Users,
      },
      {
        key: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
      },
    ],
  },
  {
    group: 'Academics',
    items: [
      {
        key: 'materials',
        label: 'Course Materials',
        icon: BookOpen,
      },
      {
        key: 'assignments',
        label: 'Assignments',
        icon: ClipboardList,
      },
      {
        key: 'gradebook',
        label: 'Gradebook',
        icon: Award,
      },
      {
        key: 'questions',
        label: 'Question Bank',
        icon: HelpCircle,
      },
    ],
  },
  {
    group: 'Engagement',
    items: [
      {
        key: 'announcements',
        label: 'Announcements',
        icon: Megaphone,
      },
    ],
  },
  {
    group: 'Schedule',
    items: [
      {
        key: 'attendance',
        label: 'Take Attendance',
        icon: CalendarCheck,
      },
      {
        key: 'live',
        label: 'Live Classes',
        icon: Video,
      },
      {
        key: 'timetable',
        label: 'Timetable',
        icon: CalendarDays,
      },
    ],
  },
  {
    group: 'Account',
    items: [
      {
        key: 'settings',
        label: 'Profile & Settings',
        icon: Settings,
      },
      {
        key: 'support',
        label: 'Support',
        icon: LifeBuoy,
      },
    ],
  },
]

function StatTile({
  label,
  value,
  icon: Icon,
  tint,
}: any) {
  return (
    <Card className="p-4 rounded-2xl border-none shadow-sm bg-white flex items-center gap-3">
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}
      >
        <Icon size={18} strokeWidth={2.5} />
      </div>

      <div>
        <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">
          {label}
        </p>

        <p className="text-lg font-black text-gray-900 leading-none">
          {value}
        </p>
      </div>
    </Card>
  )
}

function TrackBadge({
  track,
}: {
  track: string
}) {
  return (
    <Badge className="bg-blue-50 text-[#002EFF] text-[8px] font-black">
      {track}
    </Badge>
  )
}

export default function TutorDashboard() {
  const {
    user,
    loading,
    logout,
  } = useDashboardSession('tutor')

  const [view, setView] =
    useTabState<string>('overview')

  const communityUnread =
    useCommunityUnread(
      view === 'community',
    )

  const announcementsUnread =
    useAnnouncementsUnread(
      view === 'announcements',
    )

  const nav = NAV.map((group) => ({
    ...group,

    items: group.items.map((n) =>
      n.key === 'community'
        ? {
            ...n,
            badge: communityUnread,
          }
        : n.key === 'announcements'
          ? {
              ...n,
              badge: announcementsUnread,
            }
          : n,
    ),
  }))

  const [roster, setRoster] =
    useState<StoredStudent[]>([])

  const [stats, setStats] =
    useState<TutorStats>({
      students: 0,
      courses: 0,
      assignments: 0,
      toGrade: 0,
    })

  const [live, setLive] =
    useState(false)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const name =
      user.fullName ||
      user.username ||
      'Tutor'

    ;(async () => {
      if (isLive()) {
        try {
          const [
            ov,
            rosterRaw,
          ] = await Promise.all([
            dsaApi.analytics.tutorOverview() as Promise<
              Record<string, unknown>
            >,

            dsaApi.analytics.tutorStudents() as Promise<
              Record<string, unknown>[]
            >,
          ])

          if (cancelled) return

          const mapped =
            rosterRaw.map(
              mapRosterStudent,
            )

          setRoster(mapped)

          setStats({
            students:
              asNum(
                ov.studentsCount,
              ) ?? mapped.length,

            courses:
              asNum(
                ov.coursesCount,
              ) ?? 0,

            assignments:
              asNum(
                ov.assignmentsCount,
              ) ?? 0,

            toGrade:
              asNum(
                ov.toGradeCount,
              ) ?? 0,
          })

          setLive(true)

          return
        } catch {
          // Fall through to local/demo data.
        }
      }

      if (cancelled) return

      const students =
        getStudents()

      const myCourseCats =
        new Set(
          getCoursesForTutor(
            user.username,
            name,
          ).map(
            (c) => c.category,
          ),
        )

      const myStudents =
        myCourseCats.size
          ? students.filter(
              (s) =>
                myCourseCats.has(
                  categoryForTrack(
                    s.track,
                  ),
                ),
            )
          : students

      let totalAssignments = 0
      let pendingGrading = 0

      getCourses().forEach(
        (c) =>
          getAssignments(
            c.id,
          ).forEach((a) => {
            totalAssignments++

            getSubmissions(
              a.id,
            ).forEach((s) => {
              if (
                s.status !==
                'graded'
              ) {
                pendingGrading++
              }
            })
          }),
      )

      setRoster(myStudents)

      setStats({
        students:
          myStudents.length,

        courses:
          getCourses().length,

        assignments:
          totalAssignments,

        toGrade:
          pendingGrading,
      })

      setLive(false)
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || !user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFF]">
        <Loader2
          className="text-[#002EFF] animate-spin mb-4"
          size={40}
        />

        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#002EFF]">
          Loading Tutor Portal
        </p>
      </div>
    )
  }

  const name =
    user.fullName ||
    user.username ||
    'Tutor'

  const greeting = name
    .replace(/\s\(.*\)$/, '')
    .replace(
      /^(Mr|Mrs|Ms|Dr)\.?\s+/i,
      '',
    )

  const myStudents = roster
  const pendingGrading =
    stats.toGrade

  return (
    <DashboardShell
      roleLabel="Tutor"
      userName={name}
      userAvatar={user.avatarUrl}
      nav={nav}
      activeKey={view}
      onNavigate={setView}
      onLogout={logout}
    >
      {view === 'overview' && (
        <div className="space-y-6">
          <section className="relative overflow-hidden bg-[#002EFF] rounded-4xl p-8 text-white shadow-lg">
            <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight">
              Welcome,{' '}
              <span className="text-[#FCB900]">
                {greeting}
              </span>
            </h1>

            <p className="text-blue-100 text-xs md:text-sm mt-2 font-medium">
              You have{' '}
              {pendingGrading}{' '}
              submission
              {pendingGrading === 1
                ? ''
                : 's'}{' '}
              waiting to be graded.
            </p>

            {pendingGrading > 0 && (
              <button
                onClick={() =>
                  setView(
                    'assignments',
                  )
                }
                className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[#FCB900] text-[#002EFF] font-black text-[11px] uppercase tracking-wide hover:bg-yellow-400 active:scale-[0.98] transition-all shadow-md"
              >
                <CheckCircle2
                  size={15}
                />
                Grade now
              </button>
            )}
          </section>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile
              label="My Students"
              value={
                stats.students
              }
              icon={Users}
              tint="bg-blue-50 text-blue-600"
            />

            <StatTile
              label="Courses"
              value={
                stats.courses
              }
              icon={BookOpen}
              tint="bg-emerald-50 text-emerald-600"
            />

            <StatTile
              label="Assignments"
              value={
                stats.assignments
              }
              icon={
                ClipboardList
              }
              tint="bg-amber-50 text-amber-600"
            />

            <StatTile
              label="To Grade"
              value={
                stats.toGrade
              }
              icon={
                CheckCircle2
              }
              tint="bg-rose-50 text-rose-600"
            />
          </div>

          <Card className="p-6 rounded-3xl border-none shadow-sm bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase text-gray-800">
                Students Needing Attention
              </h3>

              <button
                onClick={() =>
                  setView(
                    'students',
                  )
                }
                className="text-[10px] font-black text-[#002EFF] uppercase"
              >
                View all
              </button>
            </div>

            <div className="space-y-2">
              {myStudents
                .filter(
                  (s) =>
                    (s.avg ??
                      100) < 70,
                )
                .map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-gray-800">
                        {s.name}
                      </span>

                      <TrackBadge
                        track={
                          s.track
                        }
                      />
                    </div>

                    <span className="text-xs font-black text-rose-500">
                      {s.avg}%
                      {' '}
                      avg
                    </span>
                  </div>
                ))}

              {myStudents.filter(
                (s) =>
                  (s.avg ??
                    100) < 70,
              ).length === 0 && (
                <div className="py-8 text-center">
                  <CheckCircle2
                    size={28}
                    className="mx-auto mb-2 text-emerald-500"
                  />

                  <p className="text-xs font-black text-gray-700">
                    No students need attention
                  </p>

                  <p className="text-[10px] text-gray-400 mt-1">
                    Your students are currently performing well.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {view === 'students' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-[#002EFF] italic uppercase">
              My Students
            </h2>

            <Badge
              className={`text-[8px] font-black ${
                live
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {live
                ? 'Live'
                : 'Local'}
            </Badge>
          </div>

          <Card className="rounded-3xl border-none shadow-sm bg-white p-8">
            <div className="flex flex-col items-center justify-center text-center py-10">
              <Users
                size={42}
                className="text-[#002EFF] mb-4"
              />

              <h3 className="text-lg font-black text-gray-900">
                Your student roster has moved
              </h3>

              <p className="text-xs text-gray-500 max-w-md mt-2">
                Open the dedicated My Students page to view complete student profiles, academic information, progress and enrolled courses.
              </p>

              <button
                onClick={() =>
                  window.location.assign(
                    '/tutor/students',
                  )
                }
                className="mt-5 h-10 px-5 rounded-xl bg-[#002EFF] text-white text-[10px] font-black uppercase tracking-wide hover:opacity-90 transition"
              >
                Open My Students
              </button>
            </div>
          </Card>
        </div>
      )}

      {view === 'materials' && (
        <CourseMaterials mode="tutor" />
      )}

      {view === 'assignments' && (
        <Assignments mode="tutor" />
      )}

      {view === 'gradebook' && (
        <Gradebook />
      )}

      {view === 'questions' && (
        <QuestionBank />
      )}

      {view === 'announcements' && (
        <Announcements mode="tutor" />
      )}

      {view === 'community' && (
        <Community mode="tutor" />
      )}

      {view === 'attendance' && (
        <TakeAttendance />
      )}

      {view === 'live' && (
        <LiveClasses mode="tutor" />
      )}

      {view === 'timetable' && (
        <ReadOnlyTimetable />
      )}

      {view === 'analytics' && (
        <Analytics mode="tutor" />
      )}

      {view === 'settings' && (
        <SettingsView />
      )}

      {view === 'support' && (
        <Support />
      )}
    </DashboardShell>
  )
}