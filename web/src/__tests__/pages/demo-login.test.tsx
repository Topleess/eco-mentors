import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { NextRouter } from 'next/router'
import DemoLoginPage, { getServerSideProps } from '@/pages/demo-login'

const mockReplace = jest.fn()

jest.mock('next/router', () => ({
  useRouter: () => ({ replace: mockReplace }) as unknown as NextRouter,
}))

jest.mock('@/components', () => ({
  NoIndexHead: () => null,
}))

describe('demo login page', () => {
  const originalFetch = global.fetch
  const originalDemoFlag = process.env.DEMO_AUTH_ENABLED

  afterAll(() => {
    if (originalDemoFlag === undefined) {
      delete process.env.DEMO_AUTH_ENABLED
    } else {
      process.env.DEMO_AUTH_ENABLED = originalDemoFlag
    }
  })

  it('is not routable unless the demo auth flag is explicitly enabled', async () => {
    process.env.DEMO_AUTH_ENABLED = 'false'
    const disabled = await getServerSideProps({} as Parameters<typeof getServerSideProps>[0])
    expect(disabled).toEqual({ notFound: true })

    process.env.DEMO_AUTH_ENABLED = 'true'
    const enabled = await getServerSideProps({} as Parameters<typeof getServerSideProps>[0])
    expect(enabled).toEqual({ props: {} })
  })

  it('explains that the public demo is synthetic and read-only', () => {
    render(<DemoLoginPage />)
    expect(screen.getByText(/публичное демо/i)).toBeInTheDocument()
    expect(screen.getByText(/синтетические данные/i)).toBeInTheDocument()
    expect(screen.getByText(/изменения отключены/i)).toBeInTheDocument()
  })

  beforeEach(() => {
    mockReplace.mockReset()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it.each([
    ['demo-admin@openmentor.test', 'admin', '/admin/mentors/pending'],
    ['demo-mentor@openmentor.test', 'mentor', '/mentor'],
  ])('routes %s to the matching workspace', async (email, role, destination) => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, role, session: {} }),
    })
    render(<DemoLoginPage />)
    fireEvent.change(screen.getByLabelText(/почта/i), { target: { value: email } })
    fireEvent.click(screen.getByRole('button', { name: /войти/i }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(destination))
    expect(global.fetch).toHaveBeenCalledWith('/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  })

  it('shows a generic error when the demo email is not enabled', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Demo account is unavailable' }),
    })
    render(<DemoLoginPage />)
    fireEvent.change(screen.getByLabelText(/почта/i), {
      target: { value: 'unknown@example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: /войти/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Такой тестовый аккаунт не найден.')
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
