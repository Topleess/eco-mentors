import { saveVacancy, saveDictionary, loadAdminVacancies } from '@/features/vacancies/api'
import { vacancyFixtures } from '@/features/vacancies/fixtures'

const response = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value })
beforeEach(() => { global.fetch = jest.fn() })
it('writes a vacancy then reads the exact ID back before reporting success', async () => {
  const row = { ...vacancyFixtures[0], id: 'saved/id', version: 2 }
  const fetch = global.fetch as jest.Mock
  fetch.mockResolvedValueOnce(response({ vacancy: row })).mockResolvedValueOnce(response({ vacancy: row }))
  expect(await saveVacancy(row, row.id)).toEqual(row)
  expect(fetch.mock.calls.map(call => [call[0], call[1].method])).toEqual([['/api/admin/vacancies/saved%2Fid', 'PUT'], ['/api/admin/vacancies/saved%2Fid', 'GET']])
})
it('never substitutes fixtures on a failed request', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue(response({ error: 'Unauthorized' }, 401))
  await expect(loadAdminVacancies()).rejects.toMatchObject({ status: 401 })
})
it('reads the saved dictionary ID from the collection after a write', async () => {
  const item = { id: 'city-1', slug: 'city', name: 'City', active: true, version: 2, updatedAt: '' }
  const fetch = global.fetch as jest.Mock
  fetch.mockResolvedValueOnce(response({ item })).mockResolvedValueOnce(response({ items: [item] }))
  expect(await saveDictionary('cities', item, item.id)).toEqual(item)
  expect(fetch.mock.calls[1][0]).toBe('/api/admin/vacancy-cities')
})
