/**
 * NFR-03 (Report 3 §5): P95 thời gian trả lời của REST API ≤ 500 ms, đo bằng k6 trên staging trong 5 phút, với
 * 100 client WebSocket (Socket.io) đang nối và bộ giả lập publish đúng cỡ A-7 (simulator/README.md, mục NFR-03).
 * Người dùng giả mở dashboard, cảnh báo và phân tích của Farm Owner. Chạy:
 *   docker run --rm -i -e BASE_URL=https://<DOMAIN> -e K6_EMAIL=... -e K6_PASSWORD=... grafana/k6:1.3.0 run - < simulator/load/nfr03.k6.js
 */
import http from 'k6/http'
import ws from 'k6/ws'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'https://localhost'
const API = `${BASE}/api`
const SOCKET_URL = `${BASE.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`
const DURATION_SEC = Number(__ENV.DURATION_SEC || 300)
const SOCKETS = Number(__ENV.SOCKETS || 100)
const API_VUS = Number(__ENV.API_VUS || 20)

const socketJoined = new Counter('socket_joined')
const socketEvents = new Counter('socket_events')
const socketErrors = new Counter('socket_errors')

export const options = {
  // Chứng chỉ tự ký khi thử trên máy (staging-cert.sh --self-signed)
  insecureSkipTLSVerify: __ENV.INSECURE === '1',
  setupTimeout: '60s',
  scenarios: {
    sockets: { executor: 'constant-vus', exec: 'socket', vus: SOCKETS, duration: `${DURATION_SEC}s`, gracefulStop: '10s' },
    api: { executor: 'constant-vus', exec: 'browse', vus: API_VUS, duration: `${DURATION_SEC}s`, startTime: '10s' },
  },
  thresholds: {
    'http_req_duration{scenario:api}': ['p(95)<500'],
    'checks{scenario:api}': ['rate>0.99'],
    socket_errors: ['count==0'],
  },
}

const auth = token => ({ headers: { Authorization: `Bearer ${token}` } })
const dataOf = res => res.json('data')
const pick = list => list[Math.floor(Math.random() * list.length)]

/** Một lần đăng nhập Farm Owner cho mọi người dùng giả: giới hạn đăng nhập không phải thứ đang đo */
export function setup() {
  const login = http.post(`${API}/auth/login`, JSON.stringify({ email: __ENV.K6_EMAIL, password: __ENV.K6_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } })
  if (login.status !== 200) throw new Error(`Đăng nhập ${login.status}: ${login.body}`)
  const token = login.json('data.accessToken')
  const farm = dataOf(http.get(`${API}/farms`, auth(token)))[0]
  const houses = dataOf(http.get(`${API}/farms/${farm._id}/houses`, auth(token))).map(h => h._id)
  const zones = houses.flatMap(id => dataOf(http.get(`${API}/farms/houses/${id}/zones`, auth(token))).map(z => z._id))
  if (zones.length === 0) throw new Error('Farm chưa có zone: chạy bộ giả lập trước')
  return { token, farmId: farm._id, houses, zones }
}

/** Client Socket.io v4 trên WebSocket thô: mở → gửi token (gói 40) → JOIN_ZONE, trả lời ping, giữ tới hết bài */
export function socket(data) {
  const res = ws.connect(SOCKET_URL, null, s => {
    s.on('message', msg => {
      if (msg.startsWith('0')) s.send(`40${JSON.stringify({ token: data.token })}`)
      else if (msg.startsWith('40')) {
        s.send(`42${JSON.stringify(['JOIN_ZONE', { zoneId: pick(data.zones) }])}`)
        socketJoined.add(1)
      } else if (msg === '2') s.send('3')
      else if (msg.startsWith('42')) socketEvents.add(1)
      else if (msg.startsWith('44')) { socketErrors.add(1); s.close() }
    })
    s.on('error', () => socketErrors.add(1))
    s.setTimeout(() => s.close(), DURATION_SEC * 1000)
  })
  check(res, { 'socket 101': r => r && r.status === 101 })
}

/** Farm Owner xem dashboard, cảnh báo, phân tích; nghỉ 1–3 s giữa các trang */
export function browse(data) {
  const zone = pick(data.zones)
  const house = pick(data.houses)
  const pages = [
    ['overview', `/farms/${data.farmId}/overview`],
    ['telemetry latest', `/telemetry/zones/${zone}/latest`],
    ['alerts', `/alerts?farmId=${data.farmId}&limit=20`],
    ['env summary', `/analytics/env/summary?zoneId=${zone}`],
    ['bird count current', `/analytics/bird-count/current?houseId=${house}`],
    ['forecast', `/analytics/forecast?zoneId=${zone}`],
  ]
  for (const [name, path] of pages) {
    const res = http.get(`${API}${path}`, { ...auth(data.token), tags: { name } })
    check(res, { 'status 200': r => r.status === 200 })
  }
  sleep(1 + Math.random() * 2)
}
