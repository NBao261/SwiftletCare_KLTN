import { Farm } from '@/models/farm.model'
import { House, Zone, type IHouse } from '@/models/houseZone.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { WeatherCompensation } from '@/models/weatherCompensation.model'
import { publishDeviceCompensation } from '@/mqtt/mqtt.client'
import { logAction } from '@/services/auditLog.service'
import { notifyExpertDecision } from '@/services/expertActivity.service'
import { OPEN_METEO_URL, WEATHER_FETCH_TIMEOUT_MS } from '@/services/weather.service'
import { assertExpertDecision, assertHouseAccess, farmHasActiveExpert } from '@/utils/farmAccess.util'
import { ConflictError, ForbiddenError } from '@/utils/appError.util'
import { notifyExpertsOfProposal } from '@/services/notification.service'
import { THRESHOLD_HISTORY_LIMIT } from '@/utils/thresholdUpdate.util'
import {
  assertValidWeatherRules, pickCompensation, summariseForecast, WEATHER_COMP_MAX_MS,
  type ForecastSummary, type WeatherRuleInput,
} from '@/utils/weatherCompensation.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

/**
 * ENV-FR-028…030, BR-38, Report 4 D18 / DF-12 — bù phun sương theo dự báo: Domain Expert đặt luật của nhà
 * (Farm Owner khi farm chưa có chuyên gia, BR-22), job mỗi giờ lấy dự báo 2 giờ tới của farm, chọn offset và
 * gửi retained trên `…/{deviceId}/compensation` cho mọi controller của nhà. Thời tiết chỉ dời phun sương
 * trong ±10 điểm, không bao giờ đụng quạt (C-6).
 */

const ruleView = (rules: IHouse['weather_rules']) => rules.map(r => ({
  _id: String(r._id), metric: r.metric, min: r.min, offset_pct: r.offset_pct, duration_min: r.duration_min, active: r.active,
}))

const proposalView = (proposal: IHouse['weather_rules_proposal']) => proposal && {
  rules: proposal.rules.map(r => ({ ...(r._id && { _id: String(r._id) }), metric: r.metric, min: r.min, offset_pct: r.offset_pct, duration_min: r.duration_min, active: r.active !== false })),
  proposed_by: String(proposal.proposed_by),
  proposed_at: proposal.proposed_at,
}

/** ENV-FR-030 — luật của nhà, đề xuất đang chờ và lần bù gần nhất; Farm Owner, Domain Expert, Farm Technician của nhà đều xem */
export async function getWeatherRules(houseId: string, user: CurrentUser) {
  const { house } = await assertHouseAccess(houseId, user)
  const last = await WeatherCompensation.findOne({ house_id: house._id }).sort({ sent_at: -1 }).lean()
  return {
    house_id: String(house._id),
    rules: ruleView(house.weather_rules),
    proposal: proposalView(house.weather_rules_proposal) ?? null,
    last_compensation: last && {
      rule_id: String(last.rule_id), offset_pct: last.offset_pct, sent_at: last.sent_at, expires_at: last.expires_at,
      forecast: last.forecast,
    },
  }
}

/**
 * ENV-FR-030 — thay cả bộ luật của nhà (như lịch trực): lưu lịch sử cũ/mới, ghi audit, báo Farm Owner khi
 * chuyên gia đổi (EXPERT-FR-009). Luật giữ `_id` cũ khi gửi kèm, để `rule_id` trong nhật ký bù vẫn trỏ đúng;
 * `_id` không thuộc nhà này hoặc gửi trùng thì bỏ, Mongoose cấp id mới. Luật mới có hiệu lực từ lần job kế tiếp.
 */
/** Bộ luật mới của nhà: giữ `_id` cũ khi gửi kèm và thuộc nhà này (gửi trùng thì bỏ), kiểm khoảng BR-38 (400) */
function buildRules(house: IHouse, rules: Array<WeatherRuleInput & { _id?: string }>) {
  const ownIds = new Set(house.weather_rules.map(r => String(r._id)))
  const keptIds = new Set<string>()
  const next = rules.map(r => {
    const id = r._id === undefined ? undefined : String(r._id)
    const keepId = id !== undefined && ownIds.has(id) && !keptIds.has(id)
    if (keepId) keptIds.add(id)
    return {
      ...(keepId && { _id: id }),
      metric: r.metric, min: Number(r.min), offset_pct: Number(r.offset_pct), duration_min: Number(r.duration_min),
      active: r.active !== false,
    }
  })
  assertValidWeatherRules(next)
  return next
}

export async function setWeatherRules(
  houseId: string, user: CurrentUser, rules: Array<WeatherRuleInput & { _id?: string }>,
  // Đặt từ đề xuất đã duyệt: câu thông báo cho Farm Owner nói rõ là duyệt đề xuất
  what = 'đặt luật bù phun sương theo thời tiết',
) {
  const { house, farm } = await assertHouseAccess(houseId, user)
  // BR-22, BR-38 — Farm Owner đặt trực tiếp chỉ khi farm chưa có chuyên gia; có chuyên gia thì gửi đề xuất
  // (POST …/weather-rules/proposal). Farm Technician đã bị chặn ở route
  await assertExpertDecision(farm, user)
  const next = buildRules(house, rules)

  const before = ruleView(house.weather_rules)
  house.set('weather_rules', next)
  // Chuyên gia tự đặt luật thì đề xuất đang chờ không còn khớp: bỏ, ghi lại trong audit và báo Farm Owner
  const dropped = house.weather_rules_proposal ? proposalView(house.weather_rules_proposal) : null
  house.weather_rules_proposal = null
  const after = ruleView(house.weather_rules)
  house.weather_rules_history.push({
    changed_by: user._id as never, changed_by_role: user.role, changed_at: new Date(), old_values: before, new_values: after,
  })
  const overflow = house.weather_rules_history.length - THRESHOLD_HISTORY_LIMIT
  if (overflow > 0) house.weather_rules_history.splice(0, overflow)
  await house.save()

  const auditId = await logAction(user._id, 'WEATHER_RULES_UPDATED', 'house', String(house._id), {
    before, after, house_id: String(house._id), ...(dropped && { dropped_proposal: dropped }),
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what, place: `Nhà "${house.name}"`,
    detail: [`${after.filter(r => r.active).length} luật đang bật`, dropped && 'đề xuất đang chờ của chủ nhà yến đã bỏ']
      .filter(Boolean).join(', '),
  })
  return { house_id: String(house._id), rules: after }
}

/**
 * BR-22, BR-38 (Report 3 4.2.15) — Farm Owner trên farm có chuyên gia gửi bộ luật để chuyên gia duyệt: lưu đề xuất
 * (gửi lại thì thay), báo chuyên gia trong ứng dụng; luật đang chạy không đổi. Farm chưa có chuyên gia → 409 (đặt
 * trực tiếp bằng PUT).
 */
export async function proposeWeatherRules(houseId: string, user: CurrentUser, rules: Array<WeatherRuleInput & { _id?: string }>) {
  const { house, farm } = await assertHouseAccess(houseId, user)
  if (user.role !== 'FARM_OWNER') throw ForbiddenError('Chỉ Farm Owner gửi đề xuất luật bù phun sương')
  if (!(await farmHasActiveExpert(farm))) throw ConflictError('Farm chưa có chuyên gia: đặt luật trực tiếp')
  house.weather_rules_proposal = { rules: buildRules(house, rules), proposed_by: user._id as never, proposed_at: new Date() }
  await house.save()

  await logAction(user._id, 'WEATHER_RULES_PROPOSED', 'house', String(house._id), {
    rules: house.weather_rules_proposal.rules, house_id: String(house._id),
  }, { farmId: String(farm._id) })
  await notifyExpertsOfProposal(farm._id, user, {
    what: 'đề xuất luật bù phun sương', body: `Nhà "${house.name}": luật mới chỉ chạy khi chuyên gia duyệt.`,
    ref: { kind: 'weather_rules', id: String(house._id) },
  })
  return proposalView(house.weather_rules_proposal)
}

/**
 * Lấy đề xuất chuyên gia đã xem (`proposed_at` của bản trên màn) ra khỏi nhà bằng một lệnh ghi có điều kiện: Farm Owner
 * vừa gửi lại, hoặc chuyên gia khác vừa duyệt hay từ chối thì 409, không áp nhầm bản chưa xem
 */
async function takeProposal(houseId: string, user: CurrentUser, seenAt: string) {
  const { house, farm } = await assertHouseAccess(houseId, user)
  if (user.role !== 'DOMAIN_EXPERT') throw ForbiddenError('Chỉ Domain Expert duyệt đề xuất luật bù phun sương')
  const taken = await House.findOneAndUpdate(
    { _id: house._id, 'weather_rules_proposal.proposed_at': new Date(seenAt) },
    { weather_rules_proposal: null },
  ).select('weather_rules_proposal').lean()
  if (!taken?.weather_rules_proposal) throw ConflictError('Đề xuất đã đổi hoặc đã được xử lý, tải lại trang')
  return { house, farm, proposal: taken.weather_rules_proposal }
}

/** Chuyên gia duyệt: áp bộ luật đề xuất như khi tự đặt (lịch sử, audit, báo Farm Owner — EXPERT-FR-009); áp lỗi thì trả đề xuất lại */
export async function approveWeatherRulesProposal(houseId: string, user: CurrentUser, seenAt: string) {
  const { house, proposal } = await takeProposal(houseId, user, seenAt)
  try {
    return await setWeatherRules(houseId, user, proposal.rules, 'duyệt đề xuất luật bù phun sương của chủ nhà yến')
  } catch (err) {
    await House.updateOne({ _id: house._id, weather_rules_proposal: null }, { weather_rules_proposal: proposal })
    throw err
  }
}

/** Chuyên gia từ chối kèm lý do (bắt buộc, 422 ở route): bỏ đề xuất, luật đang chạy giữ nguyên, báo Farm Owner */
export async function rejectWeatherRulesProposal(houseId: string, user: CurrentUser, note: string, seenAt: string) {
  const { house, farm, proposal } = await takeProposal(houseId, user, seenAt)
  const auditId = await logAction(user._id, 'WEATHER_RULES_PROPOSAL_REJECTED', 'house', String(house._id), {
    rules: proposal.rules, note: note.trim(), house_id: String(house._id),
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: 'từ chối đề xuất luật bù phun sương', place: `Nhà "${house.name}"`, detail: `Lý do: ${note.trim()}`,
  })
  return { house_id: String(house._id), rules: ruleView(house.weather_rules) }
}

/** ENV-FR-028 — dự báo 2 giờ tới tại toạ độ farm; lỗi mạng hoặc Open-Meteo lỗi thì null (nơi gọi gửi 0) */
export async function fetchForecast(coordinates: { lat: number; lng: number }, now = new Date()): Promise<ForecastSummary | null> {
  const url = new URL(OPEN_METEO_URL())
  url.searchParams.set('latitude', String(coordinates.lat))
  url.searchParams.set('longitude', String(coordinates.lng))
  url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,precipitation')
  url.searchParams.set('timezone', 'GMT')
  // 2 ngày để cửa sổ 2 giờ qua nửa đêm GMT vẫn đủ mốc
  url.searchParams.set('forecast_days', '2')
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`Open-Meteo trả ${res.status}`)
    const body = (await res.json()) as { hourly?: Parameters<typeof summariseForecast>[0] }
    return summariseForecast(body.hourly, now)
  } catch (err) {
    logger.warn('Lấy dự báo thời tiết thất bại — gửi offset 0', { err: (err as Error).message })
    return null
  }
}

/**
 * ENV-FR-028, BR-38 — gọi mỗi giờ từ jobs/weatherCompensation.job.ts. Mỗi nhà có controller: tính offset từ
 * luật đang bật và dự báo của farm (mỗi farm chỉ gọi Open-Meteo một lần), gửi cho mọi controller của nhà với
 * hạn ≤ 2 giờ; không luật nào thoả, không có luật hoặc không có dự báo thì gửi 0. Lỗi ở một nhà không làm các nhà
 * sau mất offset mới. Trả số nhà đã nhận offset khác 0.
 */
export async function runWeatherCompensation(now = new Date()): Promise<number> {
  const nodes = await SensorNode.find({ ...IN_SERVICE }).select('device_id zone_id').lean()
  if (!nodes.length) return 0
  const zones = await Zone.find({ _id: { $in: nodes.map(n => n.zone_id) } }).select('house_id').lean()
  const houseOfZone = new Map(zones.map(z => [String(z._id), String(z.house_id)]))
  const devicesOfHouse = new Map<string, string[]>()
  for (const node of nodes) {
    const houseId = houseOfZone.get(String(node.zone_id))
    if (houseId) devicesOfHouse.set(houseId, [...(devicesOfHouse.get(houseId) ?? []), node.device_id])
  }

  const houses = await House.find({ _id: { $in: [...devicesOfHouse.keys()] } }).select('farm_id weather_rules').lean()
  const forecasts = new Map<string, Promise<ForecastSummary | null>>()
  const forecastOf = async (farmId: string) => {
    if (!forecasts.has(farmId)) {
      forecasts.set(farmId, Farm.findById(farmId).select('coordinates').lean()
        .then(farm => (farm?.coordinates?.lat !== undefined ? fetchForecast(farm.coordinates, now) : null))
        .catch(() => null))
    }
    return forecasts.get(farmId)!
  }

  let compensated = 0
  for (const house of houses) {
    try {
      const devices = devicesOfHouse.get(String(house._id)) ?? []
      const active = (house.weather_rules ?? []).filter(r => r.active)
      // Không luật nào bật thì không gọi Open-Meteo
      const forecast = active.length ? await forecastOf(String(house.farm_id)) : null
      const rule = pickCompensation(active, forecast)
      const expiresAt = new Date(now.getTime() + (rule ? Math.min(rule.duration_min * 60_000, WEATHER_COMP_MAX_MS) : 0))
      const payload = {
        offset_pct: rule?.offset_pct ?? 0,
        expires_at: expiresAt.getTime(),
        rule_id: rule ? String(rule._id) : null,
      }
      const sent = devices.filter(deviceId => publishDeviceCompensation(deviceId, { deviceId, ...payload })).length
      // NFR-16 so giờ có và không có bù: không controller nào nhận (mất broker) thì giờ đó không được bù
      if (!rule || sent === 0) continue
      compensated++
      await WeatherCompensation.create({
        farm_id: house.farm_id, house_id: house._id, rule_id: rule._id, offset_pct: rule.offset_pct,
        sent_at: now, expires_at: expiresAt, forecast, controllers: sent,
      })
    } catch (err) {
      logger.error('Bù thời tiết của một nhà thất bại', { houseId: String(house._id), err: (err as Error).message })
    }
  }
  return compensated
}
