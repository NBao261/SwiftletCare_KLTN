import { useState } from 'react'
import { BarnIcon } from 'phosphor-react-native'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateFarm } from '@/hooks/farm/useUpdateFarm'
import type { Farm } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { t } from '@/utils/i18n.utils'

interface FarmInfoSectionProps {
  farm: Farm
  canEdit: boolean
  editor: SectionEditor
  onSaved: (message: string) => void
}

const SECTION_ID = 'farm-info'

// Phần đang sửa: tên và địa chỉ; Lưu chỉ gửi hai trường này (PUT /farms/{id})
function FarmInfoEditor({ farm, editor, onSaved }: FarmInfoSectionProps) {
  const updateFarm = useUpdateFarm()
  const [name, setName] = useState(farm.name)
  const [address, setAddress] = useState(farm.address)
  const nameError = name.trim() === '' ? t('Không được để trống') : null
  const addressError = address.trim() === '' ? t('Không được để trống') : null
  const isChangedWith = (nextName: string, nextAddress: string) =>
    nextName.trim() !== farm.name || nextAddress.trim() !== farm.address

  const save = () =>
    updateFarm.mutate(
      { farmId: farm._id, payload: { name: name.trim(), address: address.trim() } },
      {
        onSuccess: () => {
          editor.finishEditing()
          onSaved(t('Đã lưu thông tin trang trại'))
        },
      },
    )

  return (
    <>
      <SettingsMetaGrid
        items={[
          {
            label: t('Tên trang trại'),
            input: {
              value: name,
              onChangeText: text => {
                setName(text)
                editor.setDirty(isChangedWith(text, address))
              },
              label: t('Tên trang trại'),
              keyboardType: 'default',
              autoCapitalize: 'sentences',
            },
            error: nameError,
            isFullWidth: true,
          },
          {
            label: t('Địa chỉ'),
            input: {
              value: address,
              onChangeText: text => {
                setAddress(text)
                editor.setDirty(isChangedWith(name, text))
              },
              label: t('Địa chỉ'),
              keyboardType: 'default',
              autoCapitalize: 'sentences',
            },
            error: addressError,
            isFullWidth: true,
          },
        ]}
      />
      <SettingsEditActions
        onSave={save}
        onCancel={editor.cancelEditing}
        isSaving={updateFarm.isPending}
        isSaveDisabled={!isChangedWith(name, address) || Boolean(nameError || addressError)}
        error={updateFarm.error ? getSettingsErrorMessage(updateFarm.error) : null}
      />
    </>
  )
}

// Mục "Thông tin trang trại" (FARM-FR-001): tên và địa chỉ; chủ trại bấm "Sửa" để chỉnh
export function FarmInfoSection(props: FarmInfoSectionProps) {
  const { farm, canEdit, editor } = props
  const isEditing = editor.isEditing(SECTION_ID)

  return (
    <SettingsSection
      icon={BarnIcon}
      title={t('Thông tin trang trại')}
      subtitle={farm.name}
      scopeLabel={t('Trang trại')}
      isExpanded={editor.isExpanded(SECTION_ID)}
      onToggle={() => editor.toggle(SECTION_ID)}
      onEdit={canEdit ? () => editor.startEditing(SECTION_ID) : undefined}
      isEditing={isEditing}
      footerNote={t('Chủ trại sửa được')}
    >
      {isEditing ? (
        <FarmInfoEditor {...props} />
      ) : (
        <SettingsMetaGrid
          items={[
            { label: t('Tên trang trại'), value: farm.name, isFullWidth: true },
            { label: t('Địa chỉ'), value: farm.address, isFullWidth: true },
          ]}
        />
      )}
    </SettingsSection>
  )
}
