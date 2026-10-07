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
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  GraduationCap,
  BookOpenCheck,
  TrendingUp,
  X,
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
import {
  getStudents,
  type StoredStudent,
} from '@/lib/studentsStore'
import {
  getCourses,
  categoryForTrack,
  getCoursesForTutor,
} from '@/lib/coursesStore'
import {
  getAssignments,
  getSubmissions,
} from '@/lib/assignmentsStore'
import { getToken } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { dsaApi } from '@/lib/api'

function isLive(): boolean {
  const t = getToken()
  return !!t && !isDemoToken(t)
}

const asNum = (
  v: unknown,
): number | undefined =>
  typeof v === 'number' && !Number.isNaN(v)
    ? v
    : undefined

const TRACK_LABEL: Record<string, string> = {
  jamb: 'JAMB',
  waec: 'WAEC',
  postutme: 'Post-UTME',
}

/* =========================================================
   TYPES
========================================================= */

type TutorStudentCourse = {
  id: string
  title: string
  subject?: string
  category?: string
  classLevel?: string
}

type FullTutorStudent = StoredStudent & {
  email?: string
  phone?: string
  whatsappNumber?: string
  studentId?: string
  programmes?: string[]
  department?: string
  learningMode?: string
  examTrack?: string
  status?: string
  createdAt?: string
  courses?: TutorStudentCourse[]
}

type TutorStats = {
  students: number
  courses: number
  assignments: number
  toGrade: number
}

/* =========================================================
   LIVE STUDENT MAPPER
========================================================= */

/**
 * Maps a live /tutors/me/students response into the
 * complete student object used by the Tutor Dashboard.
 */
function mapRosterStudent(
  s: Record<string, unknown>,
): FullTutorStudent {
  const rawTrack = String(
    s.examTrack ??
      s.level ??
      '',
  ).trim().toLowerCase()

  const rawMode = String(
    s.learningMode ??
      s.studyMode ??
      '',
  ).trim().toLowerCase()

  const level = String(
    s.currentLevel ??
      s.level ??
      '',
  ).trim()

  const programmes = Array.isArray(
    s.programmes,
  )
    ? s.programmes.map(String)
    : []

  const courses: TutorStudentCourse[] =
    Array.isArray(s.courses)
      ? s.courses
          .filter(
            (course): course is Record<
              string,
              unknown
            > =>
              typeof course ===
                'object' &&
              course !== null,
          )
          .map((course) => ({
            id: String(
              course.id ??
                course._id ??
                '',
            ),
            title: String(
              course.title ??
                course.name ??
                'Course',
            ),
            subject:
              course.subject != null
                ? String(
                    course.subject,
                  )
                : undefined,
            category:
              course.category != null
                ? String(
                    course.category,
                  )
                : undefined,
            classLevel:
              course.classLevel != null
                ? String(
                    course.classLevel,
                  )
                : undefined,
          }))
      : []

  return {
    key: String(
      s.id ??
        s._id ??
        s.studentId ??
        '',
    ),

    name: String(
      s.fullname ??
        s.fullName ??
        s.name ??
        'Student',
    ),

    studentId:
      s.studentId != null
        ? String(s.studentId)
        : undefined,

    email:
      s.email != null
        ? String(s.email)
        : undefined,

    phone:
      s.phone != null
        ? String(s.phone)
        : s.phoneNumber != null
          ? String(s.phoneNumber)
          : undefined,

    whatsappNumber:
      s.whatsappNumber != null
        ? String(
            s.whatsappNumber,
          )
        : undefined,

    programmes,

    department:
      s.department != null
        ? String(s.department)
        : undefined,

    track:
      TRACK_LABEL[rawTrack] ??
      (rawTrack || '—'),

    examTrack: rawTrack || undefined,

    level:
      level || undefined,

    mode:
      rawMode === 'physical' ||
      rawMode === 'online'
        ? rawMode
        : undefined,

    learningMode:
      rawMode || undefined,

    status:
      s.status != null
        ? String(s.status)
        : undefined,

    createdAt:
      s.createdAt != null
        ? String(s.createdAt)
        : undefined,

    avg:
      asNum(s.averageScore) ??
      asNum(s.avg),

    progress:
      asNum(s.progressPercent) ??
      asNum(s.progress),

    courses,

    isNew: false,
  }
}

/* =========================================================
   STUDENT CARD
========================================================= */

function TutorStudentCard({
  student,
  expanded,
  onToggle,
}: {
  student: FullTutorStudent
  expanded: boolean
  onToggle: () => void
}) {
  const initials = student.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const score =
    student.avg == null
      ? null
      : Math.round(student.avg)

  const progress = Math.min(
    100,
    Math.max(
      0,
      Math.round(student.progress ?? 0),
    ),
  )

  const status =
    String(
      student.status ?? 'active',
    ).toLowerCase()

  return (
    <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        {/* Student header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-[#002EFF] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
              {initials || 'ST'}
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-black text-gray-900 truncate">
                {student.name}
              </h3>

              <p className="text-[9px] font-medium text-slate-400 truncate mt-0.5">
                {student.studentId ||
                  'Student ID unavailable'}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge className="bg-blue-50 text-[#002EFF] text-[8px] font-black">
              {student.track || '—'}
            </Badge>

            <span
              className={`text-[7px] font-black uppercase px-2 py-1 rounded-full ${
                status === 'active'
                  ? 'bg-emerald-50 text-emerald-600'
                  : status === 'inactive'
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-amber-50 text-amber-600'
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <GraduationCap
                size={13}
                className="text-[#002EFF]"
              />

              <span className="text-[8px] font-black uppercase text-slate-400">
                Level
              </span>
            </div>

            <p className="text-[11px] font-black text-gray-800 truncate">
              {student.level || '—'}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp
                size={13}
                className="text-emerald-600"
              />

              <span className="text-[8px] font-black uppercase text-slate-400">
                Average
              </span>
            </div>

            <p
              className={`text-[11px] font-black ${
                score == null
                  ? 'text-slate-400'
                  : score >= 70
                    ? 'text-emerald-600'
                    : 'text-rose-500'
              }`}
            >
              {score == null
                ? 'No score'
                : `${score}%`}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-black uppercase text-slate-400">
              Course Progress
            </span>

            <span className="text-[9px] font-black text-[#002EFF]">
              {progress}%
            </span>
          </div>

          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#002EFF] rounded-full transition-all"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>

        {/* Contact */}
        <div className="mt-4 space-y-2">
          {student.email && (
            <div className="flex items-center gap-2 min-w-0">
              <Mail
                size={13}
                className="text-slate-400 shrink-0"
              />

              <span className="text-[10px] font-medium text-slate-600 truncate">
                {student.email}
              </span>
            </div>
          )}

          {student.phone && (
            <div className="flex items-center gap-2">
              <Phone
                size={13}
                className="text-slate-400 shrink-0"
              />

              <span className="text-[10px] font-medium text-slate-600">
                {student.phone}
              </span>
            </div>
          )}
        </div>

        {/* View more */}
        <button
          type="button"
          onClick={onToggle}
          className="w-full mt-5 h-9 rounded-xl bg-slate-50 hover:bg-blue-50 text-[#002EFF] text-[9px] font-black uppercase tracking-wide flex items-center justify-center gap-2 transition"
        >
          {expanded
            ? 'Hide Details'
            : 'View More'}

          {expanded ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
        </button>

        {/* Expanded information */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            {/* Department */}
            <div>
              <p className="text-[8px] font-black uppercase text-slate-400 mb-1">
                Department
              </p>

              <p className="text-[10px] font-bold text-gray-800">
                {student.department || '—'}
              </p>
            </div>

            {/* Programme */}
            <div>
              <p className="text-[8px] font-black uppercase text-slate-400 mb-1">
                Programme
              </p>

              <p className="text-[10px] font-bold text-gray-800">
                {student.programmes?.length
                  ? student.programmes.join(
                      ', ',
                    )
                  : '—'}
              </p>
            </div>

            {/* WhatsApp */}
            {student.whatsappNumber && (
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">
                  WhatsApp
                </p>

                <p className="text-[10px] font-bold text-gray-800">
                  {student.whatsappNumber}
                </p>
              </div>
            )}

            {/* Academic information */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">
                  Exam Track
                </p>

                <p className="text-[10px] font-black text-[#002EFF]">
                  {student.track || '—'}
                </p>
              </div>

              <div>
                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">
                  Level
                </p>

                <p className="text-[10px] font-black text-gray-800">
                  {student.level || '—'}
                </p>
              </div>

              <div>
                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">
                  Learning Mode
                </p>

                <Badge
                  className={`text-[8px] font-black ${
                    student.mode ===
                    'physical'
                      ? 'bg-emerald-50 text-emerald-600'
                      : student.mode ===
                          'online'
                        ? 'bg-blue-50 text-[#002EFF]'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {student.mode ===
                  'physical'
                    ? 'On-Campus'
                    : student.mode ===
                        'online'
                      ? 'Online'
                      : '—'}
                </Badge>
              </div>

              <div>
                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">
                  Status
                </p>

                <p className="text-[10px] font-black text-gray-800 capitalize">
                  {student.status ||
                    'Active'}
                </p>
              </div>
            </div>

            {/* Joined */}
            {student.createdAt && (
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">
                  Joined
                </p>

                <p className="text-[10px] font-bold text-gray-800">
                  {new Date(
                    student.createdAt,
                  ).toLocaleDateString(
                    'en-NG',
                    {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    },
                  )}
                </p>
              </div>
            )}

            {/* Courses */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpenCheck
                  size={13}
                  className="text-[#002EFF]"
                />

                <p className="text-[8px] font-black uppercase text-slate-400">
                  Courses
                </p>
              </div>

              {student.courses?.length ? (
                <div className="space-y-2">
                  {student.courses.map(
                    (course) => (
                      <div
                        key={course.id}
                        className="rounded-xl bg-slate-50 p-2.5"
                      >
                        <p className="text-[10px] font-black text-gray-800">
                          {course.title}
                        </p>

                        {(course.subject ||
                          course.classLevel) && (
                          <p className="text-[8px] text-slate-400 mt-0.5">
                            {[
                              course.subject,
                              course.classLevel,
                            ]
                              .filter(
                                Boolean,
                              )
                              .join(
                                ' • ',
                              )}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400">
                  No course information
                  available.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/* =========================================================
   MY STUDENTS VIEW
========================================================= */

function TutorStudentsView({
  students,
  live,
}: {
  students: FullTutorStudent[]
  live: boolean
}) {
  const [search, setSearch] =
    useState('')

  const [trackFilter, setTrackFilter] =
    useState('all')

  const [modeFilter, setModeFilter] =
    useState('all')

  const [
    expandedStudent,
    setExpandedStudent,
  ] = useState<string | null>(null)

  const tracks = Array.from(
    new Set(
      students
        .map(
          (student) =>
            student.track,
        )
        .filter(
          (track) =>
            track &&
            track !== '—',
        ),
    ),
  )

  const filteredStudents =
    students.filter((student) => {
      const query = search
        .trim()
        .toLowerCase()

      const matchesSearch =
        !query ||
        student.name
          .toLowerCase()
          .includes(query) ||
        student.email
          ?.toLowerCase()
          .includes(query) ||
        student.studentId
          ?.toLowerCase()
          .includes(query) ||
        student.department
          ?.toLowerCase()
          .includes(query) ||
        student.level
          ?.toLowerCase()
          .includes(query)

      const matchesTrack =
        trackFilter === 'all' ||
        student.track.toLowerCase() ===
          trackFilter.toLowerCase()

      const matchesMode =
        modeFilter === 'all' ||
        student.mode === modeFilter

      return (
        matchesSearch &&
        matchesTrack &&
        matchesMode
      )
    })

  const average =
    students.length > 0
      ? Math.round(
          students.reduce(
            (total, student) =>
              total +
              (student.avg ?? 0),
            0,
          ) / students.length,
        )
      : 0

  const activeCount =
    students.filter(
      (student) =>
        String(
          student.status ??
            'active',
        ).toLowerCase() ===
        'active',
    ).length

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-black text-[#002EFF] italic uppercase tracking-tight">
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
                ? 'LIVE'
                : 'LOCAL'}
            </Badge>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            View and monitor students
            enrolled in your assigned
            courses.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="px-4 py-3 rounded-2xl bg-white shadow-sm border border-slate-100 min-w-[90px]">
            <p className="text-[8px] font-black uppercase text-slate-400">
              Students
            </p>

            <p className="text-lg font-black text-gray-900">
              {students.length}
            </p>
          </div>

          <div className="px-4 py-3 rounded-2xl bg-white shadow-sm border border-slate-100 min-w-[90px]">
            <p className="text-[8px] font-black uppercase text-slate-400">
              Active
            </p>

            <p className="text-lg font-black text-emerald-600">
              {activeCount}
            </p>
          </div>

          <div className="px-4 py-3 rounded-2xl bg-white shadow-sm border border-slate-100 min-w-[90px]">
            <p className="text-[8px] font-black uppercase text-slate-400">
              Average
            </p>

            <p className="text-lg font-black text-[#002EFF]">
              {average}%
            </p>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <Card className="rounded-3xl border-none shadow-sm bg-white p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value,
                )
              }
              placeholder="Search by name, email, student ID, department..."
              className="w-full h-11 pl-11 pr-10 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-xs font-medium text-gray-800 placeholder:text-slate-400 focus:border-blue-200 focus:ring-2 focus:ring-blue-50"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch('')
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-gray-700"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Track */}
          <div className="relative">
            <SlidersHorizontal
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />

            <select
              value={trackFilter}
              onChange={(e) =>
                setTrackFilter(
                  e.target.value,
                )
              }
              className="h-11 w-full lg:w-auto min-w-[150px] pl-9 pr-9 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-gray-700 outline-none appearance-none cursor-pointer"
            >
              <option value="all">
                All Tracks
              </option>

              {tracks.map(
                (track) => (
                  <option
                    key={track}
                    value={track}
                  >
                    {track}
                  </option>
                ),
              )}
            </select>

            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          {/* Mode */}
          <div className="relative">
            <select
              value={modeFilter}
              onChange={(e) =>
                setModeFilter(
                  e.target.value,
                )
              }
              className="h-11 w-full lg:w-auto min-w-[145px] px-4 pr-9 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-gray-700 outline-none appearance-none cursor-pointer"
            >
              <option value="all">
                All Modes
              </option>

              <option value="online">
                Online
              </option>

              <option value="physical">
                On-Campus
              </option>
            </select>

            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>
      </Card>

      {/* Results information */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          Showing{' '}
          {filteredStudents.length}{' '}
          of {students.length}{' '}
          students
        </p>

        {(search ||
          trackFilter !== 'all' ||
          modeFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setTrackFilter('all')
              setModeFilter('all')
            }}
            className="text-[9px] font-black uppercase text-[#002EFF] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Empty state */}
      {filteredStudents.length === 0 && (
        <Card className="rounded-3xl border-none shadow-sm bg-white p-12">
          <div className="text-center">
            <Users
              size={40}
              className="mx-auto text-slate-300 mb-3"
            />

            <h3 className="text-sm font-black text-gray-800">
              {students.length === 0
                ? 'No students assigned'
                : 'No students found'}
            </h3>

            <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
              {students.length === 0
                ? 'Students enrolled in your assigned courses will appear here.'
                : 'Try changing your search or filters to find a student.'}
            </p>

            {students.length > 0 &&
              (search ||
                trackFilter !==
                  'all' ||
                modeFilter !==
                  'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setTrackFilter(
                      'all',
                    )
                    setModeFilter(
                      'all',
                    )
                  }}
                  className="mt-4 h-9 px-4 rounded-xl bg-[#002EFF] text-white text-[9px] font-black uppercase"
                >
                  Clear Filters
                </button>
              )}
          </div>
        </Card>
      )}

      {/* Student cards */}
      {filteredStudents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStudents.map(
            (student) => (
              <TutorStudentCard
                key={student.key}
                student={student}
                expanded={
                  expandedStudent ===
                  student.key
                }
                onToggle={() =>
                  setExpandedStudent(
                    (
                      current,
                    ) =>
                      current ===
                      student.key
                        ? null
                        : student.key,
                  )
                }
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

/* =========================================================
   NAVIGATION
========================================================= */

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

/* =========================================================
   STAT TILE
========================================================= */

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
        <Icon
          size={18}
          strokeWidth={2.5}
        />
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

/* =========================================================
   TRACK BADGE
========================================================= */

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

/* =========================================================
   TUTOR DASHBOARD
========================================================= */

export default function TutorDashboard() {
  const {
    user,
    loading,
    logout,
  } = useDashboardSession('tutor')

  const [view, setView] =
    useTabState<string>(
      'overview',
    )

  const communityUnread =
    useCommunityUnread(
      view === 'community',
    )

  const announcementsUnread =
    useAnnouncementsUnread(
      view === 'announcements',
    )

  const nav = NAV.map(
    (group) => ({
      ...group,

      items: group.items.map(
        (n) =>
          n.key ===
          'community'
            ? {
                ...n,
                badge:
                  communityUnread,
              }
            : n.key ===
                'announcements'
              ? {
                  ...n,
                  badge:
                    announcementsUnread,
                }
              : n,
      ),
    }),
  )

  const [roster, setRoster] =
    useState<
      FullTutorStudent[]
    >([])

  const [stats, setStats] =
    useState<TutorStats>({
      students: 0,
      courses: 0,
      assignments: 0,
      toGrade: 0,
    })

  const [live, setLive] =
    useState(false)

  /* =======================================================
     LOAD TUTOR DATA
  ======================================================= */

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const name =
      user.fullName ||
      user.username ||
      'Tutor'

    ;(async () => {
      /*
       * LIVE API
       */
      if (isLive()) {
        try {
          const [
            ov,
            rosterRaw,
          ] = await Promise.all([
            dsaApi.analytics.tutorOverview() as Promise<
              Record<
                string,
                unknown
              >
            >,

            dsaApi.analytics.tutorStudents() as Promise<
              Record<
                string,
                unknown
              >[]
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
              ) ??
              mapped.length,

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
          /*
           * Fall through to local/demo
           * data if the live API fails.
           */
        }
      }

      if (cancelled) return

      /*
       * LOCAL / DEMO DATA
       */
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

      const localDetailedStudents: FullTutorStudent[] =
        myStudents.map(
          (student) => ({
            ...student,

            studentId:
              student.key,

            status: 'active',

            email:
              undefined,

            phone:
              undefined,

            whatsappNumber:
              undefined,

            programmes: [],

            department:
              undefined,

            learningMode:
              student.mode,

            examTrack:
              student.track,

            courses: [],
          }),
        )

      setRoster(
        localDetailedStudents,
      )

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

  /* =======================================================
     LOADING
  ======================================================= */

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

  /* =======================================================
     USER INFO
  ======================================================= */

  const name =
    user.fullName ||
    user.username ||
    'Tutor'

  const greeting = name
    .replace(
      /\s\(.*\)$/,
      '',
    )
    .replace(
      /^(Mr|Mrs|Ms|Dr)\.?\s+/i,
      '',
    )

  const myStudents = roster

  const pendingGrading =
    stats.toGrade

  /* =======================================================
     DASHBOARD
  ======================================================= */

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
      {/* =================================================
          OVERVIEW
      ================================================= */}

      {view === 'overview' && (
        <div className="space-y-6">
          {/* Welcome */}
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
              waiting to be
              graded.
            </p>

            {pendingGrading >
              0 && (
              <button
                type="button"
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

          {/* Stats */}
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

          {/* Students needing attention */}
          <Card className="p-6 rounded-3xl border-none shadow-sm bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase text-gray-800">
                Students Needing
                Attention
              </h3>

              <button
                type="button"
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
              ).length ===
                0 && (
                <div className="py-8 text-center">
                  <CheckCircle2
                    size={28}
                    className="mx-auto mb-2 text-emerald-500"
                  />

                  <p className="text-xs font-black text-gray-700">
                    No students need
                    attention
                  </p>

                  <p className="text-[10px] text-gray-400 mt-1">
                    Your students
                    are currently
                    performing well.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* =================================================
          MY STUDENTS
      ================================================= */}

      {view === 'students' && (
        <TutorStudentsView
          students={myStudents}
          live={live}
        />
      )}

      {/* =================================================
          OTHER DASHBOARD VIEWS
      ================================================= */}

      {view === 'materials' && (
        <CourseMaterials
          mode="tutor"
        />
      )}

      {view === 'assignments' && (
        <Assignments
          mode="tutor"
        />
      )}

      {view === 'gradebook' && (
        <Gradebook />
      )}

      {view === 'questions' && (
        <QuestionBank />
      )}

      {view === 'announcements' && (
        <Announcements
          mode="tutor"
        />
      )}

      {view === 'community' && (
        <Community
          mode="tutor"
        />
      )}

      {view === 'attendance' && (
        <TakeAttendance />
      )}

      {view === 'live' && (
        <LiveClasses
          mode="tutor"
        />
      )}

      {view === 'timetable' && (
        <ReadOnlyTimetable />
      )}

      {view === 'analytics' && (
        <Analytics
          mode="tutor"
        />
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