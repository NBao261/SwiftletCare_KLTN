import { useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { useSetAlertVerdict } from '@/hooks/alert/useSetAlertVerdict'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertVerdictResult } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { t } from '@/utils/i18n.utils'

const NOTE_INPUT_HEIGHT = 96
// Ghi chú phán quyết tối đa 1000 ký tự (api-spec PUT /alerts/{id}/verdict)
const NOTE_MAX_LENGTH = 1000

interface VerdictSheetProps {
  alertId: string
  // null: sheet đóng
  result: AlertVerdictResult | null
  onClose: () => void
  onDone: () => void
}

// Chuyên gia xác nhận đúng hoặc bác bỏ cảnh báo suy luận (EXPERT-FR-003). Bác bỏ bắt buộc ghi lý do (đặc tả §3.3) —
// backend không bắt nên app chặn; đổi phán quyết được bất cứ lúc nào
export function VerdictSheet({ alertId, result, onClose, onDone }: VerdictSheetProps) {
  const palette = usePalette()
  const setVerdict = useSetAlertVerdict()
  const [note, setNote] = useState('')
  const isReject = result === 'REJECTED'
  const isNoteMissing = isReject && note.trim() === ''

  const save = () => {
    if (!result || isNoteMissing) return
    setVerdict.mutate({ alertId, result, note: note.trim() || undefined }, { onSuccess: onDone })
  }

  return (
    <BottomSheet visible={result !== null} onClose={onClose}>
      <Text variant="heading">{isReject ? t('Bác bỏ cảnh báo') : t('Xác nhận cảnh báo đúng')}</Text>
      <Text variant="small" color={palette.textSecondary}>
        {isReject
          ? t('Ghi lý do bác bỏ để chủ trại và lần kiểm chứng sau tham khảo.')
          : t('Ghi chú thêm nếu cần (không bắt buộc).')}
      </Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={NOTE_MAX_LENGTH}
        placeholder={isReject ? t('Lý do bác bỏ') : t('Ghi chú')}
        placeholderTextColor={palette.textSecondary}
        accessibilityLabel={isReject ? t('Lý do bác bỏ') : t('Ghi chú')}
        textAlignVertical="top"
        style={[
          styles.input,
          { backgroundColor: palette.surfaceStrong, borderColor: palette.border, color: palette.text },
        ]}
      />
      <FormMessage message={setVerdict.error ? getSettingsErrorMessage(setVerdict.error) : null} />
      <Button
        label={isReject ? t('Bác bỏ') : t('Xác nhận đúng')}
        onPress={save}
        disabled={isNoteMissing}
        loading={setVerdict.isPending}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  input: {
    ...Typography.body,
    height: NOTE_INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
})
