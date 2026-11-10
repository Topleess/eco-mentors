import { researchProxy } from '@/server/research-proxy'
import { withObservability } from '@/lib/with-observability'
const handler = researchProxy('/research', ['GET'], false, true)
export default withObservability('/api/research/:id', handler)
