import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ESCALATION_MS, RECOVERY_VERIFY_MS, escalationDelays, percentile, summary, verificationDelays } from './nfr15.js'

test('percentile theo nearest-rank', () => {
  const values = Array.from({ length: 20 }, (_, i) => i + 1)
  assert.equal(percentile(values, 95), 19)
  assert.equal(percentile(values, 50), 10)
  assert.equal(percentile([], 95), null)
})

test('độ trễ leo thang tính từ created_at + 15 phút, đếm cảnh báo chưa leo thang', () => {
  const created = Date.UTC(2026, 10, 18, 3, 0, 0)
  const alerts = [
    { created_at: new Date(created).toISOString(), escalated_at: new Date(created + ESCALATION_MS + 42_000).toISOString() },
    { created_at: new Date(created).toISOString() },
  ]
  assert.deepEqual(escalationDelays(alerts), { delays: [42_000], missing: 1 })
  // Gộp trùng còn 2/30 cảnh báo: thiếu mẫu so với số cần đo, không đạt dù cả hai đều nhanh
  assert.deepEqual(escalationDelays(alerts, 30), { delays: [42_000], missing: 29 })
  assert.match(summary('a', escalationDelays(alerts.slice(0, 1), 30)), /KHÔNG ĐẠT/)
})

test('độ trễ chờ duyệt tính từ done_at + 10 phút; thiếu một Work Order thì không đạt', () => {
  const done = Date.UTC(2026, 10, 18, 3, 20, 0)
  const orders = [
    { done_at: new Date(done).toISOString(), verified_at: new Date(done + RECOVERY_VERIFY_MS + 15_000).toISOString() },
    { done_at: new Date(done).toISOString() },
  ]
  const result = verificationDelays(orders)
  assert.deepEqual(result, { delays: [15_000], missing: 1 })
  assert.match(summary('b', result), /KHÔNG ĐẠT/)
  assert.match(summary('b', { delays: [15_000], missing: 0 }), /→ ĐẠT/)
})
