// Module OPS — Work Order sửa chữa (OPS-FR-001…004, Report 3 §6.19) và MTTA/MTTR (OPS-FR-009); api-spec WorkOrder, OpsMetrics
import type { AlertType } from '@/types/alert.types';

export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'VERIFYING' | 'AWAITING_APPROVAL' | 'CLOSED' | 'CANCELLED';

// ALERT: cảnh báo thiết bị (BR-39) · OUTAGE: mất kết nối quá 30 phút · EXPERT: chuyên gia xác nhận cần tới nhà · ONSITE_CHECK: thợ thấy cảm biến hỏng · MANUAL: Farm Owner mở
export type WorkOrderOrigin = 'ALERT' | 'OUTAGE' | 'EXPERT' | 'ONSITE_CHECK' | 'MANUAL';

// ALERT-FR-018 — nguyên nhân thợ tìm thấy tại chỗ
export type SiteCause = 'WATER' | 'NOZZLE' | 'PUMP' | 'FAN' | 'DOOR' | 'SENSOR' | 'SPEAKER' | 'OTHER';

// Kết quả thợ báo khi xong việc
export type WorkOrderResult = 'REPAIRED' | 'SELF_RECOVERED';

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
  closed_at: string | null;
  escalated_at: string | null;
  history: WorkOrderHistoryEntry[];
}

// Phút, null khi không có mẫu (BR-40)
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
