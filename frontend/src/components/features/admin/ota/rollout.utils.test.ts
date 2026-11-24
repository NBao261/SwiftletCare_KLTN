import { describe, expect, it } from 'vitest'
import { busyNodeIds, ineligibleReason, rolloutCounts, targetStatus } from '@/components/features/admin/ota/rollout.utils'
import type { FirmwareRollout, RolloutTarget, SensorNode } from '@/types'

const target = (nodeId: string, state: RolloutTarget['state'], canary = false): RolloutTarget =>
  ({ node_id: nodeId, device_id: nodeId, from_version: '2.4.0', canary, state, attempts: 0 })

const rollout = (targets: RolloutTarget[], extra: Partial<FirmwareRollout> = {}): FirmwareRollout =>
  ({ _id: 'r', image_id: 'i', version: '2.5.0', status: 'ACTIVE', stage: 'ALL', targets, created_at: '2026-11-24T00:00:00Z', ...extra })

const node = (id: string, firmware: string, extra: Partial<SensorNode> = {}) => ({ _id: id, firmware_version: firmware, ...extra }) as SensorNode

describe('đợt cập nhật firmware', () => {
  it('đếm máy theo trạng thái', () => {
    const counts = rolloutCounts(rollout([
      target('a', 'SUCCEEDED'), target('b', 'SENT'), target('c', 'QUEUED'), target('d', 'FAILED'), target('e', 'SKIPPED'),
    ]))
    expect(counts).toEqual({ total: 5, succeeded: 1, sending: 1, waiting: 1, failed: 1, closed: 1 })
  })

  it('máy chờ nói rõ chờ gì: máy online, máy thử, đợt tiếp tục', () => {
    const canaryStage = rollout([target('a', 'SENT', true), target('b', 'QUEUED')], { stage: 'CANARY' })
    expect(targetStatus(canaryStage.targets[1], canaryStage, false).label).toBe('Chờ máy kết nối lại')
    expect(targetStatus(canaryStage.targets[1], canaryStage, true).label).toBe('Chờ máy thử xong')
    const paused = rollout([target('b', 'QUEUED')], { status: 'PAUSED' })
    expect(targetStatus(paused.targets[0], paused, true).label).toBe('Chờ đợt tiếp tục')
    expect(targetStatus(target('x', 'FAILED'), paused, true).tone).toBe('critical')
  })

  it('loại máy firmware quá cũ, đã đúng bản, đang trong đợt khác', () => {
    const busy = busyNodeIds([
      rollout([target('busy', 'QUEUED'), target('done', 'SUCCEEDED')]),
      rollout([target('old-rollout', 'QUEUED')], { status: 'CANCELLED' }),
    ])
    expect([...busy]).toEqual(['busy'])
    expect(ineligibleReason(node('a', '1.3.9'), '2.5.0', busy)).toBe('Firmware quá cũ, cần nạp qua USB')
    expect(ineligibleReason(node('a', '2.5.0'), '2.5.0', busy)).toBe('Đã chạy bản này')
    expect(ineligibleReason(node('busy', '2.4.0'), '2.5.0', busy)).toBe('Đang có cập nhật chưa xong')
    expect(ineligibleReason(node('a', '2.4.0', { ota_pending: { version: '2.4.1', url: '', requested_at: '' } }), '2.5.0', busy))
      .toBe('Đang có cập nhật chưa xong')
    // Hạ bản vẫn chọn được (quay về bản cũ khi bản mới có lỗi)
    expect(ineligibleReason(node('a', '2.6.0'), '2.5.0', busy)).toBeNull()
  })
})
