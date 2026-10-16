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
 *  2. Đường "Tỉ lệ đúng hạn SLA" theo ngày (đen khi đạt; đoạn + chấm đỏ, nền đỏ nhạt khi dưới mục tiêu) + vạch đen nét đứt mục tiêu 80% (cùng mục tiêu ô KPI trang Ticket).
 * Màu 2 series: cam hệ thống climateOrange #ED8F50 (Ticket mới) / xanh lá limeBright #D2F93A (Đã đóng) — cùng cặp màu biểu đồ chim của Farm Owner. Cả 2 nhạt, tương phản thấp trên nền trắng
 * nên luôn kèm chú thích + số tổng ở đầu biểu đồ (không để màu là cách đọc duy nhất).
 */

// ── FAKE DATA (endpoint MISSING) ─────────────────────────────────────────────────────────────────────────────────
// Backend chưa có endpoint xu hướng ticket theo ngày / tỉ lệ đúng hạn SLA theo ngày (đã báo backend). Không có cờ bật
// tay: số liệu giả LUÔN kèm dòng "This data is FAKE…" (FE_Design §5.4) nên không thể lọt lên như dữ liệu thật. Có
// endpoint thì thay fakeSeries() bằng hook gọi API và xoá cả khối này cùng FakeNotice.
/** Số giả nhưng ổn định: cùng ngày + cùng hạt giống luôn ra cùng số */
const pseudo = (seed: number) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x) }
function fakeSeries(days: number) {
  const DAY = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
  const today = Math.floor(Date.now() / 86_400_000)
  const series = Array.from({ length: days }, (_, i) => {
    const day = today - (days - 1 - i)
    const created = 3 + Math.round(pseudo(day) * 7)
    const closed = 2 + Math.round(pseudo(day + 0.5) * 7)
    const onTime = Math.round(68 + pseudo(day + 0.25) * 30)
    return { label: DAY.format(new Date(day * 86_400_000)), created, closed, onTime }
  })
  // Ngày nhiều ticket mới nhất đẩy lên 10 — để xem cột cao nhất trông thế nào
  const peak = series.reduce((top, d) => (d.created > top.created ? d : top), series[0])
  peak.created = 10
  return series
}
const FakeNotice = () => <p className="text-[11px] font-medium italic text-warmGray">This data is FAKE and has not been MOCKAPI</p>
// ── HẾT FAKE DATA ──────────────────────────────────────────────────────────────────────────────────────────────────

const SLA_TARGET = 80

/**
 * Biểu đồ SLA: đạt mục tiêu = đen bình thường (không tô nền); dưới mục tiêu = đoạn đường + chấm đỏ, nền giữa đường và
 * vạch 80% tô đỏ nhạt — chỉ chỗ có vấn đề nổi lên. Vạch mục tiêu nét đứt + nhãn 80% đậm màu đen
 */
const COLOR_MET = CHART_COLORS.charcoal
/** Chấm ngày đạt mục tiêu — xanh lá nhạt, cùng màu cột "Đã đóng" (đường vẫn đen) */
const COLOR_MET_DOT = CHART_COLORS.limeBright
const COLOR_MISSED = CHART_COLORS.alertRed
const FILL_MISSED = 'rgba(213,63,53,0.10)'
/** Vạch mục tiêu 80% nét đứt màu đen; nhãn "80%" trên trục Y in đậm đen */
const COLOR_TARGET = CHART_COLORS.charcoal
const COLOR_TARGET_TICK = CHART_COLORS.charcoal
const COLOR_CREATED = CHART_COLORS.climateOrange // cùng cam dashboard Farm Owner (chấm "Đỉnh chim về tổ")
const COLOR_CLOSED = CHART_COLORS.limeBright // cùng xanh lá dashboard Farm Owner (chấm "Đỉnh chim xuất đàn")
const RANGES = [{ key: 7, label: '7 ngày' }, { key: 30, label: '30 ngày' }] as const

/**
 * Ô chú thích: chấm tròn màu + tên + số tổng sát nhau (cùng kiểu chú thích biểu đồ chim của Farm Owner) — chấm, tên,
 * số dính thành 1 cụm để đọc rõ số nào của màu nào; chữ mang màu chữ, không mang màu series
 */
function LegendItem({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      {dashed
        ? <span className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: color }} />
        : <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {/* Chữ đen, độ đậm nhẹ như chú thích biểu đồ chim của Farm Owner (LegendDot); số đậm vừa */}
      <span className="text-small text-charcoal">{t(label)}</span>
      <span className="ml-0.5 text-small font-semibold text-charcoal">{value}</span>
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
      // grace: chừa ~15% phía trên — cột cao nhất không chạm mép khung, trục tự giãn theo số thật
      y: { ...baseChartOptions.scales.y, beginAtZero: true, grace: '15%', ticks: { ...baseChartOptions.scales.y.ticks, precision: 0 } },
    },
  } as ChartOptions<'bar'>

  const lineOptions = {
    ...baseChartOptions,
    scales: {
      ...baseChartOptions.scales,
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, maxTicksLimit: days === 7 ? 7 : 10 } },
      y: {
        ...baseChartOptions.scales.y, min: 0, max: 100,
        ticks: {
          ...baseChartOptions.scales.y.ticks, stepSize: 20, callback: (v: number | string) => `${v}%`,
          // Nhãn đúng mức mục tiêu nổi lên: đậm đen; các mức khác giữ xám mặc định. Chart.js cũng gọi 2 hàm này lúc
          // đo trục (chưa có `tick`) — phải dùng `?.`, nếu không sẽ lỗi và trắng cả trang
          color: (c: { tick?: { value: number } }) => (c.tick?.value === SLA_TARGET ? COLOR_TARGET_TICK : CHART_COLORS.warmGray),
          font: (c: { tick?: { value: number } }) => ({
            ...baseChartOptions.scales.y.ticks.font, weight: c.tick?.value === SLA_TARGET ? 'bold' : 'normal',
          }),
        },
      },
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
      <FakeNotice />
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Biểu đồ 1: ticket mới vs đã đóng */}
        <section className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 p-4">
          <div>
            <h3 className="text-body font-semibold text-charcoal">{t('Ticket mới và đã đóng')}</h3>
            <p className="text-xs text-warmGray">
              {totalClosed >= totalCreated ? t('Xử lý kịp lượng ticket mới') : t('Ticket mới nhiều hơn số đã đóng — tồn đọng tăng')}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
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
              {t('Trung bình {{n}}%', { n: avgOnTime })} · {daysBelow ? t('{{n}} ngày dưới mục tiêu {{target}}%', { n: daysBelow, target: SLA_TARGET }) : t('Mọi ngày đều đạt mục tiêu')}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <LegendItem color={COLOR_MET_DOT} label="Đạt mục tiêu" value={t('{{n}} ngày', { n: series.length - daysBelow })} />
            <LegendItem color={COLOR_MISSED} label="Dưới mục tiêu" value={t('{{n}} ngày', { n: daysBelow })} />
            <LegendItem color={COLOR_TARGET} label="Mục tiêu" value={`${SLA_TARGET}%`} dashed />
          </div>
          <div className="h-56">
            <Line
              options={lineOptions}
              data={{
                labels,
                datasets: [
                  {
                    label: t('Đúng hạn'), data: series.map(d => d.onTime),
                    // Đoạn đường đen khi đạt (chấm xanh lá), đỏ khi dưới mục tiêu (chấm đỏ); phần dưới vạch 80% tô đỏ nhạt (trên vạch không tô)
                    borderColor: COLOR_MET,
                    segment: {
                      borderColor: ctx => ((ctx.p0.parsed.y ?? 0) + (ctx.p1.parsed.y ?? 0)) / 2 >= SLA_TARGET ? COLOR_MET : COLOR_MISSED,
                    },
                    fill: { target: { value: SLA_TARGET }, above: 'transparent', below: FILL_MISSED },
                    pointBackgroundColor: series.map(d => (d.onTime >= SLA_TARGET ? COLOR_MET_DOT : COLOR_MISSED)),
                    borderWidth: 2, tension: 0.3, pointRadius: days === 7 ? 6 : 3, pointHoverRadius: 8,
                    pointBorderColor: '#FFFFFF', pointBorderWidth: 2,
                  },
                  {
                    label: t('Mục tiêu'), data: series.map(() => SLA_TARGET),
                    borderColor: COLOR_TARGET, borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 0,
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
