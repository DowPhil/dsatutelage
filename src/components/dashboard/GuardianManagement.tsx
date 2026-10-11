'use client'

// Guardians — list, search, view, create, edit, re-link, suspend — for the
// admin and for staff whose role allows it (guardians.view / .create /
// .manage). Live data only: nothing here invents or stores guardians in the
// browser. The server checks every action again, including that a guardian is
// only ever linked to a student the caller may manage.
//
// One guardian account is linked to one student (the data model's
// linkedStudentId); several guardians may share a student.

import { useCallback, useEffect, useState } from 'react'
import {
  Contact,
  Search,
  Plus,
  Eye,
  Pencil,
  UserX,
  UserCheck,
  Trash2,
  Loader2,
  X,
  Mail,
  Phone,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { adminApi } from '@/lib/admin-api'

export interface GuardianAccess {
  canCreate: boolean
  /** Edit, re-link, suspend / reactivate. */
  canManage: boolean
  /** Delete — admin only. */
  canDelete: boolean
}

const FULL: GuardianAccess = { canCreate: true, canManage: true, canDelete: true }

interface Ward {
  id: string
  studentId: string
  fullname: string
  level: string | null
  examTrack: string | null
}

interface Guardian {
  id: string
  fullname: string
  email: string
  phone: string
  username: string
  status: string
  createdAt: string
  wardId: string | null
  ward: Ward | null
}

interface StudentOption {
  studentId: string
  fullname: string
  level: string
}

const PAGE = 20
const str = (v: unknown) => (v == null ? '' : String(v))

function toGuardian(r: Record<string, unknown>): Guardian {
  const w = (r.ward ?? null) as Record<string, unknown> | null
  return {
    id: str(r.id ?? r._id),
    fullname: str(r.fullname ?? r.fullName) || 'Guardian',
    email: str(r.email),
    phone: str(r.phoneNumber ?? r.phone),
    username: str(r.username),
    status: str(r.status) || 'active',
    createdAt: str(r.createdAt),
    wardId: r.wardId ? str(r.wardId) : r.linkedStudentId ? str(r.linkedStudentId) : null,
    ward: w
      ? {
          id: str(w.id ?? w._id),
          studentId: str(w.studentId),
          fullname: str(w.fullname) || 'Student',
          level: w.level ? str(w.level) : null,
          examTrack: w.examTrack ? str(w.examTrack) : null,
        }
      : null,
  }
}

const TRACK: Record<string, string> = {
  jamb: 'JAMB',
  waec: 'WAEC',
  postutme: 'Post-UTME',
  undergrad: 'Undergrad',
  preclinical: 'Preclinical',
  afterschool: 'After-School',
}

function wardLine(w: Ward | null) {
  if (!w) return ''
  return [w.level, w.examTrack ? TRACK[w.examTrack] ?? w.examTrack : null].filter(Boolean).join(' · ')
}

const input =
  'w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#002EFF] transition-all'

export default function GuardianManagement({
  access,
  scopeNote,
}: {
  access?: Partial<GuardianAccess>
  /** One line under the title (e.g. which students staff may link). */
  scopeNote?: string
} = {}) {
  const can: GuardianAccess = { ...FULL, ...access }
  const [rows, setRows] = useState<Guardian[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Guardian | null>(null)
  const [editing, setEditing] = useState<Guardian | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = (await adminApi.getUsers({
        role: 'parent',
        search: applied || undefined,
        status: status || undefined,
        page,
        limit: PAGE,
      })) as unknown as { data?: Record<string, unknown>[]; count?: number }
      const list = Array.isArray(res?.data) ? res.data : []
      setRows(list.map(toGuardian))
      setTotal(typeof res?.count === 'number' ? res.count : list.length)
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Could not load guardians.')
    } finally {
      setLoading(false)
    }
  }, [applied, status, page])

  useEffect(() => {
    void load()
  }, [load])

  const pages = Math.max(1, Math.ceil(total / PAGE))

  const changeStatus = async (g: Guardian, next: 'active' | 'suspended') => {
    setBusyId(g.id)
    setNotice(null)
    try {
      await adminApi.updateUserStatus(g.id, { status: next })
      setRows((prev) => prev.map((r) => (r.id === g.id ? { ...r, status: next } : r)))
      setNotice({ ok: true, text: `${g.fullname} ${next === 'active' ? 'reactivated' : 'suspended'}.` })
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Could not change the status.' })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (g: Guardian) => {
    if (!window.confirm(`Delete the guardian account for ${g.fullname}? They will no longer be able to sign in.`)) return
    setBusyId(g.id)
    setNotice(null)
    try {
      await adminApi.deleteUser(g.id)
      setNotice({ ok: true, text: `${g.fullname} was deleted.` })
      await load()
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Could not delete the guardian.' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className='max-w-6xl mx-auto space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Contact size={22} className='text-[#002EFF]' />
          <h1 className='text-2xl font-black text-slate-900 tracking-tight'>Guardians</h1>
          <span className='text-[10px] font-black uppercase text-slate-400 ml-2'>{total} Total</span>
        </div>
        {can.canCreate && (
          <button
            type='button'
            onClick={() => {
              setNotice(null)
              setCreating(true)
            }}
            className='flex items-center gap-1.5 px-3.5 py-2 bg-[#002EFF] text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95'
          >
            <Plus size={14} /> Add Guardian
          </button>
        )}
      </div>
      {scopeNote && <p className='-mt-2 text-[11px] font-bold text-slate-400'>{scopeNote}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setApplied(search.trim())
        }}
        className='flex flex-wrap items-center gap-2'
      >
        <div className='relative flex-1 min-w-[12rem]'>
          <Search size={14} className='absolute left-3.5 top-3 text-slate-400' />
          <input
            type='text'
            placeholder='Name, email or phone'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label='Search guardians'
            className='w-full h-10 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#002EFF] transition-all'
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          aria-label='Status'
          className='h-10 px-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 outline-none focus:border-[#002EFF]'
        >
          <option value=''>All statuses</option>
          <option value='active'>Active</option>
          <option value='suspended'>Suspended</option>
        </select>
        <button type='submit' className='px-4 h-10 bg-slate-900 text-white font-black text-[10px] uppercase rounded-xl hover:bg-slate-800 transition-all'>
          Search
        </button>
        {(applied || status) && (
          <button
            type='button'
            onClick={() => {
              setSearch('')
              setApplied('')
              setStatus('')
              setPage(1)
            }}
            className='h-10 px-3 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase hover:text-[#002EFF]'
          >
            Clear
          </button>
        )}
      </form>

      {notice && (
        <p
          role='status'
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold ${
            notice.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {notice.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {notice.text}
        </p>
      )}

      {loading ? (
        <div className='py-12 flex justify-center bg-white rounded-2xl border border-slate-100' aria-busy='true'>
          <Loader2 className='animate-spin text-[#002EFF]' />
        </div>
      ) : error ? (
        <div className='bg-white rounded-2xl border border-rose-100 p-8 text-center' role='alert'>
          <p className='text-xs font-black text-rose-600'>The guardian list could not be loaded</p>
          <p className='mt-1 text-[11px] font-medium text-slate-500'>{error}</p>
          <button type='button' onClick={() => void load()} className='mt-3 h-9 px-4 rounded-lg bg-[#002EFF] text-white text-[10px] font-black uppercase hover:bg-blue-700'>
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className='bg-white rounded-2xl border border-slate-100 p-10 text-center'>
          <p className='text-xs font-bold text-slate-400'>
            {applied || status ? 'No guardians match these filters.' : 'No guardians yet.'}
          </p>
        </div>
      ) : (
        <div className='bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[720px] text-left'>
              <thead className='bg-slate-50'>
                <tr className='text-[9px] font-black uppercase text-slate-400'>
                  <th className='px-4 py-3'>Guardian</th>
                  <th className='px-4 py-3'>Contact</th>
                  <th className='px-4 py-3'>Linked student</th>
                  <th className='px-4 py-3'>Status</th>
                  <th className='px-4 py-3 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const suspended = g.status === 'suspended'
                  const busy = busyId === g.id
                  return (
                    <tr key={g.id} className='border-t border-slate-50 align-top'>
                      <td className='px-4 py-3'>
                        <p className='text-[12px] font-black text-slate-800'>{g.fullname}</p>
                        <p className='text-[10px] font-bold text-slate-400'>@{g.username || '—'}</p>
                      </td>
                      <td className='px-4 py-3 text-[11px] font-bold text-slate-600'>
                        <p className='flex items-center gap-1.5'><Mail size={11} className='text-slate-400' />{g.email || '—'}</p>
                        <p className='mt-0.5 flex items-center gap-1.5'><Phone size={11} className='text-slate-400' />{g.phone || '—'}</p>
                      </td>
                      <td className='px-4 py-3'>
                        {g.ward ? (
                          <>
                            <p className='text-[11px] font-black text-slate-800'>{g.ward.fullname}</p>
                            <p className='text-[10px] font-bold text-slate-400'>
                              {g.ward.studentId}
                              {wardLine(g.ward) ? ` · ${wardLine(g.ward)}` : ''}
                            </p>
                          </>
                        ) : (
                          <p className='text-[11px] font-bold text-amber-600'>{g.wardId ? `${g.wardId} (not found)` : 'Not linked'}</p>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        <Badge className={`text-[9px] font-black uppercase ${suspended ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {suspended ? 'Suspended' : 'Active'}
                        </Badge>
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center justify-end gap-1'>
                          {busy ? (
                            <Loader2 size={14} className='animate-spin text-slate-400' />
                          ) : (
                            <>
                              <button type='button' onClick={() => setViewing(g)} title='View details' aria-label={`View ${g.fullname}`} className='p-1.5 rounded-lg text-slate-500 hover:bg-slate-100'>
                                <Eye size={14} />
                              </button>
                              {can.canManage && (
                                <>
                                  <button type='button' onClick={() => { setNotice(null); setEditing(g) }} title='Edit' aria-label={`Edit ${g.fullname}`} className='p-1.5 rounded-lg text-[#002EFF] hover:bg-blue-50'>
                                    <Pencil size={14} />
                                  </button>
                                  {suspended ? (
                                    <button type='button' onClick={() => changeStatus(g, 'active')} title='Reactivate' aria-label={`Reactivate ${g.fullname}`} className='p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50'>
                                      <UserCheck size={14} />
                                    </button>
                                  ) : (
                                    <button type='button' onClick={() => changeStatus(g, 'suspended')} title='Suspend' aria-label={`Suspend ${g.fullname}`} className='p-1.5 rounded-lg text-amber-600 hover:bg-amber-50'>
                                      <UserX size={14} />
                                    </button>
                                  )}
                                </>
                              )}
                              {can.canDelete && (
                                <button type='button' onClick={() => remove(g)} title='Delete' aria-label={`Delete ${g.fullname}`} className='p-1.5 rounded-lg text-rose-500 hover:bg-rose-50'>
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className='flex items-center justify-between border-t border-slate-100 px-4 py-3'>
              <p className='text-[10px] font-bold text-slate-400'>Page {page} of {pages}</p>
              <div className='flex gap-1'>
                <button type='button' disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label='Previous page' className='p-1.5 rounded-lg border border-slate-200 disabled:opacity-40'>
                  <ChevronLeft size={14} />
                </button>
                <button type='button' disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label='Next page' className='p-1.5 rounded-lg border border-slate-200 disabled:opacity-40'>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewing && <GuardianDetails g={viewing} onClose={() => setViewing(null)} />}
      {(creating || editing) && (
        <GuardianForm
          guardian={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={async (text) => {
            setCreating(false)
            setEditing(null)
            setNotice({ ok: true, text })
            if (!editing) setPage(1)
            await load()
          }}
        />
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm' role='dialog' aria-modal='true' aria-label={title}>
      <div className='w-full max-w-lg max-h-[94dvh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-100'>
        <div className='sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white/95'>
          <p className='text-sm font-black text-slate-900'>{title}</p>
          <button type='button' onClick={onClose} aria-label='Close' className='p-1.5 rounded-lg text-slate-400 hover:bg-slate-100'>
            <X size={16} />
          </button>
        </div>
        <div className='p-5'>{children}</div>
      </div>
    </div>
  )
}

function GuardianDetails({ g, onClose }: { g: Guardian; onClose: () => void }) {
  const row = (label: string, value: string) => (
    <div className='flex justify-between gap-3 border-b border-slate-50 py-2 text-[11px]'>
      <span className='font-black uppercase text-[9px] text-slate-400'>{label}</span>
      <span className='font-bold text-slate-700 text-right break-all'>{value || '—'}</span>
    </div>
  )
  return (
    <Modal title={g.fullname} onClose={onClose}>
      {row('Username', g.username ? `@${g.username}` : '')}
      {row('Email', g.email)}
      {row('Phone', g.phone)}
      {row('Status', g.status === 'suspended' ? 'Suspended' : 'Active')}
      {row('Joined', g.createdAt ? new Date(g.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')}
      <div className='mt-4 rounded-2xl bg-slate-50 p-4'>
        <p className='flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400'>
          <GraduationCap size={12} className='text-[#002EFF]' /> Linked student
        </p>
        {g.ward ? (
          <>
            <p className='mt-1 text-[13px] font-black text-slate-800'>{g.ward.fullname}</p>
            <p className='text-[11px] font-bold text-slate-500'>
              {g.ward.studentId}
              {wardLine(g.ward) ? ` · ${wardLine(g.ward)}` : ''}
            </p>
          </>
        ) : (
          <p className='mt-1 text-[11px] font-bold text-amber-600'>{g.wardId ? `${g.wardId} — student not found` : 'Not linked to a student'}</p>
        )}
      </div>
    </Modal>
  )
}

/** Create a guardian, or edit one (name, email, phone, linked student). */
function GuardianForm({
  guardian,
  onClose,
  onSaved,
}: {
  guardian: Guardian | null
  onClose: () => void
  onSaved: (message: string) => void | Promise<void>
}) {
  const editing = !!guardian
  const [fullname, setFullname] = useState(guardian?.fullname ?? '')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState(guardian?.email ?? '')
  const [phone, setPhone] = useState(guardian?.phone ?? '')
  const [password, setPassword] = useState('')
  const [ward, setWard] = useState<StudentOption | null>(
    guardian?.ward ? { studentId: guardian.ward.studentId, fullname: guardian.ward.fullname, level: guardian.ward.level ?? '' } : null,
  )
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<StudentOption[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Students to link: searched on the server, which only returns students the
  // caller may manage (for staff, the staff roster).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setOptions([])
      return
    }
    let alive = true
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = (await adminApi.getUsers({ role: 'student', search: q, limit: 8, status: 'active' })) as unknown as {
          data?: Record<string, unknown>[]
        }
        if (!alive) return
        setOptions(
          (res?.data ?? [])
            .map((s) => ({ studentId: str(s.studentId), fullname: str(s.fullname ?? s.fullName) || 'Student', level: str(s.level ?? s.currentLevel) }))
            .filter((s) => s.studentId),
        )
      } catch {
        if (alive) setOptions([])
      } finally {
        if (alive) setSearching(false)
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query])

  const validate = (): string | null => {
    if (fullname.trim().length < 2) return 'Enter the guardian’s full name (at least 2 characters).'
    if (!editing && !/^[a-zA-Z0-9_]{3,}$/.test(username)) return 'Username: at least 3 letters, numbers or underscores.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'Enter a valid email address.'
    if (!/^\+?\d{10,15}$/.test(phone.replace(/\s+/g, ''))) return 'Enter a valid phone number (10–15 digits).'
    if (!editing && password.length < 6) return 'The password must be at least 6 characters.'
    if (!ward) return 'Choose the student this guardian is responsible for.'
    return null
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validate()
    if (problem) return setError(problem)
    setSaving(true)
    setError('')
    try {
      if (editing && guardian) {
        const changes: Record<string, unknown> = {}
        if (fullname.trim() !== guardian.fullname) changes.fullname = fullname.trim()
        if (email.trim().toLowerCase() !== guardian.email.toLowerCase()) changes.email = email.trim().toLowerCase()
        if (phone.replace(/\s+/g, '') !== guardian.phone) changes.phoneNumber = phone.replace(/\s+/g, '')
        if (ward && ward.studentId !== (guardian.ward?.studentId ?? guardian.wardId)) changes.wardId = ward.studentId
        if (!Object.keys(changes).length) {
          setSaving(false)
          return onClose()
        }
        await adminApi.updateUser(guardian.id, changes)
        await onSaved(`${fullname.trim()} was updated.`)
      } else {
        await adminApi.createStaff({
          role: 'parent',
          fullname: fullname.trim(),
          username: username.toLowerCase(),
          email: email.trim().toLowerCase(),
          phoneNumber: phone.replace(/\s+/g, ''),
          password,
          wardId: ward!.studentId,
        })
        await onSaved(`Guardian ${fullname.trim()} created for ${ward!.fullname}. They can sign in with ${email.trim().toLowerCase()}.`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save the guardian.'
      setError(/duplicate/i.test(msg) ? 'That email, username or phone number is already used by another account.' : msg)
    } finally {
      setSaving(false)
    }
  }

  const label = 'mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400'
  return (
    <Modal title={editing ? `Edit ${guardian!.fullname}` : 'Add Guardian'} onClose={onClose}>
      <form onSubmit={save} className='space-y-3' noValidate>
        <div>
          <label className={label} htmlFor='g-name'>Full name</label>
          <input id='g-name' className={input} value={fullname} onChange={(e) => setFullname(e.target.value)} />
        </div>
        {!editing && (
          <div>
            <label className={label} htmlFor='g-user'>Username</label>
            <input id='g-user' className={input} value={username} onChange={(e) => setUsername(e.target.value.trim())} autoComplete='off' />
          </div>
        )}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <div>
            <label className={label} htmlFor='g-email'>Email</label>
            <input id='g-email' type='email' className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor='g-phone'>Phone</label>
            <input id='g-phone' inputMode='tel' className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        {!editing && (
          <div>
            <label className={label} htmlFor='g-pass'>Temporary password</label>
            <input id='g-pass' type='text' className={input} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete='new-password' />
          </div>
        )}
        <div>
          <span className={label}>Linked student</span>
          {ward ? (
            <div className='flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2'>
              <div>
                <p className='text-[12px] font-black text-slate-800'>{ward.fullname}</p>
                <p className='text-[10px] font-bold text-slate-500'>{ward.studentId}{ward.level ? ` · ${ward.level}` : ''}</p>
              </div>
              <button type='button' onClick={() => setWard(null)} className='text-[10px] font-black uppercase text-[#002EFF] hover:underline'>
                Change
              </button>
            </div>
          ) : (
            <div className='space-y-1'>
              <input
                className={input}
                placeholder='Search students by name or ID'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label='Search students to link'
              />
              {searching && <p className='text-[10px] font-bold text-slate-400'>Searching…</p>}
              {!searching && query.trim().length >= 2 && options.length === 0 && (
                <p className='text-[10px] font-bold text-slate-400'>No matching students you can link.</p>
              )}
              {options.map((o) => (
                <button
                  key={o.studentId}
                  type='button'
                  onClick={() => {
                    setWard(o)
                    setQuery('')
                  }}
                  className='flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-left hover:border-[#002EFF]/40'
                >
                  <span className='text-[11px] font-black text-slate-700'>{o.fullname}</span>
                  <span className='text-[10px] font-bold text-slate-400'>{o.studentId}{o.level ? ` · ${o.level}` : ''}</span>
                </button>
              ))}
            </div>
          )}
          <p className='mt-1 text-[10px] font-medium text-slate-400'>
            One student per guardian account. A student can have more than one guardian.
          </p>
        </div>
        {error && (
          <p role='alert' className='rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700'>{error}</p>
        )}
        <div className='flex justify-end gap-2 pt-2'>
          <button type='button' onClick={onClose} className='h-10 px-4 rounded-xl bg-slate-100 text-[10px] font-black uppercase text-slate-600'>
            Cancel
          </button>
          <button type='submit' disabled={saving} className='h-10 px-4 rounded-xl bg-[#002EFF] text-[10px] font-black uppercase text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5'>
            {saving && <Loader2 size={12} className='animate-spin' />}
            {editing ? 'Save changes' : 'Create guardian'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
