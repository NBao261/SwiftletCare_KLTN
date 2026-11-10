// DisagreementsSection.tsx — Màn hình Chuyên gia xem các ngày đánh giá lệch, độ đồng thuận & chỉnh mức chỉ số sức khỏe của nhà (EXPERT-FR-022, ANALYTICS-FR-014, BR-28)

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Building2,
  BarChart3,
} from 'lucide-react';
import HealthLevelsModal from '@/components/features/farm-owner/health/HealthLevelsModal';
import {
  shiftDate,
  vietnamDate,
} from '@/components/features/farm-owner/health/healthDay.utils';
import DisagreementDayCard from '@/components/features/domain-expert/reports/DisagreementDayCard';
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
import { useZoneStore } from '@/stores/zoneStore';
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

export default function DisagreementsSection() {
  const { t, date } = useTranslation(healthDict);
  const apiErrorMessage = useApiErrorMessage();

  const { selectedFarmId, selectedFarmName, selectedHouseId } = useZoneStore();
  const { data: farmHouses = [] } = useHouses(selectedFarmId ?? undefined);

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
    : (selectedFarmId ?? undefined);

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

  const { data: evaluation, refetch: refetchEvaluation } =
    useHealthEvaluation(queryParams);

  if (!selectedFarmId) {
    return (
      <div className="w-full max-w-screen-xl rounded-2xl border border-warmGray/20 bg-white p-8">
        <EmptyState
          icon={<Building2 className="h-8 w-8 text-warmGray" />}
          title="Chưa chọn trang trại"
          description="Vui lòng chọn một trang trại trên thanh giám sát SCADA phía trên để xem các ngày đánh giá lệch và cấu hình mức chỉ số sức khỏe của nhà yến."
        />
      </div>
    );
  }

  return (
    <div className="relative z-10 flex w-full max-w-screen-xl flex-col gap-5">
      {/* Khối 1: Thanh công cụ lọc gọn trên 1 hàng + Chỉ số Độ đồng thuận & Báo động giả (ANALYTICS-FR-014) */}
      <section className="flex w-full flex-col gap-4 rounded-2xl border border-warmGray/20 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Bên trái: Chọn phạm vi Toàn trang trại vs Nhà đang chọn */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              active={scopeMode === 'FARM' || !activeHouse}
              label={`Tất cả nhà · ${selectedFarmName || 'Trang trại'}`}
              onClick={() => setScopeMode('FARM')}
            />
            {activeHouse && (
              <FilterChip
                active={scopeMode === 'HOUSE'}
                label={`Nhà đang chọn · ${activeHouse.name}`}
                onClick={() => setScopeMode('HOUSE')}
              />
            )}
          </div>

          {/* Bên phải: Khoảng ngày + Ngày bắt đầu - kết thúc */}
          <div className="flex flex-wrap items-center gap-2">
            {DISAGREEMENT_RANGES.map((value) => (
              <FilterChip
                key={value}
                active={rangeDays === value}
                label={`${value} ngày`}
                onClick={() => setRangeDays(value)}
              />
            ))}
            <span className="ml-1 hidden font-mono text-xs tabular-nums text-warmGray xl:inline">
              ({date(from)} – {date(to)})
            </span>
          </div>
        </div>

        {/* Dải KPI Độ đồng thuận thực địa & Tỷ lệ báo động giả theo nguồn (GET /health-reports/evaluation) */}
        {evaluation && (
          <div className="grid grid-cols-2 gap-2.5 border-t border-warmGray/15 pt-3.5 sm:grid-cols-4 lg:grid-cols-6">
            <div className="flex flex-col justify-between rounded-xl border border-warmGray/15 bg-stone/25 px-3 py-2.5">
              <span className="text-[11px] font-medium text-warmGray">
                Số lượt đã chấm
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-base font-bold tabular-nums text-charcoal">
                  {evaluation.rated_count}
                </span>
                <span className="text-[11px] text-warmGray">
                  ({totalDays} ngày · {totalDisagreements} lượt lệch)
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-warmGray/15 bg-stone/25 px-3 py-2.5">
              <span className="text-[11px] font-medium text-warmGray">
                Độ đồng thuận (CI 95%)
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-base font-bold tabular-nums text-charcoal">
                  {formatRatePercent(evaluation.agreement?.value)}
                </span>
                {evaluation.agreement && (
                  <span className="font-mono text-[10px] tabular-nums text-warmGray">
                    {formatRatePercent(evaluation.agreement.ci_low)}–
                    {formatRatePercent(evaluation.agreement.ci_high)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-warmGray/15 bg-stone/25 px-3 py-2.5">
              <span className="text-[11px] font-medium text-warmGray">
                Kappa / Gwet&apos;s AC1
              </span>
              <div className="mt-1 flex items-baseline gap-1.5 font-mono text-sm font-bold tabular-nums text-charcoal">
                <span>κ {formatAgreementIndex(evaluation.weighted_kappa)}</span>
                <span className="text-warmGray">·</span>
                <span>AC1 {formatAgreementIndex(evaluation.gwet_ac1)}</span>
              </div>
            </div>

            <div className="col-span-2 flex flex-col justify-between rounded-xl border border-warmGray/15 bg-stone/25 px-3 py-2.5 sm:col-span-1 lg:col-span-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] font-medium text-warmGray">
                  <BarChart3 className="h-3 w-3" />
                  <span>Tỷ lệ báo động giả theo nguồn (khi thực địa chấm Tốt)</span>
                </span>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-charcoal">
                  Gộp: {formatRatePercent(evaluation.false_alarm_rate.combined)}
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
        )}
      </section>

      {/* Khối 2: Mức chỉ số sức khỏe hiện hành theo từng nhà yến (Bento 3 cột cân đối 100% chiều ngang) */}
      {houses.length > 0 && (
        <section className="flex w-full flex-col gap-3.5 rounded-2xl border border-warmGray/20 bg-white p-4 shadow-xs sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-charcoal sm:text-[15px]">
                Mức chỉ số sức khỏe hiện hành theo nhà yến
              </h2>
              <p className="text-xs text-warmGray">
                Ngưỡng phân loại từng chỉ số vào mức Lệch nhẹ hoặc Lệch rõ. Thay
                đổi sẽ lưu lịch sử kiểm toán và áp dụng từ lần đánh giá kế tiếp.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {houses.map((house) => (
              <div
                key={house.house_id}
                className="flex flex-col gap-3 rounded-xl border border-warmGray/20 bg-stone/20 p-3.5 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warmGray/15 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-warmGray/15 bg-white text-charcoal shadow-2xs">
                      <Building2 className="h-3.5 w-3.5" />
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
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Chỉnh mức chỉ số</span>
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
                      <Badge tone="warning">
                        Lệch nhẹ &lt; {house.health_levels.in_range_slight_pct}%
                      </Badge>
                      <Badge tone="critical">
                        Lệch rõ &lt; {house.health_levels.in_range_clear_pct}%
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
                      <Badge tone="warning">
                        Lệch nhẹ ≥ {house.health_levels.air_slight_h} giờ
                      </Badge>
                      <Badge tone="critical">
                        Lệch rõ ≥ {house.health_levels.air_clear_h} giờ
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
                      <Badge tone="warning">
                        Lệch nhẹ ≥ {house.health_levels.noise_slight} đợt
                      </Badge>
                      <Badge tone="critical">
                        Lệch rõ ≥ {house.health_levels.noise_clear} đợt
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Khối 3: Danh sách các ngày có đánh giá lệch */}
      <div className="flex w-full flex-col gap-4">
        {isLoading ? (
          <LoadingSkeleton count={2} className="h-56 w-full rounded-2xl" />
        ) : isError ? (
          <div className="rounded-2xl border border-warmGray/20 bg-white p-8">
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8 text-alertRed" />}
              title="Không tải được danh sách ngày đánh giá lệch"
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
          <div className="rounded-2xl border border-warmGray/20 bg-white px-6 py-10">
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8 text-emerald-600" />}
              title="Không có ngày đánh giá lệch trong giai đoạn này"
              description={
                evaluation && evaluation.rated_count > 0
                  ? `Tất cả ${evaluation.rated_count} lượt chấm thực địa trong ${rangeDays} ngày qua đều đồng thuận với trạng thái ảnh chụp của hệ thống.`
                  : 'Chưa phát sinh lượt chấm thực địa nào lệch với trạng thái ảnh chụp của hệ thống trong khoảng ngày đã chọn.'
              }
            />
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

      {/* Modal chỉnh mức chỉ số sức khỏe của nhà yến (tái sử dụng HealthLevelsModal chuẩn BR-28) */}
      {editingHouse && (
        <HealthLevelsModal
          open={Boolean(editingHouse)}
          onClose={() => {
            setEditingHouse(null);
            void refetch();
            void refetchEvaluation();
          }}
          house={editingHouse}
          canEdit={true}
          readOnlyNote={t('levels.readOnlyExpert')}
        />
      )}
    </div>
  );
}
