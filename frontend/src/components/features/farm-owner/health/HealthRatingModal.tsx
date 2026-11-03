import { useState, type ReactNode } from 'react';

import { Button, ConfirmModal, Modal, Textarea } from '@/components/ui';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useRateHealthDay, useSkipHealthDay } from '@/hooks/shared/useHealthDays';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toastStore';
import type { HealthRatingValue, HouseHealthDay } from '@/types';

const RATINGS: HealthRatingValue[] = ['GOOD', 'WATCH', 'ACTION'];
// Viền khi chọn, cùng màu với badge trạng thái
const SELECTED_CLASS: Record<HealthRatingValue, string> = {
  GOOD: 'border-success bg-success/10',
  WATCH: 'border-climateOrange bg-climateOrange/10',
  ACTION: 'border-alertRed bg-alertRed/10',
};
const NOTE_MAX_LENGTH = 1000;

// Câu dịch có đoạn **…** → đoạn đó in đậm chữ đen, phần còn lại giữ màu của khối chứa
export function withBold(text: string): ReactNode[] {
  return text.split('**').map((part, index) =>
    index % 2 === 1 ? <strong key={index} className="font-semibold text-charcoal">{part}</strong> : part);
}

interface HealthRatingModalProps {
  // Ngày còn PENDING; null = đóng
  day: HouseHealthDay | null;
  onClose: () => void;
  // Backend trả ngày đầy đủ sau khi chấm hoặc bỏ qua — màn mở chi tiết ngày đó
  onRevealed: (day: HouseHealthDay) => void;
}

// EXPERT-FR-012, BR-31 — hỏi đánh giá của người dùng trước, chỉ hiện trạng thái hệ thống sau khi lưu hoặc bỏ qua
export default function HealthRatingModal({ day, onClose, onRevealed }: HealthRatingModalProps): JSX.Element | null {
  const { t, date } = useTranslation(healthDict);
  const rate = useRateHealthDay();
  const skip = useSkipHealthDay();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [rating, setRating] = useState<HealthRatingValue | null>(null);
  const [note, setNote] = useState('');
  const [isPickError, setIsPickError] = useState(false);
  const [isSkipOpen, setIsSkipOpen] = useState(false);
  // Nháp (rating + note) thuộc ngày nào: thoát bằng ✕/Esc/nhấn ra ngoài giữ nháp, mở lại đúng ngày đó thấy lại;
  // mở ngày khác thì bắt đầu trống. Chỉ giữ 1 nháp, mất khi rời trang.
  const [draftDayId, setDraftDayId] = useState<string | null>(null);

  if (!day) return null;
  const dayId = day._id;
  if (dayId !== draftDayId) {
    // Đổi state ngay khi render (mẫu "reset state theo prop" của React) để không nháy nháp ngày cũ
    setDraftDayId(dayId);
    setRating(null);
    setNote('');
    setIsPickError(false);
  }

  // Thoát giữa chừng: giữ nháp
  function close(): void {
    setIsSkipOpen(false);
    onClose();
  }

  // Lưu/bỏ qua xong: ngày đã chốt, xoá nháp
  function clearDraft(): void {
    setDraftDayId(null);
    setRating(null);
    setNote('');
    setIsPickError(false);
  }

  // 409 RATING_CLOSED: đã chấm/bỏ qua ở nơi khác hoặc vừa quá hạn
  function showError(error: unknown): void {
    const status = (error as { response?: { status?: number } }).response?.status;
    push(status === 409 ? t('rate.closed') : apiErrorMessage(error), 'error');
  }

  function reveal(revealed: HouseHealthDay, message: string): void {
    push(message);
    clearDraft();
    close();
    onRevealed(revealed);
  }

  function handleSave(): void {
    if (!rating) {
      setIsPickError(true);
      return;
    }
    const trimmedNote = note.trim();
    rate.mutate(
      { dayId, rating, note: trimmedNote || undefined },
      { onSuccess: revealed => reveal(revealed, t('rate.saved')), onError: showError },
    );
  }

  function handleSkip(): void {
    skip.mutate(dayId, {
      onSuccess: revealed => reveal(revealed, t('skip.done')),
      onError: error => {
        setIsSkipOpen(false);
        showError(error);
      },
    });
  }

  return (
    <>
      <Modal open={!isSkipOpen} onClose={close} ariaLabel={t('rate.title', { date: date(day.date), house: day.house_name })} size="lg" closeOnBackdrop>
        <div className="flex flex-col gap-5">
          {/* Tiêu đề in đậm cả dòng; chừa chỗ nút ✕ */}
          <h2 className="flex min-h-9 items-center pr-12 text-lg font-bold text-charcoal">
            {t('rate.title', { date: date(day.date), house: day.house_name })}
          </h2>
          {/* Thanh ngang ngăn tiêu đề với nội dung (cùng nét ModalHeader của popup người dùng) */}
          <hr className="border-gray-200" />
          {/* Phần trong **…** của câu dịch in đậm chữ đen */}
          <p className="text-sm text-warmGray">{withBold(t('rate.intro'))}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('col.myRating')}>
            {RATINGS.map(value => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                onClick={() => {
                  setRating(value);
                  setIsPickError(false);
                }}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border-2 border-warmGray/15 p-4 text-left transition-colors hover:bg-warmGray/5',
                  rating === value && SELECTED_CLASS[value],
                )}
              >
                <span className="font-semibold text-charcoal">{t(`status.${value}`)}</span>
                <span className="text-xs text-warmGray">{t(`statusHint.${value}`)}</span>
              </button>
            ))}
          </div>
          {isPickError && <p className="text-sm text-alertRed">{t('rate.pickOne')}</p>}
          <Textarea
            label={t('rate.note')}
            placeholder={t('rate.notePlaceholder')}
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            onChange={event => setNote(event.target.value)}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setIsSkipOpen(true)} disabled={rate.isPending}>{t('rate.skip')}</Button>
            <Button onClick={handleSave} loading={rate.isPending}>{t('rate.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        open={isSkipOpen}
        title={t('skip.title')}
        description={withBold(t('skip.desc'))}
        confirmLabel={t('skip.confirm')}
        danger
        loading={skip.isPending}
        onConfirm={handleSkip}
        onCancel={() => setIsSkipOpen(false)}
      />
    </>
  );
}
