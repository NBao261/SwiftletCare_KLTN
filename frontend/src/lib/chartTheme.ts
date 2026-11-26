import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Tooltip, Legend, Filler,
} from 'chart.js'

// CategoryScale thay TimeScale: backend đã gom bucket đều, khỏi thêm adapter
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

// Chart.js nhận màu literal nên đây là ngoại lệ không dùng class Tailwind
export const CHART_COLORS = {
  charcoal: '#27231F',
  graphite: '#4E4A46',
  warmGray: '#878380',
  gray300: '#C5C4C3',
  climateOrange: '#ED8F50',
  alertRed: '#D53F35',
  // accent-600: đường/bar "Độ ẩm" và trạng thái tích cực (EnvVariationCard, BirdFlowCard)
  accentGreen: '#B5D32C',
  // accent-700: đoạn "Yến hồng" của biểu đồ sản lượng (HarvestYearChart)
  accentDeep: '#89A022',
  // accent-900: đoạn "Yến huyết" của biểu đồ sản lượng (HarvestYearChart)
  accentMoss: '#414C10',
  // Chim về buổi chiều (BirdDailyCharts): cặp với climateOrange qua kiểm tra màu của skill dataviz (CVD ΔE 11,6)
  accentOlive: '#6B7F18',
} as const

// Màu token với độ trong suốt (0–1) cho nền dải ngưỡng, vùng tô: chỉ nhận màu hex 6 ký tự trong CHART_COLORS
export function withAlpha(hexColor: string, alpha: number): string {
  const channel = (start: number) => parseInt(hexColor.slice(start, start + 2), 16)
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`
}

// Để TS tự suy luận: union generic không gán lại được cho <Line>/<Bar>
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
