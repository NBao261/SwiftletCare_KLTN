import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react-native'
import { useDeleteHarvestRun } from '@/hooks/harvest/useDeleteHarvestRun'
import { useSaveHarvestRun } from '@/hooks/harvest/useSaveHarvestRun'
import { harvestApi } from '@/services/api/harvest.api'

jest.mock('@/services/api/harvest.api', () => ({ harvestApi: { remove: jest.fn() } }))

const removeHarvest = harvestApi.remove as unknown as jest.Mock<() => Promise<unknown>>

const clients: QueryClient[] = []

// Client có sẵn đợt thu và chu kỳ thu trong cache để xem mutation có đánh dấu chúng cần tải lại không
function createClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  client.setQueryData(['harvests', 'farm-1'], [])
  client.setQueryData(['harvest-cycles', 'house-1'], [])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

describe('ghi / xoá lần thu tải lại chu kỳ thu (BR-43)', () => {
  // Xoá cache để không còn timer gcTime giữ Jest lại sau khi chạy xong
  afterEach(async () => {
    await cleanup()
    clients.splice(0).forEach(client => client.clear())
  })

  it('xoá lần thu thì chu kỳ thu cần tải lại', async () => {
    removeHarvest.mockResolvedValue({ data: { data: null } })
    const { client, wrapper } = createClient()
    const { result } = await renderHook(() => useDeleteHarvestRun('farm-1'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(['harvest-1'])
    })

    expect(client.getQueryState(['harvests', 'farm-1'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['harvest-cycles', 'house-1'])?.isInvalidated).toBe(true)
  })

  it('ghi lần thu thì chu kỳ thu cần tải lại', async () => {
    removeHarvest.mockResolvedValue({ data: { data: null } })
    const { client, wrapper } = createClient()
    const { result } = await renderHook(() => useSaveHarvestRun('farm-1'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync([{ kind: 'remove', nestType: 'RAW', harvestId: 'harvest-1' }])
    })

    expect(client.getQueryState(['harvest-cycles', 'house-1'])?.isInvalidated).toBe(true)
  })
})
