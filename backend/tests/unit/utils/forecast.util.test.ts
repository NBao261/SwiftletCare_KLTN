import { backtestMae, fitHolt, forecastHolt, runHolt } from '@/utils/forecast.util'

describe('Holt damped-trend forecast', () => {
  it('forecasts a flat series as flat', () => {
    const fit = fitHolt(Array(30).fill(80))!
    forecastHolt(fit, 12).forEach(v => expect(v).toBeCloseTo(80, 5))
    expect(backtestMae(Array(30).fill(80), 12, fit.alpha, fit.beta)).toBeCloseTo(0, 5)
  })

  it('follows a falling trend but flattens out (damped) instead of extrapolating linearly', () => {
    const series = Array.from({ length: 36 }, (_, i) => 90 - 0.5 * i) // giảm 0.5%/5 phút
    const fit = fitHolt(series)!
    const f = forecastHolt(fit, 12)
    expect(f[0]).toBeLessThan(series[series.length - 1])  // vẫn đi xuống
    const linear = series[series.length - 1] - 0.5 * 12
    expect(f[11]).toBeGreaterThan(linear)                 // nhưng tắt dần, không lao thẳng
    expect(f[11]).toBeLessThan(f[0])
  })

  it('reports one-step errors per point after the first', () => {
    expect(runHolt([1, 2, 3, 4], 0.5, 0.5).errors).toHaveLength(3)
  })

  it('refuses to fit or backtest with too little data', () => {
    expect(fitHolt([80, 81])).toBeNull()
    expect(backtestMae([80, 81, 82], 12, 0.5, 0.5)).toBeNull()
  })

  it('backtest error grows with the horizon on a noisy trend', () => {
    const series = Array.from({ length: 72 }, (_, i) => 80 + 5 * Math.sin(i / 8) + ((i * 7) % 3) * 0.3)
    const fit = fitHolt(series)!
    const mae30 = backtestMae(series, 6, fit.alpha, fit.beta)!
    const mae60 = backtestMae(series, 12, fit.alpha, fit.beta)!
    expect(mae60).toBeGreaterThan(mae30)
  })
})
