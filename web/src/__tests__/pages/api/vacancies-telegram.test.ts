/** @jest-environment node */
import { createMocks } from 'node-mocks-http'
import preview from '@/pages/api/admin/vacancies/[id]/telegram/preview'
import publish from '@/pages/api/admin/vacancies/[id]/telegram/publish'

jest.mock('@/lib/with-observability', () => ({ withObservability: (_: string, handler: unknown) => handler }))

it('forwards preview and publication through the real Go client with cookies and version', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ text: 'Message', version: 3 }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ messageId: 42 }), { status: 200 }))
  for (const [handler, action, body] of [[preview, 'preview', {}], [publish, 'publish', { version: 3 }]] as const) {
    const { req, res } = createMocks({ method: 'POST', query: { id: 'one' }, headers: { cookie: 'admin_session=test' }, body })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining(`/api/v1/admin/vacancies/one/telegram/${action}`), expect.objectContaining({ method: 'POST', body: JSON.stringify(body), headers: expect.objectContaining({ Cookie: 'admin_session=test' }) }))
  }
  fetcher.mockRestore()
})

it.each([preview, publish])('blocks anonymous and unsupported requests before reaching the backend', async handler => {
  const fetcher = jest.spyOn(global, 'fetch')
  const anonymous = createMocks({ method: 'POST', query: { id: 'one' } })
  await handler(anonymous.req, anonymous.res)
  expect(anonymous.res.statusCode).toBe(401)
  const wrongMethod = createMocks({ method: 'GET', query: { id: 'one' }, headers: { cookie: 'admin_session=test' } })
  await handler(wrongMethod.req, wrongMethod.res)
  expect(wrongMethod.res.statusCode).toBe(405)
  expect(fetcher).not.toHaveBeenCalled()
  fetcher.mockRestore()
})

it('passes an upstream admin authorization failure through', async () => {
  const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }))
  const { req, res } = createMocks({ method: 'POST', query: { id: 'one' }, headers: { cookie: 'moderator_session=test' }, body: {} })
  await publish(req, res)
  expect(res.statusCode).toBe(403)
  expect(res._getJSONData()).toEqual({ error: 'Forbidden' })
  fetcher.mockRestore()
})
