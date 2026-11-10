import { vacancyProxy } from '@/server/vacancy-proxy'
import { withObservability } from '@/lib/with-observability'

const handler = vacancyProxy('/admin/vacancy-cities', ['GET', 'PUT'], true, true)
export default withObservability('/api/admin/vacancy-cities/:id', handler)
