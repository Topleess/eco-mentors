import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GetServerSidePropsContext } from 'next'
import DevPage, { getServerSideProps } from '@/pages/dev'
const mockReplace = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ replace: mockReplace }) }))
jest.mock('@/components', () => ({ NoIndexHead: () => null }))
const originalEnv = process.env
const originalFetch = global.fetch
beforeEach(() => { process.env = { ...originalEnv, NODE_ENV: 'development', APP_ENV: 'development' }; mockReplace.mockReset(); global.fetch = jest.fn() })
afterEach(() => { process.env = originalEnv; global.fetch = originalFetch })

it.each(['localhost:3000', '127.0.0.1', '[::1]'])('serves local development on %s', async (host) => {
  const res = { setHeader: jest.fn() }
  expect(await getServerSideProps({ req: { headers: { host } }, res } as unknown as GetServerSidePropsContext)).toEqual({ props: {} })
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
})
it.each([
  ['production', 'development', 'localhost'], ['development', 'demo', 'localhost'],
  ['test', 'development', 'localhost'], ['development', 'development', 'example.test'],
])('hides the page for %s / %s / %s', async (nodeEnv, appEnv, host) => {
  process.env = { ...originalEnv, NODE_ENV: nodeEnv as NodeJS.ProcessEnv['NODE_ENV'], APP_ENV: appEnv }
  expect(await getServerSideProps({ req: { headers: { host } }, res: { setHeader: jest.fn() } } as unknown as GetServerSidePropsContext)).toEqual({ notFound: true })
})
it.each([
  ['mentor', 'Войти как ментор', '/mentor'],
  ['admin', 'Войти как администратор', '/admin/mentors/pending'],
])('enters %s in one click', async (role, label, destination) => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true, role }) })
  render(<DevPage />)
  expect(screen.getByText(/Сохранение изменений включено/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: label }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(destination))
  expect(global.fetch).toHaveBeenCalledWith('/api/dev/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
})
it('shows failures without navigating', async () => {
  ;(global.fetch as jest.Mock).mockRejectedValue(new Error('network'))
  render(<DevPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Войти как ментор' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(mockReplace).not.toHaveBeenCalled()
})
