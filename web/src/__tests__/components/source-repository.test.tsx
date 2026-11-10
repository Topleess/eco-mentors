import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import Footer from '@/components/layout/Footer'
import { I18nProvider } from '@/i18n'

it.each(['ru', 'en'])('links the visible source offer to eco-mentors in %s', (locale) => {
  render(
    <I18nProvider locale={locale}>
      <Footer />
    </I18nProvider>,
  )
  const source = screen.getByRole('link', {
    name: locale === 'ru' ? 'Исходный код на GitHub' : 'Source code on GitHub',
  })
  expect(source).toHaveAttribute('href', 'https://github.com/Topleess/eco-mentors')
  expect(source).toHaveTextContent(locale === 'ru' ? 'Исходный код' : 'Source code')
  expect(source).toHaveAttribute('rel', 'noopener noreferrer')
})
it('uses a shared source URL in header, about page and structured site metadata', () => {
  for (const filename of [
    'src/components/layout/NavHeader.tsx',
    'src/pages/about.tsx',
    'src/pages/_app.tsx',
  ]) {
    const text = readFileSync(path.join(process.cwd(), filename), 'utf8')
    expect(text).toContain('SOURCE_REPOSITORY_URL')
    expect(text).not.toContain('https://github.com/openmentor-io/openmentor')
  }
})
