import type { ReactNode } from 'react';
import { PLAN_STATE_TONE } from '@/components/features/farm-owner/maintenance/MaintenancePlanTable';
import { Badge } from '@/components/ui';
import { Drawer } from '@/components/ui/Drawer';
import { NO_VALUE } from '@/constants/display';
import { maintenanceDict } from '@/constants/maintenance.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { MaintenancePlan } from '@/types';

interface MaintenancePlanDetailDrawerProps {
  // null = đóng
  plan: MaintenancePlan | null;
  houseName: string;
  onClose: () => void;
}

// Một dòng nhãn — giá trị
function DetailRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-sm text-warmGray">{label}</dt>
      <dd className="text-right text-sm text-charcoal">{children}</dd>
    </div>
  );
}

// OPS-FR-005, 008 — chi tiết kế hoạch: chu kỳ, hạn, nguồn, checklist, lịch sử bảo trì, góp ý của chuyên gia
export default function MaintenancePlanDetailDrawer({ plan, houseName, onClose }: MaintenancePlanDetailDrawerProps): JSX.Element {
  const { t, num, date, dateTime } = useTranslation(maintenanceDict);

  return (
    <Drawer open={Boolean(plan)} onClose={onClose} title={plan ? t(`equipment.${plan.equipment}`) : t('detail.title')}>
      {plan && (
        <div className="flex flex-col gap-6">
          <dl className="flex flex-col gap-3">
            <DetailRow label={t('detail.house')}>{houseName || NO_VALUE}</DetailRow>
            <DetailRow label={t('detail.interval')}>
              {t(`unit.${plan.basis}`, { value: num(plan.interval) })} · {t(`basis.${plan.basis}`)}
            </DetailRow>
            <DetailRow label={t('detail.state')}>
              <Badge tone={PLAN_STATE_TONE[plan.state]}>{t(`state.${plan.state}`)}</Badge>
            </DetailRow>
            <DetailRow label={t('detail.nextDue')}>
              {plan.basis !== 'CALENDAR' ? t('cell.byCounter') : plan.next_due_at ? date(plan.next_due_at) : NO_VALUE}
            </DetailRow>
            <DetailRow label={t('detail.lastDone')}>{plan.last_done_at ? dateTime(plan.last_done_at) : NO_VALUE}</DetailRow>
            <DetailRow label={t('detail.source')}>{plan.source}</DetailRow>
            {plan.note && <DetailRow label={t('detail.note')}>{plan.note}</DetailRow>}
          </dl>

          <section className="flex flex-col gap-2">
            <h3 className="label-caption">{t('detail.checklist')}</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-charcoal">
              {plan.checklist_template.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
            </ol>
          </section>

          {/* Lịch sử bảo trì, mới nhất trước */}
          <section className="flex flex-col gap-2">
            <h3 className="label-caption">{t('detail.records')}</h3>
            {plan.records.length === 0 ? (
              <p className="text-sm text-warmGray">{t('detail.noRecords')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[...plan.records].reverse().map(record => (
                  <li key={record.work_order_id} className="rounded-xl border border-gray-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-charcoal">{t(`record.${record.kind}`)}</span>
                      <span className="text-xs text-warmGray">{dateTime(record.at)}</span>
                    </div>
                    {record.next_due_at && (
                      <span className="text-xs text-warmGray">{t('detail.recordNextDue', { date: date(record.next_due_at) })}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="label-caption">{t('detail.comments')}</h3>
            {plan.comments.length === 0 ? (
              <p className="text-sm text-warmGray">{t('detail.noComments')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[...plan.comments].reverse().map(comment => (
                  <li key={comment.at} className="rounded-xl border border-gray-200 px-3 py-2">
                    <p className="whitespace-pre-line text-sm text-charcoal">{comment.text}</p>
                    <span className="text-xs text-warmGray">{dateTime(comment.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
