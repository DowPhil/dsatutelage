'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  User,
  Lock,
  Bell,
  ShieldCheck,
  CreditCard,
  ChevronRight,
  Camera,
  Fingerprint,
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { dsaApi, isBackendUnreachable } from '@/lib/api'
import { getUser, getToken, setUser } from '@/lib/auth'
import { isDemoToken } from '@/lib/demoAccounts'
import { uploadToCloudinary, cloudinaryConfigured } from '@/lib/cloudinary'
import type { User as DsaUser } from '@/lib/types'
import { EXAM_TRACKS, type ExamTrack } from '@/lib/studentProfile'
import { examTracksForProgrammes } from '@/lib/registration'
import ClassChangeCard from '@/components/dashboard/ClassChangeCard'

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState('Account Info')
  const [profileImage, setProfileImage] = useState(
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  )
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Account Info fields (prefilled from the real profile).
  const [fullname, setFullname] = useState('')
  const [email, setEmail] = useState('')
  const [institution, setInstitution] = useState('')
  const [phone, setPhone] = useState('')
  // Tutor-only professional fields.
  const [role, setRole] = useState('')
  const [bio, setBio] = useState('')
  const [subjects, setSubjects] = useState('')
  // Student department (Science/Art/Commercial) + their class/track to decide
  // whether the department picker is relevant.
  const [department, setDepartment] = useState('')
  const [currentLevel, setCurrentLevel] = useState('')
  const [examTrack, setExamTrack] = useState('')
  // Programmes the student enrolled for — drives the self-serve track switcher.
  const [programmes, setProgrammes] = useState<string[]>([])
  // Parent/guardian — asked for here rather than at sign-up, so registration
  // stays short. A student can save the rest of the form without it.
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')

  const avatarSeeds = [
    { name: 'Felix', style: 'avataaars' }, { name: 'Aneka', style: 'avataaars' },
    { name: 'Max', style: 'avataaars' }, { name: 'Luna', style: 'avataaars' },
    { name: 'Jack', style: 'avataaars' }, { name: 'Zoe', style: 'avataaars' },
    { name: 'Oliver', style: 'open-peeps' }, { name: 'Sophia', style: 'open-peeps' },
    { name: 'Liam', style: 'open-peeps' }, { name: 'Maya', style: 'open-peeps' },
    { name: 'Noah', style: 'open-peeps' }, { name: 'Elena', style: 'open-peeps' },
  ]

  useEffect(() => {
    const apply = (u: Record<string, unknown>) => {
      setFullname(
        (u.fullName as string) ||
          (u.fullname as string) ||
          (u.username as string) ||
          '',
      )
      setEmail((u.email as string) || '')
      setInstitution((u.institution as string) || (u.school as string) || '')
      setPhone((u.phoneNumber as string) || (u.phone as string) || '')
      setRole((u.role as string) || '')
      setBio((u.bio as string) || '')
      setDepartment((u.department as string) || '')
      setCurrentLevel(
        (u.currentLevel as string) || (u.level as string) || '',
      )
      setExamTrack(
        (u.examTrack as string) || (u.examType as string) || '',
      )
      const progs = u.programmes ?? u.subjectsOfInterest
      const g = (u.guardianInfo ?? {}) as Record<string, unknown>
      // For a short while on 2026-09-24 the sign-up form sent a placeholder
      // guardian ("Not yet provided"); show that as empty so those students
      // are still asked for the real details.
      const placeholder = g.fullname === 'Not yet provided'
      setGuardianName(placeholder ? '' : (g.fullname as string) || '')
      setGuardianPhone(placeholder ? '' : (g.phoneNumber as string) || '')
      setGuardianEmail(placeholder ? '' : (g.email as string) || '')
      if (Array.isArray(progs)) setProgrammes(progs as string[])
      const subs = u.subjects ?? u.subjectsOfInterest
      setSubjects(
        Array.isArray(subs)
          ? (subs as string[]).join(', ')
          : ((subs as string) || ''),
      )
      const img =
        localStorage.getItem('user-pfp') ||
        (u.avatarUrl as string) ||
        (u.profilePic as string)
      if (img) setProfileImage(img)
    }
    // Paint instantly from the cached user, then refresh from the authoritative
    // /auth/me and update the cache so the whole app reflects the latest profile.
    const cached = getUser()
    if (cached) apply(cached as unknown as Record<string, unknown>)
    const t = getToken()
    if (t && !isDemoToken(t)) {
      dsaApi.auth
        .getProfile()
        .then((fresh) => {
          if (!fresh) return
          apply(fresh as unknown as Record<string, unknown>)
          setUser(fresh)
        })
        .catch(() => {
          /* keep the cached values */
        })
    }
  }, [])

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    // Prefer a real hosted URL (Cloudinary) so profilePic stays small — base64
    // avatars over ~100KB are rejected by the backend's body limit on save.
    if (cloudinaryConfigured()) {
      setSaveMsg('')
      setSaveErr('')
      try {
        const { url } = await uploadToCloudinary(file, 'avatars')
        setProfileImage(url)
        return
      } catch (err) {
        setSaveErr(
          err instanceof Error ? err.message : 'Could not upload the image.',
        )
        return
      }
    }
    // No Cloudinary yet — local preview only (kept small on save is your call).
    const reader = new FileReader()
    reader.onloadend = () => setProfileImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSaveChanges = async () => {
    setSaveMsg('')
    setSaveErr('')
    setIsSaving(true)
    // Always keep the avatar locally so the UI reflects the choice immediately.
    localStorage.setItem('user-pfp', profileImage)

    // Demo/preview sessions have no real backend user — save locally only.
    if (isDemoToken(getToken())) {
      setIsSaving(false)
      setSaveMsg('Saved in preview mode (no backend account).')
      return
    }

    try {
      const res = await dsaApi.auth.updateDetails({
        fullname,
        email: email.toLowerCase(),
        institution,
        phoneNumber: phone,
        profilePic: profileImage,
        ...(role === 'tutor'
          ? {
              bio,
              subjects: subjects
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(role === 'student' && department ? { department } : {}),
        ...(role === 'student' && guardianName.trim() && guardianPhone.trim()
          ? {
              guardianInfo: {
                fullname: guardianName.trim(),
                phoneNumber: guardianPhone.trim(),
                ...(guardianEmail.trim() ? { email: guardianEmail.trim() } : {}),
              },
            }
          : {}),
        ...(role === 'student' && examTrack ? { examTrack } : {}),
      })
      // Refresh the cached user so the sidebar/header pick up the new name/avatar.
      const updated = (res?.data ?? res?.user) as DsaUser | undefined
      const base = getUser()
      if (updated) setUser(updated)
      else if (base)
        setUser({
          ...base,
          fullName: fullname,
          email: email.toLowerCase(),
          avatarUrl: profileImage,
        } as DsaUser)
      // Tell the dashboard shell to refresh the header (name/avatar) without a
      // full reload.
      window.dispatchEvent(new Event('dsa:user-updated'))
      setSaveMsg('Saved successfully.')
    } catch (err) {
      if (isBackendUnreachable(err)) setSaveMsg('Saved locally — server unreachable.')
      else setSaveErr(err instanceof Error ? err.message : 'Could not save changes.')
    } finally {
      setIsSaving(false)
    }
  }

  // SS1–SS3 / WAEC / JAMB / Post-UTME students have a department (Science / Art /
  // Commercial); others don't.
  const lvl = currentLevel.toLowerCase()
  const tr = examTrack.toLowerCase()
  const needsDept =
    role === 'student' &&
    (lvl.includes('ss1') ||
      lvl.includes('ss2') ||
      lvl.includes('ss3') ||
      ['waec', 'jamb', 'postutme'].includes(tr))

  // Tracks the student enrolled for. A switcher is only useful when they chose
  // more than one (e.g. JAMB + Post-UTME) — they flip which one their portal
  // shows without waiting on an admin.
  const availableTracks = (
    role === 'student' ? examTracksForProgrammes(programmes) : []
  ) as ExamTrack[]
  const canSwitchTrack = availableTracks.length > 1

  return (
    <div className='max-w-3xl mx-auto space-y-4 animate-in fade-in duration-500 pb-10'>
      {/* --- PROFILE HEADER --- */}
      <Card className='bg-white rounded-3xl border-none p-5 shadow-sm relative overflow-hidden'>
        <div className='absolute top-0 right-0 w-24 h-24 bg-[#002EFF]/5 rounded-bl-full pointer-events-none' />
        <div className='flex flex-col md:flex-row items-center gap-5 relative z-10'>
          <div className='relative group'>
            <Avatar className='h-20 w-20 border-2 border-blue-50 shadow-lg transition-transform group-hover:scale-105'>
              <AvatarImage src={profileImage} className='object-cover' />
              <AvatarFallback className='bg-blue-100 text-[#002EFF] font-black text-sm'>
                {(fullname || 'D').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className='absolute bottom-0 right-0 p-1.5 bg-[#002EFF] text-white rounded-lg shadow-lg border-2 border-white transition-transform active:scale-90'
            >
              <Camera size={12} />
            </button>
          </div>

          <div className='text-center md:text-left flex-1 space-y-0.5'>
            <h2 className='text-lg font-black text-gray-800 uppercase italic leading-tight'>
              {fullname || 'Student'}
            </h2>
            <p className='text-[10px] font-bold text-gray-400'>{email}</p>
          </div>
        </div>

        {showAvatarPicker && (
          <div className='mt-4 p-3 bg-blue-50/50 rounded-2xl animate-in zoom-in-95 duration-200 border border-blue-100'>
            <div className='flex items-center justify-between mb-2'>
              <p className='text-[9px] font-black text-blue-600 uppercase'>Character Gallery</p>
              <button onClick={() => setShowAvatarPicker(false)} className='text-[8px] font-black text-gray-400 hover:text-[#002EFF]'>CLOSE</button>
            </div>
            <div className='grid grid-cols-6 sm:grid-cols-8 gap-2'>
              {avatarSeeds.map((seed) => {
                const url = `https://api.dicebear.com/7.x/${seed.style}/svg?seed=${seed.name}`
                return (
                  <button
                    key={seed.name}
                    onClick={() => setProfileImage(url)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all bg-white hover:scale-110 ${profileImage === url ? 'border-[#002EFF]' : 'border-white'}`}
                  >
                    <img src={url} alt={seed.name} className='h-full w-full' />
                  </button>
                )
              })}
              <button
                onClick={() => fileInputRef.current?.click()}
                className='aspect-square border-2 border-dashed border-blue-200 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-100 transition-colors'
              >
                <PlusIcon size={14} />
              </button>
            </div>
          </div>
        )}
        <input type='file' ref={fileInputRef} onChange={handleImageChange} className='hidden' accept='image/*' />
      </Card>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
        {/* --- NAVIGATION --- */}
        <div className='space-y-1.5'>
          {['Account Info', 'Security & Password', 'Notifications', 'Subscription', 'Privacy Settings'].map((label) => (
            <SettingNavButton
              key={label}
              icon={label === 'Account Info' ? User : label === 'Security & Password' ? Lock : label === 'Notifications' ? Bell : label === 'Subscription' ? CreditCard : ShieldCheck}
              label={label}
              active={activeTab === label}
              onClick={() => setActiveTab(label)}
            />
          ))}
        </div>

        {/* --- CONTENT AREA --- */}
        <div className='lg:col-span-2'>
          {activeTab === 'Account Info' && (
            <Card className='bg-white rounded-3xl border-none p-5 shadow-sm'>
              <h3 className='text-[11px] font-black text-[#002EFF] uppercase mb-4 flex items-center gap-2'>
                <Fingerprint size={14} /> Personal Details
              </h3>
              {saveMsg && (
                <div className='mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-bold'>
                  <Check size={13} /> {saveMsg}
                </div>
              )}
              {saveErr && (
                <div className='mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 text-rose-600 text-[10px] font-bold'>
                  <AlertCircle size={13} /> {saveErr}
                </div>
              )}
              <div className='space-y-3'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  <Field label='Full Name' value={fullname} onChange={setFullname} />
                  <Field label='Email Address' value={email} onChange={setEmail} type='email' />
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  <Field label='Institution' value={institution} onChange={setInstitution} placeholder='e.g. University of Lagos' />
                  <Field label='Phone Number' value={phone} onChange={setPhone} placeholder='080…' />
                </div>

                {role === 'tutor' && (
                  <>
                    <Field
                      label='Subjects (comma-separated)'
                      value={subjects}
                      onChange={setSubjects}
                      placeholder='e.g. Mathematics, Physics'
                    />
                    <div className='space-y-1'>
                      <label className='text-[9px] font-black text-gray-400 uppercase ml-1'>
                        Bio
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder='A short introduction shown to your students.'
                        rows={3}
                        className='w-full rounded-lg border border-gray-100 bg-gray-50/50 text-[11px] font-medium focus:bg-white px-3 py-2 outline-none resize-y'
                      />
                    </div>
                  </>
                )}

                {canSwitchTrack && (
                  <div className='space-y-1'>
                    <label className='text-[9px] font-black text-gray-400 uppercase ml-1'>
                      Current programme
                    </label>
                    <select
                      value={examTrack.toLowerCase()}
                      onChange={(e) => setExamTrack(e.target.value)}
                      className='w-full h-9 rounded-lg border border-gray-100 bg-gray-50/50 text-[11px] font-bold focus:bg-white px-3 outline-none'
                    >
                      {availableTracks.map((t) => (
                        <option key={t} value={t}>
                          {EXAM_TRACKS[t].fullName}
                        </option>
                      ))}
                    </select>
                    <p className='text-[9px] font-bold text-slate-400 ml-1'>
                      You enrolled for more than one — switch which one your
                      portal focuses on (e.g. JAMB now, Post-UTME later).
                    </p>
                  </div>
                )}

                {needsDept && (
                  <div className='space-y-1'>
                    <label className='text-[9px] font-black text-gray-400 uppercase ml-1'>
                      Department
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className='w-full h-9 rounded-lg border border-gray-100 bg-gray-50/50 text-[11px] font-bold focus:bg-white px-3 outline-none'
                    >
                      <option value=''>Select your department…</option>
                      <option value='science'>Science</option>
                      <option value='art'>Art</option>
                      <option value='commercial'>Commercial</option>
                    </select>
                    <p className='text-[9px] font-bold text-slate-400 ml-1'>
                      Sets which subjects, quizzes &amp; timetable you see.
                    </p>
                  </div>
                )}

                {role === 'student' && (
                  <div className='space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3'>
                    <div>
                      <p className='text-[10px] font-black uppercase tracking-wide text-slate-500'>
                        Parent / Guardian
                      </p>
                      <p className='text-[9px] font-bold text-slate-400'>
                        {guardianName && guardianPhone
                          ? 'We use this to keep them informed about your progress and fees.'
                          : 'Not added yet — please add a parent or guardian we can reach.'}
                      </p>
                    </div>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                      <Field label='Guardian Name' value={guardianName} onChange={setGuardianName} placeholder='Full name' />
                      <Field label='Guardian Phone' value={guardianPhone} onChange={setGuardianPhone} placeholder='080…' />
                    </div>
                    <Field label='Guardian Email (optional)' value={guardianEmail} onChange={setGuardianEmail} type='email' placeholder='guardian@example.com' />
                  </div>
                )}

                <Button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className='bg-[#002EFF] hover:bg-blue-700 text-white font-black text-[9px] rounded-lg px-8 h-9 shadow-md mt-2 w-full md:w-auto'
                >
                  {isSaving ? <Loader2 size={14} className='animate-spin' /> : 'SAVE CHANGES'}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'Account Info' && role === 'student' && <ClassChangeCard />}

          {activeTab === 'Security & Password' && <PasswordCard />}

          {['Notifications', 'Subscription', 'Privacy Settings'].includes(activeTab) && (
            <Card className='bg-white rounded-3xl border-none p-10 shadow-sm flex flex-col items-center justify-center text-center space-y-3 min-h-[300px]'>
              <div className='h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center text-[#002EFF] animate-pulse'>
                <Sparkles size={24} />
              </div>
              <h3 className='text-sm font-black text-gray-800 uppercase italic'>{activeTab}</h3>
              <p className='text-[10px] font-bold text-gray-400 max-w-[200px]'>We&apos;re currently building this section. Stay tuned!</p>
              <Badge className='bg-blue-50 text-[#002EFF] border-none font-black text-[8px]'>COMING SOON</Badge>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---- Change password (real /auth/updatepassword) ---- */
function PasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    setMsg(''); setErr('')
    if (next.length < 6) return setErr('New password must be at least 6 characters')
    if (next !== confirm) return setErr('Passwords do not match')

    if (isDemoToken(getToken())) {
      return setErr('Password change is disabled in preview mode (no backend account).')
    }
    setBusy(true)
    try {
      await dsaApi.auth.updatePassword({ currentPassword: current, newPassword: next })
      setMsg('Password updated successfully.')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (e) {
      if (isBackendUnreachable(e)) setErr('Cannot reach the server. Please try again.')
      else setErr(e instanceof Error ? e.message : 'Could not update password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className='bg-white rounded-3xl border-none p-5 shadow-sm'>
      <h3 className='text-[11px] font-black text-[#002EFF] uppercase mb-4 flex items-center gap-2'>
        <Lock size={14} /> Change Password
      </h3>
      {msg && <div className='mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-bold'><Check size={13} /> {msg}</div>}
      {err && <div className='mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 text-rose-600 text-[10px] font-bold'><AlertCircle size={13} /> {err}</div>}
      <div className='space-y-3'>
        <PwField label='Current Password' value={current} onChange={setCurrent} show={show} />
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          <PwField label='New Password' value={next} onChange={setNext} show={show} />
          <PwField label='Confirm New Password' value={confirm} onChange={setConfirm} show={show} />
        </div>
        <label className='flex items-center gap-2 text-[10px] font-bold text-slate-500'>
          <button type='button' onClick={() => setShow(!show)} className='text-slate-400 hover:text-[#002EFF]'>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          Show passwords
        </label>
        <Button onClick={submit} disabled={busy} className='bg-[#002EFF] hover:bg-blue-700 text-white font-black text-[9px] rounded-lg px-8 h-9 shadow-md mt-1 w-full md:w-auto'>
          {busy ? <Loader2 size={14} className='animate-spin' /> : 'UPDATE PASSWORD'}
        </Button>
      </div>
    </Card>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div className='space-y-1'>
      <label className='text-[9px] font-black text-gray-400 uppercase ml-1'>{label}</label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className='h-9 rounded-lg border-gray-100 bg-gray-50/50 text-[11px] font-bold focus:bg-white'
      />
    </div>
  )
}

function PwField({ label, value, onChange, show }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean
}) {
  return (
    <div className='space-y-1'>
      <label className='text-[9px] font-black text-gray-400 uppercase ml-1'>{label}</label>
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='h-9 rounded-lg border-gray-100 bg-gray-50/50 text-[11px] font-bold focus:bg-white'
      />
    </div>
  )
}

function SettingNavButton({ icon: Icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${active ? 'bg-[#002EFF] text-white shadow-md' : 'bg-white text-gray-500 hover:bg-blue-50'}`}
    >
      <div className='flex items-center gap-2.5'>
        <Icon size={14} className={active ? 'text-[#FCB900]' : 'text-gray-400 group-hover:text-[#002EFF]'} />
        <span className='text-[10px] font-black uppercase italic tracking-tight'>{label}</span>
      </div>
      <ChevronRight size={12} className={active ? 'text-white/50' : 'text-gray-300'} />
    </button>
  )
}

function PlusIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'>
      <line x1='12' y1='5' x2='12' y2='19'></line>
      <line x1='5' y1='12' x2='19' y2='12'></line>
    </svg>
  )
}
