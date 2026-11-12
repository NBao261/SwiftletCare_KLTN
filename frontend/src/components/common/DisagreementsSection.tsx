// DisagreementsSection.tsx — Màn hình Chuyên gia xem các ngày đánh giá lệch, độ đồng thuận & chỉnh mức chỉ số sức khỏe của nhà (EXPERT-FR-022, ANALYTICS-FR-014, BR-28)

import { useState } from 'react';
import {
  AlertTriangle,
  SlidersHorizontal,
  Building2,
  BarChart3,
} from 'lucide-react';
import TableEmptyState from '@/components/common/TableEmptyState';
import HealthLevelsModal from '@/components/common/HealthLevelsModal';
import {
  shiftDate,
  vietnamDate,
} from '@/components/common/healthDay.utils';
import DisagreementDayCard from '@/components/common/DisagreementDayCard';
import {
  Badge,
  Button,
  EmptyState,
  FilterChip,
  LoadingSkeleton,
} from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import {
  useHealthDisagreements,
  useHealthEvaluation,
} from '@/hooks/domain-expert/useHealthDisagreements';
import { useHouses } from '@/hooks/shared/useFarms';
import type { HealthSource } from '@/types/healthDay.types';

const DISAGREEMENT_RANGES = [7, 14, 30, 90] as const;
type DisagreementRangeDays = (typeof DISAGREEMENT_RANGES)[number];

const FALSE_ALARM_SOURCES: HealthSource[] = [
  'environment',
  'air',
  'flock',
  'noise',
];

/**
 * Định dạng tỷ lệ 0..1 sang phần trăm (VD: 0.857 -> "85.7%"), null -> "—"
 */
export function formatRatePercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return NO_VALUE;
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Định dạng hệ số thống kê Kappa / Gwet's AC1 (VD: 0.742 -> "0.74"), null -> "—"
 */
export function formatAgreementIndex(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value))
    return NO_VALUE;
  return value.toFixed(2);
}

interface DisagreementsSectionProps {
  // Farm và nhà đang chọn ('' = chưa chọn): chuyên gia lấy từ thanh trên, Farm Owner (BR-22) từ khung lọc /health
  farmId: string;
  farmName: string;
  houseId: string;
}

export default function DisagreementsSection({ farmId: selectedFarmId, farmName: selectedFarmName, houseId: selectedHouseId }: DisagreementsSectionProps) {
  const { t, date } = useTranslation(healthDict);
  const apiErrorMessage = useApiErrorMessage();

  const { data: farmHouses = [] } = useHouses(selectedFarmId || undefined);

  const [rangeDays, setRangeDays] = useState<DisagreementRangeDays>(14);
  const [scopeMode, setScopeMode] = useState<'FARM' | 'HOUSE'>('FARM');
  const [editingHouse, setEditingHouse] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const activeHouse = farmHouses.find((h) => h._id === selectedHouseId);
  const effectiveHouseId =
    scopeMode === 'HOUSE' && activeHouse ? activeHouse._id : undefined;
  const effectiveFarmId = effectiveHouseId
    ? undefined
    : (selectedFarmId || undefined);

  const to = vietnamDate();
  const from = shiftDate(to, -(rangeDays - 1));

  const queryParams = {
    farmId: effectiveFarmId,
    houseId: effectiveHouseId,
    from,
    to,
  };

  const {
    days,
    houses,
    totalDays,
    totalDisagreements,
    isLoading,
    isError,
    error,
    refetch,
  } = useHealthDisagreements(queryParams);

  const {
    data: evaluation,
    isLoading: isLoadingEvaluation,
  } = useHealthEvaluation(queryParams);

  if (!selectedFarmId) {
    return (
      <div className="w-full max-w-screen-xl rounded-2xl border border-warmGray/20 bg-white p-8 [&_p]:text-balance">
        <EmptyState
          icon={<Building2 className="h-8 w-8 text-warmGray" />}
          title={t('dis.noFarmTitle')}
          description={t('dis.noFarmDesc')}
        />
      </div>
    );
  }

  return (
    <div className="relative z-10 flex w-full max-w-screen-xl flex-col gap-5">
      {/* Khối 1: Thanh công cụ lọc gọn trên 1 hàng + Chỉ số Độ đồng thuận & Báo động giả (ANALYTICS-FR-014) */}
      <section
        aria-label={t('dis.filters')}
        className="flex w-full flex-col gap-4 rounded-2xl border border-warmGray/20 bg-white p-4 shadow-xs sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nhóm 1: Chọn phạm vi Toàn trang trại vs Nhà đang chọn */}
            <div
              role="group"
              aria-label={t('dis.scope')}
              className="flex flex-wrap items-center gap-2"
            >
              <FilterChip
                active={scopeMode === 'FARM' || !activeHouse}
                label={t('dis.allHouses', { farm: selectedFarmName || t('dis.farm') })}
                onClick={() => setScopeMode('FARM')}
              />
              {activeHouse && (
                <FilterChip
                  active={scopeMode === 'HOUSE'}
                  label={t('dis.selectedHouse', { house: activeHouse.name })}
                  onClick={() => setScopeMode('HOUSE')}
                />
              )}
            </div>

            {/* Vách ngăn trực quan tách biệt nhóm Phạm vi và nhóm Khoảng ngày */}
            <span
              aria-hidden="true"
              className="hidden h-5 w-px bg-warmGray/25 sm:inline-block"
            />

            {/* Nhóm 2: Khoảng ngày tra cứu */}
            <div
              role="group"
              aria-label={t('dis.range')}
              className="flex flex-wrap items-center gap-2"
            >
              {DISAGREEMENT_RANGES.map((value) => (
                <FilterChip
                  key={value}
                  active={rangeDays === value}
                  label={t('dis.rangeDays', { n: value })}
                  onClick={() => setRangeDays(value)}
                />
              ))}
            </div>
          </div>

          {/* Khoảng ngày cụ thể — luôn hiển thị trên mọi kích thước màn hình */}
          <span className="font-mono text-xs tabular-nums text-warmGray">
            {t('dis.period', { from: date(from), to: date(to) })}
          </span>
        </div>

        {/* Dải KPI Độ đồng thuận thực địa & Tỷ lệ báo động giả theo nguồn (GET /health-reports/evaluation) */}
        {isLoadingEvaluation && !evaluation ? (
          <div
            role="status"
            aria-live="polite"
            aria-label={t('dis.loading')}
            className="grid grid-cols-2 gap-2.5 border-t border-warmGray/15 pt-3.5 sm:grid-cols-3 lg:grid-cols-6"
          >
            <LoadingSkeleton count={2} className="h-16 w-full rounded-xl" />
            <LoadingSkeleton
              count={1}
              className="col-span-2 h-16 w-full rounded-xl sm:col-span-1"
            />
            <LoadingSkeleton
              count={1}
              className="col-span-2 h-16 w-full rounded-xl sm:col-span-3 lg:col-span-3"
            />
          </div>
        ) : evaluation ? (
          <div className="grid grid-cols-2 gap-2.5 border-t border-warmGray/15 pt-3.5 sm:grid-cols-3 lg:grid-cols-6">
            <div className="flex flex-col justify-between rounded-xl border border-warmGray/15 bg-stone/25 px-3 py-2.5">
              <span className="text-[11px] font-medium text-warmGray">
                {t('dis.ratedCount')}
              </span>
              <div className="mt-1 flex flex-col">
                <span className="font-mono text-lg font-bold leading-tight tabular-nums text-charcoal">
                  {evaluation.rated_count}
                </span>
                <span className="mt-0.5 text-[11px] text-warmGray">
                  {t('dis.ratedSub', { days: totalDays, n: totalDisagreements })}
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-warmGray/15 bg-stone/25 px-3 py-2.5">
              <span className="text-[11px] font-medium text-warmGray">
                {t('dis.agreement')}
              </span>
              <div className="mt-1 flex flex-col">
                <span className="font-mono text-lg font-bold leading-tight tabular-nums text-charcoal">
                  {formatRatePercent(evaluation.agreement?.value)}
                </span>
                <span className="mt-0.5 font-mono text-[11px] tabular-nums text-warmGray">
                  {evaluation.agreement
                    ? `${formatRatePercent(evaluation.agreement.ci_low)} – ${formatRatePercent(evaluation.agreement.ci_high)}`
                    : t('dis.noCi')}
                </span>
              </div>
            </div>

            <div className="col-span-2 flex flex-col justify-between rounded-xl border border-warmGray/15 bg-stone/25 px-3 py-2.5 sm:col-span-1 lg:col-span-1">
              <span className="text-[11px] font-medium text-warmGray">
                Kappa / Gwet&apos;s AC1
              </span>
              <div className="mt-1 flex flex-col">
                <div className="flex items-baseline gap-1.5 font-mono text-sm font-bold leading-tight tabular-nums text-charcoal">
                  <span>κ {formatAgreementIndex(evaluation.weighted_kappa)}</span>
                  <span className="text-warmGray">·</span>
                  <span>AC1 {formatAgreementIndex(evaluation.gwet_ac1)}</span>
                </div>
                <span className="mt-0.5 text-[11px] text-warmGray">
                  {t('dis.kappaHint')}
                </span>
              </div>
            </div>

            <div className="col-span-2 flex flex-col justify-between rounded-xl border border-warmGray/15 bg-stone/25 px-3 py-2.5 sm:col-span-3 lg:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] font-medium text-warmGray">
                  <BarChart3 className="h-3 w-3" aria-hidden="true" />
                  <span>{t('dis.falseAlarm')}</span>
                </span>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-charcoal">
                  {t('dis.combined', { value: formatRatePercent(evaluation.false_alarm_rate.combined) })}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {FALSE_ALARM_SOURCES.map((source) => (
                  <div
                    key={source}
                    className="flex items-center justify-between rounded-lg border border-warmGray/10 bg-white px-2 py-1 text-[11px]"
                  >
                    <span className="text-warmGray">{t(`source.${source}`)}</span>
                    <span className="font-mono font-bold tabular-nums text-charcoal">
                      {formatRatePercent(evaluation.false_alarm_rate[source])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Khối 2: Mức chỉ số sức khỏe hiện hành theo từng nhà yến (Bento 3 cột cân đối 100% chiều ngang) */}
      <section
        aria-label={t('dis.levelsTitle')}
        className="flex w-full flex-col gap-3.5 rounded-2xl border border-warmGray/20 bg-white p-4 shadow-xs sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-charcoal sm:text-[15px]">
              {t('dis.levelsTitle')}
            </h2>
            <p className="text-xs text-warmGray">
              {t('levels.intro')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label={t('dis.loading')}
          >
            <LoadingSkeleton count={1} className="h-32 w-full rounded-xl" />
          </div>
        ) : houses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-warmGray/30 bg-stone/15 px-4 py-6 text-center text-xs text-warmGray text-balance">
            {t('dis.noHouses')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {houses.map((house) => (
              <div
                key={house.house_id}
                id={`house-levels-${house.house_id}`}
                className="flex flex-col gap-3 rounded-xl border border-warmGray/20 bg-stone/20 p-3.5 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warmGray/15 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-warmGray/15 bg-white text-charcoal shadow-2xs">
                      <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-bold text-charcoal">
                      {house.house_name}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setEditingHouse({
                        id: house.house_id,
                        name: house.house_name,
                      })
                    }
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('dis.editLevels')}</span>
                  </Button>
                </div>

                {/* 3 Cột Bento ngang hiển thị rõ ngưỡng Lệch nhẹ (cam) và Lệch rõ (đỏ) */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {/* Cột 1: Môi trường */}
                  <div className="flex flex-col justify-between gap-2 rounded-xl border border-warmGray/15 bg-white p-3">
                    <div>
                      <p className="text-xs font-bold text-charcoal">
                        {t('levels.environment')}
                      </p>
                      <p className="text-[11px] text-warmGray">
                        {t('levels.environmentHint')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge tone="warning" className="font-mono tabular-nums">
                        {t('level.SLIGHT')} &lt; {house.health_levels.in_range_slight_pct} {t('levels.unit.environment')}
                      </Badge>
                      <Badge tone="critical" className="font-mono tabular-nums">
                        {t('level.CLEAR')} &lt; {house.health_levels.in_range_clear_pct} {t('levels.unit.environment')}
                      </Badge>
                    </div>
                  </div>

                  {/* Cột 2: Không khí */}
                  <div className="flex flex-col justify-between gap-2 rounded-xl border border-warmGray/15 bg-white p-3">
                    <div>
                      <p className="text-xs font-bold text-charcoal">
                        {t('levels.air')}
                      </p>
                      <p className="text-[11px] text-warmGray">
                        {t('levels.airHint')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge tone="warning" className="font-mono tabular-nums">
                        {t('level.SLIGHT')} ≥ {house.health_levels.air_slight_h} {t('levels.unit.air')}
                      </Badge>
                      <Badge tone="critical" className="font-mono tabular-nums">
                        {t('level.CLEAR')} ≥ {house.health_levels.air_clear_h} {t('levels.unit.air')}
                      </Badge>
                    </div>
                  </div>

                  {/* Cột 3: Tiếng ồn */}
                  <div className="flex flex-col justify-between gap-2 rounded-xl border border-warmGray/15 bg-white p-3">
                    <div>
                      <p className="text-xs font-bold text-charcoal">
                        {t('levels.noise')}
                      </p>
                      <p className="text-[11px] text-warmGray">
                        {t('levels.noiseHint')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge tone="warning" className="font-mono tabular-nums">
                        {t('level.SLIGHT')} ≥ {house.health_levels.noise_slight} {t('levels.unit.noise')}
                      </Badge>
                      <Badge tone="critical" className="font-mono tabular-nums">
                        {t('level.CLEAR')} ≥ {house.health_levels.noise_clear} {t('levels.unit.noise')}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Khối 3: Danh sách các ngày có đánh giá lệch */}
      <div className="flex w-full flex-col gap-4">
        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label={t('dis.loading')}
            className="flex w-full flex-col gap-4"
          >
            <LoadingSkeleton count={2} className="h-56 w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-warmGray/20 bg-white p-8 [&_p]:text-balance">
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8 text-alertRed" />}
              title={t('dis.errorTitle')}
              description={apiErrorMessage(error)}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void refetch()}
                >
                  {t('page.retry')}
                </Button>
              }
            />
          </div>
        ) : days.length === 0 ? (
          // Cùng khung rỗng của bảng ngày ở /health: thẻ trắng, viền đứt, hình minh hoạ TableEmptyState
          <div className="rounded-2xl border border-warmGray/20 bg-white p-5 shadow-xs sm:p-6">
            {/* pt-20: vòng tròn ngoài của hình minh hoạ lố khung 40px phía trên, để trên dưới đều chừa 40px */}
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 pb-10 pt-20">
              <TableEmptyState
                title={t('dis.emptyTitle')}
                description={
                  evaluation && evaluation.rated_count > 0
                    ? t('dis.emptyAllAgree', { n: evaluation.rated_count, days: rangeDays })
                    : t('dis.emptyNone')
                }
              />
            </div>
          </div>
        ) : (
          days.map((day) => (
            <DisagreementDayCard
              key={day.day_id}
              day={day}
              onEditLevels={(house) => setEditingHouse(house)}
            />
          ))
        )}
      </div>

      {/* Popup mức chỉ số dùng chung với Farm Owner; quyền sửa theo can_edit của backend (BR-28, BR-22) */}
      {editingHouse && (
        <HealthLevelsModal
          open
          onClose={() => {
            setEditingHouse(null);
            void refetch();
          }}
          house={editingHouse}
          readOnlyNote={t('levels.readOnlyExpert')}
        />
      )}
    </div>
  );
}
