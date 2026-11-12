import { fireEvent, render, screen } from '@testing-library/react'
import NavHeader from '../NavHeader'
import Footer from '../Footer'

jest.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('../LanguageSwitcher', () => function LanguageSwitcher() { return <button>RU / EN</button> })

describe('EcoCareer chrome', () => {
  it('links the approved identity home and preserves navigation without donations', () => {
    const { container } = render(<NavHeader />)
    expect(screen.getByRole('link', { name: 'Лаборатория ЭкоКарьеры' })).toHaveAttribute('href', '/')
    expect(container.querySelector('a[href="/donate"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'openMenu' }))
    expect(screen.getAllByRole('link', { name: 'vacancies' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'research' })).toHaveLength(2)
    expect(container.querySelector('a[href="/donate"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'closeMenu' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getAllByRole('link', { name: 'research' })[1])
    expect(screen.getByRole('button', { name: 'openMenu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps source attribution in the EcoCareer footer', () => {
    const { container } = render(<Footer />)
    expect(screen.getByRole('link', { name: 'Лаборатория ЭкоКарьеры' })).toHaveAttribute('href', '/')
    expect(screen.getByText(/OpenMentor · AGPL-3.0/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'github' })).toHaveAttribute('href', expect.stringContaining('github.com'))
    expect(container.querySelector('a[href="/donate"]')).toBeNull()
  })
})
