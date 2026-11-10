import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { ResearchEditor } from '@/features/research/ResearchEditor'
import { sample } from '@/features/research/testing-fixture'

const cover = '/api/research/covers/00000000-0000-4000-8000-000000000001'
// Synthetic one-pixel PNG; FileReader and next/image are not mocked.
const png = () => new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII='), (byte) => byte.charCodeAt(0))], 'cover.png', { type: 'image/png' })
beforeEach(() => {
  global.fetch = jest.fn()
})
afterEach(() => jest.restoreAllMocks())
it.each([
  new File(['bad'], 'x.gif', { type: 'image/gif' }),
  new File([], 'empty.png', { type: 'image/png' }),
  new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
])('rejects invalid file before transport and retains existing draft', async (file) => {
  render(<ResearchEditor research={{ ...sample, coverUrl: cover }} onSave={jest.fn()} />)
  fireEvent.change(screen.getByLabelText('Choose cover file'), { target: { files: [file] } })
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(global.fetch).not.toHaveBeenCalled()
  expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining(cover))
})
it.each([400, 413, 503])(
  'retains old cover after upload HTTP %s and retries the same file',
  async (status) => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ coverUrl: cover }) })
    global.fetch = fetcher
    render(
      <ResearchEditor
        research={{ ...sample, coverUrl: 'https://example.com/old.png' }}
        onSave={jest.fn()}
      />,
    )
    const input = screen.getByLabelText('Choose cover file')
    fireEvent.change(input, { target: { files: [png()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      status === 413 ? 'smaller' : status === 400 ? 'another' : 'retry',
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/old.png')
    expect(input).toHaveValue('')
    fireEvent.change(input, { target: { files: [png()] } })
    await waitFor(() =>
      expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining(cover)),
    )
  },
)
it('replaces and removes only the draft cover and offers manual URL in a disclosure', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ coverUrl: cover }) })
  const save = jest.fn().mockResolvedValue(sample)
  const { container } = render(
    <ResearchEditor
      research={{ ...sample, coverUrl: 'https://example.com/old.png' }}
      onSave={save}
    />,
  )
  expect(container.querySelector('details input')).toHaveAttribute(
    'value',
    'https://example.com/old.png',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Replace cover' }))
  fireEvent.change(screen.getByLabelText('Choose cover file'), { target: { files: [png()] } })
  await waitFor(() =>
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining(cover)),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Remove cover' }))
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByText('No cover selected')).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()
  expect(global.fetch).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ coverUrl: '' })))
})
it('shows failed preview without dropping the cover and recovers on replacement', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ coverUrl: cover }) })
  render(
    <ResearchEditor
      research={{ ...sample, coverUrl: 'https://example.com/old.png' }}
      onSave={jest.fn()}
    />,
  )
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByText('Cover preview unavailable')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Choose cover file'), { target: { files: [png()] } })
  await waitFor(() =>
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining(cover)),
  )
})
it.each(['javascript:alert(1)', '/api/admin/research', '/api/research/covers/not-a-uuid'])(
  'does not preview or save an unsafe manual cover %s',
  async (coverUrl) => {
    const save = jest.fn()
    render(<ResearchEditor research={{ ...sample, coverUrl }} onSave={save} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Check required fields')
    expect(save).not.toHaveBeenCalled()
  },
)
it.each(['javascript:alert(1)', '/api/admin/research', null])(
  'rejects unsafe upload response %s without changing old cover',
  async (coverUrl) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ coverUrl }) })
    render(<ResearchEditor research={{ ...sample, coverUrl: cover }} onSave={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('Choose cover file'), { target: { files: [png()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('retry')
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining(cover))
  },
)
it('preserves a new unsaved article across failure, retry and locale switch', async () => {
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ coverUrl: cover }) })
  const save = jest.fn()
  const { rerender } = render(
    <I18nProvider locale="en">
      <ResearchEditor onSave={save} />
    </I18nProvider>,
  )
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unpersisted draft' } })
  fireEvent.change(screen.getByLabelText('Section text (blank lines separate paragraphs)'), {
    target: { value: 'Draft body' },
  })
  fireEvent.change(screen.getByLabelText('Choose cover file'), { target: { files: [png()] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('retry')
  rerender(
    <I18nProvider locale="ru">
      <ResearchEditor onSave={save} />
    </I18nProvider>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Повторите попытку')
  expect(screen.getByDisplayValue('Unpersisted draft')).toBeInTheDocument()
  expect(screen.getByDisplayValue('Draft body')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Выбрать файл обложки'), { target: { files: [png()] } })
  await waitFor(() =>
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining(cover)),
  )
  expect(screen.getByText('Сохраните исследование, чтобы применить обложку')).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()
})
it('disables file picker, replace and remove during article save', async () => {
  render(
    <ResearchEditor
      research={{ ...sample, coverUrl: cover }}
      onSave={() => new Promise(() => {})}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByLabelText('Choose cover file')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Replace cover' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Remove cover' })).toBeDisabled()
})
it('explains allowed file formats and shared size limit before selection', () => {
  render(<ResearchEditor onSave={jest.fn()} />)
  expect(screen.getByText('JPEG, PNG or WEBP, up to 10 MB')).toBeInTheDocument()
})
it('uploads a computer file into the draft without saving the article and locks controls until complete', async () => {
  let finish!: (value: Response) => void
  const fetcher = jest.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  global.fetch = fetcher
  const save = jest.fn().mockResolvedValue(sample)
  render(<ResearchEditor research={sample} onSave={save} />)
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My draft' } })
  fireEvent.change(screen.getByLabelText('Choose cover file'), { target: { files: [png()] } })
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(screen.getByLabelText('Title')).toBeDisabled()
  expect(save).not.toHaveBeenCalled()
  finish({ ok: true, json: async () => ({ coverUrl: cover }) } as Response)
  await waitFor(() =>
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining(cover)),
  )
  expect(fetcher).toHaveBeenCalledWith(
    '/api/admin/research/covers',
    expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('data:image/png;base64,'),
    }),
  )
  expect(screen.getByLabelText('Title')).toHaveValue('My draft')
  expect(screen.getByText('Save the research to apply the cover')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My draft', coverUrl: cover }),
    ),
  )
})
