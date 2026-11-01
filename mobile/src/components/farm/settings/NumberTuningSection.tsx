import { useState, type ReactNode } from 'react'
import { StyleSheet, Switch, View } from 'react-native'
import type { Icon } from 'phosphor-react-native'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import {
  SettingsTable,
  type SettingsTableColumn,
  type SettingsTableRow,
} from '@/components/farm/settings/SettingsTable'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { usePalette } from '@/hooks/theme/usePalette'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import {
  formatRuleRange,
  formatStoredNumber,
  hasDraftErrors,
  isNumberDraftChanged,
  parseNumberDraft,
  toInputText,
  validateNumberDraft,
  type NumberDraft,
  type NumberRule,
} from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

// Công tắc bật/tắt đi kèm các hệ số (bộ lọc đầu vào của bộ điều khiển mờ)
export interface TuningToggle {
  label: string
  value: boolean | undefined
}

export interface NumberTuningSectionProps<K extends string> {
  // Khoá duy nhất của mục trong trang, ví dụ "fuzzy:<zoneId>"
  id: string
  icon: Icon
  title: string
  subtitle: string
  scopeLabel: string
  footerNote: string
  keys: readonly K[]
  rules: Record<K, NumberRule>
  values: Partial<Record<K, number>> | undefined
  getLabel: (key: K) => { label: string; unit: string }
  toggle?: TuningToggle
  canEdit: boolean
  editor: SectionEditor
  // Gửi đúng mục này lên backend; lỗi thì ném ra để phần sửa hiện câu báo
  save: (values: Record<K, number>, toggleValue: boolean | undefined) => Promise<unknown>
  savedMessage: string
  onSaved: (message: string) => void
  // Nội dung thêm ở chế độ xem, ví dụ thao tác "Sắp có" khi backend chưa có API
  extra?: ReactNode
}

function getColumns(): SettingsTableColumn[] {
  return [
    { label: t('Tham số'), flex: 2 },
    { label: t('Giá trị'), align: 'right', flex: 1.2 },
    { label: t('Khoảng'), align: 'right' },
  ]
}

// Tên kèm đơn vị: "Cửa sổ điều khiển (giây)"
function getRowLabel(label: string, unit: string): string {
  return unit.trim() ? `${label} (${unit.trim()})` : label
}

// Dòng tóm tắt căn phải như "Subtotal" trong ảnh mẫu: tên công tắc và Bật / Tắt, hoặc công tắc khi đang sửa
function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | undefined
  onChange?: (next: boolean) => void
}) {
  const palette = usePalette()
  return (
    <View style={styles.toggleRow}>
      <Text variant="body" color={palette.textSecondary} style={styles.flex}>
        {label}
      </Text>
      {onChange ? (
        <Switch
          value={Boolean(value)}
          onValueChange={onChange}
          accessibilityLabel={label}
          trackColor={{ false: palette.border, true: palette.inverse }}
          thumbColor={palette.surface}
        />
      ) : (
        <Text variant="body" weight="semiBold">
          {value === undefined ? '_' : value ? t('Bật') : t('Tắt')}
        </Text>
      )}
    </View>
  )
}

// Phần đang sửa: ô nhập cho từng tham số, khoảng hợp lệ ở cột phải, công tắc (nếu có); Lưu chỉ gửi mục này
function NumberTuningEditor<K extends string>(props: NumberTuningSectionProps<K>) {
  const { keys, rules, values, getLabel, toggle, editor, save, savedMessage, onSaved } = props
  const original: Partial<Record<K, number>> = values ?? {}
  const [draft, setDraft] = useState<NumberDraft<K>>(() => {
    const initial = {} as NumberDraft<K>
    for (const key of keys) initial[key] = toInputText(original[key])
    return initial
  })
  const [toggleValue, setToggleValue] = useState(toggle?.value)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errors = validateNumberDraft(draft, rules)
  const isToggleChanged = toggle !== undefined && toggleValue !== toggle.value
  const isChanged = isNumberDraftChanged(draft, original, keys) || isToggleChanged

  const reportDirty = (nextDraft: NumberDraft<K>, nextToggle: boolean | undefined) =>
    editor.setDirty(
      isNumberDraftChanged(nextDraft, original, keys) || (toggle !== undefined && nextToggle !== toggle.value),
    )

  const change = (key: K, text: string) => {
    const next = { ...draft, [key]: text }
    setDraft(next)
    reportDirty(next, toggleValue)
  }

  const changeToggle = (next: boolean) => {
    setToggleValue(next)
    reportDirty(draft, next)
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await save(parseNumberDraft(draft, keys), toggleValue)
      editor.finishEditing()
      onSaved(savedMessage)
    } catch (saveError) {
      setError(getSettingsErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const rows: SettingsTableRow[] = keys.map(key => {
    const { label, unit } = getLabel(key)
    const rowLabel = getRowLabel(label, unit)
    return {
      id: key,
      cells: [
        { text: rowLabel },
        {
          input: {
            value: draft[key],
            onChangeText: text => change(key, text),
            label: rowLabel,
            hasError: Boolean(errors[key]),
            keyboardType: rules[key].integer ? 'number-pad' : 'decimal-pad',
          },
        },
        { text: formatRuleRange(rules[key]), isMuted: true },
      ],
      error: errors[key] ?? null,
    }
  })

  return (
    <>
      <SettingsTable columns={getColumns()} rows={rows} />
      {toggle && <ToggleRow label={toggle.label} value={toggleValue} onChange={changeToggle} />}
      <SettingsEditActions
        onSave={submit}
        onCancel={editor.cancelEditing}
        isSaving={isSaving}
        isSaveDisabled={!isChanged || hasDraftErrors(errors)}
        error={error}
      />
    </>
  )
}

// Mục cài đặt gồm các tham số số có khoảng hợp lệ (hệ số mờ, tham số phát hiện, mức giảm tỷ lệ về tổ):
// xem dạng bảng Tham số · Giá trị · Khoảng; người có quyền bấm "Sửa" để nhập
export function NumberTuningSection<K extends string>(props: NumberTuningSectionProps<K>) {
  const {
    id,
    icon,
    title,
    subtitle,
    scopeLabel,
    footerNote,
    keys,
    rules,
    values,
    getLabel,
    toggle,
    canEdit,
    editor,
    extra,
  } = props
  const isEditing = editor.isEditing(id)

  const viewRows: SettingsTableRow[] = keys.map(key => {
    const { label, unit } = getLabel(key)
    const rowLabel = getRowLabel(label, unit)
    const value = values?.[key]
    const valueText = value === undefined ? '_' : formatStoredNumber(value)
    return {
      id: key,
      cells: [{ text: rowLabel }, { text: valueText }, { text: formatRuleRange(rules[key]), isMuted: true }],
      accessibilityLabel: `${rowLabel}: ${valueText}`,
    }
  })

  return (
    <SettingsSection
      icon={icon}
      title={title}
      subtitle={subtitle}
      scopeLabel={scopeLabel}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      onEdit={canEdit ? () => editor.startEditing(id) : undefined}
      isEditing={isEditing}
      footerNote={footerNote}
    >
      {isEditing ? (
        <NumberTuningEditor {...props} />
      ) : (
        <>
          <SettingsTable columns={getColumns()} rows={viewRows} />
          {toggle && <ToggleRow label={toggle.label} value={toggle.value} />}
          {extra}
        </>
      )}
    </SettingsSection>
  )
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md },
  flex: { flex: 1 },
})
