import { researchProxy } from '@/server/research-proxy'
import { withObservability } from '@/lib/with-observability'
export default withObservability('/api/admin/staff/:id', researchProxy('/admin/staff', ['PUT'], true, true))
