import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deviceStockApi } from '@/apis/admin/deviceStock.api'
import type { ProvisionedDevice, ProvisionedDeviceKind } from '@/types'

const KEY = ['admin-device-stock']
// Trần `limit` của backend (paginate)
const PAGE_LIMIT = 100

// Backend không tìm và sắp được nên tải cả kho rồi xử lý ở client; nhiều thiết bị thì thêm search/sort vào backend
export function useDeviceStock() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ProvisionedDevice[]> => {
      const first = (await deviceStockApi.list({ page: 1, limit: PAGE_LIMIT })).data
      const pageCount = Math.ceil((first.meta?.total ?? first.data.length) / PAGE_LIMIT)
      const rest = await Promise.all(
        Array.from({ length: Math.max(pageCount - 1, 0) }, (_, i) =>
          deviceStockApi.list({ page: i + 2, limit: PAGE_LIMIT }).then(r => r.data.data)),
      )
      return [first.data, ...rest].flat()
    },
  })
}

// Mọi thao tác kho đều làm mới danh sách; kết quả (mã chỉ trả 1 lần) trả về cho nơi gọi hiện ngay
function useStockMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export const useAddStockDevice = () =>
  useStockMutation((input: { device_id: string; kind: ProvisionedDeviceKind; chip_mac?: string }) =>
    deviceStockApi.create(input).then(r => r.data.data))

// Mục kho của bo đang cắm: theo mã đọc từ chip, hoặc theo MAC khi chip mất mã (nạp lại toàn bộ); null khi chưa có
export const useFindStockDevice = () =>
  useMutation({
    mutationFn: (by: { deviceId: string } | { chipMac: string }): Promise<ProvisionedDevice | null> =>
      deviceStockApi.list({ ...by, limit: 1 }).then(r => r.data.data[0] ?? null),
  })

export const useRevokeStockDevice = () =>
  useStockMutation(({ id, reason }: { id: string; reason: string }) =>
    deviceStockApi.revoke(id, reason).then(r => r.data.data))

export const useRotateStockKey = () =>
  useStockMutation((id: string) => deviceStockApi.rotateKey(id).then(r => r.data.data))

export const useRotateBrokerSecret = () =>
  useStockMutation((id: string) => deviceStockApi.rotateBrokerSecret(id).then(r => r.data.data))

// Không đổi danh sách kho: chỉ tạo mã
export const useIssueSetupCode = () =>
  useMutation({ mutationFn: (id: string) => deviceStockApi.issueSetupCode(id).then(response => response.data.data) })
