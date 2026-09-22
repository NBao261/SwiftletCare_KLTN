import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
