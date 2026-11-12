import { render } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Migrate from '@/pages/migrate'

it.each(['ru', 'en'] as const)('does not expose migration actions in %s', (locale) => {
  global.fetch = jest.fn()
  const { container } = render(<I18nProvider locale={locale}><Migrate /></I18nProvider>)
  expect(container).toBeEmptyDOMElement()
  expect(global.fetch).not.toHaveBeenCalled()
})
