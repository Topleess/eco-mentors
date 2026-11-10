import { researchProxy } from '@/server/research-proxy'
import { withObservability } from '@/lib/with-observability'
const handler = researchProxy('/research', ['GET'], false, false)
export default withObservability('/api/research', handler)
