import { TrendingUp } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * Điểm tổng hợp "sức khỏe môi trường" — không có công thức backend nào cộng
 * gộp 6 chỉ số môi trường thành 1 điểm /100 (ENV-FR-* chỉ có ngưỡng từng chỉ
 * số riêng lẻ). Giữ hằng số minh hoạ, khai rõ bằng dòng ghi chú italic bên dưới —
 * không suy diễn công thức thật khi chưa có yêu cầu nghiệp vụ cho nó.
 */
const MOCK_ECO_SCORE = 94
const MOCK_TREND_PERCENT = 4.2

function scoreBadge(score: number): { label: string; tone: 'positive' | 'warning' | 'critical' } {
  if (score >= 90) return { label: 'Rất tối ưu', tone: 'positive' }
  if (score >= 75) return { label: 'Tối ưu', tone: 'positive' }
  if (score >= 60) return { label: 'Cần chú ý', tone: 'warning' }
  return { label: 'Cảnh báo', tone: 'critical' }
}

interface EcoHealthCardProps {
  humidity?: number
  temperature?: number
  nh3?: number
  humidityAnomaly?: boolean
  temperatureAnomaly?: boolean
  nh3Anomaly?: boolean
}

/** "Chỉ số sinh thái tổ" — card trái Dashboard (screenshot mục 1). */
export default function EcoHealthCard({
  humidity, temperature, nh3, humidityAnomaly, temperatureAnomaly, nh3Anomaly,
}: EcoHealthCardProps) {
  const badge = scoreBadge(MOCK_ECO_SCORE)

  return (
    <Card size="lg" className="flex h-full flex-col gap-5">
      <p className="label-caption">Chỉ số sinh thái tổ</p>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h2 text-charcoal">Sức khỏe môi trường</h2>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <p className="leading-none">
            <span className="text-[44px] font-extrabold tracking-tight text-charcoal">{MOCK_ECO_SCORE}</span>
            <span className="ml-1 text-base font-semibold text-warmGray">/100</span>
          </p>
          <Badge tone="positive">
            <TrendingUp width={12} height={12} />
            +{MOCK_TREND_PERCENT}% tuần này
          </Badge>
        </div>
        <p className="mt-2 text-[11px] font-medium italic text-warmGray">
          Điểm tổng hợp minh hoạ — chưa có công thức backend
        </p>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-warmGray/10 pt-4">
        <MetricRow label="Độ ẩm duy trì" value={humidity} unit="%" isAnomaly={humidityAnomaly} />
        <MetricRow label="Nhiệt độ trung bình" value={temperature} unit="°C" isAnomaly={temperatureAnomaly} />
        <MetricRow label="Nồng độ khí NH3" value={nh3} unit="ppm" isAnomaly={nh3Anomaly} flagWhenAnomaly="Cảnh giác" />
      </div>
    </Card>
  )
}

function MetricRow({
  label, value, unit, isAnomaly, flagWhenAnomaly,
}: {
  label: string
  value?: number
  unit: string
  isAnomaly?: boolean
  flagWhenAnomaly?: string
}) {
  const hasValue = value !== undefined && !Number.isNaN(value)
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 text-warmGray">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', isAnomaly ? 'bg-climateOrange' : 'bg-success')} />
        {label}
      </span>
      <span className="flex items-center gap-1.5 font-bold text-charcoal">
        {hasValue ? `${value.toFixed(1)} ${unit}` : '--'}
        {isAnomaly && flagWhenAnomaly && (
          <span className="text-xs font-semibold text-climateOrange">{flagWhenAnomaly}</span>
        )}
      </span>
    </div>
  )
}
