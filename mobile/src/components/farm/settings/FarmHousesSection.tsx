import { HouseIcon } from 'phosphor-react-native'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { SettingsTable } from '@/components/farm/settings/SettingsTable'
import { Button } from '@/components/ui/button'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import type { House } from '@/types'
import { t } from '@/utils/i18n.utils'

interface FarmHousesSectionProps {
  houses: House[]
  editor: SectionEditor
  // Bấm một nhà: mở cài đặt của nhà đó
  onOpenHouse: (houseId: string) => void
  // Có quyền tạo nhà thì truyền: nút "Thêm nhà"
  onAdd?: () => void
}

const SECTION_ID = 'farm-houses'

// Mục "Nhà yến" của farm (FARM-FR-002): danh sách nhà theo thứ tự backend trả, bấm để vào cài đặt nhà; chủ trại thêm nhà
export function FarmHousesSection({ houses, editor, onOpenHouse, onAdd }: FarmHousesSectionProps) {
  return (
    <SettingsSection
      icon={HouseIcon}
      title={t('Nhà yến')}
      subtitle={t('Bấm một nhà để vào cài đặt của nhà')}
      scopeLabel={t('Trang trại')}
      isExpanded={editor.isExpanded(SECTION_ID)}
      onToggle={() => editor.toggle(SECTION_ID)}
      footerNote={t('Đổi tên, xoá nhà sẽ mở khi backend có API')}
    >
      <SettingsTable
        columns={[
          { label: t('Tên nhà'), flex: 2 },
          { label: t('Số tầng'), align: 'right' },
        ]}
        rows={houses.map(house => ({
          id: house._id,
          cells: [{ text: house.name }, { text: house.floors ? String(house.floors) : '_' }],
          onPress: () => onOpenHouse(house._id),
          accessibilityLabel: t('{house}, {floors} tầng, mở cài đặt', { house: house.name, floors: house.floors }),
        }))}
        emptyText={t('Farm chưa có nhà yến')}
      />
      <SettingsActionBar label={t('Số nhà yến')} value={String(houses.length)} />
      {onAdd && <Button label={t('Thêm nhà')} size="md" onPress={onAdd} />}
    </SettingsSection>
  )
}
