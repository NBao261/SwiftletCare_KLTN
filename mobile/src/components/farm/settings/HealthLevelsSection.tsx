import { HeartbeatIcon } from 'phosphor-react-native'
import { NumberTuningSection } from '@/components/farm/settings/NumberTuningSection'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useFarmHasExpert } from '@/hooks/farm/useFarmHasExpert'
import { useHealthLevels } from '@/hooks/farm/useHealthLevels'
import { useUpdateHealthLevels } from '@/hooks/farm/useUpdateHealthLevels'
import { useAuthStore } from '@/stores/authStore'
import type { HealthLevels, House } from '@/types'
import { getHealthLevelLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId } from '@/utils/settingsSection.utils'
import { HEALTH_LEVEL_RULES, validateHealthLevelsDraft } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const HEALTH_LEVEL_KEYS = Object.keys(HEALTH_LEVEL_RULES) as (keyof HealthLevels)[]
const SECTION_SKELETON_HEIGHT = 72

interface HealthLevelsSectionProps {
  house: House
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Mục "Mức chỉ số sức khỏe" của nhà (BR-28, EXPERT-FR-022): mỗi chỉ số có mức "nhẹ" và "rõ" mà đánh giá ngày dùng. Chuyên gia
// sửa khi thấy nhiều ngày lệch; farm chưa có chuyên gia thì chủ trại sửa thay (BR-22). Kỹ thuật viên không thấy mục này (backend 403)
export function HealthLevelsSection({ house, editor, onSaved }: HealthLevelsSectionProps) {
  const user = useAuthStore(state => state.user)
  const hasExpert = useFarmHasExpert(house.farm_id)
  const canView = canPerform(user, 'viewHealthLevels')
  const levelsQuery = useHealthLevels(house._id, canView)
  const updateHealthLevels = useUpdateHealthLevels()
  // Sửa được khi bảng quyền cho phép và backend cũng xác nhận (can_edit)
  const canEdit = canPerform(user, 'editHealthLevels', { farmHasExpert: hasExpert }) && Boolean(levelsQuery.data?.can_edit)

  if (!canView) return null
  if (levelsQuery.isLoading) return <Skeleton width="100%" height={SECTION_SKELETON_HEIGHT} />
  if (levelsQuery.isError || !levelsQuery.data) {
    return (
      <EmptyState
        message={t('Không tải được mức chỉ số sức khỏe')}
        actionLabel={t('Thử lại')}
        onAction={() => levelsQuery.refetch()}
      />
    )
  }

  return (
    <NumberTuningSection
      id={getSettingsSectionId('health-levels')}
      icon={HeartbeatIcon}
      title={t('Mức chỉ số sức khỏe')}
      subtitle={t('Ngưỡng nhẹ và rõ mà đánh giá ngày dùng')}
      scopeLabel={t('Nhà')}
      footerNote={canEdit ? t('Đổi mức thì trạng thái các ngày được tính lại') : undefined}
      keys={HEALTH_LEVEL_KEYS}
      rules={HEALTH_LEVEL_RULES}
      validate={validateHealthLevelsDraft}
      values={levelsQuery.data.health_levels}
      getLabel={getHealthLevelLabel}
      canEdit={canEdit}
      editor={editor}
      save={values => updateHealthLevels.mutateAsync({ houseId: house._id, levels: values })}
      savedMessage={t('Đã lưu mức chỉ số sức khỏe')}
      onSaved={onSaved}
    />
  )
}
