/** @jest-environment node */
it('is inert during server rendering even for approved events and default pageviews', async () => {
  process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = 'umami'
  const { initializeUmami, trackUmamiPageview, trackUmamiEvent } = await import('@/lib/umami')
  expect(() => {
    initializeUmami()
    trackUmamiPageview()
    trackUmamiEvent('donate_cta_clicked')
  }).not.toThrow()
})
