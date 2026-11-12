/**
 * Tin MQTT của thiết bị giả lập, cùng dạng với firmware và nút AI thật (Report 4 §7.2,
 * backend/src/types/domain.types.ts). Hàm thuần để test được không cần broker.
 */

const VN_OFFSET_MS = 7 * 3600_000
export const BUCKET_MS = 5 * 60_000

/** Khung phiên mặc định của BR-13 (Report 3 §4.5), giờ Việt Nam */
const SESSIONS = [
  { type: 'MORNING_EXIT', from: 5 * 60 + 30, to: 7 * 60 },
  { type: 'EVENING_ENTRY', from: 17 * 60 + 30, to: 19 * 60 },
]

/** Phiên đếm chim đang diễn ra lúc `now`, theo giờ Việt Nam; ngoài khung thì null */
export function activeSession(now) {
  const vn = new Date(now + VN_OFFSET_MS)
  const minute = vn.getUTCHours() * 60 + vn.getUTCMinutes()
  return SESSIONS.find(s => minute >= s.from && minute < s.to)?.type ?? null
}

export const bucketStartOf = now => Math.floor(now / BUCKET_MS) * BUCKET_MS

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round1 = v => Math.round(v * 10) / 10

/**
 * Bước kế tiếp của số đo, đi ngẫu nhiên quanh giá trị bình thường của nhà yến. `breach`: độ ẩm
 * trôi dần xuống dưới ngưỡng tối thiểu mặc định (75 %) để sinh THRESHOLD_BREACH sau thời gian chờ.
 */
export function nextReading(prev, rnd = Math.random, { breach = false } = {}) {
  const walk = (value, target, step) => value + (target - value) * 0.1 + (rnd() - 0.5) * step
  return {
    temperature: round1(clamp(walk(prev.temperature, 28.5, 0.6), 20, 40)),
    humidity: round1(clamp(walk(prev.humidity, breach ? 60 : 85, 2), 30, 100)),
    light_lux: round1(clamp(walk(prev.light_lux, 0.1, 0.05), 0, 5)),
    nh3_ppm: round1(clamp(walk(prev.nh3_ppm, 8, 1), 0, 100)),
    co2_ppm: Math.round(clamp(walk(prev.co2_ppm, 700, 40), 300, 5000)),
    sound_db: round1(clamp(walk(prev.sound_db, 45, 3), 20, 110)),
  }
}

export const INITIAL_READING = { temperature: 28.5, humidity: 85, light_lux: 0.1, nh3_ppm: 8, co2_ppm: 700, sound_db: 45 }

/** Tin `telemetry` của controller; relay theo luật đơn giản, không phải bộ điều khiển mờ thật */
export function telemetry(deviceId, reading, now) {
  const misting = reading.humidity < 80
  const ventilation = reading.temperature > 30
  return {
    deviceId,
    ...reading,
    relay_states: { misting, speaker: false, ventilation },
    control_mode: 'AUTO',
    control_output: { misting: misting ? 60 : 0, ventilation: ventilation ? 50 : 0 },
    timestamp: now,
  }
}

/** Tin `heartbeat` của controller; báo lại `config_version` đã nhận như firmware 2.1.0 (ENV-FR-027) */
export function heartbeat(deviceId, { appliedConfigVersion, justConnected, uptimeMs }) {
  return {
    deviceId,
    firmwareVersion: 'sim-2.1.0',
    rssi: -55,
    freeHeap: 150000,
    uptime: uptimeMs,
    resetReason: 'POWERON',
    ip: '0.0.0.0',
    appliedConfigVersion,
    timestamp: uptimeMs,
    ...(justConnected && { justConnected: true }),
  }
}

/** Tin `heartbeat` của nút AI (THREAT-FR-010) */
export const cameraHeartbeat = (deviceId, justConnected) => ({
  deviceId, firmwareVersion: 'sim', modelVersion: 'sim', fps: 25, timestamp: Date.now(),
  ...(justConnected && { justConnected: true }),
})

/** Số chim một khoảng 5 phút: đông trong phiên (ra buổi sáng, về buổi tối), lác đác ngoài phiên */
export function bucketCounts(session, rnd = Math.random) {
  const few = () => Math.floor(rnd() * 3)
  const many = () => 20 + Math.floor(rnd() * 60)
  if (session === 'MORNING_EXIT') return { entry_count: few(), exit_count: many() }
  if (session === 'EVENING_ENTRY') return { entry_count: many(), exit_count: few() }
  return { entry_count: few(), exit_count: few() }
}
