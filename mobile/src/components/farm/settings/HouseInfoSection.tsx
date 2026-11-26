import { useState } from 'react'
import { Alert as NativeAlert, StyleSheet } from 'react-native'
import { HouseIcon } from 'phosphor-react-native'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { SettingsTable } from '@/components/farm/settings/SettingsTable'
import { Button } from '@/components/ui/button'
import { useDeleteHouse } from '@/hooks/farm/useDeleteHouse'
import { useFarmDetail } from '@/hooks/farm/useFarmDetail'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateHouse } from '@/hooks/farm/useUpdateHouse'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { House, Zone } from '@/types'
import { getStructureErrorMessage } from '@/utils/apiError.utils'
import { getHouseTechnicianNames } from '@/utils/farm.utils'
import { getHighestZoneFloor } from '@/utils/farmStructure.utils'
import { canPerform } from '@/utils/permission.utils'
import {
  HOUSE_FLOOR_RULE,
  NAME_MAX_LENGTH,
  parseNumberInput,
  validateName,
  validateNumber,
} from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const SECTION_ID = 'house-info'

interface HouseInfoSectionProps {
  house: House
  zones: Zone[]
  // Tên các nhà khác của farm: không cho đổi sang tên đã có
  otherHouseNames: string[]
  editor: SectionEditor
  onSaved: (message: string) => void
  // Xoá xong: trang cài đặt của nhà không còn, màn gọi điều hướng về danh sách nhà
  onDeleted: () => void
}

// Bản nháp của mục: mỗi ô giữ nguyên chữ người dùng gõ
interface HouseDraft {
  name: string
  floors: string
  description: string
}

// Trường đã đổi so với nhà đang lưu, để Cập nhật chỉ gửi những trường đó
function buildHouseChanges(house: House, draft: HouseDraft) {
  const floors = parseNumberInput(draft.floors)
  return {
    ...(draft.name.trim() !== house.name ? { name: draft.name.trim() } : {}),
    ...(floors !== null && floors !== house.floors ? { floors } : {}),
    ...(draft.description.trim() !== (house.description ?? '') ? { description: draft.description.trim() } : {}),
  }
}

// Phần đang sửa: tên, số tầng, mô tả; Cập nhật chỉ gửi trường đã đổi (PUT /farms/houses/{houseId})
function HouseInfoEditor({ house, zones, otherHouseNames, editor, onSaved }: HouseInfoSectionProps) {
  const updateHouse = useUpdateHouse()
  const [draft, setDraft] = useState<HouseDraft>({
    name: house.name,
    floors: house.floors ? String(house.floors) : '',
    description: house.description ?? '',
  })
  const highestZoneFloor = getHighestZoneFloor(zones)
  const nameError = validateName(draft.name, otherHouseNames, t('Trang trại đã có nhà tên này'))
  const floorsValue = parseNumberInput(draft.floors)
  const floorsError =
    validateNumber(draft.floors, HOUSE_FLOOR_RULE) ??
    (floorsValue !== null && floorsValue < highestZoneFloor
      ? t('Nhà đang có khu vực ở tầng {floor}', { floor: highestZoneFloor })
      : null)
  const payload = buildHouseChanges(house, draft)
  const isChanged = Object.keys(payload).length > 0

  // Mỗi lần gõ báo trang cài đặt còn thay đổi chưa lưu hay không (hỏi trước khi rời mục)
  const change = (field: keyof HouseDraft) => (text: string) => {
    const next = { ...draft, [field]: text }
    setDraft(next)
    editor.setDirty(Object.keys(buildHouseChanges(house, next)).length > 0)
  }

  const save = () =>
    updateHouse.mutate(
      { houseId: house._id, payload },
      {
        onSuccess: () => {
          editor.finishEditing()
          onSaved(t('Đã lưu thông tin nhà'))
        },
      },
    )

  return (
    <>
      <SettingsMetaGrid
        items={[
          {
            label: t('Tên nhà'),
            input: {
              value: draft.name,
              onChangeText: change('name'),
              label: t('Tên nhà'),
              keyboardType: 'default',
              autoCapitalize: 'sentences',
              maxLength: NAME_MAX_LENGTH,
            },
            error: nameError,
            isFullWidth: true,
          },
          {
            label: t('Số tầng'),
            input: {
              value: draft.floors,
              onChangeText: change('floors'),
              label: t('Số tầng'),
              keyboardType: 'number-pad',
            },
            error: floorsError,
          },
          {
            label: t('Mô tả'),
            input: {
              value: draft.description,
              onChangeText: change('description'),
              label: t('Mô tả'),
              keyboardType: 'default',
              autoCapitalize: 'sentences',
              multiline: true,
            },
            isFullWidth: true,
          },
        ]}
      />
      <SettingsEditActions
        onSave={save}
        onCancel={editor.cancelEditing}
        isSaving={updateHouse.isPending}
        isSaveDisabled={!isChanged || Boolean(nameError || floorsError)}
        error={updateHouse.error ? getStructureErrorMessage(updateHouse.error, 'house') : null}
      />
    </>
  )
}

// Mục "Thông tin nhà" (FARM-FR-002): tên, số tầng, mô tả, kỹ thuật viên phụ trách (giao, đổi người ở web) và danh sách khu vực.
// Chủ trại bấm "Sửa" để đổi tên, số tầng, mô tả và có nút xoá nhà ở cuối mục
export function HouseInfoSection(props: HouseInfoSectionProps) {
  const { house, zones, editor, onDeleted } = props
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const deleteHouse = useDeleteHouse()
  const isEditing = editor.isEditing(SECTION_ID)
  const canEdit = canPerform(user, 'editHouse')
  const canDelete = canPerform(user, 'deleteHouse')
  const canViewTechnicians = canPerform(user, 'viewHouseTechnicians')
  const farmQuery = useFarmDetail(canViewTechnicians ? house.farm_id : '')
  const technicians = getHouseTechnicianNames(house, farmQuery.data?.data.members ?? [])
  const technicianText = technicians
    .map(technician => (technician.isPrimary ? t('{name} (chính)', { name: technician.name }) : technician.name))
    .join(', ')

  const confirmDelete = () =>
    NativeAlert.alert(
      t('Xoá nhà?'),
      t(
        '{house} và các khu vực của nhà sẽ bị ẩn; dữ liệu cũ vẫn được giữ. Cảnh báo đang mở được đóng, phiếu công việc chưa xong bị huỷ.',
        { house: house.name },
      ),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Xoá'),
          style: 'destructive',
          onPress: () =>
            deleteHouse.mutate(house._id, {
              onSuccess: onDeleted,
              onError: error => NativeAlert.alert(t('Không xoá được'), getStructureErrorMessage(error, 'house')),
            }),
        },
      ],
    )

  return (
    <SettingsSection
      icon={HouseIcon}
      title={t('Thông tin nhà')}
      subtitle={house.name}
      scopeLabel={t('Nhà')}
      isExpanded={editor.isExpanded(SECTION_ID)}
      onToggle={() => editor.toggle(SECTION_ID)}
      onEdit={canEdit ? () => editor.startEditing(SECTION_ID) : undefined}
      isEditing={isEditing}
    >
      {isEditing ? (
        <HouseInfoEditor {...props} />
      ) : (
        <>
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
          {canDelete && (
            <Button
              label={t('Xoá nhà')}
              variant="link"
              color={palette.alert}
              onPress={confirmDelete}
              loading={deleteHouse.isPending}
              style={styles.center}
            />
          )}
        </>
      )}
    </SettingsSection>
  )
}

const styles = StyleSheet.create({
  center: { alignSelf: 'center' },
})
