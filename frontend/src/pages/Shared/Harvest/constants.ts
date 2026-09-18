import type { NestType, ListingStatus } from '@/types'

export const NEST_TYPE_LABEL: Record<NestType, string> = { RAW: 'Yến thô', CLEANED: 'Yến tinh chế', PREMIUM: 'Yến cao cấp' }
export const HARVEST_STATUS_TONE = { DRAFT: 'neutral', LISTED: 'positive', ARCHIVED: 'neutral' } as const
export const HARVEST_STATUS_LABEL = { DRAFT: 'Chưa đăng bán', LISTED: 'Đang đăng bán', ARCHIVED: 'Lưu trữ' } as const
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = { AVAILABLE: 'Đang bán', SOLD: 'Đã bán hết', HIDDEN: 'Đang ẩn' }
