import { publishCommand } from '@/mqtt/mqtt.client'
import { logAction } from '@/services/auditLog.service'
import { formatChanges, notifyExpertDecision } from '@/services/expertActivity.service'
import { trackParameterChange } from '@/services/parameterReview.service'
import type { IZone, IHouse } from '@/models/houseZone.model'
import type { IFarm } from '@/models/farm.model'
import type { Thresholds, CurrentUser } from '@/types'

/**
 * Ghi ngưỡng mới cho 1 zone + phát sinh mọi tác dụng phụ đi kèm (ENV-FR-006/020):
 * lưu threshold_history, publish MQTT config/update để ESP32 áp dụng ngay, ghi
 * audit log. Dùng chung cho farm.service.ts#updateZoneThresholds/resetZoneThresholds
 * và device.service.ts#updateNodeThresholds — trước đây 3 hàm này tự lặp lại y hệt
 * chuỗi bước này, dễ lệch nhau khi chỉ sửa 1 chỗ (VD thêm 1 field vào audit log).
 *
 * Cố tình KHÔNG đặt trong `thresholds.util.ts`: file đó được `houseZone.model.ts`
 * import để lấy `DEFAULT_THRESHOLDS` làm default cho schema — nếu hàm này (kéo
 * theo `mqtt.client.ts`/`auditLog.service.ts`, và xa hơn là `telemetry.service.ts`
 * require lại `houseZone.model.ts`) nằm chung file, sẽ tạo circular require khiến
 * `DEFAULT_THRESHOLDS` đọc được `undefined` lúc model đang khởi tạo.
 */
export const THRESHOLD_HISTORY_LIMIT = 100

export async function applyThresholdUpdate(
  chain: { zone: IZone; house: IHouse; farm: IFarm },
  user: CurrentUser,
  params: {
    /** Giá trị gán vào zone.thresholds (đã merge/validate xong). */
    thresholds: Thresholds
    /** Giá trị ghi vào threshold_history.new_values — chỉ các field thực sự đổi khi update thủ công, hoặc cả bộ khi reset. */
    historyValues: Partial<Thresholds>
    /** EXPERT_REVERT: chuyên gia hoàn lại thay đổi của Farm Owner (expertReview.service, EXPERT-FR-010) */
    source: 'MANUAL' | 'RESET_TO_DEFAULT' | 'EXPERT_REVERT'
    /** Field phụ để phân biệt nguồn gọi trong audit log (VD viaNodeId khi cập nhật qua Device). */
    logDetails?: Record<string, unknown>
  },
): Promise<IZone> {
  const { zone, house, farm } = chain
  const oldValues = { ...zone.thresholds }

  zone.thresholds = params.thresholds
  zone.threshold_history.push({
    changed_by: user._id as never,
    changed_by_role: user.role,
    changed_at: new Date(),
    old_values: oldValues,
    new_values: params.historyValues,
    source: params.source,
  } as never)
  // Mảng nhúng trong document zone — giữ bản gần nhất để document không lớn mãi
  // (audit_logs vẫn giữ đủ lịch sử thay đổi)
  const overflow = zone.threshold_history.length - THRESHOLD_HISTORY_LIMIT
  if (overflow > 0) zone.threshold_history.splice(0, overflow)
  await zone.save()

  publishCommand(String(farm._id), String(house._id), String(zone._id), 'config/update', zone.thresholds)
  const newValues = zone.toObject().thresholds as Thresholds
  const auditId = await logAction(user._id, 'THRESHOLD_UPDATED', 'zone', String(zone._id), {
    source: params.source, before: oldValues, after: newValues, zone_id: String(zone._id), house_id: String(house._id),
    ...params.logDetails,
  }, { farmId: String(farm._id) })
  // Hoàn lại do chuyên gia: mục duyệt tự báo Farm Owner và tự đóng (expertReview.service) — không báo, không mở lần hai
  if (params.source === 'EXPERT_REVERT') return zone

  // EXPERT-FR-009 — sửa/reset ngưỡng của chuyên gia báo cho Farm Owner
  await notifyExpertDecision(user, farm._id, auditId, {
    what: params.source === 'RESET_TO_DEFAULT' ? 'đặt lại ngưỡng về mặc định' : 'sửa ngưỡng',
    place: `Khu vực "${zone.name}"`,
    detail: formatChanges(oldValues, newValues),
  })
  // EXPERT-FR-010 — Farm Owner sửa trên farm có chuyên gia mở mục duyệt; chuyên gia sửa thì đóng ADJUSTED
  await trackParameterChange(chain, user, 'thresholds', oldValues, newValues)

  return zone
}
