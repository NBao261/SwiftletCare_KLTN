import { describe, expect, it } from '@jest/globals'
import type { BirdCountDay } from '@/types'
import { buildHlsUrl, formatBirdCountRows, getCameraCountSummary, getCameraStatusBadge } from '@/utils/camera.utils'

// Số đếm một ngày tối thiểu cho test
function buildDay(overrides: Partial<BirdCountDay>): BirdCountDay {
  return {
    date: '2026-10-31',
    morning_entry: 0,
    morning_exit: 0,
    evening_entry: 0,
    evening_exit: 0,
    net_exit: 0,
    net_entry: 0,
    return_rate: null,
    has_morning: false,
    has_evening: false,
    ...overrides,
  }
}

describe('getCameraStatusBadge', () => {
  it('online là LIVE, offline là mất kết nối', () => {
    expect(getCameraStatusBadge('ONLINE')).toBe('LIVE')
    expect(getCameraStatusBadge('OFFLINE')).toBe('MẤT KẾT NỐI')
  })
})

describe('getCameraCountSummary', () => {
  it('ưu tiên số chim về của phiên chiều', () => {
    expect(getCameraCountSummary(buildDay({ has_morning: true, has_evening: true, net_exit: 2462, net_entry: 2450 }))).toBe(
      '2.450 chim về',
    )
  })

  it('mới có phiên sáng thì số chim ra; chưa có gì thì báo chưa có số', () => {
    expect(getCameraCountSummary(buildDay({ has_morning: true, net_exit: 128 }))).toBe('128 chim ra')
    expect(getCameraCountSummary(undefined)).toBe('Chưa có số đếm hôm nay')
  })
})

describe('formatBirdCountRows', () => {
  it('phiên chưa có thì ghi _', () => {
    expect(formatBirdCountRows(buildDay({ has_morning: true, net_exit: 128 }))).toEqual({
      exitText: 'Chim ra: 128',
      entryText: 'Chim vào: _',
    })
  })
})

describe('buildHlsUrl', () => {
  it('ghép gốc HLS, tên stream và token', () => {
    expect(buildHlsUrl('http://192.168.1.5:8888/', 'cam-cam_01', 'a b')).toBe(
      'http://192.168.1.5:8888/cam-cam_01/index.m3u8?token=a%20b',
    )
  })
})
