import api from '@/lib/axios'
import type { ApiResponse, AudioTrack, SensorNode } from '@/types'

const base = (nodeId: string) => `/devices/sensor-nodes/${nodeId}`

/** ENV-FR-013c — danh mục file loa ru của 1 thiết bị */
export const audioTrackApi = {
  list: (nodeId: string) => api.get<ApiResponse<AudioTrack[]>>(`${base(nodeId)}/audio-tracks`),

  // Technician/Admin
  upload: (nodeId: string, input: { file: File; track_number: number; display_name: string }) => {
    const form = new FormData()
    form.append('file', input.file)
    form.append('track_number', String(input.track_number))
    form.append('display_name', input.display_name)
    // File tới 10MB — timeout mặc định 10s của axios instance quá ngắn cho mạng chậm
    return api.post<ApiResponse<AudioTrack>>(`${base(nodeId)}/audio-tracks`, form, { timeout: 120_000 })
  },
  setSyncStatus: (nodeId: string, trackId: string, synced: boolean) =>
    api.put<ApiResponse<AudioTrack>>(`${base(nodeId)}/audio-tracks/${trackId}/sync-status`, { synced_to_sd: synced }),
  remove: (nodeId: string, trackId: string) => api.delete(`${base(nodeId)}/audio-tracks/${trackId}`),

  // Farm Owner
  select: (nodeId: string, trackId: string) =>
    api.put<ApiResponse<SensorNode>>(`${base(nodeId)}/audio-tracks/${trackId}/select`),
  playNow: (nodeId: string, trackId: string) => api.post(`${base(nodeId)}/audio-tracks/${trackId}/play-now`),
  stop: (nodeId: string) => api.post(`${base(nodeId)}/audio/stop`),
}
