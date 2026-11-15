import { Types } from 'mongoose'
import { Alert, IAlert } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { House, IHouse, Zone } from '@/models/houseZone.model'
import { createInAppNotification, dispatchAlertNotification, findRecipients } from '@/services/notification.service'
import { activeHouseTechnicianIds, activeTechnicianOnDuty } from '@/utils/farmAccess.util'
import logger from '@/utils/logger.util'

/** BR-40, Report 3 §4.5 — thời gian người nhận đầu tiên có để xác nhận trước khi Farm Owner được báo (5–60, mặc định 15) */
export const ESCALATION_MIN = 15
export const ESCALATION_MS = ESCALATION_MIN * 60_000

/** Nhà của 1 cảnh báo: cảnh báo của nhà (camera đếm chim) hoặc nhà chứa zone */
export async function findAlertHouse(alert: Pick<IAlert, 'house_id' | 'zone_id'>): Promise<IHouse | null> {
  if (alert.house_id) return House.findById(alert.house_id)
  if (!alert.zone_id) return null
  const zone = await Zone.findById(alert.zone_id).select('house_id').lean()
  return zone ? House.findById(zone.house_id) : null
}

const ownerIds = async (farmId: unknown): Promise<string[]> => (await findRecipients(String(farmId))).map(u => String(u._id))

/**
 * ALERT-FR-017, BR-40 — người nhận cảnh báo mới: thợ đang trực của nhà (AUTH-FR-014); CRITICAL tới cả thợ lẫn
 * Farm Owner cùng lúc; nhà không có thợ thì Farm Owner. Ghi `routing` để job leo thang biết Farm Owner đã được
 * báo chưa. Cảnh báo suy luận còn tạo yêu cầu kiểm tra tại chỗ cho thợ (EXPERT-FR-021); chuyên gia được báo
 * trong ứng dụng ở dispatchAlertNotification (EXPERT-FR-007). Trả về id người nhận để createAlert gửi.
 */
export async function routeNewAlert(alert: IAlert, opts: { awaitsVerdict: boolean }): Promise<string[]> {
  const house = await findAlertHouse(alert)
  const farm = house ? await Farm.findById(alert.farm_id).select('members') : null
  const technicianId = house && farm ? await activeTechnicianOnDuty(house, farm) : null
  const ownersNotified = !technicianId || alert.severity === 'CRITICAL'
  // Tìm đủ người nhận rồi mới ghi `routing`: lỗi giữa chừng thì cảnh báo không mang định tuyến dở dang
  const recipientIds = [...(technicianId ? [technicianId] : []), ...(ownersNotified ? await ownerIds(alert.farm_id) : [])]

  alert.routing = { ...(technicianId && { technician_id: technicianId as never }), owners_notified: ownersNotified }
  await Alert.updateOne({ _id: alert._id }, { $set: { routing: alert.routing } })

  if (opts.awaitsVerdict && technicianId) await requestOnsiteCheck(alert, technicianId)
  return recipientIds
}

/**
 * SM-01 — cảnh báo bị bác bỏ nhầm được chuyên gia xác nhận lại: báo lại như cảnh báo mới, cho thợ đang trực của nhà
 * lúc này (ALERT-FR-017) và cả Farm Owner. Ghi `owners_notified` để job leo thang không báo Farm Owner lần nữa
 * (BR-40: một lần); không tạo thêm yêu cầu kiểm tra tại chỗ. Giữ `technician_id` ban đầu: MTTA/MTTR theo thợ
 * (OPS-FR-009) tính từ lúc tạo nên thuộc về thợ được định tuyến lúc đó, không phải thợ trực lúc xác nhận lại.
 * Không tự lưu: nơi gọi lưu cùng lần đổi trạng thái.
 */
export async function rerouteReconfirmedAlert(alert: IAlert): Promise<string[]> {
  const house = await findAlertHouse(alert)
  const farm = house ? await Farm.findById(alert.farm_id).select('members') : null
  const technicianId = house && farm ? await activeTechnicianOnDuty(house, farm) : null
  const recipientIds = [...(technicianId ? [technicianId] : []), ...await ownerIds(alert.farm_id)]
  const routedTechnician = alert.routing?.technician_id ?? (technicianId ? new Types.ObjectId(technicianId) : undefined)
  alert.routing = { ...(routedTechnician && { technician_id: routedTechnician }), owners_notified: true }
  return recipientIds
}

/**
 * ALERT-FR-015 — người nhận lần gửi lại: những ai đã nhận lần đầu. Farm Owner đã nhận bản leo thang (BR-40) thì
 * không nhận thêm bản "Nhắc lại" cùng lúc. Thợ bị gỡ khỏi nhà, khỏi farm hay bị khoá từ lúc đó thì thôi
 * (AUTH-FR-013). Cảnh báo trước G-21 (không có `routing`) gửi Farm Owner như cũ.
 */
export async function repeatRecipientIds(alert: IAlert): Promise<string[] | undefined> {
  if (!alert.routing) return undefined
  const technician = alert.routing.technician_id && await stillHouseTechnician(alert, String(alert.routing.technician_id))
    ? [String(alert.routing.technician_id)]
    : []
  const owners = alert.routing.owners_notified && !alert.escalated_at ? await ownerIds(alert.farm_id) : []
  return [...technician, ...owners]
}

async function stillHouseTechnician(alert: IAlert, technicianId: string): Promise<boolean> {
  const house = await findAlertHouse(alert)
  const farm = house ? await Farm.findById(alert.farm_id).select('members') : null
  return !!house && !!farm && (await activeHouseTechnicianIds(house, farm)).includes(technicianId)
}

/**
 * BR-40 — cảnh báo thợ chưa xác nhận sau ESCALATION_MIN được báo Farm Owner đúng 1 lần (đánh dấu trước rồi mới
 * gửi: 2 lượt job chồng nhau chỉ 1 lượt gửi). Cảnh báo đã xác nhận, bác bỏ hoặc đã đóng thì không leo thang.
 */
export async function escalateUnacknowledgedAlerts(now = new Date()): Promise<number> {
  const due = await Alert.find({
    status: 'ACTIVE',
    'routing.owners_notified': false,
    created_at: { $lte: new Date(now.getTime() - ESCALATION_MS) },
  })
  let sent = 0
  for (const alert of due) {
    const { modifiedCount } = await Alert.updateOne(
      { _id: alert._id, status: 'ACTIVE', 'routing.owners_notified': false },
      { $set: { 'routing.owners_notified': true, escalated_at: now } },
    )
    if (modifiedCount === 0) continue
    try {
      await dispatchAlertNotification(alert, { escalation: true, recipientIds: await ownerIds(alert.farm_id) })
      sent++
    } catch (err) {
      logger.error('Leo thang cảnh báo lên Farm Owner thất bại', { alertId: String(alert._id), err })
    }
  }
  return sent
}

/**
 * EXPERT-FR-021 — cảnh báo suy luận ở nhà có thợ: đúng 1 yêu cầu kiểm tra tại chỗ cho thợ đang trực, báo trong
 * ứng dụng. Gọi 1 lần lúc tạo cảnh báo (lần gặp lại cùng sự cố bị dedup, không tạo thêm).
 */
async function requestOnsiteCheck(alert: IAlert, technicianId: string): Promise<void> {
  const check = { technician_id: technicianId as never, requested_at: new Date() }
  alert.onsite_checks = [check]
  await Alert.updateOne({ _id: alert._id, 'onsite_checks.0': { $exists: false } }, { $set: { onsite_checks: [check] } })
  try {
    await createInAppNotification(technicianId, {
      title: `Cần kiểm tra tại chỗ: ${alert.title}`,
      body: 'Ghi điều quan sát được ở nhà (chim bị động, có người làm việc gần đó, mưa, cảm biến bẩn hoặc hỏng…) trước khi chuyên gia kết luận.',
      ref: { kind: 'alert', id: String(alert._id) },
    })
  } catch (err) {
    // Yêu cầu đã lưu trong cảnh báo; thợ vẫn thấy khi mở cảnh báo
    logger.warn('Báo yêu cầu kiểm tra tại chỗ thất bại', { alertId: String(alert._id), err })
  }
}
