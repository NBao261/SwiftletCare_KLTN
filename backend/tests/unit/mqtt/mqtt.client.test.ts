const mockConnect = jest.fn((_url: string, _options: { clientId?: string }) => ({ on: jest.fn() }))
jest.mock('mqtt', () => ({ __esModule: true, default: { connect: mockConnect } }))
jest.mock('@/mqtt/handlers/telemetry.handler', () => ({ handleTelemetry: jest.fn() }))
jest.mock('@/mqtt/handlers/heartbeat.handler', () => ({ handleHeartbeat: jest.fn() }))
jest.mock('@/mqtt/handlers/alert.handler', () => ({ handleAlert: jest.fn() }))
jest.mock('@/mqtt/handlers/birdCount.handler', () => ({ handleBirdCount: jest.fn() }))
jest.mock('@/mqtt/handlers/relayStatus.handler', () => ({ handleRelayStatus: jest.fn() }))

import { connectMQTT } from '@/mqtt/mqtt.client'

describe('connectMQTT client ID', () => {
  const saved = process.env.MQTT_CLIENT_ID
  beforeAll(() => { process.env.MQTT_AUTH_KEY = 'test-key' })
  afterAll(() => {
    delete process.env.MQTT_AUTH_KEY
    if (saved === undefined) delete process.env.MQTT_CLIENT_ID
    else process.env.MQTT_CLIENT_ID = saved
  })

  const connectWith = (value: string | undefined): string | undefined => {
    if (value === undefined) delete process.env.MQTT_CLIENT_ID
    else process.env.MQTT_CLIENT_ID = value
    connectMQTT()
    return mockConnect.mock.calls[mockConnect.mock.calls.length - 1][1].clientId
  }

  it('falls back to swiftletcare-backend when unset or left empty in .env', () => {
    expect(connectWith(undefined)).toBe('swiftletcare-backend')
    expect(connectWith('')).toBe('swiftletcare-backend')
  })

  it('uses MQTT_CLIENT_ID when set', () => {
    expect(connectWith('swiftletcare-backend-2')).toBe('swiftletcare-backend-2')
  })
})
