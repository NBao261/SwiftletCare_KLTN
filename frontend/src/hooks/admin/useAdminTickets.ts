import { useQuery } from '@tanstack/react-query'
import { ticketApi, type ListTicketsQuery } from '@/apis/shared/tickets.api'
import type { Ticket } from '@/types'

/** Trần `limit` của backend (utils/helpers.util.ts#paginate) — không lấy được nhiều hơn trong 1 request */
const PAGE_LIMIT = 100

/**
 * TOÀN BỘ ticket khớp bộ lọc server (farm/trạng thái/ưu tiên) cho bảng Ticket của Admin.
 * GET /tickets không có search/sort, nên muốn tìm kiếm + sắp xếp trên mọi ticket rồi phân
 * trang đúng số kết quả thì phải có đủ dữ liệu ở client: gọi trang 1 lấy `meta.total`, rồi
 * song song các trang còn lại. Key dưới ['tickets'] → mọi mutation ticket tự làm mới.
 *
 * ponytail: tải hết về client — ổn ở quy mô KLTN (vài trăm ticket = vài request 100 dòng).
 * Khi số ticket lên hàng nghìn thì thêm ?search=&sortBy= vào GET /tickets và phân trang server.
 */
export function useAllTickets(query: Omit<ListTicketsQuery, 'page' | 'limit'>) {
  return useQuery({
    queryKey: ['tickets', 'all', query],
    queryFn: async (): Promise<Ticket[]> => {
      const first = await ticketApi.list({ ...query, page: 1, limit: PAGE_LIMIT })
      const total = first.data.meta?.total ?? first.data.data.length
      const pageCount = Math.ceil(total / PAGE_LIMIT)
      const rest = await Promise.all(
        Array.from({ length: Math.max(pageCount - 1, 0) }, (_, i) =>
          ticketApi.list({ ...query, page: i + 2, limit: PAGE_LIMIT }),
        ),
      )
      return [first, ...rest].flatMap(r => r.data.data)
    },
  })
}
