# DSA — Payments & Access Plan

*Drafted 2026-08-26 (Wednesday). Updated 2026-08-26 with the owner's final access
structure. Plan only — no code yet.*

Two things to add: (1) an **offline-payment** option beside the online gateway,
and (2) a **3-level access model** driven by **admin-managed payment plans**.

---

## 0. Guiding principle — beta stays open

Everyone can currently see and do everything, and we keep it that way while
people test. Build all the payment plumbing now behind a master switch —
**`PAYWALL_ENABLED`** — kept **OFF** during beta. Flip it **ON** at launch and the
levels below start applying. "Free classes for unpaid students" stays **v2**.

---

## 1. The access model — 3 levels (final)

Access is **NOT** tier-gated. The Silver/Gold/Elite prices are just tutorial-fee
options; every paid tutorial student gets the **same** portal access. The tier
differences live **outside the website** (YouTube lessons, Scholars Drill plans,
Accountability Hub) and the **Parent Portal**, which the admin grants manually to
Gold/Elite students (no code — admin just creates the guardian account). So the
website only needs **three levels**:

| Portal feature | **L1 — Free** (account, no payment) | **L2 — ₦2,000 Portal Access** | **L3 — Active Tutorial** (tutorial fee paid) |
|---|:--:|:--:|:--:|
| Profile / dashboard | ✅ basic | ✅ | ✅ |
| Tests / CBT | Limited free tests | More free tests | **Unlimited** |
| Learning materials | Limited | More | **Full** |
| Live classes | up to **5** | up to **10** | **Unlimited** |
| **Community** | ❌ | ✅ | ✅ |
| **Assignments** | ❌ | ❌ | ✅ |
| Performance tracking | basic | basic | full |

- **L1 purpose:** taste the platform before paying.
- **L2 purpose:** intermediate; nudges toward the full tutorial.
- **L3:** everything on the portal.
- **Expiry:** when the tutorial period lapses, the student **reverts to Free
  (L1)** — confirmed.

The "limited / more / full" caps are **set by the admin** (not hard-coded), in the
admin settings — how many free tests, learning materials and live classes L1 and
L2 each get. L3 is unlimited. Defaults ship as a starting point; the admin can
change them any time.

| Cap (admin-editable) | L1 Free | L2 (₦2,000) | L3 Tutorial |
|---|--:|--:|--:|
| Free tests visible | admin-set (default 3) | admin-set (default 10) | ∞ |
| Learning materials visible | admin-set (default 5) | admin-set (default 20) | ∞ |
| Live classes joinable | admin-set (default 5) | admin-set (default 10) | ∞ |

### Free classes — open to everyone

The admin can mark any live class as **Free**. A free class is joinable by **all
students regardless of level** — including L1 / unpaid — and does **not** count
against the 5 / 10 live-class cap. This is how DSA runs open or demo classes that
anyone can attend, and it covers the "free classes for unpaid students" idea with
a simple per-class flag (so it no longer needs to wait for v2).

---

## 2. Admin/secretary-managed payment plans

The admin (or secretary) creates and prices the plans — amounts are **not
hard-coded**. A student **selects a plan** and pays (online or offline).

- **Plan shape:** `{ name, kind: 'portal' | 'tutorial', amount, durationMonths,
  grantsLevel: 'portal' | 'tutorial', note }`.
  - The **₦2,000 portal-access** plan → grants **L2** (one-time).
  - **Tutorial** plans (the Silver/Gold/Elite prices, admin-set) → grant **L3**
    for `durationMonths`.
- **Admin screen:** *Payments → Plans* — create / edit / disable plans and their
  amounts + durations.
- **Student screen:** an **"Unlock more features"** card on the dashboard → shows
  the available plans → pick one → pay.

### Current tutorial pricing (admin can change these)

| Plan | Monthly | 2 months | 3 months |
|------|---------|----------|----------|
| Silver — Essential Prep | ₦8,000 | ₦15,000 | ₦20,000 |
| Gold — Complete Prep | ₦12,000 | ₦22,000 | ₦30,000 |
| Elite — Premium Prep | ₦17,000 | ₦32,000 | ₦45,000 |

Gold/Elite additionally get a Parent Portal — handled by the admin creating the
guardian account, **not** by a code gate.

---

## 3. Payment: online + offline (both rails)

### 3a. What exists (reuse)
- **Online**: register-first Paystack (`POST /auth/register` → `accessCode` →
  browser resumes; backend webhook confirms paid). `src/lib/paystack.ts`.
- **Offline (admin)**: `POST /api/admin/payments/manual` — "Mark student paid
  (offline / cash / bank transfer)", `{ studentId, amount, method, reference }`.

### 3b. Offline payment for students ("I've paid offline")
At any payment step, **two buttons** instead of one:
1. **Pay Online** → Paystack.
2. **I've Paid Offline** → form: proof upload (receipt/teller → Cloudinary) +
   optional amount / reference / date.
   - On submit → **provisional access immediately** (`pending-offline`); the
     student enters the portal at the level the plan grants.
   - **Admin review** (*Payments* area): view proof → **Approve** (→ active,
     reuse manual-payment) or **Disable/Reject** (→ revoke). Admin can also
     disable an already-active student at any time.

**Backend needed** (spec):
- `POST /api/payments/offline` (student) — `{ planId, amount, method, reference?,
  proofUrl }` → `pending-offline` + provisional access.
- `GET /api/admin/payments/offline` (admin) — review queue.
- `PATCH /api/admin/payments/offline/:id` — `{ decision: 'approve' | 'reject' }`.
- `PATCH /api/admin/users/:id/access` — `{ enabled }` (master disable/enable).
- Payment-plan CRUD: `GET /api/plans`, `POST/PATCH/DELETE /api/admin/plans`.

---

## 4. Data model (fields to add)

**On the student/user** (returned on `GET /auth/me` so the frontend can gate):
- `accessLevel`: `free | portal | tutorial`
- `tutorialExpiry`: date (drives L3 → revert)
- `paymentStatus`: `none | pending-offline | active | expired | disabled`
- `accessEnabled`: boolean — admin master override

**Payment plan:** `{ id, name, kind, amount, durationMonths, grantsLevel, active }`.
**Offline payment record:** `{ studentId, planId, amount, method, reference,
proofUrl, status: pending|approved|rejected, reviewedBy, createdAt }`.
**Live class:** add `isFree: boolean` — a free class ignores the level and the
cap (everyone can join).
**Access settings (admin-editable caps):** `{ freeTests, freeMaterials,
freeLiveClasses, portalTests, portalMaterials, portalLiveClasses }` — the L1/L2
limits; L3 is unlimited.

---

## 5. Gating mechanism (frontend)

- One helper — `accessLevel()` + `canAccess(feature)` / `limitFor(feature)` —
  reads `PAYWALL_ENABLED` + the user's `accessLevel` / `accessEnabled` against §1.
- While `PAYWALL_ENABLED` is off → everything open (beta).
- When on:
  - **Community** hidden/locked below L2; **Assignments** locked below L3.
  - **Live classes / tests / materials** are **count-limited** by the admin caps
    (default 5/10/∞ etc.), not just on/off — show "You've reached your free limit
    — Upgrade plans" past the cap.
  - **Free classes** (`isFree`) are always joinable by everyone and never count
    toward the cap.
  - Locked items show a small lock + route to the **Unlock** (Plans) screen.
- Enforced **server-side** too on the gated endpoints — the frontend lock is UX.

---

## 6. Phasing

- **Phase 1 (now, beta):** offline-proof upload + two-button payment step + admin
  Payments review + admin Plans management + student "Unlock/Plans" screen + the
  `accessLevel` data fields. `PAYWALL_ENABLED = off` — nothing blocked.
- **Phase 2 (launch):** wire plan purchase online (Paystack, admin-set amounts),
  turn `PAYWALL_ENABLED` on, enforce §1 limits (frontend + backend).
- **Phase 3 (v2):** free classes for unpaid students.

---

## 7. Answers to the earlier open questions

1. **₦2,000 vs tiers** — the ₦2,000 is a **separate** portal-access/registration
   fee = **Level 2**. The tutorial fee (Silver/Gold/Elite, admin-priced) is on top
   and unlocks **Level 3**. Tiers do **not** change website access — all L3
   students get the same portal; tier perks are off-site + the Parent Portal.
2. **Feature→tier mapping** — dropped. Replaced by the **3-level** model in §1.
3. **Offline access timing** — grant **provisional access on upload**; the admin
   can disable it back.
4. **"Classes" gate** — live classes are **count-limited** per level (5 / 10 /
   unlimited), not a simple on/off. Tests and materials are limited the same way.
5. **Duration / expiry** — tutorial (L3) is time-bound by `tutorialExpiry`; at
   expiry the student **reverts to Free (L1)** — confirmed.

6. **Caps** — **admin-editable** (not fixed); see §1. Ship sensible defaults.

7. **Free classes** — the admin can flag any live class `isFree`; it's open to
   all students (any level, including unpaid) and doesn't count toward the cap.

---

## 8. Status

**Phase 1 frontend is BUILT** (behind `PAYWALL_ENABLED` off during beta):

- Student **Unlock More** tab — pick a plan → **Pay Online** or **I've Paid
  Offline** (proof upload). `src/components/dashboard/UnlockPlans.tsx`.
- **Registration** step — same two buttons for the ₦2,000 fee.
  `src/app/auth/signup/StudentWizard.tsx`.
- Admin **Payments** tab — plans + amounts, access caps, offline proof review.
  `src/app/admin/components/PaymentsAdmin.tsx`.
- Access model + helpers `src/lib/access.ts`; API client `dsaApi.plans` /
  `dsaApi.payments` in `src/lib/api.ts`; user fields in `src/lib/types.ts`.
- **Permissions:** every admin capability (incl. **View payment history**,
  Manage plans & caps, Verify manual payments) is assignable in
  Settings → Permissions (`src/lib/staffStore.ts`).

**Pending: the backend endpoints below.** All were re-checked live on
2026-08-26 and return **404** — the frontend degrades gracefully until they ship.

---

## 9. API & endpoints (what the frontend calls)

Client wrappers: `dsaApi.plans` and `dsaApi.payments` in `src/lib/api.ts`. Amounts
are in **naira** (confirm if the model stores kobo). All ❌ below = not live yet.

### Plans (`dsaApi.plans`)
| Method | Path | Who | Body / returns | Status |
|--------|------|-----|----------------|:--:|
| GET | `/api/plans` | any authed | active plans `[{id,name,kind,amount,durationMonths,grantsLevel,active}]` | ❌ 404 |
| GET | `/api/admin/plans` | admin | all plans | ❌ 404 |
| POST | `/api/admin/plans` | admin | `{name,kind:'portal'|'tutorial',amount,durationMonths,grantsLevel,active}` | ❌ 404 |
| PATCH | `/api/admin/plans/:id` | admin | partial (e.g. `{amount}`, `{active}`) | ❌ 404 |
| DELETE | `/api/admin/plans/:id` | admin | — | ❌ 404 |

### Payments (`dsaApi.payments`)
| Method | Path | Who | Body / returns | Status |
|--------|------|-----|----------------|:--:|
| POST | `/api/payments/online` | student | `{planId,months?}` → **`{accessCode}`** (browser resumes Paystack) | ❌ 404 |
| POST | `/api/payments/offline` | student | `{planId,months?,amount,method,reference?,proofUrl}` → provisional access (`pending-offline`) | ❌ 404 |
| GET | `/api/admin/payments/offline` | admin | review queue `[{id,student{id,fullname},planId,amount,method,reference,proofUrl,status,createdAt}]` | ❌ 404 |
| PATCH | `/api/admin/payments/offline/:id` | admin | `{decision:'approve'|'reject'}` — approve reuses `POST /admin/payments/manual` | ❌ 404 |
| PATCH | `/api/admin/users/:id/access` | admin | `{enabled:boolean}` — master disable/enable | ❌ 404 |
| GET | `/api/admin/settings/access` | admin | caps `{freeTests,freeMaterials,freeLiveClasses,portalTests,portalMaterials,portalLiveClasses}` | ❌ 404 |
| PATCH | `/api/admin/settings/access` | admin | partial caps update | ❌ 404 |

### Registration — offline at signup
`POST /api/auth/register` (already exists) now **also** carries, on the offline
path: `paymentMethod:'offline'`, `paymentProofUrl`, `paymentReference`. The
backend should record a `pending-offline` payment + provisional access and skip
the gateway. *(The register endpoint exists; these extra fields need handling.)*

### Existing rails to reuse
- `POST /api/admin/payments/manual` — **already live** — `{studentId, amount,
  method, reference}` marks a student paid offline (use this to fulfil an
  approval).
- Register-first Paystack (`src/lib/paystack.ts`) — the online rail.

### Student fields on `GET /auth/me`
`accessLevel: 'free'|'portal'|'tutorial'`, `tutorialExpiry`, `paymentStatus`,
`accessEnabled`.

### Live class
Add `isFree: boolean` (admin-settable) — a free class is joinable by everyone and
ignores the caps.

### Enforcement (Phase 2, not now)
When `PAYWALL_ENABLED` turns on, the level + caps in §1 must be enforced
**server-side** on the gated routes (community, assignments, live classes, tests,
materials), and each admin permission key (e.g. `payments.history`,
`payments.verify`) checked on its endpoint.
