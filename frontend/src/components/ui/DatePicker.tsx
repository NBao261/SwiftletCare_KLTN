import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

import { intlLocale, t } from '@/i18n';
import { cn } from '@/lib/cn';
import FieldError from '@/components/ui/FieldError';

const DAYS_PER_WEEK = 7;
// 1 thứ Hai bất kỳ (01/01/2024) để lấy tên thứ theo ngôn ngữ, tuần bắt đầu từ thứ Hai
const MONDAY_REFERENCE = new Date(2024, 0, 1);

const pad = (value: number): string => String(value).padStart(2, '0');

// Khoá ngày yyyy-mm-dd (so sánh chuỗi được trực tiếp)
const dateKey = (year: number, month: number, day: number): string => `${year}-${pad(month + 1)}-${pad(day)}`;

// yyyy-mm-dd → dd/mm/yyyy để hiển thị (dd/mm khi ẩn năm)
function toDisplay(value: string, hideYear: boolean): string {
  const [year, month, day] = value.split('-');
  if (!value) return '';
  return hideYear ? `${day}/${month}` : `${day}/${month}/${year}`;
}

// Chữ đang gõ (chỉ giữ số) → dd/mm/yyyy (dd/mm khi ẩn năm), tự chèn dấu
function maskTyping(text: string, hideYear: boolean): string {
  const digits = text.replace(/\D/g, '').slice(0, hideYear ? 4 : 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// dd/mm/yyyy (dd/mm kèm năm cố định khi ẩn năm) đủ số và là ngày có thật → yyyy-mm-dd, ngược lại ''
function parseDisplay(text: string, fixedYear: number | null): string {
  const match = fixedYear === null ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text) : /^(\d{2})\/(\d{2})$/.exec(text);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = fixedYear ?? Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isReal = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isReal ? dateKey(year, month - 1, day) : '';
}

interface DatePickerProps {
  id: string;
  label: string;
  // yyyy-mm-dd; '' = chưa chọn hoặc gõ chưa đủ / sai ngày
  value: string;
  onChange: (value: string) => void;
  // yyyy-mm-dd; bỏ trống min = không giới hạn ngày đầu
  min?: string;
  max: string;
  error?: string;
  // Dấu * đỏ sau nhãn như các ô bắt buộc khác của form
  required?: boolean;
  // Ngày lặp hằng năm: không hiện năm, năm lấy theo max
  hideYear?: boolean;
}

// Ô ngày dd/mm/yyyy (FE_Design 6.1): gõ tay tự chèn "/" hoặc chọn trên lịch tháng; ngày ngoài min–max bị mờ
export default function DatePicker({ id, label, value, onChange, min = '', max, error, required = false, hideYear = false }: DatePickerProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const fixedYear = hideYear ? Number(max.slice(0, 4)) : null;
  const [text, setText] = useState(() => toDisplay(value, hideYear));
  const [isOpen, setIsOpen] = useState(false);
  // Ô trống thì mở ở tháng hôm nay, kẹp trong min–max (max rất xa như '9999-12-31' không làm lịch mở ở năm đó)
  const now = new Date();
  const nowKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const emptyStart = min && nowKey < min ? min : nowKey > max ? max : nowKey;
  const initialMonth = (value || emptyStart).split('-').map(Number);
  const [viewYear, setViewYear] = useState(initialMonth[0]);
  const [viewMonth, setViewMonth] = useState(initialMonth[1] - 1);

  // Chọn từ lịch thì ô chữ đổi theo
  useEffect(() => {
    if (value) setText(toDisplay(value, hideYear));
  }, [value, hideYear]);

  // Bấm ra ngoài hoặc Esc thì đóng lịch
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

  // VI dạng hẹp "T2 … CN", EN "Mon" vì "M/T" bị trùng
  const locale = intlLocale();
  const weekdayNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: locale.startsWith('vi') ? 'narrow' : 'short' });
    return Array.from({ length: DAYS_PER_WEEK }, (_, index) =>
      formatter.format(new Date(MONDAY_REFERENCE.getFullYear(), MONDAY_REFERENCE.getMonth(), MONDAY_REFERENCE.getDate() + index)));
  }, [locale]);
  const monthTitle = new Intl.DateTimeFormat(locale, hideYear ? { month: 'long' } : { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1));

  // Ô lịch: chỗ trống đầu tháng (tuần bắt đầu thứ Hai) + các ngày trong tháng
  const leadingBlanks = (new Date(viewYear, viewMonth, 1).getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const isPreviousDisabled = min !== '' && dateKey(viewYear, viewMonth, 1) <= min;
  const isNextDisabled = dateKey(viewYear, viewMonth, daysInMonth) >= max;
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  function shiftMonth(step: number): void {
    const next = new Date(viewYear, viewMonth + step, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function handleTyping(event: ChangeEvent<HTMLInputElement>): void {
    const masked = maskTyping(event.target.value, hideYear);
    setText(masked);
    onChange(parseDisplay(masked, fixedYear));
  }

  function selectDay(day: number): void {
    onChange(dateKey(viewYear, viewMonth, day));
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="label-caption">
        {label}
        {required && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={hideYear ? 'dd/mm' : 'dd/mm/yyyy'}
          value={text}
          onChange={handleTyping}
          aria-invalid={Boolean(error)}
          aria-describedby={error && id ? `${id}-error` : undefined}
          // Đã có ngày hợp lệ: viền xanh như các ô chọn đã chọn trong cùng form
          className={cn('input pr-11 tabular-nums', error ? 'border-alertRed focus:border-alertRed' : value && 'border-accent-600 focus:border-accent-600')}
        />
        <button
          type="button"
          aria-label={t('Mở lịch chọn ngày')}
          aria-expanded={isOpen}
          onClick={() => setIsOpen(current => !current)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-charcoal hover:bg-warmGray/10"
        >
          <CalendarBlankIcon size={18} />
        </button>
      </div>
      {error && <FieldError id={id ? `${id}-error` : undefined}>{error}</FieldError>}

      {/* Lịch nổi dưới ô, rộng bằng ô (tối đa 20rem); nút ngày co theo cột nên ô hẹp không đè nhau */}
      {isOpen && (
        <div className="glass-panel absolute left-0 top-full z-20 mt-2 w-full max-w-xs rounded-2xl border border-warmGray/15 bg-white p-3 shadow-popover">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label={t('Tháng trước')}
              disabled={isPreviousDisabled}
              onClick={() => shiftMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:text-warmGray/40 disabled:hover:bg-transparent"
            >
              <CaretLeftIcon size={14} weight="bold" />
            </button>
            <span className="text-sm font-semibold capitalize text-charcoal">{monthTitle}</span>
            <button
              type="button"
              aria-label={t('Tháng sau')}
              disabled={isNextDisabled}
              onClick={() => shiftMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:text-warmGray/40 disabled:hover:bg-transparent"
            >
              <CaretRightIcon size={14} weight="bold" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayNames.map(name => <span key={name} className="py-1 text-small font-medium text-warmGray">{name}</span>)}
            {Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const key = dateKey(viewYear, viewMonth, day);
              const isDisabled = key < min || key > max;
              const isSelected = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'mx-auto aspect-square w-full max-w-[2rem] rounded-full text-xs tabular-nums transition-colors',
                    isSelected ? 'bg-charcoal font-semibold text-white' : 'text-charcoal hover:bg-warmGray/10',
                    key === todayKey && !isSelected && 'ring-1 ring-charcoal/30',
                    isDisabled && 'cursor-not-allowed text-warmGray/40 hover:bg-transparent',
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
