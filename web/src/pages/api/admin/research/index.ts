import { researchProxy } from '@/server/research-proxy'
import { withObservability } from '@/lib/with-observability'
const handler = researchProxy('/admin/research', ['GET', 'POST'], true, false)
export default withObservability('/api/admin/research', handler)
