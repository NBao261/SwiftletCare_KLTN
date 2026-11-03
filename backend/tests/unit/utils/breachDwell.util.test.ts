/**
 * BR-34 — thời gian 1 chỉ số phải ở ngoài ngưỡng liên tục trước khi tạo THRESHOLD_BREACH:
 * 10 phút nhiệt độ/độ ẩm, 5 phút ánh sáng/NH3/CO2; mẫu trong ngưỡng xen giữa đếm lại; số đo thiếu không
 * bắt đầu, không cắt; thiết bị im lặng quá ngưỡng mất kết nối (BR-10) thì đếm lại.
 */
import { BREACH_DWELL_MS, clearBreachDwell, trackBreachDwell } from '@/utils/breachDwell.util'
import type { ThresholdBreach } from '@/services/alert.service'

const MIN = 60_000
const SEC = 1000
/** Ngưỡng mất kết nối của bộ điều khiển (BR-10) — telemetry.service truyền OFFLINE_THRESHOLD_MS */
const OFFLINE_MS = 30 * SEC
const T0 = Date.UTC(2026, 9, 31, 3, 0)
const humidityLow: ThresholdBreach = { metric: 'humidity', value: 70, limit: 75, direction: 'below' }
const nh3High: ThresholdBreach = { metric: 'nh3_ppm', value: 30, limit: 25, direction: 'above' }

/**
 * 1 mẫu tại phút `minute`: `breaches` là kết quả so ngưỡng của mẫu đó. Các test theo phút chỉ kiểm luật
 * đếm nên không giới hạn khoảng hở; khoảng hở thật kiểm riêng ở dưới.
 */
const sample = (node: string, minute: number, readings: Record<string, number | undefined>, breaches: ThresholdBreach[]) =>
  trackBreachDwell(node, readings, breaches, T0 + minute * MIN, Number.POSITIVE_INFINITY)
/** Mẫu mỗi 10 giây từ phút `from` tới phút `to`, với khoảng hở thật 30 giây; trả kết quả của mẫu cuối */
const every10s = (node: string, from: number, to: number) => {
  let last = trackBreachDwell(node, { humidity: 70 }, [humidityLow], T0 + from * MIN, OFFLINE_MS)
  for (let t = from * MIN + 10 * SEC; t <= to * MIN; t += 10 * SEC) {
    last = trackBreachDwell(node, { humidity: 70 }, [humidityLow], T0 + t, OFFLINE_MS)
  }
  return last
}

beforeEach(() => clearBreachDwell())

describe('trackBreachDwell', () => {
  it('thời gian chờ đúng BR-34', () => {
    expect(BREACH_DWELL_MS).toEqual({ temperature: 10 * MIN, humidity: 10 * MIN, light_lux: 5 * MIN, nh3_ppm: 5 * MIN, co2_ppm: 5 * MIN })
  })

  it('độ ẩm: 9 phút chưa, 10 phút mới đủ; kèm thời điểm bắt đầu', () => {
    for (let m = 0; m <= 9; m++) expect(sample('n1', m, { humidity: 70 }, [humidityLow]).dwelled).toEqual([])
    const { dwelled, ongoing } = sample('n1', 10, { humidity: 70 }, [humidityLow])
    expect(dwelled).toEqual([{ ...humidityLow, started_at: new Date(T0) }])
    expect(ongoing).toEqual([humidityLow])
  })

  it('NH3: 5 phút là đủ', () => {
    sample('n1', 0, { nh3_ppm: 30 }, [nh3High])
    expect(sample('n1', 4, { nh3_ppm: 30 }, [nh3High]).dwelled).toEqual([])
    expect(sample('n1', 5, { nh3_ppm: 30 }, [nh3High]).dwelled).toHaveLength(1)
  })

  it('1 mẫu trong ngưỡng xen giữa → đếm lại từ đầu', () => {
    sample('n1', 0, { humidity: 70 }, [humidityLow])
    sample('n1', 6, { humidity: 80 }, [])
    sample('n1', 7, { humidity: 70 }, [humidityLow])
    expect(sample('n1', 16, { humidity: 70 }, [humidityLow]).dwelled).toEqual([])
    expect(sample('n1', 17, { humidity: 70 }, [humidityLow]).dwelled[0].started_at).toEqual(new Date(T0 + 7 * MIN))
  })

  it('số đo thiếu không bắt đầu và không cắt quãng chờ', () => {
    expect(sample('n1', 0, { humidity: undefined }, []).ongoing).toEqual([])
    sample('n1', 1, { humidity: 70 }, [humidityLow])
    sample('n1', 5, { humidity: undefined }, [])
    expect(sample('n1', 11, { humidity: 70 }, [humidityLow]).dwelled[0].started_at).toEqual(new Date(T0 + MIN))
  })

  it('đổi chiều (dưới → trên) đếm lại; mỗi thiết bị tính riêng', () => {
    const humidityHigh: ThresholdBreach = { metric: 'humidity', value: 97, limit: 95, direction: 'above' }
    sample('n1', 0, { humidity: 70 }, [humidityLow])
    sample('n1', 5, { humidity: 97 }, [humidityHigh])
    expect(sample('n1', 10, { humidity: 97 }, [humidityHigh]).dwelled).toEqual([])
    expect(sample('n1', 15, { humidity: 97 }, [humidityHigh]).dwelled).toHaveLength(1)

    sample('n2', 10, { humidity: 70 }, [humidityLow])
    expect(sample('n2', 15, { humidity: 70 }, [humidityLow]).dwelled).toEqual([])
  })
})

describe('thiết bị im lặng (BR-34, ngưỡng mất kết nối của BR-10)', () => {
  it('mẫu mỗi 10 giây vẫn cộng dồn đủ 10 phút', () => {
    expect(every10s('n1', 0, 9.5).dwelled).toEqual([])
    expect(every10s('n1', 9.5, 10).dwelled).toEqual([{ ...humidityLow, started_at: new Date(T0) }])
  })

  it('im lặng 58 phút rồi gửi lại vẫn thấp: không bắn ngay, đếm lại từ mẫu mới', () => {
    every10s('n1', 0, 2)
    expect(every10s('n1', 60, 69.5).dwelled).toEqual([])
    expect(every10s('n1', 69.5, 70).dwelled).toEqual([{ ...humidityLow, started_at: new Date(T0 + 60 * MIN) }])
  })

  it('mẫu tới lệch thứ tự không tính là khoảng hở', () => {
    every10s('n1', 0, 5)
    trackBreachDwell('n1', { humidity: 70 }, [humidityLow], T0 + 4 * MIN, OFFLINE_MS)
    expect(every10s('n1', 5, 10).dwelled[0].started_at).toEqual(new Date(T0))
  })
})
