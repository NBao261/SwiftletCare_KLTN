// Module OPS: Work Order sửa chữa, phòng ngừa và MTTA/MTTR; api-spec WorkOrder, ChecklistItem, OpsMetrics
import type { AlertType } from '@/types/alert.types';

export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'VERIFYING' | 'AWAITING_APPROVAL' | 'CLOSED' | 'CANCELLED';

// Nguồn mở Work Order
export type WorkOrderOrigin = 'ALERT' | 'OUTAGE' | 'EXPERT' | 'ONSITE_CHECK' | 'MANUAL' | 'PLAN' | 'CHECKLIST' | 'RECOMMENDATION';

// nguyên nhân thợ tìm thấy tại chỗ
export type SiteCause = 'WATER' | 'NOZZLE' | 'PUMP' | 'FAN' | 'DOOR' | 'SENSOR' | 'SPEAKER' | 'OTHER';

// Kết quả khi đóng: sửa chữa (REPAIRED, SELF_RECOVERED) hoặc phòng ngừa đã duyệt (DONE: một lần ghi bảo trì)
export type WorkOrderResult = 'REPAIRED' | 'SELF_RECOVERED' | 'DONE';

// kết quả 1 mục checklist; null = chưa làm
export type ChecklistResult = 'OK' | 'DEFECT';

// Một mục checklist của Work Order phòng ngừa (api-spec ChecklistItem)
export interface WorkOrderChecklistItem {
  item: string;
  result: ChecklistResult | null;
  note: string | null;
  // URL tạm 1 giờ, chỉ có ở GET /work-orders/{id}
  photo_url: string | null;
  by: string | null;
  at: string | null;
  // Work Order sửa chữa mở từ mục ghi DEFECT
  repair_work_order_id: string | null;
}

export interface WorkOrderPerson {
  _id: string;
  full_name: string;
}

// Một lần đổi trạng thái; by null = hệ thống
export interface WorkOrderHistoryEntry {
  from: WorkOrderStatus | null;
  to: WorkOrderStatus;
  by: string | null;
  note: string | null;
  at: string;
}

// Thiết bị của phiếu đã bị gỡ, thay hay dời Zone khi phiếu còn mở: hệ thống không kiểm phục hồi bằng dữ liệu nữa
export type WorkOrderDeviceLeftKind = 'REMOVED' | 'REPLACED' | 'MOVED';

export interface WorkOrder {
  _id: string;
  farm_id: string;
  house_id: string;
  zone_id: string | null;
  node_id: string | null;
  alert_id: string | null;
  alert_type: AlertType | null;
  kind: 'REPAIR' | 'PREVENTIVE';
  origin: WorkOrderOrigin;
  // Kế hoạch bảo trì của Work Order phòng ngừa
  plan_id?: string | null;
  // Khuyến nghị đã mở Work Order này (nguồn RECOMMENDATION)
  recommendation_id?: string | null;
  // Work Order phòng ngừa: checklist chép từ mẫu của kế hoạch; sửa chữa thì rỗng
  checklist?: WorkOrderChecklistItem[];
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  // null = nhà không có thợ, Farm Owner tự xử lý
  assignee: WorkOrderPerson | null;
  // null = hệ thống mở
  opened_by: WorkOrderPerson | null;
  cause: SiteCause | null;
  work_note: string | null;
  // Chỉ có ở GET /work-orders/{id}, URL tạm 1 giờ
  photo_urls?: string[];
  result: WorkOrderResult | null;
  cancel_reason: string | null;
  opened_at: string;
  started_at: string | null;
  done_at: string | null;
  verified_at: string | null;
  // Lúc giao cho thợ hiện tại; quá hạn "chưa ai bắt đầu" tính từ đây
  assigned_at: string | null;
  closed_at: string | null;
  escalated_at: string | null;
  // Không có ở phiếu cũ
  device_left?: { kind: WorkOrderDeviceLeftKind; at: string } | null;
  history: WorkOrderHistoryEntry[];
}

// Phút, null khi không có mẫu
export interface OpsMetricRow {
  alerts: number;
  mtta_min: number | null;
  mttr_min: number | null;
  acknowledged_within_target_pct: number | null;
}

export interface OpsMetrics {
  from: string;
  to: string;
  target_ack_min: number;
  overall: OpsMetricRow;
  by_house: Array<OpsMetricRow & { house_id: string; name: string }>;
  by_technician: Array<OpsMetricRow & { technician_id: string; full_name: string }>;
  on_time_maintenance_rate: number | null;
}
