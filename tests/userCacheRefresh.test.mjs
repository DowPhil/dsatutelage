// The student dashboard gates features on the cached user (localStorage
// 'dsa_user'). These tests check that writing a fresh /auth/me profile into
// that cache notifies subscribers and flips the access gates, so a plan the
// admin confirms shows up without signing out and in.
//
// Runs on Node's built-in test runner with native TypeScript stripping:
//   npm test
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// A minimal browser: an EventTarget window and an in-memory localStorage.
class MemoryStorage {
  #items = new Map()
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null }
  setItem(key, value) { this.#items.set(key, String(value)) }
  removeItem(key) { this.#items.delete(key) }
  clear() { this.#items.clear() }
}
globalThis.window = new EventTarget()
Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
})

const { setUser, getUser, getUserSnapshot, subscribeUser, USER_UPDATED_EVENT } =
  await import('../src/lib/auth.ts')
const { accessLevel, canAccess, capFor, PAYWALL_ENABLED } = await import('../src/lib/access.ts')

const freeStudent = {
  id: 's1', role: 'student', fullName: 'Ada', accessLevel: 'free',
  paymentStatus: 'pending-offline', accessEnabled: true,
}
const months = (n) => {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return d.toISOString()
}

describe('cached user refresh after a payment is confirmed', () => {
  beforeEach(() => localStorage.clear())

  it('writing a fresh profile notifies subscribers once, and not again for the same profile', () => {
    let calls = 0
    const unsubscribe = subscribeUser(() => { calls += 1 })

    setUser(freeStudent)
    assert.equal(calls, 1)
    setUser({ ...freeStudent }) // the next /auth/me poll, nothing changed
    assert.equal(calls, 1, 'an unchanged profile does not re-render the dashboard')

    unsubscribe()
    setUser({ ...freeStudent, fullName: 'Ada L.' })
    assert.equal(calls, 1, 'unsubscribed listeners are not called')
  })

  it('also reaches listeners of the existing dsa:user-updated event (dashboard header)', () => {
    let heard = 0
    const onUpdated = () => { heard += 1 }
    window.addEventListener(USER_UPDATED_EVENT, onUpdated)
    setUser(freeStudent)
    window.removeEventListener(USER_UPDATED_EVENT, onUpdated)
    assert.equal(USER_UPDATED_EVENT, 'dsa:user-updated')
    assert.equal(heard, 1)
  })

  it('the snapshot changes value when the plan changes, so useSyncExternalStore re-renders', () => {
    setUser(freeStudent)
    const before = getUserSnapshot()
    setUser({ ...freeStudent, accessLevel: 'tutorial', paymentStatus: 'active', tutorialExpiry: months(1) })
    assert.notEqual(getUserSnapshot(), before)
    assert.equal(getUserSnapshot(), getUserSnapshot(), 'stable between changes')
  })

  it('an approved tutorial plan unlocks the gates as soon as the profile is cached', { skip: !PAYWALL_ENABLED && 'paywall disabled by env' }, () => {
    setUser(freeStudent)
    assert.equal(accessLevel(getUser()), 'free')
    assert.equal(canAccess('assignments', getUser()), false)
    assert.notEqual(capFor('tests', getUser()), Infinity)

    // What the dashboard's /auth/me refresh writes after the admin approves.
    setUser({ ...freeStudent, accessLevel: 'tutorial', paymentStatus: 'active', tutorialExpiry: months(3) })
    assert.equal(accessLevel(getUser()), 'tutorial')
    assert.equal(canAccess('assignments', getUser()), true)
    assert.equal(capFor('tests', getUser()), Infinity)
    assert.equal(capFor('materials', getUser()), Infinity)
  })

  it('a lapsed plan in the cache reads as Free', () => {
    setUser({ ...freeStudent, accessLevel: 'tutorial', paymentStatus: 'active', tutorialExpiry: months(-1) })
    assert.equal(accessLevel(getUser()), 'free')
  })
})
