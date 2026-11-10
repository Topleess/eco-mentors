import { researchProxy } from '@/server/research-proxy'
import { withObservability } from '@/lib/with-observability'

export default withObservability('/api/admin/research/covers', researchProxy('/admin/research/covers', ['POST'], true))
export const config = { api: { bodyParser: { sizeLimit: '14mb' } } }
