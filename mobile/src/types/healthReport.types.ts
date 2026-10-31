// Báo cáo sức khoẻ và đánh giá ngày (EXPERT-FR-005/006, MF-11)

export interface ExpertConclusion {
  text: string
  by: { _id: string; full_name: string }
  at: string
}

// Báo cáo sức khoẻ của một Zone trong một kỳ — khớp ZoneHealthReport trong api-spec (chỉ các trường app đang dùng)
export interface ZoneHealthReport {
  _id: string
  farm_id: string
  zone_id: string
  period_start: string
  period_end: string
  generated_at: string
  // null khi chuyên gia chưa viết kết luận, hoặc farm không có chuyên gia
  expert_conclusion: ExpertConclusion | null
}

// Một ngày của một nhà đang chờ người dùng chấm (MF-11, BR-31) — CHƯA CÓ API (gap G-11).
// Dạng theo bảng HOUSE_HEALTH_DAY của Report 4 §6, cộng tên nhà/trang trại do server trả sẵn;
// không có trạng thái, lý do hay đánh giá của người khác vì người dùng phải chấm trước khi thấy
export interface PendingHealthDay {
  _id: string
  house_id: string
  house_name: string
  farm_id: string
  farm_name: string
  // Ngày cần đánh giá, YYYY-MM-DD giờ Việt Nam
  date: string
}
