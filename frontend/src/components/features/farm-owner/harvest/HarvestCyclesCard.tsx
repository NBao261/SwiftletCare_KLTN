import { useMemo, useState, type ReactNode } from 'react';
import { HouseIcon } from '@phosphor-icons/react';

import TableEmptyState from '@/components/common/TableEmptyState';
import { Badge, Button, Card, LoadingSkeleton, type BadgeTone, type DataTableColumn } from '@/components/ui';
import { Drawer } from '@/components/ui/Drawer';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { KILOGRAM_DIGITS } from '@/components/features/farm-owner/harvest/harvest.constants';
import { NO_VALUE } from '@/constants/display';
import { harvestDict, type HarvestTranslate } from '@/constants/harvest.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHarvestCycleList } from '@/hooks/farm-owner/useHarvests';
import type { AllZone } from '@/hooks/shared/useFarms';
import { cn } from '@/lib/cn';
import type { HarvestCycle, HarvestCycleComparison, HarvestCycleStatus } from '@/types/harvest.types';

const GRAMS_PER_KILOGRAM = 1000;
// Khung bảng cố định 5 chu kỳ mỗi trang (thiếu thì bù dòng trống), phân trang ở server
const PAGE_SIZE = 5;
const ROW_HEIGHT = 72;
const STATUS_TONE: Record<HarvestCycleStatus, BadgeTone> = { OPEN: 'info', CLOSED: 'neutral', CONCLUDED: 'positive' };

interface HarvestCyclesCardProps {
  farmId: string;
  houseId: string;
  // Zone trong phạm vi đang lọc, để hiện tên nhà (và Zone khi nhà có nhiều Zone)
  zones: AllZone[];
}

// HARVEST-FR-007, ANALYTICS-FR-004 — chu kỳ thu hoạch theo zone: sản lượng, so sánh, sức khỏe, kết luận mùa vụ (chỉ xem)
export default function HarvestCyclesCard({ farmId, houseId, zones }: HarvestCyclesCardProps): JSX.Element {
  const { t, date, num, exact } = useTranslation(harvestDict);
  const apiErrorMessage = useApiErrorMessage();
  // Trang về 1 khi đổi farm/nhà: trang Thu hoạch gắn key theo phạm vi lọc nên khung dựng lại
  const [page, setPage] = useState(1);
  const { records: cycles, total, isLoading, isError, error, refetch } = useHarvestCycleList(farmId, houseId, page, PAGE_SIZE);
  const [selected, setSelected] = useState<HarvestCycle | null>(null);

  // Nhà có hơn 1 Zone thì ghi thêm tên Zone
  const placeByZone = useMemo(() => {
    const zoneCountByHouse = new Map<string, number>();
    for (const zone of zones) zoneCountByHouse.set(zone.house_id, (zoneCountByHouse.get(zone.house_id) ?? 0) + 1);
    return new Map(zones.map(zone => [
      zone._id,
      (zoneCountByHouse.get(zone.house_id) ?? 0) > 1 ? t('cycle.houseZone', { house: zone.houseName, zone: zone.name }) : zone.houseName,
    ]));
  }, [zones, t]);

  const kilograms = (grams: number) => num(grams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS);
  const percent = (value: number | null) => (value === null ? NO_VALUE : `${exact(value, 1)} %`);
  const period = (cycle: HarvestCycle): string => {
    if (!cycle.end_date) return t('cycle.periodOpen', { from: date(cycle.start_date) });
    // Chu kỳ mở đầu từ sổ sản lượng cũ không có ngày bắt đầu
    if (!cycle.start_date) return t('cycle.periodNoStart', { to: date(cycle.end_date) });
    return t('cycle.period', { from: date(cycle.start_date), to: date(cycle.end_date) });
  };

  const columns: DataTableColumn<HarvestCycle>[] = [
    { key: 'house', header: t('cycle.colHouse'), render: cycle => <span className="font-medium text-charcoal">{placeByZone.get(cycle.zone_id) ?? NO_VALUE}</span> },
    { key: 'period', header: t('cycle.colPeriod'), render: cycle => <span className="tabular-nums">{period(cycle)}</span> },
    {
      key: 'yield', header: t('cycle.colYield'), align: 'right',
      render: cycle => cycle.closing_harvest
        ? <span className="tabular-nums">{t('cycle.yield', { nests: num(cycle.closing_harvest.nest_count), kg: kilograms(cycle.closing_harvest.weight_grams) })}</span>
        : NO_VALUE,
    },
    { key: 'previous', header: t('cycle.colPrevious'), align: 'right', render: cycle => <Change value={cycle.comparison?.previous?.nest_count_change_pct ?? null} format={value => exact(value, 1)} /> },
    {
      key: 'goodDays', header: t('cycle.colGoodDays'), align: 'right',
      render: cycle => (
        <span className="inline-flex flex-col items-end tabular-nums">
          {percent(cycle.health?.good_days_pct ?? null)}
          {cycle.status !== 'OPEN' && cycle.incomplete && <span className="text-xs text-safetyOrange">{t('cycle.incomplete')}</span>}
        </span>
      ),
    },
    { key: 'status', header: t('cycle.colStatus'), align: 'center', render: cycle => <Badge tone={STATUS_TONE[cycle.status]}>{t(`cycleStatus.${cycle.status}`)}</Badge> },
  ];

  // Tải → khung chờ; lỗi → báo kèm Thử lại; còn lại là bảng (rỗng thì bảng tự hiện khung rỗng)
  let body = (
    <FixedRowsTable
      columns={columns}
      rows={cycles}
      getRowKey={cycle => cycle._id}
      onRowClick={setSelected}
      rowHeight={ROW_HEIGHT}
      pageSize={PAGE_SIZE}
      emptyNotice={t('cycle.emptyTitle')}
      emptyContent={<TableEmptyState title={t('cycle.emptyTitle')} description={t('cycle.emptyDesc')} />}
      serverPagination={{ page, total, onChange: setPage }}
      mobileCard={cycle => (
        <div className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-body font-semibold text-charcoal">{placeByZone.get(cycle.zone_id) ?? NO_VALUE}</p>
            <Badge tone={STATUS_TONE[cycle.status]}>{t(`cycleStatus.${cycle.status}`)}</Badge>
          </div>
          <p className="text-small text-warmGray tabular-nums">{period(cycle)}</p>
          {cycle.closing_harvest && (
            <p className="text-small text-graphite tabular-nums">
              {t('cycle.yield', { nests: num(cycle.closing_harvest.nest_count), kg: kilograms(cycle.closing_harvest.weight_grams) })}
            </p>
          )}
        </div>
      )}
    />
  );
  if (isLoading) body = <LoadingSkeleton count={3} className="h-12 w-full" />;
  if (isError) {
    body = (
      <div className="py-8">
        <TableEmptyState title={t('cycle.errorTitle')} description={apiErrorMessage(error)} />
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('page.retry')}</Button>
        </div>
      </div>
    );
  }

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">{t('cycle.title')}</h2>
        <p className="mt-1 text-sm text-warmGray">{t('cycle.subtitle')}</p>
      </div>

      {body}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? t('cycle.detailTitle', { period: period(selected) }) : undefined}
      >
        {selected && (
          // Drawer không tự cuộn — vùng cuộn đặt ở đây như HealthDayDrawer
          <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex min-w-0 items-center gap-2 text-h2 text-charcoal">
                <HouseIcon size={24} weight="bold" className="shrink-0" aria-hidden />
                <span className="truncate">{placeByZone.get(selected.zone_id) ?? NO_VALUE}</span>
              </h3>
              <Badge tone={STATUS_TONE[selected.status]}>{t(`cycleStatus.${selected.status}`)}</Badge>
            </div>

            <Section title={t('cycle.closing')}>
              <p className="text-charcoal">
                {selected.closing_harvest
                  ? t('cycle.closingValue', {
                    nests: num(selected.closing_harvest.nest_count),
                    kg: kilograms(selected.closing_harvest.weight_grams),
                    date: date(selected.closing_harvest.date),
                  })
                  : t('cycle.notClosed')}
              </p>
            </Section>

            {selected.comparison && (
              <Section title={t('cycle.comparison')}>
                <div className="grid grid-cols-2 gap-3">
                  <ComparisonItem label={t('cycle.previous')} comparison={selected.comparison.previous} t={t} format={value => exact(value, 1)} />
                  <ComparisonItem label={t('cycle.lastYear')} comparison={selected.comparison.same_period_last_year} t={t} format={value => exact(value, 1)} />
                </div>
              </Section>
            )}

            {selected.status !== 'OPEN' && (
              <Section title={t('cycle.health')}>
                <dl className="divide-y divide-warmGray/10">
                  <Row label={t('cycle.goodDays')} value={percent(selected.health?.good_days_pct ?? null)} />
                  <Row label={t('cycle.returnRate')} value={percent(selected.health?.return_rate_avg ?? null)} />
                  <Row label={t('cycle.timeInRange')} value={percent(selected.health?.time_in_range_pct ?? null)} />
                  <Row label={t('cycle.completeness')} value={percent(selected.completeness_pct)} />
                </dl>
                {selected.incomplete && <p className="mt-2 text-xs text-safetyOrange">{t('cycle.incompleteNote')}</p>}
              </Section>
            )}

            <Section title={t('cycle.conclusion')}>
              {selected.conclusion ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-warmGray">
                    {t('cycle.conclusionBy', {
                      role: t(selected.conclusion.role === 'DOMAIN_EXPERT' ? 'cycle.roleExpert' : 'cycle.roleOwner'),
                      date: date(selected.conclusion.at),
                    })}
                  </p>
                  <p className="whitespace-pre-line border-l-2 border-warmGray/30 pl-3 text-charcoal">{selected.conclusion.text}</p>
                  {selected.conclusion.recommendations && (
                    <>
                      <p className="mt-1 text-sm font-bold text-charcoal">{t('cycle.recommendations')}</p>
                      <p className="whitespace-pre-line border-l-2 border-warmGray/30 pl-3 text-charcoal">{selected.conclusion.recommendations}</p>
                    </>
                  )}
                </div>
              ) : (
                <p className="italic text-warmGray">{t('cycle.noConclusion')}</p>
              )}
            </Section>
          </div>
        )}
      </Drawer>
    </Card>
  );
}

// Thay đổi % có dấu: tăng xanh, giảm đỏ; không so được thì "_"
function Change({ value, format }: { value: number | null; format: (value: number) => string }): JSX.Element {
  if (value === null) return <span className="text-warmGray">{NO_VALUE}</span>;
  return (
    <span className={cn('font-semibold tabular-nums', value >= 0 ? 'text-success' : 'text-alertRed')}>
      {value > 0 ? '+' : ''}{format(value)}%
    </span>
  );
}

function ComparisonItem({ label, comparison, t, format }: {
  label: string;
  comparison: HarvestCycleComparison | null;
  t: HarvestTranslate;
  format: (value: number) => string;
}): JSX.Element {
  const signed = (value: number | null) => (value === null ? NO_VALUE : `${value > 0 ? '+' : ''}${format(value)}`);
  return (
    <div className="rounded-2xl border border-warmGray/15 px-3 py-2.5">
      <p className="text-xs text-warmGray">{label}</p>
      {comparison?.cycle_id ? (
        <div className="mt-1 flex flex-col gap-0.5">
          <Change value={comparison.nest_count_change_pct} format={format} />
          <span className="text-xs text-warmGray">{t('cycle.changeWeight', { change: signed(comparison.weight_change_pct) })}</span>
        </div>
      ) : (
        <p className="mt-1 text-xs italic text-warmGray">{t('cycle.noCompare')}</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section>
      <p className="mb-2 text-sm font-bold text-charcoal">{title}</p>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-warmGray">{label}</dt>
      <dd className="font-semibold tabular-nums text-charcoal">{value}</dd>
    </div>
  );
}
