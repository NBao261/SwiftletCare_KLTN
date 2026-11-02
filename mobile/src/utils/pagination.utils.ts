// Mức tối đa một trang của mọi danh sách có phân trang (docs/api/api-spec.yaml, parameters.Limit)
export const MAX_PAGE_LIMIT = 100

export interface Page<Item> {
  items: Item[]
  // meta.total của response: tổng số bản ghi khớp bộ lọc
  total: number
}

// Tải đủ mọi trang theo meta.total: trang đầu trước, còn thiếu thì tải các trang còn lại cùng lúc
export async function fetchAllPages<Item>(fetchPage: (page: number) => Promise<Page<Item>>): Promise<Item[]> {
  const firstPage = await fetchPage(1)
  const pageCount = Math.ceil(firstPage.total / MAX_PAGE_LIMIT)
  const otherPages = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => fetchPage(index + 2)),
  )
  return [firstPage, ...otherPages].flatMap(page => page.items)
}
