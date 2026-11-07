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

// Danh sách của tab Cảnh báo: khoá ['alerts','list',…] và ['alerts','counts',…], có thể tải nhiều trang
const isAlertListKey = (key: readonly unknown[]) => key[1] === 'list' || key[1] === 'counts'

// Có cảnh báo mới, vừa xác nhận hoặc phán quyết: số đếm, chi tiết… tải lại ngay; danh sách của tab Cảnh báo chỉ đánh dấu
// cũ — tab Cảnh báo tự tải lại khi đang hiện (watchInvalidatedAlertLists)
export function invalidateAlertQueries(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['alerts'], predicate: query => !isAlertListKey(query.queryKey) }),
    client.invalidateQueries({
      queryKey: ['alerts'],
      predicate: query => isAlertListKey(query.queryKey),
      refetchType: 'none',
    }),
  ])
}

// Tải lại danh sách đang dùng mà đã bị đánh dấu cũ. Không dựa vào isStale: query lỗi không có dữ liệu luôn "stale" nên sẽ tải
// lại mãi. Query đang lỗi cũng bỏ qua (isInvalidated không tự xoá khi tải lỗi): chờ "Thử lại", kéo làm mới hoặc nhịp 30 giây
function refetchInvalidatedAlertLists(client: QueryClient) {
  return client.refetchQueries({
    queryKey: ['alerts'],
    type: 'active',
    predicate: query =>
      isAlertListKey(query.queryKey) &&
      query.state.isInvalidated &&
      query.state.status !== 'error' &&
      query.state.fetchStatus === 'idle',
  })
}

// Tab Cảnh báo đang hiện: tải lại phần đã cũ trong lúc tab ẩn, rồi tải lại mỗi khi có query bị đánh dấu cũ. Chỉ chạy theo sự
// kiện "invalidate" nên một lần tải lỗi không kích hoạt lần tải kế. Trả về hàm huỷ theo dõi
export function watchInvalidatedAlertLists(client: QueryClient): () => void {
  void refetchInvalidatedAlertLists(client)
  return client.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'invalidate') void refetchInvalidatedAlertLists(client)
  })
}
