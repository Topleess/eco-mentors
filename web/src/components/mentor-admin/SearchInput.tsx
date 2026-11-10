import { useTranslation } from '@/i18n'
import { messages } from '@/i18n/messages/mentor'
/**
 * Search Input component
 *
 * Client-side search for requests list (on-system .field styling).
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchInput({
  value,
  onChange,
  placeholder,
}: SearchInputProps): JSX.Element {
  const { t } = useTranslation(messages)
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <FontAwesomeIcon icon={faSearch} className="text-sm text-ink-soft" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('searchDefault')}
        className="field pl-10 pr-10"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-ink-soft transition-colors duration-120 hover:text-ink"
          aria-label={t('clearSearch')}
        >
          <FontAwesomeIcon icon={faTimes} className="text-sm" />
        </button>
      )}
    </div>
  )
}
