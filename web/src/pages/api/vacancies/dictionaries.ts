import { vacancyProxy } from '@/server/vacancy-proxy'
import { withObservability } from '@/lib/with-observability'

const handler = vacancyProxy('/vacancies/dictionaries', ['GET'], false, false)
export default withObservability('/api/vacancies/dictionaries', handler)
