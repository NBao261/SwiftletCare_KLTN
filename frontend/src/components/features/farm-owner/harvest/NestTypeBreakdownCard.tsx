import { Card } from '@/components/ui';
import { KILOGRAM_DIGITS, NEST_TYPES } from '@/components/features/farm-owner/harvest/harvest.constants';
import { nestTypeBreakdown } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { HarvestBatch } from '@/types';

// Mỗi loại một thanh ngang, % ghi bên cạnh
export default function NestTypeBreakdownCard({ batches }: { batches: HarvestBatch[] }): JSX.Element {
  const { t, num } = useTranslation(harvestDict);
  const { totalKilograms, shares } = nestTypeBreakdown(batches, NEST_TYPES);
  const isEmpty = totalKilograms === 0;

  return (
    <Card size="lg" className="flex h-full flex-col gap-5">
      <div>
        <h2 className="text-h2 text-charcoal">{t('breakdown.title')}</h2>
        <p className="mt-1 text-body text-graphite">{t('breakdown.subtitle')}</p>
      </div>

      <ul className="flex flex-col gap-4" aria-label={t('breakdown.chartAria')}>
        {shares.map(share => (
          <li key={share.nestType} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-body">
              <span className={cn('min-w-0 truncate', isEmpty ? 'text-warmGray' : 'text-charcoal')}>{t(`nestType.${share.nestType}`)}</span>
              {isEmpty ? (
                <span className="shrink-0 text-warmGray">{t('breakdown.noData')}</span>
              ) : (
                <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                  <span className="font-semibold text-charcoal">{t('breakdown.kilograms', { kg: num(share.kilograms, KILOGRAM_DIGITS) })}</span>
                  <span className="w-14 text-right text-warmGray">{t('breakdown.percent', { percent: num(share.percent, 1) })}</span>
                </span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-warmGray/10">
              <div className="h-full rounded-full bg-accent-700 transition-[width] duration-500" style={{ width: `${isEmpty ? 0 : share.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
