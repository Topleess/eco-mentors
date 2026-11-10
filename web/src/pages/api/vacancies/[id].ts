import { vacancyProxy } from '@/server/vacancy-proxy'
import { withObservability } from '@/lib/with-observability'

const handler = vacancyProxy('/vacancies', ['GET'], false, true)
export default withObservability('/api/vacancies/:id', handler)
