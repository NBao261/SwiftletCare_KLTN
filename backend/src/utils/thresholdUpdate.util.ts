import { publishCommand } from '@/mqtt/mqtt.client'
import { logAction } from '@/services/auditLog.service'
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
export async function applyThresholdUpdate(
  chain: { zone: IZone; house: IHouse; farm: IFarm },
  user: CurrentUser,
  params: {
    /** Giá trị gán vào zone.thresholds (đã merge/validate xong). */
    thresholds: Thresholds
    /** Giá trị ghi vào threshold_history.new_values — chỉ các field thực sự đổi khi update thủ công, hoặc cả bộ khi reset. */
    historyValues: Partial<Thresholds>
    source: 'MANUAL' | 'RESET_TO_DEFAULT'
    /** Field phụ để phân biệt nguồn gọi trong audit log (VD viaNodeId khi cập nhật qua Device). */
    logDetails?: Record<string, unknown>
  },
): Promise<IZone> {
  const { zone, house, farm } = chain
  const oldValues = { ...zone.thresholds }

  zone.thresholds = params.thresholds
  zone.threshold_history.push({
    changed_by: user._id as never,
    changed_at: new Date(),
    old_values: oldValues,
    new_values: params.historyValues,
    source: params.source,
  } as never)
  await zone.save()

  publishCommand(String(farm._id), String(house._id), String(zone._id), 'config/update', zone.thresholds)
  await logAction(user._id, 'THRESHOLD_UPDATED', 'zone', String(zone._id), {
    source: params.source, before: oldValues, after: zone.thresholds, ...params.logDetails,
  })

  return zone
}
