import { EmptyState } from '@/components/ui'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'

// Kỹ thuật viên chưa được giao nhà nào: không tạo được trang trại nên không có nút đi tới Trang trại
export default function NoHouseAssignedState() {
  const { t } = useTranslation(farmDict)
  return <EmptyState title={t('tech.noFarmTitle')} description={t('tech.noFarmDesc')} />
}
