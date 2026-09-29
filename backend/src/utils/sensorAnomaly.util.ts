/**
 * ALERT-FR-010 (v1.24.0) — phát hiện cảm biến trả lời được nhưng SAI, bổ sung cho
 * SENSOR_FAULT (firmware chỉ bắt được timeout). Hàm thuần trên mẫu telemetry đã
 * lưu (~1 mẫu/10s) để unit test không cần DB. Chỉ dùng giá trị THÔ — firmware lọc
 * riêng cho điều khiển (ENV-FR-022), lọc ở đây sẽ che mất chính lỗi cần bắt.
 */
export type AnomalyMetric = 'temperature' | 'humidity' | 'nh3_ppm' | 'co2_ppm'

export interface AnomalySample {
  timestamp: Date
  temperature?: number | null
  humidity?: number | null
  nh3_ppm?: number | null
  co2_ppm?: number | null
}

export interface AnomalyFinding {
  kind: 'STUCK' | 'SPIKE' | 'DRIFT'
  metric: AnomalyMetric
  detail: string
}

const METRIC_LABEL: Record<AnomalyMetric, string> = {
  temperature: 'Nhiệt độ', humidity: 'Độ ẩm', nh3_ppm: 'NH3', co2_ppm: 'CO2',
}

/**
 * Kẹt: giá trị giống hệt nhau suốt ≥ 2 giờ. Chỉ xét nhiệt/ẩm (độ phân giải 0.1
 * nên ngoài đời gần như không bao giờ đứng yên tuyệt đối 2 giờ); NH3/CO2 đọc
 * số nguyên và ánh sáng ~0 lux trong nhà yến tối thì đứng yên là bình thường.
 */
export const STUCK_MIN_MS = 2 * 3600_000
export const STUCK_MIN_SAMPLES = 360 // ≥ 1/2 số mẫu của 2 giờ — mất mạng một lúc vẫn xét được
const STUCK_METRICS: AnomalyMetric[] = ['temperature', 'humidity']

/** Nhảy phi vật lý giữa 2 mẫu liền nhau (≤ 30s) — nhà yến kín không đổi nhanh vậy. */
export const SPIKE_LIMITS: Record<AnomalyMetric, number> = { temperature: 2, humidity: 10, nh3_ppm: 20, co2_ppm: 500 }
export const SPIKE_MAX_GAP_MS = 30_000
export const SPIKE_MIN_JUMPS = 3 // 1 spike = 2 lần nhảy (lên rồi xuống); 3 lần ≈ lặp lại, không phải 1 sự kiện lẻ

/** Lệch giữa 2 thiết bị cùng Zone (trung bình 1 giờ) — chỉ xét được khi Zone có ≥ 2 thiết bị. */
export const DRIFT_LIMITS: Partial<Record<AnomalyMetric, number>> = { temperature: 2, humidity: 8 }

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

export function findStuck(samples: AnomalySample[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = []
  for (const metric of STUCK_METRICS) {
    const points = samples.filter(s => finite(s[metric]))
    if (points.length < STUCK_MIN_SAMPLES) continue
    const span = points[points.length - 1].timestamp.getTime() - points[0].timestamp.getTime()
    if (span < STUCK_MIN_MS * 0.9) continue
    const first = points[0][metric]
    if (!points.every(p => p[metric] === first)) continue

    const othersMove = (['temperature', 'humidity', 'co2_ppm'] as AnomalyMetric[])
      .filter(m => m !== metric)
      .some(m => new Set(samples.map(s => s[m]).filter(finite)).size > 1)
    findings.push({
      kind: 'STUCK',
      metric,
      detail: `${METRIC_LABEL[metric]} đứng yên ở ${first} suốt ${Math.round(span / 60_000)} phút` +
        (othersMove ? ' trong khi các chỉ số khác vẫn thay đổi — nghi cảm biến kẹt' : ' — mọi chỉ số đều đứng yên, nghi thiết bị treo'),
    })
  }
  return findings
}

export function findSpikes(samples: AnomalySample[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = []
  for (const metric of Object.keys(SPIKE_LIMITS) as AnomalyMetric[]) {
    let jumps = 0
    let maxJump = 0
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1][metric]
      const b = samples[i][metric]
      if (!finite(a) || !finite(b)) continue
      if (samples[i].timestamp.getTime() - samples[i - 1].timestamp.getTime() > SPIKE_MAX_GAP_MS) continue
      const jump = Math.abs(b - a)
      if (jump > SPIKE_LIMITS[metric]) {
        jumps++
        maxJump = Math.max(maxJump, jump)
      }
    }
    if (jumps >= SPIKE_MIN_JUMPS) {
      findings.push({
        kind: 'SPIKE',
        metric,
        detail: `${METRIC_LABEL[metric]} nhảy bất thường ${jumps} lần (lớn nhất ${Math.round(maxJump * 10) / 10}) giữa 2 lần đo liền nhau — nghi nhiễu đường truyền RS485 hoặc cảm biến hỏng`,
      })
    }
  }
  return findings
}

export function mean(samples: AnomalySample[], metric: AnomalyMetric): number | null {
  const values = samples.map(s => s[metric]).filter(finite)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/** So từng cặp thiết bị cùng Zone bằng trung bình 1 giờ gần nhất. */
export function findDrift(nodes: Array<{ name: string; means: Partial<Record<AnomalyMetric, number | null>> }>): AnomalyFinding[] {
  const findings: AnomalyFinding[] = []
  for (const [metric, limit] of Object.entries(DRIFT_LIMITS) as Array<[AnomalyMetric, number]>) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].means[metric]
        const b = nodes[j].means[metric]
        if (!finite(a) || !finite(b) || Math.abs(a - b) <= limit) continue
        findings.push({
          kind: 'DRIFT',
          metric,
          detail: `${METRIC_LABEL[metric]} của ${nodes[i].name} và ${nodes[j].name} lệch nhau ${Math.round(Math.abs(a - b) * 10) / 10} (trung bình 1 giờ) — một trong hai cảm biến có thể bị trôi`,
        })
      }
    }
  }
  return findings
}
