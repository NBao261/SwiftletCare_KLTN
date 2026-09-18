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
 * Bảng màu chart — CHỈ dùng 8 màu chuẩn (FE_Design_Swiftlet.md §1). `insightPeach`
 * được định nghĩa đúng vai trò "series phụ trên biểu đồ phân tích".
 */
export const CHART_COLORS = {
  charcoal: '#27231F',
  graphite: '#4E4A46',
  warmGray: '#878380',
  climateOrange: '#F0813A',
  alertRed: '#E13A3A',
  insightPeach: '#F5C89E',
} as const

/** Cycle 6 màu (bỏ white/limeMist — không đủ tương phản cho bar/line trên nền trắng) */
export const CHART_PALETTE = [
  CHART_COLORS.charcoal, CHART_COLORS.climateOrange, CHART_COLORS.graphite,
  CHART_COLORS.alertRed, CHART_COLORS.warmGray, CHART_COLORS.insightPeach,
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
      titleFont: { family: 'Inter', weight: 700 },
      bodyFont: { family: 'Inter' },
      padding: 10,
      cornerRadius: 12,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: CHART_COLORS.warmGray, font: { family: 'Inter', size: 11 } },
    },
    y: {
      grid: { color: 'rgba(135,131,128,0.12)' },
      ticks: { color: CHART_COLORS.warmGray, font: { family: 'Inter', size: 11 } },
    },
  },
}
