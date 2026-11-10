import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import ProfileVisibilityCard from '@/components/mentor-admin/ProfileVisibilityCard'
import StatusBadge from '@/components/mentor-admin/StatusBadge'
import SortToggle from '@/components/mentor-admin/SortToggle'
import SearchInput from '@/components/mentor-admin/SearchInput'
import DeclineModal from '@/components/mentor-admin/DeclineModal'
import { formatRelativeTime, formatCompactTime, formatDate, statusLabel, mentorMessage } from '@/components/mentor-admin/utils'
import type { RequestStatus } from '@/types'

jest.mock('@/lib/posthog', () => ({ captureException: jest.fn() }))

afterEach(() => jest.useRealTimers())

describe('mentor private dashboard locale', () => {
  it('preserves unknown raw statuses even when they match another message key', () => {
    expect(statusLabel('visible' as RequestStatus, 'ru')).toBe('visible')
  })

  it('translates known API errors only at display time and retains English details', () => {
    expect(mentorMessage('ru', 'Invalid or expired token')).toBe('Токен недействителен или срок его действия истёк')
    expect(mentorMessage('en', 'Server-specific detail')).toBe('Server-specific detail')
    expect(mentorMessage('ru', 'Server-specific detail')).toBe('Что-то пошло не так. Попробуйте ещё раз.')
  })
  it('localizes request controls, status display and decline reasons under the Russian provider', () => {
    render(<I18nProvider locale="ru"><StatusBadge status="pending" /><SortToggle value="newest" onChange={jest.fn()} /><SearchInput value="test" onChange={jest.fn()} /><DeclineModal isOpen onClose={jest.fn()} onConfirm={jest.fn()} menteName="Ada" /></I18nProvider>)
    expect(screen.getByText('Новая')).toBeInTheDocument()
    expect(screen.getByText('Сначала новые')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Очистить поиск' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('Отклонить заявку')
    expect(screen.getByRole('option', { name: 'Выберите причину' })).toHaveValue('')
  })

  it('formats Russian relative and absolute dates while retaining the English default', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-10T12:00:00Z'))
    expect(formatRelativeTime('2026-07-10T11:55:00Z', 'ru')).toBe('5 минут назад')
    expect(formatCompactTime('2026-07-10T10:00:00Z', 'ru')).toBe('2 Ч НАЗАД')
    expect(formatDate('2026-07-01T12:00:00Z', 'ru')).toContain('июл.')
    expect(formatRelativeTime('2026-07-10T11:55:00Z')).toBe('5 minutes ago')
    jest.useRealTimers()
  })
  it('renders Russian visibility controls without changing the API status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    render(<I18nProvider locale="ru"><ProfileVisibilityCard initialStatus="active" /></I18nProvider>)
    expect(screen.getByText('Ваш профиль виден')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch'))
    expect(await screen.findByText('Ваш профиль скрыт')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeDisabled())
    expect(global.fetch).toHaveBeenCalledWith('/api/mentor/profile/status', expect.objectContaining({ body: JSON.stringify({ status: 'inactive' }) }))
  })
})
