import { StyleSheet, View } from 'react-native'
import { HouseIcon } from 'phosphor-react-native'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { SettingsTable } from '@/components/farm/settings/SettingsTable'
import { Spacing } from '@/constants/theme'
import { useFarmDetail } from '@/hooks/farm/useFarmDetail'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useAuthStore } from '@/stores/authStore'
import type { House, Zone } from '@/types'
import { getHouseTechnicianNames } from '@/utils/farm.utils'
import { t } from '@/utils/i18n.utils'
import { canPerform } from '@/utils/permission.utils'

interface HouseInfoSectionProps {
  house: House
  zones: Zone[]
  editor: SectionEditor
}

// Mục "Thông tin nhà": tên, số tầng, mô tả, kỹ thuật viên phụ trách (chủ trại xem; giao, đổi người ở web) và danh sách khu vực.
// Chỉ xem — backend chưa có API sửa tên, xoá nhà (FARM-FR-002) nên hai nút này khoá, ghi "Sắp có"
export function HouseInfoSection({ house, zones, editor }: HouseInfoSectionProps) {
  const id = 'house-info'
  const user = useAuthStore(state => state.user)
  const canViewTechnicians = canPerform(user, 'viewHouseTechnicians')
  const farmQuery = useFarmDetail(canViewTechnicians ? house.farm_id : '')
  const technicians = getHouseTechnicianNames(house, farmQuery.data?.data.members ?? [])
  const technicianText = technicians
    .map(technician => (technician.isPrimary ? t('{name} (chính)', { name: technician.name }) : technician.name))
    .join(', ')

  return (
    <SettingsSection
      icon={HouseIcon}
      title={t('Thông tin nhà')}
      subtitle={house.name}
      scopeLabel={t('Nhà')}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
    >
      <SettingsMetaGrid
        items={[
          { label: t('Tên nhà'), value: house.name },
          { label: t('Số tầng'), value: house.floors ? String(house.floors) : undefined },
          ...(canViewTechnicians
            ? [
                {
                  label: t('Kỹ thuật viên phụ trách'),
                  // Đang tải hoặc tải lỗi thành viên farm thì "_" để không báo nhầm là chưa giao
                  value:
                    farmQuery.isLoading || farmQuery.isError
                      ? undefined
                      : technicianText || t('Chưa giao, chủ trại tự xử lý'),
                  isFullWidth: true,
                },
              ]
            : []),
          ...(house.description ? [{ label: t('Mô tả'), value: house.description, isFullWidth: true }] : []),
        ]}
      />
      <SettingsTable
        columns={[
          { label: t('Khu vực đã tạo'), flex: 2 },
          { label: t('Tầng số'), align: 'right' },
        ]}
        rows={zones.map(zone => ({
          id: zone._id,
          cells: [{ text: zone.name }, { text: zone.floor ? String(zone.floor) : '_' }],
          accessibilityLabel: t('{zone}, tầng số {floor}', { zone: zone.name, floor: zone.floor }),
        }))}
        emptyText={t('Nhà chưa có khu vực')}
      />
      <SettingsActionBar label={t('Số khu vực đã tạo')} value={String(zones.length)} />
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
