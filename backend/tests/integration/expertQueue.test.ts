import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { Types } from 'mongoose'
import expertActivityRoutes from '@/routes/expertActivity.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { CoefficientProposal } from '@/models/coefficientProposal.model'
import { ConfigProfile } from '@/models/configProfile.model'
import { Farm } from '@/models/farm.model'
import { HarvestCycle } from '@/models/harvestCycle.model'
import { HouseHealthReport } from '@/models/houseHealthReport.model'
import { House, Zone } from '@/models/houseZone.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { RecommendationRule } from '@/models/recommendationRule.model'
import { User } from '@/models/user.model'
import type { Role } from '@/types'
import { useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
const app = express()
app.use(express.json())
app.use('/expert-activity', expertActivityRoutes)
app.use(errorHandler)

useTestDb()

const tokenFor = (id: unknown, role: Role) => jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

let seq = 0
async function seed() {
  seq++
  const mk = (role: Role, p: string) => User.create({ email: `${p}${seq}@q.vn`, password_hash: 'password123', full_name: p, role })
  const [owner, expert, outsider] = await Promise.all([mk('FARM_OWNER', 'o'), mk('DOMAIN_EXPERT', 'e'), mk('DOMAIN_EXPERT', 'x')])
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id,
    members: [{ user_id: owner._id, is_primary: true }, { user_id: expert._id, role: 'DOMAIN_EXPERT' }],
  })
  const house = await House.create({ farm_id: farm._id, name: `Nhà ${seq}` })
  const zone = await Zone.create({ farm_id: farm._id, house_id: house._id, name: 'Tầng 1' })
  const get = (token: string, farmId: unknown = farm._id) =>
    request(app).get('/expert-activity/queue').query({ farmId: String(farmId) }).set('Authorization', `Bearer ${token}`)
  return { owner, expert, outsider, farm, house, zone, get }
}

describe('GET /expert-activity/queue — việc chờ chuyên gia của một trại', () => {
  it('gom mọi loại việc của trại, việc đã được nhắc lên đầu', async () => {
    const s = await seed()
    const base = { farm_id: s.farm._id, house_id: s.house._id }
    await Alert.create([
      { ...base, zone_id: s.zone._id, type: 'NOISE_ANOMALY', severity: 'MEDIUM', title: 'Ồn bất thường', message: 'm', status: 'ACTIVE' },
      { ...base, zone_id: s.zone._id, type: 'SENSOR_ANOMALY', severity: 'MEDIUM', title: 'Cảm biến bất thường', message: 'm', status: 'ACTIVE' },
      // đã có kết luận, không vào hàng đợi
      { ...base, zone_id: s.zone._id, type: 'FORECAST_BREACH', severity: 'LOW', title: 'Đã xong', message: 'm', status: 'ACTIVE',
        expert_verdict: { result: 'CONFIRMED', by: s.expert._id, role: 'DOMAIN_EXPERT', at: new Date() } },
    ])
    const reminded = await Alert.findOne({ title: 'Cảm biến bất thường' })
    await Alert.collection.updateOne({ _id: reminded!._id }, { $set: { expert_reminded_at: new Date() } })
    await ParameterReview.create({
      ...base, target_id: s.house._id, group: 'counting_schedule', old_values: {}, new_values: { profiles: [] },
      status: 'PENDING_REVIEW', changed_by: s.owner._id,
    })
    await CoefficientProposal.collection.insertOne({ farm_id: s.farm._id, zone_id: s.zone._id, status: 'PROPOSED', created_at: new Date() })
    await HouseHealthReport.collection.insertOne({ ...base, kind: 'WEEKLY', period_start: '2026-11-16', period_end: '2026-11-22', generated_at: new Date() })
    await ConfigProfile.create({ farm_id: s.farm._id, author_id: s.owner._id, name: 'Mùa mưa', status: 'DRAFT' })
    await RecommendationRule.collection.insertOne({ farm_id: s.farm._id, name: 'Luật của chủ', pending_approval: true, updated_at: new Date() })
    await HarvestCycle.collection.insertOne({ ...base, zone_id: s.zone._id, status: 'CLOSED', start_date: new Date('2026-06-01'), end_date: new Date('2026-10-01'), created_at: new Date() })
    await House.updateOne({ _id: s.house._id }, { weather_rules_proposal: { rules: [], proposed_by: s.owner._id, proposed_at: new Date() } })

    const res = await s.get(tokenFor(s.expert._id, 'DOMAIN_EXPERT')).expect(200)
    const groups = Object.fromEntries(res.body.data.groups.map((g: { kind: string }) => [g.kind, g]))
    expect(Object.fromEntries(Object.entries(groups).map(([kind, g]) => [kind, (g as { total: number }).total]))).toEqual({
      alert_verdict: 2, parameter_review: 1, coefficient_proposal: 1, disagreeing_day: 0, report_conclusion: 1,
      weather_proposal: 1, profile_draft: 1, recommendation_rule: 1, season_conclusion: 1,
    })
    expect(groups.alert_verdict.items[0]).toMatchObject({ title: 'Cảm biến bất thường', reminded: true, house_name: s.house.name })
    expect(groups.parameter_review.items[0]).toMatchObject({ title: 'Thay đổi lịch đếm chim', house_name: s.house.name })
    expect(groups.season_conclusion.items[0].title).toBe('Mùa vụ Tầng 1')
    expect(groups.report_conclusion.items[0].title).toBe('Báo cáo tuần đến 22/11/2026')
  })

  it('chỉ chuyên gia của trại; Farm Owner và chuyên gia trại khác bị từ chối, thiếu farmId là 422', async () => {
    const s = await seed()
    await s.get(tokenFor(s.owner._id, 'FARM_OWNER')).expect(403)
    await s.get(tokenFor(s.outsider._id, 'DOMAIN_EXPERT')).expect(403)
    await s.get(tokenFor(s.expert._id, 'DOMAIN_EXPERT'), new Types.ObjectId()).expect(404)
    await request(app).get('/expert-activity/queue').set('Authorization', `Bearer ${tokenFor(s.expert._id, 'DOMAIN_EXPERT')}`).expect(422)
  })
})
