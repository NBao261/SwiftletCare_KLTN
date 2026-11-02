import { describe, expect, it } from '@jest/globals'
import type { Alert, CameraNode, RelayOverrideLog, SensorNode, Zone } from '@/types'
import { getHouseStatus, getHouseStatusRank, type HouseStatusInput } from '@/utils/houseStatus.utils'

const now = new Date('2026-10-30T10:00:00.000Z').getTime()
const thresholds = { temp_min: 26, temp_max: 31, humidity_min: 75, humidity_max: 95, light_max: 0.2, nh3_max: 25, co2_max: 1500 }
const zones: Zone[] = [
  { _id: 'zone-1', house_id: 'house-1', name: 'Tầng 1', floor: 1, thresholds },
  { _id: 'zone-2', house_id: 'house-1', name: 'Tầng 2', floor: 2, thresholds },
]

// Controller tối thiểu cho test
function buildSensor(zoneId: string, status: SensorNode['status'], lastHeartbeat?: string): SensorNode {
  return {
    _id: `node-${zoneId}`,
    device_id: `device-${zoneId}`,
    zone_id: zoneId,
    firmware_version: '1.4.0',
    status,
    last_heartbeat: lastHeartbeat,
    relay_states: { misting: false, speaker: false, ventilation: false },
    control_mode: 'AUTO',
  }
}

// Cảnh báo đang mở tối thiểu cho test
function buildAlert(type: Alert['type'], severity: Alert['severity'], extra: Partial<Alert> = {}): Alert {
  return {
    _id: `alert-${type}`,
    farm_id: 'farm-1',
    zone_id: 'zone-2',
    type,
    severity,
    title: type,
    message: '',
    status: 'ACTIVE',
    created_at: '2026-10-30T09:50:00.000Z',
    ...extra,
  }
}

// Nhà bình thường: 2 controller online, số đo mới
function buildInput(overrides: Partial<HouseStatusInput> = {}): HouseStatusInput {
  return {
    zones,
    sensorNodes: [buildSensor('zone-1', 'ONLINE'), buildSensor('zone-2', 'ONLINE')],
    cameraNodes: [],
    activeAlerts: [],
    manualOverrides: [],
    ...overrides,
  }
}

describe('getHouseStatus', () => {
  it('mất kết nối nặng nhất, ghi tầng và thời gian', () => {
    const input = buildInput({
      sensorNodes: [buildSensor('zone-2', 'OFFLINE', '2026-10-30T09:46:00.000Z')],
      activeAlerts: [buildAlert('RS485_BUS_FAILURE', 'HIGH')],
    })
    expect(getHouseStatus(input, now)).toMatchObject({ kind: 'offline', message: 'Tầng 2 mất kết nối 14 phút' })
  })

  it('camera AI mất kết nối', () => {
    const camera: CameraNode = { _id: 'camera-1', device_id: 'cam', house_id: 'house-1', status: 'OFFLINE', last_heartbeat: '2026-10-30T09:55:00.000Z' }
    expect(getHouseStatus(buildInput({ cameraNodes: [camera] }), now).message).toBe('Camera AI mất kết nối 5 phút')
  })

  it('cảnh báo cao hiện tên sự cố ngắn và mở chi tiết cảnh báo', () => {
    const alert = buildAlert('RS485_BUS_FAILURE', 'HIGH', { zone_id: 'zone-1' })
    expect(getHouseStatus(buildInput({ activeAlerts: [alert] }), now)).toEqual({
      kind: 'critical',
      message: 'Tầng 1 lỗi bus cảm biến',
      target: { screen: 'alert', alertId: alert._id },
    })
  })

  it('vượt ngưỡng ghi chỉ số kèm độ lệch', () => {
    const above = buildAlert('THRESHOLD_BREACH', 'MEDIUM', {
      metadata: { breaches: [{ metric: 'temperature', value: 32.8, limit: 31, direction: 'above' }] },
    })
    expect(getHouseStatus(buildInput({ activeAlerts: [above] }), now)).toMatchObject({
      kind: 'threshold',
      message: 'Tầng 2 nhiệt +1,8°C',
      metric: 'temperature',
    })
    const below = buildAlert('THRESHOLD_BREACH', 'MEDIUM', {
      zone_id: 'zone-1',
      metadata: { breaches: [{ metric: 'humidity', value: 69, limit: 75, direction: 'below' }] },
    })
    expect(getHouseStatus(buildInput({ activeAlerts: [below] }), now).message).toBe('Tầng 1 ẩm −6%')
  })

  it('cảnh báo mức thấp của cả nhà viết hoa đầu câu', () => {
    const alert = buildAlert('LOW_RETURN_RATE', 'LOW', { zone_id: undefined, house_id: 'house-1' })
    expect(getHouseStatus(buildInput({ activeAlerts: [alert] }), now)).toMatchObject({
      kind: 'attention',
      message: 'Tỷ lệ về tổ giảm',
    })
  })

  it('chưa có thiết bị, hoặc thiết bị quá hạn kết nối', () => {
    expect(getHouseStatus(buildInput({ sensorNodes: [] }), now).message).toBe('Chưa có thiết bị')
    const pending = { ...buildSensor('zone-1', 'PENDING'), activation_overdue_at: '2026-10-30T09:40:00.000Z' }
    expect(getHouseStatus(buildInput({ sensorNodes: [pending] }), now).message).toBe('Thiết bị chưa kết nối')
  })

  it('relay chạy thủ công, rồi tới ổn', () => {
    const override: RelayOverrideLog = {
      _id: 'o',
      node_id: 'node-zone-2',
      zone_id: 'zone-2',
      farm_id: 'farm-1',
      relay: 'misting',
      state: true,
      started_at: '2026-10-30T09:48:00.000Z',
      expires_at: '2026-10-30T10:18:30.000Z',
      ended_at: null,
      end_reason: null,
    }
    expect(getHouseStatus(buildInput({ manualOverrides: [override] }), now).message).toBe(
      'Bơm Tầng 2 chạy thủ công, còn 18 phút',
    )
    expect(getHouseStatus(buildInput(), now)).toEqual({ kind: 'ok', message: 'Tất cả trong ngưỡng', target: { screen: 'house' } })
  })
})

describe('getHouseStatusRank', () => {
  it('mất kết nối đứng trước, ổn đứng sau cùng', () => {
    expect(getHouseStatusRank('offline')).toBeLessThan(getHouseStatusRank('critical'))
    expect(getHouseStatusRank('manual')).toBeLessThan(getHouseStatusRank('ok'))
  })
})
