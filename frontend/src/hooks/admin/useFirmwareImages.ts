import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { firmwareImagesApi } from '@/apis/admin/firmwareImages.api'
import { sha256Hex } from '@/lib/firmwareFlasher'
import type { FirmwareImage } from '@/types'

const KEY = ['admin-firmware-images']

// Mới nhất trước (backend sắp theo số phiên bản): trạm nạp dùng phần tử đầu
export function useFirmwareImages() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<FirmwareImage[]> => (await firmwareImagesApi.list()).data.data,
  })
}

function useFirmwareMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useUploadFirmwareImage = () =>
  useFirmwareMutation((input: { version: string; note?: string; file: File }) =>
    firmwareImagesApi.upload(input).then(r => r.data.data))

export const useDeleteFirmwareImage = () =>
  useFirmwareMutation((id: string) => firmwareImagesApi.remove(id).then(() => id))

// Tải file và so SHA-256 với kho: lỗi đường truyền thì dừng trước khi ghi vào chip
export const useDownloadFirmwareImage = () =>
  useMutation({
    mutationFn: async (image: FirmwareImage): Promise<Uint8Array> => {
      const data = new Uint8Array((await firmwareImagesApi.download(image._id)).data)
      if ((await sha256Hex(data)) !== image.sha256) throw new Error('File firmware tải về bị hỏng. Thử lại.')
      return data
    },
  })
