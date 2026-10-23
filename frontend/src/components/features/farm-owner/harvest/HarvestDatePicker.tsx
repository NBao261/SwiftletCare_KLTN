import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';

const DAYS_PER_WEEK = 7;
// 1 thứ Hai bất kỳ (01/01/2024) để lấy tên thứ theo ngôn ngữ, tuần bắt đầu từ thứ Hai
const MONDAY_REFERENCE = new Date(2024, 0, 1);

const pad = (value: number): string => String(value).padStart(2, '0');

// Khoá ngày yyyy-mm-dd (so sánh chuỗi được trực tiếp)
const dateKey = (year: number, month: number, day: number): string => `${year}-${pad(month + 1)}-${pad(day)}`;

// yyyy-mm-dd → dd/mm/yyyy để hiển thị
function toDisplay(value: string): string {
  const [year, month, day] = value.split('-');
  return value ? `${day}/${month}/${year}` : '';
}

// Chữ đang gõ (chỉ giữ số) → dd/mm/yyyy, tự chèn dấu /
function maskTyping(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// dd/mm/yyyy đủ 8 số và là ngày có thật → yyyy-mm-dd, ngược lại ''
function parseDisplay(text: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return '';
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  const isReal = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isReal ? dateKey(year, month - 1, day) : '';
}

interface HarvestDatePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  max: string;
  error?: string;
}

// Ô ngày dd/mm/yyyy (FE_Design 6.1) thay <input type="date"> vốn theo định dạng của trình duyệt: gõ tay tự chèn "/", hoặc mở lịch tháng chọn; ngày ngoài min–max bị mờ
export default function HarvestDatePicker({ id, label, value, onChange, min, max, error }: HarvestDatePickerProps): JSX.Element {
  const { t, lang } = useTranslation(harvestDict);
  const rootRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => toDisplay(value));
  const [isOpen, setIsOpen] = useState(false);
  const initialMonth = (value || max).split('-').map(Number);
  const [viewYear, setViewYear] = useState(initialMonth[0]);
  const [viewMonth, setViewMonth] = useState(initialMonth[1] - 1);

  // Chọn từ lịch thì ô chữ đổi theo
  useEffect(() => {
    if (value) setText(toDisplay(value));
  }, [value]);

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

  // Tên thứ và tiêu đề tháng theo ngôn ngữ đang chọn
  const locale = lang === 'vi' ? 'vi-VN' : 'en-GB';
  const weekdayNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: DAYS_PER_WEEK }, (_, index) =>
      formatter.format(new Date(MONDAY_REFERENCE.getFullYear(), MONDAY_REFERENCE.getMonth(), MONDAY_REFERENCE.getDate() + index)));
  }, [locale]);
  const monthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1));

  // Ô lịch: chỗ trống đầu tháng (tuần bắt đầu thứ Hai) + các ngày trong tháng
  const leadingBlanks = (new Date(viewYear, viewMonth, 1).getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const isPreviousDisabled = dateKey(viewYear, viewMonth, 1) <= min;
  const isNextDisabled = dateKey(viewYear, viewMonth, daysInMonth) >= max;
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  function shiftMonth(step: number): void {
    const next = new Date(viewYear, viewMonth + step, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function handleTyping(event: ChangeEvent<HTMLInputElement>): void {
    const masked = maskTyping(event.target.value);
    setText(masked);
    onChange(parseDisplay(masked));
  }

  function selectDay(day: number): void {
    onChange(dateKey(viewYear, viewMonth, day));
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="label-caption">
        {label}
        <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('date.placeholder')}
          value={text}
          onChange={handleTyping}
          aria-invalid={Boolean(error)}
          // Đã có ngày hợp lệ: viền xanh như các ô chọn đã chọn trong cùng form
          className={cn('input pr-11 tabular-nums', error ? 'border-alertRed focus:border-alertRed' : value && 'border-accent-600 focus:border-accent-600')}
        />
        <button
          type="button"
          aria-label={t('date.openCalendar')}
          aria-expanded={isOpen}
          onClick={() => setIsOpen(current => !current)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-charcoal hover:bg-warmGray/10"
        >
          <CalendarBlankIcon size={18} />
        </button>
      </div>
      {error && <span className="text-xs text-alertRed">{error}</span>}

      {/* Lịch tháng nổi dưới ô */}
      {isOpen && (
        <div className="glass-panel absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-warmGray/15 bg-white p-3 shadow-popover">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label={t('date.previousMonth')}
              disabled={isPreviousDisabled}
              onClick={() => shiftMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:text-warmGray/40 disabled:hover:bg-transparent"
            >
              <CaretLeftIcon size={14} weight="bold" />
            </button>
            <span className="text-sm font-semibold capitalize text-charcoal">{monthTitle}</span>
            <button
              type="button"
              aria-label={t('date.nextMonth')}
              disabled={isNextDisabled}
              onClick={() => shiftMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:text-warmGray/40 disabled:hover:bg-transparent"
            >
              <CaretRightIcon size={14} weight="bold" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayNames.map(name => <span key={name} className="py-1 text-[11px] font-medium text-warmGray">{name}</span>)}
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
                    'h-8 rounded-full text-xs tabular-nums transition-colors',
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
