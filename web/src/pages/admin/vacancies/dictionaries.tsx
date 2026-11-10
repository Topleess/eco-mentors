import type { GetServerSideProps } from 'next'

export default function RetiredDictionaries(): null { return null }
export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({ redirect: { destination: `${locale === 'en' ? '/en' : ''}/admin/vacancies`, permanent: false } })
