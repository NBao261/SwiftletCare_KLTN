import { Link } from 'react-router-dom'
import { useScopeFilter } from '@/hooks/shared/useScopeFilter'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { Button } from '@/components/ui'
import ScopeFilter from '@/components/common/ScopeFilter'
import HeaderActions from '@/components/layouts/HeaderActions'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import HouseDetailPanels from '@/components/features/farm-owner/dashboard/HouseDetailPanels'

// Tổng quan: chọn nhà yến và Zone ở khung lọc, xem camera trực tiếp, số đo cảm biến và trạng thái điều khiển của nhà đó
export default function FarmOwnerDashboardPage() {
  const { t } = useTranslation(dashboardDict)
  const scope = useScopeFilter()
  const { houses, houseId } = scope

  // Cùng khung lọc trang trại › nhà › Zone như mọi trang; trang tự chọn sẵn 1 Zone nên không có "Tất cả"
  const header = (
    <HeaderActions>
      <ScopeFilter scope={scope} />
    </HeaderActions>
  )

  if (scope.isLoading) return <LoadingSkeleton count={4} className="h-32 w-full" />

  if (scope.isError) {
    return (
      <EmptyState
        title={t('page.zoneErrorTitle')}
        description={t('page.zoneErrorDesc')}
        action={<Button variant="secondary" onClick={scope.refetch}>{t('log.retry')}</Button>}
      />
    )
  }

  // Phạm vi đang lọc chưa có nhà: vẫn giữ khung lọc để chọn trang trại khác
  if (houses.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <EmptyState
          title={scope.farmId ? t('page.noHouseInFarmTitle') : t('page.noZoneTitle')}
          description={scope.farmId ? t('page.noHouseInFarmDesc') : t('page.noZoneDesc')}
          action={<Link to="/farms"><Button>{t('page.goFarms')}</Button></Link>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      {/* Khung lọc tự chọn sẵn nhà và Zone; chưa kịp chọn thì giữ khung chờ, không hiện số 0 giả */}
      {houseId ? <HouseDetailPanels scope={scope} /> : <LoadingSkeleton count={2} className="h-40 w-full" />}
    </div>
  )
}
