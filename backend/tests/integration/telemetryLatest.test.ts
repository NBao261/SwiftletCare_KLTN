import express from 'express'
import request from 'supertest'
import telemetryRoutes from '@/routes/telemetry.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Telemetry } from '@/models/telemetry.model'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use('/telemetry', telemetryRoutes)
app.use(errorHandler)

useTestDb()

describe('GET /telemetry/zones/:id/latest (ENV-FR-004)', () => {
  it('returns 200 with null when the zone has no reading yet', async () => {
    const { zone, token } = await seedOwnerFarm()
    const res = await request(app).get(`/telemetry/zones/${zone._id}/latest`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body).toEqual({ success: true, data: null })
  })

  it('returns the newest reading of the zone', async () => {
    const { zone, node, token } = await seedOwnerFarm()
    await Telemetry.create([
      { node_id: node._id, zone_id: zone._id, timestamp: new Date('2026-10-01T00:00:00Z'), temperature: 28 },
      { node_id: node._id, zone_id: zone._id, timestamp: new Date('2026-10-02T00:00:00Z'), temperature: 29 },
    ])
    const res = await request(app).get(`/telemetry/zones/${zone._id}/latest`).set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data).toMatchObject({ temperature: 29 })
  })
})
