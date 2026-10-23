import { Link } from 'react-router-dom';

import { Card } from '@/components/ui';
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { formatStandardDate } from '@/lib/i18n';
import { KILOGRAM_DIGITS } from '@/components/features/farm-owner/harvest/harvest.constants';
import { NO_VALUE } from '@/constants/display';

const GRAMS_PER_KG = 1000;

// Khung sản lượng thu hoạch của 1 nhà yến: kg tháng này + 3 đợt thu gần nhất (cùng số liệu màn Cấu trúc Farm)
export default function HouseHarvestCard({ node }: { node: HouseNode }): JSX.Element {
  const { t, num } = useTranslation(dashboardDict);

  return (
    <Card size="lg" className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-h2 text-charcoal">{t('harvest.title')}</h2>
        <Link to="/harvests" className="shrink-0 text-xs font-semibold text-graphite hover:text-charcoal">
          {t('harvest.viewAll')}
        </Link>
      </div>

      {/* Tháng này: số kg lớn, số tổ + số đợt thu */}
      <div>
        <p className="label-caption">{t('harvest.month')}</p>
        <p className="mt-1 leading-none">
          <span className="text-[32px] font-extrabold tracking-tight tabular-nums text-charcoal">
            {node.monthBatches > 0 ? num(node.monthKg, KILOGRAM_DIGITS) : NO_VALUE}
          </span>
          {node.monthBatches > 0 && <span className="ml-1 text-sm font-semibold text-warmGray">kg</span>}
        </p>
        <p className="mt-1 text-xs text-warmGray">
          {t('harvest.sub', { nests: num(node.monthNests), batches: num(node.monthBatches) })}
        </p>
      </div>

      {/* 3 đợt thu gần nhất của nhà */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 border-t border-warmGray/10 pt-3">
        <p className="label-caption">{t('harvest.recent')}</p>
        {node.recent.length === 0 ? (
          <p className="text-xs text-warmGray">{t('harvest.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {node.recent.map(batch => (
              <li key={batch._id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-graphite">{formatStandardDate(batch.harvest_date)}</span>
                <span className="font-semibold tabular-nums text-charcoal">
                  {t('harvest.batch', { kg: num(batch.weight_grams / GRAMS_PER_KG, KILOGRAM_DIGITS), nests: num(batch.nest_count) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
