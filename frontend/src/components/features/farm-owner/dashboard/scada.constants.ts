// Đường dẫn trang chi tiết SCADA; phạm vi Nhà + Zone lấy từ khung lọc chung, không đưa id lên URL
export const SCADA_PATH = '/dashboard/scada';

// Thời hạn can thiệp chọn nhanh (phút); mặc định 30 phút theo ENV-FR-018, backend chặn tối đa 24 giờ
export const SCADA_DURATION_MINUTES = [15, 30, 60, 120];
export const SCADA_DEFAULT_DURATION_MINUTES = 30;
