import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INITIAL_READING, activeSession, bucketCounts, bucketStartOf, heartbeat, nextReading, telemetry } from './payloads.js'

const vn = (hh, mm) => Date.UTC(2026, 10, 12, hh - 7, mm) // giờ Việt Nam → epoch

test('phiên theo giờ Việt Nam và khung mặc định BR-13', () => {
  assert.equal(activeSession(vn(5, 29)), null)
  assert.equal(activeSession(vn(5, 30)), 'MORNING_EXIT')
  assert.equal(activeSession(vn(6, 59)), 'MORNING_EXIT')
  assert.equal(activeSession(vn(7, 0)), null)
  assert.equal(activeSession(vn(18, 0)), 'EVENING_ENTRY')
})

test('khoảng 5 phút bắt đầu ở mốc chẵn 5 phút', () => {
  assert.equal(bucketStartOf(vn(18, 7) + 42_000), vn(18, 5))
})

test('số đo luôn trong khoảng vật lý; breach kéo độ ẩm xuống dưới 75 %', () => {
  let normal = INITIAL_READING
  let breach = INITIAL_READING
  for (let i = 0; i < 200; i++) {
    normal = nextReading(normal)
    breach = nextReading(breach, Math.random, { breach: true })
  }
  assert.ok(normal.humidity > 75 && normal.humidity <= 100)
  assert.ok(breach.humidity < 75)
  assert.ok(normal.temperature >= 20 && normal.temperature <= 40)
})

test('tin có đúng các trường backend đọc', () => {
  const t = telemetry('SIM-1', { ...INITIAL_READING, humidity: 70 }, 1)
  assert.deepEqual(t.relay_states, { misting: true, speaker: false, ventilation: false })
  assert.equal(t.deviceId, 'SIM-1')
  assert.equal(heartbeat('SIM-1', { appliedConfigVersion: 5, justConnected: true, uptimeMs: 10 }).appliedConfigVersion, 5)
  assert.equal(heartbeat('SIM-1', { appliedConfigVersion: 5, justConnected: false, uptimeMs: 10 }).justConnected, undefined)
})

test('chim ra buổi sáng, về buổi tối', () => {
  const morning = bucketCounts('MORNING_EXIT', () => 0.5)
  const evening = bucketCounts('EVENING_ENTRY', () => 0.5)
  assert.ok(morning.exit_count > morning.entry_count)
  assert.ok(evening.entry_count > evening.exit_count)
})
