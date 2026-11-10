import { vacancyProxy } from '@/server/vacancy-proxy'
import { withObservability } from '@/lib/with-observability'

const handler = vacancyProxy('/admin/vacancies', ['GET', 'POST'], true, false)
export default withObservability('/api/admin/vacancies', handler)
