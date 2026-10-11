// The plan a student sees on the dashboard (from /auth/me's subscription), the
// classes the admin course form offers, and the Secretary roster's filters.
//
//   npm test
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { planSummary } = await import('../src/lib/subscription.ts')
const { accessLevel } = await import('../src/lib/access.ts')
const { courseClassChoices } = await import('../src/lib/materialUpload.ts')
const { staffRosterParams } = await import('../src/lib/studentRoster.ts')

const NOW = new Date('2026-10-11T12:00:00Z')
const sub = (over) => ({
  status: 'free', label: 'Free', effectiveLevel: 'free', planName: 'Free',
  expiresAt: null, noExpiry: false, ...over,
})

describe('student plan on the dashboard', () => {
  it('Free: the Free plan and the upgrade action', () => {
    const p = planSummary({ accessLevel: 'free', subscription: sub() }, NOW)
    assert.equal(p.status, 'free')
    assert.equal(p.title, 'Free plan')
    assert.equal(p.showUpgrade, true)
  })

  it('active paid plan: its name and end date, no upgrade nag', () => {
    const p = planSummary({
      accessLevel: 'tutorial',
      subscription: sub({ status: 'active', effectiveLevel: 'tutorial', planName: 'JAMB Gold', expiresAt: '2026-11-20T10:00:00Z' }),
    }, NOW)
    assert.deepEqual(p, { status: 'active', title: 'JAMB Gold', detail: 'Active until 20 Nov 2026', showUpgrade: false })
  })

  it('pending approval: shown as pending, never as an active plan', () => {
    const p = planSummary({
      accessLevel: 'tutorial', paymentStatus: 'pending-offline',
      subscription: sub({ status: 'pending', effectiveLevel: 'tutorial', planName: 'Tutorial plan', pendingPlanName: 'JAMB Gold' }),
    }, NOW)
    assert.equal(p.status, 'pending')
    assert.equal(p.title, 'Pending approval')
    assert.match(p.detail, /JAMB Gold is waiting/)
    assert.notEqual(p.title, 'JAMB Gold')
  })

  it('a stale cache without the server block still reads a receipt as pending', () => {
    const p = planSummary({ accessLevel: 'tutorial', paymentStatus: 'pending-offline', tutorialExpiry: '2026-12-01' }, NOW)
    assert.equal(p.status, 'pending')
  })

  it('expired: the last plan marked expired, back on Free with the upgrade action', () => {
    const p = planSummary({
      accessLevel: 'tutorial',
      subscription: sub({ status: 'expired', planName: 'JAMB Gold', expiresAt: '2026-10-01T10:00:00Z' }),
    }, NOW)
    assert.equal(p.title, 'JAMB Gold — expired')
    assert.match(p.detail, /Ended 1 Oct 2026/)
    assert.equal(p.showUpgrade, true)
  })

  it('an "active" answer whose end date has since passed reads as expired', () => {
    const p = planSummary({
      subscription: sub({ status: 'active', effectiveLevel: 'tutorial', planName: 'JAMB Gold', expiresAt: '2026-10-10T10:00:00Z' }),
    }, NOW)
    assert.equal(p.status, 'expired')
  })

  it('renewed: the later end date is shown', () => {
    const before = planSummary({ subscription: sub({ status: 'active', planName: 'JAMB Gold', expiresAt: '2026-10-31T10:00:00Z' }) }, NOW)
    const after = planSummary({ subscription: sub({ status: 'active', planName: 'JAMB Gold', expiresAt: '2026-11-30T10:00:00Z' }) }, NOW)
    assert.equal(before.detail, 'Active until 31 Oct 2026')
    assert.equal(after.detail, 'Active until 30 Nov 2026')
  })

  it('portal / no-expiry plan: active with no end date', () => {
    const p = planSummary({
      accessLevel: 'portal',
      subscription: sub({ status: 'active', effectiveLevel: 'portal', planName: 'Portal Access', noExpiry: true }),
    }, NOW)
    assert.equal(p.title, 'Portal Access')
    assert.equal(p.detail, 'Active · no expiry')
  })

  it('a disabled account shows Access disabled, and the gates agree with the server (Free)', () => {
    const user = {
      accessLevel: 'tutorial', paymentStatus: 'disabled', tutorialExpiry: '2026-12-01',
      subscription: sub({ status: 'disabled', effectiveLevel: 'free' }),
    }
    assert.equal(planSummary(user, NOW).title, 'Access disabled')
    assert.equal(accessLevel(user), 'free')
  })
})

describe('admin course form: class choices', () => {
  it('After-School requires SS1 or SS2, as two separate options', () => {
    const c = courseClassChoices('afterschool')
    assert.equal(c.required, true)
    assert.deepEqual(c.options, [
      { value: 'SS1', label: 'After-School SS1' },
      { value: 'SS2', label: 'After-School SS2' },
    ])
  })

  it('other categories offer the registrable classes, optionally', () => {
    const c = courseClassChoices('jamb')
    assert.equal(c.required, false)
    assert.deepEqual(c.options.map((o) => o.value), ['SS1', 'SS2', 'SS3', 'Jambite/Aspirant', '100 Level', '200 Level'])
  })
})

describe('Secretary roster filters sent to the server', () => {
  const none = { search: '', track: 'all', mode: 'all', status: 'all', department: 'all', courseId: 'all' }

  it('no filters → no parameters (the whole visible roster)', () => {
    assert.deepEqual(staffRosterParams(none), {})
  })

  it('department, course and search combine', () => {
    assert.deepEqual(
      staffRosterParams({ ...none, search: '  ada ', department: 'science', courseId: 'c1', track: 'afterschool', mode: 'online' }),
      { search: 'ada', department: 'science', courseId: 'c1', examTrack: 'afterschool', learningMode: 'online' },
    )
  })

  it('plan: Free, paid / unpaid and a specific plan map to the server filters', () => {
    assert.deepEqual(staffRosterParams({ ...none, plan: 'all' }), {})
    assert.deepEqual(staffRosterParams({ ...none, plan: 'free' }), { accessLevel: 'free' })
    assert.deepEqual(staffRosterParams({ ...none, plan: 'verified' }), { paid: 'verified' })
    assert.deepEqual(staffRosterParams({ ...none, plan: 'unpaid' }), { paid: 'unpaid' })
    assert.deepEqual(
      staffRosterParams({ ...none, plan: '64b0c0ffee0000000000abcd', department: 'art', courseId: 'c2', search: 'bo' }),
      { planId: '64b0c0ffee0000000000abcd', department: 'art', courseId: 'c2', search: 'bo' },
    )
  })
})
