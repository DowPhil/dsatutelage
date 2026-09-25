'use client'

// Student sign-up in two pages: who you are, then what you are studying. The
// guardian's details are asked for later, in the portal, so nobody is held up
// at the door. The Terms & Conditions are a checkbox on page two, with the
// full text one tap away in a pop-up for anyone who wants to read it.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { motion } from 'framer-motion'
import {
  User,
  AtSign,
  Phone,
  Eye,
  EyeOff,
  Camera,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dsaApi, isBackendUnreachable } from '@/lib/api'
import { uploadToCloudinary, cloudinaryConfigured } from '@/lib/cloudinary'
import { rememberEnrolmentChoice } from '@/lib/studentProfile'
import {
  GENDERS,
  CLASS_LEVELS,
  LEARNING_MODES,
  SIGNUP_PROGRAMMES,
  SIGNUP_PROGRAMMES_CLOSED,
  programmesForClass,
  programmeHintForClass,
  CLASS_LEVELS_CLOSED,
  NIGERIAN_STATES,
  deriveTrackFromProgrammes,
  usernameFromEmail,
} from '@/lib/registration'
import { addStudent } from '@/lib/studentsStore'
import TermsDialog from '@/components/TermsDialog'

const DEPARTMENTS = [
  { value: 'science', label: 'Science' },
  { value: 'art', label: 'Art' },
  { value: 'commercial', label: 'Commercial' },
] as const

const allowedProgrammes = programmesForClass
const programmeHint = programmeHintForClass
/** True when this class level may pick this programme. */
function programmeAllowed(classLevel: string | undefined, p: string): boolean {
  const allowed = allowedProgrammes(classLevel)
  return !allowed || allowed.includes(p)
}

/** Science/Art/Commercial applies to SS1–SS3 and the WAEC/JAMB/Post-UTME tracks. */
function needsDepartment(classLevel?: string, programmes?: string[]): boolean {
  const cl = (classLevel || '').toLowerCase()
  // University levels have faculties, not Science/Art/Commercial.
  if (cl.includes('100') || cl.includes('200')) return false
  if (cl.includes('ss1') || cl.includes('ss2') || cl.includes('ss3')) return true
  const track = deriveTrackFromProgrammes(programmes || [])
  return ['waec', 'jamb', 'postutme'].includes(track)
}

const schema = z
  .object({
    // Page 1 — about you
    fullname: z.string().min(2, 'Full name is required'),
    email: z.string().email('Enter a valid email'),
    whatsapp: z
      .string()
      .regex(/^\d+$/, 'Numbers only')
      .min(10, 'Enter a valid number')
      .max(11, 'Maximum 11 digits'),
    gender: z.string().min(1, 'Select your gender'),
    dob: z.string().min(1, 'Select your date of birth'),
    state: z.string().min(1, 'Select your state'),
    passport: z.string().optional(),
    password: z.string().min(6, 'Min. 6 characters'),
    confirmPassword: z.string(),
    // Page 2 — your studies
    school: z.string().min(2, 'Enter your school'),
    classLevel: z.string().min(1, 'Select your class/level'),
    learningMode: z.string().min(1, 'Select a learning mode'),
    programmes: z
      .array(z.string())
      .min(1, 'Select your programme')
      .max(1, 'Pick one programme'),
    department: z.string().optional(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Please tick the box to accept the Terms & Conditions' }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => !CLASS_LEVELS_CLOSED.includes(d.classLevel), {
    message: 'That class is not open for registration yet',
    path: ['classLevel'],
  })
  .refine((d) => d.programmes.every((p) => programmeAllowed(d.classLevel, p)), {
    message: 'One of these programmes is not offered for your class',
    path: ['programmes'],
  })
  .refine((d) => !needsDepartment(d.classLevel, d.programmes) || !!d.department, {
    message: 'Select your department',
    path: ['department'],
  })

type FormValues = z.infer<typeof schema>

const PAGE_FIELDS: Record<number, (keyof FormValues)[]> = {
  1: ['fullname', 'email', 'whatsapp', 'gender', 'dob', 'state', 'password', 'confirmPassword'],
  2: ['school', 'classLevel', 'learningMode', 'programmes', 'department', 'acceptTerms'],
}

const STEPS = ['About you', 'Your studies']

export default function StudentWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      fullname: '', email: '', whatsapp: '', gender: '', dob: '', state: '', passport: '',
      password: '', confirmPassword: '',
      school: '', classLevel: '', learningMode: '', programmes: [], department: '',
      acceptTerms: false as unknown as true,
    },
  })
  const { register, watch, setValue, trigger, getValues, formState } = form
  const errors = formState.errors

  const passport = watch('passport')
  const programmes = watch('programmes')
  const gender = watch('gender')
  const learningMode = watch('learningMode')
  const classLevel = watch('classLevel')
  const department = watch('department')
  const acceptTerms = watch('acceptTerms')

  // Page 2 opens freely; every field is checked once, when Register is pressed.
  const next = () => {
    setError('')
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const back = () => {
    setError('')
    setStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePassport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/'))
      return form.setError('passport', { message: 'Choose an image file' })
    if (file.size > 2 * 1024 * 1024)
      return form.setError('passport', { message: 'Image must be under 2MB' })
    form.clearErrors('passport')
    // Prefer a hosted URL so the passport isn't a large base64 string (which the
    // backend's ~100KB body limit would reject on register).
    if (cloudinaryConfigured()) {
      setUploadingPhoto(true)
      try {
        const { url } = await uploadToCloudinary(file, 'passports')
        setValue('passport', url)
        return
      } catch (err) {
        form.setError('passport', {
          message: err instanceof Error ? err.message : 'Upload failed',
        })
        return
      } finally {
        setUploadingPhoto(false)
      }
    }
    const reader = new FileReader()
    reader.onloadend = () => setValue('passport', reader.result as string)
    reader.readAsDataURL(file)
  }

  // Changing class drops any programme that class may not take.
  useEffect(() => {
    if (!allowedProgrammes(classLevel)) return
    const curr = getValues('programmes')
    const kept = curr.filter((p) => programmeAllowed(classLevel, p))
    if (kept.length !== curr.length) setValue('programmes', kept, { shouldValidate: true })
  }, [classLevel, getValues, setValue])

  // One programme per student: picking another replaces it; tapping the
  // chosen one clears it.
  const toggleProgramme = (p: string) => {
    const curr = getValues('programmes')
    setValue('programmes', curr.includes(p) ? [] : [p], { shouldValidate: true })
  }

  // Register the student for FREE. The server creates the account and emails an
  // OTP straight away; paying to unlock a plan happens later from the dashboard.
  const completeRegistration = async () => {
    setError('')
    const ok = await trigger()
    if (!ok) {
      // Errors on the first page are out of sight from here: go back to them.
      const errs = formState.errors as Record<string, unknown>
      const onPageOne = PAGE_FIELDS[1].some((f) => errs[f])
      if (onPageOne && step !== 1) {
        setStep(1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      setError('Please review the form — some fields need attention.')
      return
    }
    const v = getValues()
    setBusy(true)

    const username = usernameFromEmail(v.email)
    const track = deriveTrackFromProgrammes(v.programmes)
    const mode: 'physical' | 'online' =
      v.learningMode === 'Physical' ? 'physical' : 'online'

    // Runs ONLY after the server has confirmed the account and emailed the code.
    const proceedToOtp = () => {
      rememberEnrolmentChoice({
        track,
        mode,
        programmes: v.programmes,
        classLevel: v.classLevel,
      })
      addStudent({
        key: username,
        name: v.fullname,
        track: track.toUpperCase(),
        mode,
      })
      if (typeof window !== 'undefined') {
        localStorage.setItem('dsa_pending_email', v.email)
        localStorage.setItem(
          'dsa_pending_user',
          JSON.stringify({
            email: v.email.toLowerCase(),
            username,
            fullName: v.fullname,
            role: 'student',
            level: track,
            isDsaStudent: mode === 'physical',
            phone: v.whatsapp,
            avatarUrl: v.passport || undefined,
            subjectsOfInterest: v.programmes,
          }),
        )
      }
      router.push('/auth/verify-otp')
    }

    // POST /api/auth/register. No guardianInfo: that is collected in the portal.
    const payload = {
      fullname: v.fullname,
      email: v.email.toLowerCase(),
      whatsappNumber: v.whatsapp,
      password: v.password,
      gender: v.gender,
      dateOfBirth: v.dob,
      stateOfResidence: v.state,
      institution: v.school,
      currentLevel: v.classLevel,
      learningMode: mode,
      programmes: v.programmes,
      ...(v.department ? { department: v.department } : {}),
      profilePic: v.passport || undefined,
      username,
      role: 'student',
    }

    setStatus('Creating your account…')
    try {
      await dsaApi.auth.register(payload)
    } catch (err) {
      // Never move on unless the server said the account exists.
      setBusy(false)
      setStatus('')
      setError(
        isBackendUnreachable(err)
          ? 'We could not reach the server, so your account has NOT been created yet. Check your connection and press Create Account again — nothing you typed is lost.'
          : err instanceof Error
            ? err.message
            : 'Registration failed. Please check your details and try again.',
      )
      return
    }
    proceedToOtp()
  }

  // --- small field helpers ---
  const input = (
    name: keyof FormValues,
    label: string,
    placeholder: string,
    type = 'text',
    Icon?: React.ElementType,
    opts?: { numeric?: boolean; maxLength?: number },
  ) => {
    const reg = register(name)
    return (
      <div className='space-y-1.5'>
        <label className='text-[10px] font-bold text-slate-500 uppercase'>{label}</label>
        <div className='relative'>
          {Icon && (
            <Icon className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' size={14} />
          )}
          <input
            type={type}
            {...reg}
            inputMode={opts?.numeric ? 'numeric' : undefined}
            maxLength={opts?.maxLength}
            onChange={(e) => {
              if (opts?.numeric) {
                let v = e.target.value.replace(/\D/g, '')
                if (opts.maxLength) v = v.slice(0, opts.maxLength)
                e.target.value = v
              }
              reg.onChange(e)
            }}
            placeholder={placeholder}
            className={cn(
              'w-full h-11 rounded-lg bg-slate-50 border border-transparent focus:bg-white focus:border-[#002EFF]/30 outline-none text-sm font-medium transition-all',
              Icon ? 'pl-9 pr-3' : 'px-3',
            )}
          />
        </div>
        {errors[name] && (
          <p className='text-[10px] font-bold text-rose-500'>
            {errors[name]?.message as string}
          </p>
        )}
      </div>
    )
  }

  const pill = (active: boolean) =>
    cn(
      'cursor-pointer py-2.5 px-3 rounded-lg border text-xs font-bold text-center transition-all',
      active
        ? 'bg-blue-50 border-[#002EFF] text-[#002EFF]'
        : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50',
    )

  return (
    <div className='space-y-6'>
      {/* Progress: two pages */}
      <div className='flex items-center gap-3'>
        {STEPS.map((label, i) => {
          const n = i + 1
          const done = n < step
          const active = n === step
          return (
            <div key={label} className='flex flex-1 items-center gap-2'>
              <div
                className={cn(
                  'h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black transition-all',
                  active
                    ? 'bg-[#002EFF] text-white'
                    : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-400',
                )}
              >
                {done ? <CheckCircle2 size={15} /> : n}
              </div>
              <span
                className={cn(
                  'text-[10px] font-black uppercase tracking-wide',
                  active ? 'text-[#002EFF]' : 'text-slate-400',
                )}
              >
                {label}
              </span>
              {i === 0 && <span className='mx-1 h-px flex-1 bg-slate-200' />}
            </div>
          )
        })}
      </div>

      {error && (
        <div className='p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-bold text-center'>
          {error}
        </div>
      )}

      <div className='min-h-[1px]'>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className='space-y-4'
        >
          {step === 1 && (
            <>
              <h3 className='text-sm font-black text-slate-800'>About you</h3>

              {/* Passport (optional) */}
              <div className='flex flex-col items-center gap-2 pb-1'>
                <label htmlFor='wiz-passport' className='relative h-24 w-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer overflow-hidden hover:border-[#002EFF] group'>
                  {passport ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={passport} alt='Passport' className='h-full w-full object-cover' />
                  ) : (
                    <div className='flex flex-col items-center text-slate-400 group-hover:text-[#002EFF]'>
                      <Camera size={20} />
                      <span className='text-[8px] font-black uppercase mt-1'>Photo</span>
                    </div>
                  )}
                  <input id='wiz-passport' type='file' accept='image/*' className='hidden' onChange={handlePassport} />
                </label>
                <p className='text-[9px] font-bold uppercase tracking-wide text-slate-400'>Passport photo (optional)</p>
                {passport && (
                  <button type='button' onClick={() => setValue('passport', '')} className='flex items-center gap-1 text-[9px] font-black uppercase text-rose-500'>
                    <Trash2 size={11} /> Remove
                  </button>
                )}
                {uploadingPhoto && <p className='text-[10px] font-bold text-[#002EFF]'>Uploading photo…</p>}
                {errors.passport && <p className='text-[10px] font-bold text-rose-500'>{errors.passport.message as string}</p>}
              </div>

              {input('fullname', 'Full Name *', 'John Doe', 'text', User)}
              {input('email', 'Email Address *', 'you@example.com', 'email', AtSign)}
              {input('whatsapp', 'WhatsApp Number *', '08012345678', 'text', Phone, { numeric: true, maxLength: 11 })}

              <div className='space-y-1.5'>
                <label className='text-[10px] font-bold text-slate-500 uppercase'>Gender *</label>
                <div className='grid grid-cols-2 gap-2'>
                  {GENDERS.map((g) => (
                    <div key={g} onClick={() => setValue('gender', g, { shouldValidate: true })} className={pill(gender === g)}>
                      {g}
                    </div>
                  ))}
                </div>
                {errors.gender && <p className='text-[10px] font-bold text-rose-500'>{errors.gender.message}</p>}
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                {input('dob', 'Date of Birth *', '', 'date')}
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-bold text-slate-500 uppercase'>State of Residence *</label>
                  <select {...register('state')} className='w-full h-11 px-3 rounded-lg bg-slate-50 border border-transparent focus:bg-white outline-none text-sm font-medium'>
                    <option value=''>Select your state</option>
                    {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.state && <p className='text-[10px] font-bold text-rose-500'>{errors.state.message}</p>}
                </div>
              </div>

              <div className='space-y-1.5'>
                <label className='text-[10px] font-bold text-slate-500 uppercase'>Password *</label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' size={14} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    {...register('password')}
                    placeholder='••••••••'
                    className='w-full h-11 pl-9 pr-10 rounded-lg bg-slate-50 border border-transparent focus:bg-white outline-none text-sm font-medium'
                  />
                  <button type='button' onClick={() => setShowPass(!showPass)} className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400' aria-label={showPass ? 'Hide password' : 'Show password'}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className='text-[10px] font-bold text-rose-500'>{errors.password.message}</p>}
              </div>
              {input('confirmPassword', 'Confirm Password *', '••••••••', 'password')}
            </>
          )}

          {step === 2 && (
            <>
              <h3 className='text-sm font-black text-slate-800'>Your studies</h3>

              {input('school', 'Current School / Institution *', 'e.g. Government College', 'text')}

              <div className='space-y-1.5'>
                <label className='text-[10px] font-bold text-slate-500 uppercase'>Current Class / Level *</label>
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
                  {CLASS_LEVELS.map((c) => {
                    const closedClass = CLASS_LEVELS_CLOSED.includes(c)
                    return (
                      <div
                        key={c}
                        role='radio'
                        aria-checked={classLevel === c}
                        aria-disabled={closedClass}
                        onClick={() => { if (!closedClass) setValue('classLevel', c, { shouldValidate: true }) }}
                        className={cn(pill(classLevel === c), closedClass && 'opacity-50 cursor-not-allowed hover:bg-white')}
                      >
                        {c}
                        {closedClass && <span className='ml-1 font-medium text-slate-400'>· not open yet</span>}
                      </div>
                    )
                  })}
                </div>
                {errors.classLevel && <p className='text-[10px] font-bold text-rose-500'>{errors.classLevel.message}</p>}
              </div>

              <div className='space-y-1.5'>
                <label className='text-[10px] font-bold text-slate-500 uppercase'>Preferred Learning Mode *</label>
                <div className='grid grid-cols-2 gap-2'>
                  {LEARNING_MODES.map((m) => (
                    <div key={m} onClick={() => setValue('learningMode', m, { shouldValidate: true })} className={pill(learningMode === m)}>
                      {m}
                    </div>
                  ))}
                </div>
                {errors.learningMode && <p className='text-[10px] font-bold text-rose-500'>{errors.learningMode.message}</p>}
              </div>

              <div className='space-y-1.5'>
                <label className='text-[10px] font-bold text-slate-500 uppercase'>Programme * <span className='normal-case font-medium text-slate-400'>— choose one</span></label>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                  {SIGNUP_PROGRAMMES.map((p) => {
                    const active = programmes.includes(p)
                    const closed = SIGNUP_PROGRAMMES_CLOSED.includes(p)
                    const notForClass = !programmeAllowed(classLevel, p)
                    const blocked = closed || notForClass
                    return (
                      <div
                        key={p}
                        role='checkbox'
                        aria-checked={active}
                        aria-disabled={blocked}
                        onClick={() => { if (!blocked) toggleProgramme(p) }}
                        className={cn(
                          'p-3 rounded-xl border flex items-center gap-2 transition-all',
                          active
                            ? 'bg-blue-50 border-[#002EFF] cursor-pointer'
                            : blocked
                              ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'
                              : 'bg-white border-slate-100 hover:bg-slate-50 cursor-pointer',
                        )}
                      >
                        <div className={cn('h-4 w-4 rounded flex items-center justify-center shrink-0', active ? 'bg-[#002EFF] text-white' : 'border border-slate-300')}>
                          {active && <CheckCircle2 size={12} />}
                        </div>
                        <span className={cn('text-[11px] font-bold', active ? 'text-[#002EFF]' : 'text-slate-600')}>
                          {p}
                          {closed && <span className='ml-1 font-medium text-slate-400'>· not open yet</span>}
                          {!closed && notForClass && <span className='ml-1 font-medium text-slate-400'>· not for your class</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className='text-[10px] font-bold text-slate-400'>
                  {programmeHint(classLevel) ??
                    (programmes.length ? `${programmes[0]} selected` : 'Pick one programme')}
                </p>
                {errors.programmes && <p className='text-[10px] font-bold text-rose-500'>{errors.programmes.message as string}</p>}
              </div>

              {needsDepartment(classLevel, programmes) && (
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-bold text-slate-500 uppercase'>Department *</label>
                  <div className='grid grid-cols-3 gap-2'>
                    {DEPARTMENTS.map((d) => (
                      <div key={d.value} onClick={() => setValue('department', d.value, { shouldValidate: true })} className={pill(department === d.value)}>
                        {d.label}
                      </div>
                    ))}
                  </div>
                  <p className='text-[10px] font-medium text-slate-400'>So you only see your subjects and timetable.</p>
                  {errors.department && <p className='text-[10px] font-bold text-rose-500'>{errors.department.message as string}</p>}
                </div>
              )}

              {/* Terms — a checkbox, with the full text a tap away */}
              <div className='rounded-xl border border-slate-100 bg-slate-50 p-3'>
                <label className='flex items-start gap-3 cursor-pointer'>
                  <input type='checkbox' {...register('acceptTerms')} className='mt-0.5 h-5 w-5 shrink-0 accent-[#002EFF]' />
                  <span className='text-[11px] font-bold leading-snug text-slate-600'>
                    I accept the DSA{' '}
                    <button
                      type='button'
                      onClick={() => setTermsOpen(true)}
                      className='text-[#002EFF] underline underline-offset-2 hover:text-blue-700'
                    >
                      Terms &amp; Conditions
                    </button>
                  </span>
                </label>
                {errors.acceptTerms && <p className='mt-1.5 text-[10px] font-bold text-rose-500'>{errors.acceptTerms.message as string}</p>}
              </div>

              <div className='flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100'>
                <ShieldCheck className='text-[#002EFF] shrink-0' size={18} />
                <p className='text-[10px] font-bold text-slate-500'>
                  <span className='font-black text-[#002EFF] uppercase'>Free to join.</span>{' '}
                  We&apos;ll email you a code to verify your account. Your parent or
                  guardian&apos;s details can be added from your portal afterwards.
                </p>
              </div>

              <button
                type='button'
                onClick={() => completeRegistration()}
                disabled={busy}
                className='w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#002EFF] text-white font-black text-[11px] uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60'
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className='animate-spin' /> {status || 'Creating your account…'}
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </>
          )}
        </motion.div>
      </div>

      {/* Nav */}
      <div className='flex items-center gap-3 pt-2'>
        {step === 2 && (
          <button type='button' onClick={back} disabled={busy} className='flex items-center gap-1 px-5 h-12 rounded-xl border border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-slate-50 disabled:opacity-50'>
            <ArrowLeft size={15} /> Back
          </button>
        )}
        {step === 1 && (
          <button type='button' onClick={next} className='flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-[#002EFF] text-white font-black text-[11px] uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all'>
            Continue <ArrowRight size={15} />
          </button>
        )}
      </div>

      <TermsDialog
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => setValue('acceptTerms', true as const, { shouldValidate: true })}
      />
      {/* Keeps the compiler honest about the watched value being used. */}
      <span className='hidden' aria-hidden data-accepted={acceptTerms ? '1' : '0'} />
    </div>
  )
}
