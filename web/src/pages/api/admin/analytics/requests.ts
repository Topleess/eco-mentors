import { analyticsRequests } from '@/server/analytics-api'
import { withObservability } from '@/lib/with-observability'
export default withObservability('/api/admin/analytics/requests', analyticsRequests)
