import api from '@/lib/axios'
import type { ApiResponse, Alert, OnsiteObservation, SiteCause } from '@/types'

export const alertApi = {
  list: (params?: Record<string, string>) => api.get<ApiResponse<Alert[]>>('/alerts', { params }),
  getOne: (id: string) => api.get<ApiResponse<Alert>>(`/alerts/${id}`),
  // ghi chú và nguyên nhân tại chỗ đều tuỳ chọn
  acknowledge: (id: string, note?: string, cause?: SiteCause) =>
    api.put<ApiResponse<Alert>>(`/alerts/${id}/acknowledge`, { note, cause }),
  // Kỹ thuật viên trả lời kiểm tra tại chỗ; có ảnh thì gửi multipart
  answerOnsiteCheck: (id: string, input: { observation: OnsiteObservation; note?: string; photo?: File }) => {
    if (!input.photo) return api.post<ApiResponse<Alert>>(`/alerts/${id}/onsite-check`, { observation: input.observation, note: input.note })
    const form = new FormData()
    form.append('observation', input.observation)
    if (input.note) form.append('note', input.note)
    form.append('photo', input.photo)
    return api.post<ApiResponse<Alert>>(`/alerts/${id}/onsite-check`, form)
  },
}
