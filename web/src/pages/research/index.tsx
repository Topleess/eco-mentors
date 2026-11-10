import type { ServerResponse } from 'http'
import { Footer, MetaHeader, NavHeader } from '@/components'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/research/messages'
import { ResearchCatalog } from '@/features/research/PublicResearch'
import type { Research } from '@/features/research/model'
import { getGoApiClient } from '@/lib/go-api-client'
export async function getServerSideProps({ res }: { res: Pick<ServerResponse, 'setHeader'> }) {
  res.setHeader('Cache-Control', 'no-store')
  const { research } = await getGoApiClient().request<{ research: Research[] }>(
    'GET',
    '/api/v1/research',
  )
  return { props: { research: research.filter((row) => row.status === 'published') } }
}
export default function Page({ research }: { research: Research[] }): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <>
      <MetaHeader customTitle={t('title')} customDescription={t('title')} />
      <NavHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-12">
        <ResearchCatalog research={research} />
      </main>
      <Footer />
    </>
  )
}
