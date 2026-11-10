import { getConsent } from '@/lib/consent'

type Payload = {
  website: string
  hostname: string
  language: string
  screen: string
  url: string
  referrer: string
  title: string
  name?: string
  data?: Record<string, boolean | number | string>
}
type UmamiWindow = Window & { umami?: { track: (payload: Payload) => unknown } }
let loading = false
let attempts = 0
let lastPage: string | null = null

function permitted(): boolean {
  return (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER?.trim().toLowerCase() === 'umami' &&
    getConsent() === 'accepted' &&
    navigator.doNotTrack !== '1' &&
    (window as Window & { doNotTrack?: string }).doNotTrack !== '1'
  )
}

function publicPage(raw: string): { url: string; title: string } | null {
  const path = raw.split(/[?#]/, 1)[0]
  // Reject encodings before any URL parser can normalize traversal or separators.
  if (!/^\/[a-zA-Z0-9/-]*$/.test(path) || path.includes('//') || path.includes('rvw_')) return null
  const titles: Record<string, string> = {
    '/': 'Home',
    '/about': 'About',
    '/bementor': 'Become a mentor',
    '/faq': 'FAQ',
    '/donate': 'Donate',
    '/mentors': 'Mentors',
    '/vacancies': 'Vacancies',
    '/research': 'Research',
  }
  const url = path.length > 1 ? path.replace(/\/$/, '') : path
  if (titles[url]) return { url, title: titles[url] }
  const mentor = /^\/mentor\/([a-z0-9][a-z0-9-]{0,63})(\/contact)?$/.exec(url)
  if (
    mentor &&
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(mentor[1]) &&
    !['auth', 'requests', 'profile', 'login', 'confirm', 'past', 'admin', 'dev'].includes(mentor[1])
  ) {
    return { url, title: mentor[2] ? 'Mentor contact' : 'Mentor profile' }
  }
  if (/^\/(vacancies|research)\/[a-z0-9][a-z0-9-]{0,127}$/.test(url)) {
    return { url, title: url.startsWith('/research/') ? 'Research detail' : 'Vacancy detail' }
  }
  return null
}

function campaignUrl(raw: string, path: string): string {
  const allowed = new URLSearchParams()
  const query = new URLSearchParams(raw.split('?')[1]?.split('#')[0] || '')
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = query.get(key)
    // Campaign labels only: no contacts, arbitrary search text or token-like blobs.
    if (value && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value) && !/[a-f0-9]{24}/i.test(value) && !/^rvw_/i.test(value)) allowed.set(key, value)
  }
  const labels = allowed.toString()
  return labels ? `${path}?${labels}` : path
}

function payload(raw: string): Payload | null {
  if (!permitted()) return null
  const page = publicPage(raw)
  const website = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  if (!page || !website) return null
  let referrer = ''
  try {
    const ref = new URL(document.referrer)
    if (/^https?:$/.test(ref.protocol)) referrer = ref.origin
  } catch {
    /* No referrer. */
  }
  return {
    website,
    hostname: window.location.hostname,
    language: navigator.language.split('-')[0],
    screen: `${window.screen.width}x${window.screen.height}`,
    ...page,
    url: campaignUrl(raw, page.url),
    referrer,
  }
}

export function trackUmamiPageview(raw?: string): void {
  if (typeof window === 'undefined') return
  const page = payload(raw ?? (window.location.pathname + window.location.search))
  if (!page) {
    lastPage = null
    return
  }
  const client = (window as UmamiWindow).umami
  if (!client || lastPage === page.url.split('?')[0]) return
  try {
    void Promise.resolve(client.track(page)).catch(() => {})
    lastPage = page.url.split('?')[0]
  } catch {
    /* Analytics must not break navigation. */
  }
}

const publicEvents = new Set([
  'mentee_contact_submitted',
  'mentor_registration_submitted',
  'mentors_search_used',
  'mentors_list_load_more_clicked',
  'mentors_sort_changed',
  'mentor_card_clicked',
  'mentor_filters_reset',
  'mentor_filter_changed',
  'donate_cta_clicked',
  'vacancy_apply_clicked',
  'research_original_clicked',
  'research_pdf_clicked',
])

export function trackUmamiEvent(name: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !publicEvents.has(name)) return
  const page = payload(window.location.pathname)
  const client = (window as UmamiWindow).umami
  if (!page || !client) return
  const data: Record<string, boolean | number | string> = {}
  for (const key of ['results_count', 'tags_count', 'page', 'count']) {
    const value = properties?.[key]
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100000)
      data[key] = value
  }
  for (const key of ['has_contact', 'has_filters']) {
    const value = properties?.[key]
    if (typeof value === 'boolean') data[key] = value
  }
  try {
    void Promise.resolve(client.track({ ...page, name, data })).catch(() => {})
  } catch {
    /* Best effort, never queue user data. */
  }
}

export function initializeUmami(): void {
  if (!permitted() || loading || attempts >= 2) return
  if ((window as UmamiWindow).umami) {
    trackUmamiPageview()
    return
  }
  const base = process.env.NEXT_PUBLIC_UMAMI_URL
  if (!base || !process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID) return
  let url: URL
  try {
    url = new URL(base)
  } catch {
    return
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash)
    return
  loading = true
  attempts += 1
  const script = document.createElement('script')
  script.src = `${base.replace(/\/$/, '')}/script.js`
  script.async = true
  script.setAttribute('data-website-id', process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID)
  script.setAttribute('data-auto-track', 'false')
  script.setAttribute('data-performance', 'false')
  script.setAttribute('data-do-not-track', 'true')
  script.referrerPolicy = 'no-referrer'
  script.onload = () => {
    loading = false
    trackUmamiPageview()
  }
  script.onerror = () => {
    loading = false
    script.remove()
  }
  document.head.appendChild(script)
}
