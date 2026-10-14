import { useMemo, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { SectionCard } from '@/components/ui'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'

/**
 * Card "Xu hướng ticket" trang Tổng quan — 2 biểu đồ RIÊNG (không gộp cột + đường 2 trục: 2 thang đo khác nhau
 * đặt chung 1 khung dễ đọc nhầm):
 *  1. Cột đôi "Ticket mới / Đã đóng" theo ngày — việc vào nhanh hơn hay xử lý nhanh hơn.
 *  2. Đường "Tỉ lệ đúng hạn SLA" theo ngày + vạch nét đứt mục tiêu 80% (cùng mục tiêu ô KPI trang Ticket).
 * Màu 2 series (cam #ED8F50 / xanh lime đậm #677E09) đã qua validator dataviz (lightness, chroma, mù màu); cam
 * tương phản < 3:1 trên nền trắng nên luôn kèm chú thích + số tổng ở đầu biểu đồ.
 */

// ── FAKE DATA — CHỈ ĐỂ XEM GIAO DIỆN ──────────────────────────────────────────────────────────────────────────────
// Backend chưa có endpoint xu hướng ticket theo ngày. Số liệu dưới đây sinh giả (cố định theo ngày, không đổi khi
// tải lại), kèm dòng "This data is FAKE…" (FE_Design §5.4). Thay bằng API thật trước khi nộp/demo thật.
const SHOW_FAKE_PREVIEW = true
/** Số giả nhưng ổn định: cùng ngày + cùng hạt giống luôn ra cùng số */
const pseudo = (seed: number) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x) }
function fakeSeries(days: number) {
  const DAY = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
  const today = Math.floor(Date.now() / 86_400_000)
  return Array.from({ length: days }, (_, i) => {
    const day = today - (days - 1 - i)
    const created = 3 + Math.round(pseudo(day) * 7)
    const closed = 2 + Math.round(pseudo(day + 0.5) * 7)
    const onTime = Math.round(68 + pseudo(day + 0.25) * 30)
    return { label: DAY.format(new Date(day * 86_400_000)), created, closed, onTime }
  })
}
const FakeNotice = () => <p className="text-[11px] font-medium italic text-warmGray">This data is FAKE and has not been MOCKAPI</p>
// ── HẾT FAKE DATA ──────────────────────────────────────────────────────────────────────────────────────────────────

const SLA_TARGET = 80
const COLOR_CREATED = CHART_COLORS.climateOrange
const COLOR_CLOSED = '#677E09' // lime-800
const RANGES = [{ key: 7, label: '7 ngày' }, { key: 30, label: '30 ngày' }] as const

/** Ô chú thích: chấm màu + tên + số tổng (chữ mang màu chữ, không mang màu series) */
function LegendItem({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {dashed
        ? <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
        : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
      <span className="text-small text-warmGray">{t(label)}</span>
      <span className="text-small font-semibold text-charcoal">{value}</span>
    </div>
  )
}

export default function TicketTrendsCard() {
  const [days, setDays] = useState<7 | 30>(7)
  const series = useMemo(() => fakeSeries(days), [days])
  const labels = series.map(d => d.label)
  const totalCreated = series.reduce((s, d) => s + d.created, 0)
  const totalClosed = series.reduce((s, d) => s + d.closed, 0)
  const avgOnTime = Math.round(series.reduce((s, d) => s + d.onTime, 0) / series.length)
  const daysBelow = series.filter(d => d.onTime < SLA_TARGET).length

  // Cột mảnh, bo 4px đầu cột (đáy dính trục), khe 2px giữa 2 cột cùng ngày
  const barOptions = {
    ...baseChartOptions,
    datasets: { bar: { borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', maxBarThickness: days === 7 ? 18 : 8, categoryPercentage: 0.7, barPercentage: 0.9 } },
    scales: {
      ...baseChartOptions.scales,
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, maxTicksLimit: days === 7 ? 7 : 10 } },
      y: { ...baseChartOptions.scales.y, beginAtZero: true, ticks: { ...baseChartOptions.scales.y.ticks, precision: 0 } },
    },
  } as ChartOptions<'bar'>

  const lineOptions = {
    ...baseChartOptions,
    scales: {
      ...baseChartOptions.scales,
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, maxTicksLimit: days === 7 ? 7 : 10 } },
      y: { ...baseChartOptions.scales.y, min: 0, max: 100, ticks: { ...baseChartOptions.scales.y.ticks, stepSize: 20, callback: (v: number | string) => `${v}%` } },
    },
    plugins: {
      ...baseChartOptions.plugins,
      tooltip: { ...baseChartOptions.plugins.tooltip, callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number } }) => ` ${c.dataset.label}: ${c.parsed.y}%` } },
    },
  } as ChartOptions<'line'>

  return (
    <SectionCard
      title="Xu hướng ticket"
      description="Số ticket mới, đã đóng và tỉ lệ đúng hạn SLA theo ngày"
      action={
        <div className="inline-flex gap-1 rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={t('Khoảng thời gian')}>
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={days === r.key}
              onClick={() => setDays(r.key)}
              className={cn(
                'h-9 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150',
                days === r.key ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
              )}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
      }
    >
      {SHOW_FAKE_PREVIEW && <FakeNotice />}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Biểu đồ 1: ticket mới vs đã đóng */}
        <section className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 p-4">
          <div>
            <h3 className="text-body font-semibold text-charcoal">{t('Ticket mới và đã đóng')}</h3>
            <p className="text-xs text-warmGray">
              {totalClosed >= totalCreated ? t('Xử lý kịp lượng ticket mới') : t('Ticket mới nhiều hơn số đã đóng — tồn đọng tăng')}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <LegendItem color={COLOR_CREATED} label="Ticket mới" value={String(totalCreated)} />
            <LegendItem color={COLOR_CLOSED} label="Đã đóng" value={String(totalClosed)} />
          </div>
          <div className="h-56">
            <Bar
              options={barOptions}
              data={{
                labels,
                datasets: [
                  { label: t('Ticket mới'), data: series.map(d => d.created), backgroundColor: COLOR_CREATED },
                  { label: t('Đã đóng'), data: series.map(d => d.closed), backgroundColor: COLOR_CLOSED },
                ],
              }}
            />
          </div>
        </section>

        {/* Biểu đồ 2: tỉ lệ đúng hạn SLA so với mục tiêu */}
        <section className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 p-4">
          <div>
            <h3 className="text-body font-semibold text-charcoal">{t('Tỉ lệ đúng hạn SLA')}</h3>
            <p className="text-xs text-warmGray">
              {daysBelow ? t('{{n}} ngày dưới mục tiêu {{target}}%', { n: daysBelow, target: SLA_TARGET }) : t('Mọi ngày đều đạt mục tiêu')}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <LegendItem color={CHART_COLORS.charcoal} label="Trung bình" value={`${avgOnTime}%`} />
            <LegendItem color={CHART_COLORS.warmGray} label="Mục tiêu" value={`${SLA_TARGET}%`} dashed />
          </div>
          <div className="h-56">
            <Line
              options={lineOptions}
              data={{
                labels,
                datasets: [
                  {
                    label: t('Đúng hạn'), data: series.map(d => d.onTime),
                    borderColor: CHART_COLORS.charcoal, backgroundColor: CHART_COLORS.charcoal,
                    borderWidth: 2, tension: 0.3, pointRadius: days === 7 ? 4 : 0, pointHoverRadius: 5,
                    pointBorderColor: '#FFFFFF', pointBorderWidth: 2,
                  },
                  {
                    label: t('Mục tiêu'), data: series.map(() => SLA_TARGET),
                    borderColor: CHART_COLORS.warmGray, borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 0,
                  },
                ],
              }}
            />
          </div>
        </section>
      </div>
    </SectionCard>
  )
}
