import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ownerProfilesApi } from '@/apis/farm-owner/profiles.api'

// hồ sơ đã duyệt của 1 farm (chỉ hồ sơ APPROVED mới áp được)
export function useApprovedProfiles(farmId: string | undefined) {
  return useQuery({
    queryKey: ['profiles', farmId ?? '', 'APPROVED'],
    queryFn: () => ownerProfilesApi.listApproved(farmId!).then(response => response.data.data ?? []),
    enabled: !!farmId,
  })
}

// Áp hồ sơ: ngưỡng, hệ số, tham số của các zone đổi và có phiên bản cấu hình mới
export function useApplyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, houseIds }: { profileId: string; houseIds: string[] }) =>
      ownerProfilesApi.apply(profileId, houseIds).then(response => response.data.data),
    onSuccess: () => {
      for (const key of ['profiles', 'zones', 'zone', 'farm-zones', 'all-zones', 'sensor-nodes']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
  })
}
