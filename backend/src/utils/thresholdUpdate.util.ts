import { publishZoneConfig } from '@/services/deviceConfig.service'
import { logAction } from '@/services/auditLog.service'
import { formatChanges, notifyExpertDecision } from '@/services/expertActivity.service'
import { trackParameterChange } from '@/services/parameterReview.service'
import type { IZone, IHouse } from '@/models/houseZone.model'
import type { IFarm } from '@/models/farm.model'
import { THRESHOLD_KEYS } from '@/utils/thresholds.util'
import { isUnchanged } from '@/utils/parameterChange.util'
import type { Thresholds, CurrentUser } from '@/types'

// Không đặt trong thresholds.util: model import file đó, sẽ thành circular require
export const THRESHOLD_HISTORY_LIMIT = 100

export async function applyThresholdUpdate(
  chain: { zone: IZone; house: IHouse; farm: IFarm },
  user: CurrentUser,
  params: {
    thresholds: Thresholds
    // Chỉ field thực sự đổi, hoặc cả bộ khi reset
    historyValues: Partial<Thresholds>
    source: 'MANUAL' | 'RESET_TO_DEFAULT' | 'EXPERT_REVERT'
    logDetails?: Record<string, unknown>
  },
): Promise<IZone> {
  const { zone, house, farm } = chain
  const oldValues = { ...zone.thresholds }
  // Không đổi gì (vd khôi phục mặc định khi đang là mặc định) thì không ghi, không phát lại, không báo ai
  const pickKeys = (values: Partial<Thresholds>) => Object.fromEntries(THRESHOLD_KEYS.map(key => [key, Number(values[key])]))
  if (isUnchanged(pickKeys(oldValues), pickKeys(params.thresholds))) return zone

  zone.thresholds = params.thresholds
  zone.threshold_history.push({
    changed_by: user._id as never,
    changed_by_role: user.role,
    changed_at: new Date(),
    old_values: oldValues,
    new_values: params.historyValues,
    source: params.source,
  } as never)
  // Giới hạn để document không lớn mãi; audit_logs vẫn giữ đủ
  const overflow = zone.threshold_history.length - THRESHOLD_HISTORY_LIMIT
  if (overflow > 0) zone.threshold_history.splice(0, overflow)
  await zone.save()

  await publishZoneConfig(zone._id)
  const newValues = zone.toObject().thresholds as Thresholds
  const auditId = await logAction(user._id, 'THRESHOLD_UPDATED', 'zone', String(zone._id), {
    source: params.source, before: oldValues, after: newValues, zone_id: String(zone._id), house_id: String(house._id),
    ...params.logDetails,
  }, { farmId: String(farm._id) })
  // Mục duyệt tự báo Farm Owner và tự đóng
  if (params.source === 'EXPERT_REVERT') return zone

  await notifyExpertDecision(user, farm._id, auditId, {
    what: params.source === 'RESET_TO_DEFAULT' ? 'đặt lại ngưỡng về mặc định' : 'sửa ngưỡng',
    place: `Zone "${zone.name}"`,
    detail: formatChanges(oldValues, newValues),
  })
  await trackParameterChange(chain, user, 'thresholds', oldValues, newValues)

  return zone
}
