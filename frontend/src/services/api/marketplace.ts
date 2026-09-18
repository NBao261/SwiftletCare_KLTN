import api from './client'
import type { ApiResponse, NestListing, ContactInquiry, ListingStatus } from '@/types'

export interface CreateListingInput {
  harvest_batch_id: string
  title: string
  description?: string
  price_vnd?: number
  contact_info?: { show_phone?: boolean; show_email?: boolean; show_zalo?: boolean }
}

/**
 * MARKET-FR-006..013 — phần Farm Owner (tạo/quản lý Nest Listing). Các endpoint
 * công khai cho Buyer (listings công khai, trace code, farm profile) chưa cần
 * ở frontend lần này — xem ghi chú phạm vi trong kế hoạch.
 */
export const marketplaceApi = {
  createListing: (input: CreateListingInput) => api.post<ApiResponse<NestListing>>('/marketplace/listings', input),
  updateListing: (id: string, input: Partial<{ title: string; description: string; price_vnd: number; listing_status: ListingStatus }>) =>
    api.put<ApiResponse<NestListing>>(`/marketplace/listings/${id}`, input),
  listInquiries: (listingId: string) => api.get<ApiResponse<ContactInquiry[]>>(`/marketplace/listings/${listingId}/inquiries`),
  getListingStats: (listingId: string) =>
    api.get<ApiResponse<{ view_count: number; inquiry_count: number; published_at?: string; listing_status: ListingStatus }>>(
      `/marketplace/listings/${listingId}/stats`,
    ),
}
