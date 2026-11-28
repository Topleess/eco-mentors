import { vacancyProxy } from '@/server/vacancy-proxy'
import { withObservability } from '@/lib/with-observability'

const handler = vacancyProxy('/admin/vacancies', ['POST'], true, true, '/telegram/publish', 200)
export default withObservability('/api/admin/vacancies/:id/telegram/publish', handler)
