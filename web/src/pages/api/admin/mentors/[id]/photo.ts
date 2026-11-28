import type { NextApiRequest, NextApiResponse } from 'next'
import { withObservability } from '@/lib/with-observability'
import { privateMentorPhotoProxy } from '@/server/mentor-photo-proxy'
function handler(req: NextApiRequest, res: NextApiResponse) { return privateMentorPhotoProxy(req, res, 'admin') }

export default withObservability('/api/admin/mentors/:id/photo', handler)
