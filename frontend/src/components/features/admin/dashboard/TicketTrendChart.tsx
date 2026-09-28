import { useMemo, useRef, useState } from 'react'
import { Chart } from 'react-chartjs-2'
import {
  Chart as ChartJS, BarController, LineController,
  type ChartData, type ChartOptions, type Plugin, type ScriptableLineSegmentContext, type TooltipModel,
} from 'chart.js'
import { useAllTickets } from '@/hooks/admin/useAdminTickets'
import { useTicketKpi } from '@/hooks/shared/useTickets'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { formatDuration } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import type { Ticket, TicketPriority } from '@/types'

// Biểu đồ trộn cột + đường cần controller của cả 2 loại (chartTheme chỉ đăng ký element/scale)
ChartJS.register(BarController, LineController)

const DAYS = 7
const HOUR_MS = 3_600_000
/**
 * Mục tiêu cam kết SLA của card này — theo mẫu thiết kế "Xu hướng Ticket & Tuân thủ SLA" (90%). Lưu ý: ô KPI
 * trang Ticket/Cấu hình vẫn cảnh báo ở 80% (SLA_WARN_RATE) — chốt 1 con số thì đổi cả 2 chỗ.
 */
const SLA_TARGET = 90
/**
 * Technician "quá tải" = đang giữ từ ngần này ticket chưa đóng trở lên (chưa nhận + đang làm).
 * ponytail: SRS TICKET-FR-005 nói "> N ticket mở" nhưng chưa chốt N — hằng số tạm, chuyển sang cấu hình hệ thống khi SRS chốt.
 */
const OVERLOAD_OPEN_TICKETS = 10

const DAY_LABEL = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
/** Khoá ngày theo giờ VN — ticket tạo 23:30 ngày 1 không bị tính sang ngày 2 */
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })

type Tab = 'volume' | 'sla'
const TABS: { key: Tab; label: string }[] = [
  { key: 'volume', label: 'Số lượng Ticket' },
  { key: 'sla', label: 'Tỷ lệ tuân thủ SLA (%)' },
]

/** Ticket (có hạn xử lý) có trễ hạn không — đã đóng sau hạn, hoặc chưa đóng mà hạn đã qua */
function isLate(t: Ticket, now: number) {
  const due = new Date(t.sla_resolve_due_at!).getTime()
  return t.closed_at ? new Date(t.closed_at).getTime() > due : now > due
}

/** Đếm theo ngày (giờ VN) 7 ngày gần nhất từ toàn bộ ticket — backend không có endpoint xu hướng */
function useDailySeries(tickets: Ticket[] | undefined) {
  return useMemo(() => {
    const now = Date.now()
    const days = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (DAYS - 1 - i))
      return d
    })
    const index = new Map(days.map((d, i) => [DAY_KEY.format(d), i]))
    const zeros = () => new Array<number>(DAYS).fill(0)
    const created = zeros(), closed = zeros(), breached = zeros(), dueTotal = zeros(), dueOnTime = zeros()
    const breachedByPriority: Record<TicketPriority, number> = { P1: 0, P2: 0, P3: 0 }
    const at = (iso: string) => index.get(DAY_KEY.format(new Date(iso)))

    for (const t of tickets ?? []) {
      const ci = at(t.created_at)
      if (ci !== undefined) created[ci]++
      if (t.closed_at) {
        const di = at(t.closed_at)
        if (di !== undefined) closed[di]++
      }
      // SLA tính theo ngày TỚI HẠN xử lý; hạn chưa tới (hôm nay còn giờ) thì chưa tính đúng/trễ.
      // Ticket huỷ không tính — cùng định nghĩa với backend getKpi() (ô "Tỷ lệ đúng SLA" trong card này)
      if (!t.cancelled_at && t.sla_resolve_due_at && new Date(t.sla_resolve_due_at).getTime() <= now) {
        const si = at(t.sla_resolve_due_at)
        if (si !== undefined) {
          dueTotal[si]++
          if (isLate(t, now)) { breached[si]++; breachedByPriority[t.priority]++ }
          else dueOnTime[si]++
        }
      }
    }
    const rate = dueTotal.map((n, i) => (n > 0 ? Math.round((dueOnTime[i] / n) * 1000) / 10 : null))
    const labels = days.map((d, i) => (i === DAYS - 1 ? `Hôm nay (${DAY_LABEL.format(d)})` : DAY_LABEL.format(d)))
    return { labels, created, closed, breached, rate, dueTotal, dueOnTime, breachedByPriority }
  }, [tickets])
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const pct1 = (a: number, b: number) => Math.round((a / b) * 1000) / 10
/** Chọn màu theo tỉ lệ: dưới mục tiêu → `low`, còn lại (kể cả ngày không có số liệu) → `ok` */
const below = (low: string, ok: string) => (v: number | null) => (v != null && v < SLA_TARGET ? low : ok)

/**
 * Tab SLA: nhãn % trên từng điểm (7 điểm nên ghi đủ, như mẫu) — dưới mục tiêu thì chữ đỏ và đặt DƯỚI điểm để không
 * đè đường mục tiêu; + vạch đứt dọc từ điểm đang hover xuống trục x. Plugin nội bộ, không thêm chartjs-plugin-datalabels.
 */
const slaDecorations: Plugin<'bar'> = {
  id: 'slaDecorations',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart
    const points = chart.getDatasetMeta(0).data
    const values = chart.data.datasets[0].data as (number | null)[]
    ctx.save()
    const active = chart.getActiveElements()[0]
    if (active && active.datasetIndex === 0) {
      const v = values[active.index]
      ctx.strokeStyle = below(CHART_COLORS.alertRed, CHART_COLORS.charcoal)(v)
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(active.element.x, active.element.y)
      ctx.lineTo(active.element.x, chartArea.bottom)
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.font = '700 12px "Plus Jakarta Sans"'
    ctx.textAlign = 'center'
    points.forEach((point, i) => {
      const v = values[i]
      if (v == null) return
      const low = v < SLA_TARGET
      // Dưới mục tiêu → ghi dưới điểm, TRỪ khi điểm sát đáy (VD 0%): ghi dưới sẽ đè nhãn ngày của trục x → ghi lên trên
      const placeBelow = low && chartArea.bottom - point.y > 28
      ctx.fillStyle = low ? CHART_COLORS.alertRed : CHART_COLORS.charcoal
      ctx.textBaseline = placeBelow ? 'top' : 'bottom'
      ctx.fillText(`${v}%`, point.x, point.y + (placeBelow ? 10 : -10))
    })
    ctx.restore()
  },
}

interface TipState { index: number; x: number; y: number; flip: boolean }

/**
 * Card "Xu hướng Ticket & Tuân thủ SLA (7 ngày qua)" trang Tổng quan hệ thống — dựng theo mẫu thiết kế, 2 tab:
 * - Số lượng Ticket: cột Ticket mới (charcoal) + Ticket đã đóng (lime viền charcoal) + đường đứt đỏ "Vi phạm SLA"
 *   (ticket tới hạn trong ngày mà trễ). 1 trục duy nhất: số ticket.
 * - Tỷ lệ tuân thủ SLA: đường cong % theo ngày — đoạn/điểm/nhãn trục dưới mục tiêu tô đỏ, nhãn % từng điểm, điểm hôm
 *   nay tô đặc; đường đứt đỏ mục tiêu 90% (mốc 90% trên trục y tô đỏ). Tooltip tự vẽ (nền charcoal, badge đạt/chưa đạt,
 *   chênh lệch so với cam kết). Trục % riêng — tab riêng, không dual-axis.
 * Dưới biểu đồ 3 ô tóm tắt đổi theo tab (số liệu thật: /tickets/kpi + chính 7 ngày của biểu đồ).
 */
export default function TicketTrendChart() {
  const [tab, setTab] = useState<Tab>('volume')
  const [tip, setTip] = useState<TipState | null>(null)
  const { data: tickets, isLoading } = useAllTickets({})
  const { data: kpi } = useTicketKpi()
  const s = useDailySeries(tickets)

  const rate = kpi?.slaComplianceRate ?? null
  const overloaded = (kpi?.byTechnician ?? []).filter(t => t.total - t.closed >= OVERLOAD_OPEN_TICKETS)

  const dueSum = sum(s.dueTotal)
  const weekRate = dueSum > 0 ? pct1(sum(s.dueOnTime), dueSum) : null
  const daysWithData = s.rate.filter(v => v != null).length
  const daysMet = s.rate.filter(v => v != null && v >= SLA_TARGET).length
  const worstPriority = (Object.entries(s.breachedByPriority) as [TicketPriority, number][]).sort((a, b) => b[1] - a[1])[0]

  const tickFont = baseChartOptions.scales.y.ticks
  // data/options giữ ổn định (useMemo): đổi `tip` (tooltip HTML) chỉ render lại khung tooltip — nếu mỗi lần render tạo
  // object mới, react-chartjs-2 gọi chart.update() → Chart.js phát lại sự kiện chuột → tooltip gọi setTip lần nữa → lặp vô hạn.
  const volumeData = useMemo(() => ({
    labels: s.labels,
    datasets: [
      {
        type: 'bar' as const, label: 'Ticket mới', data: s.created, backgroundColor: CHART_COLORS.charcoal,
        borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom' as const, maxBarThickness: 16, order: 2,
      },
      {
        type: 'bar' as const, label: 'Ticket đã đóng', data: s.closed, backgroundColor: CHART_COLORS.limeBright,
        borderColor: CHART_COLORS.charcoal, borderWidth: 1,
        borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom' as const, maxBarThickness: 16, order: 2,
      },
      {
        type: 'line' as const, label: 'Vi phạm SLA', data: s.breached, borderColor: CHART_COLORS.alertRed, borderWidth: 2,
        borderDash: [4, 3], pointRadius: 4, pointBackgroundColor: CHART_COLORS.alertRed, pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2, tension: 0, order: 1,
      },
    ],
  }), [s])
  const slaData = useMemo(() => ({
    labels: s.labels,
    datasets: [
      {
        type: 'line' as const, label: 'Tỷ lệ đúng SLA (%)', data: s.rate, borderColor: CHART_COLORS.charcoal, borderWidth: 2.5,
        // Đoạn nối có 1 đầu dưới mục tiêu → đỏ
        segment: { borderColor: (ctx: ScriptableLineSegmentContext) => (Math.min(ctx.p0.parsed.y ?? 100, ctx.p1.parsed.y ?? 100) < SLA_TARGET ? CHART_COLORS.alertRed : undefined) },
        pointRadius: 6, pointHoverRadius: 8, pointBorderWidth: 2.5,
        pointBorderColor: s.rate.map(below(CHART_COLORS.alertRed, CHART_COLORS.charcoal)),
        // Điểm rỗng; riêng "hôm nay" tô đặc
        pointBackgroundColor: s.rate.map((v, i) => (i === DAYS - 1 ? below(CHART_COLORS.alertRed, CHART_COLORS.charcoal)(v) : '#FFFFFF')),
        // monotone: đường cong không vọt quá 100% / dưới 0%; clip 8px: điểm nằm đúng 0% hay 100% không bị cắt nửa
        spanGaps: true, tension: 0.4, cubicInterpolationMode: 'monotone' as const, clip: 8,
      },
      {
        type: 'line' as const, label: `Mục tiêu cam kết ${SLA_TARGET}%`, data: s.labels.map(() => SLA_TARGET),
        borderColor: CHART_COLORS.alertRed, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 0,
      },
    ],
  }), [s])

  // Callback tooltip đọc `s` mới nhất qua ref — options không phải tạo lại mỗi khi dữ liệu/tip đổi
  const rateRef = useRef(s.rate)
  rateRef.current = s.rate
  const onExternalTooltip = useRef(({ chart, tooltip }: { chart: ChartJS; tooltip: TooltipModel<'bar'> }) => {
    const point = tooltip.dataPoints?.find(p => p.datasetIndex === 0)
    if (tooltip.opacity === 0 || !point || rateRef.current[point.dataIndex] == null) {
      setTip(t => (t ? null : t))
      return
    }
    const i = point.dataIndex
    const el = chart.getDatasetMeta(0).data[i]
    setTip(t => (t && t.index === i ? t : { index: i, x: el.x, y: el.y, flip: el.x > chart.width * 0.6 }))
  }).current

  const options = useMemo(() => ({
    ...baseChartOptions,
    scales: {
      x: {
        ...baseChartOptions.scales.x,
        ticks: {
          ...baseChartOptions.scales.x.ticks,
          // Tab SLA: ngày dưới mục tiêu → nhãn trục x đỏ đậm
          // `?.` — Chart.js có lúc resolve font/color ở ngữ cảnh scale (không có index/tick); ném lỗi ở đây là sập cả trang
          color: (ctx: { index?: number }) => (tab === 'sla' ? below(CHART_COLORS.alertRed, CHART_COLORS.warmGray)(s.rate[ctx?.index ?? -1] ?? null) : CHART_COLORS.warmGray),
          font: (ctx: { index?: number }) => ({
            family: 'Plus Jakarta Sans', size: 11,
            weight: tab === 'sla' && (s.rate[ctx?.index ?? -1] ?? 100) < SLA_TARGET ? 700 : 400,
          }),
        },
      },
      y: tab === 'volume'
        ? { ...baseChartOptions.scales.y, beginAtZero: true, ticks: { ...tickFont, precision: 0 } }
        : {
            ...baseChartOptions.scales.y, min: 0, max: 100,
            // Chart.js v4: nét đứt của lưới khai ở `border.dash` (không còn grid.borderDash)
            border: { display: false, dash: [3, 3] },
            // Mốc 0/25/50/75/100 + đúng mốc mục tiêu (tô đỏ đậm) để dóng với đường đứt
            afterBuildTicks: (scale: { ticks: { value: number }[] }) => {
              scale.ticks = [0, 25, 50, 75, SLA_TARGET, 100].map(value => ({ value }))
            },
            ticks: {
              ...tickFont,
              callback: (v: number | string) => `${v}%`,
              color: (ctx: { tick?: { value: number } }) => (ctx?.tick?.value === SLA_TARGET ? CHART_COLORS.alertRed : CHART_COLORS.warmGray),
              font: (ctx: { tick?: { value: number } }) => ({ family: 'Plus Jakarta Sans', size: 11, weight: ctx?.tick?.value === SLA_TARGET ? 700 : 400 }),
            },
          },
    },
    layout: { padding: { top: tab === 'sla' ? 24 : 0 } },
    plugins: {
      ...baseChartOptions.plugins,
      // Tab SLA: tắt tooltip canvas, dùng tooltip HTML tự vẽ bên dưới (badge + dòng so với cam kết như mẫu)
      ...(tab === 'sla' && { tooltip: { enabled: false, external: onExternalTooltip } }),
    },
  }) as ChartOptions<'bar'>, [tab, s, tickFont, onExternalTooltip])

  const legend = tab === 'volume'
    ? [
        { label: 'Ticket mới', swatch: 'h-3.5 w-3.5 rounded-sm bg-charcoal', total: sum(s.created) },
        { label: 'Ticket đã đóng', swatch: 'h-3.5 w-3.5 rounded-sm border border-charcoal bg-limeMist', total: sum(s.closed) },
        { label: 'Vi phạm SLA', swatch: 'w-5 border-t-2 border-dashed border-alertRed', total: sum(s.breached) },
      ]
    : [
        { label: 'Tỷ lệ đúng SLA (%)', swatch: 'h-2.5 w-5 rounded-full border-2 border-charcoal bg-limeMist', total: null },
        { label: `Mục tiêu cam kết ${SLA_TARGET}%`, swatch: 'w-5 border-t-2 border-dashed border-alertRed', total: null },
      ]

  const tipValue = tip ? s.rate[tip.index] : null
  const tipDiff = tipValue != null ? Math.round((tipValue - SLA_TARGET) * 10) / 10 : 0

  return (
    <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-warmGray/10 pb-3">
        <div className="min-w-0">
          <h2 className="text-h2 text-charcoal">Xu hướng Ticket & Tuân thủ SLA ({DAYS} ngày qua)</h2>
          <p className="text-small text-warmGray">Biểu đồ giám sát hiệu năng giải quyết sự cố và tỷ lệ cam kết chất lượng dịch vụ</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-warmGray/10 bg-warmGray/10 p-1" role="tablist">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => { setTab(t.key); setTip(null) }}
              className={cn('rounded-lg px-3 py-1 text-xs', tab === t.key ? 'bg-white font-bold text-charcoal shadow-sm' : 'font-medium text-graphite hover:text-charcoal')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chú giải — định danh series không chỉ bằng màu (tab số lượng kèm tổng 7 ngày) */}
      <ul className="flex flex-wrap items-center gap-6 pb-1 pt-3.5">
        {legend.map(l => (
          <li key={l.label} className="flex items-center gap-2 text-small font-medium text-charcoal">
            <span className={l.swatch} />
            {l.label}
            {l.total !== null && <span className="font-bold tabular-nums">{l.total}</span>}
          </li>
        ))}
      </ul>

      {isLoading ? (
        <LoadingSkeleton count={1} className="h-60 w-full" />
      ) : (
        <div className="relative mt-2 h-60" role="img" aria-label={tab === 'volume'
          ? `${DAYS} ngày qua: ${sum(s.created)} ticket mới, ${sum(s.closed)} đã đóng, ${sum(s.breached)} vi phạm SLA`
          : `Tỷ lệ tuân thủ SLA theo ngày, ${DAYS} ngày qua, mục tiêu ${SLA_TARGET}%`}
        >
          {/* Biểu đồ trộn cột + đường: type chart.js chỉ nhận 1 loại cho data — ép kiểu ở đây, từng dataset đã khai type riêng */}
          {/* key={tab}: react-chartjs-2 chỉ gắn `plugins` lúc TẠO chart — đổi tab phải tạo lại chart thì plugin nhãn %
              của tab SLA mới chạy (không thì tạo ở tab Số lượng với plugins=[] rồi giữ nguyên) */}
          <Chart
            key={tab}
            type="bar"
            data={(tab === 'volume' ? volumeData : slaData) as unknown as ChartData<'bar', (number | null)[], string>}
            options={options}
            plugins={tab === 'sla' ? [slaDecorations] : []}
          />

          {/* Tooltip tab SLA — nền charcoal, badge đạt/chưa đạt, chênh lệch so với cam kết */}
          {tab === 'sla' && tip && tipValue != null && (
            <div
              className="pointer-events-none absolute z-10 w-64 rounded-xl bg-charcoal p-3.5 text-white shadow-dock"
              style={{ left: tip.x, top: tip.y, transform: tip.flip ? 'translate(calc(-100% - 16px), -30%)' : 'translate(16px, -30%)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-body font-bold">{s.labels[tip.index]}</p>
                <span className={cn('whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-extrabold uppercase', tipDiff < 0 ? 'bg-alertRed text-white' : 'bg-limeMist text-charcoal')}>
                  {tipDiff < 0 ? 'Chưa đạt mục tiêu' : 'Đạt mục tiêu'}
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between gap-3">
                <span className="text-small text-white/80">Tỷ lệ tuân thủ SLA:</span>
                <span className={cn('text-h3 font-bold tabular-nums', tipDiff < 0 ? 'text-orange-400' : 'text-limeMist')}>{tipValue}%</span>
              </div>
              <p className="mt-1 text-caption font-medium text-white/50">
                {tipDiff >= 0 ? '+' : ''}{tipDiff}% so với cam kết {SLA_TARGET}% · {s.dueOnTime[tip.index]}/{s.dueTotal[tip.index]} ticket đúng hạn
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3 ô tóm tắt dưới biểu đồ — đổi theo tab */}
      <div className="mt-4 grid gap-4 border-t border-warmGray/10 pt-4 sm:grid-cols-3">
        {tab === 'volume' ? (
          <>
            <SummaryBox label="Thời gian xử lý TB" value={kpi?.avgResolveHours != null ? formatDuration(kpi.avgResolveHours * HOUR_MS) : '--'}
              sub={kpi ? `Trên ${kpi.resolvedTickets} ticket đã xử lý xong` : ''} />
            <SummaryBox label="Tỷ lệ đúng SLA" value={rate != null ? `${rate}%` : '--'} danger={rate != null && rate < SLA_TARGET}
              sub={rate != null ? `${rate >= SLA_TARGET ? '↑ Vượt' : '↓ Dưới'} chỉ tiêu sàn ${SLA_TARGET}%` : 'Chưa có ticket nào tới hạn'}
              subTone={rate == null ? undefined : rate >= SLA_TARGET ? 'good' : 'bad'} />
            {/* Quá tải = cần điều phối lại, chưa phải lỗi — tô cam (cảnh báo) thay vì đỏ */}
            <SummaryBox label="Technician quá tải" value={`${overloaded.length} người`} warning={overloaded.length > 0}
              sub={overloaded.length > 0
                ? overloaded.map(t => t.full_name ?? t.email ?? '—').join(', ')
                : `Không ai giữ từ ${OVERLOAD_OPEN_TICKETS} ticket mở trở lên`} />
          </>
        ) : (
          <>
            <SummaryBox label="Tỷ lệ trung bình 7 ngày" value={weekRate != null ? `${weekRate}%` : '--'} danger={weekRate != null && weekRate < SLA_TARGET}
              sub={weekRate != null ? `${weekRate >= SLA_TARGET ? '↑ Vượt' : '↓ Dưới'} chỉ tiêu sàn ${SLA_TARGET}%` : 'Chưa có ticket nào tới hạn'}
              subTone={weekRate == null ? undefined : weekRate >= SLA_TARGET ? 'good' : 'bad'} />
            <SummaryBox label="Ngày đạt mục tiêu" value={daysWithData > 0 ? `${daysMet}/${daysWithData} ngày` : '--'}
              sub={daysWithData === 0 ? 'Chưa có ticket nào tới hạn'
                : daysMet < daysWithData ? `${daysWithData - daysMet} ngày dưới mục tiêu ${SLA_TARGET}%` : 'Mọi ngày đều đạt mục tiêu'} />
            <SummaryBox label="Mức ưu tiên vi phạm nhiều nhất" value={worstPriority[1] > 0 ? `${worstPriority[0]} (${worstPriority[1]} ca)` : 'Không có'}
              danger={worstPriority[1] > 0}
              sub={`P1: ${s.breachedByPriority.P1} · P2: ${s.breachedByPriority.P2} · P3: ${s.breachedByPriority.P3} ca trễ hạn`} />
          </>
        )}
      </div>
    </section>
  )
}

/** Ô tóm tắt dưới biểu đồ — `danger` = đỏ (vi phạm, dưới mục tiêu) · `warning` = cam (cần chú ý/điều phối) */
function SummaryBox({ label, value, sub, danger, warning, subTone }: {
  label: string; value: string; sub: string; danger?: boolean; warning?: boolean; subTone?: 'good' | 'bad'
}) {
  return (
    <div className={cn('rounded-2xl border p-4',
      danger ? 'border-alertRed/30 bg-alertRed/[0.04]' : warning ? 'border-orange-200 bg-orange-50' : 'border-warmGray/15 bg-warmGray/5')}
    >
      <p className={cn('text-[11px] font-bold uppercase tracking-wider', danger ? 'text-alertRed' : warning ? 'text-orange-700' : 'text-warmGray')}>{label}</p>
      <p className={cn('my-1 text-[28px] font-extrabold leading-tight tabular-nums', danger ? 'text-alertRed' : warning ? 'text-orange-600' : 'text-charcoal')}>{value}</p>
      <p
        className={cn('truncate text-small', subTone === 'good' ? 'font-semibold text-accent-800' : subTone === 'bad' ? 'font-semibold text-alertRed' : 'text-graphite')}
        title={sub}
      >
        {sub}
      </p>
    </div>
  )
}
