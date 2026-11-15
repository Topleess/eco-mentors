interface ConstantsConfig {
  BASE_URL: string
  CACHE_REFRESH_INTERVAL: number
}

// DOMAIN is public site configuration, exposed to both bundles by next.config.js.
// Until a client domain is configured, metadata stays local rather than pointing upstream.
const domain = process.env.DOMAIN?.replace(/\/+$/, '')
const constants: ConstantsConfig = {
  BASE_URL: domain
    ? `${/^https?:\/\//.test(domain) ? domain : `https://${domain}`}/`
    : 'http://localhost:3000/',
  CACHE_REFRESH_INTERVAL: 1 * 60 * 1000,
}

export default constants
