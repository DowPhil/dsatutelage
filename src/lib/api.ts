// Centralized API client for the DSA / Scholars Drill backend.
// Single source of truth for network access: base URL, auth headers,
// error handling, and automatic logout on expired sessions.

import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
  User,
  Quiz,
  QuizAnswer,
  QuizSubmission,
  PublicQuizResult,
  LeaderboardEntry,
  Program,
} from './types'

// Canonical base URL. Every other file in the app used the non-www host
// (`api.distinguishedscholarsacademy.com`); only this client previously used
// `www.api...`, which was almost certainly wrong. Standardized to non-www.
// Override per-environment with NEXT_PUBLIC_API_URL.
// This client uses an "/api" base (paths below omit the /api prefix), while
// admin-api.ts + the admin components read the SAME env var but WITHOUT /api
// (they add /api per path). Normalize here so either env format works and we
// never emit a doubled "/api/api/...": strip any trailing slash and a single
// trailing "/api", then append exactly one "/api".
const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://api.distinguishedscholarsacademy.com'
const BASE_URL = RAW_API_URL.replace(/\/+$/, '').replace(/\/api$/, '') + '/api'

/**
 * Every request in this file goes through here, because a plain fetch() has no
 * time limit at all. On a bad connection — and the route from Nigerian mobile
 * networks to our host drops a good share of connections outright — the request
 * neither succeeds nor fails, so the button spins on "Creating your account…"
 * for as long as the student is willing to watch it. Now it gives up, says why,
 * and the student can try again.
 *
 * The name shadows the global on purpose, so no call site can forget it.
 */
const REQUEST_TIMEOUT_MS = 30_000
const UPLOAD_TIMEOUT_MS = 180_000
export const SLOW_CONNECTION_MESSAGE =
  'The server is taking too long to answer. Your connection may be weak — please check it and try again.'

function fetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const isUpload = typeof FormData !== 'undefined' && init.body instanceof FormData
  const timer = setTimeout(
    () => controller.abort(),
    isUpload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  )
  const outer = init.signal
  if (outer) {
    if (outer.aborted) controller.abort()
    else outer.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return globalThis
    .fetch(input, { ...init, signal: controller.signal })
    .catch((err) => {
      // Ours, not the caller's: report it as the network failure it is.
      if (controller.signal.aborted && !outer?.aborted) {
        throw new TypeError(SLOW_CONNECTION_MESSAGE)
      }
      throw err
    })
    .finally(() => clearTimeout(timer))
}

const TOKEN_KEY = 'dsa_token'

/** Read the stored token safely (no-op on the server). */
const getStoredToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY)
  }
  return null
}

/**
 * On a 401 the token is stale/invalid — clear the session and bounce the
 * user to sign-in. Done here so every call gets consistent expiry handling
 * instead of each component reinventing it.
 */
const handleUnauthorized = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('dsa_user')
  localStorage.removeItem('user_role')
  document.cookie = 'admin_token=; path=/; max-age=0; SameSite=Lax'
  // Avoid redirect loops if we're already on an auth page.
  if (!window.location.pathname.startsWith('/auth')) {
    window.location.href = '/auth/signin?expired=true'
  }
}

/**
 * Parse a response, surfacing a clean error message and handling non-JSON
 * bodies (e.g. 502/404 HTML) without crashing.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')
  let data: unknown = null

  if (contentType && contentType.includes('application/json')) {
    data = await response.json()
  }

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized()
    const body = (data ?? {}) as { message?: string; error?: string }
    const errorMessage =
      body.message ||
      body.error ||
      `Error ${response.status}: ${response.statusText}`
    throw new Error(errorMessage)
  }

  return data as T
}

/**
 * The API is serverless: the first request after a quiet spell waits on a fresh
 * database connection and can come back 503 "Database unavailable", or drop
 * before it answers at all. That is a few seconds of waking up, not a fault, so
 * calls that a person is sitting and waiting on retry once or twice rather than
 * telling them something is broken.
 */
async function withWakeUpRetry<T>(
  call: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await call()
    } catch (err) {
      lastError = err
      const transient =
        isBackendUnreachable(err) ||
        (err instanceof Error && /database unavailable|50[234]/i.test(err.message))
      if (!transient || i === attempts - 1) throw err
      // 600ms, then 1.8s — a cold start is usually up well inside that.
      await new Promise((r) => setTimeout(r, 600 * 3 ** i))
    }
  }
  throw lastError
}

/**
 * Fetch every page of a paginated list.
 *
 * The API answers 20 rows unless asked for more, and never more than 100 — so
 * a roster fetched with one request silently stopped at 20 (staff) while 399
 * students were registered. This asks for the largest page and keeps going
 * until one comes back short. It deliberately does not trust `count`: on some
 * endpoints that is the total and on others just the size of the page.
 */
async function fetchAllPages(
  makeUrl: (page: number, limit: number) => string,
  token?: string,
): Promise<Record<string, unknown>[]> {
  const LIMIT = 100
  const MAX_PAGES = 100 // 10,000 rows — a runaway guard, not a real ceiling
  const all: Record<string, unknown>[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetch(makeUrl(page, LIMIT), {
      headers: getHeaders(token),
    }).then((r) =>
      handleResponse<
        Record<string, unknown>[] | { data?: Record<string, unknown>[] }
      >(r),
    )
    const rows = Array.isArray(res) ? res : (res?.data ?? [])
    all.push(...rows)
    if (rows.length < LIMIT) break
  }
  return all
}

/** Default headers, including the Bearer token when available. */
const getHeaders = (token?: string, isJson = true): HeadersInit => {
  const headers: Record<string, string> = {}
  if (isJson) headers['Content-Type'] = 'application/json'

  const activeToken = token || getStoredToken()
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`
  }
  return headers
}

/**
 * True when a fetch never reached the server (offline / CORS / backend not up
 * yet), as opposed to an HTTP error the server actually returned (which should
 * be surfaced to the user). Lets callers keep a local "preview" path while the
 * backend is still being wired up without hiding real API errors.
 */
export function isBackendUnreachable(err: unknown): boolean {
  if (err instanceof TypeError) return true // fetch() network-level failure
  const m = err instanceof Error ? err.message.toLowerCase() : ''
  return (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('load failed') ||
    m.includes('network request failed')
  )
}

/** A student's request to move class / programme, as the API returns it. */
export interface ChangeRequest {
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
  updatedAt: string
}

export const dsaApi = {
  auth: {
    /**
     * Register a student. The backend creates a PENDING student, initializes a
     * Paystack transaction, and returns `data: { accessCode, authorizationUrl,
     * reference, … }`. The caller resumes that transaction (see paystack.ts),
     * the webhook confirms payment, then OTP verification issues the token.
     */
    // Safe to try twice: registering an email that is still unverified just
    // refreshes that pending account and sends a new code.
    register: (payload: RegisterPayload) =>
      withWakeUpRetry(
        () =>
          fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
          }).then((r) => handleResponse<RegisterResponse>(r)),
        2,
      ),

    /**
     * (Re)send the verification code (POST /auth/send-otp). Returns
     * `{ success, message }`. The backend answers 400 "Account is already
     * verified" for a verified user and 404 when no such user exists;
     * handleResponse surfaces those messages as-is.
     */
    sendOtp: (email: string) =>
      withWakeUpRetry(() =>
        fetch(`${BASE_URL}/auth/send-otp`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ email }),
        }).then((r) => handleResponse<{ success?: boolean; message: string }>(r)),
      ),

    // POST /auth/activate — the one-tap link an admin emails; returns a session.
    activate: (token: string) =>
      withWakeUpRetry(() =>
        fetch(`${BASE_URL}/auth/activate`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ token }),
        }).then((r) => handleResponse<AuthResponse>(r)),
      ),

    verifyOtp: (email: string, otp: string) =>
      withWakeUpRetry(() =>
        fetch(`${BASE_URL}/auth/verify-otp`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ email, otp }),
        }).then((r) => handleResponse<AuthResponse>(r)),
      ),

    login: (payload: LoginPayload) =>
      withWakeUpRetry(() =>
        fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload),
        }).then((r) => handleResponse<AuthResponse>(r)),
      ),

    forgotPassword: (email: string) =>
      fetch(`${BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email }),
      }).then((r) => handleResponse<{ message: string }>(r)),

    resetPassword: (payload: ResetPasswordPayload) =>
      fetch(`${BASE_URL}/auth/reset-password/${payload.token}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ newPassword: payload.newPassword }),
      }).then((r) => handleResponse<{ message: string }>(r)),

    /**
     * Current logged-in user.
     *
     * The endpoint is `/auth/me` — `/auth/profile` does not exist on the
     * backend and returns 404 (verified against the live API), which logged
     * every student straight back out.
     *
     * The API wraps payloads as `{ success, data }` (same envelope as
     * /programs), but login returns the user under `user`. Unwrap either so
     * this keeps working whichever shape comes back.
     */
    getProfile: (token?: string) =>
      fetch(`${BASE_URL}/auth/me`, {
        method: 'GET',
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<User | { data?: User; user?: User }>(r),
        )
        .then((res) => {
          const body = res as { data?: User; user?: User }
          return (body.data ?? body.user ?? res) as User
        }),

    /** Update the logged-in user's profile (PUT /auth/updatedetails). */
    updateDetails: (payload: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/auth/updatedetails`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(payload),
      }).then((r) =>
        handleResponse<{ success?: boolean; data?: User; user?: User; message?: string }>(r),
      ),

    /** Change password (PUT /auth/updatepassword). */
    updatePassword: (
      payload: { currentPassword: string; newPassword: string },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/auth/updatepassword`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(payload),
      }).then((r) => handleResponse<{ success?: boolean; token?: string; message?: string }>(r)),

    // Moving class or programme is a request an admin approves, not an edit.
    changeRequest: {
      // GET /auth/change-request — the student's latest request, or null.
      get: (token?: string) =>
        fetch(`${BASE_URL}/auth/change-request`, { headers: getHeaders(token) })
          .then((r) => handleResponse<{ data?: ChangeRequest | null }>(r))
          .then((res) => res?.data ?? null),
      // POST /auth/change-request — password-confirmed; replaces any pending one.
      submit: (
        payload: {
          currentLevel: string
          programmes: string[]
          department?: string
          password: string
          note?: string
        },
        token?: string,
      ) =>
        fetch(`${BASE_URL}/auth/change-request`, {
          method: 'POST',
          headers: getHeaders(token),
          body: JSON.stringify(payload),
        })
          .then((r) => handleResponse<{ data?: ChangeRequest }>(r))
          .then((res) => res?.data ?? null),
      // DELETE /auth/change-request — take back a pending request.
      withdraw: (token?: string) =>
        fetch(`${BASE_URL}/auth/change-request`, {
          method: 'DELETE',
          headers: getHeaders(token),
        }).then((r) => handleResponse<{ data?: { withdrawn: number } }>(r)),
    },
  },

  quizzes: {
    create: (payload: Partial<Quiz>, token?: string) =>
      fetch(`${BASE_URL}/quizzes`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(payload),
      }).then((r) => handleResponse<Quiz>(r)),

    // PUT /quizzes/:id — partial update of a quiz's details (admin/owner).
    // Omitting `subjects` leaves the existing questions untouched.
    update: (id: string, payload: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(payload),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => ((r as { data?: unknown }).data ?? r) as Quiz),

    getByLink: (link: string, token?: string) =>
      fetch(`${BASE_URL}/quizzes/link/${link}`, {
        method: 'GET',
        headers: getHeaders(token),
      }).then((r) => handleResponse<Quiz>(r)),

    // ---- Free / public quizzes (no auth) — docs/backend-requests-2026-09-02.md §2 ----
    // GET /public/quizzes — list free quizzes anyone can take (no auth).
    listPublic: () =>
      fetch(`${BASE_URL}/public/quizzes`, {
        headers: { 'Content-Type': 'application/json' },
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /public/quizzes/:link — a free quiz for an anonymous taker (answers
    // stripped). No token, no access code.
    getPublic: (link: string) =>
      fetch(`${BASE_URL}/public/quizzes/${encodeURIComponent(link)}`, {
        headers: { 'Content-Type': 'application/json' },
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        // Tolerate both an enveloped `{ data }` and a bare quiz object.
        .then((r) => ((r as { data?: unknown }).data ?? r) as Quiz),

    // POST /public/quizzes/:link/submit — anonymous submission. Collects name,
    // email & phone; the backend emails the score to `email` and de-dupes by it.
    submitPublic: (
      link: string,
      body: {
        name: string
        email: string
        phone: string
        answers: QuizAnswer[]
        timeTaken: number
      },
    ) =>
      fetch(`${BASE_URL}/public/quizzes/${encodeURIComponent(link)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => ((r as { data?: unknown }).data ?? r) as PublicQuizResult),

    verifyCode: (
      payload: { link: string; accessCode: string },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/quizzes/verify-code`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(payload),
      }).then((r) => handleResponse<{ valid: boolean; quiz?: Quiz }>(r)),

    submit: (id: string, payload: QuizSubmission, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${id}/submit`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(payload),
      }).then((r) => handleResponse<{ score: number; total: number }>(r)),

    // GET /quizzes/:id/leaderboard — the API wraps rows in { data }, so unwrap
    // (returning the envelope made every leaderboard render empty).
    getLeaderboard: (id: string, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${id}/leaderboard`, {
        method: 'GET',
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<LeaderboardEntry[] | { data?: LeaderboardEntry[] }>(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // POST /quizzes/:id/rescore — re-grade all results against current answers
    // (after fixing a wrong correct-answer). Returns { updated }.
    rescore: (id: string, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${encodeURIComponent(id)}/rescore`, {
        method: 'POST',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: { updated?: number } }>(r))
        .then((r) => (r as { data?: { updated?: number } }).data ?? {}),

    // GET /quizzes/:id/results — every submission for a quiz (admin/tutor), each
    // with the student's per-question answers for a score breakdown.
    results: (id: string, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${encodeURIComponent(id)}/results`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /quizzes/:id/public-results — attempts on a FREE/public quiz (admin),
    // i.e. people who took it via the shareable link (name, email, score).
    // GET /public/quizzes/:link/leaderboard — everyone who has taken a free
    // quiz, signed-in and via the link, ranked together. No token needed.
    publicLeaderboard: (link: string) =>
      fetch(`${BASE_URL}/public/quizzes/${encodeURIComponent(link)}/leaderboard`)
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // DELETE /quizzes/:id/public-results/:attemptId — remove one attempt made
    // through the public link (admin / staff).
    deletePublicAttempt: (quizId: string, attemptId: string, token?: string) =>
      fetch(
        `${BASE_URL}/quizzes/${encodeURIComponent(quizId)}/public-results/${encodeURIComponent(attemptId)}`,
        { method: 'DELETE', headers: getHeaders(token) },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    publicResults: (id: string, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${encodeURIComponent(id)}/public-results`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /quizzes/results/me — the logged-in student's quiz history (all their
    // past submissions across quizzes).
    myResults: (token?: string) =>
      fetch(`${BASE_URL}/quizzes/results/me`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /quizzes/:id/corrections/me — the student's per-subject + per-question
    // corrections for a past quiz (options, correct index, their chosen index).
    myCorrections: (id: string, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${encodeURIComponent(id)}/corrections/me`, {
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // ---- Admin attempt analytics — docs/backend-requests-2026-09-02.md §6 ----
    // GET /quizzes/:id/attempts — every attempt (admin), for the quiz roster.
    attempts: (id: string, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${encodeURIComponent(id)}/attempts`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // DELETE /quizzes/:id/attempts/:attemptId — remove one attempt (admin).
    deleteAttempt: (id: string, attemptId: string, token?: string) =>
      fetch(
        `${BASE_URL}/quizzes/${encodeURIComponent(id)}/attempts/${encodeURIComponent(attemptId)}`,
        { method: 'DELETE', headers: getHeaders(token) },
      ).then((r) => handleResponse<{ success?: boolean }>(r)),

    // POST /quizzes/:id/attempts/:attemptId/withdraw — void a result (admin).
    withdrawAttempt: (id: string, attemptId: string, token?: string) =>
      fetch(
        `${BASE_URL}/quizzes/${encodeURIComponent(id)}/attempts/${encodeURIComponent(attemptId)}/withdraw`,
        { method: 'POST', headers: getHeaders(token) },
      ).then((r) => handleResponse<{ success?: boolean }>(r)),

    // GET /quizzes — list (admin/tutor see theirs; students see published).
    list: (token?: string) =>
      fetch(`${BASE_URL}/quizzes`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /quizzes/:id — full quiz with subjects[].questions[].
    get: (id: string, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${encodeURIComponent(id)}`, {
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PATCH /quizzes/:id/status — publish / unpublish (isActive).
    setStatus: (id: string, isActive: boolean, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify({ isActive }),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // DELETE /quizzes/:id.
    remove: (id: string, token?: string) =>
      fetch(`${BASE_URL}/quizzes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Question bank — tutors contribute questions (bulk via Excel or one by one
  // with an image); admins pull them into quizzes. See docs/quiz-feature.md.
  // A question: { subject, topic, body, A, B, C, D, E, Answer, explanation,
  // mark, imageUrl }. The server also returns normalized fields
  // (questionText, options[], correctOption/correctAnswer).
  questions: {
    // GET /questions?subject=&tutorId=  (tutor own / admin all).
    list: (
      params: { subject?: string; tutorId?: string } = {},
      token?: string,
    ) => {
      const qs = new URLSearchParams()
      if (params.subject) qs.set('subject', params.subject)
      if (params.tutorId) qs.set('tutorId', params.tutorId)
      const q = qs.toString()
      return fetch(`${BASE_URL}/questions${q ? `?${q}` : ''}`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
    },

    // GET /questions/subjects — distinct subjects that actually have questions,
    // so the quiz builder's subject picker reflects what was uploaded.
    subjects: (token?: string, tutorId?: string) => {
      const qs = tutorId ? `?tutorId=${encodeURIComponent(tutorId)}` : ''
      return fetch(`${BASE_URL}/questions/subjects${qs}`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<string[] | { data?: string[] }>(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
    },

    // POST /questions — one question, or many via { questions: [...] }.
    create: (body: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/questions`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /questions with a bulk array.
    createMany: (
      questions: Record<string, unknown>[],
      token?: string,
      batchName?: string,
    ) =>
      fetch(`${BASE_URL}/questions`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(
          batchName ? { questions, batchName } : { questions },
        ),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PUT /questions/:id — edit a question in the bank (tutor own / admin).
    // Backend endpoint pending — see docs/backend-requests-2026-09-03.md §6.
    update: (id: string, body: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/questions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // DELETE /questions/:id.
    remove: (id: string, token?: string) =>
      fetch(`${BASE_URL}/questions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  programs: {
    create: (payload: Program, token?: string) =>
      fetch(`${BASE_URL}/programs`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(payload),
      }).then((r) => handleResponse<Program>(r)),

    /**
     * All program countdowns.
     *
     * The API answers with the `{ success, count, data }` envelope, so unwrap
     * `data` here — callers just want the array. Tolerates a bare array too in
     * case the shape is ever simplified.
     */
    getAll: () =>
      fetch(`${BASE_URL}/programs`, {
        method: 'GET',
        headers: getHeaders(),
      })
        .then((r) => handleResponse<Program[] | { data?: Program[] }>(r))
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),
  },

  admin: {
    /**
     * List users by role for the admin management views
     * (GET /api/admin/users?role=student|tutor|parent|staff).
     *
     * NOT LIVE YET — the backend returns 404 and there is no real admin auth.
     * The admin roster components try this first and fall back to the local
     * store. It starts returning data the moment the backend ships the endpoint
     * (+ real admin login so the Bearer token is valid). See
     * docs/DSA-LMS-Backend-Spec.md §3.
     */
    listUsers: (role: 'student' | 'tutor' | 'parent' | 'staff', token?: string) =>
      fetchAllPages(
        (page, limit) =>
          `${BASE_URL}/admin/users?role=${encodeURIComponent(role)}&page=${page}&limit=${limit}`,
        token,
      ),

    // PATCH /admin/users/:id — update a user's editable fields (e.g. the exam
    // track override). See docs/backend-requests-2026-09-01.md (§5).
    updateUser: (id: string, data: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify(data),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  staff: {
    // GET /staff/students — the LIVE student roster for staff with
    // students.view / students.manage (admin also allowed). Same shape as the
    // admin roster; optional filters (programme, class, examTrack, department,
    // accessLevel, search, status) are passed straight through.
    students: (token?: string, params?: Record<string, string>) =>
      fetchAllPages((page, limit) => {
        const qs = new URLSearchParams({
          ...(params || {}),
          page: String(page),
          limit: String(limit),
        }).toString()
        return `${BASE_URL}/staff/students?${qs}`
      }, token),
  },

  // Attendance — per-COURSE self check-in (docs/attendance.md). A tutor opens
  // attendance for one of their courses; enrolled students mark themselves
  // present for that course. courseId is required to activate/close and scopes
  // check-in, the monitor list, and the "is it open" check. Each returns the
  // unwrapped `data` payload.
  attendance: {
    // GET /attendance/sessions/current?courseId= — is this course's attendance open?
    current: (courseId?: string, token?: string) =>
      fetch(
        `${BASE_URL}/attendance/sessions/current${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`,
        { headers: getHeaders(token) },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /attendance/sessions { courseId, date? } — tutor/admin activate.
    activate: (
      body: { courseId: string; date?: string },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/attendance/sessions`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // DELETE /attendance/sessions/:date?courseId= — close a course's session.
    close: (date: string, courseId: string, token?: string) =>
      fetch(
        `${BASE_URL}/attendance/sessions/${encodeURIComponent(date)}?courseId=${encodeURIComponent(courseId)}`,
        { method: 'DELETE', headers: getHeaders(token) },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /attendance/check-in { courseId } — student marks self present.
    checkIn: (courseId?: string, token?: string) =>
      fetch(`${BASE_URL}/attendance/check-in`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(courseId ? { courseId } : {}),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /attendance/check-ins?date=&courseId= — monitor a course's check-ins.
    checkIns: (
      params: { date?: string; courseId?: string } = {},
      token?: string,
    ) => {
      const qs = new URLSearchParams()
      if (params.date) qs.set('date', params.date)
      if (params.courseId) qs.set('courseId', params.courseId)
      const q = qs.toString()
      return fetch(`${BASE_URL}/attendance/check-ins${q ? `?${q}` : ''}`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
    },

    // GET /attendance/me — the student's own overall record + rate.
    me: (token?: string) =>
      fetch(`${BASE_URL}/attendance/me`, { headers: getHeaders(token) })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Courses & materials (docs/courses.md). Admin create/update/delete live in
  // admin-api.ts (adminApi, owned by the admin work); these are the student-
  // and tutor-facing reads plus enrollment, material listing, and completion.
  // List endpoints unwrap `{ success, count, data }` to the array; single-object
  // endpoints unwrap `{ success, data }` to the object.
  courses: {
    // GET /courses?category=&tutorId=  (any authed user). tutorId may be "me".
    list: (
      params: { category?: string; tutorId?: string } = {},
      token?: string,
    ) => {
      const qs = new URLSearchParams()
      if (params.category) qs.set('category', params.category)
      if (params.tutorId) qs.set('tutorId', params.tutorId)
      const q = qs.toString()
      return fetch(`${BASE_URL}/courses${q ? `?${q}` : ''}`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
    },

    // GET /courses/mine (student) — published courses for the student's
    // category, each with progressPercent and a nested tutor.
    mine: (token?: string) =>
      fetch(`${BASE_URL}/courses/mine`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    get: (id: string, token?: string) =>
      fetch(`${BASE_URL}/courses/${encodeURIComponent(id)}`, {
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /courses/:id/enroll (student). 409 if already enrolled.
    enroll: (id: string, token?: string) =>
      fetch(`${BASE_URL}/courses/${encodeURIComponent(id)}/enroll`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({}),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /enrollments/me (student) — enrollments with nested course + tutor.
    myEnrollments: (token?: string) =>
      fetch(`${BASE_URL}/enrollments/me`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /courses/:id/materials (student / owner tutor / admin).
    materials: (courseId: string, token?: string) =>
      fetch(`${BASE_URL}/courses/${encodeURIComponent(courseId)}/materials`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // POST /courses/:id/materials (owner tutor / admin).
    addMaterial: (
      courseId: string,
      body: Record<string, unknown>,
      token?: string,
    ) =>
      fetch(`${BASE_URL}/courses/${encodeURIComponent(courseId)}/materials`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // DELETE /materials/:id (owner tutor / admin).
    removeMaterial: (materialId: string, token?: string) =>
      fetch(`${BASE_URL}/materials/${encodeURIComponent(materialId)}`, {
        method: 'DELETE',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /materials/:id/complete (student) — mark done; recomputes
    // progressPercent. GET /courses/:id/materials returns a per-student
    // `completed` boolean reflecting this.
    completeMaterial: (materialId: string, token?: string) =>
      fetch(`${BASE_URL}/materials/${encodeURIComponent(materialId)}/complete`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({}),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // DELETE /materials/:id/complete (student) — un-mark; recomputes
    // progressPercent.
    uncompleteMaterial: (materialId: string, token?: string) =>
      fetch(`${BASE_URL}/materials/${encodeURIComponent(materialId)}/complete`, {
        method: 'DELETE',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Timetable (docs/timetable.md). The wire grid is [day][period] (6 days x 4
  // periods); the UI grid is [period][day] — transpose with gridFromApi() in
  // lib/timetable. Admin/staff edit via adminApi.updateTimetable; this is the
  // any-authenticated read.
  timetable: {
    // GET /timetable/:key — `key` is a programme (jamb) or programme+department
    // (waec-science). Returns { key, track, grid } where grid is [day][period]
    // and each cell is an array of up to two subjects.
    get: (key: string, token?: string) =>
      fetch(`${BASE_URL}/timetable/${encodeURIComponent(key)}`, {
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PUT /timetable/:key (admin/staff) — save the grid ([day][period] arrays)
    // and/or the period times (`slots`: [{ label, start, end }], 24h HH:MM).
    save: (
      key: string,
      grid: string[][][],
      token?: string,
      slots?: { label: string; start: string; end: string }[],
    ) =>
      fetch(`${BASE_URL}/timetable/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(slots ? { grid, slots } : { grid }),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Live classes (docs/timetable.md §Live Classes). Tutors upload the Meet link
  // and flip status; students read `next` to drive the Join button.
  liveClasses: {
    // GET /live-classes/next?track= (any auth) — { status, canJoin, meetLink? }.
    next: (track: string, token?: string) =>
      fetch(`${BASE_URL}/live-classes/next?track=${encodeURIComponent(track)}`, {
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /live-classes?track=&courseId= (any auth) — list of live-class
    // records. Filter by track (per-track records) or courseId (the per-course
    // records the tutor drives). Accepts a bare track string for back-compat.
    list: (
      params: string | { track?: string; courseId?: string } = {},
      token?: string,
    ) => {
      const p = typeof params === 'string' ? { track: params } : params
      const qs = new URLSearchParams()
      if (p.track) qs.set('track', p.track)
      if (p.courseId) qs.set('courseId', p.courseId)
      const q = qs.toString()
      return fetch(`${BASE_URL}/live-classes${q ? `?${q}` : ''}`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
    },

    // PUT /live-classes/:track/link (tutor / admin) — upload the Meet link.
    uploadLink: (track: string, meetLink: string, token?: string) =>
      fetch(`${BASE_URL}/live-classes/${encodeURIComponent(track)}/link`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify({ meetLink }),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PATCH /live-classes/:track/status (tutor / admin) — go live / end.
    // Going live requires a meetLink; ending accepts an optional recordingUrl.
    setStatus: (
      track: string,
      body: { status: string; recordingUrl?: string },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/live-classes/${encodeURIComponent(track)}/status`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PUT /live-classes/course/:courseId/link (tutor / admin) — upload the Meet
    // link for a single course (the tutor drives link/status per course).
    // `isFree` marks the class open to everyone (any level, ignores caps).
    uploadLinkForCourse: (
      courseId: string,
      meetLink: string,
      isFree?: boolean,
      token?: string,
    ) =>
      fetch(
        `${BASE_URL}/live-classes/course/${encodeURIComponent(courseId)}/link`,
        {
          method: 'PUT',
          headers: getHeaders(token),
          body: JSON.stringify(
            isFree === undefined ? { meetLink } : { meetLink, isFree },
          ),
        },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PATCH /live-classes/course/:courseId/status (tutor / admin) — go live /
    // end for a single course. Going live requires a meetLink.
    setStatusForCourse: (
      courseId: string,
      body: { status: string; recordingUrl?: string },
      token?: string,
    ) =>
      fetch(
        `${BASE_URL}/live-classes/course/${encodeURIComponent(courseId)}/status`,
        {
          method: 'PATCH',
          headers: getHeaders(token),
          body: JSON.stringify(body),
        },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Assignments, submissions & grades (docs/assignment.md). Assignments are
  // nested under courses; submissions/grades are standalone. Tutors (or admin)
  // create + grade on their own courses; students submit + read their own.
  assignments: {
    // GET /courses/:id/assignments (enrolled student sees published; owner
    // tutor / admin see all).
    listForCourse: (courseId: string, token?: string) =>
      fetch(`${BASE_URL}/courses/${encodeURIComponent(courseId)}/assignments`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // POST /courses/:id/assignments (owner tutor / admin).
    create: (
      courseId: string,
      body: Record<string, unknown>,
      token?: string,
    ) =>
      fetch(`${BASE_URL}/courses/${encodeURIComponent(courseId)}/assignments`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PUT /assignments/:id (owner tutor / admin).
    update: (id: string, body: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/assignments/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // DELETE /assignments/:id (owner tutor / admin) — also deletes submissions.
    remove: (id: string, token?: string) =>
      fetch(`${BASE_URL}/assignments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /assignments/:id/submit (student). At least one of text/fileUrl.
    submit: (
      assignmentId: string,
      body: { text?: string; fileUrl?: string },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/assignments/${encodeURIComponent(assignmentId)}/submit`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /assignments/:id/submissions (owner tutor / admin) — for grading.
    submissions: (assignmentId: string, token?: string) =>
      fetch(
        `${BASE_URL}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
        { headers: getHeaders(token) },
      )
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /submissions/me?assignmentId= (student).
    mySubmissions: (assignmentId?: string, token?: string) =>
      fetch(
        `${BASE_URL}/submissions/me${assignmentId ? `?assignmentId=${encodeURIComponent(assignmentId)}` : ''}`,
        { headers: getHeaders(token) },
      )
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // PUT /submissions/:id/grade (owner tutor / admin).
    grade: (
      submissionId: string,
      body: { score: number; feedback?: string },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/submissions/${encodeURIComponent(submissionId)}/grade`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /grades/me (student) — all grades, each with percent.
    myGrades: (token?: string) =>
      fetch(`${BASE_URL}/grades/me`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /courses/:id/grades (owner tutor / admin) — the course gradebook
    // (assignment + manual grades) with student info.
    courseGrades: (courseId: string, token?: string) =>
      fetch(`${BASE_URL}/courses/${encodeURIComponent(courseId)}/grades`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // POST /courses/:id/grades (owner tutor / admin) — record a manual grade
    // ({studentId,title,score,maxScore,feedback}) or a batch ({grades:[...]}).
    recordGrades: (
      courseId: string,
      body: Record<string, unknown>,
      token?: string,
    ) =>
      fetch(`${BASE_URL}/courses/${encodeURIComponent(courseId)}/grades`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PUT /grades/:id (owner tutor / admin) — correct a grade.
    updateGrade: (id: string, body: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/grades/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Analytics — computed from grades, enrollments, submissions & attendance
  // (docs/analytics.md). Students read their own; tutors (or admin) read theirs.
  analytics: {
    // GET /analytics/me (student).
    me: (token?: string) =>
      fetch(`${BASE_URL}/analytics/me`, { headers: getHeaders(token) })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /tutors/me/analytics (tutor / admin) — dashboard overview.
    tutorOverview: (token?: string) =>
      fetch(`${BASE_URL}/tutors/me/analytics`, { headers: getHeaders(token) })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /tutors/me/students (tutor / admin) — roster with avg + progress.
    tutorStudents: (token?: string) =>
      fetch(`${BASE_URL}/tutors/me/students`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /courses/:id/analytics (owner tutor / admin) — one course.
    course: (courseId: string, token?: string) =>
      fetch(`${BASE_URL}/courses/${encodeURIComponent(courseId)}/analytics`, {
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Announcements. The backend supports GET (server-filtered: a student sees
  // global + their track), POST (tutor/admin broadcast), and PUT/DELETE by id
  // (tutor/admin edit + remove). There is no read-state endpoint, so read
  // tracking stays client-side.
  announcements: {
    // GET /announcements?scope=&track= — students get their relevant set
    // server-side; tutors/admin can filter.
    list: (
      params: { scope?: string; track?: string } = {},
      token?: string,
    ) => {
      const qs = new URLSearchParams()
      if (params.scope) qs.set('scope', params.scope)
      if (params.track) qs.set('track', params.track)
      const q = qs.toString()
      return fetch(`${BASE_URL}/announcements${q ? `?${q}` : ''}`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
    },

    // POST /announcements (tutor / admin). scope 'global' | 'track' (+ track) |
    // 'course' (+ courseId) — course targets only students enrolled in that
    // course (a tutor messaging just their subject). See
    // docs/backend-requests-2026-09-01.md (§2).
    create: (body: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/announcements`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PUT /announcements/:id (tutor / admin) — edit title + body.
    update: (
      id: string,
      body: { title: string; body: string },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/announcements/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // DELETE /announcements/:id (tutor / admin).
    remove: (id: string, token?: string) =>
      fetch(`${BASE_URL}/announcements/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Guardian (parent) — read-only views of a linked ward, scoped and verified
  // server-side to the logged-in parent (docs/*). Use the ward's ObjectId (`id`
  // from wards) for the path, not the studentId (which contains slashes).
  guardian: {
    // GET /parents/me/wards — the parent's linked ward(s).
    wards: (token?: string) =>
      fetch(`${BASE_URL}/parents/me/wards`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /parents/me/wards/:id — one ward's profile.
    ward: (wardId: string, token?: string) =>
      fetch(`${BASE_URL}/parents/me/wards/${encodeURIComponent(wardId)}`, {
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /parents/me/wards/:id/performance — academic + attendance snapshot.
    performance: (wardId: string, token?: string) =>
      fetch(
        `${BASE_URL}/parents/me/wards/${encodeURIComponent(wardId)}/performance`,
        { headers: getHeaders(token) },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /parents/me/wards/:id/fees — fee / payment status.
    fees: (wardId: string, token?: string) =>
      fetch(`${BASE_URL}/parents/me/wards/${encodeURIComponent(wardId)}/fees`, {
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /parents/me/wards/:id/quiz-results — the ward's quiz scores.
    quizResults: (wardId: string, token?: string) =>
      fetch(
        `${BASE_URL}/parents/me/wards/${encodeURIComponent(wardId)}/quiz-results`,
        { headers: getHeaders(token) },
      )
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /parents/me/wards/:id/assignment-grades — the ward's assignment
    // grades (each with course, score, maxScore, feedback, status).
    assignmentGrades: (wardId: string, token?: string) =>
      fetch(
        `${BASE_URL}/parents/me/wards/${encodeURIComponent(wardId)}/assignment-grades`,
        { headers: getHeaders(token) },
      )
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),
  },

  // Notifications — a per-user inbox with server-side read state. Populated by
  // the backend from announcements, attendance opens, grades, etc.
  notifications: {
    // GET /notifications — the logged-in user's notifications, newest first.
    list: (token?: string) =>
      fetch(`${BASE_URL}/notifications`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // PATCH /notifications/:id/read — mark one read.
    markRead: (id: string, token?: string) =>
      fetch(`${BASE_URL}/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PATCH /notifications/read-all — mark every notification read.
    markAllRead: (token?: string) =>
      fetch(`${BASE_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Uploads. POST /uploads/sign returns a signed target. NOTE: the backend's
  // object storage is a stub right now — it returns `uploadUrl: null` and asks
  // callers to pass an external URL instead (see uploadFile below).
  uploads: {
    sign: (
      body: { filename: string; contentType?: string; folder?: string },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/uploads/sign`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Community — one shared channel for tutors + students. Admin moderates
  // (sees every message and can delete any). Attachments (image / video /
  // audio / pdf / doc) upload straight to Cloudinary from the browser; only the
  // resulting URL is sent here, never the file bytes. Role rules (students may
  // not post audio notes) are enforced server-side from the JWT.
  // See docs/backend-request-community.md for the endpoint contract.
  community: {
    // GET /community/messages?limit=&before=&channelId= — a page of the channel,
    // oldest to newest. `before` (a message id or ISO timestamp) loads older
    // history. `channelId` scopes to one channel (omit / 'general' = the main
    // channel). See docs/backend-requests-2026-09-01.md (§4).
    list: (
      params: { limit?: number; before?: string; channelId?: string } = {},
      token?: string,
    ) => {
      const qs = new URLSearchParams()
      if (params.limit) qs.set('limit', String(params.limit))
      if (params.before) qs.set('before', params.before)
      if (params.channelId && params.channelId !== 'general')
        qs.set('channelId', params.channelId)
      const q = qs.toString()
      return fetch(`${BASE_URL}/community/messages${q ? `?${q}` : ''}`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
    },

    // POST /community/messages (tutor / student). The server stamps the sender
    // from the JWT; the client only says what kind of message it is. `channelId`
    // routes it to a channel (omit for the main/General channel).
    send: (
      body: {
        type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'poll'
        text?: string
        fileUrl?: string
        fileName?: string
        fileType?: string
        fileSize?: number
        durationSec?: number
        channelId?: string
        /** Id of the message this one answers (must be in the same channel). */
        replyTo?: string
        /** For type 'poll' — a plain poll, or a quiz that marks the answer. */
        poll?: {
          question: string
          options: string[]
          isQuiz?: boolean
          correctOption?: number
        }
      },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/community/messages`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(
          body.channelId === 'general' ? { ...body, channelId: undefined } : body,
        ),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PATCH /community/messages/:id — edit a message's text (author only) or
    // toggle its pinned state (tutor / admin). The server enforces both.
    update: (
      id: string,
      body: { text?: string; pinned?: boolean },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/community/messages/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // DELETE /community/messages/:id — admin removes any message; a member may
    // remove their own. The server enforces who is allowed from the JWT.
    remove: (id: string, token?: string) =>
      fetch(`${BASE_URL}/community/messages/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /community/settings?channelId= — channel state, e.g. { locked }. When
    // locked, students cannot post (tutors/admin still can).
    getSettings: (token?: string, channelId?: string) => {
      const q =
        channelId && channelId !== 'general'
          ? `?channelId=${encodeURIComponent(channelId)}`
          : ''
      return fetch(`${BASE_URL}/community/settings${q}`, {
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown } | { locked?: boolean }>(r))
        .then((r) => {
          const obj = r as Record<string, unknown>
          return (obj.data ?? obj) as { locked?: boolean }
        })
    },

    // PATCH /community/settings — lock / unlock a channel (tutor / admin).
    setLocked: (locked: boolean, token?: string, channelId?: string) =>
      fetch(`${BASE_URL}/community/settings`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify(
          channelId && channelId !== 'general'
            ? { locked, channelId }
            : { locked },
        ),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // ---- Channels (docs/backend-requests-2026-09-01.md §4) ----
    // GET /community/channels — channels the caller can see (admin sees all).
    channels: (token?: string) =>
      fetch(`${BASE_URL}/community/channels`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // POST /community/channels (admin) — create a channel
    // { name, track?, department? }.
    createChannel: (body: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/community/channels`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PATCH /community/channels/:id (admin) — rename / re-scope a channel
    // { name?, track?, department?, subject? }.
    updateChannel: (
      id: string,
      body: Record<string, unknown>,
      token?: string,
    ) =>
      fetch(`${BASE_URL}/community/channels/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /community/access — who may open the Community ('all' | 'paid').
    getAccess: (token?: string) =>
      fetch(`${BASE_URL}/community/access`, { headers: getHeaders(token) })
        .then((r) => handleResponse<{ data?: { access?: string } }>(r))
        .then((r) => (r as { data?: { access?: string } }).data?.access ?? 'all'),

    // PATCH /community/access (admin) — set it.
    setAccess: (access: 'all' | 'paid', token?: string) =>
      fetch(`${BASE_URL}/community/access`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify({ access }),
      })
        .then((r) => handleResponse<{ data?: { access?: string } }>(r))
        .then((r) => (r as { data?: { access?: string } }).data?.access ?? access),

    // POST /community/messages/:id/vote — pick a poll option (re-voting moves it).
    vote: (messageId: string, option: number, token?: string) =>
      fetch(
        `${BASE_URL}/community/messages/${encodeURIComponent(messageId)}/vote`,
        {
          method: 'POST',
          headers: getHeaders(token),
          body: JSON.stringify({ option }),
        },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /community/presence — say you're here (and whether you're typing),
    // and hear who else is. One call per beat, both directions.
    presence: (
      body: { channelId?: string; typing?: boolean },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/community/presence`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then(
          (r) =>
            ((r as { data?: unknown }).data ?? r) as {
              online?: { id: string; fullname: string; role: string }[]
              onlineCount?: number
              typing?: { id: string; fullname: string }[]
            },
        ),

    // PATCH /community/channels/:id/mute — quiet for `minutes`, or `off`.
    mute: (
      channelId: string,
      body: { minutes?: number; off?: boolean },
      token?: string,
    ) =>
      fetch(
        `${BASE_URL}/community/channels/${encodeURIComponent(channelId)}/mute`,
        {
          method: 'PATCH',
          headers: getHeaders(token),
          body: JSON.stringify(body),
        },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /community/search?q=&channelId=&type= — look through the channels
    // this person can see. `type` narrows to files or links.
    search: (
      params: {
        q: string
        channelId?: string
        type?: 'all' | 'messages' | 'files' | 'links'
      },
      token?: string,
    ) => {
      const qs = new URLSearchParams({ q: params.q })
      if (params.channelId && params.channelId !== 'general')
        qs.set('channelId', params.channelId)
      if (params.type && params.type !== 'all') qs.set('type', params.type)
      return fetch(`${BASE_URL}/community/search?${qs.toString()}`, {
        headers: getHeaders(token),
      })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
    },

    // POST /community/messages/:id/react — toggle an emoji (tap again removes
    // it). Returns the message with fresh { emoji, count, mine } reactions.
    react: (messageId: string, emoji: string, token?: string) =>
      fetch(
        `${BASE_URL}/community/messages/${encodeURIComponent(messageId)}/react`,
        {
          method: 'POST',
          headers: getHeaders(token),
          body: JSON.stringify({ emoji }),
        },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /community/messages/read — mark a batch of messages seen.
    markRead: (channelId: string, messageIds: string[], token?: string) =>
      fetch(`${BASE_URL}/community/messages/read`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ channelId, messageIds }),
      })
        .then((r) => handleResponse<{ data?: { updated?: number } }>(r))
        .then((r) => (r as { data?: { updated?: number } }).data ?? {}),

    // GET /community/messages/:id/reads — who has seen a message.
    reads: (messageId: string, token?: string) =>
      fetch(
        `${BASE_URL}/community/messages/${encodeURIComponent(messageId)}/reads`,
        { headers: getHeaders(token) },
      )
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // DELETE /community/channels/:id (admin) — delete a channel + its messages.
    removeChannel: (id: string, token?: string) =>
      fetch(`${BASE_URL}/community/channels/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /community/channels/:id/members (tutor / admin) — who is in a channel.
    members: (channelId: string, token?: string) =>
      fetch(
        `${BASE_URL}/community/channels/${encodeURIComponent(channelId)}/members`,
        { headers: getHeaders(token) },
      )
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // DELETE /community/channels/:id/members/:userId (tutor / admin) — remove
    // someone from a channel.
    removeMember: (channelId: string, userId: string, token?: string) =>
      fetch(
        `${BASE_URL}/community/channels/${encodeURIComponent(channelId)}/members/${encodeURIComponent(userId)}`,
        { method: 'DELETE', headers: getHeaders(token) },
      )
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Payment plans — admin-managed (see docs/backend-request-payments.md).
  // A plan: { id, name, kind: 'portal'|'tutorial', amount (kobo/naira),
  // durationMonths, grantsLevel: 'portal'|'tutorial', active }.
  // Support / customer care — an in-app contact form. Backend endpoint pending
  // (see docs/backend-requests-2026-09-03.md §7).
  support: {
    // POST /support — submit a support request { subject, message } (name/email
    // come from the authenticated user).
    create: (body: { subject: string; message: string }, token?: string) =>
      fetch(`${BASE_URL}/support`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      }).then((r) =>
        handleResponse<{ success?: boolean; message?: string }>(r),
      ),

    // GET /admin/support — list tickets (admin or a support agent with the
    // support.view permission).
    list: (status?: string, token?: string) => {
      const qs = status ? `?status=${encodeURIComponent(status)}` : ''
      return fetch(`${BASE_URL}/admin/support${qs}`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
    },

    // PATCH /admin/support/:id — close or reopen a ticket.
    setStatus: (id: string, status: 'open' | 'closed', token?: string) =>
      fetch(`${BASE_URL}/admin/support/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify({ status }),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /admin/support/:id/reply — admin / support agent replies to a ticket.
    reply: (id: string, body: string, token?: string) =>
      fetch(`${BASE_URL}/admin/support/${encodeURIComponent(id)}/reply`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ body }),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /support — the signed-in user's own tickets (with the reply thread).
    listMine: (token?: string) =>
      fetch(`${BASE_URL}/support`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // POST /support/:id/reply — student replies on their own ticket.
    replyMine: (id: string, body: string, token?: string) =>
      fetch(`${BASE_URL}/support/${encodeURIComponent(id)}/reply`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ body }),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  plans: {
    // GET /plans — active plans a student can pick.
    list: (token?: string) =>
      fetch(`${BASE_URL}/plans`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // GET /admin/plans — all plans (admin).
    adminList: (token?: string) =>
      fetch(`${BASE_URL}/admin/plans`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    create: (body: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/admin/plans`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    update: (id: string, body: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/admin/plans/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    remove: (id: string, token?: string) =>
      fetch(`${BASE_URL}/admin/plans/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders(token),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },

  // Payments — online (Paystack) + offline proof, plus admin review + access caps.
  payments: {
    // POST /payments/online — start a Paystack transaction for a plan; returns
    // an accessCode the browser resumes (like registration). { planId, months? }.
    // No `amount` here on purpose — the plan's price is the server's to decide.
    initOnline: (
      body: { planId: string; months?: number },
      token?: string,
    ) =>
      fetch(`${BASE_URL}/payments/online`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // POST /payments/offline (student) — submit proof of an offline payment.
    // { planId, months?, amount?, method, reference?, proofUrl } → provisional access.
    offline: (body: Record<string, unknown>, token?: string) =>
      fetch(`${BASE_URL}/payments/offline`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET /admin/payments/offline — the review queue (admin).
    offlineQueue: (token?: string) =>
      fetch(`${BASE_URL}/admin/payments/offline`, { headers: getHeaders(token) })
        .then((r) =>
          handleResponse<
            Record<string, unknown>[] | { data?: Record<string, unknown>[] }
          >(r),
        )
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? []))),

    // PATCH /admin/payments/offline/:id — { decision: 'approve' | 'reject' }.
    review: (id: string, decision: 'approve' | 'reject', token?: string) =>
      fetch(`${BASE_URL}/admin/payments/offline/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify({ decision }),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // PATCH /admin/users/:id/access — master enable/disable a student's access.
    setUserAccess: (userId: string, enabled: boolean, token?: string) =>
      fetch(`${BASE_URL}/admin/users/${encodeURIComponent(userId)}/access`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify({ enabled }),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),

    // GET/PATCH /admin/settings/access — the admin-editable L1/L2 caps.
    getCaps: (token?: string) =>
      fetch(`${BASE_URL}/admin/settings/access`, { headers: getHeaders(token) })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
    setCaps: (caps: Record<string, number>, token?: string) =>
      fetch(`${BASE_URL}/admin/settings/access`, {
        method: 'PATCH',
        headers: getHeaders(token),
        body: JSON.stringify(caps),
      })
        .then((r) => handleResponse<{ data?: unknown }>(r))
        .then((r) => (r as { data?: unknown }).data ?? r),
  },
}

/**
 * Upload a file via the signed-URL flow and return its hosted URL.
 *
 * Forward-compatible: it asks the backend for a signed PUT target and uploads
 * to it. TODAY the backend's storage is not configured (`uploadUrl` is null),
 * so this throws a clear, actionable error and callers should fall back to a
 * pasted external link. The moment object storage is enabled, this starts
 * working with no further code change.
 */
export async function uploadFile(
  file: File,
  folder = 'uploads',
  token?: string,
): Promise<string> {
  const meta = (await dsaApi.uploads.sign(
    {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      folder,
    },
    token,
  )) as { uploadUrl?: string | null; fileUrl?: string; message?: string }

  if (!meta.uploadUrl) {
    throw new Error(
      'Direct upload isn’t enabled on the server yet. Host the file (Google Drive, Dropbox, OneDrive…), set it to “anyone with the link”, and paste that link below.',
    )
  }

  const put = await fetch(meta.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!put.ok) {
    throw new Error('Upload failed. Please try again or paste a link instead.')
  }
  return meta.fileUrl || ''
}
