import { AuditLog } from '@/models/auditLog.model'
import { SystemSetting } from '@/models/systemSetting.model'
import { Farm } from '@/models/farm.model'
import { SensorNode, CameraNode, IN_SERVICE } from '@/models/device.model'
import { User, canSignIn, type UserStatus } from '@/models/user.model'
import { Zone } from '@/models/houseZone.model'
import { summarizeByStatus } from '@/services/device.service'
import { logAction } from '@/services/auditLog.service'
import { createInAppNotification, findRecipients } from '@/services/notification.service'
import { AppError } from '@/utils/appError.util'
import { activeExpertIds, listActiveHouseIds, listActiveZoneIds } from '@/utils/farmAccess.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import {
  DEFAULT_THRESHOLDS, REF5_ENTRY_PATTERN, SOURCE_MAX_LENGTH, THRESHOLD_KEYS, assertValidThresholds, pickThresholds,
} from '@/utils/thresholds.util'
import type { Thresholds } from '@/types'

export interface ListAuditLogsQuery {
  actorId?: string
  action?: string
  targetType?: string
  targetId?: string
  from?: string
  to?: string
  page?: string | number
  limit?: string | number
}

export async function listAuditLogs(query: ListAuditLogsQuery): Promise<{
  records: Array<Record<string, unknown> & { target_name: string | null }>
  total: number; page: number; limit: number
}> {
  const filter: Record<string, unknown> = {}
  if (query.actorId) filter.actor_id = query.actorId
  if (query.action) filter.action = query.action
  if (query.targetType) filter.target_type = query.targetType
  if (query.targetId) filter.target_id = query.targetId
  if (query.from || query.to) {
    filter.created_at = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    }
  }

  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit)
      .populate('actor_id', 'full_name email role').lean(),
    AuditLog.countDocuments(filter),
  ])

  // 1 query gộp cho cả trang
  const userIds = records.filter(r => r.target_type === 'user' && r.target_id).map(r => String(r.target_id))
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('full_name').lean() : []
  const names = new Map(users.map(u => [String(u._id), u.full_name]))
  return {
    records: records.map(r => ({ ...r, target_name: r.target_type === 'user' && r.target_id ? names.get(String(r.target_id)) ?? null : null })),
    total, page, limit,
  }
}

const SINGLETON = { _singleton: true }
const DUPLICATE_KEY = 11000

// Không ghi DB lúc đọc
export async function getDefaultThresholds(): Promise<Thresholds> {
  const setting = await SystemSetting.findOne(SINGLETON).lean()
  return setting?.default_thresholds ?? { ...DEFAULT_THRESHOLDS }
}

// E11000 khi 2 request cùng insert lần đầu; chạy lại thì vào nhánh update
async function writeSetting(update: Record<string, unknown>): Promise<void> {
  const write = () => SystemSetting.findOneAndUpdate(
    SINGLETON, update, { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  try {
    await write()
  } catch (err) {
    if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err
    await write()
  }
}

export interface DefaultThresholdsChange {
  at: Date
  by: string | null
  source: string | null
  before?: Thresholds
  after?: Thresholds
}

export type DefaultThresholdsView = Thresholds & {
  source: string | null
  updated_at: Date | null
  updated_by: string | null
  history: DefaultThresholdsChange[]
}

// Lần đổi cũ chưa ghi nguồn thì source: null. Không cắt bớt vì danh sách nhỏ
export async function getDefaultThresholdsView(): Promise<DefaultThresholdsView> {
  const [setting, logs] = await Promise.all([
    SystemSetting.findOne(SINGLETON).lean(),
    AuditLog.find({ action: 'DEFAULT_THRESHOLDS_UPDATED' })
      .sort({ created_at: -1 }).lean(),
  ])
  const metaOf = (m: Record<string, unknown> | undefined) => (m ?? {}) as { before?: Thresholds; after?: Thresholds; source?: string }
  return {
    ...(setting?.default_thresholds ?? DEFAULT_THRESHOLDS),
    source: setting?.default_thresholds_source ?? null,
    updated_at: setting?.default_thresholds_updated_at ?? null,
    updated_by: setting?.updated_by ? String(setting.updated_by) : null,
    history: logs.map(l => {
      const meta = metaOf(l.metadata)
      return {
        at: l.created_at,
        by: l.actor_id ? String(l.actor_id) : null,
        source: meta.source ?? null,
        before: meta.before,
        after: meta.after,
      }
    }),
  }
}

// Chỉ là tham khảo: zone đang có giữ nguyên, zone tạo hoặc reset sau mới lấy
export async function updateDefaultThresholds(
  adminId: string, input: Record<string, unknown>,
): Promise<Thresholds> {
  const source = typeof input.source === 'string' ? input.source.trim() : ''
  if (!REF5_ENTRY_PATTERN.test(source) || source.length > SOURCE_MAX_LENGTH) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Nguồn phải chứa mã một mục của REF-5 (TL-xxx hoặc MC-xxx)')
  }
  const changes = pickThresholds(input)
  if (Object.keys(changes).length === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Không có ngưỡng nào để đổi')
  }
  const before = await getDefaultThresholds()
  const after: Thresholds = { ...before, ...changes }
  assertValidThresholds(after)

  await writeSetting({
    default_thresholds: after, default_thresholds_source: source,
    default_thresholds_updated_at: new Date(), updated_by: adminId,
  })
  await logAction(adminId, 'DEFAULT_THRESHOLDS_UPDATED', 'system_settings', undefined, { before, after, source })

  const changedKeys = THRESHOLD_KEYS.filter(k => before[k] !== after[k])
  if (changedKeys.length > 0) {
    void notifyZonesDifferingFromDefaults(changedKeys, after).catch((err: Error) =>
      logger.warn('Báo zone khác ngưỡng mặc định mới thất bại', { err }))
  }
  return after
}

type ThresholdKey = typeof THRESHOLD_KEYS[number]

// Không áp gì vào zone. Farm chưa có chuyên gia thì gửi Farm Owner
export async function notifyZonesDifferingFromDefaults(changedKeys: ThresholdKey[], after: Thresholds): Promise<void> {
  const zones = await Zone.find({
    $or: changedKeys.map(k => ({ [`thresholds.${k}`]: { $ne: after[k] } })),
  }).select('farm_id name thresholds').lean()
  if (zones.length === 0) return

  const byFarm = new Map<string, typeof zones>()
  for (const z of zones) byFarm.set(String(z.farm_id), [...(byFarm.get(String(z.farm_id)) ?? []), z])
  // Farm tự ẩn farm đã xoá mềm
  const farms = await Farm.find({ _id: { $in: [...byFarm.keys()] } }).select('name members')

  await Promise.all(farms.map(async farm => {
    const experts = await activeExpertIds(farm)
    const recipients = experts.length > 0
      ? experts
      : (await findRecipients(String(farm._id))).map(u => String(u._id))
    const lines = (byFarm.get(String(farm._id)) ?? []).map(z => {
      const differing = changedKeys.filter(k => z.thresholds?.[k] !== after[k])
      return `${z.name}: ${differing.map(k => `${k} ${z.thresholds?.[k]} (mặc định mới ${after[k]})`).join(', ')}`
    })
    const message = {
      title: `Ngưỡng mặc định đã đổi: ${lines.length} Zone của ${farm.name} khác mặc định mới`,
      body: `${lines.join('; ')}. Ngưỡng các Zone giữ nguyên; đặt lại hoặc sửa nếu cần.`,
    }
    await Promise.all(recipients.map(id => createInAppNotification(id, message)))
  }))
}

export async function getHealthOverview() {
  const [activeFarmIds, zoneIds, houseIds] = await Promise.all([
    Farm.find({ is_deleted: false }).distinct('_id'),
    listActiveZoneIds(),
    listActiveHouseIds(),
  ])
  const [sensorStatuses, cameraStatuses, userGroups] = await Promise.all([
    SensorNode.find({ zone_id: { $in: zoneIds }, ...IN_SERVICE }).select('status').lean(),
    CameraNode.find({ house_id: { $in: houseIds }, ...IN_SERVICE }).select('status').lean(),

    // tách DELETED khỏi LOCKED
    User.aggregate<{ _id: { role: string | null; status: UserStatus | null }; count: number }>([
      { $group: { _id: { role: '$role', status: '$status' }, count: { $sum: 1 } } },
    ]),
  ])


  const users = {
    total: 0, active: 0, inactive: 0, deleted: 0,
    byRole: {} as Record<string, { active: number; inactive: number; deleted: number }>,
  }
  for (const g of userGroups) {
    const role = g._id.role ?? 'NONE'
    users.byRole[role] ??= { active: 0, inactive: 0, deleted: 0 }
    if (g._id.status === 'DELETED') {
      users.byRole[role].deleted += g.count
      users.deleted += g.count
    } else if (canSignIn({ status: g._id.status ?? 'ACTIVE' })) {
      users.byRole[role].active += g.count
      users.active += g.count
    } else {
      users.byRole[role].inactive += g.count
      users.inactive += g.count
    }
    users.total += g.count
  }

  return {
    farms: { total: activeFarmIds.length },
    zones: { total: zoneIds.length },
    devices: summarizeByStatus([...sensorStatuses, ...cameraStatuses]),

    users,
  }
}
