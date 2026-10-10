// The two upload workflows, rendered: the admin Library modal and the tutor
// Course Materials form. The real upload code runs (lib/cloudinary,
// lib/materialUpload, the API clients); only the network is faked — the DSA
// API and Cloudinary's upload endpoint (tests/components/fakeApi.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LibraryPage from '@/app/admin/components/Library'
import CourseMaterials from '@/components/dashboard/CourseMaterials'
import { CLOUDINARY, SECURE_URL, cloudinaryOk, fakeNetwork, pdf } from './fakeApi'

const MATERIALS = /\/api\/courses\/[^/]+\/materials$/

const afterschoolCourse = {
  id: 'course-as', title: 'Mathematics', subject: 'Mathematics',
  category: 'afterschool', classLevel: '', isGeneral: false,
}

const savedMaterial = (body: Record<string, unknown>) => ({
  id: 'mat-1', courseId: 'course-as', createdAt: '2026-10-11T10:00:00Z', ...body,
})

const pickFile = (container: HTMLElement, file: File) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------- admin

describe('admin Library upload', () => {
  const setup = async () => {
    localStorage.setItem('token', 'admin-test-token')
    const net = fakeNetwork()
    net.on('GET', /\/api\/courses$/, { body: { success: true, count: 1, data: [afterschoolCourse] } })
    net.on('GET', MATERIALS, { body: { success: true, data: [] } })
    net.on('POST', CLOUDINARY, cloudinaryOk)
    net.on('POST', MATERIALS, {
      status: 201,
      body: { success: true, data: savedMaterial({ title: 'Week 1 notes', type: 'pdf', url: SECURE_URL, classLevel: 'SS1', isDownloadable: true }) },
    })
    const view = render(<LibraryPage />)
    await screen.findByRole('option', { name: /Mathematics \(Mathematics\) — After-School/ })
    fireEvent.click(screen.getByRole('button', { name: /Add Material/ }))
    return { net, ...view }
  }

  it('offers After-School SS1 and SS2 as separate classes', async () => {
    await setup()
    const classSelect = screen.getByDisplayValue('Choose the class…') as HTMLSelectElement
    expect([...classSelect.options].map((o) => [o.value, o.textContent])).toEqual([
      ['', 'Choose the class…'],
      ['SS1', 'After-School SS1'],
      ['SS2', 'After-School SS2'],
    ])
    expect(screen.getByRole('option', { name: 'After-School SS1' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'After-School SS2' })).toBeTruthy()
  })

  it('uploads the file, requires a class, then saves Cloudinary’s secure_url and shows the saved link', async () => {
    const { net, container } = await setup()
    pickFile(container, pdf())

    // The URL field fills with exactly what Cloudinary returned.
    await waitFor(() => expect(screen.getByPlaceholderText('https://...')).toHaveProperty('value', SECURE_URL))
    expect(net.posts(CLOUDINARY)).toHaveLength(1)

    // No class chosen yet → refused with a clear message, nothing saved.
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/After-School SS1 or After-School SS2/))
    expect(net.posts(MATERIALS)).toHaveLength(0)

    fireEvent.change(screen.getByDisplayValue('Choose the class…'), { target: { value: 'SS1' } })
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => expect(net.posts(MATERIALS)).toHaveLength(1))
    expect(net.posts(MATERIALS)[0].body).toMatchObject({
      title: 'Week 1 notes', type: 'pdf', url: SECURE_URL, classLevel: 'SS1',
      publicId: 'materials/week1', resourceType: 'raw', format: 'pdf', fileSizeBytes: 2048,
    })
    // The saved record is listed, linking to the URL the server stored.
    expect(await screen.findByText(/Material added to course library for After-School SS1/)).toBeTruthy()
    const link = screen.getByRole('link', { name: /Download/ })
    expect(link.getAttribute('href')).toBe(SECURE_URL)
  })

  it('a Cloudinary response without a secure_url is an upload error, and nothing can be saved', async () => {
    const { net, container } = await setup()
    net.on('POST', CLOUDINARY, { status: 200, body: { public_id: 'x' } })
    pickFile(container, pdf())
    expect((await screen.findByRole('alert')).textContent).toMatch(/did not return a file link/)
    expect(screen.getByPlaceholderText('https://...')).toHaveProperty('value', '')
  })

  it('Cloudinary’s own error is shown (e.g. a missing upload preset)', async () => {
    const { net, container } = await setup()
    net.on('POST', CLOUDINARY, { status: 400, body: { error: { message: 'Upload preset not found' } } })
    pickFile(container, pdf())
    expect((await screen.findByRole('alert')).textContent).toMatch(/Upload preset not found/)
  })

  it('an unsupported file is refused before anything is uploaded', async () => {
    const { net, container } = await setup()
    pickFile(container, new File(['MZ'], 'setup.exe', { type: 'application/octet-stream' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/can’t be uploaded/)
    expect(net.posts(CLOUDINARY)).toHaveLength(0)
  })

  it('a failed save keeps the form (class and uploaded link) so a retry needs no new upload', async () => {
    const { net, container } = await setup()
    net.on('POST', MATERIALS, { status: 500, body: { message: 'Database unavailable' } })
    pickFile(container, pdf())
    await waitFor(() => expect(screen.getByPlaceholderText('https://...')).toHaveProperty('value', SECURE_URL))
    fireEvent.change(screen.getByDisplayValue('Choose the class…'), { target: { value: 'SS2' } })
    fireEvent.submit(container.querySelector('form')!)

    expect((await screen.findByRole('alert')).textContent).toMatch(/Database unavailable/)
    expect(screen.getByDisplayValue('After-School SS2')).toBeTruthy()
    expect(screen.getByPlaceholderText('https://...')).toHaveProperty('value', SECURE_URL)

    net.on('POST', MATERIALS, { status: 201, body: { success: true, data: savedMaterial({ title: 'Week 1 notes', type: 'pdf', url: SECURE_URL, classLevel: 'SS2' }) } })
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByText(/for After-School SS2/)).toBeTruthy()
    expect(net.posts(CLOUDINARY)).toHaveLength(1)
    expect(net.posts(MATERIALS)).toHaveLength(2)
  })

  it('a double submit sends one save', async () => {
    const { net, container } = await setup()
    let release: () => void = () => {}
    net.on('POST', MATERIALS, () => new Promise((resolve) => {
      release = () => resolve({ status: 201, body: { success: true, data: savedMaterial({ title: 'Week 1 notes', type: 'pdf', url: SECURE_URL, classLevel: 'SS1' }) } })
    }))
    pickFile(container, pdf())
    await waitFor(() => expect(screen.getByPlaceholderText('https://...')).toHaveProperty('value', SECURE_URL))
    fireEvent.change(screen.getByDisplayValue('Choose the class…'), { target: { value: 'SS1' } })
    const form = container.querySelector('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(net.posts(MATERIALS)).toHaveLength(1))
    await act(async () => release())
    expect(net.posts(MATERIALS)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------- tutor

describe('tutor Course Materials upload', () => {
  const setup = async () => {
    localStorage.setItem('dsa_token', 'tutor-test-token')
    const net = fakeNetwork()
    let saved: unknown[] = []
    net.on('GET', /\/api\/courses\?tutorId=me$/, { body: { success: true, data: [afterschoolCourse] } })
    net.on('GET', MATERIALS, async () => ({ body: { success: true, data: saved } }))
    net.on('POST', CLOUDINARY, cloudinaryOk)
    net.on('POST', MATERIALS, async () => {
      const body = net.posts(MATERIALS).at(-1)!.body as Record<string, unknown>
      const record = savedMaterial(body)
      saved = [record]
      return { status: 201, body: { success: true, data: record } }
    })
    const view = render(<CourseMaterials mode='tutor' />)
    await screen.findByRole('option', { name: /Mathematics — After-School/ })
    return { net, ...view }
  }

  it('uploads, requires SS1/SS2, saves the secure_url with the class, and lists the saved link', async () => {
    const { net, container } = await setup()
    expect(screen.getByRole('option', { name: 'After-School SS1' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'After-School SS2' })).toBeTruthy()

    pickFile(container, pdf())
    expect(await screen.findByText('File uploaded ✓')).toBeTruthy()
    expect(screen.getByPlaceholderText('File / video URL (https://…)')).toHaveProperty('value', SECURE_URL)

    const form = container.querySelector('form')!
    fireEvent.submit(form)
    expect(await screen.findByText(/Choose the class: After-School SS1 or After-School SS2/)).toBeTruthy()
    expect(net.posts(MATERIALS)).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'SS2' } })
    fireEvent.submit(form)
    await waitFor(() => expect(net.posts(MATERIALS)).toHaveLength(1))
    expect(net.posts(MATERIALS)[0].body).toMatchObject({ url: SECURE_URL, classLevel: 'SS2', publicId: 'materials/week1' })

    expect(await screen.findByText('Saved for After-School SS2 ✓')).toBeTruthy()
    const row = (await screen.findByText('Week 1 notes')).closest('div')!.parentElement!
    expect(within(row).getByText(/After-School SS2/)).toBeTruthy()
    expect(within(row).getByTitle('Open').getAttribute('href')).toBe(SECURE_URL)
  })

  it('cannot save while the file is still uploading', async () => {
    const { net, container } = await setup()
    net.on('POST', CLOUDINARY, () => new Promise(() => {})) // never finishes
    pickFile(container, pdf())
    const button = await screen.findByRole('button', { name: /Add Material/ })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true))
  })

  it('a refused upload leaves no link behind and says why', async () => {
    const { net, container } = await setup()
    net.on('POST', CLOUDINARY, { status: 400, body: { error: { message: 'Upload preset not found' } } })
    pickFile(container, pdf())
    expect(await screen.findByText('Upload preset not found')).toBeTruthy()
    expect(screen.getByPlaceholderText('File / video URL (https://…)')).toHaveProperty('value', '')
  })

  it('a save error is shown and the form is kept', async () => {
    const { net, container } = await setup()
    net.on('POST', MATERIALS, { status: 403, body: { message: 'Not authorized to manage this course' } })
    pickFile(container, pdf())
    await screen.findByText('File uploaded ✓')
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'SS1' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByText('Not authorized to manage this course')).toBeTruthy()
    expect(screen.getByPlaceholderText('File / video URL (https://…)')).toHaveProperty('value', SECURE_URL)
  })

  it('if the tutor’s courses cannot load, it says so instead of switching to an offline preview', async () => {
    localStorage.setItem('dsa_token', 'tutor-test-token')
    const net = fakeNetwork()
    net.on('GET', /\/api\/courses\?tutorId=me$/, { status: 500, body: { message: 'Server error' } })
    render(<CourseMaterials mode='tutor' />)
    expect(await screen.findByText(/Could not load your courses/)).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Mathematics/ })).toBeNull()
  })
})
