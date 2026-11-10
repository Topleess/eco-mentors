import React from 'react'
import { render, cleanup } from '@testing-library/react'
import type { AppProps } from 'next/app'
const mockUmami = jest.fn()
const mockPosthog = jest.fn()
const mockGtm = jest.fn()
const mockOn = jest.fn()
const mockOff = jest.fn()
jest.mock('@/lib/umami', () => ({
  initializeUmami: () => mockUmami(),
  trackUmamiPageview: jest.fn(),
}))
jest.mock('@/lib/posthog', () => ({ initializePostHog: () => mockPosthog() }))
jest.mock('react-gtm-module', () => ({ initialize: () => mockGtm() }))
jest.mock('@/lib/faro', () => ({ initializeFaro: jest.fn(), trackRouteChange: jest.fn() }))
jest.mock('@/lib/consent', () => ({
  onAnalyticsConsentGranted: (cb: () => void) => {
    cb()
    return () => {}
  },
}))
jest.mock('@/components', () => ({ CookieConsentBanner: () => null }))
jest.mock('next/font/google', () => ({
  Inter: () => ({}),
  Archivo: () => ({}),
  IBM_Plex_Mono: () => ({}),
  Schibsted_Grotesk: () => ({}),
}))
jest.mock('next/router', () => ({
  useRouter: () => ({ locale: 'en', events: { on: mockOn, off: mockOff } }),
}))

afterEach(cleanup)
it.each(['posthog', 'legacy-provider', 'none'])(
  'preserves provider initialization for %s',
  async (provider) => {
    jest.resetModules()
    jest.doMock('react', () => React)
    mockUmami.mockClear()
    mockPosthog.mockClear()
    mockGtm.mockClear()
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = provider
    const { default: App } = await import('@/pages/_app')
    render(
      React.createElement(App, { Component: () => null, pageProps: {} } as unknown as AppProps),
    )
    expect(mockUmami).not.toHaveBeenCalled()
    expect(mockPosthog).toHaveBeenCalledTimes(provider === 'none' ? 0 : 1)
    expect(mockGtm).toHaveBeenCalledTimes(provider === 'none' ? 0 : 1)
  },
)
it('initializes only Umami when selected, and registers SPA navigation', async () => {
  jest.resetModules()
  jest.doMock('react', () => React)
  mockUmami.mockClear()
  mockPosthog.mockClear()
  mockGtm.mockClear()
  process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = 'umami'
  const { default: App } = await import('@/pages/_app')
  render(React.createElement(App, { Component: () => null, pageProps: {} } as unknown as AppProps))
  expect(mockUmami).toHaveBeenCalledTimes(1)
  expect(mockPosthog).not.toHaveBeenCalled()
  expect(mockGtm).not.toHaveBeenCalled()
  expect(mockOn).toHaveBeenCalledWith('routeChangeComplete', expect.any(Function))
})
