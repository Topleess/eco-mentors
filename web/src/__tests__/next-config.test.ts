/**
 * @jest-environment node
 */

interface HeaderRule {
  source: string
  headers: { key: string; value: string }[]
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextConfig = require('../../next.config.js') as { headers: () => Promise<HeaderRule[]> }

describe('next.config.js headers', () => {
  // Per-user BFF responses must stay out of the browser HTTP cache: an ETag
  // revalidation in Safari handed fetch() an empty 200 and broke the mentor inbox.
  it('permits only the configured HTTPS Umami origin for scripts and requests', async () => {
    process.env.NEXT_PUBLIC_UMAMI_URL = 'https://analytics.example.org/nested'
    const rules = await nextConfig.headers()
    const csp = rules.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy')?.value || ''
    expect(csp).toContain('https://analytics.example.org')
    expect(csp).not.toContain('https://analytics.example.org/nested')
    delete process.env.NEXT_PUBLIC_UMAMI_URL
  })
  it('does not interpolate malformed or non-HTTPS analytics configuration into CSP', async () => {
    process.env.NEXT_PUBLIC_UMAMI_URL = "http://bad.example; script-src *"
    const rules = await nextConfig.headers()
    const csp = rules.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy')?.value || ''
    expect(csp).not.toContain('bad.example')
    delete process.env.NEXT_PUBLIC_UMAMI_URL
  })
  it('marks every /api response no-store', async () => {
    const rules = await nextConfig.headers()
    const apiRule = rules.find((rule) => rule.source === '/api/:path*')

    expect(apiRule?.headers).toContainEqual({ key: 'Cache-Control', value: 'no-store' })
  })
})
