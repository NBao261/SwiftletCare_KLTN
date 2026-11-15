import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deviceStockApi } from '@/apis/admin/deviceStock.api'
import type { ProvisionedDevice, ProvisionedDeviceKind } from '@/types'

const KEY = ['admin-device-stock']
/** Trần `limit` của backend (paginate) */
const PAGE_LIMIT = 100

/**
 * FARM-FR-010 — toàn bộ kho. Backend chỉ lọc theo loại / đã kích hoạt / đã thu hồi, không tìm kiếm, không lọc
 * theo trạng thái nhãn và sắp cố định theo ngày nhập, nên trang tải hết rồi tìm, lọc, sắp, cắt trang ở client.
 * ponytail: tải cả kho mỗi lần mở trang — đủ cho vài trăm thiết bị; nhiều hơn thì thêm search/sort vào backend.
 */
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

/** Mọi thao tác kho đều làm mới danh sách; kết quả (mã chỉ trả 1 lần) trả về cho nơi gọi hiện ngay */
function useStockMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export const useAddStockDevice = () =>
  useStockMutation((input: { device_id: string; kind: ProvisionedDeviceKind }) =>
    deviceStockApi.create(input).then(r => r.data.data))

export const useRevokeStockDevice = () =>
  useStockMutation(({ id, reason }: { id: string; reason: string }) =>
    deviceStockApi.revoke(id, reason).then(r => r.data.data))

export const useRotateStockKey = () =>
  useStockMutation((id: string) => deviceStockApi.rotateKey(id).then(r => r.data.data))

export const useRotateBrokerSecret = () =>
  useStockMutation((id: string) => deviceStockApi.rotateBrokerSecret(id).then(r => r.data.data))
