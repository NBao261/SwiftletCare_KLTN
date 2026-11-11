import { useInfiniteQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import type { Alert } from '@/types'
import {
  type AlertChainPageParam,
  buildAlertChain,
  fetchAlertChainPage,
  getNextAlertChainPage,
  type ServerAlertFilter,
  toAlertQueryParams,
} from '@/utils/alertList.utils'
import type { SeverityLevel } from '@/utils/severity.utils'

const PAGE_SIZE = 20

interface PagedAlertListInput {
  statuses: readonly Alert['status'][]
  filter: ServerAlertFilter
  // Cấp đang lọc: lọc ở server theo từng mức backend của cấp đó
  level: SeverityLevel | null
  enabled: boolean
  // Tải lại định kỳ (ms) — chỉ phần "Đang hiệu lực" khi tab Cảnh báo đang hiện; false thì không
  refetchInterval: number | false
}

// Danh sách cảnh báo khi không lọc theo nhà (ALERT-FR-007): phân trang theo meta.total ở server, lọc farm, loại, phán quyết,
// mức bằng tham số GET /alerts. Backend nhận một trạng thái và một mức mỗi lần nên tải theo chuỗi (buildAlertChain): xong
// trạng thái/mức này mới sang cái sau, mỗi mắt mới nhất trước
export function usePagedAlertList({ statuses, filter, level, enabled, refetchInterval }: PagedAlertListInput) {
  const chain = buildAlertChain(statuses, level)

  return useInfiniteQuery({
    queryKey: ['alerts', 'list', 'paged', statuses.join(','), filter, level],
    queryFn: ({ pageParam }) =>
      fetchAlertChainPage(chain, pageParam, (link, page) =>
        alertApi.list(toAlertQueryParams(filter, link, page, PAGE_SIZE)).then(response => ({
          items: response.data.data,
          total: response.data.meta?.total ?? 0,
        })),
      ),
    initialPageParam: { link: 0, page: 1 } as AlertChainPageParam,
    getNextPageParam: (_lastPage, pages) => getNextAlertChainPage(chain.length, pages),
    enabled,
    refetchInterval,
  })
}
