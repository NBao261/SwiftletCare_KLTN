// Module MAINTENANCE (TICKET-FR-013) — lịch bảo trì định kỳ theo Farm.
// Mirror `backend/src/models/maintenanceSchedule.model.ts`.

export interface MaintenanceSchedule {
  _id: string
  farm_id: string
  zone_id?: string
  description: string
  /** 1–365 ngày */
  interval_days: number
  /** ISO — tới hạn thì job tạo ticket MAINTENANCE sớm LEAD_DAYS ngày rồi dời sang chu kỳ kế */
  next_due_at: string
  is_active: boolean
  created_by?: string
  last_ticket_id?: string
  last_generated_at?: string
  created_at: string
}

/** POST /maintenance-schedules */
export interface CreateMaintenanceScheduleInput {
  farm_id: string
  zone_id?: string
  description: string
  interval_days: number
  /** ISO8601 — phải ở tương lai, trong khung 07:00–18:00 giờ VN */
  next_due_at: string
}

/** PUT /maintenance-schedules/:id — gửi trường nào sửa trường đó */
export interface UpdateMaintenanceScheduleInput {
  zone_id?: string
  description?: string
  interval_days?: number
  next_due_at?: string
  is_active?: boolean
}
