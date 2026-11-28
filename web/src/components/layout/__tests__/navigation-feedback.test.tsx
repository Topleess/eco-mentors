import { fireEvent, render, screen, within } from '@testing-library/react'
import NavHeader from '../NavHeader'
import Footer from '../Footer'
import { SOURCE_REPOSITORY_URL } from '@/config/source'

jest.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('../LanguageSwitcher', () => function LanguageSwitcher() { return <button>RU / EN</button> })

test('sticky header offers mentee FAQ and Telegram without a GitHub link, including mobile', () => {
  render(<NavHeader />)
  const header = screen.getByRole('banner')
  expect(header).toHaveClass('sticky', 'top-0')
  expect(within(header).getByRole('link', { name: 'menteeFaq' })).toHaveAttribute('href', '/faq#mentees')
  expect(within(header).getByRole('link', { name: 'telegram' })).toHaveAttribute('href', 'https://t.me/EcoCartaMsk')
  fireEvent.click(screen.getByRole('button', { name: 'openMenu' }))
  expect(within(header).getAllByRole('link', { name: 'menteeFaq' })).toHaveLength(2)
  expect(within(header).getAllByRole('link', { name: 'telegram' })).toHaveLength(2)
  expect(header.querySelector(`a[href="${SOURCE_REPOSITORY_URL}"]`)).toBeNull()
})

test('footer links to the Telegram channel with an accessible icon', () => {
  render(<Footer />)
  const link = screen.getByRole('link', { name: 'Telegram' })
  expect(link).toHaveAttribute('href', 'https://t.me/EcoCartaMsk')
  expect(link.querySelector('svg')).not.toBeNull()
})

test('footer retains the source repository link', () => {
  render(<Footer />)
  expect(screen.getByRole('link', { name: 'github' })).toHaveAttribute('href', SOURCE_REPOSITORY_URL)
})
