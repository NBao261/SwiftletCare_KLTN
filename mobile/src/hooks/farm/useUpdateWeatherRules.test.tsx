import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react-native'
import { useUpdateWeatherRules } from '@/hooks/farm/useUpdateWeatherRules'
import { farmApi } from '@/services/api/farm.api'
import type { WeatherRulesView } from '@/types'

jest.mock('@/services/api/farm.api', () => ({ farmApi: { updateWeatherRules: jest.fn() } }))

const updateWeatherRules = farmApi.updateWeatherRules as unknown as jest.Mock<() => Promise<unknown>>

const clients: QueryClient[] = []

const lastCompensation: WeatherRulesView['last_compensation'] = {
  rule_id: 'rule-1',
  offset_pct: 5,
  sent_at: '2026-11-20T01:10:00.000Z',
  expires_at: '2026-11-20T02:10:00.000Z',
  forecast: { temperature_max: 34, humidity_max: null, rain_mm: null },
}

describe('useUpdateWeatherRules', () => {
  // Xoá cache để không còn timer gcTime giữ Jest lại sau khi chạy xong
  afterEach(async () => {
    await cleanup()
    clients.splice(0).forEach(client => client.clear())
  })

  it('lưu xong thay luật nhưng giữ lần bù gần nhất (PUT không trả last_compensation)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    clients.push(client)
    client.setQueryData<WeatherRulesView>(['weather-rules', 'house-1'], {
      house_id: 'house-1',
      rules: [],
      last_compensation: lastCompensation,
    })
    const savedRule = { _id: 'rule-1', metric: 'temperature_max', min: 33, offset_pct: 5, duration_min: 60, active: true }
    updateWeatherRules.mockResolvedValue({ data: { data: { house_id: 'house-1', rules: [savedRule] } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = await renderHook(() => useUpdateWeatherRules(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ houseId: 'house-1', rules: [] })
    })

    const view = client.getQueryData<WeatherRulesView>(['weather-rules', 'house-1'])
    expect(view?.rules).toEqual([savedRule])
    expect(view?.last_compensation).toEqual(lastCompensation)
  })
})
