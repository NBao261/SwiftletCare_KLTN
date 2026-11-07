import { useState } from 'react'
import { MapPinIcon } from 'phosphor-react-native'
import { LocateRow } from '@/components/farm/settings/LocateRow'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateFarm } from '@/hooks/farm/useUpdateFarm'
import type { Coordinates, Farm } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { formatDecimal } from '@/utils/number.utils'
import {
  COORDINATE_RULES,
  hasDraftErrors,
  isNumberDraftChanged,
  parseNumberDraft,
  toInputText,
  validateNumberDraft,
  type NumberDraft,
} from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

interface FarmLocationSectionProps {
  farm: Farm
  canEdit: boolean
  editor: SectionEditor
  onSaved: (message: string) => void
}

const SECTION_ID = 'farm-location'
const COORDINATE_KEYS: (keyof Coordinates)[] = ['lat', 'lng']
// Toạ độ hiện 6 chữ số lẻ như lúc lấy từ GPS
const COORDINATE_DECIMALS = 6

// Phần đang sửa: hai ô vĩ độ, kinh độ và dòng lấy vị trí hiện tại; Lưu chỉ gửi toạ độ
function FarmLocationEditor({ farm, editor, onSaved }: FarmLocationSectionProps) {
  const updateFarm = useUpdateFarm()
  const original = farm.coordinates ?? {}
  const [draft, setDraft] = useState<NumberDraft<keyof Coordinates>>({
    lat: toInputText(farm.coordinates?.lat),
    lng: toInputText(farm.coordinates?.lng),
  })
  const errors = validateNumberDraft(draft, COORDINATE_RULES)
  const isChanged = isNumberDraftChanged(draft, original, COORDINATE_KEYS)

  const update = (next: NumberDraft<keyof Coordinates>) => {
    setDraft(next)
    editor.setDirty(isNumberDraftChanged(next, original, COORDINATE_KEYS))
  }

  const save = () =>
    updateFarm.mutate(
      { farmId: farm._id, payload: { coordinates: parseNumberDraft(draft, COORDINATE_KEYS) } },
      {
        onSuccess: () => {
          editor.finishEditing()
          onSaved(t('Đã lưu toạ độ trang trại'))
        },
      },
    )

  return (
    <>
      <SettingsMetaGrid
        items={COORDINATE_KEYS.map(key => {
          const label = key === 'lat' ? t('Vĩ độ') : t('Kinh độ')
          return {
            label,
            input: {
              value: draft[key],
              onChangeText: (text: string) => update({ ...draft, [key]: text }),
              label,
              keyboardType: 'numbers-and-punctuation' as const,
            },
            // Ô còn trống thì chưa báo lỗi, chỉ khoá nút Lưu
            error: draft[key] === '' ? null : (errors[key] ?? null),
          }
        })}
      />
      <LocateRow
        onLocated={coordinates => update({ lat: toInputText(coordinates.lat), lng: toInputText(coordinates.lng) })}
      />
      <SettingsEditActions
        onSave={save}
        onCancel={editor.cancelEditing}
        isSaving={updateFarm.isPending}
        isSaveDisabled={!isChanged || hasDraftErrors(errors)}
        error={updateFarm.error ? getSettingsErrorMessage(updateFarm.error) : null}
      />
    </>
  )
}

// Mục "Toạ độ" của farm (FARM-FR-001, A-5): một farm là một địa điểm, thời tiết lấy theo toạ độ này
export function FarmLocationSection(props: FarmLocationSectionProps) {
  const { farm, canEdit, editor } = props
  const isEditing = editor.isEditing(SECTION_ID)
  const coordinates = farm.coordinates

  return (
    <SettingsSection
      icon={MapPinIcon}
      title={t('Toạ độ')}
      subtitle={coordinates ? t('Dùng để lấy thời tiết của trang trại') : t('Chưa có toạ độ nên chưa có thời tiết')}
      scopeLabel={t('Trang trại')}
      isExpanded={editor.isExpanded(SECTION_ID)}
      onToggle={() => editor.toggle(SECTION_ID)}
      onEdit={canEdit ? () => editor.startEditing(SECTION_ID) : undefined}
      isEditing={isEditing}
      footerNote={t('Chủ trại sửa được. Vĩ độ −90 đến 90, kinh độ −180 đến 180')}
    >
      {isEditing ? (
        <FarmLocationEditor {...props} />
      ) : (
        <SettingsMetaGrid
          items={[
            { label: t('Vĩ độ'), value: coordinates ? formatDecimal(coordinates.lat, COORDINATE_DECIMALS) : undefined },
            {
              label: t('Kinh độ'),
              value: coordinates ? formatDecimal(coordinates.lng, COORDINATE_DECIMALS) : undefined,
            },
          ]}
        />
      )}
    </SettingsSection>
  )
}
