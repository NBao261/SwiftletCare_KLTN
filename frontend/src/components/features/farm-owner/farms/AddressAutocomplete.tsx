import { useId, useState, type KeyboardEvent } from 'react';
import { MapPinIcon } from '@phosphor-icons/react';

import type { AddressSuggestion } from '@/apis/farm-owner/geocoding.api';
import { Input } from '@/components/ui';
import { farmDict } from '@/constants/farmStructure.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useAddressSuggestions } from '@/hooks/farm-owner/useAddressSuggestions';
import { cn } from '@/lib/cn';
import type { Coordinates } from '@/types';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  // Chọn một gợi ý: điền địa chỉ và đặt ghim trên bản đồ
  onPick: (coordinates: Coordinates) => void;
}

// ô địa chỉ có gợi ý (Photon, OpenStreetMap); danh sách nằm ngay dưới ô, không nổi, nên modal không cắt mất
export default function AddressAutocomplete({ value, onChange, onPick }: AddressAutocompleteProps): JSX.Element {
  const { t, lang } = useTranslation(farmDict);
  const listId = useId();
  // Chỉ hỏi Photon sau khi người dùng gõ: mở form sửa không gửi địa chỉ đã lưu, chọn gợi ý xong thì thôi hỏi
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { suggestions, isActive, isSettled, isError } = useAddressSuggestions(value, lang, isTyping);

  const showList = isOpen && isActive;
  // Danh sách chỉ chọn được khi là kết quả của đúng chữ đang trong ô
  const options = showList && isSettled && !isError ? suggestions : [];

  function pick(suggestion: AddressSuggestion): void {
    setIsTyping(false);
    setIsOpen(false);
    setActiveIndex(-1);
    onChange(suggestion.label);
    onPick(suggestion.coordinates);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    // Esc đóng danh sách, không để Modal đóng cả form
    if (event.key === 'Escape' && showList) {
      event.stopPropagation();
      setIsOpen(false);
      return;
    }
    if (options.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(index => (index + step + options.length) % options.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      pick(options[activeIndex]);
    }
  }

  let message: string | null = null;
  if (showList && !isSettled) message = t('farmForm.suggestLoading');
  else if (showList && isError) message = t('farmForm.searchFailed');
  else if (showList && suggestions.length === 0) message = t('farmForm.addressNotFound');

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        name="farmAddress"
        label={t('farmForm.address')}
        required
        value={value}
        onChange={event => {
          onChange(event.target.value);
          setIsTyping(true);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setIsOpen(false)}
        placeholder={t('farmForm.addressPlaceholder')}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      />
      {showList && (
        <div className="rounded-xl border border-warmGray/20 bg-white p-1 shadow-sm">
          {message && <p className="px-3 py-2 text-xs text-warmGray">{message}</p>}
          {options.length > 0 && (
            <ul id={listId} role="listbox" className="flex flex-col">
              {options.map((suggestion, index) => (
                <li
                  key={`${suggestion.label}-${index}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  // mousedown thay vì click: chọn trước khi ô mất focus (onBlur đóng danh sách)
                  onMouseDown={event => {
                    event.preventDefault();
                    pick(suggestion);
                  }}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm text-charcoal hover:bg-warmGray/10',
                    index === activeIndex && 'bg-warmGray/10',
                  )}
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
  );
}
