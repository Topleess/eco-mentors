import type { NextApiRequest, NextApiResponse } from 'next'
import { getGoApiClient, HttpError } from '@/lib/go-api-client'
import { logError } from '@/lib/logger'
import { withObservability } from '@/lib/with-observability'

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { email } = req.body ?? {}
  if (typeof email !== 'string' || email.trim().length === 0 || email.length > 255) {
    res.status(400).json({ success: false, message: 'Enter a valid email address' })
    return
  }

  try {
    const { data, headers } = await getGoApiClient().demoLogin(email)
    const setCookies = headers.getSetCookie()
    if (setCookies.length > 0) {
      res.setHeader('Set-Cookie', setCookies)
    }
    res.status(200).json(data)
  } catch (error) {
    if (error instanceof HttpError) {
      logError(new Error(`Demo login failed: ${error.statusCode}`), {
        context: 'demo-login',
        statusCode: error.statusCode,
      })

      if (error.statusCode === 404) {
        res.status(404).json({ success: false, message: 'Demo login is not available' })
        return
      }
      if (error.statusCode === 400) {
        res.status(400).json({ success: false, message: 'Enter a valid email address' })
        return
      }
      if (error.statusCode >= 400 && error.statusCode < 500) {
        res.status(error.statusCode).json({ success: false, message: 'Demo account is unavailable' })
        return
      }
    }

    if (error instanceof Error) {
      logError(error, { context: 'demo-login', method: req.method, url: req.url })
    }
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

export default withObservability('/api/demo/login', handler)
