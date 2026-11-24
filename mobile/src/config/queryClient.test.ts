import { afterEach, describe, expect, it } from '@jest/globals'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { invalidateAlertQueries, watchInvalidatedAlertLists } from '@/config/queryClient'

const LIST_KEY = ['alerts', 'list', 'paged']

// Chờ các lần tải đang chạy xong, đủ lâu để một vòng lặp tải lại (nếu có) lộ ra ở số lần gọi
const settle = () => new Promise<void>(resolve => setTimeout(() => resolve(), 20))

describe('watchInvalidatedAlertLists', () => {
  const clients: QueryClient[] = []
  const cleanups: (() => void)[] = []

  // Một danh sách đang được màn hình dùng, queryFn do test quyết định kết quả
  function mountList(queryFn: () => Promise<string>) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } })
    clients.push(client)
    cleanups.push(new QueryObserver(client, { queryKey: LIST_KEY, queryFn }).subscribe(() => undefined))
    return client
  }

  function watch(client: QueryClient) {
    const stop = watchInvalidatedAlertLists(client)
    cleanups.push(stop)
    return stop
  }

  afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup())
    clients.splice(0).forEach(client => client.clear())
  })

  it('danh sách bị đánh dấu cũ khi tab đang hiện thì tải lại đúng một lần', async () => {
    let calls = 0
    const client = mountList(() => Promise.resolve(`lần ${++calls}`))
    await settle()
    watch(client)
    await invalidateAlertQueries(client)
    await settle()
    expect(calls).toBe(2)
  })

  it('tab đang ẩn thì chỉ đánh dấu; hiện lại mới tải, đúng một lần', async () => {
    let calls = 0
    const client = mountList(() => Promise.resolve(`lần ${++calls}`))
    await settle()
    await invalidateAlertQueries(client)
    await settle()
    expect(calls).toBe(1)
    watch(client)
    await settle()
    expect(calls).toBe(2)
  })

  it('query lỗi không có dữ liệu: không tải lại khi tab hiện lẫn khi bị đánh dấu cũ', async () => {
    let calls = 0
    const client = mountList(() => {
      calls += 1
      return Promise.reject(new Error('400'))
    })
    await settle()
    expect(calls).toBe(1)
    watch(client)
    await settle()
    await invalidateAlertQueries(client)
    await settle()
    expect(calls).toBe(1)
  })

  it('tải lại sau khi đánh dấu cũ mà lỗi thì dừng, không lặp (cờ cũ vẫn còn trên query)', async () => {
    let calls = 0
    const client = mountList(() => {
      calls += 1
      return calls === 1 ? Promise.resolve('ok') : Promise.reject(new Error('mất mạng'))
    })
    await settle()
    watch(client)
    await invalidateAlertQueries(client)
    await settle()
    expect(calls).toBe(2)
    expect(client.getQueryState(LIST_KEY)?.isInvalidated).toBe(true)
    await settle()
    expect(calls).toBe(2)
  })

  it('huỷ theo dõi thì không tải lại nữa', async () => {
    let calls = 0
    const client = mountList(() => Promise.resolve(`lần ${++calls}`))
    await settle()
    watch(client)()
    await invalidateAlertQueries(client)
    await settle()
    expect(calls).toBe(1)
  })
})
