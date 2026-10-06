import { useQueryClient, useMutation } from '@tanstack/react-query'
import { maintenanceScheduleApi } from '@/apis/shared/maintenanceSchedules.api'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { CreateMaintenanceScheduleInput, UpdateMaintenanceScheduleInput } from '@/types'

const KEY = ['maintenance-schedules'] as const

/** TICKET-FR-013 — `farmId` rỗng = mọi farm user được phép xem. BE phân trang (mặc định 20) → trả kèm total. */
export function useMaintenanceSchedules(farmId: string | undefined, page: number, limit: number) {
  return usePaginatedListQuery(
    [...KEY, farmId ?? 'all', page, limit],
    () => maintenanceScheduleApi.list({ farmId, page, limit }),
    page,
    limit,
  )
}

export function useCreateMaintenanceSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMaintenanceScheduleInput) => maintenanceScheduleApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateMaintenanceSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMaintenanceScheduleInput }) =>
      maintenanceScheduleApi.update(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteMaintenanceSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => maintenanceScheduleApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
