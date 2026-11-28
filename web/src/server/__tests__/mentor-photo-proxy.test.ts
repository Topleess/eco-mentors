import { mentorPhotoProxy, privateMentorPhotoProxy } from '@/server/mentor-photo-proxy'

test('rejects malformed identifiers without contacting storage', async () => {
 const res: any = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() }
 const fetchSpy = jest.fn()
 global.fetch = fetchSpy
 await mentorPhotoProxy({ method: 'GET', query: { id: '../bad' } } as any, res)
 expect(res.status).toHaveBeenCalledWith(400)
 expect(fetchSpy).not.toHaveBeenCalled()
 fetchSpy.mockRestore()
})

 test('private own preview forwards cookie only to the authenticated endpoint', async () => {
  const res: any = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() }
  const spy = jest.fn().mockResolvedValue({ok:false, status:404})
  global.fetch = spy
  await privateMentorPhotoProxy({method:'GET', query:{}, headers:{cookie:'mentor_session=token'}} as any, res, 'own')
  expect(spy.mock.calls[0][0]).toMatch(/\/api\/v1\/mentor\/profile\/photo$/)
  expect(spy.mock.calls[0][1].headers.cookie).toBe('mentor_session=token')
 })
