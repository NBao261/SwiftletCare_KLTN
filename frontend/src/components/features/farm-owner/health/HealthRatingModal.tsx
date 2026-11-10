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
// BR-37: những gì người đánh giá quan sát tại nhà (không lặp lại số cảm biến); dấu hiệu nặng tô đỏ
const GUIDE = ['flock', 'environment', 'air', 'disturbance', 'equipment', 'severe'] as const;

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
  // Ngày của nháp: đóng rồi mở lại đúng ngày đó thì còn nháp, mở ngày khác thì trống
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

  // Câu lỗi chung theo nhóm (13.16 b); 409 (đã đánh giá nơi khác, vừa quá hạn) thì đóng popup, danh sách tự làm mới
  function showError(error: unknown): void {
    push(apiErrorMessage(error), 'error');
    if ((error as { response?: { status?: number } }).response?.status === 409) {
      clearDraft();
      close();
    }
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
      <Modal open={!isSkipOpen} onClose={close} ariaLabel={t('rate.title', { date: date(day.date), house: day.house_name })} size="xl" closeOnBackdrop>
        <div className="flex flex-col gap-5">
          {/* Đầu popup: tiêu đề in đậm (chừa chỗ nút ✕) + câu nhắc ngay dưới, phần **…** in đậm chữ đen; luôn hiện, không cuộn */}
          <div className="flex flex-col gap-1">
            <h2 className="flex min-h-9 items-center pr-12 text-lg font-bold text-charcoal [overflow-wrap:anywhere]">
              {t('rate.title', { date: date(day.date), house: day.house_name })}
            </h2>
            <p className="pr-12 text-sm text-warmGray">{withBold(t('rate.intro'))}</p>
          </div>
          {/* Thanh ngang ngăn đầu popup với nội dung (cùng nét ModalHeader của popup người dùng) */}
          <hr className="border-gray-200" />
          {/* Thân cuộn được khi màn thấp; đầu popup và nút luôn hiện */}
          <div className="-mx-1 flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-1">
            {/* Hướng dẫn quan sát BR-37, hiện trước khi chọn mức để mọi người đánh giá cùng một thước đo */}
            <section className="flex flex-col gap-2 rounded-xl bg-warmGray/[0.06] p-4" aria-label={t('rate.guideTitle')}>
              <p className="text-sm font-semibold text-charcoal">{t('rate.guideTitle')}</p>
              {/* Bảng 1 cột: nhãn trái cố định, nội dung phải — mỗi nhóm thường gọn 1 dòng */}
              <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 text-xs">
                {GUIDE.map(item => (
                  <div key={item} className="contents">
                    <dt className={cn('font-semibold', item === 'severe' ? 'text-alertRed' : 'text-charcoal')}>{t(`rate.guide.${item}`)}</dt>
                    <dd className="text-warmGray">{t(`rate.guide.${item}Text`)}</dd>
                  </div>
                ))}
              </dl>
            </section>
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
          </div>
          {/* Câu nhắc bỏ qua bên trái, 2 nút bên phải trên cùng hàng */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-warmGray">{t('rate.skipHint')}</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setIsSkipOpen(true)} disabled={rate.isPending}>{t('rate.skip')}</Button>
              <Button onClick={handleSave} loading={rate.isPending}>{t('rate.save')}</Button>
            </div>
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
