import { vacancyProxy } from '@/server/vacancy-proxy'
import { withObservability } from '@/lib/with-observability'

const handler = vacancyProxy('/admin/vacancies', ['GET', 'PUT'], true, true)
export default withObservability('/api/admin/vacancies/:id', handler)
