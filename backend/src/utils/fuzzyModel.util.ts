/**
 * ANALYTICS-FR-010 (v1.24.0) — gợi ý hệ số mờ bằng mô hình học từ dữ liệu thật.
 * Hàm thuần — test không cần DB.
 *
 * 1. Bản TS của bộ điều khiển mờ trên ESP32 (firmware/src/pid/FuzzyControl.cpp).
 *    PHẢI giữ khớp C++ — test dùng lại đúng các ca của firmware/test/test_fuzzy.
 * 2. Nhận dạng mô hình nhà yến: hồi quy tuyến tính (bình phương tối thiểu)
 *    Δh(10') = a·phun% + b·quạt% + c·(T − T̄) + d.
 * 3. Mô phỏng 24 giờ gần nhất với mỗi bộ hệ số trên lưới, chấm điểm, chọn tốt nhất.
 *    Lưới đủ cho 3 tham số (120 tổ hợp) — không cần GA/ANFIS.
 */
export interface Tuning { humidityBand: number; tempBand: number; fanDryLevel: number /* 0..1 */ }
export const DEFAULT_TUNING: Tuning = { humidityBand: 8, tempBand: 4, fanDryLevel: 0.4 }

// ── 1. Bộ điều khiển mờ (khớp FuzzyControl.cpp) ─────────────────────────────
export const rampDown = (x: number, a: number, b: number) => (x <= a ? 1 : x >= b ? 0 : (b - x) / (b - a))
export const rampUp = (x: number, a: number, b: number) => 1 - rampDown(x, a, b)
export const tri = (x: number, a: number, b: number, c: number) =>
  x <= a || x >= c ? 0 : x <= b ? (x - a) / (b - a) : (c - x) / (c - b)

const humidityLow = (h: number, hMin: number, s: number) => rampDown(h, hMin - 5 * s, hMin + 3 * s)
const isHot = (t: number, tMax: number, k: number) => rampUp(t, tMax - 3 * k, tMax + k)
function defuzzify(w: number[], z: number[]) {
  let num = 0
  let den = 0
  w.forEach((wi, i) => { num += wi * z[i]; den += wi })
  return den > 0 ? num / den : 0
}

export function mistingDemand(h: number, t: number, hMin: number, hMax: number, tMax: number, tuning: Tuning = DEFAULT_TUNING) {
  const s = tuning.humidityBand / 8
  const low = humidityLow(h, hMin, s)
  const mid = tri(h, hMin - 3 * s, hMin + 5 * s, hMin + 13 * s)
  const high = rampUp(h, hMax - 10, hMax)
  const hot = isHot(t, tMax, tuning.tempBand / 4)
  return defuzzify([low, Math.min(mid, hot), Math.min(mid, 1 - hot), high], [1, 0.5, 0, 0])
}

export function ventilationDemand(
  t: number, h: number, nh3: number | null, co2: number | null,
  tMax: number, hMin: number, nh3Max: number, co2Max: number, tuning: Tuning = DEFAULT_TUNING,
) {
  if ((nh3 !== null && nh3 > nh3Max) || (co2 !== null && co2 > co2Max)) return 1
  const gas = Math.max(nh3 !== null ? rampUp(nh3, 0.6 * nh3Max, nh3Max) : 0, co2 !== null ? rampUp(co2, 0.7 * co2Max, co2Max) : 0)
  const hot = isHot(t, tMax, tuning.tempBand / 4)
  const dry = humidityLow(h, hMin, tuning.humidityBand / 8)
  return defuzzify([gas, Math.min(hot, 1 - dry), Math.min(hot, dry), Math.min(1 - hot, 1 - gas)], [1, 1, tuning.fanDryLevel, 0])
}

// ── 2. Nhận dạng mô hình ─────────────────────────────────────────────────────
export interface Step { humidity: number; temperature: number; misting: number; ventilation: number; nh3: number | null; co2: number | null }
export interface PlantModel { a: number; b: number; c: number; d: number; tMean: number; r2: number; samples: number }

/** Giải hệ n×n bằng khử Gauss có chọn trụ; null nếu suy biến (dữ liệu không đủ đa dạng). */
function solve(A: number[][], y: number[]): number[] | null {
  const n = y.length
  const M = A.map((row, i) => [...row, y[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    if (Math.abs(M[pivot][col]) < 1e-9) return null
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / M[col][col]
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

/** Hồi quy Δh theo từng cặp bước liên tiếp (10 phút), phương trình chuẩn XᵀX·β = Xᵀy. */
export function fitPlantModel(steps: Step[][]): PlantModel | null {
  const rows: number[][] = []
  const ys: number[] = []
  const temps = steps.flat().map(s => s.temperature)
  const tMean = temps.reduce((a, b) => a + b, 0) / (temps.length || 1)
  for (const run of steps) {
    for (let i = 0; i + 1 < run.length; i++) {
      rows.push([run[i].misting, run[i].ventilation, run[i].temperature - tMean, 1])
      ys.push(run[i + 1].humidity - run[i].humidity)
    }
  }
  if (rows.length < 8) return null
  const XtX = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => rows.reduce((s, r) => s + r[i] * r[j], 0)))
  const Xty = [0, 1, 2, 3].map(i => rows.reduce((s, r, k) => s + r[i] * ys[k], 0))
  const beta = solve(XtX, Xty)
  if (!beta) return null
  const [a, b, c, d] = beta
  const yMean = ys.reduce((s, v) => s + v, 0) / ys.length
  const ssTot = ys.reduce((s, v) => s + (v - yMean) ** 2, 0)
  const ssRes = rows.reduce((s, r, k) => s + (ys[k] - (a * r[0] + b * r[1] + c * r[2] + d)) ** 2, 0)
  return { a, b, c, d, tMean, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, samples: rows.length }
}

// ── 3. Mô phỏng + tìm lưới ───────────────────────────────────────────────────
export interface Limits { hMin: number; hMax: number; tMax: number; nh3Max: number; co2Max: number }
export interface SimResult { inRangePct: number; mistingAvgPct: number; score: number }

/** Điểm càng thấp càng tốt: % thời gian độ ẩm ngoài ngưỡng + phạt nhẹ lượng nước phun. */
export const WATER_PENALTY = 0.1

export function simulate(model: PlantModel, day: Step[], limits: Limits, tuning: Tuning): SimResult {
  let h = day[0].humidity
  let inRange = 0
  let mistSum = 0
  for (const s of day) {
    if (h >= limits.hMin && h <= limits.hMax) inRange++
    const mist = 100 * mistingDemand(h, s.temperature, limits.hMin, limits.hMax, limits.tMax, tuning)
    const vent = 100 * ventilationDemand(s.temperature, h, s.nh3, s.co2, limits.tMax, limits.hMin, limits.nh3Max, limits.co2Max, tuning)
    mistSum += mist
    h = Math.min(100, Math.max(0, h + model.a * mist + model.b * vent + model.c * (s.temperature - model.tMean) + model.d))
  }
  const inRangePct = (100 * inRange) / day.length
  const mistingAvgPct = mistSum / day.length
  return { inRangePct, mistingAvgPct, score: (100 - inRangePct) + WATER_PENALTY * mistingAvgPct }
}

export const GRID = {
  humidityBand: [4, 6, 8, 10, 12, 16],
  tempBand: [2, 3, 4, 6],
  fanDryLevel: [0.2, 0.3, 0.4, 0.5, 0.6],
}

export function searchTuning(model: PlantModel, day: Step[], limits: Limits) {
  let best: { tuning: Tuning; result: SimResult } | null = null
  for (const humidityBand of GRID.humidityBand) {
    for (const tempBand of GRID.tempBand) {
      for (const fanDryLevel of GRID.fanDryLevel) {
        const tuning = { humidityBand, tempBand, fanDryLevel }
        const result = simulate(model, day, limits, tuning)
        if (!best || result.score < best.result.score) best = { tuning, result }
      }
    }
  }
  return best!
}
