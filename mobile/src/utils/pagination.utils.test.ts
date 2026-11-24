import { describe, expect, it } from '@jest/globals'
import { MAX_PAGE_LIMIT, fetchAllPages, type Page } from '@/utils/pagination.utils'

// Giả lập API có `total` bản ghi, mỗi trang tối đa MAX_PAGE_LIMIT
function buildFetchPage(total: number) {
  const requestedPages: number[] = []
  const fetchPage = (page: number): Promise<Page<number>> => {
    requestedPages.push(page)
    const start = (page - 1) * MAX_PAGE_LIMIT
    const items = Array.from({ length: Math.max(0, Math.min(MAX_PAGE_LIMIT, total - start)) }, (_, index) => start + index)
    return Promise.resolve({ items, total })
  }
  return { fetchPage, requestedPages }
}

describe('fetchAllPages', () => {
  it('một trang đủ thì chỉ gọi một lần', async () => {
    const { fetchPage, requestedPages } = buildFetchPage(35)
    expect(await fetchAllPages(fetchPage)).toHaveLength(35)
    expect(requestedPages).toEqual([1])
  })

  it('quá 100 bản ghi thì tải tiếp các trang còn lại', async () => {
    const { fetchPage, requestedPages } = buildFetchPage(250)
    const items = await fetchAllPages(fetchPage)
    expect(items).toHaveLength(250)
    expect(items[249]).toBe(249)
    expect(requestedPages).toEqual([1, 2, 3])
  })

  it('không có bản ghi nào thì trả mảng rỗng', async () => {
    const { fetchPage } = buildFetchPage(0)
    expect(await fetchAllPages(fetchPage)).toEqual([])
  })
})
