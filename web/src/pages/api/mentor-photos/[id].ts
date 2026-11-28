import { withObservability } from '@/lib/with-observability'
import { mentorPhotoProxy } from '@/server/mentor-photo-proxy'

export default withObservability('/api/mentor-photos/:id', mentorPhotoProxy)
export const config = { api: { responseLimit: false } }
