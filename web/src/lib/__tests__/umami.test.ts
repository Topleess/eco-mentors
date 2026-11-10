/** @jest-environment jsdom */
import { setConsent } from '@/lib/consent'

describe('manual public Umami tracking', () => {
  beforeEach(() => {
    jest.resetModules()
    document.head.innerHTML = ''
    window.history.replaceState({}, '', '/')
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = 'umami'
    process.env.NEXT_PUBLIC_UMAMI_URL = 'http://localhost:18185'
    process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = '12345678-1234-1234-1234-123456789abc'
    setConsent('accepted')
    Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true })
    delete (window as unknown as { umami?: unknown }).umami
  })

  it('retains only bounded UTM campaign labels, never arbitrary query values', async () => {
    const { trackUmamiPageview } = await import('@/lib/umami')
    const track = jest.fn()
    Object.assign(window, { umami: { track } })
    trackUmamiPageview('/research?utm_source=telegram&utm_medium=social&utm_campaign=mentors-2026&token=secret&email=private@example.com#private')
    expect(track.mock.calls[0][0].url).toBe('/research?utm_source=telegram&utm_medium=social&utm_campaign=mentors-2026')
    trackUmamiPageview('/about?utm_campaign=person%40example.com&utm_term=private+search')
    expect(track.mock.calls[1][0].url).toBe('/about')
  })

  it('drops private routes, encoded paths, withdrawn consent and DNT at every send', async () => {
    const { trackUmamiPageview, trackUmamiEvent } = await import('@/lib/umami')
    const track = jest.fn()
    Object.assign(window, { umami: { track } })
    for (const path of [
      '/mentor',
      '/mentor/requests/abc',
      '/mentor/auth/callback',
      '/admin',
      '/reviews/new',
      '/dev',
      '/mentor/%61uth',
      '/mentor/a/../login',
      '/mentor/12345678-1234-1234-1234-123456789abc',
    ])
      trackUmamiPageview(path)
    expect(track).not.toHaveBeenCalled()
    trackUmamiEvent('mentor_auth_login_requested', { email: 'secret' })
    expect(track).not.toHaveBeenCalled()
    trackUmamiEvent('mentors_search_used', { query: 'private', mentor_id: '123', results_count: 3 })
    expect(track.mock.calls[0][0]).toMatchObject({
      name: 'mentors_search_used',
      data: { results_count: 3 },
    })
    setConsent('declined')
    trackUmamiPageview('/about')
    trackUmamiEvent('donate_cta_clicked')
    expect(track).toHaveBeenCalledTimes(1)
    setConsent('accepted')
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
    trackUmamiPageview('/faq')
    expect(track).toHaveBeenCalledTimes(1)
  })

  it('accepts public detail UUIDs, strips query and referrer secrets, and deduplicates SPA views', async () => {
    const { trackUmamiPageview } = await import('@/lib/umami')
    Object.defineProperty(document, 'referrer', {
      value: 'https://example.org/private?token=secret',
      configurable: true,
    })
    const track = jest.fn()
    Object.assign(window, { umami: { track } })
    const id = '12345678-1234-1234-1234-123456789abc'
    for (const path of [
      '/mentor/public-slug/contact',
      `/research/${id}`,
      `/vacancies/${id}`,
      '/about',
    ]) {
      trackUmamiPageview(`${path}?search=private#secret`)
      trackUmamiPageview(path)
    }
    expect(track).toHaveBeenCalledTimes(4)
    for (const [data] of track.mock.calls) {
      expect(data.url).not.toMatch(/[?#]/)
      expect(data.referrer).toBe('https://example.org')
    }
    trackUmamiPageview('/admin')
    trackUmamiPageview('/about')
    expect(track).toHaveBeenCalledTimes(5)
    Object.defineProperty(document, 'referrer', { value: '', configurable: true })
  })

  it('does not load before consent or on DNT, retries load failure only twice', async () => {
    const { initializeUmami } = await import('@/lib/umami')
    setConsent('declined')
    initializeUmami()
    expect(document.querySelector('script')).toBeNull()
    setConsent('accepted')
    initializeUmami()
    document.querySelector('script')?.dispatchEvent(new Event('error'))
    initializeUmami()
    document.querySelector('script')?.dispatchEvent(new Event('error'))
    initializeUmami()
    expect(document.querySelector('script')).toBeNull()
  })

  it('handles rejected tracker promises without breaking the site', async () => {
    const { trackUmamiPageview, trackUmamiEvent } = await import('@/lib/umami')
    const result = Promise.resolve(undefined)
    const caught = jest.spyOn(result, 'catch')
    Object.assign(window, { umami: { track: () => result } })
    trackUmamiPageview('/')
    trackUmamiEvent('donate_cta_clicked')
    expect(caught).toHaveBeenCalledTimes(2)
  })

  it('loads once, opts out of all automation, sends explicit sanitized pageviews', async () => {
    const { initializeUmami, trackUmamiPageview } = await import('@/lib/umami')
    initializeUmami()
    initializeUmami()
    const scripts = document.querySelectorAll('script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].getAttribute('data-auto-track')).toBe('false')
    expect(scripts[0].getAttribute('data-performance')).toBe('false')
    const track = jest.fn()
    Object.assign(window, { umami: { track } })
    scripts[0].dispatchEvent(new Event('load'))
    trackUmamiPageview('/?email=private@example.com#token=secret')
    expect(track).toHaveBeenCalledTimes(1)
    expect(track.mock.calls[0][0]).toEqual({
      website: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
      hostname: 'localhost',
      language: 'en',
      screen: '0x0',
      url: '/',
      referrer: '',
      title: 'Home',
    })
  })
})
