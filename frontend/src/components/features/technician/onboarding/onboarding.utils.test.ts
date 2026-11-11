// onboarding.utils.test.ts — Unit tests cho G-09 onboarding wizard
// Covers: QR URI parse, canSubmit logic (CAMERA_NODE vs SENSOR_NODE), payload selection
import { describe, it, expect } from 'vitest'

// ─── QR URI parse (extracted inline from Step2Validate) ───────────────────────
function parseDeviceQR(raw: string): { deviceId: string; secretKey: string } | null {
  try {
    const url = new URL(raw.trim())
    const d   = url.searchParams.get('d')
    const k   = url.searchParams.get('k')
    if (d && k) return { deviceId: d, secretKey: k }
  } catch { /* không phải URI hợp lệ */ }
  return null
}

// ─── canSubmit logic per device type ─────────────────────────────────────────
function canSubmit(
  deviceId: string,
  secretKey: string,
  houseId: string | undefined,
  zoneId: string | undefined,
  deviceType: 'SENSOR_NODE' | 'CAMERA_NODE',
): boolean {
  return deviceType === 'CAMERA_NODE'
    ? Boolean(deviceId.trim() && secretKey.trim() && houseId)
    : Boolean(deviceId.trim() && secretKey.trim() && zoneId)
}

// ─── Payload selection logic ──────────────────────────────────────────────────
function buildPayload(
  deviceId: string,
  secretKey: string,
  houseId: string | undefined,
  zoneId: string | undefined,
  deviceType: 'SENSOR_NODE' | 'CAMERA_NODE',
) {
  return deviceType === 'CAMERA_NODE'
    ? { device_id: deviceId.trim(), house_id: houseId!, secret_key: secretKey.trim() }
    : { device_id: deviceId.trim(), zone_id: zoneId!, secret_key: secretKey.trim() }
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('QR URI parse (FARM-FR-003c)', () => {
  it('parses valid swiftletcare://claim URI', () => {
    const result = parseDeviceQR('swiftletcare://claim?d=ESP32-A7F3-001&k=ABCD-EFGH-JKMN')
    expect(result).toEqual({ deviceId: 'ESP32-A7F3-001', secretKey: 'ABCD-EFGH-JKMN' })
  })

  it('returns null for invalid URI', () => {
    expect(parseDeviceQR('not-a-uri')).toBeNull()
  })

  it('returns null when d or k param is missing', () => {
    expect(parseDeviceQR('swiftletcare://claim?d=ESP32-A7F3-001')).toBeNull()
    expect(parseDeviceQR('swiftletcare://claim?k=ABCD-EFGH-JKMN')).toBeNull()
  })

  it('trims whitespace before parsing', () => {
    const result = parseDeviceQR('  swiftletcare://claim?d=DEV-001&k=KEY-001  ')
    expect(result).toEqual({ deviceId: 'DEV-001', secretKey: 'KEY-001' })
  })
})

describe('canSubmit — CAMERA_NODE requires houseId not zoneId (FARM-FR-004)', () => {
  it('CAMERA_NODE: true when houseId provided, zoneId undefined', () => {
    expect(canSubmit('DEV-001', 'KEY-001', 'house123', undefined, 'CAMERA_NODE')).toBe(true)
  })

  it('CAMERA_NODE: false when houseId missing even if zoneId present', () => {
    expect(canSubmit('DEV-001', 'KEY-001', undefined, 'zone123', 'CAMERA_NODE')).toBe(false)
  })

  it('SENSOR_NODE: true when zoneId provided', () => {
    expect(canSubmit('DEV-001', 'KEY-001', undefined, 'zone123', 'SENSOR_NODE')).toBe(true)
  })

  it('SENSOR_NODE: false when zoneId missing', () => {
    expect(canSubmit('DEV-001', 'KEY-001', 'house123', undefined, 'SENSOR_NODE')).toBe(false)
  })

  it('false when deviceId empty regardless of type', () => {
    expect(canSubmit('', 'KEY-001', 'house123', undefined, 'CAMERA_NODE')).toBe(false)
    expect(canSubmit('  ', 'KEY-001', undefined, 'zone123', 'SENSOR_NODE')).toBe(false)
  })
})

describe('buildPayload — CAMERA_NODE uses house_id (FARM-FR-004)', () => {
  it('CAMERA_NODE payload contains house_id, not zone_id', () => {
    const p = buildPayload('DEV-001', 'KEY-001', 'house123', 'zone123', 'CAMERA_NODE')
    expect(p).toHaveProperty('house_id', 'house123')
    expect(p).not.toHaveProperty('zone_id')
  })

  it('SENSOR_NODE payload contains zone_id, not house_id', () => {
    const p = buildPayload('DEV-001', 'KEY-001', 'house123', 'zone123', 'SENSOR_NODE')
    expect(p).toHaveProperty('zone_id', 'zone123')
    expect(p).not.toHaveProperty('house_id')
  })

  it('trims whitespace in device_id and secret_key', () => {
    const p = buildPayload('  DEV-001  ', '  KEY-001  ', 'h1', 'z1', 'SENSOR_NODE')
    expect(p.device_id).toBe('DEV-001')
    expect(p.secret_key).toBe('KEY-001')
  })
})
