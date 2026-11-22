import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ClockIcon } from '@phosphor-icons/react';

import { t } from '@/i18n';
import { cn } from '@/lib/cn';

const pad = (value: number): string => String(value).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, index) => pad(index));
const MINUTES = Array.from({ length: 60 }, (_, index) => pad(index));
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Chữ đang gõ (chỉ giữ số) → HH:mm, tự chèn dấu
function maskTyping(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

interface TimePickerProps {
  id: string;
  label: string;
  // 'HH:mm' (24 giờ); '' = chưa chọn hoặc gõ chưa đủ / sai giờ
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

// Ô giờ HH:mm cùng kiểu DatePicker: gõ tay tự chèn ":" hoặc chọn giờ, phút trên bảng nổi hai cột
export default function TimePicker({ id, label, value, onChange, disabled = false, error }: TimePickerProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [hour = '', minute = ''] = TIME_RE.test(value) ? value.split(':') : [];

  // Chọn trên bảng thì ô chữ đổi theo
  useEffect(() => {
    if (value) setText(value);
  }, [value]);

  // Mở bảng thì cuộn giờ, phút đang chọn lên đầu cột
  useEffect(() => {
    if (!isOpen) return;
    hourListRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'start' });
    minuteListRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'start' });
  }, [isOpen]);

  // Bấm ra ngoài hoặc Esc thì đóng bảng
  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [isOpen]);

  function handleTyping(event: ChangeEvent<HTMLInputElement>): void {
    const masked = maskTyping(event.target.value);
    setText(masked);
    onChange(TIME_RE.test(masked) ? masked : '');
  }

  // Chọn giờ giữ phút đang có (chưa có thì 00); chọn phút giữ giờ đang có và đóng bảng
  const pickHour = (nextHour: string) => onChange(`${nextHour}:${minute || '00'}`);
  function pickMinute(nextMinute: string): void {
    onChange(`${hour || '00'}:${nextMinute}`);
    setIsOpen(false);
  }

  const optionClass = (isSelected: boolean) => cn(
    'h-8 w-full shrink-0 rounded-lg text-sm tabular-nums transition-colors',
    isSelected ? 'bg-charcoal font-semibold text-white' : 'text-charcoal hover:bg-warmGray/10',
  );

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="label-caption">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="hh:mm"
          value={text}
          disabled={disabled}
          onChange={handleTyping}
          aria-invalid={Boolean(error)}
          className={cn('input pr-11 tabular-nums', error && 'border-alertRed focus:border-alertRed')}
        />
        <button
          type="button"
          aria-label={t('Mở bảng chọn giờ')}
          aria-expanded={isOpen}
          disabled={disabled}
          onClick={() => setIsOpen(current => !current)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-charcoal hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:text-warmGray/40"
        >
          <ClockIcon size={18} />
        </button>
      </div>
      {error && <span className="text-xs text-alertRed">{error}</span>}

      {/* Bảng nổi dưới ô: cột giờ 00–23 và cột phút 00–59, cuộn riêng từng cột */}
      {isOpen && (
        <div className="glass-panel absolute left-0 top-full z-20 mt-2 flex w-full min-w-[9rem] max-w-[12rem] gap-1 rounded-2xl border border-warmGray/15 bg-white p-2 shadow-popover">
          <div ref={hourListRef} role="listbox" aria-label={t('Giờ')} className="flex max-h-56 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5">
            {HOURS.map(item => (
              <button key={item} type="button" role="option" aria-selected={item === hour} onClick={() => pickHour(item)} className={optionClass(item === hour)}>
                {item}
              </button>
            ))}
          </div>
          <div className="w-px shrink-0 bg-warmGray/15" />
          <div ref={minuteListRef} role="listbox" aria-label={t('Phút')} className="flex max-h-56 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5">
            {MINUTES.map(item => (
              <button key={item} type="button" role="option" aria-selected={item === minute} onClick={() => pickMinute(item)} className={optionClass(item === minute)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
