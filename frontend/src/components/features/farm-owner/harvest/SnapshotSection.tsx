import { harvestDict, type HarvestKey } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { HarvestBatch } from '@/types';
import { NO_VALUE } from '@/constants/display';

// 1 dòng số đo trung bình: nhãn, giá trị (thiếu thì NO_VALUE), đơn vị
interface SnapshotRow {
  labelKey: HarvestKey;
  value: number | undefined;
  unit: string;
  decimals: number;
}

// Môi trường TB 7 ngày trước thu (HARVEST-FR-002) + đàn chim TB 30 ngày (HARVEST-FR-003) do backend gắn lúc tạo đợt thu
export default function SnapshotSection({ batch }: { batch: HarvestBatch }): JSX.Element {
  const { t, num } = useTranslation(harvestDict);
  // Dữ liệu cũ (seed, nhập tay) có thể thiếu hẳn 2 khối snapshot
  const environment = batch.env_snapshot ?? {};
  const flock = batch.flock_snapshot ?? {};
  const isEnvironmentMissing = environment.insufficient_data || environment.avg_temperature === undefined;

  const environmentRows: SnapshotRow[] = [
    { labelKey: 'detail.temperature', value: environment.avg_temperature, unit: '°C', decimals: 1 },
    { labelKey: 'detail.humidity', value: environment.avg_humidity, unit: '%', decimals: 1 },
    { labelKey: 'detail.light', value: environment.avg_light_lux, unit: 'lux', decimals: 1 },
    { labelKey: 'detail.nh3', value: environment.avg_nh3_ppm, unit: 'ppm', decimals: 1 },
    { labelKey: 'detail.co2', value: environment.avg_co2_ppm, unit: 'ppm', decimals: 0 },
  ];

  const formatValue = (value: number | undefined, unit: string, decimals: number): string =>
    (value === undefined ? NO_VALUE : `${num(value, decimals)} ${unit}`);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-warmGray/15 p-4">
        <p className="label-caption mb-2">{t('detail.envTitle')}</p>
        {isEnvironmentMissing ? (
          <p className="text-sm text-warmGray">{t('detail.envInsufficient')}</p>
        ) : (
          <dl className="flex flex-col gap-1 text-sm">
            {environmentRows.map(row => (
              <div key={row.labelKey} className="flex justify-between gap-3">
                <dt className="text-warmGray">{t(row.labelKey)}</dt>
                <dd className="font-semibold tabular-nums text-charcoal">{formatValue(row.value, row.unit, row.decimals)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="rounded-xl border border-warmGray/15 p-4">
        <p className="label-caption mb-2">{t('detail.flockTitle')}</p>
        {flock.avg_return_rate_30d === undefined ? (
          <p className="text-sm text-warmGray">{t('detail.flockEmpty')}</p>
        ) : (
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-warmGray">{t('detail.returnRate')}</dt>
              <dd className="font-semibold tabular-nums text-charcoal">{num(flock.avg_return_rate_30d, 1)}%</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-warmGray">{t('detail.population')}</dt>
              <dd className="font-semibold tabular-nums text-charcoal">
                {flock.estimated_population === undefined ? NO_VALUE : num(flock.estimated_population)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
