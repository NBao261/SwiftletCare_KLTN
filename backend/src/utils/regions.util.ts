import { BadRequestError } from '@/utils/appError.util'

/**
 * FARM-FR-009 / AUTH-FR-005c — danh mục khu vực cố định: 34 tỉnh/thành sau sắp xếp đơn
 * vị hành chính 2025. `farms.region` và `users.assigned_regions` chỉ lưu `code`.
 *
 * Trước đây region là chuỗi gõ tay và so khớp tuyệt đối: farm "hcmc" và Technician
 * "HCMC" không bao giờ gặp nhau, ticket của farm đó luôn rơi vào hàng đợi. Người dùng
 * vẫn được gõ tên/viết tắt quen thuộc hoặc tên tỉnh cũ đã sáp nhập (`aliases`) —
 * backend quy về `code` trước khi lưu.
 */
export interface Region { code: string; name: string; aliases: string[] }

export const REGIONS: readonly Region[] = [
  { code: 'HA_NOI', name: 'Hà Nội', aliases: ['HN', 'TP Hà Nội'] },
  { code: 'HAI_PHONG', name: 'Hải Phòng', aliases: ['HP', 'Hải Dương'] },
  { code: 'HUE', name: 'Huế', aliases: ['Thừa Thiên Huế', 'TT Huế'] },
  { code: 'DA_NANG', name: 'Đà Nẵng', aliases: ['Quảng Nam'] },
  { code: 'HCMC', name: 'TP. Hồ Chí Minh', aliases: ['HCM', 'TPHCM', 'Sài Gòn', 'Saigon', 'SG', 'Bình Dương', 'Bà Rịa - Vũng Tàu', 'Vũng Tàu', 'BRVT'] },
  { code: 'CAN_THO', name: 'Cần Thơ', aliases: ['Sóc Trăng', 'Hậu Giang'] },
  { code: 'TUYEN_QUANG', name: 'Tuyên Quang', aliases: ['Hà Giang'] },
  { code: 'CAO_BANG', name: 'Cao Bằng', aliases: [] },
  { code: 'LAI_CHAU', name: 'Lai Châu', aliases: [] },
  { code: 'LAO_CAI', name: 'Lào Cai', aliases: ['Yên Bái'] },
  { code: 'THAI_NGUYEN', name: 'Thái Nguyên', aliases: ['Bắc Kạn', 'Bắc Cạn'] },
  { code: 'DIEN_BIEN', name: 'Điện Biên', aliases: [] },
  { code: 'LANG_SON', name: 'Lạng Sơn', aliases: [] },
  { code: 'SON_LA', name: 'Sơn La', aliases: [] },
  { code: 'PHU_THO', name: 'Phú Thọ', aliases: ['Vĩnh Phúc', 'Hòa Bình'] },
  { code: 'BAC_NINH', name: 'Bắc Ninh', aliases: ['Bắc Giang'] },
  { code: 'QUANG_NINH', name: 'Quảng Ninh', aliases: [] },
  { code: 'HUNG_YEN', name: 'Hưng Yên', aliases: ['Thái Bình'] },
  { code: 'NINH_BINH', name: 'Ninh Bình', aliases: ['Hà Nam', 'Nam Định'] },
  { code: 'THANH_HOA', name: 'Thanh Hóa', aliases: [] },
  { code: 'NGHE_AN', name: 'Nghệ An', aliases: [] },
  { code: 'HA_TINH', name: 'Hà Tĩnh', aliases: [] },
  { code: 'QUANG_TRI', name: 'Quảng Trị', aliases: ['Quảng Bình'] },
  { code: 'QUANG_NGAI', name: 'Quảng Ngãi', aliases: ['Kon Tum'] },
  { code: 'GIA_LAI', name: 'Gia Lai', aliases: ['Bình Định'] },
  { code: 'KHANH_HOA', name: 'Khánh Hòa', aliases: ['Ninh Thuận'] },
  { code: 'LAM_DONG', name: 'Lâm Đồng', aliases: ['Đắk Nông', 'Bình Thuận'] },
  { code: 'DAK_LAK', name: 'Đắk Lắk', aliases: ['Đắc Lắc', 'Phú Yên'] },
  { code: 'DONG_NAI', name: 'Đồng Nai', aliases: ['Bình Phước'] },
  { code: 'TAY_NINH', name: 'Tây Ninh', aliases: ['Long An'] },
  { code: 'VINH_LONG', name: 'Vĩnh Long', aliases: ['Bến Tre', 'Trà Vinh'] },
  { code: 'DONG_THAP', name: 'Đồng Tháp', aliases: ['Tiền Giang'] },
  { code: 'CA_MAU', name: 'Cà Mau', aliases: ['Bạc Liêu'] },
  { code: 'AN_GIANG', name: 'An Giang', aliases: ['Kiên Giang'] },
]

export const REGION_CODES: ReadonlySet<string> = new Set(REGIONS.map(r => r.code))

/** Bỏ dấu, hoa/thường, khoảng trắng/ký tự nối và tiền tố "TP"/"Thành phố"/"Tỉnh" */
function normalizeKey(text: string): string {
  const flat = text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]/g, '')
  return flat.replace(/^(thanhpho|tinh|tp)(?=.)/, '')
}

const LOOKUP = new Map<string, string>()
for (const region of REGIONS) {
  for (const key of [region.code, region.name, ...region.aliases]) LOOKUP.set(normalizeKey(key), region.code)
}

/** Mã, tên hoặc tên cũ → `code`; không nhận ra thì null */
export function toRegionCode(input: string | undefined | null): string | null {
  if (!input?.trim()) return null
  return LOOKUP.get(normalizeKey(input)) ?? null
}

/** Như `toRegionCode` nhưng ném 400 kèm gợi ý — dùng ở chỗ ghi dữ liệu */
export function assertRegionCode(input: string): string {
  const code = toRegionCode(input)
  if (!code) {
    throw BadRequestError(`Khu vực "${input}" không có trong danh mục 34 tỉnh/thành — xem GET /farms/regions`)
  }
  return code
}

/** Danh mục trả cho dropdown (không kèm alias) */
export function listRegions(): Array<{ code: string; name: string }> {
  return REGIONS.map(({ code, name }) => ({ code, name }))
}
