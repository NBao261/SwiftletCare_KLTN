import { describe, expect, it } from 'vitest'
import { countByTab, matchesSearch, matchesTab, restartBlockReason, sortDevices } from '@/components/features/technician/devices/deviceStatus.utils'
import type { SensorNode } from '@/types'

const node = (id: string, patch: Partial<SensorNode>): SensorNode => ({ _id: id, device_id: id, zone_id: 'z', status: 'ONLINE', ...patch }) as SensorNode

const nodes = [
  node('on-new', { last_heartbeat: '2026-11-27T10:00:00Z' }),
  node('on-old', { last_heartbeat: '2026-11-27T08:00:00Z' }),
  node('off', { status: 'OFFLINE', last_heartbeat: '2026-11-20T08:00:00Z' }),
  node('late', { status: 'PENDING', activation_overdue_at: '2026-11-26T00:00:00Z' }),
  node('wait', { status: 'PENDING' }),
  node('ota', { ota_failed: { version: '2.4.0', failed_at: '2026-11-26T00:00:00Z' }, firmware_version: '2.4.0' }),
]

describe('thiết bị của Kỹ thuật viên', () => {
  it('đếm và lọc theo tab: cần xử lý gồm quá hạn kích hoạt và cập nhật lỗi', () => {
    expect(countByTab(nodes)).toEqual({ ALL: 6, WARNING: 2, OFFLINE: 1, PENDING: 2, ONLINE: 3 })
    expect(nodes.filter(item => matchesTab(item, 'WARNING')).map(item => item._id)).toEqual(['late', 'ota'])
  })

  it('xếp thiết bị có vấn đề lên trước, cùng nhóm thì kết nối gần nhất trước', () => {
    expect(sortDevices(nodes).map(item => item._id)).toEqual(['late', 'ota', 'off', 'wait', 'on-new', 'on-old'])
  })

  it('khởi động lại từ xa: chỉ khi đang online và firmware từ 1.4.0, nếu không thì nói rõ lý do', () => {
    expect(restartBlockReason(node('ok', { firmware_version: '2.4.0' }))).toBeNull()
    expect(restartBlockReason(node('ok14', { firmware_version: '1.4.0' }))).toBeNull()
    expect(restartBlockReason(node('off', { status: 'OFFLINE', firmware_version: '2.4.0' }))).toContain('mất kết nối')
    expect(restartBlockReason(node('wait', { status: 'PENDING', firmware_version: '2.4.0' }))).toContain('chờ kết nối')
    expect(restartBlockReason(node('old', { firmware_version: '1.3.9' }))).toContain('cần từ v1.4.0')
    expect(restartBlockReason(node('none', {}))).toContain('chưa báo phiên bản')
  })

  it('tìm theo mã thiết bị hoặc firmware, không phân biệt hoa thường', () => {
    expect(nodes.filter(item => matchesSearch(item, ' ON-')).map(item => item._id)).toEqual(['on-new', 'on-old'])
    expect(nodes.filter(item => matchesSearch(item, '2.4')).map(item => item._id)).toEqual(['ota'])
    expect(nodes.filter(item => matchesSearch(item, ''))).toHaveLength(6)
  })
})
