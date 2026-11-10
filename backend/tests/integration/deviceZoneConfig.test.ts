/** Report 4 §7.2 — cấu hình thuộc Zone đi tới từng thiết bị, luôn là bản đầy đủ vì `config` retained */
import { SensorNode } from '@/models/device.model'
import { publishDeviceConfig } from '@/mqtt/mqtt.client'
import { publishZoneConfig } from '@/services/deviceConfig.service'
import { seedOwnerFarm as seed, useTestDb } from '../helpers/ownerFarm'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceConfig: jest.fn().mockReturnValue(true) }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
useTestDb()

it('mỗi thiết bị trong Zone nhận bản đầy đủ của nó, thiết bị đã gỡ thì không', async () => {
  const { zone, node } = await seed()
  const second = await SensorNode.create({ device_id: 'node_second', zone_id: zone._id, status: 'ONLINE', audio: { current_track: 3 } })
  await SensorNode.create({ device_id: 'node_gone', zone_id: zone._id, decommissioned_at: new Date() })

  await publishZoneConfig(zone._id)

  const calls = jest.mocked(publishDeviceConfig).mock.calls
  expect(calls.map(call => call[0]).sort()).toEqual([node.device_id, second.device_id].sort())
  expect(calls.find(call => call[0] === 'node_second')![1]).toMatchObject({
    deviceId: 'node_second', speaker_track: 3, temp_max: expect.any(Number), fuzzy_humidity_band: expect.any(Number),
  })
})
