import { vacancyProxy } from '@/server/vacancy-proxy'
import { withObservability } from '@/lib/with-observability'

export default withObservability('/api/admin/vacancies/:id/telegram/reparse', vacancyProxy('/admin/vacancies', ['GET'], true, true, '/telegram/reparse'))
