/**
 * Dịch vụ gọi API và dữ liệu dự phòng cho phân hệ Chuyên gia nuôi yến (DOMAIN_EXPERT)
 * Khớp 100% tài liệu Backend routes/controllers/models và SRS v2.1.4
 * Re-export từ các modules dịch vụ chuyên biệt (< 180 dòng/file)
 */

export { expertApi } from './expert/expertApi.service'
export { expertService } from './expert/expertFallback.service'
