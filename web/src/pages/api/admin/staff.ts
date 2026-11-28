import { researchProxy } from '@/server/research-proxy'
import { withObservability } from '@/lib/with-observability'
const handler = researchProxy('/admin/staff', ['GET', 'POST'], true, false)
export default withObservability('/api/admin/staff', handler)
