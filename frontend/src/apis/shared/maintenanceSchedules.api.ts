import api from '@/lib/axios'
import type {
  ApiResponse, MaintenanceSchedule, CreateMaintenanceScheduleInput, UpdateMaintenanceScheduleInput,
} from '@/types'

/** TICKET-FR-013 — Technician/Admin CRUD, Farm Owner chỉ xem (BE requireRole) */
export const maintenanceScheduleApi = {
  list:   (farmId?: string) =>
    api.get<ApiResponse<MaintenanceSchedule[]>>('/maintenance-schedules', { params: farmId ? { farmId } : undefined }),
  create: (input: CreateMaintenanceScheduleInput) =>
    api.post<ApiResponse<MaintenanceSchedule>>('/maintenance-schedules', input),
  update: (id: string, input: UpdateMaintenanceScheduleInput) =>
    api.put<ApiResponse<MaintenanceSchedule>>(`/maintenance-schedules/${id}`, input),
  remove: (id: string) => api.delete<ApiResponse<null>>(`/maintenance-schedules/${id}`),
}
