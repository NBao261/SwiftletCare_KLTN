import { useState } from 'react';

import { Card } from '@/components/ui';
import { KILOGRAM_DIGITS, NEST_TYPES } from '@/components/features/farm-owner/harvest/harvest.constants';
import { nestTypeBreakdown } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { HarvestBatch } from '@/types';
import { NO_VALUE } from '@/constants/display';

// Màu theo thứ tự vòng: yến trắng xanh chanh, yến hồng xanh đậm, yến huyết rêu, tổng đen
const RING_COLORS: Array<{ stroke: string; fill: string }> = [
  { stroke: 'stroke-accent-600', fill: 'bg-accent-600' },
  { stroke: 'stroke-accent-700', fill: 'bg-accent-700' },
  { stroke: 'stroke-accent-900', fill: 'bg-accent-900' },
  { stroke: 'stroke-charcoal', fill: 'bg-charcoal' },
];

// Chưa có đợt thu: mọi vòng và chấm chú thích về xám
const EMPTY_COLOR = { stroke: 'stroke-warmGray/25', fill: 'bg-warmGray/30' };

const RING_SIZE = 220;
const RING_STROKE = 12;
const RING_GAP = 4;
const RING_CENTER = RING_SIZE / 2;
// 100% ứng với 3/4 vòng (270°) để cung luôn hở như mẫu, không thành vòng kín
const MAX_SWEEP = 0.75;

interface RingItem {
  key: string;
  label: string;
  kilograms: number;
  percent: number;
}

// Bán kính vòng thứ index, vòng 0 ở ngoài cùng
function ringRadius(index: number): number {
  return RING_CENTER - RING_STROKE / 2 - index * (RING_STROKE + RING_GAP);
}

// Khung phân bổ khối lượng theo loại tổ trên mọi đợt thu: vòng đồng tâm (mỗi loại 1 vòng + vòng tổng) và chú thích có thanh tỉ lệ, rê chuột vòng hoặc chú thích để làm nổi 1 loại
export default function NestTypeBreakdownCard({ batches }: { batches: HarvestBatch[] }): JSX.Element {
  const { t, num } = useTranslation(harvestDict);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { totalKilograms, shares } = nestTypeBreakdown(batches, NEST_TYPES);

  const items: RingItem[] = [
    ...shares.map(share => ({
      key: share.nestType, label: t(`nestType.${share.nestType}`), kilograms: share.kilograms, percent: share.percent,
    })),
    { key: 'total', label: t('breakdown.totalItem'), kilograms: totalKilograms, percent: 100 },
  ];
  const isEmpty = totalKilograms === 0;
  const hoveredItem = hoveredIndex !== null && !isEmpty ? items[hoveredIndex] : undefined;

  // Mờ các mục khác khi đang rê chuột vào 1 mục (không áp khi chưa có dữ liệu)
  const fadeClass = (index: number): string => (hoveredItem && hoveredIndex !== index ? 'opacity-30' : 'opacity-100');
  // Màu của vòng / chấm thứ index, xám hết khi chưa có dữ liệu
  const colorOf = (index: number): { stroke: string; fill: string } => (isEmpty ? EMPTY_COLOR : RING_COLORS[index]);

  return (
    <Card size="lg" className="flex h-full flex-col gap-5">
      <div>
        <h2 className="text-h2 text-charcoal">{t('breakdown.title')}</h2>
        <p className="mt-1 text-sm text-warmGray">{t('breakdown.subtitle')}</p>
      </div>

      {/* Chưa có đợt thu vẫn vẽ đủ khung ở trạng thái xám, các loại tổ ghi "Chưa có dữ liệu" */}
      <>
          {/* Vòng đồng tâm: cung bắt đầu ở 9 giờ, chạy theo chiều kim đồng hồ, 100% dài 3/4 vòng */}
          <div className="relative mx-auto" style={{ width: RING_SIZE, height: RING_SIZE }}>
            <svg width={RING_SIZE} height={RING_SIZE} role="img" aria-label={t('breakdown.chartAria')}>
              {items.map((item, index) => {
                const radius = ringRadius(index);
                const isTotal = item.key === 'total';
                const circumference = 2 * Math.PI * radius;
                const length = (item.percent / 100) * circumference * MAX_SWEEP;
                // % làm tròn 1 chữ số bằng 0 (chú thích ghi 0,0%) thì không vẽ cung, tránh chấm tròn lẻ do đầu bo
                const isVisible = Math.round(item.percent * 10) > 0;
                return (
                  <g
                    key={item.key}
                    transform={`rotate(180 ${RING_CENTER} ${RING_CENTER})`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={cn('transition-opacity duration-200', fadeClass(index))}
                  >
                    <circle cx={RING_CENTER} cy={RING_CENTER} r={radius} fill="none" strokeWidth={RING_STROKE} className="stroke-warmGray/10" />
                    {/* Vòng tổng luôn kín, đứng yên; vòng loại tổ chạy theo % */}
                    {isTotal ? (
                      <circle cx={RING_CENTER} cy={RING_CENTER} r={radius} fill="none" strokeWidth={RING_STROKE} className={colorOf(index).stroke} />
                    ) : isVisible && (
                      <circle
                        cx={RING_CENTER}
                        cy={RING_CENTER}
                        r={radius}
                        fill="none"
                        strokeWidth={RING_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={`${length} ${circumference}`}
                        className={cn('transition-[stroke-dasharray] duration-500', colorOf(index).stroke)}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            {/* Tâm: mặc định tổng kg, rê chuột thì hiện kg của mục đó */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-xl font-extrabold tabular-nums', isEmpty ? 'text-warmGray' : 'text-charcoal')}>
                {isEmpty ? NO_VALUE : num(hoveredItem?.kilograms ?? totalKilograms, KILOGRAM_DIGITS)}
              </span>
              <span className="text-[11px] text-warmGray">
                {isEmpty ? t('breakdown.noData') : `kg · ${hoveredItem?.label ?? t('breakdown.totalItem')}`}
              </span>
            </div>
          </div>

          {/* Chú thích: chấm màu, tên, kg, %, thanh tỉ lệ; rê chuột hoặc focus để làm nổi vòng tương ứng */}
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => (
              <li
                key={item.key}
                tabIndex={0}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                className={cn('flex flex-col gap-1.5 rounded-md outline-none transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-charcoal', fadeClass(index))}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', colorOf(index).fill)} />
                    <span className={cn('truncate', isEmpty ? 'text-warmGray' : 'text-charcoal')}>{item.label}</span>
                  </span>
                  {isEmpty ? (
                    <span className="shrink-0 text-warmGray">{t('breakdown.noData')}</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-3 tabular-nums">
                      <span className="text-graphite">{t('breakdown.kilograms', { kg: num(item.kilograms, KILOGRAM_DIGITS) })}</span>
                      <span className="w-12 text-right text-warmGray">{t('breakdown.percent', { percent: num(item.percent, 1) })}</span>
                    </span>
                  )}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-warmGray/10">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-500', colorOf(index).fill)}
                    style={{ width: `${isEmpty ? 0 : item.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
      </>
    </Card>
  );
}
