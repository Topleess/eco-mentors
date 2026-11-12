import { render } from '@testing-library/react'
import Migrate, * as page from '@/pages/migrate'
import type { GetServerSidePropsContext } from 'next'

it('retires the public migration page without rendering an upstream form', () => {
  expect(render(<Migrate />).container).toBeEmptyDOMElement()
})

it('redirects old migration links to mentor registration', async () => {
  expect(page).toHaveProperty('getServerSideProps')
  if (!('getServerSideProps' in page)) return
  const result = await page.getServerSideProps({ query: { slug: 'legacy-profile' } } as unknown as GetServerSidePropsContext)
  expect(result).toEqual({ redirect: { destination: '/bementor', permanent: false } })
})
