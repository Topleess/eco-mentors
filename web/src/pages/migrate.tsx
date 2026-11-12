import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/bementor', permanent: false },
})

export default function Migrate(): null {
  return null
}
