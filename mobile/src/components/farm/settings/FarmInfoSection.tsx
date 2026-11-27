import { useState } from 'react'
import { BarnIcon } from 'phosphor-react-native'
import { LocationMap } from '@/components/farm/LocationMap'
import { CoordinatesMapField } from '@/components/farm/settings/CoordinatesMapField'
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
  NAME_MAX_LENGTH,
  parseCoordinatesDraft,
  parseNumberInput,
  toInputText,
  validateName,
  validateNumberDraft,
  type NumberDraft,
} from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

interface FarmInfoSectionProps {
  farm: Farm
  canEdit: boolean
  editor: SectionEditor
  onSaved: (message: string) => void
}

const SECTION_ID = 'farm-info'
const COORDINATE_KEYS: (keyof Coordinates)[] = ['lat', 'lng']
// Toạ độ hiện 6 chữ số lẻ như lúc lấy từ GPS
const COORDINATE_DECIMALS = 6
const MAP_PREVIEW_HEIGHT = 160

// Bản nháp của mục: mỗi ô giữ nguyên chữ người dùng gõ
interface FarmDraft {
  name: string
  address: string
  coordinates: NumberDraft<keyof Coordinates>
}

// Trường đã đổi so với farm đang lưu, để Cập nhật chỉ gửi những trường đó (PUT /farms/{id})
function buildFarmChanges(farm: Farm, draft: FarmDraft) {
  const coordinates = parseCoordinatesDraft(draft.coordinates)
  const isCoordinatesChanged =
    coordinates !== null &&
    COORDINATE_KEYS.some(key => parseNumberInput(draft.coordinates[key]) !== (farm.coordinates?.[key] ?? null))
  return {
    ...(draft.name.trim() !== farm.name ? { name: draft.name.trim() } : {}),
    ...(draft.address.trim() !== farm.address ? { address: draft.address.trim() } : {}),
    ...(isCoordinatesChanged ? { coordinates } : {}),
  }
}

// Phần đang sửa: tên, địa chỉ, toạ độ (hai ô, lấy vị trí hiện tại, ghim trên bản đồ); Cập nhật chỉ gửi trường đã đổi
function FarmInfoEditor({ farm, editor, onSaved }: FarmInfoSectionProps) {
  const updateFarm = useUpdateFarm()
  const [draft, setDraft] = useState<FarmDraft>({
    name: farm.name,
    address: farm.address,
    coordinates: { lat: toInputText(farm.coordinates?.lat), lng: toInputText(farm.coordinates?.lng) },
  })
  const nameError = validateName(draft.name)
  const addressError = draft.address.trim() === '' ? t('Không được để trống') : null
  const coordinateErrors = validateNumberDraft(draft.coordinates, COORDINATE_RULES)
  // Toạ độ gõ dở, sai, hoặc xoá trắng toạ độ đã có thì khoá Cập nhật (thời tiết lấy theo toạ độ, A-5); farm cũ chưa có toạ độ mà
  // để trống cả hai ô thì vẫn sửa được tên, địa chỉ
  const isCoordinatesEmpty = draft.coordinates.lat.trim() === '' && draft.coordinates.lng.trim() === ''
  const hasCoordinateError =
    isCoordinatesEmpty && !farm.coordinates ? false : parseCoordinatesDraft(draft.coordinates) === null
  const payload = buildFarmChanges(farm, draft)
  const isChanged = Object.keys(payload).length > 0

  // Mỗi lần đổi báo trang cài đặt còn thay đổi chưa lưu hay không (hỏi trước khi rời mục)
  const applyDraft = (next: FarmDraft) => {
    setDraft(next)
    editor.setDirty(Object.keys(buildFarmChanges(farm, next)).length > 0)
  }
  const setCoordinates = (coordinates: Coordinates) =>
    applyDraft({ ...draft, coordinates: { lat: toInputText(coordinates.lat), lng: toInputText(coordinates.lng) } })

  const save = () =>
    updateFarm.mutate(
      { farmId: farm._id, payload },
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
              value: draft.name,
              onChangeText: text => applyDraft({ ...draft, name: text }),
              label: t('Tên trang trại'),
              keyboardType: 'default',
              autoCapitalize: 'sentences',
              maxLength: NAME_MAX_LENGTH,
            },
            error: nameError,
            isFullWidth: true,
          },
          {
            label: t('Địa chỉ'),
            input: {
              value: draft.address,
              onChangeText: text => applyDraft({ ...draft, address: text }),
              label: t('Địa chỉ'),
              keyboardType: 'default',
              autoCapitalize: 'sentences',
              multiline: true,
            },
            error: addressError,
            isFullWidth: true,
          },
          ...COORDINATE_KEYS.map(key => {
            const label = key === 'lat' ? t('Vĩ độ') : t('Kinh độ')
            return {
              label,
              input: {
                value: draft.coordinates[key],
                onChangeText: (text: string) =>
                  applyDraft({ ...draft, coordinates: { ...draft.coordinates, [key]: text } }),
                label,
                keyboardType: 'numbers-and-punctuation' as const,
              },
              error: draft.coordinates[key] === '' ? null : (coordinateErrors[key] ?? null),
            }
          }),
        ]}
      />
      <LocateRow onLocated={setCoordinates} />
      <CoordinatesMapField value={parseCoordinatesDraft(draft.coordinates)} onChange={setCoordinates} />
      <SettingsEditActions
        onSave={save}
        onCancel={editor.cancelEditing}
        isSaving={updateFarm.isPending}
        isSaveDisabled={!isChanged || Boolean(nameError || addressError) || hasCoordinateError}
        error={updateFarm.error ? getSettingsErrorMessage(updateFarm.error) : null}
      />
    </>
  )
}

// Mục "Thông tin trang trại" (FARM-FR-001, A-5): tên, địa chỉ và toạ độ trên bản đồ — một farm là một địa điểm, thời tiết lấy
// theo toạ độ này. Chủ trại bấm "Sửa" để chỉnh cả ba trong một lần Cập nhật
export function FarmInfoSection(props: FarmInfoSectionProps) {
  const { farm, canEdit, editor } = props
  const isEditing = editor.isEditing(SECTION_ID)
  const coordinates = farm.coordinates

  return (
    <SettingsSection
      icon={BarnIcon}
      title={t('Thông tin trang trại')}
      subtitle={coordinates ? farm.name : t('{farm} · chưa có toạ độ nên chưa có thời tiết', { farm: farm.name })}
      scopeLabel={t('Trang trại')}
      isExpanded={editor.isExpanded(SECTION_ID)}
      onToggle={() => editor.toggle(SECTION_ID)}
      onEdit={canEdit ? () => editor.startEditing(SECTION_ID) : undefined}
      isEditing={isEditing}
    >
      {isEditing ? (
        <FarmInfoEditor {...props} />
      ) : (
        <>
          <SettingsMetaGrid
            items={[
              { label: t('Tên trang trại'), value: farm.name, isFullWidth: true },
              { label: t('Địa chỉ'), value: farm.address, isFullWidth: true },
              { label: t('Vĩ độ'), value: coordinates ? formatDecimal(coordinates.lat, COORDINATE_DECIMALS) : undefined },
              {
                label: t('Kinh độ'),
                value: coordinates ? formatDecimal(coordinates.lng, COORDINATE_DECIMALS) : undefined,
              },
            ]}
          />
          {/* key theo toạ độ để bản đồ dựng lại khi toạ độ vừa lưu đổi */}
          {coordinates && (
            <LocationMap key={`${coordinates.lat},${coordinates.lng}`} coordinates={coordinates} height={MAP_PREVIEW_HEIGHT} />
          )}
        </>
      )}
    </SettingsSection>
  )
}
