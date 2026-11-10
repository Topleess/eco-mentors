import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import DeleteProfileDialog from '@/components/ui/DeleteProfileDialog'

it('localizes destructive confirmation but keeps username matching unchanged', () => {
  render(<I18nProvider locale="ru"><DeleteProfileDialog isOpen onClose={jest.fn()} onConfirm={jest.fn()} username="alex" title="Удалить профиль">Профиль исчезнет из каталога.</DeleteProfileDialog></I18nProvider>)
  expect(screen.getByText('Это действие нельзя отменить')).toBeInTheDocument()
  const confirm = screen.getByRole('button', { name: 'Удалить профиль навсегда' })
  expect(confirm).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ' ALEX ' } })
  expect(confirm).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument()
})
