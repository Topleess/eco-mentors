import { getServerSideProps } from '@/pages/donate'
import type { GetServerSidePropsContext } from 'next'

it('redirects the legacy donation page to project information', async () => {
  await expect(getServerSideProps({} as GetServerSidePropsContext)).resolves.toEqual({
    redirect: { destination: '/about', permanent: false },
  })
})
