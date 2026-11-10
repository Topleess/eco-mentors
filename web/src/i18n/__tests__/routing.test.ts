/** @jest-environment node */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../../../next.config.js') as { i18n?: unknown }
it('serves Russian by default and English by URL without browser-language redirects', () => {
  expect(config.i18n).toEqual({ locales: ['ru', 'en'], defaultLocale: 'ru', localeDetection: false })
})
