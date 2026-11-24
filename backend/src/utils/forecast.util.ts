// Holt trend tắt dần, ngoại suy tuyến tính dễ vọt quá với độ ẩm bị chặn
export const HOLT_GRID = [0.1, 0.3, 0.5, 0.7, 0.9]
// φ cố định 0.9; muốn chuẩn hơn thì đưa φ vào lưới
export const DAMPING = 0.9

export interface HoltState { level: number; trend: number }
export interface HoltFit extends HoltState { alpha: number; beta: number; oneStepMae: number }

export function runHolt(series: number[], alpha: number, beta: number): HoltState & { errors: number[] } {
  let level = series[0]
  let trend = series.length > 1 ? series[1] - series[0] : 0
  const errors: number[] = []
  for (let i = 1; i < series.length; i++) {
    const predicted = level + DAMPING * trend
    errors.push(series[i] - predicted)
    const nextLevel = alpha * series[i] + (1 - alpha) * predicted
    trend = beta * (nextLevel - level) + (1 - beta) * DAMPING * trend
    level = nextLevel
  }
  return { level, trend, errors }
}

export function forecastHolt(state: HoltState, steps: number): number[] {
  const out: number[] = []
  let damp = 0
  for (let k = 1; k <= steps; k++) {
    damp += DAMPING ** k
    out.push(state.level + damp * state.trend)
  }
  return out
}

const meanAbs = (xs: number[]) => xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length

// Bỏ 2 điểm đầu còn đang khởi động
export function fitHolt(series: number[]): HoltFit | null {
  if (series.length < 4) return null
  let best: HoltFit | null = null
  for (const alpha of HOLT_GRID) {
    for (const beta of HOLT_GRID) {
      const { level, trend, errors } = runHolt(series, alpha, beta)
      const oneStepMae = meanAbs(errors.slice(2))
      if (!best || oneStepMae < best.oneStepMae) best = { alpha, beta, level, trend, oneStepMae }
    }
  }
  return best
}

// Mỗi điểm chỉ dùng dữ liệu trước nó. null khi chuỗi quá ngắn
export function backtestMae(series: number[], horizon: number, alpha: number, beta: number, minTrain = 12): number | null {
  const errors: number[] = []
  for (let t = minTrain; t + horizon <= series.length; t++) {
    const state = runHolt(series.slice(0, t), alpha, beta)
    errors.push(series[t + horizon - 1] - forecastHolt(state, horizon)[horizon - 1])
  }
  return errors.length ? meanAbs(errors) : null
}
