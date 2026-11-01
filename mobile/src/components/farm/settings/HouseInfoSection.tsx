import { StyleSheet, View } from 'react-native'
import { HouseIcon } from 'phosphor-react-native'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { SettingsTable } from '@/components/farm/settings/SettingsTable'
import { Spacing } from '@/constants/theme'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import type { House, Zone } from '@/types'
import { t } from '@/utils/i18n.utils'

interface HouseInfoSectionProps {
  house: House
  zones: Zone[]
  editor: SectionEditor
}

// Mục "Thông tin nhà": tên, số tầng, mô tả và danh sách tầng. Chỉ xem — backend chưa có API sửa tên, xoá nhà
// (FARM-FR-002) nên hai nút này khoá, ghi "Sắp có"
export function HouseInfoSection({ house, zones, editor }: HouseInfoSectionProps) {
  const id = 'house-info'

  return (
    <SettingsSection
      icon={HouseIcon}
      title={t('Thông tin nhà')}
      subtitle={house.name}
      scopeLabel={t('Nhà')}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      footerNote={t('Đổi tên, xoá nhà sẽ mở khi backend có API')}
    >
      <SettingsMetaGrid
        items={[
          { label: t('Tên nhà'), value: house.name },
          { label: t('Số tầng'), value: house.floors ? String(house.floors) : undefined },
          ...(house.description ? [{ label: t('Mô tả'), value: house.description, isFullWidth: true }] : []),
        ]}
      />
      <SettingsTable
        columns={[
          { label: t('Tầng đã tạo'), flex: 2 },
          { label: t('Tầng số'), align: 'right' },
        ]}
        rows={zones.map(zone => ({
          id: zone._id,
          cells: [{ text: zone.name }, { text: zone.floor ? String(zone.floor) : '_' }],
          accessibilityLabel: t('{zone}, tầng số {floor}', { zone: zone.name, floor: zone.floor }),
        }))}
        emptyText={t('Nhà chưa có tầng')}
      />
      <SettingsActionBar label={t('Số tầng đã tạo')} value={String(zones.length)} />
      <View style={styles.actions}>
        <ComingSoonAction label={t('Đổi tên nhà')} />
        <ComingSoonAction label={t('Xoá nhà')} />
      </View>
    </SettingsSection>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
})
