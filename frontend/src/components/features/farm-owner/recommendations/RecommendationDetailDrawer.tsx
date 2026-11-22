import { useMemo, type ReactNode } from 'react';
import { Chart } from 'react-chartjs-2';
import { BarController, Chart as ChartJS, LineController, type ChartData, type ChartOptions } from 'chart.js';

import { CHART_LEGEND, axisTitle } from '@/components/features/farm-owner/analytics/analytics.constants';
import { RECOMMENDATION_STATUS_TONE, ruleOf } from '@/components/features/farm-owner/recommendations/recommendations.constants';
import { Badge, Button } from '@/components/ui';
import { Drawer } from '@/components/ui/Drawer';
import { NO_VALUE } from '@/constants/display';
import { recommendationsDict } from '@/constants/recommendations.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useRecommendationText } from '@/hooks/shared/useRecommendationText';
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme';
import type { Recommendation } from '@/types';

// Biểu đồ bằng chứng vẽ cột từng ngày kèm đường giá trị của luật
ChartJS.register(BarController, LineController);

// "2026-11-16" → "16/11"
const dayLabel = (day: string) => day.split('-').slice(1).reverse().join('/');

function DetailRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-warmGray">{label}</dt>
      <dd className="break-words text-small text-charcoal">{children}</dd>
    </div>
  );
}

// Có cải thiện, chưa cải thiện, hoặc thiếu số để so sánh
function EffectVerdict({ improved }: { improved: boolean | null }): JSX.Element {
  const { t } = useTranslation(recommendationsDict);
  if (improved === null) return <p className="text-small italic text-warmGray">{t('detail.effectMissing')}</p>;
  return <Badge tone={improved ? 'positive' : 'neutral'}>{t(improved ? 'detail.improved' : 'detail.notImproved')}</Badge>;
}

interface RecommendationDetailDrawerProps {
  recommendation: Recommendation | null;
  houseName: string;
  canDecide: boolean;
  onClose: () => void;
  onAccept: (recommendation: Recommendation) => void;
  onReject: (recommendation: Recommendation) => void;
}

// điều kiện, bằng chứng từng ngày, đề xuất, quyết định và hiệu quả sau 7 ngày
export default function RecommendationDetailDrawer({
  recommendation, houseName, canDecide, onClose, onAccept, onReject,
}: RecommendationDetailDrawerProps): JSX.Element {
  const { t, date, dateTime, exact } = useTranslation(recommendationsDict);
  const text = useRecommendationText();
  const rule = recommendation ? ruleOf(recommendation) : null;
  const evidence = recommendation?.evidence;

  const chartData = useMemo((): ChartData<'bar' | 'line'> => {
    const days = evidence?.days ?? [];
    return {
      labels: days.map(day => dayLabel(day.date)),
      datasets: [
        { type: 'bar', label: evidence ? t(`indicator.${evidence.indicator}`) : '', data: days.map(day => day.value), backgroundColor: CHART_COLORS.accentGreen, borderRadius: 6, maxBarThickness: 28 },
        { type: 'line', label: t('detail.limitLine'), data: days.map(() => evidence?.value ?? null), borderColor: CHART_COLORS.climateOrange, borderDash: [6, 4], borderWidth: 2, pointRadius: 0 },
      ],
    };
  }, [evidence, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: CHART_LEGEND },
    scales: { x: baseChartOptions.scales.x, y: { ...baseChartOptions.scales.y, min: 0, title: axisTitle(t('detail.evidenceAxis')) } },
  } as ChartOptions<'bar' | 'line'>), [t]);

  const effect = recommendation?.effect;
  const isOpen = recommendation?.status === 'OPEN';

  return (
    <Drawer open={Boolean(recommendation)} onClose={onClose} title={rule?.name ?? t('detail.title')}>
      {recommendation && evidence && (
        <>
          {/* Drawer không tự cuộn: vùng cuộn đặt ở đây, nút quyết định ở dưới cùng */}
          <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={RECOMMENDATION_STATUS_TONE[recommendation.status]}>{t(`status.${recommendation.status}`)}</Badge>
              <span className="text-caption text-warmGray">{t('detail.raisedFor', { date: date(recommendation.raised_for) })}</span>
            </div>

            <dl className="flex flex-col gap-3">
              <DetailRow label={t('detail.house')}>{houseName || NO_VALUE}</DetailRow>
              <DetailRow label={t('detail.condition')}>{text.condition(evidence)}</DetailRow>
              <DetailRow label={t('detail.action')}>{rule ? text.action(rule.action) : NO_VALUE}</DetailRow>
            </dl>
            {rule?.action.type === 'PARAMETER_CHANGE' && isOpen && <p className="text-caption text-warmGray">{t('detail.paramReview')}</p>}

            <section className="flex flex-col gap-2">
              <h3 className="text-h3 text-charcoal">{t('detail.evidence')}</h3>
              <p className="text-caption text-warmGray">{t('detail.evidenceHint')}</p>
              <div className="h-56">
                <Chart type="bar" data={chartData} options={chartOptions} />
              </div>
            </section>

            {recommendation.decided_at && (
              <section className="flex flex-col gap-2">
                <h3 className="text-h3 text-charcoal">{t('detail.decision')}</h3>
                <p className="text-small text-charcoal">{t('detail.decidedAt', { date: dateTime(recommendation.decided_at) })}</p>
                {recommendation.reject_reason && <DetailRow label={t('detail.rejectReason')}>{recommendation.reject_reason}</DetailRow>}
                {recommendation.work_order_id && <p className="text-small text-charcoal">{t('detail.workOrder')}</p>}
                {Boolean(recommendation.review_ids?.length) && (
                  <p className="text-small text-charcoal">{t('detail.reviews', { n: recommendation.review_ids?.length ?? 0 })}</p>
                )}
              </section>
            )}

            {effect && (
              <section className="flex flex-col gap-2">
                <h3 className="text-h3 text-charcoal">{t('detail.effect')}</h3>
                <dl className="grid grid-cols-3 gap-3">
                  <DetailRow label={t('detail.effectBefore')}>{effect.before === null ? NO_VALUE : exact(effect.before, 2)}</DetailRow>
                  <DetailRow label={t('detail.effectAfter')}>{effect.after === null ? NO_VALUE : exact(effect.after, 2)}</DetailRow>
                  <DetailRow label={t('detail.effectChange')}>{effect.change === null ? NO_VALUE : exact(effect.change, 2)}</DetailRow>
                </dl>
                <EffectVerdict improved={effect.improved} />
              </section>
            )}

            {isOpen && <p className="text-caption italic text-warmGray">{t('detail.expiresHint')}</p>}
          </div>

          {canDecide && isOpen && (
            <div className="-mx-6 -mb-5 flex shrink-0 items-center justify-end gap-3 border-t border-warmGray/10 px-6 py-3.5">
              <Button variant="secondary" size="sm" onClick={() => onReject(recommendation)}>{t('detail.reject')}</Button>
              <Button size="sm" onClick={() => onAccept(recommendation)}>{t('detail.accept')}</Button>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
