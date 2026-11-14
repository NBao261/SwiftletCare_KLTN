import { useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { PhotoCaptureField } from '@/components/common/PhotoCaptureField'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { useRecordChecklistItem } from '@/hooks/work-order/useRecordChecklistItem'
import { usePalette } from '@/hooks/theme/usePalette'
import type { ChecklistItem, ChecklistResult, LocalPhoto } from '@/types'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'
import { getChecklistResultLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

const NOTE_INPUT_HEIGHT = 88
// Ghi chú dài tối đa (api-spec)
const NOTE_MAX_LENGTH = 1000
// Cao tối đa phần form: còn chỗ cho nút khi bàn phím mở
const FORM_MAX_HEIGHT = 480
const RESULTS: readonly ChecklistResult[] = ['OK', 'DEFECT']

interface ChecklistItemSheetProps {
  workOrderId: string
  // Mục đang ghi và vị trí của nó trong checklist (item_index)
  item: ChecklistItem
  itemIndex: number
  onClose: () => void
  onDone: (message: string) => void
}

// Ghi một mục checklist của Work Order phòng ngừa (OPS-FR-007): Đạt hoặc Hỏng (bắt buộc), ghi chú, một ảnh tuỳ chọn. Hỏng thì hệ
// thống mở một Work Order sửa chữa cho nhà; ghi lại mục đã ghi thì thay kết quả, không mở thêm Work Order sửa chữa. Work Order vừa
// đổi trạng thái (409) thì báo và đóng sheet (hook đã tải lại)
export function ChecklistItemSheet({ workOrderId, item, itemIndex, onClose, onDone }: ChecklistItemSheetProps) {
  const palette = usePalette()
  const record = useRecordChecklistItem(workOrderId)
  const [result, setResult] = useState<ChecklistResult | null>(item.result ?? null)
  const [note, setNote] = useState(item.note ?? '')
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  // Mục mới ghi Hỏng lần đầu: báo trước là sẽ mở Work Order sửa chữa
  const opensRepair = result === 'DEFECT' && !item.repair_work_order_id

  const save = () => {
    if (!result) return
    record.mutate(
      { itemIndex, result, note: note.trim() || undefined, photo: photos[0] },
      {
        onSuccess: () => onDone(opensRepair ? t('Đã ghi, phiếu công việc sửa chữa đã được mở') : t('Đã ghi mục checklist')),
        onError: error => {
          if (readApiError(error).status === 409) onDone(t('Phiếu công việc đã đổi trạng thái, đã tải lại'))
        },
      },
    )
  }

  const errorMessage =
    record.error && readApiError(record.error).status !== 409
      ? getSettingsErrorMessage(record.error, {
          400: t('Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB'),
          403: t('Chỉ kỹ thuật viên được giao nhà này hoặc chủ trại mới ghi được'),
        })
      : null

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading">{t('Ghi mục checklist')}</Text>
        <Text variant="body" color={palette.textSecondary}>
          {item.item}
        </Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ChoiceChips
          options={RESULTS.map(value => ({ id: value, label: getChecklistResultLabel(value) }))}
          selectedId={result}
          onSelect={setResult}
          placement="card"
          accessibilityLabel={t('Kết quả kiểm tra')}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={NOTE_MAX_LENGTH}
          placeholder={t('Ghi chú (không bắt buộc)')}
          placeholderTextColor={palette.textSecondary}
          accessibilityLabel={t('Ghi chú mục checklist')}
          textAlignVertical="top"
          style={[styles.input, { backgroundColor: palette.surfaceStrong, borderColor: palette.border, color: palette.text }]}
        />
        <PhotoCaptureField photos={photos} onChange={setPhotos} maxPhotos={1} disabled={record.isPending} />
        {opensRepair && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Ghi Hỏng thì hệ thống mở ngay một phiếu công việc sửa chữa cho nhà này.')}
          </Text>
        )}
      </ScrollView>
      <FormMessage message={errorMessage} />
      <Button label={t('Lưu')} onPress={save} loading={record.isPending} disabled={result === null} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  scroll: { maxHeight: FORM_MAX_HEIGHT, flexGrow: 0 },
  body: { gap: Spacing.md },
  input: {
    ...Typography.body,
    height: NOTE_INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
})
