import { adminMessage } from '@/i18n/admin'
import { moderationStatusLabel } from '@/components/admin-moderation/utils'

it('translates known service errors without losing unknown diagnostics', () => {
  expect(adminMessage('ru', 'Could not connect to the server. Please check your connection.')).toBe('Не удалось связаться с сервером. Проверьте подключение.')
  expect(adminMessage('ru', 'Invalid or expired token')).toBe('Ссылка недействительна или устарела')
  expect(adminMessage('ru', 'Login failed')).toBe('Не удалось войти')
  expect(adminMessage('ru', 'Something went wrong')).toBe('Что-то пошло не так')
  expect(adminMessage('ru', 'Unknown upstream diagnostic')).toBe('Unknown upstream diagnostic')
})
it('preserves unknown lifecycle values while localizing canonical ones', () => {
  expect(moderationStatusLabel('pending', 'ru')).toBe('На модерации')
  expect(moderationStatusLabel('active', 'en')).toBe('active')
  expect(moderationStatusLabel('future-status', 'ru')).toBe('future-status')
  expect(moderationStatusLabel('constructor', 'ru')).toBe('constructor')
})
