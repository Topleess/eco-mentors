import { researchCoverProxy } from '@/server/research-cover-proxy'
import { withObservability } from '@/lib/with-observability'

export default withObservability('/api/research/covers/:id', researchCoverProxy)
export const config = { api: { responseLimit: false } }
