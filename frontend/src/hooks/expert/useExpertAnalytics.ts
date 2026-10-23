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
} from '@/types/expert.types'

export type PerfRange = '1h' | '6h' | '24h' | '7d' | '30d'
export type BirdRange = '7d' | '14d' | '30d'

// ── 1. Dự báo vi khí hậu Holt ─────────────────────────────────────────────────
export function useHoltForecast(zoneId?: string) {
  return useQuery<ForecastResponse>({
    queryKey: ['expert', 'forecast', zoneId],
    queryFn: () => (zoneId ? expertService.getForecast(zoneId) : Promise.reject(new Error('no zone'))),
    enabled: Boolean(zoneId),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })
}

// ── 2. Hiệu năng điều khiển mờ ────────────────────────────────────────────────
export function useControlPerformance(zoneId?: string, range: PerfRange = '7d') {
  return useQuery<ControlPerformanceResponse>({
    queryKey: ['expert', 'control-perf', zoneId, range],
    queryFn: () => (zoneId ? expertService.getControlPerformance(zoneId, range) : Promise.reject(new Error('no zone'))),
    enabled: Boolean(zoneId),
    staleTime: 5 * 60_000,
  })
}

// ── 3. Tỷ lệ tự động hoá ─────────────────────────────────────────────────────
export function useAutonomy(zoneId?: string, range: PerfRange = '7d') {
  return useQuery<AutonomyResponse>({
    queryKey: ['expert', 'autonomy', zoneId, range],
    queryFn: () => (zoneId ? expertService.getAutonomy(zoneId, range) : Promise.reject(new Error('no zone'))),
    enabled: Boolean(zoneId),
    staleTime: 5 * 60_000,
  })
}

// ── 4. Xu hướng đàn chim ─────────────────────────────────────────────────────
export function useBirdCountTrends(zoneId?: string, days: number = 7) {
  return useQuery<BirdCountTrendsResponse>({
    queryKey: ['expert', 'bird-trends', zoneId, days],
    queryFn: () => (zoneId ? expertService.getBirdCountTrends(zoneId, days) : Promise.reject(new Error('no zone'))),
    enabled: Boolean(zoneId),
    staleTime: 10 * 60_000,
  })
}

// ── 5. Lịch sử thu hoạch ─────────────────────────────────────────────────────
export function useHarvestBatches(zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'harvests', zoneId],
    queryFn: () => (zoneId ? expertService.getHarvestBatches({ zoneId }) : Promise.resolve([])),
    enabled: Boolean(zoneId),
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
