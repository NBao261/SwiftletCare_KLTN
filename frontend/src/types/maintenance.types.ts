// OPS-FR-005…008 — kế hoạch bảo trì phòng ngừa (api-spec MaintenancePlan, Report 3 §6.20)
export type MaintenanceEquipment = 'PUMP' | 'FAN' | 'SENSOR' | 'NOZZLE' | 'CALIBRATION';
export type MaintenanceBasis = 'RUN_HOURS' | 'SWITCHES' | 'CALENDAR';
export type MaintenancePlanState = 'SCHEDULED' | 'DUE' | 'OVERDUE' | 'RETIRED';

export interface MaintenanceRecord {
  work_order_id: string;
  node_id: string | null;
  kind: 'MAINTENANCE' | 'CALIBRATION';
  by: string;
  at: string;
  next_due_at: string | null;
}

export interface MaintenancePlan {
  _id: string;
  farm_id: string;
  house_id: string;
  equipment: MaintenanceEquipment;
  basis: MaintenanceBasis;
  interval: number;
  checklist_template: string[];
  state: MaintenancePlanState;
  next_due_at: string | null;
  due_since: string | null;
  last_done_at: string | null;
  source: string;
  note: string | null;
  comments: Array<{ by: string; text: string; at: string }>;
  records: MaintenanceRecord[];
  // Chỉ có ở GET /maintenance/due: Work Order phòng ngừa đang mở
  open_work_orders?: string[];
}
