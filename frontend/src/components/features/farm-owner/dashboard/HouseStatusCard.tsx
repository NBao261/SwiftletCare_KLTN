import { Link } from 'react-router-dom';
import { WarningIcon } from '@phosphor-icons/react';

import HealthStatusBadge from '@/components/common/HealthStatusBadge';
import SimulatedBadge from '@/components/common/SimulatedBadge';
import type { HouseNode, MetricKey, ZoneNode } from '@/components/features/farm-owner/farms/farmStructure';
import { Badge } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { farmDict } from '@/constants/farmStructure.i18n';
import { healthDict } from '@/constants/health.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { farmHousePath } from '@/hooks/shared/useScopeFilter';
import { cn } from '@/lib/cn';
import type { HouseOverview, SensorNode } from '@/types';

// 3 số đo chính trên thẻ nhà (§5.1): nhiệt độ, độ ẩm, NH3
const CARD_METRICS: { key: MetricKey; prefix: string; unit: string; digits: number }[] = [
  { key: 'temperature', prefix: '', unit: '°C', digits: 1 },
  { key: 'humidity', prefix: '', unit: '%', digits: 0 },
  { key: 'nh3', prefix: 'NH3 ', unit: 'ppm', digits: 0 },
];

const STATUS_CLASS = {
  ALERT: 'bg-orange-50 text-safetyOrange',
  NORMAL: 'bg-accent-100 text-accent-800',
  EMPTY: 'bg-warmGray/10 text-warmGray',
} as const;

const STATUS_DOT = { ALERT: 'bg-safetyOrange', NORMAL: 'bg-success', EMPTY: 'bg-warmGray' } as const;

const STATUS_KEY = { ALERT: 'house.statusAlert', NORMAL: 'house.statusNormal', EMPTY: 'house.statusEmpty' } as const;

const MINUTE_MS = 60_000;

interface HouseStatusCardProps {
  node: HouseNode;
  // Trạng thái trực tiếp (houseLiveStatus): cùng luật với ô "Nhà cần chú ý"
  status: 'ALERT' | 'NORMAL' | 'EMPTY';
  // Bộ điều khiển của các Zone trong nhà (chế độ tự động/tay, online)
  sensors: SensorNode[];
  // Tình hình hôm nay của nhà (GET /farms/{id}/overview); undefined = chưa tải
  overview?: HouseOverview;
  // BR-31: người xem chưa đánh giá ngày hôm nay của nhà thì ẩn trạng thái hôm nay
  hideTodayStatus?: boolean;
}

// Thẻ 1 nhà ở Tổng quan (FO-01, ANALYTICS-FR-015): môi trường từng Zone, chế độ điều khiển, giai đoạn, trạng thái hôm nay, cảnh báo và phiếu đang mở, chim về
export default function HouseStatusCard({ node, status, sensors, overview, hideTodayStatus = false }: HouseStatusCardProps): JSX.Element {
  const { t, num } = useTranslation(dashboardDict);
  const { t: farmT } = useTranslation(farmDict);
  const { t: healthT } = useTranslation(healthDict);
  // Nhà tạo trước FARM-FR-014 chưa có giai đoạn: mặc định OCCUPIED (api-spec House.stage)
  const stage = overview?.stage ?? 'OCCUPIED';
  const onlineControllers = sensors.filter(sensor => sensor.status === 'ONLINE').length;
  const manualSensors = sensors.filter(sensor => sensor.control_mode === 'MANUAL');
  const overrideEnd = Math.max(0, ...manualSensors.map(sensor => (sensor.override_expiry ? Date.parse(sensor.override_expiry) : 0)));
  const minutesLeft = Math.ceil((overrideEnd - Date.now()) / MINUTE_MS);

  // Chế độ điều khiển: hạn điều khiển tay đã qua mà dữ liệu chưa cập nhật thì ghi "đang về tự động", không đứng ở "còn 1 phút"
  let mode = t('house.auto');
  if (manualSensors.length > 0 && overrideEnd === 0) mode = t('house.manualNoTime');
  if (manualSensors.length > 0 && overrideEnd > 0 && minutesLeft > 0) mode = t('house.manual', { n: num(minutesLeft) });
  if (manualSensors.length > 0 && overrideEnd > 0 && minutesLeft <= 0) mode = t('house.manualEnding');
  const controlText = sensors.length === 0
    ? t('house.noController')
    : `${mode} · ${t('house.controllers', { online: num(onlineControllers), total: num(sensors.length) })}`;

  const footer = [
    overview?.latest_return_rate ? t('house.returnRate', { value: `${num(overview.latest_return_rate.value, 0)} %` }) : null,
    // Cùng nguồn với ô "Cảnh báo chưa xử lý" (overview), chưa tải thì chưa ghi
    overview ? t('house.alerts', { n: num(overview.open_alerts) }) : null,
    overview ? t('house.workOrders', { n: num(overview.open_work_orders) }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <Link
      to={farmHousePath(node.farm._id, node.house._id)}
      className="flex h-full flex-col gap-4 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card transition-colors hover:border-warmGray/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-charcoal"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="break-words text-h3 text-charcoal">{node.house.name}</h3>
          {overview && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={stage === 'ATTRACTING' ? 'info' : 'neutral'}>{farmT(`stage.${stage}`)}</Badge>
              <SimulatedBadge simulated={overview.simulated} />
            </div>
          )}
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-small font-semibold', STATUS_CLASS[status])}>
          <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
          {t(STATUS_KEY[status])}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {node.zones.length === 0 && <li className="text-body text-warmGray">{t('house.noZone')}</li>}
        {node.zones.map(zone => <ZoneLine key={zone.zone._id} zone={zone} />)}
      </ul>

      <div className="mt-auto flex flex-col gap-1 border-t border-warmGray/10 pt-3 text-body text-graphite">
        <p>{controlText}</p>
        {/* Trạng thái sức khoẻ hôm nay (MF-06), hoặc lý do chưa có */}
        {overview && !hideTodayStatus && (
          <p className="flex flex-wrap items-center gap-2">
            {t('house.today')}
            {overview.status
              ? <HealthStatusBadge status={overview.status} />
              : <span className="text-warmGray">{overview.status_reason === 'INSUFFICIENT_DATA' ? healthT('status.INSUFFICIENT_DATA') : t('house.notComputed')}</span>}
          </p>
        )}
        <p className="text-warmGray">{footer}</p>
      </div>
    </Link>
  );
}

// 1 Zone: tên + 3 số đo; số vượt ngưỡng tô cam kèm icon (không chỉ màu)
function ZoneLine({ zone }: { zone: ZoneNode }): JSX.Element {
  const { t, num } = useTranslation(dashboardDict);
  const breached = new Set(zone.breaches.map(breach => breach.metric));
  const values = CARD_METRICS.flatMap(metric => {
    const value = zone.metrics?.[metric.key];
    return value === undefined ? [] : [{ ...metric, value }];
  });

  return (
    <li className="flex items-baseline gap-3 text-body">
      <span className="w-20 shrink-0 truncate text-warmGray" title={zone.zone.name}>{zone.zone.name}</span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 tabular-nums text-charcoal">
        {values.length === 0 && NO_VALUE}
        {values.map((metric, index) => {
          const isOver = breached.has(metric.key);
          return (
            <span key={metric.key} className={cn('inline-flex items-center gap-1', isOver && 'font-semibold text-safetyOrange')}>
              {index > 0 && <span aria-hidden="true" className="font-normal text-warmGray">·</span>}
              {isOver && <WarningIcon size={14} weight="bold" aria-label={t('house.overLimit')} />}
              {`${metric.prefix}${num(metric.value, metric.digits)} ${metric.unit}`}
            </span>
          );
        })}
      </span>
    </li>
  );
}
