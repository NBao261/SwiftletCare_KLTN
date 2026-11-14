import { useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { PhotoCaptureField } from '@/components/common/PhotoCaptureField'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { useCompleteWorkOrder } from '@/hooks/work-order/useCompleteWorkOrder'
import { usePalette } from '@/hooks/theme/usePalette'
import type { LocalPhoto, SiteCause, WorkOrder } from '@/types'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'
import { getSiteCauseLabel } from '@/utils/label.utils'
import {
  getRemainingPhotoSlots,
  hasRecoveryCheck,
  isCauseAlertType,
  SITE_CAUSES,
  WORK_ORDER_MAX_PHOTOS,
} from '@/utils/workOrder.utils'
import { t } from '@/utils/i18n.utils'

const NOTE_INPUT_HEIGHT = 96
// Việc đã làm dài tối đa (api-spec work_note)
const NOTE_MAX_LENGTH = 2000
// Cao tối đa phần form: còn chỗ cho nút khi bàn phím mở
const FORM_MAX_HEIGHT = 480

interface WorkOrderDoneSheetProps {
  // null: sheet đóng
  workOrder: WorkOrder | null
  onClose: () => void
  onDone: (message: string) => void
}

// Báo đã làm xong một Work Order (OPS-FR-002, ALERT-FR-018): nguyên nhân tìm thấy tại chỗ (bắt buộc với cảnh báo thiết bị), việc
// đã làm, ảnh (5 ảnh cho cả Work Order, tính cả ảnh của lần báo xong trước khi bị mở lại). Gửi xong Work Order sang "đang kiểm
// dữ liệu" (BR-41) rồi chờ chủ trại duyệt; Work Order vừa đổi trạng thái (409) thì báo và tải lại
export function WorkOrderDoneSheet({ workOrder, onClose, onDone }: WorkOrderDoneSheetProps) {
  const palette = usePalette()
  const complete = useCompleteWorkOrder(workOrder?._id ?? '')
  // Đang lưu thì không cho đóng sheet: sheet chỉ mount khi mở, đóng sớm thì React Query bỏ callback của mutate() và mất câu báo
  // kết quả (dữ liệu vẫn được hook làm mới)
  const closeUnlessSaving = () => {
    if (!complete.isPending) onClose()
  }
  const [cause, setCause] = useState<SiteCause | null>(null)
  const [workNote, setWorkNote] = useState('')
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const isCauseRequired = isCauseAlertType(workOrder?.alert_type)
  const keptPhotoCount = workOrder?.photo_urls?.length ?? 0
  const remainingPhotos = workOrder ? getRemainingPhotoSlots(workOrder) : WORK_ORDER_MAX_PHOTOS
  // Work Order vừa tải lại có thêm ảnh thì ảnh đã chụp có thể vượt chỗ còn lại: bỏ bớt ảnh mới gửi được, khỏi để backend trả 400
  const canSave = (!isCauseRequired || cause !== null) && photos.length <= remainingPhotos
  // Loại cảnh báo chưa có dữ liệu để kiểm (BR-41) vẫn qua VERIFYING một nhịp rồi chuyển thẳng chủ trại kiểm tại chỗ
  const isRecoveryChecked = workOrder ? hasRecoveryCheck(workOrder) : false

  const save = () => {
    if (!workOrder || !canSave) return
    complete.mutate(
      { cause: cause ?? undefined, workNote: workNote.trim() || undefined, photos },
      {
        onSuccess: response =>
          onDone(
            response.data.data.status !== 'VERIFYING'
              ? t('Đã báo xong, chờ chủ trại duyệt')
              : isRecoveryChecked
                ? t('Đã báo xong, hệ thống đang kiểm dữ liệu phục hồi')
                : t('Đã báo xong, chờ chủ trại kiểm tại chỗ rồi duyệt'),
          ),
        // Hook đã tải lại Work Order khi gặp 409; ở đây chỉ báo và đóng sheet
        onError: error => {
          if (readApiError(error).status === 409) onDone(t('Work Order đã đổi trạng thái, đã tải lại'))
        },
      },
    )
  }

  const errorMessage =
    complete.error && readApiError(complete.error).status !== 409
      ? getSettingsErrorMessage(complete.error, {
          // 400: ảnh sai kiểu, quá 5 MB, hoặc vượt số ảnh cho phép (ảnh đã gửi vừa thay đổi; hook đã tải lại số ảnh)
          400: t('Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh và tối đa {max} ảnh tính cả ảnh đã gửi trước', {
            max: WORK_ORDER_MAX_PHOTOS,
          }),
          403: t('Chỉ kỹ thuật viên được giao nhà này hoặc chủ trại mới báo xong được'),
          422: t('Cảnh báo thiết bị cần ghi nguyên nhân tìm thấy tại chỗ'),
        })
      : null

  return (
    <BottomSheet visible={workOrder !== null} onClose={closeUnlessSaving}>
      <View style={styles.header}>
        <Text variant="heading">{t('Báo đã làm xong')}</Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
          {workOrder?.title ?? ''}
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
            {isCauseRequired ? t('Nguyên nhân tìm thấy tại chỗ (bắt buộc)') : t('Nguyên nhân tìm thấy tại chỗ (nếu có)')}
          </Text>
          <ChoiceChips
            options={SITE_CAUSES.map(item => ({ id: item, label: getSiteCauseLabel(item) }))}
            selectedId={cause}
            onSelect={id => setCause(current => (current === id && !isCauseRequired ? null : id))}
            placement="card"
            accessibilityLabel={t('Nguyên nhân tìm thấy tại chỗ')}
          />
        </View>
        <TextInput
          value={workNote}
          onChangeText={setWorkNote}
          multiline
          maxLength={NOTE_MAX_LENGTH}
          placeholder={t('Việc đã làm (không bắt buộc)')}
          placeholderTextColor={palette.textSecondary}
          accessibilityLabel={t('Việc đã làm')}
          textAlignVertical="top"
          style={[styles.input, { backgroundColor: palette.surfaceStrong, borderColor: palette.border, color: palette.text }]}
        />
        {keptPhotoCount > 0 && (
          <Text variant="small" color={palette.textSecondary}>
            {remainingPhotos > 0
              ? t('Đã có {n} ảnh từ lần báo xong trước, chụp thêm được {m} ảnh', { n: keptPhotoCount, m: remainingPhotos })
              : t('Đã đủ {max} ảnh từ lần báo xong trước, không chụp thêm được', { max: WORK_ORDER_MAX_PHOTOS })}
          </Text>
        )}
        <PhotoCaptureField
          photos={photos}
          onChange={setPhotos}
          maxPhotos={remainingPhotos}
          disabled={complete.isPending}
        />
        <Text variant="small" color={palette.textSecondary}>
          {!workOrder?.alert_id
            ? t('Gửi xong, Work Order chuyển chủ trại duyệt.')
            : isRecoveryChecked
              ? t('Gửi xong, hệ thống kiểm dữ liệu giữ phục hồi trong 10 phút rồi chuyển chủ trại duyệt; sự cố quay lại thì Work Order về "Đang làm".')
              : t('Gửi xong, loại sự cố này chưa có dữ liệu để hệ thống kiểm nên chuyển thẳng chủ trại kiểm tại chỗ rồi duyệt.')}
        </Text>
      </ScrollView>
      <FormMessage message={errorMessage} />
      <Button label={t('Gửi')} onPress={save} loading={complete.isPending} disabled={!canSave} />
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
