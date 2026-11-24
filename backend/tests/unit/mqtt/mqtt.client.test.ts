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

describe('connectMQTT subscriptions', () => {
  type Grant = { topic: string; qos: number }
  type SubscribeCallback = (err: Error | null, granted?: Grant[]) => void

  beforeAll(() => { process.env.MQTT_AUTH_KEY = 'test-key' })
  afterAll(() => { delete process.env.MQTT_AUTH_KEY })
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  // Client giả: giữ handler `connect` và mọi lần subscribe để test tự trả SUBACK
  const fakeClient = () => {
    const handlers: Record<string, () => void> = {}
    const subscribe = jest.fn((_topics: string[], _opts: object, _callback: SubscribeCallback) => undefined)
    const client = {
      connected: true,
      options: { reconnectPeriod: 1000 },
      subscribe,
      on: jest.fn((event: string, handler: () => void) => { handlers[event] = handler }),
    }
    mockConnect.mockReturnValueOnce(client as unknown as { on: jest.Mock })
    connectMQTT()
    handlers.connect()
    const answer = (call: number, granted: Grant[]) => subscribe.mock.calls[call][2](null, granted)
    return { subscribe, answer }
  }

  it('subscribes again when the broker refuses a topic, e.g. before its ACL is loaded', () => {
    const { subscribe, answer } = fakeClient()
    const topics = subscribe.mock.calls[0][0]
    answer(0, topics.map(topic => ({ topic, qos: 128 })))

    jest.advanceTimersByTime(1000)
    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(subscribe.mock.calls[1][0]).toEqual(topics)
  })

  it('does not subscribe again when every topic is granted', () => {
    const { subscribe, answer } = fakeClient()
    answer(0, subscribe.mock.calls[0][0].map(topic => ({ topic, qos: 1 })))

    jest.advanceTimersByTime(5000)
    expect(subscribe).toHaveBeenCalledTimes(1)
  })
})
