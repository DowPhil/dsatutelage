// // Admin-managed staff roles & permissions — browser-local stand-in for the
// // backend (see docs/backend-requests.md §9). The real system must store staff
// // accounts + a role→permissions model and enforce every permission SERVER-SIDE.
// // This file only mocks it so the admin UI is fully clickable today.
// //
// // Same-browser only: staff created here live in localStorage until the backend
// // exposes `POST /api/admin/staff` and a permissions API.

// // ---- Permission catalogue -------------------------------------------------
// // Grouped so the UI can render modules. `key` is what the backend would check
// // (e.g. only a role holding `payments.verify` may confirm a manual payment).

// export interface Permission {
//   key: string
//   label: string
//   module: string
//   sensitive?: boolean // shown with a lock; money / staff-level actions
// }

// // The full catalogue of what an admin can do — every capability is assignable to
// // a role here (Settings → Permissions), so the admin can delegate any subset to
// // a Secretary, Auditor, etc. Keep keys stable (roles reference them); add new
// // capabilities here as the admin panel grows.
// export const PERMISSIONS: Permission[] = [
//   // Students
//   { key: 'students.view', label: 'View students', module: 'Students' },
//   { key: 'students.manage', label: 'Manage student records', module: 'Students' },

//   // People (tutors & guardians)
//   { key: 'tutors.view', label: 'View tutors', module: 'People' },
//   { key: 'tutors.create', label: 'Create tutors', module: 'People' },
//   { key: 'guardians.view', label: 'View guardians', module: 'People' },
//   { key: 'guardians.create', label: 'Create guardians', module: 'People' },

//   // Academics
//   { key: 'courses.manage', label: 'Manage courses & tutor assignments', module: 'Academics' },
//   { key: 'quizzes.manage', label: 'Build / manage quizzes', module: 'Academics' },
//   { key: 'quizzes.create', label: 'Create quizzes', module: 'Academics' },
//   { key: 'quizzes.delete', label: 'Delete quizzes', module: 'Academics' },
//   { key: 'library.manage', label: 'Manage learning library', module: 'Academics' },
//   { key: 'attendance.manage', label: 'Activate / close attendance', module: 'Academics' },
//   { key: 'timetable.view', label: 'View timetable', module: 'Academics' },
//   { key: 'timetable.edit', label: 'Create / edit timetable', module: 'Academics' },

//   // Engagement
//   { key: 'announcements.send', label: 'Send announcements', module: 'Engagement' },
//   { key: 'community.moderate', label: 'Moderate community', module: 'Engagement' },
//   { key: 'reports.view', label: 'View reports & analytics', module: 'Engagement' },
//   { key: 'support.view', label: 'View support tickets', module: 'Engagement' },
//   { key: 'support.manage', label: 'Close / reopen support tickets', module: 'Engagement' },

//   // Finance
//   { key: 'payments.history', label: 'View payment history', module: 'Finance' },
//   { key: 'payments.view', label: 'View payments & revenue', module: 'Finance' },
//   { key: 'payments.verify', label: 'Verify / approve manual payments', module: 'Finance', sensitive: true },
//   { key: 'payments.manage', label: 'Manage plans & access caps', module: 'Finance', sensitive: true },

//   // System
//   { key: 'staff.manage', label: 'Create / manage staff', module: 'System', sensitive: true },
//   { key: 'roles.manage', label: 'Manage roles & permissions', module: 'System', sensitive: true },
// ]

// export const PERMISSION_MODULES = Array.from(
//   new Set(PERMISSIONS.map((p) => p.module)),
// )

// export function permissionLabel(key: string): string {
//   return PERMISSIONS.find((p) => p.key === key)?.label ?? key
// }

// // ---- Roles ----------------------------------------------------------------
// // Roles are DATA, not a hardcoded enum — the admin can add new ones. The two
// // below are seeded examples the client asked for (secretary, auditor).

// export interface StaffRole {
//   id: string
//   name: string
//   permissions: string[]
//   seeded?: boolean // seeded roles can be edited but not deleted
// }

// const SEED_ROLES: StaffRole[] = [
//   {
//     id: 'secretary',
//     name: 'Secretary',
//     seeded: true,
//     permissions: [
//       'payments.verify',
//       'timetable.edit',
//       'timetable.view',
//       'attendance.manage',
//       'students.manage',
//       'students.view',
//       'announcements.send',
//     ],
//   },
//   {
//     id: 'auditor',
//     name: 'Auditor',
//     seeded: true,
//     permissions: [
//       'payments.history',
//       'payments.view',
//       'reports.view',
//       'students.view',
//       'timetable.view',
//     ],
//   },
// ]

// // ---- Staff accounts -------------------------------------------------------

// export interface StaffMember {
//   id: string
//   name: string
//   email: string
//   roleId: string
//   password: string // demo stand-in; the backend must hash & never return it
//   createdAt: string // ISO
//   seeded?: boolean // seeded accounts can't be removed
// }

// const ROLES_KEY = 'dsa_staff_roles'
// const STAFF_KEY = 'dsa_staff_members'

// // Seeded staff so the owner can preview the staff dashboard with one click,
// // on every device (like the demo student logins). Password matches the other
// // demos. Admin-created staff live only in this browser until the backend exists.
// // No seeded staff — auditor/secretary and other staff accounts are created by
// // the admin under "Permissions → Provision New Access".
// const SEED_STAFF: StaffMember[] = []

// function read<T>(key: string, fallback: T): T {
//   if (typeof window === 'undefined') return fallback
//   try {
//     const raw = localStorage.getItem(key)
//     return raw ? (JSON.parse(raw) as T) : fallback
//   } catch {
//     return fallback
//   }
// }

// function write(key: string, value: unknown): void {
//   if (typeof window === 'undefined') return
//   localStorage.setItem(key, JSON.stringify(value))
// }

// // Deterministic id (no Math.random / Date.now in render paths). Time is fine
// // inside an event handler, but we keep it simple + collision-resistant enough.
// function slugId(name: string): string {
//   const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
//   return base || 'role'
// }

// // ---- Roles API ------------------------------------------------------------

// /** Seeded roles merged with any admin-created / admin-edited roles. */
// export function getRoles(): StaffRole[] {
//   const stored = read<StaffRole[]>(ROLES_KEY, [])
//   const byId = new Map<string, StaffRole>()
//   for (const r of SEED_ROLES) byId.set(r.id, r)
//   // Stored entries override the seed (so edited permissions persist) and add new roles.
//   for (const r of stored) {
//     if (r?.id) byId.set(r.id, { ...r, seeded: byId.get(r.id)?.seeded })
//   }
//   return Array.from(byId.values())
// }

// export function getRole(id: string): StaffRole | undefined {
//   return getRoles().find((r) => r.id === id)
// }

// /** Create a new role or overwrite an existing one's permissions. */
// export function saveRole(role: { id?: string; name: string; permissions: string[] }): StaffRole {
//   const id = role.id || slugId(role.name)
//   const stored = read<StaffRole[]>(ROLES_KEY, [])
//   const next = stored.filter((r) => r.id !== id)
//   const saved: StaffRole = { id, name: role.name, permissions: role.permissions }
//   write(ROLES_KEY, [...next, saved])
//   return saved
// }

// /** Delete a non-seeded role (and detach it from any staff). */
// export function deleteRole(id: string): void {
//   if (SEED_ROLES.some((r) => r.id === id)) return
//   write(
//     ROLES_KEY,
//     read<StaffRole[]>(ROLES_KEY, []).filter((r) => r.id !== id),
//   )
// }

// // ---- Staff API ------------------------------------------------------------

// /** Seeded demo staff merged with any admin-created accounts (seed wins by id). */
// export function getStaff(): StaffMember[] {
//   const stored = read<StaffMember[]>(STAFF_KEY, [])
//   const seedIds = new Set(SEED_STAFF.map((s) => s.id))
//   const seedEmails = new Set(SEED_STAFF.map((s) => s.email))
//   const extras = stored.filter(
//     (s) => s?.id && !seedIds.has(s.id) && !seedEmails.has(s.email),
//   )
//   return [...SEED_STAFF, ...extras]
// }

// /** Add a staff member. Returns null if the email already exists. */
// export function addStaff(input: {
//   name: string
//   email: string
//   roleId: string
//   password: string
//   now: number // pass Date.now() from the event handler
// }): StaffMember | null {
//   const email = input.email.trim().toLowerCase()
//   if (getStaff().some((s) => s.email === email)) return null
//   const stored = read<StaffMember[]>(STAFF_KEY, [])
//   const member: StaffMember = {
//     id: `${slugId(input.name)}-${input.now.toString(36)}`,
//     name: input.name.trim(),
//     email,
//     roleId: input.roleId,
//     password: input.password,
//     createdAt: new Date(input.now).toISOString(),
//   }
//   write(STAFF_KEY, [...stored, member])
//   return member
// }

// export function removeStaff(id: string): void {
//   if (SEED_STAFF.some((s) => s.id === id)) return // seeded demo accounts stay
//   write(
//     STAFF_KEY,
//     read<StaffMember[]>(STAFF_KEY, []).filter((s) => s.id !== id),
//   )
// }

// // ---- Login & permission resolution (browser-local stand-in) ---------------

// /** The seeded demo staff, for the one-click preview buttons on the sign-in page. */
// export function getDemoStaff(): StaffMember[] {
//   return SEED_STAFF
// }

// export function getStaffByEmail(email: string): StaffMember | undefined {
//   const e = email.trim().toLowerCase()
//   return getStaff().find((s) => s.email === e)
// }

// /** Match staff credentials (case-insensitive email). Returns null if no match. */
// export function findStaffLogin(
//   email: string,
//   password: string,
// ): StaffMember | null {
//   const member = getStaffByEmail(email)
//   return member && member.password === password ? member : null
// }

// /** The permissions a staff member holds, resolved live from their role. */
// export function getPermissionsForStaff(email: string): string[] {
//   const member = getStaffByEmail(email)
//   if (!member) return []
//   return getRole(member.roleId)?.permissions ?? []
// }

// export function can(email: string, permission: string): boolean {
//   return getPermissionsForStaff(email).includes(permission)
// }





// src/lib/staffStore.ts
//
// Admin-managed staff roles & permissions.
//
// IMPORTANT:
// This file contains the LOCAL fallback/demo implementation used by parts
// of the frontend that still depend on browser storage.
//
// The real production source of truth should be the backend/database.
// Staff accounts, passwords, roles and permissions must be enforced
// server-side.
//
// Passwords are intentionally NOT part of StaffMember anymore.
// The backend should hash passwords and should never return them to the
// frontend.

// -----------------------------------------------------------------------------
// Permission catalogue
// -----------------------------------------------------------------------------

export interface Permission {
  key: string
  label: string
  module: string
  sensitive?: boolean
}

// Full permission catalogue.
//
// `key` is the stable identifier that should also be understood by the
// backend permission middleware.
//
// Example:
// A staff member with `payments.verify` can be allowed to verify payments.
//
// Keep these keys stable once they are used by backend roles.
export const PERMISSIONS: Permission[] = [
  // ---------------------------------------------------------------------------
  // Students
  // ---------------------------------------------------------------------------

  {
    key: 'students.view',
    label: 'View students',
    module: 'Students',
  },

  {
    key: 'students.manage',
    label: 'Manage student records',
    module: 'Students',
  },

  // ---------------------------------------------------------------------------
  // People
  // ---------------------------------------------------------------------------

  {
    key: 'tutors.view',
    label: 'View tutors',
    module: 'People',
  },

  {
    key: 'tutors.create',
    label: 'Create tutors',
    module: 'People',
  },

  {
    key: 'guardians.view',
    label: 'View guardians',
    module: 'People',
  },

  {
    key: 'guardians.create',
    label: 'Create guardians',
    module: 'People',
  },

  {
    key: 'guardians.manage',
    label: 'Edit guardians & their linked student',
    module: 'People',
  },

  // ---------------------------------------------------------------------------
  // Academics
  // ---------------------------------------------------------------------------

  {
    key: 'courses.manage',
    label: 'Manage courses & tutor assignments',
    module: 'Academics',
  },

  {
    key: 'quizzes.manage',
    label: 'Build / manage quizzes',
    module: 'Academics',
  },

  {
    key: 'quizzes.create',
    label: 'Create quizzes',
    module: 'Academics',
  },

  {
    key: 'quizzes.delete',
    label: 'Delete quizzes',
    module: 'Academics',
  },

  {
    key: 'questions.bank',
    label: 'Add / manage question bank',
    module: 'Academics',
  },

  {
    key: 'library.manage',
    label: 'Manage learning library',
    module: 'Academics',
  },

  {
    key: 'attendance.manage',
    label: 'Activate / close attendance',
    module: 'Academics',
  },

  {
    key: 'timetable.view',
    label: 'View timetable',
    module: 'Academics',
  },

  {
    key: 'timetable.edit',
    label: 'Create / edit timetable',
    module: 'Academics',
  },

  // ---------------------------------------------------------------------------
  // Engagement
  // ---------------------------------------------------------------------------

  {
    key: 'announcements.send',
    label: 'Send announcements',
    module: 'Engagement',
  },

  {
    key: 'community.moderate',
    label: 'Moderate community',
    module: 'Engagement',
  },

  {
    key: 'reports.view',
    label: 'View reports & analytics',
    module: 'Engagement',
  },

  {
    key: 'support.view',
    label: 'View support tickets',
    module: 'Engagement',
  },

  {
    key: 'support.manage',
    label: 'Close / reopen support tickets',
    module: 'Engagement',
  },

  // ---------------------------------------------------------------------------
  // Finance
  // ---------------------------------------------------------------------------

  {
    key: 'payments.history',
    label: 'View payment history',
    module: 'Finance',
  },

  {
    key: 'payments.view',
    label: 'View payments & revenue',
    module: 'Finance',
  },

  {
    key: 'payments.verify',
    label: 'Verify / approve manual payments',
    module: 'Finance',
    sensitive: true,
  },

  {
    key: 'payments.manage',
    label: 'Manage plans & access caps',
    module: 'Finance',
    sensitive: true,
  },

  // ---------------------------------------------------------------------------
  // System
  // ---------------------------------------------------------------------------

  {
    key: 'staff.manage',
    label: 'Create / manage staff',
    module: 'System',
    sensitive: true,
  },

  {
    key: 'roles.manage',
    label: 'Manage roles & permissions',
    module: 'System',
    sensitive: true,
  },
]

// Unique permission module names.
//
// Used by the Roles & Permissions UI to group permissions.
export const PERMISSION_MODULES = Array.from(
  new Set(PERMISSIONS.map((permission) => permission.module)),
)

// Convert a permission key into a human-readable label.
export function permissionLabel(key: string): string {
  return (
    PERMISSIONS.find((permission) => permission.key === key)?.label ?? key
  )
}

// -----------------------------------------------------------------------------
// Roles
// -----------------------------------------------------------------------------

// Roles are data rather than a TypeScript enum.
//
// The backend should ultimately be the source of truth for these records.
export interface StaffRole {
  id: string
  name: string
  permissions: string[]

  // Seeded roles are protected from deletion in the local fallback.
  seeded?: boolean
}

// Default roles used by the local fallback.
//
// These can still be displayed while the backend is unavailable.
const SEED_ROLES: StaffRole[] = [
  {
    id: 'secretary',
    name: 'Secretary',
    seeded: true,

    permissions: [
      'payments.verify',
      'timetable.edit',
      'timetable.view',
      'attendance.manage',
      'students.manage',
      'students.view',
      'announcements.send',
      'reports.view',
      'guardians.view',
      'guardians.create',
      'guardians.manage',
    ],
  },

  {
    id: 'auditor',
    name: 'Auditor',
    seeded: true,

    permissions: [
      'payments.history',
      'payments.view',
      'reports.view',
      'students.view',
      'timetable.view',
    ],
  },
]

// -----------------------------------------------------------------------------
// Staff accounts
// -----------------------------------------------------------------------------

// IMPORTANT:
//
// There is intentionally NO `password` property here.
//
// Passwords are credentials and should not be kept in the frontend staff
// directory. The backend should hash them and never return the hash/password
// to this client.
//
// `createdAt` is optional because some backend responses may not include it.
export interface StaffMember {
  id: string
  name: string
  email: string
  roleId: string
  createdAt?: string

  // Used only by the local fallback to protect seeded demo accounts.
  seeded?: boolean
}

// Local-storage keys.
//
// These are retained for compatibility with older frontend code and as a
// fallback when the backend is unavailable.
const ROLES_KEY = 'dsa_staff_roles'
const STAFF_KEY = 'dsa_staff_members'

// No seeded staff accounts.
//
// Staff accounts should be created by the administrator through the backend.
const SEED_STAFF: StaffMember[] = []

// -----------------------------------------------------------------------------
// Local storage helpers
// -----------------------------------------------------------------------------

function read<T>(key: string, fallback: T): T {
  // localStorage does not exist during server-side rendering.
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = localStorage.getItem(key)

    if (!raw) {
      return fallback
    }

    return JSON.parse(raw) as T
  } catch {
    // Invalid localStorage data should never crash the application.
    return fallback
  }
}

function write(key: string, value: unknown): void {
  // localStorage does not exist during server-side rendering.
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(key, JSON.stringify(value))
}

// -----------------------------------------------------------------------------
// ID helper
// -----------------------------------------------------------------------------

// Creates a predictable URL-safe ID from a name.
//
// This is only used by the local fallback.
// Production IDs should be generated by the backend/database.
function slugId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return base || 'role'
}

// -----------------------------------------------------------------------------
// Roles API — LOCAL FALLBACK
// -----------------------------------------------------------------------------

/**
 * Get roles from localStorage and merge them with the seeded roles.
 *
 * Backend-loaded roles should be preferred by RolesPermissions.tsx.
 * This function exists as a fallback for older/local parts of the app.
 */
export function getRoles(): StaffRole[] {
  const stored = read<StaffRole[]>(ROLES_KEY, [])

  const byId = new Map<string, StaffRole>()

  // Add default roles first.
  for (const role of SEED_ROLES) {
    byId.set(role.id, role)
  }

  // Stored roles override seeded roles when they have the same ID.
  for (const role of stored) {
    if (!role?.id) {
      continue
    }

    const existing = byId.get(role.id)

    byId.set(role.id, {
      ...role,

      // Preserve the seeded flag from the original seed.
      seeded: existing?.seeded ?? role.seeded,
    })
  }

  return Array.from(byId.values())
}

/**
 * Get a single local role.
 */
export function getRole(id: string): StaffRole | undefined {
  return getRoles().find((role) => role.id === id)
}

/**
 * Create a new local role or update an existing local role.
 *
 * This is NOT the production backend role API.
 *
 * Production code should use:
 *
 * POST /api/admin/roles
 */
export function saveRole(role: {
  id?: string
  name: string
  permissions: string[]
}): StaffRole {
  const id = role.id || slugId(role.name)

  const stored = read<StaffRole[]>(ROLES_KEY, [])

  const next = stored.filter((item) => item.id !== id)

  const saved: StaffRole = {
    id,
    name: role.name.trim(),
    permissions: Array.from(new Set(role.permissions)),
  }

  write(ROLES_KEY, [...next, saved])

  return saved
}

/**
 * Delete a local non-seeded role.
 *
 * Production deletion should use:
 *
 * DELETE /api/admin/roles/:id
 */
export function deleteRole(id: string): void {
  // Never delete seeded roles.
  if (SEED_ROLES.some((role) => role.id === id)) {
    return
  }

  write(
    ROLES_KEY,
    read<StaffRole[]>(ROLES_KEY, []).filter((role) => role.id !== id),
  )

  // Also remove the role assignment from local staff.
  //
  // We do not delete the staff member itself here.
  // Their roleId is cleared so they are no longer attached to the deleted role.
  const staff = read<StaffMember[]>(STAFF_KEY, [])

  const updatedStaff = staff.map((member) => {
    if (member.roleId !== id) {
      return member
    }

    return {
      ...member,
      roleId: '',
    }
  })

  write(STAFF_KEY, updatedStaff)
}

// -----------------------------------------------------------------------------
// Staff API — LOCAL FALLBACK
// -----------------------------------------------------------------------------

/**
 * Get locally stored staff.
 *
 * Production staff listing should come from the backend.
 */
export function getStaff(): StaffMember[] {
  const stored = read<StaffMember[]>(STAFF_KEY, [])

  const seedIds = new Set(SEED_STAFF.map((staff) => staff.id))

  const seedEmails = new Set(
    SEED_STAFF.map((staff) => staff.email.toLowerCase()),
  )

  const extras = stored.filter((staff) => {
    if (!staff?.id) {
      return false
    }

    const email = staff.email?.toLowerCase()

    return !seedIds.has(staff.id) && !seedEmails.has(email)
  })

  return [...SEED_STAFF, ...extras]
}

/**
 * Add a local staff member.
 *
 * IMPORTANT:
 * This function is kept only for compatibility with old/local frontend code.
 *
 * The production admin page should call:
 *
 * POST /api/admin/staff
 *
 * and then reload the staff list from the backend.
 *
 * Notice that password is accepted here only for backwards compatibility.
 * It is NOT stored in the StaffMember object.
 */
export function addStaff(input: {
  name: string
  email: string
  roleId: string
  password?: string
  now?: number
}): StaffMember | null {
  const email = input.email.trim().toLowerCase()

  // Prevent duplicate local accounts.
  if (getStaff().some((staff) => staff.email.toLowerCase() === email)) {
    return null
  }

  const stored = read<StaffMember[]>(STAFF_KEY, [])

  const timestamp = input.now ?? Date.now()

  const member: StaffMember = {
    id: `${slugId(input.name)}-${timestamp.toString(36)}`,
    name: input.name.trim(),
    email,
    roleId: input.roleId,
    createdAt: new Date(timestamp).toISOString(),
  }

  // IMPORTANT:
  //
  // We intentionally do NOT write input.password anywhere.
  //
  // Passwords belong on the backend.
  write(STAFF_KEY, [...stored, member])

  return member
}

/**
 * Remove a locally stored staff member.
 *
 * Production deletion/deactivation should happen through the backend.
 */
export function removeStaff(id: string): void {
  // Seeded local demo accounts cannot be removed.
  if (SEED_STAFF.some((staff) => staff.id === id)) {
    return
  }

  write(
    STAFF_KEY,
    read<StaffMember[]>(STAFF_KEY, []).filter(
      (staff) => staff.id !== id,
    ),
  )
}

// -----------------------------------------------------------------------------
// Legacy/demo staff helpers
// -----------------------------------------------------------------------------

/**
 * Return locally seeded demo staff.
 *
 * Currently there are none.
 */
export function getDemoStaff(): StaffMember[] {
  return SEED_STAFF
}

/**
 * Find a locally stored staff member by email.
 */
export function getStaffByEmail(
  email: string,
): StaffMember | undefined {
  const normalizedEmail = email.trim().toLowerCase()

  return getStaff().find(
    (staff) => staff.email.toLowerCase() === normalizedEmail,
  )
}

/**
 * Legacy local login helper.
 *
 * IMPORTANT:
 *
 * This function can no longer authenticate a staff password because
 * StaffMember intentionally does not contain passwords.
 *
 * Backend authentication should be used instead.
 *
 * It returns null deliberately.
 */
export function findStaffLogin(
  _email: string,
  _password: string,
): StaffMember | null {
  return null
}

/**
 * Resolve permissions for a locally stored staff member.
 *
 * This is only a local fallback.
 *
 * Production authorization MUST happen on the backend.
 */
export function getPermissionsForStaff(email: string): string[] {
  const member = getStaffByEmail(email)

  if (!member || !member.roleId) {
    return []
  }

  return getRole(member.roleId)?.permissions ?? []
}

/**
 * Check whether a locally stored staff member has a permission.
 *
 * This is useful for UI visibility only.
 *
 * NEVER rely on this function as the real security boundary.
 * Every protected backend endpoint must enforce permissions server-side.
 */
export function can(
  email: string,
  permission: string,
): boolean {
  return getPermissionsForStaff(email).includes(permission)
}