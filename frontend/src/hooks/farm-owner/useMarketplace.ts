import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { marketplaceApi } from '@/apis/farm-owner/marketplace.api'
import type { CreateListingInput } from '@/apis/farm-owner/marketplace.api'
import type { ListingStatus } from '@/types'

/** MARKET-FR-006 — tạo Nest Listing từ 1 Harvest Batch */
export function useCreateListing(farmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateListingInput) => marketplaceApi.createListing(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['harvests', farmId] }),
  })
}

export function useUpdateListing(farmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; title?: string; description?: string; price_vnd?: number; listing_status?: ListingStatus }) =>
      marketplaceApi.updateListing(id, input),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['harvests', farmId] })
      void queryClient.invalidateQueries({ queryKey: ['listing-stats', id] })
    },
  })
}

/** MARKET-FR-010 — Farm Owner xem danh sách liên hệ của 1 tin đăng */
export function useListingInquiries(listingId: string | undefined) {
  return useQuery({
    queryKey: ['listing-inquiries', listingId],
    queryFn: () => marketplaceApi.listInquiries(listingId!).then(r => r.data.data),
    enabled: !!listingId,
  })
}

/** MARKET-FR-012 — lượt xem/liên hệ */
export function useListingStats(listingId: string | undefined) {
  return useQuery({
    queryKey: ['listing-stats', listingId],
    queryFn: () => marketplaceApi.getListingStats(listingId!).then(r => r.data.data),
    enabled: !!listingId,
  })
}

/**
 * MARKET-FR-012 (biến thể) — lượt xem/liên hệ của NHIỀU tin đăng cùng lúc, dùng
 * cho bảng ListingsTab (mỗi dòng 1 listing). Cùng queryKey ['listing-stats', id]
 * với `useListingStats` nên chia sẻ cache với ListingPanel (modal chi tiết) —
 * tránh phải gọi `useListingStats` lặp lại trong từng ô (status/lượt xem/lượt
 * liên hệ) của cùng 1 dòng bảng.
 */
export function useListingStatsMany(listingIds: string[]) {
  return useQueries({
    queries: listingIds.map(id => ({
      queryKey: ['listing-stats', id],
      queryFn: () => marketplaceApi.getListingStats(id).then(r => r.data.data),
    })),
    combine: results => ({
      isLoading: results.some(r => r.isLoading),
      statsById: new Map(listingIds.map((id, i) => [id, results[i].data])),
    }),
  })
}
