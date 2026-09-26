'use client'

// Public explainer: what the classes, programmes and departments are, what
// each one gives a student inside the portal, and how the choice works from
// sign-up onward. Linked from the homepage's "Explore All Programs" button.
// The class → programme rules are read from lib/registration so this page
// can never drift from what the sign-up form actually allows.

import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  FlaskConical,
  GraduationCap,
  Landmark,
  Lock,
  MessagesSquare,
  Palette,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  CLASS_LEVELS,
  CLASS_LEVELS_CLOSED,
  SIGNUP_PROGRAMMES,
  SIGNUP_PROGRAMMES_CLOSED,
  programmesForClass,
} from '@/lib/registration'

const CLASS_BLURB: Record<string, string> = {
  SS1: 'First year of senior secondary. Build strong foundations early with after-school support in your subjects.',
  SS2: 'Second year of senior secondary. Keep pace with the syllabus and fix weak topics before the exam year.',
  SS3: 'The exam year. Prepare for WASSCE or UTME with exam-focused lessons, mock tests and past questions.',
  'Jambite/Aspirant': 'Finished secondary school and preparing for JAMB, Post-UTME or your first year at university.',
  '100 Level': 'First year at university. Support classes for 100-level courses so you settle in and excel.',
  '200 Level': 'Second year at university. Preclinical tutorials for medical and allied-health students.',
}

const PROGRAMME_INFO: Record<string, { tagline: string; points: string[] }> = {
  'After-School Classes': {
    tagline: 'Daily lesson reinforcement for SS1 and SS2.',
    points: [
      'Lessons that follow what you were taught in school that day',
      'Homework help and weekly topic tests',
      'Physical classes at the academy or live online',
    ],
  },
  'WAEC Tutorials': {
    tagline: 'WASSCE preparation across 8 to 9 subjects. English and Maths compulsory.',
    points: [
      'Subject-by-subject coverage of the WAEC syllabus',
      'Past questions, marking-scheme practice and mock exams',
      'Timetable, tutors and materials matched to your department',
    ],
  },
  'JAMB Tutorials': {
    tagline: 'UTME preparation in your 4 subjects. English is compulsory.',
    points: [
      'CBT practice with a countdown to the exam date',
      'Scholars Drill quizzes with instant corrections',
      'Weekly performance tracking per subject and topic',
    ],
  },
  'Post-UTME Tutorials': {
    tagline: 'Screening preparation in the 4 subjects your intended course needs.',
    points: [
      'University-specific past questions and drills',
      'Speed and accuracy practice for timed screenings',
      'Guidance on cut-off marks and course choice',
    ],
  },
  'A(100) Level Tutorials': {
    tagline: 'Support classes for first-year university courses.',
    points: [
      'Tutorials for core 100-level courses',
      'Study groups and revision before tests and exams',
      'Online lessons that fit around lectures',
    ],
  },
  'Preclinical Tutorials': {
    tagline: 'For 200-level medical, dental and allied-health students.',
    points: [
      'Anatomy, physiology and biochemistry tutorials',
      'Practice questions in the format of your college exams',
      'Small-group sessions with tutors who have been through it',
    ],
  },
  'Summer Classes': {
    tagline: 'Holiday lessons to strengthen weak areas before the new session.',
    points: ['Opens during the long vacation', 'Intensive revision and skills sessions'],
  },
}

const DEPARTMENTS = [
  {
    key: 'science',
    name: 'Science',
    icon: FlaskConical,
    subjects: ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Further Maths'],
    leadsTo: 'Medicine, Engineering, Pharmacy, Computer Science and the sciences',
  },
  {
    key: 'art',
    name: 'Art',
    icon: Palette,
    subjects: ['English', 'Mathematics', 'Literature', 'Government', 'History', 'CRS'],
    leadsTo: 'Law, Mass Communication, Languages, History and the humanities',
  },
  {
    key: 'commercial',
    name: 'Commercial',
    icon: Landmark,
    subjects: ['English', 'Mathematics', 'Economics', 'Commerce', 'Accounting', 'Government'],
    leadsTo: 'Accounting, Business Administration, Economics, Banking and Finance',
  },
]

const PORTAL_FEATURES = [
  { icon: BookOpenCheck, title: 'Courses and materials', text: 'Lessons, notes and past questions for your exact class and department.' },
  { icon: CalendarDays, title: 'Timetable and live classes', text: 'Your class periods, with one tap into the live lesson.' },
  { icon: Users, title: 'Your tutors', text: 'The tutors assigned to your programme, and their assignments and grades.' },
  { icon: Sparkles, title: 'Scholars Drill', text: 'CBT-style quizzes with a leaderboard and instant corrections.' },
  { icon: MessagesSquare, title: 'Community', text: 'A class chat for your programme and department, plus the general room.' },
  { icon: ShieldCheck, title: 'Attendance and progress', text: 'Attendance records and a performance view for you and your guardian.' },
]

const STEPS = [
  {
    title: 'Register free',
    text: 'Fill in your details and confirm your email with the code we send. No payment to start.',
  },
  {
    title: 'Choose your class',
    text: 'SS1 to SS3, Jambite/Aspirant or 100 Level. Your class decides which programmes you can pick.',
  },
  {
    title: 'Pick one programme',
    text: 'One programme at a time, so your portal stays focused. The list only shows what your class can take.',
  },
  {
    title: 'Add your department',
    text: 'Science, Art or Commercial for SS1 to SS3, WAEC, JAMB and Post-UTME. University levels skip this.',
  },
  {
    title: 'Your portal is built for you',
    text: 'Courses, timetable, tutors, quizzes and community all match your class, programme and department.',
  },
  {
    title: 'Unlock a plan when you are ready',
    text: 'Plans are shown for your programme only. Pay online or upload a transfer receipt for the admin to confirm.',
  },
]

const isClosedClass = (c: string) => CLASS_LEVELS_CLOSED.includes(c)
const isClosedProgramme = (p: string) => SIGNUP_PROGRAMMES_CLOSED.includes(p)

export default function ProgrammesExplainerPage() {
  return (
    <main className='min-h-screen bg-[#F8FAFF]'>
      <div className='mx-auto max-w-5xl px-4 py-10 sm:py-14'>
        <Link
          href='/'
          className='mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-[#002EFF] transition-all hover:gap-2.5'
        >
          <ArrowLeft size={16} /> Back to home
        </Link>

        {/* Hero */}
        <header className='mb-10'>
          <p className='mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#002EFF]'>
            Classes · Programmes · Departments
          </p>
          <h1 className='text-3xl font-black tracking-tight text-slate-900 sm:text-4xl'>
            How DSA is organised, and how it works for you
          </h1>
          <p className='mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600'>
            Every student at Distinguished Scholars Academy has a <b>class</b>, one <b>programme</b> and,
            where it applies, a <b>department</b>. Those three choices shape everything you see in the
            portal, from your courses and timetable to the tutors and quizzes you get.
          </p>
          <div className='mt-5 flex flex-col gap-2 sm:flex-row'>
            <Link
              href='/auth/signup'
              className='inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#002EFF] px-6 text-[12px] font-black uppercase tracking-wide text-white transition-all hover:bg-blue-700 active:scale-[0.98]'
            >
              Enrol now <ArrowRight size={15} />
            </Link>
            <Link
              href='/auth/signin'
              className='inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-6 text-[12px] font-black uppercase tracking-wide text-slate-700 transition-all hover:border-[#002EFF]/40'
            >
              I already have an account
            </Link>
          </div>
        </header>

        {/* Classes */}
        <section className='mb-12' aria-labelledby='classes'>
          <div className='mb-4 flex items-center gap-2'>
            <GraduationCap className='text-[#002EFF]' size={22} />
            <h2 id='classes' className='text-xl font-black tracking-tight text-slate-900 sm:text-2xl'>
              Classes
            </h2>
          </div>
          <p className='mb-5 max-w-2xl text-[14px] text-slate-600'>
            Your class is where you are in school right now. It decides which programmes are open to you.
          </p>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {CLASS_LEVELS.map((c) => {
              const closed = isClosedClass(c)
              const allowed = programmesForClass(c)
              return (
                <article
                  key={c}
                  className={`rounded-2xl border bg-white p-5 shadow-sm ${closed ? 'border-slate-100 opacity-60' : 'border-slate-100'}`}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <h3 className='text-[15px] font-black text-slate-900'>{c}</h3>
                    {closed && (
                      <span className='inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500'>
                        <Lock size={10} /> Not open yet
                      </span>
                    )}
                  </div>
                  <p className='mt-1.5 text-[12.5px] leading-relaxed text-slate-600'>{CLASS_BLURB[c]}</p>
                  {!closed && (
                    <div className='mt-3'>
                      <p className='text-[10px] font-black uppercase tracking-wide text-slate-400'>Can pick</p>
                      <div className='mt-1.5 flex flex-wrap gap-1.5'>
                        {(allowed ?? SIGNUP_PROGRAMMES.filter((p) => !isClosedProgramme(p))).map((p) => (
                          <span key={p} className='rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-[#002EFF]'>
                            {p.replace(' Tutorials', '').replace(' Classes', '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        {/* Programmes */}
        <section className='mb-12' aria-labelledby='programmes'>
          <div className='mb-4 flex items-center gap-2'>
            <BookOpenCheck className='text-[#002EFF]' size={22} />
            <h2 id='programmes' className='text-xl font-black tracking-tight text-slate-900 sm:text-2xl'>
              Programmes
            </h2>
          </div>
          <p className='mb-5 max-w-2xl text-[14px] text-slate-600'>
            A programme is what you are preparing for. You take one at a time, and your whole portal is
            tuned to it. When you move on, for example from JAMB to Post-UTME, you ask to change it and
            the admin confirms.
          </p>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
            {SIGNUP_PROGRAMMES.map((p) => {
              const info = PROGRAMME_INFO[p]
              const closed = isClosedProgramme(p)
              const takenBy = CLASS_LEVELS.filter((c) => !isClosedClass(c)).filter((c) => {
                const allowed = programmesForClass(c)
                return !allowed || allowed.includes(p)
              })
              return (
                <article
                  key={p}
                  className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ${closed ? 'opacity-60' : ''}`}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <h3 className='text-[15px] font-black text-slate-900'>{p}</h3>
                    {closed && (
                      <span className='inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500'>
                        <Lock size={10} /> Not open yet
                      </span>
                    )}
                  </div>
                  <p className='mt-1 text-[12.5px] font-bold text-[#002EFF]'>{info?.tagline}</p>
                  <ul className='mt-3 space-y-1.5'>
                    {info?.points.map((pt) => (
                      <li key={pt} className='flex items-start gap-2 text-[12.5px] leading-relaxed text-slate-600'>
                        <CheckCircle2 size={14} className='mt-0.5 shrink-0 text-emerald-500' /> {pt}
                      </li>
                    ))}
                  </ul>
                  {!closed && (
                    <p className='mt-3 text-[11px] font-bold text-slate-400'>
                      For: {takenBy.join(', ')}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        {/* Departments */}
        <section className='mb-12' aria-labelledby='departments'>
          <div className='mb-4 flex items-center gap-2'>
            <FlaskConical className='text-[#002EFF]' size={22} />
            <h2 id='departments' className='text-xl font-black tracking-tight text-slate-900 sm:text-2xl'>
              Departments
            </h2>
          </div>
          <p className='mb-5 max-w-2xl text-[14px] text-slate-600'>
            Science, Art or Commercial decides your subjects, your timetable and which quizzes and class
            chats you see. It applies to SS1 to SS3 and to the WAEC, JAMB and Post-UTME programmes.
            University levels do not have one.
          </p>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
            {DEPARTMENTS.map((d) => {
              const Icon = d.icon
              return (
                <article key={d.key} className='rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'>
                  <div className='flex items-center gap-2'>
                    <span className='grid h-9 w-9 place-items-center rounded-xl bg-[#002EFF] text-white'>
                      <Icon size={18} />
                    </span>
                    <h3 className='text-[15px] font-black text-slate-900'>{d.name}</h3>
                  </div>
                  <div className='mt-3 flex flex-wrap gap-1.5'>
                    {d.subjects.map((s) => (
                      <span key={s} className='rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700'>
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className='mt-3 text-[12px] leading-relaxed text-slate-500'>
                    <span className='font-black text-slate-400'>Leads to: </span>
                    {d.leadsTo}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        {/* What you get */}
        <section className='mb-12' aria-labelledby='portal'>
          <div className='mb-4 flex items-center gap-2'>
            <Sparkles className='text-[#002EFF]' size={22} />
            <h2 id='portal' className='text-xl font-black tracking-tight text-slate-900 sm:text-2xl'>
              What your choice unlocks in the portal
            </h2>
          </div>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {PORTAL_FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className='rounded-2xl border border-slate-100 bg-white p-4 shadow-sm'>
                  <Icon size={18} className='text-[#002EFF]' />
                  <p className='mt-2 text-[13px] font-black text-slate-900'>{f.title}</p>
                  <p className='mt-1 text-[12px] leading-relaxed text-slate-600'>{f.text}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* How it works */}
        <section className='mb-12' aria-labelledby='how'>
          <div className='mb-4 flex items-center gap-2'>
            <CheckCircle2 className='text-[#002EFF]' size={22} />
            <h2 id='how' className='text-xl font-black tracking-tight text-slate-900 sm:text-2xl'>
              How it works
            </h2>
          </div>
          <ol className='space-y-3'>
            {STEPS.map((s, i) => (
              <li key={s.title} className='flex gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm'>
                <span className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FCB900] text-[13px] font-black text-slate-900'>
                  {i + 1}
                </span>
                <div>
                  <p className='text-[13.5px] font-black text-slate-900'>{s.title}</p>
                  <p className='mt-0.5 text-[12.5px] leading-relaxed text-slate-600'>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className='mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4'>
            <p className='text-[12px] font-black uppercase tracking-wide text-[#002EFF]'>Changing class or programme later</p>
            <p className='mt-1 text-[12.5px] leading-relaxed text-slate-700'>
              Promoted, or done with one exam and on to the next? In Settings, ask to move to your new
              class and programme and confirm with your password. An admin approves it, and your
              courses, timetable, tutors and assignments switch to the new class straight away.
              Students who registered on both WAEC and JAMB stay on JAMB until the UTME has been
              written, then move to WAEC automatically.
            </p>
          </div>
        </section>

        {/* Closing CTA */}
        <section className='rounded-3xl bg-[#002EFF] p-6 text-center text-white sm:p-8'>
          <Sparkles size={22} className='mx-auto mb-2 text-[#FCB900]' />
          <h2 className='text-xl font-black tracking-tight sm:text-2xl'>Ready to start?</h2>
          <p className='mx-auto mt-2 max-w-md text-[13px] text-blue-100'>
            Registration is free. Pick your class and programme, confirm your email, and your portal is ready.
          </p>
          <Link
            href='/auth/signup'
            className='mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#FCB900] px-6 text-[12px] font-black uppercase tracking-wide text-slate-900 transition-all hover:bg-yellow-400 active:scale-[0.98]'
          >
            Enrol now <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </main>
  )
}
