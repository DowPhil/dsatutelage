// Admin Library and tutor Course Materials uploads: the class a material is
// for (After-School SS1 vs SS2, matching the timetable), the draft checks both
// forms share, the request body they send, and how a Cloudinary response is
// read. Cloudinary is never contacted: fetch is replaced in these tests.
//
//   npm test
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'

const {
  AFTERSCHOOL_CLASS_OPTIONS,
  classOptionsForCourse,
  resolveClassLevel,
  materialDraftError,
  materialFileError,
  buildMaterialPayload,
  classLevelLabel,
} = await import('../src/lib/materialUpload.ts')
const { AFTERSCHOOL_LEVELS, timetableKey, afterschoolLevelFromClass } =
  await import('../src/lib/timetable.ts')
const { uploadToCloudinary, parseCloudinaryUpload } = await import('../src/lib/cloudinary.ts')

const SECURE_URL = 'https://res.cloudinary.com/demo/raw/upload/v1700000000/materials/week1.pdf'
const afterschool = { category: 'afterschool' }
const jamb = { category: 'jamb' }
const draft = (over = {}) => ({ title: 'Week 1 notes', url: SECURE_URL, classLevel: '', ...over })

describe('After-School SS1 and SS2 are separate classes', () => {
  it('are two distinct options, labelled and valued per class', () => {
    assert.deepEqual(AFTERSCHOOL_CLASS_OPTIONS, [
      { value: 'SS1', label: 'After-School SS1' },
      { value: 'SS2', label: 'After-School SS2' },
    ])
    assert.deepEqual(classOptionsForCourse(afterschool), AFTERSCHOOL_CLASS_OPTIONS)
  })

  it('match the timetable: each option names a real After-School timetable', () => {
    assert.deepEqual(AFTERSCHOOL_CLASS_OPTIONS.map((o) => o.value.toLowerCase()), [...AFTERSCHOOL_LEVELS])
    assert.equal(timetableKey('afterschool', 'science', afterschoolLevelFromClass('SS1')), 'afterschool-ss1-science')
    assert.equal(timetableKey('afterschool', 'art', afterschoolLevelFromClass('SS2')), 'afterschool-ss2-art')
  })

  it('a student registered as SS2 reads the SS2 timetable, not the SS1 default', () => {
    assert.equal(afterschoolLevelFromClass('SS2'), 'ss2')
    assert.equal(afterschoolLevelFromClass('ss 1'), 'ss1')
    assert.equal(afterschoolLevelFromClass('SS3'), null)
    assert.equal(afterschoolLevelFromClass(undefined), null)
  })

  it('other programmes need no class; a course tied to one class offers only that class', () => {
    assert.deepEqual(classOptionsForCourse(jamb), [])
    assert.deepEqual(classOptionsForCourse({ category: 'afterschool', classLevel: 'SS2' }), [
      { value: 'SS2', label: 'After-School SS2' },
    ])
    assert.equal(resolveClassLevel({ category: 'afterschool', classLevel: 'SS2' }, ''), 'SS2')
    assert.equal(classLevelLabel('afterschool', 'SS1'), 'After-School SS1')
  })
})

describe('upload form checks (admin and tutor)', () => {
  it('requires a class for After-School, and the selected class is the one submitted', () => {
    assert.match(materialDraftError(draft(), afterschool), /After-School SS1 or After-School SS2/)
    assert.equal(materialDraftError(draft({ classLevel: 'SS3' }), afterschool) !== null, true)
    assert.equal(materialDraftError(draft({ classLevel: 'SS1' }), afterschool), null)

    for (const level of ['SS1', 'SS2']) {
      const body = buildMaterialPayload(
        { ...draft({ classLevel: level }), type: 'pdf', isDownloadable: true },
        afterschool,
      )
      assert.equal(body.classLevel, level)
    }
  })

  it('sends no class for programmes that do not take one', () => {
    const body = buildMaterialPayload({ ...draft({ classLevel: 'SS1' }), type: 'pdf', isDownloadable: true }, jamb)
    assert.equal('classLevel' in body, false)
  })

  it('refuses to save while the file is still uploading, without a title, or without a hosted link', () => {
    assert.match(materialDraftError(draft(), jamb, { uploading: true }), /finish uploading/)
    assert.match(materialDraftError(draft({ title: ' ' }), jamb), /title/)
    assert.match(materialDraftError(draft({ url: '' }), jamb), /Upload a file/)
    assert.match(materialDraftError(draft({ url: 'undefined' }), jamb), /Upload a file/)
    assert.match(materialDraftError(draft(), null), /course/)
  })

  it('rejects empty and unsupported files before uploading', () => {
    assert.match(materialFileError({ name: 'virus.exe', size: 10 }), /can’t be uploaded/)
    assert.match(materialFileError({ name: 'notes.pdf', size: 0 }), /empty/)
    assert.equal(materialFileError({ name: 'Week 1.PDF', size: 10 }), null)
    assert.equal(materialFileError({ name: 'lesson.mp4', size: 10 }), null)
  })

  it('saves the URL Cloudinary returned, with its metadata — but not under a link pasted over it', () => {
    const upload = { url: SECURE_URL, publicId: 'materials/week1', resourceType: 'raw', format: 'pdf', bytes: 2048 }
    const body = buildMaterialPayload(
      { ...draft({ classLevel: 'SS1' }), type: 'pdf', isDownloadable: true },
      afterschool,
      upload,
    )
    assert.deepEqual(body, {
      title: 'Week 1 notes', type: 'pdf', url: SECURE_URL, isDownloadable: true, classLevel: 'SS1',
      publicId: 'materials/week1', resourceType: 'raw', format: 'pdf', fileSizeBytes: 2048,
    })

    const pasted = buildMaterialPayload(
      { ...draft({ url: 'https://drive.example.com/file', classLevel: 'SS1' }), type: 'link', isDownloadable: false },
      afterschool,
      upload,
    )
    assert.equal(pasted.url, 'https://drive.example.com/file')
    assert.equal('publicId' in pasted, false)
  })
})

describe('reading the Cloudinary upload response', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })

  const mockCloudinary = (status, body) => {
    const calls = []
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: init.body })
      return { ok: status >= 200 && status < 300, status, json: async () => body }
    }
    return calls
  }
  const file = () => new File(['%PDF-1.4'], 'week1.pdf', { type: 'application/pdf' })

  it('returns the secure_url and metadata of a successful upload', async () => {
    const calls = mockCloudinary(200, {
      secure_url: SECURE_URL, public_id: 'materials/week1', resource_type: 'raw', format: 'pdf', bytes: 8,
    })
    const result = await uploadToCloudinary(file(), 'materials')
    assert.deepEqual(result, { url: SECURE_URL, publicId: 'materials/week1', resourceType: 'raw', format: 'pdf', bytes: 8 })

    // Multipart body built by the browser; no API secret goes with it.
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /^https:\/\/api\.cloudinary\.com\/v1_1\/[^/]+\/auto\/upload$/)
    assert.ok(calls[0].body instanceof FormData)
    assert.ok(calls[0].body.get('file') instanceof Blob)
    assert.equal(calls[0].body.get('folder'), 'materials')
    assert.ok(calls[0].body.get('upload_preset'))
    assert.equal(calls[0].body.get('api_secret'), null)
    assert.equal(calls[0].body.get('signature'), null)
  })

  it('a 200 with no secure_url, or a non-https one, is a failure, not an empty link', async () => {
    mockCloudinary(200, { public_id: 'x' })
    await assert.rejects(uploadToCloudinary(file()), /did not return a file link/)
    mockCloudinary(200, { secure_url: 'http://res.cloudinary.com/demo/x.pdf' })
    await assert.rejects(uploadToCloudinary(file()), /did not return a file link/)
    assert.throws(() => parseCloudinaryUpload(200, true, null), /did not return a file link/)
  })

  it('reports Cloudinary\'s own error message when the upload is refused', async () => {
    mockCloudinary(400, { error: { message: 'Upload preset not found' } })
    await assert.rejects(uploadToCloudinary(file()), /Upload preset not found/)
    mockCloudinary(500, null)
    await assert.rejects(uploadToCloudinary(file()), /HTTP 500/)
  })

  it('a network failure says so', async () => {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
    await assert.rejects(uploadToCloudinary(file()), /Could not reach Cloudinary/)
  })
})
