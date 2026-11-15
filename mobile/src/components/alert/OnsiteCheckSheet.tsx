import { useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { PhotoCaptureField } from '@/components/common/PhotoCaptureField'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { useAnswerOnsiteCheck } from '@/hooks/alert/useAnswerOnsiteCheck'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert, LocalPhoto, OnsiteObservation } from '@/types'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'
import { getAlertTypeLabel, getOnsiteObservationLabel, ONSITE_OBSERVATIONS } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

const NOTE_INPUT_HEIGHT = 88
// Ghi chú dài tối đa (api-spec)
const NOTE_MAX_LENGTH = 1000
// Cao tối đa phần form: còn chỗ cho nút khi bàn phím mở
const FORM_MAX_HEIGHT = 480

interface OnsiteCheckSheetProps {
  // null: sheet đóng
  alert: Alert | null
  onClose: () => void
  onDone: (message: string) => void
}

// Thợ của nhà trả lời yêu cầu kiểm tra tại chỗ cảnh báo suy luận (EXPERT-FR-021): chọn điều quan sát được (bắt buộc), ghi chú,
// một ảnh tuỳ chọn. Câu trả lời vào bằng chứng trước khi chuyên gia kết luận; SENSOR_ANOMALY trả lời "cảm biến bẩn hoặc hỏng" thì
// backend mở ngay Work Order sửa chữa. Yêu cầu đã được trả lời hoặc không còn (409) thì báo và tải lại
export function OnsiteCheckSheet({ alert, onClose, onDone }: OnsiteCheckSheetProps) {
  const palette = usePalette()
  const answer = useAnswerOnsiteCheck(alert?._id ?? '')
  // Đang lưu thì không cho đóng sheet: sheet chỉ mount khi mở, đóng sớm thì React Query bỏ callback của mutate() và mất câu báo
  // kết quả (dữ liệu vẫn được hook làm mới)
  const closeUnlessSaving = () => {
    if (!answer.isPending) onClose()
  }
  const [observation, setObservation] = useState<OnsiteObservation | null>(null)
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const opensWorkOrder = alert?.type === 'SENSOR_ANOMALY' && observation === 'SENSOR_DIRTY_OR_FAULTY'

  const save = () => {
    if (!alert || !observation) return
    answer.mutate(
      { observation, note: note.trim() || undefined, photo: photos[0] },
      {
        onSuccess: () =>
          onDone(opensWorkOrder ? t('Đã gửi quan sát, Work Order sửa cảm biến đã được mở') : t('Đã gửi quan sát')),
        // Hook đã tải lại cảnh báo khi gặp 409; ở đây chỉ báo và đóng sheet
        onError: error => {
          if (readApiError(error).status === 409) {
            onDone(t('Yêu cầu kiểm tra đã được trả lời hoặc không còn, cảnh báo đã tải lại'))
          }
        },
      },
    )
  }

  const errorMessage =
    answer.error && readApiError(answer.error).status !== 409
      ? getSettingsErrorMessage(answer.error, {
          400: t('Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB'),
          403: t('Chỉ kỹ thuật viên được giao nhà này mới trả lời được'),
        })
      : null

  return (
    <BottomSheet visible={alert !== null} onClose={closeUnlessSaving}>
      <View style={styles.header}>
        <Text variant="heading">{t('Trả lời kiểm tra tại chỗ')}</Text>
        <Text variant="small" color={palette.textSecondary}>
          {alert ? getAlertTypeLabel(alert.type) : ''}
        </Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary}>
            {t('Bạn thấy gì ở nhà yến?')}
          </Text>
          <ChoiceChips
            options={ONSITE_OBSERVATIONS.map(item => ({ id: item, label: getOnsiteObservationLabel(item) }))}
            selectedId={observation}
            onSelect={setObservation}
            placement="card"
            accessibilityLabel={t('Điều quan sát được')}
          />
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={NOTE_MAX_LENGTH}
          placeholder={t('Ghi chú (không bắt buộc)')}
          placeholderTextColor={palette.textSecondary}
          accessibilityLabel={t('Ghi chú kiểm tra tại chỗ')}
          textAlignVertical="top"
          style={[styles.input, { backgroundColor: palette.surfaceStrong, borderColor: palette.border, color: palette.text }]}
        />
        <PhotoCaptureField photos={photos} onChange={setPhotos} maxPhotos={1} disabled={answer.isPending} />
        {opensWorkOrder && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Gửi xong, hệ thống mở ngay một Work Order sửa cảm biến cho nhà này.')}
          </Text>
        )}
      </ScrollView>
      <FormMessage message={errorMessage} />
      <Button
        label={t('Gửi quan sát')}
        onPress={save}
        loading={answer.isPending}
        disabled={observation === null}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  scroll: { maxHeight: FORM_MAX_HEIGHT, flexGrow: 0 },
  body: { gap: Spacing.md },
  field: { gap: Spacing.sm },
  input: {
    ...Typography.body,
    height: NOTE_INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
})
