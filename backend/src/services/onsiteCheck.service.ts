import { Alert, type OnsiteObservation } from '@/models/alert.model'
import { getAlert, getAlertDetail } from '@/services/alert.service'
import { openWorkOrderForAlert, storePhotos, type UploadedPhoto } from '@/services/workOrder.service'
import { ConflictError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

/**
 * EXPERT-FR-021 — Farm Technician được giao nhà (route chỉ FARM_TECHNICIAN; getAlert kiểm nhà, nhà khác → 403) ghi
 * điều quan sát được cho yêu cầu kiểm tra của cảnh báo suy luận, kèm ảnh tuỳ chọn; câu trả lời vào bằng chứng
 * trước khi chuyên gia kết luận. Không có yêu cầu, hoặc đã trả lời → 409. `SENSOR_ANOMALY` mà cảm biến bẩn/hỏng
 * thì mở ngay Work Order sửa chữa (BR-39).
 */
export async function answerOnsiteCheck(
  alertId: string, user: CurrentUser, input: { observation: OnsiteObservation; note?: string }, photo?: UploadedPhoto,
) {
  const alert = await getAlert(alertId, user)
  const check = alert.onsite_checks?.[0]
  if (!check) throw ConflictError('Cảnh báo này không có yêu cầu kiểm tra tại chỗ')
  if (check.answered_at) throw ConflictError('Yêu cầu kiểm tra tại chỗ đã được trả lời')

  const [photoKey] = photo ? await storePhotos([photo], `onsite-checks/${alert._id}`) : []
  const { modifiedCount } = await Alert.updateOne(
    { _id: alert._id, 'onsite_checks.0.answered_at': { $exists: false } },
    {
      $set: {
        'onsite_checks.0.observation': input.observation,
        'onsite_checks.0.note': input.note?.trim() || undefined,
        'onsite_checks.0.photo': photoKey,
        'onsite_checks.0.answered_by': user._id,
        'onsite_checks.0.answered_at': new Date(),
      },
    },
  )
  if (modifiedCount === 0) throw ConflictError('Yêu cầu kiểm tra tại chỗ đã được trả lời')

  if (alert.type === 'SENSOR_ANOMALY' && input.observation === 'SENSOR_DIRTY_OR_FAULTY') {
    await openWorkOrderForAlert(alert, 'ONSITE_CHECK')
  }
  return getAlertDetail(alertId, user)
}
