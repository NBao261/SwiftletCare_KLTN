/** VISION-FR-019, BR-13, BR-21 — lịch đếm của nhà; api-spec CountingSchedule, CountingScheduleView */

/** Khung giờ VN 'HH:mm', nửa mở [start, end) */
export interface TimeWindow {
  start: string
  end: string
}

export interface DayWindows {
  morning: TimeWindow
  evening: TimeWindow
}

/** Hồ sơ theo mùa: khoảng ngày trong năm 'MM-DD', tính cả hai đầu; from sau to là khoảng vắt qua năm mới */
export interface SeasonalCountingProfile extends DayWindows {
  name: string
  from: string
  to: string
}

/** Khung tạm cho những ngày cụ thể 'YYYY-MM-DD', thắng hồ sơ theo mùa */
export interface TemporaryCountingWindow extends DayWindows {
  from: string
  to: string
}

export interface CountingSchedule {
  profiles: SeasonalCountingProfile[]
  temporary: TemporaryCountingWindow[]
}

export type CountingWindowSource = 'TEMPORARY' | 'PROFILE' | 'DEFAULT'

export interface CountingScheduleView {
  house_id: string
  schedule: CountingSchedule
  /** Lần sửa gần nhất áp từ ngày này; null khi chưa đặt lịch */
  effective_from: string | null
  default_windows: DayWindows
  /** Khung đang áp hôm nay (giờ VN) */
  today: DayWindows & { date: string; source: CountingWindowSource }
  history: Array<{
    effective_from: string
    changed_by: string
    changed_by_role: string
    changed_at: string
    schedule: CountingSchedule
  }>
}
