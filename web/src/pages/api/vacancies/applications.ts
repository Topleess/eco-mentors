import { vacancyProxy } from '@/server/vacancy-proxy'
import { withObservability } from '@/lib/with-observability'

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } }
export default withObservability('/api/vacancies/applications', vacancyProxy('/vacancies/applications', ['POST']))
