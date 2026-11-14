import type { Alert, AlertType, LocalPhoto, OnsiteCheck, SiteCause, WorkOrder, WorkOrderStatus } from '@/types'
import { t } from '@/utils/i18n.utils'

// Loại cảnh báo thiết bị phải ghi nguyên nhân tại chỗ khi đóng Work Order (ALERT-FR-018, backend 422 nếu thiếu) — cũng là loại
// hiện ô chọn nguyên nhân khi xác nhận cảnh báo
const CAUSE_ALERT_TYPES: ReadonlySet<AlertType> = new Set([
  'MISTING_INEFFECTIVE',
  'ACTUATOR_FAULT',
  'SENSOR_FAULT',
  'RS485_BUS_FAILURE',
  'SPEAKER_FAILURE',
])

// Các nguyên nhân tại chỗ theo thứ tự hiện trên form (ALERT-FR-018)
export const SITE_CAUSES: readonly SiteCause[] = ['WATER', 'NOZZLE', 'PUMP', 'FAN', 'DOOR', 'SENSOR', 'SPEAKER', 'OTHER']

// Cảnh báo thiết bị cần nguyên nhân tại chỗ (null: Work Order không gắn cảnh báo)
export function isCauseAlertType(alertType: AlertType | null | undefined): boolean {
  return alertType ? CAUSE_ALERT_TYPES.has(alertType) : false
}

// Work Order còn mở: chưa đóng, chưa huỷ (khớp ?open=true của backend)
const OPEN_STATUSES: ReadonlySet<WorkOrderStatus> = new Set(['OPEN', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_APPROVAL'])

export function isWorkOrderOpen(status: WorkOrderStatus): boolean {
  return OPEN_STATUSES.has(status)
}

// Bước tiếp theo người làm bấm được trên mobile (OPS-FR-002): OPEN → bắt đầu, IN_PROGRESS → báo xong; duyệt, mở lại, huỷ, giao
// lại là việc của Farm Owner trên web (OPS-FR-004)
export type WorkOrderAction = 'start' | 'done'

export function getWorkOrderAction(status: WorkOrderStatus): WorkOrderAction | null {
  if (status === 'OPEN') return 'start'
  if (status === 'IN_PROGRESS') return 'done'
  return null
}

// Yêu cầu kiểm tra tại chỗ đã được trả lời: có điều quan sát hoặc lúc trả lời. Spec ghi observation null khi chưa trả lời, nhưng
// bản ghi cũ có thể thiếu hẳn khoá (undefined) — cả hai đều là chưa trả lời
export function isOnsiteCheckAnswered(check: OnsiteCheck): boolean {
  return check.observation != null || check.answered_at != null
}

// Yêu cầu kiểm tra tại chỗ còn chờ thợ trả lời (EXPERT-FR-021): backend tạo đúng một yêu cầu mỗi cảnh báo suy luận
export function getPendingOnsiteCheck(alert: Pick<Alert, 'onsite_checks'>): OnsiteCheck | null {
  return alert.onsite_checks?.find(check => !isOnsiteCheckAnswered(check)) ?? null
}

// Các mốc của Work Order đã xảy ra, theo thứ tự vòng đời (SM-19): mở, bắt đầu, báo xong, dữ liệu phục hồi (BR-41), đóng
export function getWorkOrderMilestones(workOrder: WorkOrder): { label: string; time: string }[] {
  const milestones = [
    { label: t('Mở lúc'), time: workOrder.opened_at },
    { label: t('Bắt đầu'), time: workOrder.started_at },
    { label: t('Báo xong'), time: workOrder.done_at },
    { label: t('Dữ liệu đã phục hồi'), time: workOrder.verified_at },
    { label: t('Đóng lúc'), time: workOrder.closed_at },
  ]
  return milestones.flatMap(item => (item.time ? [{ label: item.label, time: item.time }] : []))
}

// Kiểu ảnh theo đuôi file; backend nhận JPEG/PNG/WebP, camera trả JPEG
function getPhotoType(uri: string): string {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  return 'image/jpeg'
}

// Một phần file của multipart/form-data trong React Native: { uri, name, type }
export function buildPhotoPart(photo: LocalPhoto, name: string): { uri: string; name: string; type: string } {
  const type = getPhotoType(photo.uri)
  const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  return { uri: photo.uri, name: `${name}.${extension}`, type }
}

// Số ảnh tối đa gửi kèm khi báo xong Work Order (api-spec: tối đa 5 ảnh, mỗi ảnh ≤ 5 MB)
export const WORK_ORDER_MAX_PHOTOS = 5
