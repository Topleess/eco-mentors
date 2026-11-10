import { researchProxy } from '@/server/research-proxy'
import { withObservability } from '@/lib/with-observability'
const handler = researchProxy('/admin/research', ['GET', 'PUT'], true, true)
export default withObservability('/api/admin/research/:id', handler)
