import type { NextApiRequest, NextApiResponse } from 'next'
import { withObservability } from '@/lib/with-observability'
import { privateMentorPhotoProxy } from '@/server/mentor-photo-proxy'
function handler(req: NextApiRequest, res: NextApiResponse) { return privateMentorPhotoProxy(req, res, 'own') }

export default withObservability('/api/mentor/profile/photo', handler)
