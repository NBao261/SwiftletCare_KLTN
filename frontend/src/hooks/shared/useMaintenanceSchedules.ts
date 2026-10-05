import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { maintenanceScheduleApi } from '@/apis/shared/maintenanceSchedules.api'
import type { CreateMaintenanceScheduleInput, UpdateMaintenanceScheduleInput } from '@/types'

const KEY = ['maintenance-schedules'] as const

/** TICKET-FR-013 — `farmId` rỗng = mọi farm user được phép xem */
export function useMaintenanceSchedules(farmId?: string) {
  return useQuery({
    queryKey: [...KEY, farmId ?? 'all'],
    queryFn: () => maintenanceScheduleApi.list(farmId).then(r => r.data.data),
  })
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
