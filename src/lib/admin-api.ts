// src/lib/admin-api.ts
import { AdminUser, getAdminSession } from './admin-auth'

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://api.distinguishedscholarsacademy.com'

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  token: string
  user: AdminUser
}

export type AcademicTrack = 'jamb' | 'waec' | 'postutme'

export interface StaffRoleItem {
  id: string
  name: string
  permissions: string[]
}

export interface RolesApiResponse {
  success: boolean
  count: number
  data: StaffRoleItem[]
}

export interface TimetableResponse {
  success: boolean
  data: {
    id: string
    track: string
    grid: string[][]
    updatedAt: string
  }
}

export interface AttendanceSessionData {
  active: boolean
  date: string
  activatedAt: string
  id?: string
}

export interface AttendanceCheckInRecord {
  studentId: string
  fullname: string
  email: string
  studentCode: string
  status: string
  at: string
}

export interface AttendanceCheckInsResponse {
  success: boolean
  count: number
  data: AttendanceCheckInRecord[]
}

export interface MyAttendanceResponse {
  success: boolean
  data: {
    present: number
    total: number
    rate: number
    records: Array<{
      date?: string
      status?: string
      at?: string
      [key: string]: any
    }>
  }
}

// ==========================================
// USER MANAGEMENT TYPES
// ==========================================

export interface GetUsersParams {
  role: 'student' | 'tutor' | 'parent' | 'staff' | 'admin' | string
  search?: string
  page?: number
  limit?: number
  status?:
    | 'active'
    | 'suspended'
    | 'pending_payment'
    | 'pending_otp'
    | 'payment_failed'
    | 'deleted'
    | 'all'
    | string
  /** Filter students by an enrolled programme (e.g. "WAEC Tutorials"). */
  programme?: string
  /** Filter students by class / level (e.g. "SS3", "100 Level"). */
  class?: string
  /** Filter students by resolved exam track (jamb | waec | postutme | …). */
  examTrack?: string
  /** Filter students by access tier: free | portal | tutorial | paid. */
  accessLevel?: string
}

export interface AdminUserListItem {
  id: string
  fullname: string
  email: string
  role: string
  examTrack?: string
  learningMode?: string
  subjects?: string[]
  wardName?: string
  staffRole?: string
  permissions?: string[]
}

export interface GetUsersResponse {
  success: boolean
  count: number
  page: number
  limit: number
  data: AdminUserListItem[]
}

export interface UpdateUserStatusPayload {
  status: 'suspended' | 'active' | string
}

export interface ActionSuccessResponse {
  success: boolean
  message: string
  data?: any
}

// ==========================================
// COURSE & MATERIAL TYPES
// ==========================================

export type CourseCategory =
  | 'ss1'
  | 'ss2'
  | 'ss3'
  | 'waec'
  | 'jamb'
  | 'postutme'
  | '100-level'
  | '200-level'
  | 'preclinical'
  | 'afterschool'
  | 'waec-sss'
  | 'jamb-putme'
  | 'higher'

export interface Course {
  id: string
  title: string
  subject: string
  category: CourseCategory | string
  tutorId?: string
  tutorName?: string
  tutor?: Record<string, any>
  description?: string
  department?: string
  thumbnailUrl?: string
  price?: number
  isPublished?: boolean
  progressPercent?: number
  createdAt?: string | number
  updatedAt?: string | number
}

export interface CreateCoursePayload {
  title: string
  subject: string
  category: CourseCategory
  tutorId?: string
  // Multiple tutors per course — see docs/backend-request-course-tutors.md.
  tutorIds?: string[]
  description?: string
  department?: string
  /** Departments (science/art/commercial) this course serves; [] ⇒ all. */
  departments?: string[]
  /** Target class/level (SS1, SS2, SS3, Jambite/Aspirant, 100 Level, 200 Level). Empty ⇒ all classes in the category. */
  classLevel?: string
  thumbnailUrl?: string
  price?: number
  isPublished?: boolean
}

export interface UpdateCoursePayload extends Partial<CreateCoursePayload> {}

export interface CourseListParams {
  category?: CourseCategory
  classLevel?: string
  tutorId?: string
}

export interface CoursesResponse {
  success: boolean
  count: number
  data: Course[]
}

export interface CourseDetailResponse {
  success: boolean
  data: Course
}

export interface CourseMaterial {
  id: string
  title: string
  type: 'pdf' | 'video' | 'link' | string
  url: string
  description?: string
  orderIndex?: number
  isDownloadable?: boolean
  fileSizeBytes?: number
  durationSeconds?: number
  completed?: boolean
  createdAt?: string | number
  updatedAt?: string | number
}

export interface CourseMaterialsResponse {
  success: boolean
  count?: number
  data: CourseMaterial[]
}

export interface CreateMaterialPayload {
  title: string
  type: 'pdf' | 'video' | 'link' | string
  url: string
  description?: string
  orderIndex?: number
  isDownloadable?: boolean
  fileSizeBytes?: number
  durationSeconds?: number
}

export interface MaterialResponse {
  success: boolean
  message?: string
  data: CourseMaterial
}

export interface SignUploadUrlParams {
  filename: string
  contentType: string
  folder?: string
}

export interface SignUploadUrlResponse {
  success?: boolean
  data?: {
    uploadUrl: string
    fileUrl: string
    key: string
  }
  uploadUrl?: string
  fileUrl?: string
  key?: string
}

export interface MaterialProgressData {
  progressPercent: number
  completed: number
  total: number
}

export interface MaterialProgressResponse {
  success: boolean
  data: MaterialProgressData
}

// Legacy alias definitions for backward component compatibility
export type LibraryMaterial = CourseMaterial
export type LibraryMaterialsResponse = CourseMaterialsResponse

// ==========================================
// NOTIFICATION TYPES
// ==========================================

export interface NotificationItem {
  id: string
  type: 'class_reminder' | 'announcement' | 'grade' | string
  title: string
  body: string
  link?: string
  isRead: boolean
  createdAt: string
}

export interface NotificationsResponse {
  success: boolean
  count: number
  data: NotificationItem[]
}

export interface MarkReadResponse {
  success: boolean
  message: string
}

/**
 * Generic API client wrapper handling Authorization headers
 */
async function adminFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const session = getAdminSession()
  const token =
    session?.token ||
    (typeof window !== 'undefined' ? localStorage.getItem('token') : null)

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const targetUrl = `${BASE_URL.replace(/\/+$/, '')}${cleanEndpoint}`

  const headers = new Headers(options.headers || {})

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(targetUrl, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: 'An unexpected error occurred.' }))
    throw new Error(
      errorData.message || `HTTP error! Status: ${response.status}`,
    )
  }

  if (response.status === 204) {
    return {} as T
  }

  if (response.headers.get('content-type')?.includes('text/csv')) {
    return (await response.text()) as unknown as T
  }

  return response.json()
}

export interface OtpDelivery {
  email: string
  fullname: string
  status: string
  sentAt: string | null
  codeExpired: boolean | null
  delivery: { lastEvent: string; meaning: string; createdAt?: string } | null
  note: string | null
}

/** A student's request to move class / programme, awaiting an admin. */
export interface ChangeRequestRow {
  id: string
  userId: string
  student?: { id: string; fullname: string; email: string; studentId?: string }
  current: { currentLevel: string; programmes: string[]; department: string; examTrack: string }
  requested: { currentLevel: string; programmes: string[]; department: string; examTrack: string }
  note: string
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  decisionNote: string
  decidedAt: string | null
  droppedEnrollments: number
  createdAt: string
}

export const adminApi = {
  // ==========================================
  // AUTHENTICATION
  // ==========================================

  /**
   * Log in an existing user (Admin, Staff, Tutor, etc.)
   * Endpoint: POST /api/auth/login
   */
  login: (credentials: LoginCredentials) =>
    adminFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  // ==========================================
  // CORE ADMIN & USER MANAGEMENT
  // ==========================================

  /**
   * List users by role with support for query parameters (search, page, limit, status)
   * Endpoint: GET /api/admin/users
   */
  getUsers: (params: GetUsersParams | string) => {
    if (typeof params === 'string') {
      return adminFetch<GetUsersResponse>(
        `/api/admin/users?role=${encodeURIComponent(params)}`,
      )
    }

    const queryParams = new URLSearchParams()
    if (params.role) queryParams.append('role', params.role)
    if (params.search) queryParams.append('search', params.search)
    if (params.page !== undefined)
      queryParams.append('page', params.page.toString())
    if (params.limit !== undefined)
      queryParams.append('limit', params.limit.toString())
    if (params.status) queryParams.append('status', params.status)
    if (params.programme) queryParams.append('programme', params.programme)
    if (params.class) queryParams.append('class', params.class)
    if (params.examTrack) queryParams.append('examTrack', params.examTrack)
    if (params.accessLevel)
      queryParams.append('accessLevel', params.accessLevel)

    const queryString = queryParams.toString()
    return adminFetch<GetUsersResponse>(
      `/api/admin/users${queryString ? `?${queryString}` : ''}`,
    )
  },

  /**
   * Suspend or reactivate a user account
   * Endpoint: PATCH /api/admin/users/{id}/status
   */
  updateUserStatus: (id: string, payload: UpdateUserStatusPayload) =>
    adminFetch<ActionSuccessResponse>(
      `/api/admin/users/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  /**
   * Did the last verification code reach this student? (delivered / bounced / in transit)
   * Endpoint: GET /api/admin/users/{id}/otp-delivery
   */
  getOtpDelivery: (id: string) =>
    adminFetch<{ success: boolean; data: OtpDelivery }>(
      `/api/admin/users/${encodeURIComponent(id)}/otp-delivery`,
    ),

  /**
   * Email one unverified student a fresh code and a one-tap activation link.
   * Endpoint: POST /api/admin/users/{id}/resend-activation
   */
  resendActivation: (id: string) =>
    adminFetch<{ success: boolean; data: { email: string; sentAt: string } }>(
      `/api/admin/users/${encodeURIComponent(id)}/resend-activation`,
      { method: 'POST', body: '{}' },
    ),

  /**
   * Email every unverified student an activation link, 40 per call; `remaining`
   * says how many are still waiting — call again until it is 0.
   * Endpoint: POST /api/admin/users/resend-activation
   */
  resendActivationAll: (since?: string) =>
    adminFetch<{ success: boolean; data: { total: number; sent: number; remaining: number; failed: { email: string; reason: string }[] } }>(
      '/api/admin/users/resend-activation',
      { method: 'POST', body: JSON.stringify(since ? { since } : {}) },
    ),

  /**
   * Email an activation link to a chosen set of students (not everyone).
   * Endpoint: POST /api/admin/users/resend-activation with { ids, since }
   */
  resendActivationTo: (ids: string[], since?: string) =>
    adminFetch<{ success: boolean; data: { total: number; sent: number; remaining: number; failed: { email: string; reason: string }[] } }>(
      '/api/admin/users/resend-activation',
      { method: 'POST', body: JSON.stringify({ ids, ...(since ? { since } : {}) }) },
    ),

  /**
   * Students' requests to move class / programme.
   * Endpoint: GET /api/admin/change-requests?status=pending|all
   */
  listChangeRequests: (status: 'pending' | 'all' = 'pending') =>
    adminFetch<{ success: boolean; count: number; data: ChangeRequestRow[] }>(
      `/api/admin/change-requests?status=${status}`,
    ),

  /**
   * Approve (applies the change and drops courses the new class cannot see)
   * or reject (with a note the student sees).
   * Endpoint: PATCH /api/admin/change-requests/{id}
   */
  decideChangeRequest: (id: string, action: 'approve' | 'reject', note?: string) =>
    adminFetch<{ success: boolean; data: ChangeRequestRow }>(
      `/api/admin/change-requests/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ action, note: note || '' }) },
    ),

  /**
   * Soft-delete a user
   * Endpoint: DELETE /api/admin/users/{id}
   */
  deleteUser: (id: string) =>
    adminFetch<ActionSuccessResponse>(
      `/api/admin/users/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),

  /**
   * Create tutor, parent, staff, or admin account directly
   * Endpoint: POST /api/admin/staff
   */
  createStaff: <T = ActionSuccessResponse>(data: Record<string, any>) =>
    adminFetch<T>('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Manually create a student account (no payment flow — starts on Free).
   * Endpoint: POST /api/admin/students
   */
  createStudent: <T = ActionSuccessResponse>(data: Record<string, any>) =>
    adminFetch<T>('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * List staff roles & permissions
   * Endpoint: GET /api/admin/roles
   */
  getRoles: () => adminFetch<RolesApiResponse>('/api/admin/roles'),

  /**
   * Create or update a staff role (Upsert)
   * Endpoint: POST /api/admin/roles
   */
  upsertRole: <T = ActionSuccessResponse>(roleData: {
    id?: string
    name: string
    permissions: string[]
    [key: string]: any
  }) =>
    adminFetch<T>('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify(roleData),
    }),

  /**
   * Delete a staff role.
   * Endpoint: DELETE /api/admin/roles/:id
   */
  deleteRole: <T = ActionSuccessResponse>(id: string) =>
    adminFetch<T>(`/api/admin/roles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  /** Mark student paid (offline / cash / bank transfer) */
  markManualPayment: <T = any>(paymentData: {
    studentId: string
    amount: number
    reference?: string
  }) =>
    adminFetch<T>('/api/admin/payments/manual', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    }),

  // ==========================================
  // ANNOUNCEMENTS MANAGEMENT
  // ==========================================

  /** List announcements with optional scope/track filters */
  getAnnouncements: <T = any>(params?: { scope?: string; track?: string }) => {
    const queryParams = new URLSearchParams()
    if (params?.scope) queryParams.append('scope', params.scope)
    if (params?.track) queryParams.append('track', params.track)

    const queryString = queryParams.toString()
    return adminFetch<T>(
      `/api/announcements${queryString ? `?${queryString}` : ''}`,
    )
  },

  /** Create and broadcast announcement to matching students */
  createAnnouncement: <T = any>(announcementData: {
    scope: 'global' | 'track' | 'course' | string
    title: string
    body: string
    examTrack?: AcademicTrack | string
    [key: string]: any
  }) =>
    adminFetch<T>('/api/announcements', {
      method: 'POST',
      body: JSON.stringify(announcementData),
    }),

  // ==========================================
  // COURSE MANAGEMENT
  // ==========================================

  /**
   * GET /api/courses/mine
   * Fetch published courses matching the logged-in student's derived category
   */
  getMyCourses: () => adminFetch<CoursesResponse>('/api/courses/mine'),

  /**
   * GET /api/courses
   * List courses with optional query filters (category: waec-sss, jamb-putme, higher; tutorId: "me" or ObjectId)
   */
  getCourses: (params?: CourseListParams) => {
    const queryParams = new URLSearchParams()
    if (params?.category) queryParams.append('category', params.category)
    if (params?.classLevel) queryParams.append('classLevel', params.classLevel)
    if (params?.tutorId) queryParams.append('tutorId', params.tutorId)

    const queryString = queryParams.toString()
    return adminFetch<CoursesResponse>(
      `/api/courses${queryString ? `?${queryString}` : ''}`,
    )
  },

  /**
   * POST /api/courses
   * Admin creates a course and optionally assigns a tutor
   */
  createCourse: (payload: CreateCoursePayload) =>
    adminFetch<CourseDetailResponse>('/api/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /**
   * GET /api/courses/{id}
   * Get course details by ID
   */
  getCourseById: (id: string) => {
    if (!id?.trim()) throw new Error('Course ID is required')
    return adminFetch<CourseDetailResponse>(
      `/api/courses/${encodeURIComponent(id.trim())}`,
    )
  },

  /**
   * PUT /api/courses/{id}
   * Update course / assign tutor (Admin)
   */
  updateCourse: (id: string, payload: UpdateCoursePayload) => {
    if (!id?.trim()) throw new Error('Course ID is required for update')
    return adminFetch<CourseDetailResponse>(
      `/api/courses/${encodeURIComponent(id.trim())}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    )
  },

  /**
   * DELETE /api/courses/{id}
   * Delete course (Admin)
   */
  deleteCourse: (id: string) => {
    if (!id?.trim()) throw new Error('Course ID is required for deletion')
    return adminFetch<ActionSuccessResponse>(
      `/api/courses/${encodeURIComponent(id.trim())}`,
      {
        method: 'DELETE',
      },
    )
  },

  /**
   * POST /api/courses/{id}/enroll
   * Enroll the logged-in student in a course
   */
  enrollCourse: (id: string) => {
    if (!id?.trim()) throw new Error('Course ID is required for enrollment')
    return adminFetch<ActionSuccessResponse>(
      `/api/courses/${encodeURIComponent(id.trim())}/enroll`,
      {
        method: 'POST',
      },
    )
  },

  // ==========================================
  // ADMIN QUIZ MANAGEMENT
  // ==========================================

  /** Get all quizzes (Optionally filter by courseId) */
  getAllQuizzes: <T = any>(courseId?: string) =>
    adminFetch<T>(
      courseId
        ? `/api/quizzes?courseId=${encodeURIComponent(courseId)}`
        : '/api/quizzes',
    ),

  /** Create a new quiz */
  createQuiz: <T = any>(quizData: Record<string, any>) =>
    adminFetch<T>('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify(quizData),
    }),

  /** Get quiz by ID */
  getQuizById: <T = any>(quizId: string) =>
    adminFetch<T>(`/api/quizzes/${encodeURIComponent(quizId)}`),

  /** Update a quiz */
  updateQuiz: <T = any>(quizId: string, quizData: Record<string, any>) =>
    adminFetch<T>(`/api/quizzes/${encodeURIComponent(quizId)}`, {
      method: 'PUT',
      body: JSON.stringify(quizData),
    }),

  /** Delete a quiz */
  deleteQuiz: <T = any>(quizId: string) =>
    adminFetch<T>(`/api/quizzes/${encodeURIComponent(quizId)}`, {
      method: 'DELETE',
    }),

  /** Toggle or explicitly set quiz status (active/inactive) */
  toggleQuizStatus: <T = any>(quizId: string, status?: { isActive: boolean }) =>
    adminFetch<T>(`/api/quizzes/${encodeURIComponent(quizId)}/status`, {
      method: 'PATCH',
      ...(status && { body: JSON.stringify(status) }),
    }),

  // ==========================================
  // PROGRAM MANAGEMENT
  // ==========================================

  /** Upsert program countdown */
  upsertProgram: <T = any>(programData: Record<string, any>) =>
    adminFetch<T>('/api/programs', {
      method: 'POST',
      body: JSON.stringify(programData),
    }),

  // ==========================================
  // TIMETABLE MANAGEMENT
  // ==========================================

  /**
   * Fetch the 6-day x 4-period timetable grid for a specific academic track.
   * Tracks supported: 'jamb' | 'waec' | 'postutme'
   */
  getTimetable: (track: AcademicTrack) =>
    adminFetch<TimetableResponse>(
      `/api/timetable/${encodeURIComponent(track)}`,
    ),

  /**
   * Update/Schedule the 6-day x 4-period timetable grid for a specific track (Admin/Staff only).
   */
  updateTimetable: (track: AcademicTrack, grid: string[][]) =>
    adminFetch<TimetableResponse>(
      `/api/timetable/${encodeURIComponent(track)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ grid }),
      },
    ),

  // ==========================================
  // ATTENDANCE MANAGEMENT
  // ==========================================

  /** Activate attendance session for a day (defaults to today YYYY-MM-DD) */
  activateAttendanceSession: (sessionData?: {
    date?: string
    courseId?: string
  }) =>
    adminFetch<{
      success: boolean
      data?: AttendanceSessionData
    }>('/api/attendance/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData || {}),
    }),

  /** Close a course's attendance session for a specific date. */
  closeAttendanceSession: (date: string, courseId?: string) =>
    adminFetch<{ success: boolean; message?: string }>(
      `/api/attendance/sessions/${encodeURIComponent(date)}${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`,
      {
        method: 'DELETE',
      },
    ),

  /** Check if a course's attendance session is currently active. */
  getCurrentAttendanceSession: (courseId?: string) =>
    adminFetch<{
      success: boolean
      data: AttendanceSessionData
    }>(
      `/api/attendance/sessions/current${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`,
    ),

  /** Student self check-in */
  studentCheckIn: () =>
    adminFetch<{
      success: boolean
      data: {
        status: string
        at: string
        date: string
      }
    }>('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  /** Monitor a course's check-ins for a given date (defaults to today). */
  getAttendanceCheckIns: (date?: string, courseId?: string) => {
    const qs = new URLSearchParams()
    if (date) qs.set('date', date)
    if (courseId) qs.set('courseId', courseId)
    const q = qs.toString()
    return adminFetch<AttendanceCheckInsResponse>(
      `/api/attendance/check-ins${q ? `?${q}` : ''}`,
    )
  },

  /** Get current student's own attendance record summary & history */
  getMyAttendance: () => adminFetch<MyAttendanceResponse>('/api/attendance/me'),

  /** Download attendance CSV report with optional date range and course filters */
  getAttendanceReport: (params?: {
    from?: string
    to?: string
    courseId?: string
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.from) queryParams.append('from', params.from)
    if (params?.to) queryParams.append('to', params.to)
    if (params?.courseId) queryParams.append('courseId', params.courseId)

    const queryString = queryParams.toString()
    return adminFetch<string>(
      `/api/attendance/report${queryString ? `?${queryString}` : ''}`,
    )
  },

  // ==========================================
  // COURSE MATERIALS & UPLOADS
  // ==========================================

  /**
   * GET /api/courses/{id}/materials
   * List course materials. Includes completed boolean for logged-in students.
   */
  getCourseMaterials: (courseId: string) => {
    const cleanId = courseId?.trim()
    if (!cleanId) {
      throw new Error('Course ID is required to fetch materials')
    }

    return adminFetch<CourseMaterialsResponse>(
      `/api/courses/${encodeURIComponent(cleanId)}/materials`,
    )
  },

  /**
   * POST /api/courses/{id}/materials
   * Add course material (Owner tutor or Admin)
   */
  createCourseMaterial: (courseId: string, payload: CreateMaterialPayload) => {
    const cleanId = courseId?.trim()
    if (!cleanId) {
      throw new Error('Course ID is required to create material')
    }

    return adminFetch<MaterialResponse>(
      `/api/courses/${encodeURIComponent(cleanId)}/materials`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  },

  /** Request a presigned URL target for direct upload */
  signUploadUrl: (params: SignUploadUrlParams) =>
    adminFetch<SignUploadUrlResponse>('/api/uploads/sign', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // ==========================================
  // NOTIFICATIONS MANAGEMENT
  // ==========================================

  /**
   * Fetch in-app notifications for the logged-in user
   * Endpoint: GET /api/notifications
   */
  getNotifications: (unreadOnly = false) =>
    adminFetch<NotificationsResponse>(
      `/api/notifications${unreadOnly ? '?unread=true' : ''}`,
    ),

  /**
   * Mark all notifications as read for the logged-in user
   * Endpoint: PATCH /api/notifications/read-all
   */
  markAllNotificationsRead: () =>
    adminFetch<MarkReadResponse>('/api/notifications/read-all', {
      method: 'PATCH',
    }),

  /**
   * Mark a single notification as read by ID
   * Endpoint: PATCH /api/notifications/{id}/read
   */
  markNotificationRead: (id: string) =>
    adminFetch<MarkReadResponse>(
      `/api/notifications/${encodeURIComponent(id)}/read`,
      {
        method: 'PATCH',
      },
    ),
}

// Named exports for User Management
export const fetchAdminUsers = adminApi.getUsers
export const updateUserStatus = adminApi.updateUserStatus
export const deleteAdminUser = adminApi.deleteUser
export const createStaffAccount = adminApi.createStaff
export const fetchAdminRoles = adminApi.getRoles
export const upsertAdminRole = adminApi.upsertRole

export const userManagementApi = {
  getUsers: adminApi.getUsers,
  updateUserStatus: adminApi.updateUserStatus,
  deleteUser: adminApi.deleteUser,
  createStaff: adminApi.createStaff,
  getRoles: adminApi.getRoles,
  upsertRole: adminApi.upsertRole,
}

// Named exports for Course Management
export const getMyCourses = adminApi.getMyCourses
export const getCourses = adminApi.getCourses
export const createCourse = adminApi.createCourse
export const getCourseById = adminApi.getCourseById
export const updateCourse = adminApi.updateCourse
export const deleteCourse = adminApi.deleteCourse
export const enrollCourse = adminApi.enrollCourse

export const courseApi = {
  getMyCourses: adminApi.getMyCourses,
  getCourses: adminApi.getCourses,
  createCourse: adminApi.createCourse,
  getCourseById: adminApi.getCourseById,
  updateCourse: adminApi.updateCourse,
  deleteCourse: adminApi.deleteCourse,
  enrollCourse: adminApi.enrollCourse,
  getCourseMaterials: adminApi.getCourseMaterials,
  createCourseMaterial: adminApi.createCourseMaterial,
}

// Named exports for Attendance Module
export const attendanceApi = {
  activateAttendanceSession: adminApi.activateAttendanceSession,
  closeAttendanceSession: adminApi.closeAttendanceSession,
  getCurrentAttendanceSession: adminApi.getCurrentAttendanceSession,
  studentCheckIn: adminApi.studentCheckIn,
  getAttendanceCheckIns: adminApi.getAttendanceCheckIns,
  getMyAttendance: adminApi.getMyAttendance,
  getAttendanceReport: adminApi.getAttendanceReport,
}

// Direct Named Exports for Library & Material Module
export const fetchCourseMaterials = adminApi.getCourseMaterials
export const getLibraryMaterials = adminApi.getCourseMaterials
export const fetchLibraryMaterials = adminApi.getCourseMaterials
export const createCourseMaterial = adminApi.createCourseMaterial
export const createLibraryMaterial = adminApi.createCourseMaterial
export const signUploadUrl = adminApi.signUploadUrl

export const libraryApi = {
  getMaterials: adminApi.getCourseMaterials,
  getCourseMaterials: adminApi.getCourseMaterials,
  fetchLibraryMaterials: adminApi.getCourseMaterials,
  createMaterial: adminApi.createCourseMaterial,
  createCourseMaterial: adminApi.createCourseMaterial,
  createLibraryMaterial: adminApi.createCourseMaterial,
  signUploadUrl: adminApi.signUploadUrl,
}

// Direct Named Exports for Notifications Module
export const fetchNotifications = adminApi.getNotifications
export const markAllNotificationsRead = adminApi.markAllNotificationsRead
export const markNotificationRead = adminApi.markNotificationRead

export const notificationsApi = {
  getNotifications: adminApi.getNotifications,
  fetchNotifications: adminApi.getNotifications,
  markAllNotificationsRead: adminApi.markAllNotificationsRead,
  markNotificationRead: adminApi.markNotificationRead,
}

// Master API aggregation
export const dsaApi = {
  ...adminApi,
  admin: adminApi,
  users: userManagementApi,
  courses: courseApi,
  attendance: attendanceApi,
  library: libraryApi,
  notifications: notificationsApi,
  fetchLibraryMaterials: adminApi.getCourseMaterials,
  fetchNotifications: adminApi.getNotifications,
}