// React Query hooks cho hồ sơ cấu hình
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profilesApi } from '@/apis/domain-expert/profiles.api'
import type { ConfigProfileInput, ConfigProfileStatus } from '@/types/expert.types'

const KEY = (farmId: string, status?: string) => ['profiles', farmId, status ?? 'all']

export function useProfiles(farmId: string | undefined | null, status?: ConfigProfileStatus) {
  return useQuery({
    queryKey: KEY(farmId ?? '', status),
    queryFn: () => profilesApi.list(farmId!, status).then(r => r.data.data ?? []),
    enabled: !!farmId,
    staleTime: 30_000,
  })
}

export function useCreateProfile(farmId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ConfigProfileInput) => profilesApi.create(farmId!, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profiles', farmId ?? ''] }) },
  })
}

export function useUpdateProfile(farmId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfigProfileInput }) =>
      profilesApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles', farmId ?? ''] })
    },
  })
}

export function useApproveProfile(farmId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => profilesApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles', farmId ?? ''] })
    },
  })
}

export function useArchiveProfile(farmId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => profilesApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles', farmId ?? ''] })
    },
  })
}
