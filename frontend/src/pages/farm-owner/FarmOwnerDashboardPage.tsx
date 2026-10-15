import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useZoneStore } from '@/stores/zoneStore'
import { useFarms, useHouses } from '@/hooks/shared/useFarms'
import { useScopeZones, useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import { usePinnedHouses } from '@/hooks/farm-owner/usePinnedHouses'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { Button } from '@/components/ui'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ScadaModeBanner from '@/components/features/farm-owner/dashboard/ScadaModeBanner'
import EcoHealthCard from '@/components/features/farm-owner/dashboard/EcoHealthCard'
import ControlSubsystemPanel from '@/components/features/farm-owner/dashboard/ControlSubsystemPanel'
import EnvSensorPanel from '@/components/features/farm-owner/dashboard/EnvSensorPanel'
import BirdVisionCard from '@/components/features/farm-owner/dashboard/BirdVisionCard'
import NestingDensityCard from '@/components/features/farm-owner/dashboard/NestingDensityCard'
import SensorAlertLogTable from '@/components/features/farm-owner/dashboard/SensorAlertLogTable'
import { getAnomalies, sortPinnedFirst } from '@/components/features/farm-owner/dashboard/dashboardMetrics'

// Dashboard Farm Owner
export default function FarmOwnerDashboardPage() {
  const { t } = useTranslation(dashboardDict)
  const selectedFarmId = useZoneStore(s => s.selectedFarmId)
  const { data: farms, isLoading: isLoadingFarms, isError: isFarmsError, refetch: refetchFarms } = useFarms()
  const farmId = selectedFarmId ?? farms?.[0]?._id ?? ''
  const { data: houses, isLoading: isLoadingHouses, isError: isHousesError, refetch: refetchHouses } = useHouses(farmId || undefined)
  const { pinned } = usePinnedHouses()
  const [choice, setChoice] = useState('')

  const houseOptions = [
    { value: '', label: t('page.allHouses') },
    ...sortPinnedFirst(houses ?? [], pinned).map(house => ({ value: house._id, label: house.name })),
  ]
  const houseId = houseOptions.some(option => option.value === choice) ? choice : ''
  const houseName = houseOptions.find(option => option.value === houseId)?.label ?? ''

  const { zones } = useScopeZones(farmId, houseId)
  const { readings, thresholds, lastSyncedAt, controlMode, overrideExpiry, relayStates, controlOutput, deviceNames } = useZonesEnvironment(zones)

  if (isLoadingFarms || isLoadingHouses) {
    return <LoadingSkeleton count={4} className="h-32 w-full" />
  }

  if (isFarmsError || isHousesError) {
    return (
      <EmptyState
        title={t('page.zoneErrorTitle')}
        description={t('page.zoneErrorDesc')}
        action={<Button variant="secondary" onClick={() => { void refetchFarms(); void refetchHouses() }}>{t('log.retry')}</Button>}
      />
    )
  }

  if (!houses?.length) {
    return (
      <EmptyState
        title={t('page.noZoneTitle')}
        description={t('page.noZoneDesc')}
        action={
          <Link to="/farms">
            <Button>{t('page.goFarms')}</Button>
          </Link>
        }
      />
    )
  }

  const anomalies = houseId && thresholds ? getAnomalies(readings, thresholds) : undefined

  return (
    <div className="flex flex-col gap-5">
      <ScadaModeBanner
        lastSyncedAt={lastSyncedAt}
        controlMode={controlMode}
        overrideExpiry={overrideExpiry}
        houseId={houseId}
        houseOptions={houseOptions}
        onHouseChange={setChoice}
      />

      <div className="grid grid-cols-1 gap-5 lg:h-[272px] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:[&>*]:overflow-hidden">
        <EcoHealthCard farmId={farmId} />
        <ControlSubsystemPanel
          zoneName={houseName}
          relayStates={houseId ? relayStates : undefined}
          controlMode={houseId ? controlMode : undefined}
          controlOutput={houseId ? controlOutput : undefined}
          tooHot={anomalies?.tooHot ?? false}
          tooCold={anomalies?.tooCold ?? false}
        />
      </div>

      <EnvSensorPanel farmId={farmId} houseOptions={houseOptions} globalHouseId={houseId} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <BirdVisionCard farmId={farmId} houseOptions={houseOptions} globalHouseId={houseId} />
        <NestingDensityCard zones={zones} houseId={houseId} />
      </div>

      <SensorAlertLogTable farmId={farmId} houseId={houseId} zones={zones} deviceNames={deviceNames} />
    </div>
  )
}
