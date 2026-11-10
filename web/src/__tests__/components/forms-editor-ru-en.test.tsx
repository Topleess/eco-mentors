import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import Wysiwyg from '@/components/forms/Wysiwyg'

it('renders real rich-text editor controls in Russian without changing document content', async () => {
  const onUpdate = jest.fn()
  render(<I18nProvider locale="ru"><Wysiwyg content="<p>Original content</p>" onUpdate={onUpdate} /></I18nProvider>)
  expect(await screen.findByTitle('Полужирный')).toBeInTheDocument()
  expect(screen.getByTitle('Маркированный список')).toBeInTheDocument()
  expect(screen.getByText('Original content')).toBeInTheDocument()
  expect(onUpdate).not.toHaveBeenCalled()
})
