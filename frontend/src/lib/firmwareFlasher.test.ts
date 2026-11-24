import { describe, expect, it } from 'vitest'
import { NVS_END, NVS_START, compareVersions, detectFirmwareVersion, factorySegments } from '@/lib/firmwareFlasher'

describe('nạp firmware qua cổng USB', () => {
  it('chia ảnh cài đặt thành hai đoạn, bỏ vùng NVS để giữ mã và Wi-Fi của bo', () => {
    const image = new Uint8Array(0x20000).map((_, i) => i % 251)
    const [head, tail] = factorySegments(image)
    expect(head.address).toBe(0)
    expect(head.data.length).toBe(NVS_START)
    expect(tail.address).toBe(NVS_END)
    expect(tail.data.length).toBe(image.length - NVS_END)
    expect(tail.data[0]).toBe(image[NVS_END])
    // Ảnh ngắn hơn vùng NVS (không phải ảnh gộp) thì ghi nguyên
    expect(factorySegments(new Uint8Array(100))).toHaveLength(1)
  })

  it('so phiên bản theo số, không theo chữ', () => {
    expect(compareVersions('2.4.0', '2.10.0')).toBeLessThan(0)
    expect(compareVersions('2.4.1', '2.4.0')).toBeGreaterThan(0)
    expect(compareVersions('2.4.0', '2.4.0')).toBe(0)
  })

  it('đọc phiên bản từ dòng chào trong file, không có thì null', () => {
    const image = new Uint8Array(0x20000).fill(0xff)
    image.set(new TextEncoder().encode('SwiftletCare ESP32 Firmware v2.10.3 starting'), 0x10100)
    expect(detectFirmwareVersion(image)).toBe('2.10.3')
    expect(detectFirmwareVersion(new Uint8Array(1024))).toBeNull()
  })
})
