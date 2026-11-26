import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { Chart as ChartInstance, ChartOptions, Plugin, ScriptableLineSegmentContext } from 'chart.js'
import { LINE_LEGEND, THRESHOLD_BAND_FILL, X_AXIS_TICKS, axisTitle } from '@/components/features/farm-owner/analytics/analytics.constants'
import { baseChartOptions } from '@/lib/chartTheme'

export interface LineSeries {
  label: string
  data: Array<number | null>
  color: string
  // Nét đứt cho số tham chiếu hoặc số dự báo
  isDashed?: boolean
}

interface Band {
  min: number
  max: number
  // Chữ ghi cạnh tiêu đề biểu đồ, kèm ô mẫu màu dải: "Ngưỡng an toàn 26–31°C"
  label?: string
}

// Tô nền dải ngưỡng an toàn, kẹp trong vùng vẽ để không đè lên chú thích; có nhãn thì ghi ở góc trên trái của dải
function thresholdBandPlugin(band: Band): Plugin<'line'> {
  return {
    id: 'thresholdBand',
    beforeDatasetsDraw(chart: ChartInstance<'line'>) {
      const { ctx, chartArea, scales } = chart
      const yScale = scales.y
      if (!chartArea || !yScale) return
      const top = Math.max(chartArea.top, Math.min(yScale.getPixelForValue(band.max), chartArea.bottom))
      const bottom = Math.min(chartArea.bottom, Math.max(yScale.getPixelForValue(band.min), chartArea.top))
      if (bottom <= top) return
      ctx.save()
      ctx.fillStyle = THRESHOLD_BAND_FILL
      ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, bottom - top)
      ctx.restore()
    },
  }
}

// Vạch đứng mảnh theo con trỏ để đọc các đường cùng một thời điểm
const crosshairPlugin: Plugin<'line'> = {
  id: 'crosshair',
  afterDatasetsDraw(chart: ChartInstance<'line'>) {
    const active = chart.tooltip?.getActiveElements?.() ?? []
    if (active.length === 0) return
    const { ctx, chartArea } = chart
    const x = active[0].element.x
    ctx.save()
    ctx.strokeStyle = 'rgba(135,131,128,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

interface LineChartPanelProps {
  title: string
  // Đơn vị ghi ở tiêu đề trục và trong tooltip
  unit: string
  labels: string[]
  series: LineSeries[]
  // Dải ngưỡng an toàn tô nền (nhiệt độ, độ ẩm của Zone)
  band?: Band
  // Có dải ngưỡng thì đoạn của đường đầu tiên nằm ngoài dải tô màu này, kèm mục chú giải này
  outOfRange?: { color: string; label: string }
  // Dòng phụ trong tooltip (VD chênh lệch trong nhà và ngoài trời) theo vị trí điểm; null = không ghi
  extraLine?: (index: number) => string | null
  // Trục cố định (VD % công suất 0–100); bỏ trống thì trục tự co theo số đo
  yMin?: number
  yMax?: number
  // Vạch đánh dấu hoặc thành phần vẽ thêm của khung gọi
  plugins?: Plugin<'line'>[]
  // Khoá để vẽ lại biểu đồ khi plugin đổi (react-chartjs-2 chỉ đọc plugins lúc tạo)
  pluginKey?: string
  formatValue: (value: number) => string
  heightClass?: string
}

// Một biểu đồ đường của một đại lượng: mỗi đại lượng một biểu đồ riêng, không dùng hai trục
export default function LineChartPanel({
  title, unit, labels, series, band, outOfRange, extraLine, yMin, yMax, plugins = [], pluginKey = '', formatValue, heightClass = 'h-56',
}: LineChartPanelProps): JSX.Element {
  const data = useMemo(() => {
    const isOutside = (value: number | null | undefined) => Boolean(band) && typeof value === 'number' && (value < band!.min || value > band!.max)
    const datasets = series.map((item, seriesIndex) => {
      // Chấm đánh dấu số mới nhất của đường liền đầu tiên, để thấy ngay giá trị hiện tại
      const lastIndex = item.data.reduce<number>((last, value, index) => (value === null ? last : index), -1)
      const showLast = seriesIndex === 0 && !item.isDashed
      return {
        label: item.label,
        data: item.data,
        borderColor: item.color,
        backgroundColor: item.color,
        borderDash: item.isDashed ? [6, 4] : undefined,
        borderWidth: item.isDashed ? 1.5 : 2.25,
        tension: 0.3,
        pointRadius: item.data.map((_, index) => (labels.length < 2 || (showLast && index === lastIndex) ? 4 : 0)),
        pointHoverRadius: 5,
        pointBackgroundColor: item.color,
        // Chú giải kiểu nét đọc màu và độ dày từ viền chấm, nên viền chấm cùng màu đường
        pointBorderColor: item.color,
        pointBorderWidth: 2,
        fill: false,
        spanGaps: true,
        // Đoạn đường ngoài dải ngưỡng đổi màu để thấy ngay lúc vượt ngưỡng
        segment: band && outOfRange && showLast
          ? { borderColor: (context: ScriptableLineSegmentContext) => (isOutside(context.p0.parsed.y) || isOutside(context.p1.parsed.y) ? outOfRange.color : item.color) }
          : undefined,
      }
    })
    // Mục chú giải cho màu "ngoài ngưỡng": chuỗi rỗng, chỉ để hiện trong chú giải
    if (band && outOfRange) {
      datasets.push({
        label: outOfRange.label, data: [], borderColor: outOfRange.color, backgroundColor: outOfRange.color, borderDash: undefined,
        borderWidth: 2.25, tension: 0, pointRadius: [], pointHoverRadius: 0, pointBackgroundColor: outOfRange.color, pointBorderColor: outOfRange.color, pointBorderWidth: 2, fill: false, spanGaps: true, segment: undefined,
      })
    }
    return { labels, datasets }
  }, [labels, series, band, outOfRange])

  const options = useMemo(() => ({
    ...baseChartOptions,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      ...baseChartOptions.plugins,
      legend: LINE_LEGEND,
      tooltip: {
        ...baseChartOptions.plugins.tooltip,
        callbacks: {
          label: context => `${context.dataset.label ?? ''}: ${context.parsed.y === null ? '' : `${formatValue(context.parsed.y)} ${unit}`}`,
          afterBody: items => {
            const extra = items.length > 0 && extraLine ? extraLine(items[0].dataIndex) : null
            return extra ? [extra] : []
          },
        },
      },
    },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...X_AXIS_TICKS } },
      y: { ...baseChartOptions.scales.y, grace: '8%', min: yMin, max: yMax, title: axisTitle(unit) },
    },
  } as ChartOptions<'line'>), [unit, yMin, yMax, formatValue, extraLine])

  const allPlugins = useMemo(
    () => [...(band ? [thresholdBandPlugin(band)] : []), crosshairPlugin, ...plugins],
    [band, plugins],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-body font-bold text-charcoal">{title}</h3>
        {band?.label && (
          <span className="inline-flex items-center gap-1.5 text-small font-medium text-warmGray">
            <span aria-hidden="true" className="h-3 w-5 rounded-sm" style={{ background: THRESHOLD_BAND_FILL, boxShadow: 'inset 0 0 0 1px rgba(107,127,24,0.35)' }} />
            {band.label}
          </span>
        )}
      </div>
      <div className={heightClass}>
        {/* react-chartjs-2 chỉ đọc plugins lúc tạo chart nên vẽ lại khi dải ngưỡng hoặc vạch mốc đổi */}
        <Line key={`${band?.min ?? ''}-${band?.max ?? ''}-${band?.label ?? ''}-${pluginKey}`} data={data} options={options} plugins={allPlugins} />
      </div>
    </div>
  )
}
