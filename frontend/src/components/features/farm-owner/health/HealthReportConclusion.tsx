import { useState } from 'react';

import { HOVER_DARK_BUTTON } from '@/components/features/farm-owner/health/healthDay.utils';
import { Button, Textarea } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import { useSetHealthReportConclusion } from '@/hooks/shared/useHealthDays';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { HouseHealthReport } from '@/types';

// Giới hạn của PUT /health-reports/{id}/conclusion
const CONCLUSION_MAX_LENGTH = 4000;

// EXPERT-FR-006 — kết luận của chuyên gia trên 1 báo cáo; Domain Expert viết, người viết sửa được bản của mình
export default function HealthReportConclusion({ report }: { report: HouseHealthReport }): JSX.Element {
  const { t, dateTime } = useTranslation(healthDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  const isExpert = usePermission('DOMAIN_EXPERT');
  const userId = useAuthStore(state => state.user?._id);
  const save = useSetHealthReportConclusion(report._id);
  const conclusion = report.expert_conclusion;
  const canWrite = isExpert && (!conclusion || conclusion.by._id === userId);
  // null = đang xem; chuỗi = đang viết
  const [draft, setDraft] = useState<string | null>(null);

  function handleSave(): void {
    if (draft === null) return;
    save.mutate(draft.trim(), {
      onSuccess: () => {
        setDraft(null);
        push(t('rd.saved'));
      },
      onError: error => push(apiErrorMessage(error), 'error'),
    });
  }

  if (draft !== null) {
    return (
      <div className="flex flex-col gap-3">
        <Textarea
          rows={6}
          aria-label={t('rd.conclusion')}
          placeholder={t('rd.placeholder')}
          value={draft}
          maxLength={CONCLUSION_MAX_LENGTH}
          onChange={event => setDraft(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-warmGray">{draft.length}/{CONCLUSION_MAX_LENGTH}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={save.isPending} onClick={() => setDraft(null)}>{t('action.cancel')}</Button>
            <Button size="sm" disabled={!draft.trim()} loading={save.isPending} onClick={handleSave}>{t('rd.save')}</Button>
          </div>
        </div>
      </div>
    );
  }

  // Kết luận (hoặc "Chưa có") bên trái, nút viết/sửa bên phải
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      {conclusion ? (
        <blockquote className="flex min-w-0 flex-1 flex-col gap-2 border-l-4 border-accent-600 pl-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-charcoal">{conclusion.text}</p>
          <footer className="text-xs text-warmGray">
            {conclusion.by.full_name ?? NO_VALUE} · {dateTime(conclusion.at)}
            {conclusion.edited_at && ` · ${t('rd.edited', { time: dateTime(conclusion.edited_at) })}`}
          </footer>
        </blockquote>
      ) : (
        <p className="flex-1 text-sm italic text-warmGray">{t('rd.noConclusion')}</p>
      )}
      {canWrite && (
        <Button variant="secondary" size="sm" className={cn('shrink-0', HOVER_DARK_BUTTON)} onClick={() => setDraft(conclusion?.text ?? '')}>
          {t(conclusion ? 'rd.edit' : 'rd.write')}
        </Button>
      )}
      {isExpert && !canWrite && <p className="w-full text-xs text-warmGray">{t('rd.otherExpert')}</p>}
    </div>
  );
}
