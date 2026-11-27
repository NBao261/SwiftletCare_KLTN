import { useState } from 'react'
import { Alert as NativeAlert, StyleSheet } from 'react-native'
import { StackIcon } from 'phosphor-react-native'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { Button } from '@/components/ui/button'
import { useDeleteZone } from '@/hooks/farm/useDeleteZone'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateZone } from '@/hooks/farm/useUpdateZone'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { Zone } from '@/types'
import { getStructureErrorMessage } from '@/utils/apiError.utils'
import { canPerform } from '@/utils/permission.utils'
import {
  getZoneFloorRule,
  NAME_MAX_LENGTH,
  parseNumberInput,
  validateName,
  validateNumber,
} from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

interface ZoneInfoSectionProps {
  zone: Zone
  // Số tầng của nhà: tầng của khu vực không vượt quá
  houseFloors: number | undefined
  // Tên các khu vực khác của nhà: không cho đổi sang tên đã có
  otherZoneNames: string[]
  editor: SectionEditor
  onSaved: (message: string) => void
  // Xoá xong: màn chọn khu vực khác còn lại
  onDeleted: (message: string) => void
}

interface ZoneDraft {
  name: string
  floor: string
}

// Trường đã đổi so với khu vực đang lưu, để Cập nhật chỉ gửi những trường đó
function buildZoneChanges(zone: Zone, draft: ZoneDraft) {
  const floor = parseNumberInput(draft.floor)
  return {
    ...(draft.name.trim() !== zone.name ? { name: draft.name.trim() } : {}),
    ...(floor !== null && floor !== zone.floor ? { floor } : {}),
  }
}

// Phần đang sửa: tên và tầng; Cập nhật chỉ gửi trường đã đổi (PUT /farms/zones/{zoneId})
function ZoneInfoEditor({ zone, houseFloors, otherZoneNames, editor, onSaved }: ZoneInfoSectionProps) {
  const updateZone = useUpdateZone()
  const [draft, setDraft] = useState<ZoneDraft>({ name: zone.name, floor: zone.floor ? String(zone.floor) : '' })
  const nameError = validateName(draft.name, otherZoneNames, t('Nhà đã có khu vực tên này'))
  const floorError = validateNumber(draft.floor, getZoneFloorRule(houseFloors))
  const payload = buildZoneChanges(zone, draft)
  const isChanged = Object.keys(payload).length > 0

  const change = (field: keyof ZoneDraft) => (text: string) => {
    const next = { ...draft, [field]: text }
    setDraft(next)
    editor.setDirty(Object.keys(buildZoneChanges(zone, next)).length > 0)
  }

  const save = () =>
    updateZone.mutate(
      { zoneId: zone._id, payload },
      {
        onSuccess: () => {
          editor.finishEditing()
          onSaved(t('Đã lưu thông tin khu vực'))
        },
      },
    )

  return (
    <>
      <SettingsMetaGrid
        items={[
          {
            label: t('Tên khu vực'),
            input: {
              value: draft.name,
              onChangeText: change('name'),
              label: t('Tên khu vực'),
              keyboardType: 'default',
              autoCapitalize: 'sentences',
              maxLength: NAME_MAX_LENGTH,
            },
            error: nameError,
            isFullWidth: true,
          },
          {
            label: t('Tầng số'),
            input: { value: draft.floor, onChangeText: change('floor'), label: t('Tầng số'), keyboardType: 'number-pad' },
            error: floorError,
          },
        ]}
      />
      <SettingsEditActions
        onSave={save}
        onCancel={editor.cancelEditing}
        isSaving={updateZone.isPending}
        isSaveDisabled={!isChanged || Boolean(nameError || floorError)}
        error={updateZone.error ? getStructureErrorMessage(updateZone.error, 'zone') : null}
      />
    </>
  )
}

// Mục "Thông tin khu vực" (FARM-FR-002): tên và tầng số của zone; chủ trại bấm "Sửa" để đổi, nút xoá khu vực ở cuối mục
export function ZoneInfoSection(props: ZoneInfoSectionProps) {
  const { zone, editor, onDeleted } = props
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const deleteZone = useDeleteZone()
  const id = `zone-info:${zone._id}`
  const isEditing = editor.isEditing(id)
  const canEdit = canPerform(user, 'editHouse')
  const canDelete = canPerform(user, 'deleteHouse')

  const confirmDelete = () =>
    NativeAlert.alert(
      t('Xoá khu vực?'),
      t('{zone} sẽ bị ẩn; dữ liệu cũ vẫn được giữ. Cảnh báo đang mở được đóng, phiếu công việc chưa xong bị huỷ.', {
        zone: zone.name,
      }),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Xoá'),
          style: 'destructive',
          onPress: () =>
            deleteZone.mutate(zone._id, {
              onSuccess: () => onDeleted(t('Đã xoá khu vực {zone}', { zone: zone.name })),
              onError: error => NativeAlert.alert(t('Không xoá được'), getStructureErrorMessage(error, 'zone')),
            }),
        },
      ],
    )

  return (
    <SettingsSection
      icon={StackIcon}
      title={t('Thông tin khu vực')}
      subtitle={zone.name}
      scopeLabel={zone.name}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      onEdit={canEdit ? () => editor.startEditing(id) : undefined}
      isEditing={isEditing}
    >
      {isEditing ? (
        <ZoneInfoEditor {...props} />
      ) : (
        <>
          <SettingsMetaGrid
            items={[
              { label: t('Tên khu vực'), value: zone.name },
              { label: t('Tầng số'), value: zone.floor ? String(zone.floor) : undefined },
            ]}
          />
          {canDelete && (
            <Button
              label={t('Xoá khu vực')}
              variant="link"
              color={palette.alert}
              onPress={confirmDelete}
              loading={deleteZone.isPending}
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
