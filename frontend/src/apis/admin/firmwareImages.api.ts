import api from '@/lib/axios'
import type { ApiResponse, FirmwareImage } from '@/types'

// File ~1,2 MB: mạng chậm cần hơn 10 giây mặc định của axios
const FILE_TIMEOUT_MS = 120_000

// Kho firmware cho trạm nạp ở màn Kho thiết bị; file chỉ tải về qua route có đăng nhập (chứa giá trị Secrets.h)
export const firmwareImagesApi = {
  list: () => api.get<ApiResponse<FirmwareImage[]>>('/admin/firmware-images'),

  upload: (input: { version: string; note?: string; file: File }) => {
    const form = new FormData()
    form.append('version', input.version)
    if (input.note) form.append('note', input.note)
    form.append('file', input.file)
    return api.post<ApiResponse<FirmwareImage>>('/admin/firmware-images', form, { timeout: FILE_TIMEOUT_MS })
  },

  // Nhị phân, kèm SHA-256 ở header để kiểm trước khi ghi vào chip
  download: (id: string) => api.get<ArrayBuffer>(`/admin/firmware-images/${id}/file`, { responseType: 'arraybuffer', timeout: FILE_TIMEOUT_MS }),

  remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/firmware-images/${id}`),
}
