import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Tooltip, Legend, Filler,
} from 'chart.js'

/**
 * Dùng CategoryScale (nhãn chuỗi tự format bằng date-fns, đã có sẵn dep) thay
 * vì TimeScale — tránh thêm dependency `chartjs-adapter-date-fns` chỉ cho 1
 * trang, trong khi trục category là đủ vì dữ liệu đã được backend gom bucket
 * đều nhau (analytics.service.ts `resolveRange`).
 */
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

/**
 * Bảng màu chart — bám bảng màu chuẩn FE_Design_Claude.md §2. Chart.js nhận
 * string màu literal nên đây là ngoại lệ duy nhất không dùng class Tailwind.
 * `gray300` thay cho "insightPeach" cũ — series phụ dùng thang xám gray-300→
 * gray-700 theo §2.6, không dùng màu ngoài hệ thống.
 */
export const CHART_COLORS = {
  charcoal: '#27231F',
  graphite: '#4E4A46',
  warmGray: '#878380',
  gray300: '#C5C4C3',
  climateOrange: '#ED8F50',
  alertRed: '#D53F35',
} as const

/** Cycle 6 màu (bỏ white/limeMist — không đủ tương phản cho bar/line trên nền trắng) */
export const CHART_PALETTE = [
  CHART_COLORS.charcoal, CHART_COLORS.climateOrange, CHART_COLORS.graphite,
  CHART_COLORS.alertRed, CHART_COLORS.warmGray, CHART_COLORS.gray300,
]

/**
 * Options nền chung — font Inter, tooltip nền charcoal, lưới mờ, không viền
 * trục. Để TS tự suy luận type (không gán `ChartOptions<'line'|'bar'>`): union
 * generic đó không gán ngược lại được cho `<Line options>`/`<Bar options>` cụ
 * thể do biến thể callback trong type chart.js — nơi dùng tự ép kiểu đúng loại
 * chart (`as ChartOptions<'line'>`/`as ChartOptions<'bar'>`).
 */
export const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: CHART_COLORS.charcoal,
      titleFont: { family: 'Plus Jakarta Sans', weight: 700 },
      bodyFont: { family: 'Plus Jakarta Sans' },
      padding: 10,
      cornerRadius: 12,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: CHART_COLORS.warmGray, font: { family: 'Plus Jakarta Sans', size: 11 } },
    },
    y: {
      grid: { color: 'rgba(135,131,128,0.12)' },
      ticks: { color: CHART_COLORS.warmGray, font: { family: 'Plus Jakarta Sans', size: 11 } },
    },
  },
}
