// Bảo trì phòng ngừa (OPS-FR-005…008, G-22) — khớp MaintenancePlan trong api-spec

// Thiết bị của kế hoạch: bơm, quạt (theo giờ chạy hoặc số lần đóng cắt); cảm biến, béc phun, hiệu chuẩn (theo lịch)
export type MaintenanceEquipment = 'PUMP' | 'FAN' | 'SENSOR' | 'NOZZLE' | 'CALIBRATION'

// Cách tính đến hạn: giờ chạy, số lần đóng cắt, hoặc số ngày
export type MaintenanceBasis = 'RUN_HOURS' | 'SWITCHES' | 'CALENDAR'

// Trạng thái kế hoạch (Report 3 §6.20, SM-20)
export type MaintenancePlanState = 'SCHEDULED' | 'DUE' | 'OVERDUE' | 'RETIRED'

// Một lần ghi bảo trì hoặc hiệu chuẩn: mỗi Work Order phòng ngừa được duyệt là một lần (OPS-FR-008)
export interface MaintenanceRecord {
  work_order_id: string
  node_id?: string | null
  kind: 'MAINTENANCE' | 'CALIBRATION'
  by?: string
  at: string
  next_due_at?: string | null
}

export interface MaintenancePlan {
  _id: string
  farm_id: string
  house_id: string
  equipment: MaintenanceEquipment
  basis: MaintenanceBasis
  // Giờ chạy, số lần đóng cắt, hoặc số ngày (CALENDAR)
  interval: number
  checklist_template: string[]
  state: MaintenancePlanState
  // Kế hoạch theo lịch: điểm đến hạn kế tiếp; CALIBRATION: ngày hiệu chuẩn kế tiếp
  next_due_at?: string | null
  due_since?: string | null
  overdue_notified_at?: string | null
  last_done_at?: string | null
  // Nguồn của chu kỳ: khuyến cáo nhà sản xuất hoặc người nuôi
  source: string
  note?: string | null
  records?: MaintenanceRecord[]
  // Chỉ ở GET /maintenance/due: id các Work Order phòng ngừa đang mở
  open_work_orders?: string[]
}
