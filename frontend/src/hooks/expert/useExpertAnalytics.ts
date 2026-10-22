/**
 * useExpertAnalytics — Custom hooks cho màn hình 04_Analytics_Forecast_v3
 * Real API First → Mock fallback | SRS v2.1.4: ANALYTICS-FR-008/009/011, VISION-FR-009
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { expertService } from '@/services/expert.service'
import type {
  ForecastResponse,
  ControlPerformanceResponse,
  AutonomyResponse,
  BirdCountTrendsResponse,
  HarvestBatchItem,
} from '@/types/expert.types'

export type PerfRange = '1h' | '6h' | '24h' | '7d' | '30d'
export type BirdRange = '7d' | '14d' | '30d'

// ── 1. Dự báo vi khí hậu Holt ─────────────────────────────────────────────────
export function useHoltForecast(zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'forecast', zoneId],
    queryFn: async (): Promise<ForecastResponse> => {
      try {
        if (!zoneId) throw new Error('no zone')
        return await expertService.getForecast(zoneId)
      } catch {
        const { MOCK_FORECAST_RESPONSE } = await import('@/data/expertMock.data')
        return MOCK_FORECAST_RESPONSE
      }
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })
}

// ── 2. Hiệu năng điều khiển mờ ────────────────────────────────────────────────
export function useControlPerformance(zoneId?: string, range: PerfRange = '7d') {
  return useQuery({
    queryKey: ['expert', 'control-perf', zoneId, range],
    queryFn: async (): Promise<ControlPerformanceResponse> => {
      try {
        if (!zoneId) throw new Error('no zone')
        return await expertService.getControlPerformance(zoneId, range)
      } catch {
        const { MOCK_CONTROL_PERFORMANCE } = await import('@/data/expertMock.data')
        return MOCK_CONTROL_PERFORMANCE
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── 3. Tỷ lệ tự động hoá ─────────────────────────────────────────────────────
export function useAutonomy(zoneId?: string, range: PerfRange = '7d') {
  return useQuery({
    queryKey: ['expert', 'autonomy', zoneId, range],
    queryFn: async (): Promise<AutonomyResponse> => {
      try {
        if (!zoneId) throw new Error('no zone')
        return await expertService.getAutonomy(zoneId, range)
      } catch {
        const { MOCK_AUTONOMY } = await import('@/data/expertMock.data')
        return MOCK_AUTONOMY
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── 4. Xu hướng đàn chim ─────────────────────────────────────────────────────
export function useBirdCountTrends(zoneId?: string, days: number = 7) {
  return useQuery({
    queryKey: ['expert', 'bird-trends', zoneId, days],
    queryFn: async (): Promise<BirdCountTrendsResponse> => {
      try {
        if (!zoneId) throw new Error('no zone')
        return await expertService.getBirdCountTrends(zoneId, days)
      } catch {
        const { MOCK_BIRD_COUNT_TRENDS } = await import('@/data/expertMock.data')
        return MOCK_BIRD_COUNT_TRENDS
      }
    },
    staleTime: 10 * 60_000,
  })
}

// ── 5. Lịch sử thu hoạch ─────────────────────────────────────────────────────
export function useHarvestBatches(zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'harvests', zoneId],
    queryFn: async (): Promise<HarvestBatchItem[]> => {
      try {
        if (!zoneId) throw new Error('no zone')
        return await expertService.getHarvestBatches({ zoneId })
      } catch {
        const { MOCK_HARVEST_BATCHES } = await import('@/data/expertMock.data')
        return MOCK_HARVEST_BATCHES
      }
    },
    staleTime: 30 * 60_000,
  })
}

// ── Range state helpers ───────────────────────────────────────────────────────
export function usePerfRange() {
  const [range, setRange] = useState<PerfRange>('7d')
  return { range, setRange }
}
export function useBirdRange() {
  const [days, setDays] = useState<7 | 14 | 30>(7)
  return { days, setDays }
}
