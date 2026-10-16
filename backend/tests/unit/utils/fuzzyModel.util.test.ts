import {
  fitPlantModel, inputsValid, mistingDemand, rampDown, rampUp, searchTuning, simulate, tri, ventilationDemand,
  type Limits, type PlantModel, type Step,
} from '@/utils/fuzzyModel.util'

const LIMITS: Limits = { hMin: 75, hMax: 95, tMax: 31 }

// Cùng các ca với firmware/test/test_fuzzy/test_main.cpp — bản TS phải khớp C++
describe('TS port matches the ESP32 fuzzy controller', () => {
  it('membership functions', () => {
    expect(rampDown(76, 70, 78)).toBeCloseTo(0.25)
    expect(rampUp(30, 28, 32)).toBeCloseTo(0.5)
    expect(tri(76, 72, 80, 88)).toBeCloseTo(0.5)
    expect(tri(90, 72, 80, 88)).toBe(0)
  })

  it('misting worked example and extremes', () => {
    expect(mistingDemand(76, 30, 75, 95, 31)).toBeCloseTo(0.4)
    expect(mistingDemand(65, 28, 75, 95, 31)).toBeCloseTo(1)
    expect(mistingDemand(92, 33, 75, 95, 31)).toBeCloseTo(0)
    expect(mistingDemand(80, 26, 75, 95, 31)).toBeCloseTo(0)
  })

  it('ventilation rules — temperature and humidity only (SRS v2.0.0, no gas input)', () => {
    expect(ventilationDemand(33, 80, 31, 75)).toBeCloseTo(1)
    expect(ventilationDemand(33, 65, 31, 75)).toBeCloseTo(0.4)
    expect(ventilationDemand(26, 80, 31, 75)).toBeCloseTo(0)
  })

  it('invalid inputs give the safe state (THREAT-FR-013)', () => {
    expect(inputsValid(NaN, 80)).toBe(false)
    expect(inputsValid(30, 120)).toBe(false)
    expect(inputsValid(30, 80)).toBe(true)
    expect(inputsValid(33, 100.4)).toBe(true) // bão hoà lúc đang phun, không phải cảm biến hỏng
    expect(mistingDemand(100.4, 33, 75, 95, 31)).toBe(0)
    expect(ventilationDemand(33, 100.4, 31, 75)).toBeCloseTo(1)
    expect(mistingDemand(NaN, 33, 75, 95, 31)).toBe(0)
    expect(mistingDemand(65, NaN, 75, 95, 31)).toBe(0)
    expect(mistingDemand(-5, 33, 75, 95, 31)).toBe(0)
    expect(ventilationDemand(NaN, 80, 31, 75)).toBe(0)
    expect(ventilationDemand(33, NaN, 31, 75)).toBe(0)
    expect(ventilationDemand(200, 80, 31, 75)).toBe(0)
  })

  it('tuning: wider humidity band mists earlier, fan dry level is honoured', () => {
    expect(mistingDemand(79, 26, 75, 95, 31, { humidityBand: 16, tempBand: 4, fanDryLevel: 0.4 }))
      .toBeGreaterThan(mistingDemand(79, 26, 75, 95, 31))
    expect(ventilationDemand(33, 65, 31, 75, { humidityBand: 8, tempBand: 4, fanDryLevel: 0.2 })).toBeCloseTo(0.2)
  })
})

/** Nhà yến giả: Δh = 0.05·phun − 0.02·quạt − 0.1·(T−28) − 1.2 (khô dần nếu không phun) */
const TRUE_MODEL = { a: 0.05, b: -0.02, c: -0.1, d: -1.2 }
function syntheticRun(n: number, seed = 1): Step[] {
  let h = 82
  let x = seed
  const rand = () => { x = (x * 16807) % 2147483647; return x / 2147483647 }
  const steps: Step[] = []
  for (let i = 0; i < n; i++) {
    const temperature = 28 + 3 * Math.sin(i / 24) + rand() * 0.2
    const misting = Math.round(rand() * 100)
    const ventilation = Math.round(rand() * 60)
    steps.push({ humidity: h, temperature, misting, ventilation })
    h += TRUE_MODEL.a * misting + TRUE_MODEL.b * ventilation + TRUE_MODEL.c * (temperature - 28) + TRUE_MODEL.d + (rand() - 0.5) * 0.1
  }
  return steps
}

describe('plant model identification', () => {
  it('recovers known coefficients from noisy synthetic data', () => {
    const model = fitPlantModel([syntheticRun(500)])!
    expect(model.a).toBeCloseTo(TRUE_MODEL.a, 2)
    expect(model.b).toBeCloseTo(TRUE_MODEL.b, 2)
    expect(model.r2).toBeGreaterThan(0.9)
  })

  it('refuses when there is too little or degenerate data', () => {
    expect(fitPlantModel([syntheticRun(5)])).toBeNull()
    const flat = Array.from({ length: 50 }, () => ({ humidity: 80, temperature: 28, misting: 0, ventilation: 0 }))
    expect(fitPlantModel([flat])).toBeNull()
  })
})

describe('grid search', () => {
  it('finds tuning at least as good as the current one on the model', () => {
    const model: PlantModel = { ...TRUE_MODEL, tMean: 28, r2: 0.9, samples: 500 }
    const day = syntheticRun(144, 7)
    const current = simulate(model, day, LIMITS, { humidityBand: 8, tempBand: 4, fanDryLevel: 0.4 })
    const best = searchTuning(model, day, LIMITS)
    expect(best.result.score).toBeLessThanOrEqual(current.score)
  })

  it('a house that dries fast needs earlier misting (wider humidity band)', () => {
    const dryHouse: PlantModel = { a: 0.04, b: -0.02, c: 0, d: -2.5, tMean: 28, r2: 0.9, samples: 500 }
    const day = Array.from({ length: 144 }, () => ({ humidity: 80, temperature: 28, misting: 0, ventilation: 0 }))
    expect(searchTuning(dryHouse, day, LIMITS).tuning.humidityBand).toBeGreaterThan(8)
  })
})
