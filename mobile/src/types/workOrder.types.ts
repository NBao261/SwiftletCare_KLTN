import type { AlertType, OnsiteObservation, PersonRef, SiteCause } from '@/types/alert.types'

// Vòng đời Work Order (Report 3 §6.19, SM-19) — khớp WorkOrderStatus trong api-spec
export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'VERIFYING' | 'AWAITING_APPROVAL' | 'CLOSED' | 'CANCELLED'

// Nguồn mở Work Order (BR-39): cảnh báo thiết bị, thiết bị mất kết nối quá 30 phút, chuyên gia cần tới nhà, thợ thấy cảm biến
// hỏng khi kiểm tra tại chỗ, Farm Owner mở tay; G-22: kế hoạch bảo trì đến hạn (PLAN), mục checklist ghi hỏng (CHECKLIST)
export type WorkOrderOrigin = 'ALERT' | 'OUTAGE' | 'EXPERT' | 'ONSITE_CHECK' | 'MANUAL' | 'PLAN' | 'CHECKLIST'

// Kết quả một mục checklist của Work Order phòng ngừa (OPS-FR-007)
export type ChecklistResult = 'OK' | 'DEFECT'

// Một mục checklist — khớp ChecklistItem trong api-spec; result null hoặc thiếu = chưa làm
export interface ChecklistItem {
  item: string
  result?: ChecklistResult | null
  note?: string | null
  // URL tạm (1 giờ)
  photo_url?: string | null
  by?: string | null
  at?: string | null
  // Work Order sửa chữa mở từ mục DEFECT
  repair_work_order_id?: string | null
}

export interface WorkOrderHistoryEntry {
  from: WorkOrderStatus | null
  to: WorkOrderStatus
  // null = hệ thống
  by: string | null
  note?: string | null
  at: string
}

// Work Order sửa chữa (OPS-FR-001…004) — các trường mobile dùng, khớp schema WorkOrder trong api-spec
export interface WorkOrder {
  _id: string
  farm_id: string
  house_id: string
  zone_id?: string | null
  node_id?: string | null
  alert_id?: string | null
  alert_type?: AlertType | null
  kind: 'REPAIR' | 'PREVENTIVE'
  origin: WorkOrderOrigin
  // Work Order phòng ngừa: kế hoạch bảo trì và checklist chép từ mẫu của kế hoạch (G-22)
  plan_id?: string | null
  checklist?: ChecklistItem[]
  title: string
  description?: string | null
  status: WorkOrderStatus
  // null = nhà không có thợ, Farm Owner xử lý
  assignee?: PersonRef | null
  // null = hệ thống mở
  opened_by?: PersonRef | null
  cause?: SiteCause | null
  work_note?: string | null
  // URL tạm (1 giờ); danh sách không kèm
  photo_urls?: string[]
  // DONE: Work Order phòng ngừa đã duyệt — một lần ghi bảo trì (OPS-FR-008)
  result?: 'REPAIRED' | 'SELF_RECOVERED' | 'DONE' | null
  cancel_reason?: string | null
  opened_at: string
  started_at?: string | null
  done_at?: string | null
  verified_at?: string | null
  closed_at?: string | null
  escalated_at?: string | null
  history?: WorkOrderHistoryEntry[]
}

// Ảnh chụp trên máy để gửi kèm (multipart): đường dẫn file tạm của camera
export interface LocalPhoto {
  uri: string
}

// Thân POST /work-orders/{id}/done
export interface CompleteWorkOrderInput {
  cause?: SiteCause
  workNote?: string
  photos: LocalPhoto[]
}

// Thân PUT /work-orders/{id}/checklist
export interface ChecklistItemInput {
  itemIndex: number
  result: ChecklistResult
  note?: string
  photo?: LocalPhoto
}

// Thân POST /alerts/{id}/onsite-check
export interface OnsiteCheckAnswerInput {
  observation: OnsiteObservation
  note?: string
  photo?: LocalPhoto
}
