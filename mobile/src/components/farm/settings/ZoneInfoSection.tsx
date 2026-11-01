import { StyleSheet, View } from 'react-native'
import { StackIcon } from 'phosphor-react-native'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { Spacing } from '@/constants/theme'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import type { Zone } from '@/types'
import { t } from '@/utils/i18n.utils'

interface ZoneInfoSectionProps {
  zone: Zone
  editor: SectionEditor
}

// Mục "Thông tin tầng": tên và tầng số của zone. Chỉ xem — backend chưa có API sửa, xoá zone (FARM-FR-002)
export function ZoneInfoSection({ zone, editor }: ZoneInfoSectionProps) {
  const id = `zone-info:${zone._id}`

  return (
    <SettingsSection
      icon={StackIcon}
      title={t('Thông tin tầng')}
      subtitle={zone.name}
      scopeLabel={zone.name}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      footerNote={t('Đổi tên, xoá tầng sẽ mở khi backend có API')}
    >
      <SettingsMetaGrid
        items={[
          { label: t('Tên tầng'), value: zone.name },
          { label: t('Tầng số'), value: zone.floor ? String(zone.floor) : undefined },
        ]}
      />
      <View style={styles.actions}>
        <ComingSoonAction label={t('Đổi tên tầng')} />
        <ComingSoonAction label={t('Xoá tầng')} />
      </View>
    </SettingsSection>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
})
