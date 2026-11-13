import type { CountingRing } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { t } from '@/utils/i18n.utils'

export type RingPoint = [number, number]

// Số đỉnh của vòng (CountingRing trong api-spec): khép kín cần ít nhất 3; 12 là giới hạn kỹ thuật chống nhập nhầm của backend
export const RING_MIN_POINTS = 3
export const RING_MAX_POINTS = 12

// Khung hình khi chưa biết kích thước luồng video: 16:9 như khung camera ở Màn B
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9
// Toạ độ giữ 3 chữ số thập phân như ví dụ trong api-spec (đủ chính xác tới 1/1000 khung hình)
const COORDINATE_DECIMALS = 1000

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

// Điểm chạm trong khung (px) đổi sang tỉ lệ khung hình 0–1, kẹp trong khung
export function toRingPoint(x: number, y: number, width: number, height: number): RingPoint {
  if (width <= 0 || height <= 0) return [0, 0]
  return [
    Math.round(clampUnit(x / width) * COORDINATE_DECIMALS) / COORDINATE_DECIMALS,
    Math.round(clampUnit(y / height) * COORDINATE_DECIMALS) / COORDINATE_DECIMALS,
  ]
}

// Chuỗi "x,y x,y …" (px) cho Polygon / Polyline của react-native-svg
export function toSvgPoints(points: RingPoint[], width: number, height: number): string {
  return points.map(([x, y]) => `${x * width},${y * height}`).join(' ')
}

export function canAddRingPoint(points: RingPoint[]): boolean {
  return points.length < RING_MAX_POINTS
}

export function isRingComplete(points: RingPoint[]): boolean {
  return points.length >= RING_MIN_POINTS && points.length <= RING_MAX_POINTS
}

// Tỉ lệ rộng/cao của luồng video; chưa biết (chưa phát, luồng không báo kích thước) thì 16:9
export function getVideoAspectRatio(size: { width: number; height: number } | null | undefined): number {
  if (!size || size.width <= 0 || size.height <= 0) return DEFAULT_VIDEO_ASPECT_RATIO
  return size.width / size.height
}

// Bản nháp có khác vòng đang lưu không (để bật nút lưu và hỏi trước khi bỏ)
export function isRingChanged(
  saved: CountingRing | null | undefined,
  points: RingPoint[],
  intoRingIsExit: boolean | null,
): boolean {
  if (!saved) return points.length > 0 || intoRingIsExit !== null
  if (saved.into_ring_is_exit !== intoRingIsExit || saved.points.length !== points.length) return true
  return saved.points.some(([x, y], index) => x !== points[index][0] || y !== points[index][1])
}

// Câu báo lỗi khi lưu vòng đếm: 403 không có quyền ở camera này (nhà khác, hoặc farm đã có chuyên gia), 409 camera đã gỡ
export function getCountingRingErrorMessage(error: unknown): string {
  return getSettingsErrorMessage(error, {
    403: t('Bạn không có quyền vẽ vòng đếm của camera này'),
    409: t('Camera đã bị gỡ khỏi hệ thống'),
    422: t('Vòng đếm cần từ 3 đến 12 điểm trong khung hình'),
  })
}
