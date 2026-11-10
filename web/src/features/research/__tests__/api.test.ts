import { saveResearch } from '@/features/research/api'

describe('research persistence', () => {
  afterEach(() => jest.restoreAllMocks())
  it('requires exact saved fields on GET readback, not merely matching version', async () => {
    const saved = { id: 'one', version: 1, title: 'Saved' }
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ research: saved }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ research: { ...saved, title: 'Wrong' } }),
      })
    await expect(saveResearch(saved as never)).rejects.toThrow('Readback conflict')
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/admin/research/one',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    )
  })
})
it('sends contract write fields only, not server identity or timestamps', async () => {
  const saved = { id: 'one', title: 'Study', version: 2, createdAt: 'server', updatedAt: 'server' }
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ research: saved }) })
  await saveResearch(saved as never, 'one')
  const options = (fetch as jest.Mock).mock.calls[0][1] as RequestInit
  expect(JSON.parse(options.body as string)).toEqual({ title: 'Study', version: 2 })
})
