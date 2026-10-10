import type { NestType, ListingStatus } from '@/types'

export const NEST_TYPE_LABEL: Record<NestType, string> = { RAW: 'Yến thô', CLEANED: 'Yến tinh chế', PREMIUM: 'Yến cao cấp' }
export const HARVEST_STATUS_TONE = { DRAFT: 'neutral', LISTED: 'positive', ARCHIVED: 'neutral' } as const
export const HARVEST_STATUS_LABEL = { DRAFT: 'Chưa đăng bán', LISTED: 'Đang đăng bán', ARCHIVED: 'Lưu trữ' } as const
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = { AVAILABLE: 'Đang bán', SOLD: 'Đã bán hết', HIDDEN: 'Đang ẩn' }
export const LISTING_STATUS_TONE = { AVAILABLE: 'positive', SOLD: 'neutral', HIDDEN: 'warning' } as const

// Nút "Chi tiết" trong bảng (HarvestTable, ListingsTab) — hover dùng viền chìm
// (ring-inset) thay vì đổi nền sang màu mè, đúng chuẩn Minimal Luxury: không
// nền xanh lá/đỏ khi hover, chỉ viền than nhạt dần vào trong + nền be siêu nhạt.
export const DETAIL_BUTTON_CLASS =
  'rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-charcoal transition-all duration-200 ease-in-out hover:bg-gray-50 hover:ring-1 hover:ring-inset hover:ring-charcoal'
