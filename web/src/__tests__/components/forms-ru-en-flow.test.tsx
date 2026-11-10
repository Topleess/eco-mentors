import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import PriceField from '@/components/forms/PriceField'
import ContactMentorForm from '@/components/forms/ContactMentorForm'

jest.mock('@marsidev/react-turnstile', () => ({ Turnstile: () => null }))

it('renders Russian contact labels and validation while keeping experience values canonical', async () => {
  render(<I18nProvider locale="ru"><ContactMentorForm isLoading={false} isError={false} onSubmit={jest.fn()} /></I18nProvider>)
  expect(screen.getByLabelText(/Ваше полное имя/)).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Руководитель руководителей' })).toHaveValue('Manager of managers')
  fireEvent.click(screen.getByRole('button', { name: 'Отправить запрос' }))
  expect((await screen.findAllByText('Это поле обязательно.')).length).toBeGreaterThan(0)
})

it('translates known submission errors without replacing unknown upstream details', () => {
  const { rerender } = render(<I18nProvider locale="ru"><ContactMentorForm isLoading={false} isError onSubmit={jest.fn()} /></I18nProvider>)
  expect(screen.getByRole('alert')).toHaveTextContent('Что-то пошло не так — попробуйте ещё раз через минуту.')
  rerender(<I18nProvider locale="ru"><ContactMentorForm isLoading={false} isError errorMessage="Captcha verification failed." onSubmit={jest.fn()} /></I18nProvider>)
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось пройти проверку. Попробуйте ещё раз.')
  rerender(<I18nProvider locale="ru"><ContactMentorForm isLoading={false} isError errorMessage="Custom actionable upstream detail." onSubmit={jest.fn()} /></I18nProvider>)
  expect(screen.getByRole('alert')).toHaveTextContent('Custom actionable upstream detail.')
})

it('renders Russian price choices without changing canonical values or dollars', () => {
  const onChange = jest.fn()
  const { rerender } = render(<I18nProvider locale="ru"><PriceField label="Цена" value={null} onChange={onChange} /></I18nProvider>)
  fireEvent.click(screen.getByRole('radio', { name: 'Бесплатно' }))
  expect(onChange).toHaveBeenLastCalledWith({ kind: 'free', amount: null })
  fireEvent.click(screen.getByRole('radio', { name: 'По договорённости' }))
  expect(onChange).toHaveBeenLastCalledWith({ kind: 'negotiable', amount: null })
  rerender(<I18nProvider locale="ru"><PriceField label="Цена" value={{ kind: 'fixed', amount: 50 }} onChange={onChange} /></I18nProvider>)
  expect(screen.getByRole('radio', { name: 'Фиксированная сумма, $50' })).toBeChecked()
  expect(screen.getByRole('textbox', { name: 'Цена в долларах США за часовую сессию' })).toHaveValue('50')
})
