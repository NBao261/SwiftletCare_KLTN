import { useState } from 'react';

import { shiftDate, vietnamDate } from '@/components/features/farm-owner/health/healthDay.utils';
import { withBold } from '@/components/features/farm-owner/health/HealthRatingModal';
import { MAX_REPORT_DAYS, reportRangeError } from '@/components/features/farm-owner/health/healthReport.utils';
import { Button, DatePicker, Modal } from '@/components/ui';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useCreateHouseHealthReport } from '@/hooks/shared/useHealthDays';
import { useToastStore } from '@/stores/toastStore';
import type { HouseHealthReport } from '@/types';

interface HealthReportCreateModalProps {
  open: boolean;
  onClose: () => void;
  house: { id: string; name: string };
  // Backend trả báo cáo đầy đủ — màn mở chi tiết luôn
  onCreated: (report: HouseHealthReport) => void;
}

// EXPERT-FR-005 — báo cáo theo yêu cầu cho 1 nhà, khoảng tới 31 ngày (mặc định 7 ngày tới hôm nay)
export default function HealthReportCreateModal({ open, onClose, house, onCreated }: HealthReportCreateModalProps): JSX.Element {
  const { t } = useTranslation(healthDict);
  const create = useCreateHouseHealthReport();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const today = vietnamDate();
  const [from, setFrom] = useState(() => shiftDate(today, -6));
  const [to, setTo] = useState(today);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const rangeError = reportRangeError(from, to, today);
  const errorText = isSubmitted && rangeError ? t(rangeError, { max: MAX_REPORT_DAYS }) : undefined;

  function handleCreate(): void {
    setIsSubmitted(true);
    if (rangeError) return;
    create.mutate(
      { houseId: house.id, from, to },
      {
        onSuccess: report => {
          push(t('create.done'));
          setIsSubmitted(false);
          onCreated(report);
        },
        onError: error => push(apiErrorMessage(error), 'error'),
      },
    );
  }

  return (
    // Ngày chọn còn giữ khi đóng nên bấm ra ngoài đóng được; đang tạo thì không
    <Modal open={open} onClose={onClose} title={t('create.title', { house: house.name })} size="lg" closeOnBackdrop={!create.isPending}>
      <div className="flex flex-col gap-5">
        <hr className="border-gray-200" />
        <p className="text-sm text-warmGray">{withBold(t('create.intro'))}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Ô ngày dd/mm/yyyy + lịch của web (như form thu hoạch), không dùng lịch tiếng Anh của trình duyệt */}
          <DatePicker id="report-from" label={t('create.from')} value={from} max={today} onChange={setFrom} />
          <DatePicker id="report-to" label={t('create.to')} value={to} max={today} onChange={setTo} />
        </div>
        {errorText && <p className="text-sm text-alertRed">{errorText}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>{t('action.cancel')}</Button>
          <Button onClick={handleCreate} loading={create.isPending}>{t('report.create')}</Button>
        </div>
      </div>
    </Modal>
  );
}
