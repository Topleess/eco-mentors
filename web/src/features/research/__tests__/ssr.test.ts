/** @jest-environment node */
import { getServerSideProps as list } from '@/pages/research'
import { getServerSideProps as detail } from '@/pages/research/[slug]'
const mockRequest = jest.fn()
jest.mock('@/lib/go-api-client', () => ({
  getGoApiClient: () => ({ request: mockRequest }),
  HttpError: class extends Error {},
}))
it('reads at request time and excludes draft and archived records', async () => {
  mockRequest.mockResolvedValue({
    research: [
      { id: 'one', status: 'published' },
      { id: 'two', status: 'draft' },
    ],
  })
  expect(await list({ res: { setHeader: jest.fn() } })).toEqual({
    props: { research: [{ id: 'one', status: 'published' }] },
  })
  mockRequest.mockResolvedValue({ research: { status: 'archived' } })
  expect(await detail({ params: { slug: 'hidden' }, res: { setHeader: jest.fn() } })).toEqual({
    notFound: true,
  })
})
