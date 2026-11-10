import type { ServerResponse } from 'http'
import type { ParsedUrlQuery } from 'querystring'
import { Footer, MetaHeader, NavHeader } from '@/components'
import { ResearchDetail } from '@/features/research/PublicResearch'
import type { Research } from '@/features/research/model'
import { getGoApiClient, HttpError } from '@/lib/go-api-client'
export async function getServerSideProps({
  params,
  res,
}: {
  params?: ParsedUrlQuery
  res: Pick<ServerResponse, 'setHeader'>
}) {
  res.setHeader('Cache-Control', 'no-store')
  if (typeof params?.slug !== 'string') return { notFound: true as const }
  try {
    const { research } = await getGoApiClient().request<{ research: Research }>(
      'GET',
      `/api/v1/research/${encodeURIComponent(params.slug)}`,
    )
    return research.status === 'published' ? { props: { research } } : { notFound: true as const }
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 404) return { notFound: true as const }
    throw error
  }
}
export default function Page({ research }: { research: Research }): JSX.Element {
  return (
    <>
      <MetaHeader customTitle={research.title} customDescription={research.summary} />
      <NavHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <ResearchDetail research={research} />
      </main>
      <Footer />
    </>
  )
}
