import type { CameraNode, CountingRing } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { t } from '@/utils/i18n.utils'

export type RingPoint = [number, number]

// Số đỉnh của vòng (CountingRing trong api-spec): khép kín cần ít nhất 3; 12 là giới hạn kỹ thuật chống nhập nhầm của backend
export const RING_MIN_POINTS = 3
export const RING_MAX_POINTS = 12
// Một camera có tối đa 4 vòng, số đếm của các vòng cộng chung vào camera (VISION-FR-018)
export const RING_MAX_COUNT = 4

// Khung hình khi chưa biết kích thước luồng video: 16:9 như khung camera ở Màn B
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9
// Toạ độ giữ 3 chữ số thập phân như ví dụ trong api-spec (đủ chính xác tới 1/1000 khung hình)
const COORDINATE_DECIMALS = 1000
// Khung vuông mới rộng 30% bề ngang khung hình — thông số giao diện, người dùng kéo góc cho ôm sát miệng lỗ
const DEFAULT_RING_HALF_WIDTH = 0.15
// Tâm gợi ý cho khung mới, lần lượt trái, phải, trên, dưới, để các khung vừa tạo không chồng lên nhau
const DEFAULT_RING_CENTERS: RingPoint[] = [
  [0.3, 0.5],
  [0.7, 0.5],
  [0.5, 0.25],
  [0.5, 0.75],
]
// Tâm khung mới cách tâm khung đang có ít nhất ngần này (theo tỉ lệ khung hình) thì coi là chỗ trống
const FREE_CENTER_DISTANCE = 0.2
// Góc của vòng đang chọn tính gần hơn 20% để thắng khi chồng lên góc vòng khác
const ACTIVE_RING_BIAS = 0.8

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function roundCoordinate(value: number): number {
  return Math.round(clampUnit(value) * COORDINATE_DECIMALS) / COORDINATE_DECIMALS
}

// Điểm chạm trong khung (px) đổi sang tỉ lệ khung hình 0–1, kẹp trong khung
export function toRingPoint(x: number, y: number, width: number, height: number): RingPoint {
  if (width <= 0 || height <= 0) return [0, 0]
  return [roundCoordinate(x / width), roundCoordinate(y / height)]
}

// Chuỗi "x,y x,y …" (px) cho Polygon / Polyline của react-native-svg
export function toSvgPoints(points: RingPoint[], width: number, height: number): string {
  return points.map(([x, y]) => `${x * width},${y * height}`).join(' ')
}

export function isRingComplete(points: RingPoint[]): boolean {
  return points.length >= RING_MIN_POINTS && points.length <= RING_MAX_POINTS
}

// Tỉ lệ rộng/cao của luồng video; chưa biết (chưa phát, luồng không báo kích thước) thì 16:9
export function getVideoAspectRatio(size: { width: number; height: number } | null | undefined): number {
  if (!size || size.width <= 0 || size.height <= 0) return DEFAULT_VIDEO_ASPECT_RATIO
  return size.width / size.height
}

// Vòng đã vẽ của camera; bản ghi trước khi có nhiều vòng chỉ có counting_ring
export function ringsOfCamera(camera: Pick<CameraNode, 'counting_rings' | 'counting_ring'>): CountingRing[] {
  if (camera.counting_rings) return camera.counting_rings
  const first = camera.counting_ring
  return first ? [{ points: first.points, into_ring_is_exit: first.into_ring_is_exit }] : []
}

// Tâm (trung bình các đỉnh) của một vòng
export function getRingCenter(points: RingPoint[]): RingPoint {
  if (points.length === 0) return [0.5, 0.5]
  const sum = points.reduce<RingPoint>((total, [x, y]) => [total[0] + x, total[1] + y], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

// Tâm cho khung mới: tâm gợi ý đầu tiên còn trống (xa mọi khung đang có), không còn thì giữa khung hình
export function pickFreeRingCenter(rings: readonly CountingRing[]): RingPoint {
  const centers = rings.map(ring => getRingCenter(ring.points))
  const free = DEFAULT_RING_CENTERS.find(candidate =>
    centers.every(center => Math.hypot(center[0] - candidate[0], center[1] - candidate[1]) >= FREE_CENTER_DISTANCE),
  )
  return free ?? [0.5, 0.5]
}

// Khung vuông 4 góc (vuông trên màn hình, nên cạnh dọc theo tỉ lệ khung hình), góc trên trái rồi theo chiều kim đồng hồ
export function createSquareRing(center: RingPoint, aspectRatio: number, intoRingIsExit: boolean): CountingRing {
  const halfX = DEFAULT_RING_HALF_WIDTH
  const halfY = DEFAULT_RING_HALF_WIDTH * aspectRatio
  const [x, y] = center
  return {
    points: [
      [roundCoordinate(x - halfX), roundCoordinate(y - halfY)],
      [roundCoordinate(x + halfX), roundCoordinate(y - halfY)],
      [roundCoordinate(x + halfX), roundCoordinate(y + halfY)],
      [roundCoordinate(x - halfX), roundCoordinate(y + halfY)],
    ],
    into_ring_is_exit: intoRingIsExit,
  }
}

// Một góc kéo được của một vòng
export interface RingVertexRef {
  ringIndex: number
  pointIndex: number
}

// Góc gần điểm chạm nhất (tính theo px) trong bán kính chạm; vòng đang chọn được ưu tiên khi hai góc cùng gần. Không có thì null
export function findNearestVertex(
  rings: readonly CountingRing[],
  touch: { x: number; y: number },
  frame: { width: number; height: number },
  radius: number,
  activeIndex: number,
): RingVertexRef | null {
  let best: RingVertexRef | null = null
  let bestDistance = radius
  rings.forEach((ring, ringIndex) => {
    const bias = ringIndex === activeIndex ? ACTIVE_RING_BIAS : 1
    ring.points.forEach(([x, y], pointIndex) => {
      const distance = Math.hypot(x * frame.width - touch.x, y * frame.height - touch.y) * bias
      if (distance <= bestDistance) {
        best = { ringIndex, pointIndex }
        bestDistance = distance
      }
    })
  })
  return best
}

// Đổi vị trí một góc, các vòng và góc khác giữ nguyên
export function moveRingVertex(rings: readonly CountingRing[], vertex: RingVertexRef, point: RingPoint): CountingRing[] {
  return rings.map((ring, ringIndex) =>
    ringIndex === vertex.ringIndex
      ? { ...ring, points: ring.points.map((current, pointIndex) => (pointIndex === vertex.pointIndex ? point : current)) }
      : ring,
  )
}

// Điểm (tỉ lệ khung hình) nằm trong vòng không — đếm số lần tia ngang cắt cạnh
export function isPointInRing(points: RingPoint[], [x, y]: RingPoint): boolean {
  let isInside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [xi, yi] = points[index]
    const [xj, yj] = points[previous]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) isInside = !isInside
  }
  return isInside
}

// Vòng nằm dưới điểm chạm (vòng vẽ sau nằm trên); không có thì -1
export function findRingAt(rings: readonly CountingRing[], point: RingPoint): number {
  for (let index = rings.length - 1; index >= 0; index -= 1) {
    if (isPointInRing(rings[index].points, point)) return index
  }
  return -1
}

// Mọi vòng của bản nháp đều đủ 3–12 đỉnh; không có vòng nào cũng hợp lệ (camera dùng lại vòng mặc định)
export function areRingsComplete(rings: readonly CountingRing[]): boolean {
  return rings.every(ring => isRingComplete(ring.points))
}

// Hai danh sách đỉnh giống hệt nhau
function isSamePoints(left: RingPoint[], right: RingPoint[]): boolean {
  return left.length === right.length && left.every(([x, y], index) => x === right[index][0] && y === right[index][1])
}

// Bản nháp có khác các vòng đang lưu không (để bật nút lưu): số vòng, đỉnh hoặc chiều của từng vòng
export function isRingListChanged(saved: readonly CountingRing[], drafts: readonly CountingRing[]): boolean {
  if (saved.length !== drafts.length) return true
  return saved.some(
    (ring, index) =>
      ring.into_ring_is_exit !== drafts[index].into_ring_is_exit || !isSamePoints(ring.points, drafts[index].points),
  )
}

// Bỏ một vòng rồi chọn vòng cuối còn lại
export function removeRingAt(rings: readonly CountingRing[], index: number): { rings: CountingRing[]; activeIndex: number } {
  const next = rings.filter((_, position) => position !== index)
  return { rings: next, activeIndex: Math.max(next.length - 1, 0) }
}

// Câu báo lỗi khi lưu vòng đếm: 403 không có quyền ở camera này (nhà khác, hoặc farm đã có chuyên gia), 409 camera đã gỡ
export function getCountingRingErrorMessage(error: unknown): string {
  return getSettingsErrorMessage(error, {
    403: t('Bạn không có quyền vẽ vòng đếm của camera này'),
    409: t('Camera đã bị gỡ khỏi hệ thống'),
    422: t('Mỗi vòng cần từ 3 đến 12 điểm trong khung hình, hai vòng không được trùng nhau'),
  })
}
