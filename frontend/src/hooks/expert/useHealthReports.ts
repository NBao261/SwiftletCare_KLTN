/**
 * useHealthReports — Custom hooks cho màn hình 05_Health_Reports_v3
 * Real API First → Mock fallback | SRS v2.1.4: EXPERT-FR-005/006/007
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expertService } from '@/services/expert.service'
import type { ZoneHealthReportItem } from '@/types/expert.types'

export function useHealthReportList(zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'health-reports', zoneId],
    queryFn: async (): Promise<ZoneHealthReportItem[]> => {
      try {
        if (!zoneId) throw new Error('no zone')
        const data = await expertService.getHealthReports(zoneId)
        if (Array.isArray(data) && data.length > 0) return data
        const { MOCK_HEALTH_REPORTS } = await import('@/data/mocks/expertHealthReport.mock')
        return MOCK_HEALTH_REPORTS
      } catch {
        const { MOCK_HEALTH_REPORTS } = await import('@/data/mocks/expertHealthReport.mock')
        return MOCK_HEALTH_REPORTS
      }
    },
    staleTime: 10 * 60_000,
  })
}

export function useHealthReportPreview(zoneId?: string, enabled = false) {
  return useQuery({
    queryKey: ['expert', 'health-reports-preview', zoneId],
    queryFn: async (): Promise<ZoneHealthReportItem | null> => {
      try {
        if (!zoneId) throw new Error('no zone')
        const data = await expertService.getHealthReportPreview(zoneId)
        if (data) return data
        const { MOCK_HEALTH_REPORTS } = await import('@/data/mocks/expertHealthReport.mock')
        return { ...MOCK_HEALTH_REPORTS[0], expert_conclusion: undefined, _id: 'preview' }
      } catch {
        const { MOCK_HEALTH_REPORTS } = await import('@/data/mocks/expertHealthReport.mock')
        return { ...MOCK_HEALTH_REPORTS[0], expert_conclusion: undefined, _id: 'preview' }
      }
    },
    enabled: Boolean(zoneId) && enabled,
    staleTime: 5 * 60_000,
  })
}

export function usePublishConclusion(reportId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conclusion: string) =>
      expertService.publishHealthConclusion(reportId, conclusion),
    onSuccess: (updatedReport) => {
      qc.setQueriesData({ queryKey: ['expert', 'health-reports'] }, (old: ZoneHealthReportItem[] | undefined) => {
        if (!old) return [updatedReport]
        return old.map(r => r._id === updatedReport._id ? updatedReport : r)
      })
      void qc.invalidateQueries({ queryKey: ['expert', 'health-reports'] })
    },
  })
}

export function useReportSelection(reports: ZoneHealthReportItem[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  const selected = previewMode
    ? null
    : reports.find(r => r._id === selectedId) ?? reports[0] ?? null

  return { selectedId, setSelectedId, selected, previewMode, setPreviewMode }
}

export function formatPeriodLabel(report: ZoneHealthReportItem): string {
  const fmt = (d: string) => {
    const dt = new Date(d)
    return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`
  }
  return `${fmt(report.period_start)} – ${fmt(report.period_end)}`
}

export function formatGeneratedAt(d?: string): string {
  if (!d) return '19/10/2026 00:05'
  const dt = new Date(d)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export function getWeekLabel(report: ZoneHealthReportItem, index: number): string {
  const dStart = new Date(report.period_start)
  const dEnd = new Date(report.period_end)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const week = 42 - index
  return `Tuần ${week}: ${pad(dStart.getDate())}/${pad(dStart.getMonth() + 1)} – ${pad(dEnd.getDate())}/${pad(dEnd.getMonth() + 1)}/${dEnd.getFullYear()}`
}
