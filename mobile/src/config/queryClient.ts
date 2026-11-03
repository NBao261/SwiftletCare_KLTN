import { QueryClient } from '@tanstack/react-query'

const FIVE_MINUTES = 5 * 60 * 1000
const TEN_MINUTES = 10 * 60 * 1000

// React Query dùng chung cả app: dữ liệu còn mới 5 phút, giữ cache 10 phút
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES,
      gcTime: TEN_MINUTES,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Kéo để làm mới / "Thử lại": tải lại mọi dữ liệu đang hiện (các tab vẫn sống nên gồm cả tab khác), trừ token xem camera —
// token mới đổi URL HLS nên video đang phát sẽ khởi động lại (mở lại trình phát thì useCameraStreamUrl tự xin token mới)
export function refetchVisibleQueries(client: QueryClient) {
  return client.refetchQueries({ type: 'active', predicate: query => query.queryKey[0] !== 'stream-token' })
}

// Có cảnh báo mới, vừa xác nhận hoặc phán quyết: số đếm, chi tiết… tải lại ngay; danh sách của tab Cảnh báo (khoá
// ['alerts','list',…] và ['alerts','counts',…], có thể tải nhiều trang) chỉ đánh dấu cũ — tab Cảnh báo tự tải lại khi đang hiện
export function invalidateAlertQueries(client: QueryClient) {
  const isAlertListKey = (key: readonly unknown[]) => key[1] === 'list' || key[1] === 'counts'
  return Promise.all([
    client.invalidateQueries({ queryKey: ['alerts'], predicate: query => !isAlertListKey(query.queryKey) }),
    client.invalidateQueries({
      queryKey: ['alerts'],
      predicate: query => isAlertListKey(query.queryKey),
      refetchType: 'none',
    }),
  ])
}
