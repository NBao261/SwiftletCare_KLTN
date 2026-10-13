import { findDrift, findSpikes, findStuck, type AnomalySample } from '@/utils/sensorAnomaly.util'

const T0 = new Date('2026-09-30T00:00:00Z').getTime()
/** n mẫu cách nhau 10s, giá trị theo hàm i → sample */
const series = (n: number, fn: (i: number) => Omit<AnomalySample, 'timestamp'>): AnomalySample[] =>
  Array.from({ length: n }, (_, i) => ({ timestamp: new Date(T0 + i * 10_000), ...fn(i) }))

describe('findStuck', () => {
  it('flags humidity frozen for 2 hours while temperature keeps moving', () => {
    const [f] = findStuck(series(721, i => ({ humidity: 80.3, temperature: 28 + (i % 7) / 10 })))
    expect(f).toMatchObject({ kind: 'STUCK', metric: 'humidity' })
    expect(f.detail).toContain('nghi cảm biến kẹt')
  })

  it('does not flag normal small fluctuations', () => {
    expect(findStuck(series(721, i => ({ humidity: 80 + (i % 3) / 10, temperature: 28 })))).toEqual([
      expect.objectContaining({ metric: 'temperature' }), // nhiệt đứng yên tuyệt đối 2 giờ thì vẫn báo
    ])
    expect(findStuck(series(721, i => ({ humidity: 80 + (i % 3) / 10, temperature: 28 + (i % 2) / 10 })))).toEqual([])
  })

  it('needs 2 hours of data before concluding', () => {
    expect(findStuck(series(300, () => ({ humidity: 80, temperature: 28 })))).toEqual([])
  })

  it('ignores gas sensors, whose integer readings may legitimately stay constant', () => {
    expect(findStuck(series(721, i => ({ nh3_ppm: 5, co2_ppm: 800, humidity: 80 + (i % 2) / 10, temperature: 28 + (i % 3) / 10 })))).toEqual([])
  })
})

describe('findSpikes', () => {
  it('flags repeated physically impossible jumps', () => {
    const humidity = [80, 80, 95, 80, 80, 96, 80, 80]
    const [f] = findSpikes(series(humidity.length, i => ({ humidity: humidity[i] })))
    expect(f).toMatchObject({ kind: 'SPIKE', metric: 'humidity' })
  })

  it('ignores a single step change and jumps across a data gap', () => {
    const step = series(10, i => ({ humidity: i < 5 ? 80 : 92 }))
    expect(findSpikes(step)).toEqual([])
    const gapped = [80, 95, 80, 95].map((h, i) => ({ timestamp: new Date(T0 + i * 60_000), humidity: h }))
    expect(findSpikes(gapped)).toEqual([])
  })
})

describe('findDrift', () => {
  it('flags two devices in the same zone disagreeing beyond the tolerance', () => {
    const findings = findDrift([
      { name: 'A', means: { temperature: 28, humidity: 80 } },
      { name: 'B', means: { temperature: 28.5, humidity: 90 } },
    ])
    expect(findings).toEqual([expect.objectContaining({ kind: 'DRIFT', metric: 'humidity' })])
  })

  it('skips metrics a device could not measure', () => {
    expect(findDrift([{ name: 'A', means: { humidity: null } }, { name: 'B', means: { humidity: 90 } }])).toEqual([])
  })
})
