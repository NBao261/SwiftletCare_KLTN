import { MapTrifoldIcon } from 'phosphor-react-native'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { LocationMap } from '@/components/farm/LocationMap'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { Text } from '@/components/ui/text'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { Coordinates } from '@/types'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const SECTION_ID = 'house-location'
const MAP_PREVIEW_HEIGHT = 160

interface HouseLocationSectionProps {
  // Toạ độ của trang trại chứa nhà; null khi trang trại chưa có toạ độ
  farmCoordinates: Coordinates | null
  editor: SectionEditor
}

// Mục "Vị trí nhà yến": backend chỉ lưu toạ độ của trang trại (FARM-FR-001), nhà dùng chung vị trí đó, nên mục hiện vị trí trang
// trại trên bản đồ. Ghim vị trí riêng của nhà là khung chờ backend thêm toạ độ nhà ("Sắp có", mobile/CLAUDE.md Known debt)
export function HouseLocationSection({ farmCoordinates, editor }: HouseLocationSectionProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)

  return (
    <SettingsSection
      icon={MapTrifoldIcon}
      title={t('Vị trí nhà yến')}
      subtitle={farmCoordinates ? t('Đang dùng vị trí của trang trại') : t('Trang trại chưa có toạ độ')}
      scopeLabel={t('Nhà')}
      isExpanded={editor.isExpanded(SECTION_ID)}
      onToggle={() => editor.toggle(SECTION_ID)}
    >
      {farmCoordinates ? (
        <LocationMap coordinates={farmCoordinates} height={MAP_PREVIEW_HEIGHT} />
      ) : (
        <Text variant="small" color={palette.textSecondary}>
          {t('Đặt toạ độ ở Cài đặt trang trại để có thời tiết và vị trí trên bản đồ.')}
        </Text>
      )}
      {canPerform(user, 'editHouse') && <ComingSoonAction label={t('Ghim vị trí riêng của nhà')} />}
    </SettingsSection>
  )
}
