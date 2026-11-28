import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VacancyApplicationForm } from '@/features/vacancies/VacancyApplicationForm'
jest.mock('@/components/forms/Captcha', () => ({ __esModule: true, default: ({ onSuccess }: { onSuccess: (token: string) => void }) => <button type="button" onClick={() => onSuccess('token')}>captcha</button> }))
it('requires consent and submits a captcha-protected application', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ industries: [{ id: 'i', name: 'Industry' }], cities: [{ id: 'c', name: 'City' }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
  render(<VacancyApplicationForm />)
  await screen.findByText('Industry')
  fireEvent.change(screen.getByLabelText('Название вакансии'), { target: { value: 'Engineer' } })
  fireEvent.change(screen.getByLabelText('Компания'), { target: { value: 'Company' } })
  fireEvent.change(screen.getByLabelText('Отрасль'), { target: { value: 'i' } })
  fireEvent.change(screen.getByLabelText('Город'), { target: { value: 'c' } })
  fireEvent.change(screen.getByLabelText('Контакт для связи'), { target: { value: 'private@example.org' } })
  fireEvent.click(screen.getByText('captcha'))
  expect(screen.getByRole('button', { name: 'Отправить заявку' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Заявка отправлена'))
  expect(global.fetch).toHaveBeenLastCalledWith('/api/vacancies/applications', expect.objectContaining({ method: 'POST', body: expect.stringContaining('"consent":true') }))
})
