/**
 * NFR-15 (Report 3 §5) — đo trên staging bằng các cảnh báo mà bộ giả lập dựng sẵn:
 * (a) từ hạn leo thang (tạo + ESCALATION_MIN) tới lúc backend báo Farm Owner (`escalated_at`, đặt ngay trước khi gửi);
 * (b) từ lúc hết RECOVERY_VERIFY_MIN sau "done" tới lúc Work Order sang AWAITING_APPROVAL (`verified_at`).
 * Mốc thời gian lấy từ backend qua API (bản ghi cảnh báo và Work Order), không từ đồng hồ của máy đo.
 */

/** Như backend: alertRouting.service#ESCALATION_MIN, workOrder.service#RECOVERY_VERIFY_MIN */
export const ESCALATION_MS = 15 * 60_000
export const RECOVERY_VERIFY_MS = 10 * 60_000
export const TARGET_MS = 60_000

/** Phân vị kiểu nearest-rank (p trong 0..100), như cách k6 báo p(95) */
export function percentile(values, p) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]
}

const ms = value => new Date(value).getTime()

/** (a) — chỉ cảnh báo đã leo thang; cảnh báo chưa leo thang được đếm riêng ở `missing` */
export function escalationDelays(alerts) {
  const escalated = alerts.filter(a => a.escalated_at)
  return {
    delays: escalated.map(a => ms(a.escalated_at) - (ms(a.created_at) + ESCALATION_MS)),
    missing: alerts.length - escalated.length,
  }
}

/**
 * (b) — hạn là done_at + RECOVERY_VERIFY_MIN: độ ẩm giả lập đi quanh 85 % nên không xuống dưới `humidity_min` (75 %)
 * sau "done"; thiết bị thật phải tính từ mẫu khô cuối cùng (workOrder.service#telemetryStaysRecovered).
 */
export function verificationDelays(workOrders) {
  const verified = workOrders.filter(w => w.done_at && w.verified_at)
  return {
    delays: verified.map(w => ms(w.verified_at) - (ms(w.done_at) + RECOVERY_VERIFY_MS)),
    missing: workOrders.length - verified.length,
  }
}

export function summary(label, { delays, missing }) {
  const p95 = percentile(delays, 95)
  const pass = delays.length > 0 && missing === 0 && p95 <= TARGET_MS
  const s = v => (v === null ? '—' : `${(v / 1000).toFixed(1)} s`)
  return `${label}: n=${delays.length}, thiếu ${missing}, P50 ${s(percentile(delays, 50))}, P95 ${s(p95)}, max ${s(delays.length ? Math.max(...delays) : null)}`
    + ` → ${pass ? 'ĐẠT' : 'KHÔNG ĐẠT'} (≤ 60 s)`
}

const sleep = t => new Promise(resolve => setTimeout(resolve, t))

/**
 * Chạy sau khi bộ giả lập đã gửi cảnh báo (phút thứ 2). Thợ không xác nhận cảnh báo nào nên mọi cảnh báo phải
 * leo thang; sau đó thợ bắt đầu và báo xong `workOrderCount` Work Order, rồi chờ backend chuyển chờ duyệt.
 */
export async function measureNfr15({ api, owner, technician, farmId, tag, alertCount, workOrderCount, log = console.log }) {
  const alerts = await measureEscalation({ api, owner, farmId, tag, alertCount, log })
  await measureVerification({ api, owner, technician, farmId, tag, alertIds: alerts.map(a => String(a._id)), workOrderCount, log })
}

export async function measureEscalation({ api, owner, farmId, tag, alertCount, log = console.log }) {
  const ours = async () => (await api(owner, 'GET', `/alerts?farmId=${farmId}&type=MISTING_INEFFECTIVE&limit=100`))
    .filter(a => a.message?.includes(tag))
  // Cảnh báo gửi xong ở phút 2, leo thang ở phút 17 + một nhịp job; chờ thêm tối đa 10 phút
  const deadline = Date.now() + 10 * 60_000
  let alerts = []
  while (Date.now() < deadline) {
    alerts = await ours()
    if (alerts.length >= alertCount && alerts.every(a => a.escalated_at)) break
    await sleep(30_000)
  }
  log(summary('NFR-15 (a) leo thang tới Farm Owner', escalationDelays(alerts)))
  if (alerts.length < alertCount) log(`  chỉ thấy ${alerts.length}/${alertCount} cảnh báo (gộp trùng khi ít controller hơn số cảnh báo?)`)
  return alerts
}

export async function measureVerification({ api, owner, technician, farmId, tag, alertIds, workOrderCount, log = console.log }) {
  const ids = new Set(alertIds)
  const mine = await api(technician, 'GET', `/work-orders?farmId=${farmId}&assigneeId=me&open=true&limit=100`)
  const picked = mine.filter(w => ids.has(String(w.alert_id)) && ['OPEN', 'IN_PROGRESS'].includes(w.status)).slice(0, workOrderCount)
  for (const wo of picked) {
    if (wo.status === 'OPEN') await api(technician, 'POST', `/work-orders/${wo._id}/start`)
    // ALERT-FR-018: báo xong phải có nguyên nhân tìm thấy tại chỗ; phun không tăng ẩm → béc phun
    await api(technician, 'POST', `/work-orders/${wo._id}/done`, { cause: 'NOZZLE', work_note: `Giả lập NFR-15 (${tag})` })
  }
  log(`Thợ đã báo xong ${picked.length}/${workOrderCount} Work Order, chờ kiểm phục hồi ${RECOVERY_VERIFY_MS / 60_000} phút`)

  const deadline = Date.now() + RECOVERY_VERIFY_MS + 5 * 60_000
  let orders = []
  while (Date.now() < deadline) {
    orders = await Promise.all(picked.map(w => api(owner, 'GET', `/work-orders/${w._id}`)))
    if (orders.every(w => w.verified_at)) break
    await sleep(15_000)
  }
  log(summary('NFR-15 (b) chờ duyệt sau kiểm phục hồi', verificationDelays(orders)))
}
