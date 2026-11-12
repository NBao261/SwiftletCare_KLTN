import type { QueryClient } from '@tanstack/react-query'
import { parseISO } from 'date-fns'
import type { AppColors } from '@/constants/theme'
import type {
  HealthDayStatus,
  HealthIndicatorLevel,
  HealthRatingValue,
  HealthReason,
  HealthSource,
  HouseHealthDay,
  MyRatingState,
} from '@/types'
import { formatDayMonth, getVietnamDate } from '@/utils/date.utils'
import { getRoleLabel } from '@/utils/label.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

// Người chấm chấm được tới hết 7 ngày sau ngày đó (Report 3 §4.5, rating_deadline)
const RATING_WINDOW_DAYS = 7

// 4 nguồn theo thứ tự hiển thị (BR-28)
export const HEALTH_SOURCES: readonly HealthSource[] = ['environment', 'air', 'flock', 'noise']

// 3 mức người chấm chọn, nhẹ đến nặng
export const HEALTH_RATINGS: readonly HealthRatingValue[] = ['GOOD', 'WATCH', 'ACTION']

// Nhóm quan sát tại nhà yến (BR-37), cùng câu với web (frontend/src/constants/health.i18n.ts rate.guide.*)
export const OBSERVATION_GUIDE: readonly { title: string; text: string; isSevere?: boolean }[] = [
  {
    title: 'Đàn chim',
    text: 'chim về lúc chiều tối (17:00–19:00) như mọi ngày, ít hơn, hay ít hẳn hoặc về muộn; chim ra buổi sáng như thường',
  },
  {
    title: 'Môi trường',
    text: 'trong nhà ẩm mát, hay khô, nóng, ngột ngạt; tường đọng nước; tổ khô, nứt hoặc ngả vàng',
  },
  { title: 'Không khí', text: 'mùi phân bình thường, nồng, hay cay mắt' },
  { title: 'Xáo trộn', text: 'chim bay hoảng hoặc kêu báo động; chuột, thạch sùng, rắn; tiếng ồn lớn bên ngoài' },
  { title: 'Thiết bị', text: 'phun sương, quạt, bồn nước chạy bình thường' },
  { title: 'Dấu hiệu nặng', text: 'chim chết, chim non rơi, nhiều tổ rơi', isSevere: true },
]

const STATUS_LABELS: Record<HealthDayStatus, string> = {
  GOOD: 'Tốt',
  WATCH: 'Cần theo dõi',
  ACTION: 'Cần xử lý',
  INSUFFICIENT_DATA: 'Không đủ dữ liệu',
}

// Định nghĩa 3 mức khi chấm (BR-37), cùng web statusHint.*
const RATING_HINTS: Record<HealthRatingValue, string> = {
  GOOD: 'Không thấy gì bất thường',
  WATCH: 'Có một dấu hiệu nhẹ',
  ACTION: 'Chim về ít hẳn kèm dấu hiệu khác, hoặc có dấu hiệu nặng',
}

const RATING_STATE_LABELS: Record<MyRatingState, string> = {
  PENDING: 'Chưa đánh giá',
  RATED: 'Đã đánh giá',
  SKIPPED: 'Đã bỏ qua',
  EXPIRED: 'Hết hạn đánh giá',
}

const SOURCE_LABELS: Record<HealthSource, string> = {
  environment: 'Môi trường',
  air: 'Không khí',
  flock: 'Đàn chim',
  noise: 'Tiếng ồn',
}

const LEVEL_LABELS: Record<HealthIndicatorLevel, string> = {
  NORMAL: 'Bình thường',
  SLIGHT: 'Lệch nhẹ',
  CLEAR: 'Lệch rõ',
}

// Nhãn trạng thái ngày (BR-29), cũng là nhãn mức người chấm chọn
export function getHealthStatusLabel(status: HealthDayStatus): string {
  return t(STATUS_LABELS[status])
}

export function getHealthRatingHint(rating: HealthRatingValue): string {
  return t(RATING_HINTS[rating])
}

export function getRatingStateLabel(state: MyRatingState): string {
  return t(RATING_STATE_LABELS[state])
}

export function getHealthSourceLabel(source: HealthSource): string {
  return t(SOURCE_LABELS[source])
}

// Mức của một chỉ số; null là nguồn không đủ dữ liệu nên không xét
export function getIndicatorLevelLabel(level: HealthIndicatorLevel | null): string {
  return level ? t(LEVEL_LABELS[level]) : t('Không xét')
}

// Vai trò của người chấm: Farm Owner, Farm Technician (G-20), Domain Expert (điểm chấm cũ trước Report 3 4.2.0)
export function getRaterRoleLabel(role: string): string {
  if (role === 'FARM_OWNER' || role === 'DOMAIN_EXPERT') return getRoleLabel(role)
  if (role === 'FARM_TECHNICIAN') return t('Kỹ thuật viên')
  return role
}

// Giá trị chỉ số kèm đơn vị theo nguồn; thiếu thì "_"
export function formatIndicatorValue(source: HealthSource, value: number | null): string {
  if (value === null) return '_'
  const formatted = formatReasonNumber(value)
  if (source === 'air') return t('{value} giờ', { value: formatted })
  if (source === 'noise') return t('{value} đợt', { value: formatted })
  return `${formatted} %`
}

// Màu huy hiệu trạng thái, chỉ từ token có sẵn: Tốt xanh lá nhà ổn, Cần theo dõi / Cần xử lý theo 2 mức cam của cảnh báo,
// Không đủ dữ liệu xám
export function getHealthStatusColors(status: HealthDayStatus, palette: AppColors['light']) {
  const colors = {
    GOOD: { background: palette.houseHealthy, text: palette.onInverse },
    WATCH: { background: palette.severityP2, text: palette.severityP2Text },
    ACTION: { background: palette.severityP1, text: palette.severityP1Text },
    INSUFFICIENT_DATA: { background: palette.severityP3, text: palette.severityP3Text },
  }
  return colors[status]
}

// Số trong câu lý do: số nguyên giữ nguyên, số lẻ 1 chữ số thập phân, dấu thập phân theo ngôn ngữ
function formatReasonNumber(value: number): string {
  return formatDecimal(value, Number.isInteger(value) ? 0 : 1)
}

const numberOf = (value: unknown): string => (typeof value === 'number' ? formatReasonNumber(value) : '')
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '')

// Câu của một lý do trạng thái ngày (schema HealthReason: mã + số liệu), cùng câu với web
export function formatHealthReason(reason: HealthReason): string {
  const values = reason.values ?? {}
  const level = reason.level ? getIndicatorLevelLabel(reason.level).toLowerCase() : ''
  switch (reason.code) {
    case 'MISSING_DATA': {
      if (reason.source === 'flock') {
        if (values.missing === 'EVENING') return t('Thiếu dữ liệu đàn chim: thiếu phiên chiều')
        if (values.missing === 'NO_DEPARTURES') return t('Thiếu dữ liệu đàn chim: phiên sáng không có chim ra')
        return t('Thiếu dữ liệu đàn chim: thiếu phiên sáng')
      }
      if (values.no_zones) return t('Thiếu dữ liệu môi trường: nhà chưa có Zone')
      const zones = Array.isArray(values.zones)
        ? values.zones
            .map((zone: { zone_name?: unknown; valid_pct?: unknown }) => `${textOf(zone.zone_name)} ${numberOf(zone.valid_pct)} %`)
            .join(', ')
        : ''
      return t('Thiếu dữ liệu môi trường: mẫu nhiệt độ, độ ẩm hợp lệ dưới {pct} % ({zones})', {
        pct: numberOf(values.min_pct),
        zones,
      })
    }
    case 'NOT_ASSESSED':
      return reason.source === 'air'
        ? t('Chưa xét không khí (thiếu mẫu NH3, CO2)')
        : t('Chưa xét tiếng ồn (thiếu mẫu độ ồn)')
    case 'ENV_IN_RANGE':
      return t('Môi trường: {zone} chỉ {pct} % thời gian nhiệt độ, độ ẩm trong ngưỡng ({level})', {
        zone: textOf(values.zone_name),
        pct: numberOf(values.in_range_pct),
        level,
      })
    case 'AIR_OVER_LIMIT':
      return t('Không khí: NH3 hoặc CO2 vượt ngưỡng {hours} giờ ở {zone} ({level})', {
        hours: numberOf(values.hours),
        zone: textOf(values.zone_name),
        level,
      })
    case 'FLOCK_DROP':
      return t('Đàn chim: tỷ lệ chim về {rate} %, giảm {drop} % so với trung bình {days} ngày trước ({average} %) ({level})', {
        rate: numberOf(values.return_rate),
        drop: numberOf(values.drop_pct),
        days: numberOf(values.baseline_days),
        average: numberOf(values.baseline_avg),
        level,
      })
    case 'FLOCK_NO_BASELINE':
      return t('Đàn chim: chưa đủ {days} ngày để so sánh tỷ lệ chim về', { days: numberOf(values.min_days) })
    case 'NOISE_EPISODES':
      return t('Tiếng ồn: {episodes} đợt ồn bất thường ({level})', { episodes: numberOf(values.episodes), level })
    case 'RAIN_DOWNGRADE':
      return t('Mưa từ {mm} mm/giờ trùng phiên đếm và đợt ồn nên hạ từ Cần xử lý xuống Cần theo dõi', {
        mm: numberOf(values.mm_per_hour),
      })
    case 'WEATHER_UNAVAILABLE':
      return t('Không có dữ liệu thời tiết')
    case 'ATTRACTING_STAGE':
      return t('Đàn chim: nhà đang ở giai đoạn dẫn dụ, không xét tỷ lệ chim về')
    case 'ALL_NORMAL':
      return t('Các chỉ số đã xét đều bình thường')
  }
}

// Cộng / trừ số ngày trên ngày YYYY-MM-DD (tính theo UTC nên không lệch vì múi giờ máy)
export function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

// Ngày YYYY-MM-DD thành dd/MM
export function formatHealthDate(date: string): string {
  return formatDayMonth(parseISO(date))
}

// Ngày cuối còn chấm được, dd/MM: rating_deadline là đầu ngày thứ 8 (đã hết hạn) nên lùi 1 mili giây
export function formatLastRatingDay(deadline: string): string {
  return formatHealthDate(getVietnamDate(Date.parse(deadline) - 1))
}

// Khoảng có thể còn ngày chờ chấm: 7 ngày trước tới hôm nay (giờ Việt Nam)
export function getPendingRatingRange(now: number = Date.now()): { from: string; to: string } {
  const to = getVietnamDate(now)
  return { from: shiftDate(to, -RATING_WINDOW_DAYS), to }
}

// Ngày chờ chấm cũ nhất (gần hết hạn nhất) — lối tắt mở thẳng ngày này
export function getOldestPendingDay(days: HouseHealthDay[]): HouseHealthDay | null {
  let oldest: HouseHealthDay | null = null
  for (const day of days) {
    if (day.my_rating_state === 'PENDING' && (!oldest || day.date < oldest.date)) oldest = day
  }
  return oldest
}

// Ngày còn chờ người dùng chấm thì bị che trạng thái (BR-31)
export function isHealthDayHidden(day: HouseHealthDay): boolean {
  return day.my_rating_state === 'PENDING' || day.current_status === undefined
}

// Sau khi chấm, bỏ qua, sửa ghi chú: ghi ngày đầy đủ backend trả vào cache rồi tải lại danh sách ngày và báo cáo,
// vì trạng thái các ngày đó vừa mở cho người dùng
export function storeRevealedHealthDay(queryClient: QueryClient, day: HouseHealthDay): Promise<void> {
  queryClient.setQueryData(['health-days', 'detail', day._id], day)
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['health-days'], predicate: query => query.queryKey[1] !== 'detail' }),
    queryClient.invalidateQueries({ queryKey: ['health-reports'] }),
  ]).then(() => undefined)
}

export interface PendingTasksSummary {
  total: number
  summary: string
}

// Tổng số việc và câu tóm tắt theo từng loại: "2 nhà chờ đánh giá ngày · 1 cảnh báo chờ phán quyết"
export function summarizePendingTasks(pendingDays: HouseHealthDay[], pendingVerdictCount: number): PendingTasksSummary {
  const houseCount = new Set(pendingDays.map(day => day.house_id)).size
  const parts = [
    houseCount > 0 ? t('{count} nhà chờ đánh giá ngày', { count: houseCount }) : null,
    pendingVerdictCount > 0 ? t('{count} cảnh báo chờ phán quyết', { count: pendingVerdictCount }) : null,
  ]
  return {
    // Đếm theo từng việc (cặp nhà + ngày), không theo số loại việc
    total: pendingDays.length + pendingVerdictCount,
    summary: parts.filter(Boolean).join(' · '),
  }
}
