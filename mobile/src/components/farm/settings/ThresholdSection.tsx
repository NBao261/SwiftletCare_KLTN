import { useState } from 'react'
import { Alert as NativeAlert } from 'react-native'
import { ArrowCounterClockwiseIcon, ThermometerIcon } from 'phosphor-react-native'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import {
  SettingsTable,
  type SettingsTableColumn,
  type SettingsTableRow,
} from '@/components/farm/settings/SettingsTable'
import { useResetThresholds } from '@/hooks/farm/useResetThresholds'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateThresholds } from '@/hooks/farm/useUpdateThresholds'
import { useAuthStore } from '@/stores/authStore'
import type { Thresholds, Zone } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { getMetricLabel, getMetricUnit } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId } from '@/utils/settingsSection.utils'
import {
  formatStoredNumber,
  hasDraftErrors,
  isNumberDraftChanged,
  parseNumberDraft,
  THRESHOLD_RULES,
  toInputText,
  validateThresholdDraft,
  type NumberDraft,
} from '@/utils/settingsValidation.utils'
import type { ThresholdMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

const THRESHOLD_KEYS = Object.keys(THRESHOLD_RULES) as (keyof Thresholds)[]

// 5 dòng của bảng: nhiệt độ, độ ẩm có mức thấp và cao; ánh sáng, NH3, CO2 chỉ có mức cao (C-2)
const THRESHOLD_ROWS: { metric: ThresholdMetric; minKey?: keyof Thresholds; maxKey: keyof Thresholds }[] = [
  { metric: 'temperature', minKey: 'temp_min', maxKey: 'temp_max' },
  { metric: 'humidity', minKey: 'humidity_min', maxKey: 'humidity_max' },
  { metric: 'light', maxKey: 'light_max' },
  { metric: 'nh3', maxKey: 'nh3_max' },
  { metric: 'co2', maxKey: 'co2_max' },
]

interface ThresholdSectionProps {
  zone: Zone
  editor: SectionEditor
  // Lưu hoặc đặt lại xong: trang hiện toast
  onSaved: (message: string) => void
}

// Tên chỉ số kèm đơn vị: "Nhiệt độ (°C)"
function getRowLabel(metric: ThresholdMetric): string {
  return `${getMetricLabel(metric)} (${getMetricUnit(metric).trim()})`
}

function getColumns(): SettingsTableColumn[] {
  return [
    { label: t('Chỉ số'), flex: 2 },
    { label: t('Thấp'), align: 'right' },
    { label: t('Cao'), align: 'right' },
  ]
}

// Phần đang sửa: bảng có ô nhập, tự giữ bản nháp; Lưu chỉ gửi ngưỡng của zone này
function ThresholdEditor({ zone, editor, onSaved }: ThresholdSectionProps) {
  const updateThresholds = useUpdateThresholds()
  const [draft, setDraft] = useState<NumberDraft<keyof Thresholds>>(() => {
    const initial = {} as NumberDraft<keyof Thresholds>
    for (const key of THRESHOLD_KEYS) initial[key] = toInputText(zone.thresholds[key])
    return initial
  })
  const errors = validateThresholdDraft(draft)
  const isChanged = isNumberDraftChanged(draft, zone.thresholds, THRESHOLD_KEYS)

  const change = (key: keyof Thresholds, text: string) => {
    const next = { ...draft, [key]: text }
    setDraft(next)
    editor.setDirty(isNumberDraftChanged(next, zone.thresholds, THRESHOLD_KEYS))
  }

  const save = () =>
    updateThresholds.mutate(
      { zoneId: zone._id, thresholds: parseNumberDraft(draft, THRESHOLD_KEYS) },
      {
        onSuccess: () => {
          editor.finishEditing()
          onSaved(t('Đã lưu ngưỡng {zone}', { zone: zone.name }))
        },
      },
    )

  const rows: SettingsTableRow[] = THRESHOLD_ROWS.map(({ metric, minKey, maxKey }) => {
    const label = getRowLabel(metric)
    return {
      id: metric,
      cells: [
        { text: label },
        minKey
          ? {
              input: {
                value: draft[minKey],
                onChangeText: text => change(minKey, text),
                label: t('{metric}, mức thấp', { metric: label }),
                hasError: Boolean(errors[minKey]),
                keyboardType: 'numbers-and-punctuation',
              },
            }
          : null,
        {
          input: {
            value: draft[maxKey],
            onChangeText: text => change(maxKey, text),
            label: t('{metric}, mức cao', { metric: label }),
            hasError: Boolean(errors[maxKey]),
            keyboardType: metric === 'temperature' ? 'numbers-and-punctuation' : 'decimal-pad',
          },
        },
      ],
      error: (minKey && errors[minKey]) || errors[maxKey] || null,
    }
  })

  return (
    <>
      <SettingsTable columns={getColumns()} rows={rows} />
      <SettingsEditActions
        onSave={save}
        onCancel={editor.cancelEditing}
        isSaving={updateThresholds.isPending}
        isSaveDisabled={!isChanged || hasDraftErrors(errors)}
        error={updateThresholds.error ? getSettingsErrorMessage(updateThresholds.error) : null}
      />
    </>
  )
}

// Mục "Ngưỡng môi trường" của một zone (ENV-FR-006): xem 7 ngưỡng; chủ trại và chuyên gia bấm "Sửa" để chỉnh,
// ô vuông ở chân card đặt lại mặc định hệ thống (ENV-FR-020)
export function ThresholdSection({ zone, editor, onSaved }: ThresholdSectionProps) {
  const user = useAuthStore(state => state.user)
  const canEdit = canPerform(user, 'editThresholds')
  const resetThresholds = useResetThresholds()
  const id = getSettingsSectionId('thresholds', zone._id)
  const isEditing = editor.isEditing(id)

  const confirmReset = () =>
    NativeAlert.alert(
      t('Đặt lại ngưỡng mặc định?'),
      t('7 ngưỡng của {zone} sẽ về mặc định hệ thống và gửi xuống controller.', { zone: zone.name }),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Đặt lại'),
          style: 'destructive',
          onPress: () =>
            resetThresholds.mutate(zone._id, {
              onSuccess: () => onSaved(t('Đã đặt lại ngưỡng mặc định')),
              onError: error => NativeAlert.alert(t('Không đặt lại được'), getSettingsErrorMessage(error)),
            }),
        },
      ],
    )

  const viewRows: SettingsTableRow[] = THRESHOLD_ROWS.map(({ metric, minKey, maxKey }) => {
    const label = getRowLabel(metric)
    const minText = minKey ? formatStoredNumber(zone.thresholds[minKey]) : null
    const maxText = formatStoredNumber(zone.thresholds[maxKey])
    return {
      id: metric,
      cells: [{ text: label }, minText === null ? null : { text: minText }, { text: maxText }],
      accessibilityLabel: minText
        ? t('{metric}: từ {min} đến {max}', { metric: label, min: minText, max: maxText })
        : t('{metric}: cảnh báo khi trên {max}', { metric: label, max: maxText }),
    }
  })

  return (
    <SettingsSection
      icon={ThermometerIcon}
      title={t('Ngưỡng môi trường')}
      subtitle={t('Ngoài ngưỡng thì cảnh báo; nhiệt, ẩm còn dùng để điều khiển')}
      scopeLabel={zone.name}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      onEdit={canEdit ? () => editor.startEditing(id) : undefined}
      isEditing={isEditing}
      footerNote={
        canEdit
          ? t('Chủ trại và chuyên gia sửa được. Ô bên phải đặt lại mặc định hệ thống')
          : t('Chủ trại và chuyên gia sửa được')
      }
      footerTile={
        canEdit && !isEditing
          ? {
              icon: ArrowCounterClockwiseIcon,
              label: t('Đặt lại ngưỡng mặc định'),
              onPress: confirmReset,
              disabled: resetThresholds.isPending,
            }
          : undefined
      }
    >
      {isEditing ? (
        <ThresholdEditor zone={zone} editor={editor} onSaved={onSaved} />
      ) : (
        <SettingsTable columns={getColumns()} rows={viewRows} />
      )}
    </SettingsSection>
  )
}
