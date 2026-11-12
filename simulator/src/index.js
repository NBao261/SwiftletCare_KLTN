#!/usr/bin/env node
/**
 * Bộ giả lập thiết bị SwiftletCare (SYSTEM-FR-004, Report 4 D20, DF-17).
 *
 * Đi đúng đường của thiết bị thật: Administrator nhập kho (`simulated: true`), Farm Owner tạo nhà,
 * tầng và đăng ký thiết bị bằng mã kích hoạt, rồi mỗi thiết bị nối broker bằng tài khoản riêng và
 * publish trên cây topic của nó. Dùng cho tải NFR-03 (120 controller, 20 camera), NFR-15 (cảnh báo
 * dựng sẵn) và demo nhiều nhà. Cách chạy: simulator/README.md.
 */
import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'
import mqtt from 'mqtt'
import {
  BUCKET_MS, INITIAL_READING, activeSession, bucketCounts, bucketStartOf, cameraHeartbeat, heartbeat, nextReading, telemetry,
} from './payloads.js'

const { values: opt } = parseArgs({
  options: {
    api: { type: 'string', default: process.env.SIM_API_URL ?? 'http://localhost:3000' },
    broker: { type: 'string', default: process.env.SIM_BROKER_URL ?? 'mqtt://localhost:1883' },
    farm: { type: 'string' },
    houses: { type: 'string', default: '2' },
    zones: { type: 'string', default: '2' },
    controllers: { type: 'string', default: '1' },
    cameras: { type: 'string', default: '1' },
    'telemetry-sec': { type: 'string', default: '10' },
    breach: { type: 'string', default: '0' },
    offline: { type: 'string', default: '0' },
    'offline-after-min': { type: 'string', default: '5' },
    alerts: { type: 'string', default: '0' },
    prefix: { type: 'string', default: 'SIM' },
  },
})

const num = name => {
  const value = Number(opt[name])
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} phải là số không âm`)
  return value
}
const HEARTBEAT_MS = 30_000 // như firmware (MQTT_HEARTBEAT_MS)
const TOPIC = id => `swiftletcare/dev/${id}`

async function api(token, method, path, body) {
  const res = await fetch(`${opt.api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) throw new Error(`${method} ${path} → ${res.status} ${json.error?.message ?? ''}`)
  return json.data
}

async function login(role) {
  const email = process.env[`SIM_${role}_EMAIL`]
  const password = process.env[`SIM_${role}_PASSWORD`]
  if (!email || !password) throw new Error(`Thiếu SIM_${role}_EMAIL / SIM_${role}_PASSWORD (xem simulator/README.md)`)
  return (await api(null, 'POST', '/auth/login', { email, password })).accessToken
}

/** Nhập kho bằng Admin rồi đăng ký bằng Farm Owner — như quét nhãn ở SF-01 */
async function provision(admin, owner, kind, deviceId, target) {
  const stock = await api(admin, 'POST', '/admin/provisioned-devices', { device_id: deviceId, kind, simulated: true })
  const path = kind === 'SENSOR' ? '/devices/sensor-nodes/register' : '/devices/camera-nodes/register'
  await api(owner, 'POST', path, { device_id: deviceId, secret_key: stock.secret_key, ...target })
  return stock.broker_secret
}

function connect(deviceId, brokerSecret, onConnect) {
  const client = mqtt.connect(opt.broker, {
    clientId: deviceId, username: deviceId, password: brokerSecret, clean: false, reconnectPeriod: 5000,
  })
  client.on('connect', () => onConnect(client))
  client.on('error', err => console.error(`[${deviceId}] ${err.message}`))
  return client
}

function startController(deviceId, brokerSecret, { breach }) {
  const started = Date.now()
  let reading = INITIAL_READING
  let appliedConfigVersion = 0
  let justConnected = false
  const client = connect(deviceId, brokerSecret, c => {
    justConnected = true
    c.subscribe([`${TOPIC(deviceId)}/config`, `${TOPIC(deviceId)}/cmd`], { qos: 1 })
  })
  // ENV-FR-027 — nhận `config` retained thì coi như đã áp, heartbeat sau báo lại phiên bản đó
  client.on('message', (topic, payload) => {
    if (!topic.endsWith('/config')) return
    try {
      const version = JSON.parse(payload.toString()).config_version
      if (Number.isInteger(version)) appliedConfigVersion = version
    } catch {
      console.error(`[${deviceId}] config không phải JSON`)
    }
  })
  const timers = [
    setInterval(() => {
      if (!client.connected) return
      reading = nextReading(reading, Math.random, { breach })
      client.publish(`${TOPIC(deviceId)}/telemetry`, JSON.stringify(telemetry(deviceId, reading, Date.now())), { qos: 0 })
    }, num('telemetry-sec') * 1000),
    setInterval(() => {
      if (!client.connected) return
      client.publish(`${TOPIC(deviceId)}/heartbeat`,
        JSON.stringify(heartbeat(deviceId, { appliedConfigVersion, justConnected, uptimeMs: Date.now() - started })), { qos: 0 })
      justConnected = false
    }, HEARTBEAT_MS),
  ]
  return { deviceId, client, timers }
}

function startCamera(deviceId, brokerSecret) {
  let justConnected = false
  const totals = new Map() // phiên của ngày → số cộng dồn, như tin phiên của nút AI
  const client = connect(deviceId, brokerSecret, () => { justConnected = true })
  const publishBucket = () => {
    if (!client.connected) return
    const bucketStart = bucketStartOf(Date.now()) - BUCKET_MS
    const session = activeSession(bucketStart)
    const counts = bucketCounts(session)
    client.publish(`${TOPIC(deviceId)}/vision/bird-count`,
      JSON.stringify({ deviceId, kind: 'BUCKET', bucket_start: bucketStart, bucket_minutes: 5, ...counts }), { qos: 1 })
    if (!session) return
    const key = `${new Date(bucketStart).toISOString().slice(0, 10)}-${session}`
    const sum = totals.get(key) ?? { entry_count: 0, exit_count: 0 }
    sum.entry_count += counts.entry_count
    sum.exit_count += counts.exit_count
    totals.set(key, sum)
    client.publish(`${TOPIC(deviceId)}/vision/bird-count`, JSON.stringify({ deviceId, session_type: session, ...sum }), { qos: 1 })
  }
  const timers = [
    setInterval(() => {
      if (!client.connected) return
      client.publish(`${TOPIC(deviceId)}/heartbeat`, JSON.stringify(cameraHeartbeat(deviceId, justConnected)), { qos: 0 })
      justConnected = false
    }, HEARTBEAT_MS),
  ]
  // Tin 5 phút gửi ngay sau mỗi mốc 5 phút, cho khoảng vừa kết thúc
  setTimeout(() => { publishBucket(); timers.push(setInterval(publishBucket, BUCKET_MS)) }, BUCKET_MS - (Date.now() % BUCKET_MS) + 1000)
  return { deviceId, client, timers }
}

/** NFR-15 — cảnh báo thiết bị dựng sẵn, mỗi cái một eventId, rải đều trong 1 phút */
function injectAlerts(controllers, count) {
  for (let i = 0; i < count; i++) {
    const { deviceId, client } = controllers[i % controllers.length]
    setTimeout(() => client.publish(`${TOPIC(deviceId)}/alert`, JSON.stringify({
      deviceId, eventId: randomUUID(), type: 'MISTING_INEFFECTIVE', message: `Giả lập: phun không tăng ẩm (${deviceId})`,
    }), { qos: 1 }), 60_000 + (60_000 * i) / count)
  }
}

async function main() {
  const [admin, owner] = [await login('ADMIN'), await login('OWNER')]
  const farms = await api(owner, 'GET', '/farms')
  const farm = opt.farm ? farms.find(f => f._id === opt.farm) : farms[0]
  if (!farm) throw new Error('Farm Owner chưa có farm nào (hoặc --farm sai)')

  const run = Date.now().toString(36).toUpperCase()
  const tag = `${opt.prefix}-${run}`
  const breachShare = num('breach')
  const controllers = []
  const cameras = []
  console.log(`Farm "${farm.name}", lượt chạy ${tag}`)

  for (let h = 1; h <= num('houses'); h++) {
    const house = await api(owner, 'POST', `/farms/${farm._id}/houses`, { name: `${tag} H${h}`, floors: num('zones') || 1 })
    for (let c = 1; c <= num('cameras'); c++) {
      const id = `${tag}-H${h}-A${c}`
      cameras.push(startCamera(id, await provision(admin, owner, 'CAMERA', id, { house_id: house._id })))
    }
    for (let z = 1; z <= num('zones'); z++) {
      const zone = await api(owner, 'POST', `/farms/houses/${house._id}/zones`, { name: `${tag} H${h} T${z}`, floor: z })
      for (let n = 1; n <= num('controllers'); n++) {
        const id = `${tag}-H${h}-Z${z}-C${n}`
        const secret = await provision(admin, owner, 'SENSOR', id, { zone_id: zone._id })
        controllers.push(startController(id, secret, { breach: Math.random() < breachShare }))
      }
    }
  }
  console.log(`Đang chạy ${controllers.length} controller và ${cameras.length} camera giả lập. Ctrl+C để dừng.`)

  if (num('alerts') > 0 && controllers.length > 0) injectAlerts(controllers, num('alerts'))
  const offline = controllers.slice(0, Math.round(controllers.length * num('offline')))
  if (offline.length > 0) {
    setTimeout(() => {
      offline.forEach(d => { d.timers.forEach(clearInterval); d.client.end(true) })
      console.log(`Đã ngắt ${offline.length} controller để thử NODE_OFFLINE`)
    }, num('offline-after-min') * 60_000)
  }

  process.on('SIGINT', () => {
    for (const d of [...controllers, ...cameras]) { d.timers.forEach(clearInterval); d.client.end() }
    console.log('Đã dừng. Thiết bị giả lập vẫn trong DB (cờ simulated) tới lần đặt lại seed.')
    process.exit(0)
  })
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
