import { getServerSideProps } from '@/pages/admin/vacancies/dictionaries'
it('retires the separate dictionary editor with a locale-preserving redirect', async () => {
  expect(await getServerSideProps({ locale: 'ru' } as never)).toEqual({ redirect: { destination: '/admin/vacancies', permanent: false } })
  expect(await getServerSideProps({ locale: 'en' } as never)).toEqual({ redirect: { destination: '/en/admin/vacancies', permanent: false } })
})
