import { I18nProvider } from '@/i18n'
import { render, screen, fireEvent } from '@testing-library/react'
import RegisterMentorForm from '@/components/forms/RegisterMentorForm'

// Mock Turnstile component (forwardRef so the widget's reset() is callable)
const mockTurnstileReset = jest.fn()
jest.mock('@marsidev/react-turnstile', () => {
  const react = jest.requireActual('react')
  return {
    __esModule: true,
    Turnstile: react.forwardRef(function MockTurnstile(
      { onSuccess }: { onSuccess?: (token: string) => void },
      ref: React.Ref<{ reset: () => void }>
    ) {
      react.useImperativeHandle(ref, () => ({ reset: mockTurnstileReset }))
      return (
        <button
          type="button"
          data-testid="turnstile"
          onClick={() => onSuccess?.('mock-turnstile-token')}
        >
          Complete Turnstile
        </button>
      )
    }),
  }
})

// Mock react-select to avoid issues with portal rendering
jest.mock('react-select', () => ({
  __esModule: true,
  default: function MockSelect({
    options,
    onChange,
    value,
  }: {
    options: Array<{ value: string; label: string }>
    onChange: (selected: Array<{ value: string; label: string }>) => void
    value: Array<{ value: string; label: string }>
  }) {
    return (
      <div data-testid="tags-select">
        {options.map((option) => (
          <button
            key={option.value}
            data-value={option.value}
            type="button"
            onClick={() => {
              const isSelected = value.some((v) => v.value === option.value)
              if (isSelected) {
                onChange(value.filter((v) => v.value !== option.value))
              } else if (value.length < 5) {
                onChange([...value, option])
              }
            }}
          >
            {option.label} {value.some((v) => v.value === option.value) && '✓'}
          </button>
        ))}
      </div>
    )
  },
}))

// Mock Wysiwyg editor
jest.mock('@/components/forms/Wysiwyg', () => ({
  __esModule: true,
  default: function MockWysiwyg({
    content,
    onUpdate,
  }: {
    content: string
    onUpdate: (editor: { getHTML: () => string }) => void
  }) {
    return (
      <textarea
        value={content}
        onChange={(e) => onUpdate({ getHTML: () => e.target.value })}
        data-testid="wysiwyg"
      />
    )
  },
}))

it('Russian registration exposes translated sections and validation', async () => {
  render(<I18nProvider locale="ru"><RegisterMentorForm isLoading={false} isError={false} onSubmit={jest.fn()} /></I18nProvider>)
  expect(screen.getByRole('navigation', { name: 'Разделы формы' })).toHaveTextContent('Контактные данные')
  fireEvent.change(screen.getByLabelText(/Ссылка на ваш профиль/), { target: { value: 'a' } })
  fireEvent.click(screen.getByTestId('turnstile'))
  fireEvent.click(screen.getByRole('button', { name: 'Создать профиль' }))
  expect((await screen.findAllByText('Это поле обязательно.')).length).toBeGreaterThan(0)
  expect(screen.getByText('Используйте 3–40 латинских букв, цифр и дефисов (например, anna-smith).')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Бэкенд' })).toHaveAttribute('data-value', 'Backend')
})
