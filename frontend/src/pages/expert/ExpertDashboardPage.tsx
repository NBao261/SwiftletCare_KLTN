/**
 * Màn hình 01: Bảng điều khiển Chuyên gia nuôi yến (01_Expert_Dashboard_v3)
 * SRS v2.1.4: §4.4 — EXPERT-FR-001/002/003/005, ENV-FR-019, VISION-FR-013
 *
 * Layout (desktop):
 *   [ExpertEnvSensorPanel — full width, read-only, 6 RS485 sensors]
 *   [ExpertControlPanel — full width, observe-only, 3 subsystems]
 *   [WeeklyHealthSummaryCard] | [BirdCountMonitorCard]
 *   [RelayOverrideHistoryTable — full width]
 */

import { useMemo } from 'react'
import { useZoneStore } from '@/stores/zoneStore'
import { useFarms } from '@/hooks/shared/useFarms'
import { useScopeZones, useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import { getAnomalies } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import ExpertEnvSensorPanel from '@/components/features/expert/dashboard/ExpertEnvSensorPanel'
import ExpertControlPanel from '@/components/features/expert/dashboard/ExpertControlPanel'
import WeeklyHealthSummaryCard from '@/components/features/expert/dashboard/WeeklyHealthSummaryCard'
import BirdCountMonitorCard from '@/components/features/expert/dashboard/BirdCountMonitorCard'
import RelayOverrideHistoryTable from '@/components/features/expert/dashboard/RelayOverrideHistoryTable'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'

export default function ExpertDashboardPage() {
  const selectedFarmId = useZoneStore(s => s.selectedFarmId)
  const selectedZoneId = useZoneStore(s => s.selectedZoneId)
  const selectedZoneName = useZoneStore(s => s.selectedZoneName)

  const { data: farms, isLoading: isLoadingFarms } = useFarms()
  const validFarm = (selectedFarmId ? farms?.find(f => f._id === selectedFarmId) : undefined) ?? farms?.[0]
  const farmId = validFarm?._id ?? ''

  // Đồng bộ Zone đang chọn từ thanh SCADA Banner
  const { zones, isLoading: isLoadingZones } = useScopeZones(farmId, '')
  const targetZones = useMemo(() => {
    if (selectedZoneId) {
      const match = zones.find(z => z._id === selectedZoneId)
      if (match) return [match]
    }
    return zones
  }, [zones, selectedZoneId])

  const { readings, thresholds, controlMode, relayStates, controlOutput } =
    useZonesEnvironment(targetZones)

  const anomalies = thresholds ? getAnomalies(readings, thresholds) : undefined

  if (isLoadingFarms || isLoadingZones) {
    return (
      <div className="flex flex-col gap-6">
        <LoadingSkeleton count={5} className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-screen-xl flex-col gap-6 mx-auto">
      {/* 1. Panel 6 cảm biến RS485 Chuyên gia — gắn trực tiếp với Zone đang chọn */}
      <ExpertEnvSensorPanel
        farmId={farmId}
        zoneId={selectedZoneId ?? undefined}
      />

      {/* 2. Phân hệ điều khiển Chuyên gia (Chế độ chỉ đọc, 3 phân hệ SVG ring) */}
      <ExpertControlPanel
        zoneName={selectedZoneName ?? targetZones[0]?.name ?? undefined}
        relayStates={relayStates}
        controlMode={controlMode}
        controlOutput={controlOutput}
        tooHot={anomalies?.tooHot ?? false}
      />

      {/* 3. Hàng 2 cột: [Tóm tắt sức khỏe tuần + Hộp AI] | [Theo dõi đếm chim + Live Stream] */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WeeklyHealthSummaryCard zoneId={selectedZoneId ?? ''} farmId={farmId} />
        <BirdCountMonitorCard zoneId={selectedZoneId ?? ''} farmId={farmId} />
      </div>

      {/* 4. Bảng lịch sử can thiệp relay thủ công của Chủ trại (Chỉ đọc) */}
      <RelayOverrideHistoryTable farmId={farmId} zoneId={selectedZoneId ?? undefined} />
    </div>
  )
}
