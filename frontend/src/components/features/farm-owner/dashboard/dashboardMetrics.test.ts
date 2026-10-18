import { describe, expect, it } from 'vitest'
import { averageReadings, buildAlertRow, latestTimestamp, summarizeNodes, withLiveRelays, averageControlOutput, sortPinnedFirst, buildHouseStability, getAnomalies, getSeverityGroup, mergeBirdCountRecords, summarizeBirdCount, summarizeStability } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import type { BirdCountDailyRecord } from '@/apis/farm-owner/analytics.api'
import type { Alert, House, Thresholds, Zone } from '@/types'

const limits: Thresholds = { temp_min: 26, temp_max: 31, humidity_min: 75, humidity_max: 95, light_max: 0.2, nh3_max: 25, co2_max: 1500 }

function record(date: string, entry: number, rate: number | null = null): BirdCountDailyRecord {
  return { date, morning_exit: 0, evening_entry: entry, return_rate: rate }
}

describe('getAnomalies', () => {
  it('flags hot, cold, humidity, nh3 and co2 outside thresholds', () => {
    expect(getAnomalies({ temperature: 33, humidity: 70, light_lux: 7900, nh3_ppm: 30, co2_ppm: 1600 }, limits)).toEqual({
      tooCold: false, tooHot: true, temperature: true, humidity: true, light: true, nh3: true, co2: true,
    })
    expect(getAnomalies({ temperature: 20 }, limits).tooCold).toBe(true)
  })

  it('ignores missing readings', () => {
    expect(getAnomalies({}, limits)).toEqual({
      tooCold: false, tooHot: false, temperature: false, humidity: false, light: false, nh3: false, co2: false,
    })
  })
})

describe('house stability', () => {
  const houses = [{ _id: 'h1', name: 'Nhà chính' }, { _id: 'h2', name: 'Nhà phụ' }, { _id: 'h3', name: 'Nhà trống' }] as House[]
  const zones = [{ _id: 'z1', house_id: 'h1', name: 'Tầng 1' }, { _id: 'z2', house_id: 'h2', name: 'Tầng 2' }, { _id: 'z3', house_id: 'h3', name: 'Tầng 3' }] as Zone[]

  it('puts houses with faulty devices first and counts the faulty devices', () => {
    const devices = [
      { zone_id: 'z2', status: 'ONLINE' as const, type: 'sensor' as const },
      { zone_id: 'z1', status: 'ONLINE' as const, type: 'sensor' as const },
      { zone_id: 'z1', status: 'OFFLINE' as const, type: 'camera' as const },
      { zone_id: 'z1', status: 'ERROR' as const, type: 'sensor' as const },
    ]
    const items = buildHouseStability(houses, zones, devices)
    expect(items.map(item => [item.name, item.status, item.faultyDevices])).toEqual([
      ['Nhà chính', 'FAULT', 2],
      ['Nhà phụ', 'STABLE', 0],
      ['Nhà trống', 'EMPTY', 0],
    ])
    expect(items[0]).toMatchObject({ faultZoneName: 'Tầng 1', faultDeviceType: 'camera' })
  })

  it('treats waiting devices as normal and summarizes', () => {
    const items = buildHouseStability(houses, zones, [{ zone_id: 'z1', status: 'PENDING', type: 'sensor' }, { zone_id: 'z2', status: 'ONLINE', type: 'sensor' }])
    expect(summarizeStability(items)).toMatchObject({ stableCount: 2, emptyCount: 1, hasDevices: true })
    expect(summarizeStability(items).faultHouses).toEqual([])
  })

  it('has no devices when every house is empty', () => {
    expect(summarizeStability(buildHouseStability(houses, zones, [])).hasDevices).toBe(false)
  })
})

describe('house control summary', () => {
  const relay = (on: boolean) => ({ misting: on, speaker: false, ventilation: false, heating: false })

  it('picks the latest timestamp and ignores missing ones', () => {
    expect(latestTimestamp(['2026-10-10T05:00:00Z', undefined, '2026-10-10T06:00:00Z'])).toBe('2026-10-10T06:00:00Z')
    expect(latestTimestamp([undefined])).toBeUndefined()
  })

  it('is MANUAL when any node is manual and turns a relay on when any node has it on', () => {
    const summary = summarizeNodes([
      { control_mode: 'AUTO', relay_states: relay(false) },
      { control_mode: 'MANUAL', override_expiry: '2026-10-10T06:00:00Z', relay_states: relay(true) },
    ])
    expect(summary).toMatchObject({ controlMode: 'MANUAL', overrideExpiry: '2026-10-10T06:00:00Z' })
    expect(summary.relayStates?.misting).toBe(true)
  })

  it('returns nothing when the house has no sensor node', () => {
    expect(summarizeNodes([])).toEqual({})
  })
})

describe('withLiveRelays', () => {
  const allOff = { misting: false, speaker: false, ventilation: false, heating: false }
  const node = { zone_id: 'z1', control_mode: 'AUTO' as const, relay_states: allOff }

  it('uses the socket relay states of the zone once all 4 relays are known and keeps the REST mode', () => {
    const [next] = withLiveRelays([node], new Map([['z1', { relayStates: { ...allOff, heating: true } }]]))
    expect(next.relay_states.heating).toBe(true)
    expect(next.control_mode).toBe('AUTO')
  })

  it('keeps the REST values while the zone only has a partial relay update', () => {
    const [next] = withLiveRelays([node], new Map([['z1', { relayStates: { misting: true } }]]))
    expect(next).toBe(node)
  })
})

describe('sortPinnedFirst', () => {
  it('puts pinned houses first and keeps the original order inside each group', () => {
    const houses = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }, { _id: 'd' }]
    expect(sortPinnedFirst(houses, new Set(['c', 'a'])).map(house => house._id)).toEqual(['a', 'c', 'b', 'd'])
    expect(sortPinnedFirst(houses, new Set()).map(house => house._id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('averageReadings', () => {
  it('averages each metric over the zones that have a value', () => {
    expect(averageReadings([{ temperature: 30, humidity: 80 }, { temperature: 32 }, {}])).toEqual({ temperature: 31, humidity: 80 })
  })

  it('returns an empty object when nothing is measured', () => {
    expect(averageReadings([])).toEqual({})
    expect(averageReadings([{}, {}])).toEqual({})
  })
})

describe('mergeBirdCountRecords', () => {
  it('sums counts of the same day across zones and averages the return rate', () => {
    const zoneA = [record('2026-10-01', 100, 80), record('2026-10-02', 50)]
    const zoneB = [record('2026-10-01', 40, 60)]
    expect(mergeBirdCountRecords([zoneA, zoneB])).toEqual([
      { date: '2026-10-01', morning_exit: 0, evening_entry: 140, return_rate: 70 },
      { date: '2026-10-02', morning_exit: 0, evening_entry: 50, return_rate: null },
    ])
  })

  it('returns an empty list when no zone has data', () => {
    expect(mergeBirdCountRecords([])).toEqual([])
    expect(mergeBirdCountRecords([[], []])).toEqual([])
  })
})

describe('summarizeBirdCount', () => {
  const now = new Date('2026-10-10T05:00:00Z').getTime()

  it('splits current and previous period and computes the change', () => {
    const records = [
      record('2026-09-30', 100, 80),
      record('2026-10-02', 100, 90),
      record('2026-10-05', 150, 70),
      record('2026-10-09', 150),
    ]
    const summary = summarizeBirdCount(records, 7, now)
    expect(summary.current).toHaveLength(2)
    expect(summary.total).toBe(300)
    expect(summary.deltaPercent).toBe(50)
    expect(summary.avgReturnRate).toBe(70)
  })

  it('has no change or average when there is no data', () => {
    const summary = summarizeBirdCount([], 7, now)
    expect(summary.total).toBe(0)
    expect(summary.deltaPercent).toBeUndefined()
    expect(summary.avgReturnRate).toBeUndefined()
  })
})

describe('alert log row', () => {
  const base = {
    _id: 'a1', farm_id: 'f1', type: 'THRESHOLD_BREACH', severity: 'HIGH', title: 'x', message: 'y',
    status: 'ACTIVE', created_at: '2026-10-10T05:00:00Z',
  } as Alert

  it('groups severity', () => {
    expect([getSeverityGroup('CRITICAL'), getSeverityGroup('HIGH'), getSeverityGroup('MEDIUM'), getSeverityGroup('LOW')])
      .toEqual(['P1', 'P1', 'P2', 'P3'])
  })

  it('reads value and limit from the breach metadata', () => {
    const row = buildAlertRow({ ...base, metadata: { breaches: [{ metric: 'temperature', value: 33.5, limit: 31, direction: 'above' }] } }, 'node_001', 'Nhà chính | Tầng 1')
    expect(row).toMatchObject({ deviceName: 'node_001', locationName: 'Nhà chính | Tầng 1', sensorKind: 'temperature', breach: { value: 33.5, limit: 31, unit: '°C', sign: '<' }, group: 'P1' })
  })

  it('shows a dash when the alert has no breach data', () => {
    const row = buildAlertRow({ ...base, type: 'SENSOR_FAULT' }, 'node_001', 'Tầng 1')
    expect(row).toMatchObject({ sensorKind: 'env', breach: undefined })
  })
})

describe('averageControlOutput', () => {
  it('averages the fuzzy output of zones that have live telemetry', () => {
    const live = new Map([['z1', { controlOutput: { misting: 40, ventilation: 10 } }], ['z2', { controlOutput: { misting: 61, ventilation: 30 } }]])
    expect(averageControlOutput(['z1', 'z2', 'z3'], live)).toEqual({ misting: 51, ventilation: 20 })
  })

  it('returns undefined when no zone has live output', () => {
    expect(averageControlOutput(['z1'], new Map())).toBeUndefined()
  })
})
