import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { StyleSheet, TextInput, View } from 'react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { useAcknowledgeAlert } from '@/hooks/alert/useAcknowledgeAlert'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert } from '@/types'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'
import { getAlertTypeLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

const NOTE_INPUT_HEIGHT = 88
// Ghi chú dài tối đa như phán quyết (api-spec)
const NOTE_MAX_LENGTH = 1000

type QuickNote = 'watching' | 'checking' | 'technician'

function getQuickNotes(): { id: QuickNote; label: string }[] {
  return [
    { id: 'watching', label: t('Đã biết, đang theo dõi') },
    { id: 'checking', label: t('Đang kiểm tra tại nhà') },
    { id: 'technician', label: t('Đã báo kỹ thuật viên') },
  ]
}

interface AcknowledgeSheetProps {
  // null: sheet đóng; mỗi lần mở màn truyền key mới để ghi chú bắt đầu trống
  alert: Alert | null
  onClose: () => void
  onDone: (message: string) => void
}

// Xác nhận đã biết một cảnh báo (ALERT-FR-009, chỉ chủ trại): chip ghi chú nhanh hoặc tự gõ, để trống vẫn lưu được.
// Cảnh báo vừa đổi trạng thái (409) thì báo và tải lại
export function AcknowledgeSheet({ alert, onClose, onDone }: AcknowledgeSheetProps) {
  const palette = usePalette()
  const queryClient = useQueryClient()
  const acknowledge = useAcknowledgeAlert()
  const [quickNote, setQuickNote] = useState<QuickNote | null>(null)
  const [note, setNote] = useState('')

  const selectQuickNote = (id: QuickNote) => {
    setQuickNote(id)
    setNote(getQuickNotes().find(item => item.id === id)?.label ?? '')
  }

  const save = () => {
    if (!alert) return
    acknowledge.mutate(
      { alertId: alert._id, note: note.trim() || undefined },
      {
        onSuccess: () => onDone(t('Đã xác nhận cảnh báo')),
        onError: error => {
          if (readApiError(error).status !== 409) return
          void queryClient.invalidateQueries({ queryKey: ['alerts'] })
          onDone(t('Cảnh báo đã thay đổi, danh sách đã tải lại'))
        },
      },
    )
  }

  const errorMessage =
    acknowledge.error && readApiError(acknowledge.error).status !== 409
      ? getSettingsErrorMessage(acknowledge.error)
      : null

  return (
    <BottomSheet visible={alert !== null} onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading">{t('Xác nhận cảnh báo')}</Text>
        <Text variant="small" color={palette.textSecondary}>
          {alert ? getAlertTypeLabel(alert.type) : ''}
        </Text>
      </View>
      <ChoiceChips
        options={getQuickNotes()}
        selectedId={quickNote}
        onSelect={selectQuickNote}
        placement="card"
        accessibilityLabel={t('Ghi chú nhanh')}
      />
      <TextInput
        value={note}
        onChangeText={text => {
          setNote(text)
          setQuickNote(null)
        }}
        multiline
        maxLength={NOTE_MAX_LENGTH}
        placeholder={t('Ghi chú (không bắt buộc)')}
        placeholderTextColor={palette.textSecondary}
        accessibilityLabel={t('Ghi chú xác nhận')}
        textAlignVertical="top"
        style={[
          styles.input,
          { backgroundColor: palette.surfaceStrong, borderColor: palette.border, color: palette.text },
        ]}
      />
      <FormMessage message={errorMessage} />
      <Button label={t('Lưu')} onPress={save} loading={acknowledge.isPending} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  input: {
    ...Typography.body,
    height: NOTE_INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
})
