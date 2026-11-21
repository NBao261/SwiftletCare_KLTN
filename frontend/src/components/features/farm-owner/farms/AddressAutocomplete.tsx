import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { MapPinIcon } from '@phosphor-icons/react'
import { Input } from '@/components/ui'
import { geocodingApi, type AddressSuggestion } from '@/apis/shared/geocoding.api'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { cn } from '@/lib/cn'
import type { Coordinates } from '@/types'

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string) => void
  // Chọn một gợi ý: điền địa chỉ và đặt ghim trên bản đồ
  onPick: (coordinates: Coordinates) => void
}

// Gõ xong 400 ms mới hỏi, từ 3 ký tự: không gọi Photon theo từng phím
const DEBOUNCE_MS = 400
const MIN_QUERY_LENGTH = 3

type Status = 'idle' | 'loading' | 'done' | 'failed'

// FARM-FR-001 — ô địa chỉ có gợi ý (Photon, OpenStreetMap); danh sách nằm ngay dưới ô, không nổi, nên modal không cắt mất
export default function AddressAutocomplete({ value, onChange, onPick }: AddressAutocompleteProps): JSX.Element {
  const { t, lang } = useTranslation(farmDict)
  const listId = useId()
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  // Địa chỉ vừa điền từ gợi ý: không hỏi lại cho chính câu đó
  const pickedRef = useRef<string | null>(null)

  useEffect(() => {
    const query = value.trim()
    if (query.length < MIN_QUERY_LENGTH || query === pickedRef.current) {
      setSuggestions([])
      setStatus('idle')
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setStatus('loading')
      geocodingApi.suggest(query, lang, controller.signal)
        .then(found => {
          setSuggestions(found)
          setActiveIndex(-1)
          setStatus('done')
        })
        .catch(() => { if (!controller.signal.aborted) setStatus('failed') })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, lang])

  function pick(suggestion: AddressSuggestion): void {
    pickedRef.current = suggestion.label
    onChange(suggestion.label)
    onPick(suggestion.coordinates)
    setIsOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!isOpen || suggestions.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex(index => (index + step + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      pick(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      event.stopPropagation()
      setIsOpen(false)
    }
  }

  const showList = isOpen && status !== 'idle'

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        name="farmAddress"
        label={t('farmForm.address')}
        required
        value={value}
        onChange={event => {
          onChange(event.target.value)
          setIsOpen(true)
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setIsOpen(false)}
        placeholder={t('farmForm.addressPlaceholder')}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList && suggestions.length > 0}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      />
      {showList && (
        <div className="rounded-xl border border-warmGray/20 bg-white p-1 shadow-sm">
          {status === 'loading' && <p className="px-3 py-2 text-xs text-warmGray">{t('farmForm.suggestLoading')}</p>}
          {status === 'failed' && <p className="px-3 py-2 text-xs text-warmGray">{t('farmForm.searchFailed')}</p>}
          {status === 'done' && suggestions.length === 0 && <p className="px-3 py-2 text-xs text-warmGray">{t('farmForm.addressNotFound')}</p>}
          {status === 'done' && suggestions.length > 0 && (
            <ul id={listId} role="listbox" className="flex flex-col">
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.label}-${index}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  // mousedown thay vì click: chọn trước khi ô mất focus (onBlur đóng danh sách)
                  onMouseDown={event => {
                    event.preventDefault()
                    pick(suggestion)
                  }}
                  className={cn('flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm text-charcoal hover:bg-warmGray/10', index === activeIndex && 'bg-warmGray/10')}
                >
                  <MapPinIcon size={14} className="mt-0.5 shrink-0 text-warmGray" />
                  <span>{suggestion.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
