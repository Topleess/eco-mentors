/** @jest-environment node */
import { getServerSideProps } from '@/pages/sitemap.xml'
import { getAllMentors } from '@/server/mentors-data'
import type { GetServerSidePropsContext } from 'next'
import constants from '@/config/constants'

jest.mock('@/server/mentors-data', () => ({ getAllMentors: jest.fn() }))
jest.mock('@/lib/with-ssr-observability', () => ({ withSSRObservability: (handler: unknown) => handler }))

it('lists both URL languages and declares reciprocal language alternates', async () => {
  jest.mocked(getAllMentors).mockResolvedValue([])
  const write = jest.fn()
  await getServerSideProps({ res: { write, end: jest.fn(), setHeader: jest.fn() } } as unknown as GetServerSidePropsContext)
  const xml = write.mock.calls[0][0] as string
  expect(xml).toContain(`<loc>${constants.BASE_URL}mentors</loc>`)
  expect(xml).toContain(`<loc>${constants.BASE_URL}en/mentors</loc>`)
  expect(xml).toContain('hreflang="ru"')
  expect(xml).toContain('hreflang="en"')
  expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
})
