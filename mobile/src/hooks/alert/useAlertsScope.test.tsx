import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native'
import { useAlertsScope } from '@/hooks/alert/useAlertsScope'
import { farmApi } from '@/services/api/farm.api'

jest.mock('expo-router', () => ({ router: { setParams: jest.fn() }, useLocalSearchParams: () => ({}) }))
jest.mock('@/services/api/farm.api', () => ({ farmApi: { list: jest.fn(), listHouses: jest.fn() } }))
jest.mock('@/stores/authStore', () => ({ useAuthStore: () => null }))
jest.mock('@/stores/farmPrefsStore', () => ({ useFarmPrefsStore: () => jest.fn() }))
jest.mock('@/hooks/farm/useFarmPrefs', () => ({ useFarmPrefs: () => ({ userId: 'user-1', prefs: {} }) }))

const listFarms = farmApi.list as unknown as jest.Mock<() => Promise<unknown>>
const listHouses = farmApi.listHouses as unknown as jest.Mock<() => Promise<unknown>>

const farmsResponse = { data: { data: [{ _id: 'farm-1', name: 'Farm 1', created_at: '2026-01-01T00:00:00.000Z' }] } }

const clients: QueryClient[] = []

async function renderScope() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = await renderHook(() => useAlertsScope(), { wrapper })
  return { result, client }
}

describe('useAlertsScope khi tải danh sách farm', () => {
  beforeEach(() => {
    listFarms.mockReset()
    listHouses.mockReset()
    listHouses.mockResolvedValue({ data: { data: [] } })
  })

  // Xoá cache để không còn timer gcTime giữ Jest lại sau khi chạy xong
  afterEach(async () => {
    await cleanup()
    clients.splice(0).forEach(client => client.clear())
  })

  it('lỗi mà chưa có danh sách: báo lỗi, không ở trạng thái chờ mãi', async () => {
    listFarms.mockRejectedValue(new Error('mất mạng'))
    const { result } = await renderScope()
    await waitFor(() => expect(result.current.isFarmsError).toBe(true))
    expect(result.current.isReady).toBe(false)
  })

  it('"Thử lại" tải được thì hết lỗi và sẵn sàng', async () => {
    listFarms.mockRejectedValueOnce(new Error('mất mạng'))
    const { result } = await renderScope()
    await waitFor(() => expect(result.current.isFarmsError).toBe(true))

    listFarms.mockResolvedValue(farmsResponse)
    await act(async () => {
      await result.current.retryFarms()
    })
    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(result.current.isFarmsError).toBe(false)
    expect(result.current.farmId).toBe('farm-1')
  })

  it('tải lại nền lỗi mà còn danh sách cũ: vẫn sẵn sàng, xem tiếp được', async () => {
    listFarms.mockResolvedValueOnce(farmsResponse)
    const { result, client } = await renderScope()
    await waitFor(() => expect(result.current.isReady).toBe(true))

    listFarms.mockRejectedValue(new Error('mất mạng'))
    await act(async () => {
      await client.refetchQueries({ queryKey: ['farms'] })
    })
    await waitFor(() => expect(client.getQueryState(['farms'])?.status).toBe('error'))
    expect(result.current.isFarmsError).toBe(false)
    expect(result.current.isReady).toBe(true)
    expect(result.current.farmId).toBe('farm-1')
  })
})
