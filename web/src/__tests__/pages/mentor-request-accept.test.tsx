import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import RequestDetailsPage from '@/pages/mentor/requests/[id]'
import { acceptRequest, getRequestById } from '@/lib/mentor-admin-api'

jest.mock('next/router', () => ({ useRouter: () => ({ query: { id: 'r1' }, replace: jest.fn() }) }))
jest.mock('@/lib/mentor-admin-api', () => ({ getRequestById: jest.fn(), acceptRequest: jest.fn() }))
jest.mock('@/components', () => ({ NoIndexHead: () => null, AuthGateScreen: () => null }))
jest.mock('@/components/mentor-admin', () => ({
 MentorAuthProvider: ({ children }: { children: React.ReactNode }) => children,
 useMentorAuth: () => ({ isAuthenticated: true, isLoading: false }),
 MentorAdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
 StatusBadge: () => null, MetaItem: () => null, DeclineModal: () => null,
 formatDateTime: () => '', formatRelativeTime: () => '', nameInitials: () => 'M',
}))

it('requires the mentor contact, explicitly accepts, and keeps the status action', async () => {
 const request = { id: 'r1', name: 'Mentee', email: 'mentee@example.com', status: 'pending', createdAt: '2026-01-01', details: 'Help', level: '', contact: '', acceptedAt: null }
 jest.mocked(getRequestById).mockResolvedValue(request as never)
 jest.mocked(acceptRequest).mockResolvedValue({ ...request, acceptedAt: '2026-01-02' } as never)
 render(<I18nProvider locale="en"><RequestDetailsPage /></I18nProvider>)
 const button = await screen.findByRole('button', { name: 'Accept request and share contact' })
 expect(button).toBeDisabled()
 fireEvent.change(screen.getByLabelText('Your contact for the mentee'), { target: { value: ' mentor@example.com ' } })
 fireEvent.click(button)
 await waitFor(() => expect(acceptRequest).toHaveBeenCalledWith('r1', 'mentor@example.com'))
 expect(await screen.findByText('Request accepted')).toBeInTheDocument()
 expect(screen.queryByRole('button', { name: 'Accept request and share contact' })).not.toBeInTheDocument()
 expect(screen.getByRole('button', { name: /contacted/i })).toBeInTheDocument()
})
