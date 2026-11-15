import type { ReactNode } from 'react';
import AlertDetailsLine from '@/components/common/AlertDetailsLine';
import SeverityBadge from '@/components/common/SeverityBadge';
import { STATUS_BADGE_CLASS } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { Badge, Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { Drawer } from '@/components/ui/Drawer';
import { alertsDict } from '@/constants/alerts.i18n';
import { isAlertFinished } from '@/constants/severity';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useAlert } from '@/hooks/shared/useAlerts';
import type { Alert } from '@/types';

interface AlertDetailDrawerProps {
  // null = đóng
  alertId: string | null;
  locationOf: (alert: Alert) => { location: string; device: string | null };
  canAcknowledge: boolean;
  onAcknowledge: (alert: Alert) => void;
  onClose: () => void;
}

// Một dòng nhãn — giá trị
function DetailRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-sm font-semibold text-warmGray">{label}</dt>
      <dd className="text-right text-sm text-charcoal">{children}</dd>
    </div>
  );
}

// Một mục có tiêu đề đậm, nội dung trong khung viền bo góc
function DetailSection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-h3 text-charcoal">{title}</h3>
      <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 px-4 py-3">{children}</div>
    </section>
  );
}

// ALERT-FR-007, 009, 018 — chi tiết cảnh báo: nội dung, số đo, vị trí, nguyên nhân tại chỗ, tiếp nhận, bác bỏ; Farm Owner xác nhận cảnh báo mới
export default function AlertDetailDrawer({ alertId, locationOf, canAcknowledge, onAcknowledge, onClose }: AlertDetailDrawerProps): JSX.Element {
  const { t, dateTime } = useTranslation(alertsDict);
  const apiErrorMessage = useApiErrorMessage();
  const { data: alert, isLoading, isError, error, refetch } = useAlert(alertId);
  const place = alert ? locationOf(alert) : null;
  const verdict = alert?.status === 'DISMISSED' ? alert.expert_verdict : undefined;

  return (
    <Drawer open={Boolean(alertId)} onClose={onClose} title={alert ? t(`type.${alert.type}`) : t('detail.title')}>
      {isLoading ? (
        <LoadingSkeleton count={4} className="h-10 w-full" />
      ) : isError || !alert || !place ? (
        <EmptyState
          title={t('detail.loadFailed')}
          description={apiErrorMessage(error)}
          action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('page.retry')}</Button>}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <dl className="flex flex-col gap-3">
            <DetailRow label={t('detail.level')}>
              <SeverityBadge severity={alert.severity} isMuted={isAlertFinished(alert.status)} />
            </DetailRow>
            <DetailRow label={t('detail.status')}>
              <Badge className={STATUS_BADGE_CLASS[alert.status]}>{t(`status.${alert.status}`)}</Badge>
            </DetailRow>
            <DetailRow label={t('detail.createdAt')}>{dateTime(alert.created_at)}</DetailRow>
            <DetailRow label={t('detail.location')}>{place.location}</DetailRow>
            {place.device && <DetailRow label={t('detail.device')}>{place.device}</DetailRow>}
          </dl>

          <DetailSection title={t('detail.content')}>
            <p className="text-sm font-semibold text-charcoal">{alert.title}</p>
            <p className="whitespace-pre-line text-sm text-warmGray">{alert.message}</p>
            <AlertDetailsLine alert={alert} />
          </DetailSection>

          {alert.site_cause && (
            <DetailSection title={t('detail.cause')}>
              <p className="text-sm font-semibold text-charcoal">{t(`cause.${alert.site_cause.cause}`)}</p>
              <span className="text-xs text-warmGray">{t('detail.causeAt', { time: dateTime(alert.site_cause.at) })}</span>
              {Boolean(alert.site_cause.photo_urls?.length) && (
                <div className="grid grid-cols-3 gap-2">
                  {alert.site_cause.photo_urls?.map(url => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={t('detail.cause')} className="aspect-square w-full rounded-xl object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </DetailSection>
          )}

          {alert.acknowledged_at && (
            <DetailSection title={t('detail.acknowledgement')}>
              <span className="text-sm text-charcoal">{t('detail.acknowledgedAt', { time: dateTime(alert.acknowledged_at) })}</span>
              {alert.acknowledgement_note && (
                <p className="whitespace-pre-line text-sm text-warmGray">{t('detail.note', { note: alert.acknowledgement_note })}</p>
              )}
            </DetailSection>
          )}

          {verdict && (
            <DetailSection title={t('detail.dismissed')}>
              <span className="text-sm text-charcoal">
                {t(verdict.role === 'FARM_OWNER' ? 'detail.dismissedByOwner' : 'detail.dismissedBy', { time: dateTime(verdict.at) })}
              </span>
              {verdict.note && <p className="whitespace-pre-line text-sm text-warmGray">{t('detail.reason', { note: verdict.note })}</p>}
            </DetailSection>
          )}

          {canAcknowledge && alert.status === 'ACTIVE' && (
            <Button onClick={() => onAcknowledge(alert)}>{t('action.acknowledge')}</Button>
          )}
        </div>
      )}
    </Drawer>
  );
}
