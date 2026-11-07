/**
 * NFR-10 d — kiểm trên broker thật: tài khoản thiết bị chỉ chạm được topic của chính nó, tài khoản đã
 * thu hồi không nối được. Cần EMQX chạy với deploy/emqx/ và backend chạy để trả lời /internal/mqtt-auth.
 *
 *   MQTT_TEST_URL=mqtt://localhost:1883 \
 *   DEVICE_A=node_1 DEVICE_A_SECRET=... DEVICE_B=node_2 \
 *   REVOKED_DEVICE=node_3 REVOKED_SECRET=... \
 *   npm run mqtt:isolation
 *
 * MQTT_USERNAME, MQTT_PASSWORD lấy từ .env để nghe xem tin lạ có lọt sang topic thiết bị B không.
 */
import 'dotenv/config'
import mqtt, { MqttClient } from 'mqtt'

const env = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Thiếu biến ${name}`)
  return value
}

const URL = process.env.MQTT_TEST_URL ?? 'mqtt://localhost:1883'
const WAIT_MS = 3000
const results: Array<{ check: string; pass: boolean }> = []
const report = (check: string, pass: boolean) => {
  results.push({ check, pass })
  console.log(`${pass ? 'ĐẠT ' : 'LỖI '} ${check}`)
}

/** true khi nối được; bị từ chối hoặc hết giờ thì false */
function connect(username: string, password: string): Promise<MqttClient | null> {
  return new Promise(resolve => {
    const client = mqtt.connect(URL, { username, password, reconnectPeriod: 0, connectTimeout: WAIT_MS })
    client.once('connect', () => resolve(client))
    client.once('error', () => { client.end(true); resolve(null) })
    setTimeout(() => resolve(client.connected ? client : null), WAIT_MS + 500)
  })
}

const subscribeRefused = (client: MqttClient, topic: string) => new Promise<boolean>(resolve => {
  client.subscribe(topic, { qos: 1 }, (err, granted) => resolve(!!err || !granted || granted.every(g => g.qos >= 128)))
  client.once('close', () => resolve(true))
})

async function main() {
  const [deviceA, secretA, deviceB] = [env('DEVICE_A'), env('DEVICE_A_SECRET'), env('DEVICE_B')]
  const topicOfB = `swiftletcare/dev/${deviceB}`

  const listener = await connect(env('MQTT_USERNAME'), env('MQTT_PASSWORD'))
  if (!listener) throw new Error('Service account không nối được broker')
  let leaked = false
  listener.on('message', () => { leaked = true })
  await listener.subscribeAsync(`${topicOfB}/#`, { qos: 1 })

  const own = await connect(deviceA, secretA)
  report('thiết bị A nối được bằng tài khoản của nó', !!own)
  if (own) {
    report('A subscribe topic của chính nó', !(await subscribeRefused(own, `swiftletcare/dev/${deviceA}/cmd`)))
    report('A không subscribe được lệnh của B', await subscribeRefused(own, `${topicOfB}/cmd`))
  }
  const wildcard = await connect(deviceA, secretA)
  if (wildcard) report('A không subscribe được cả cây thiết bị', await subscribeRefused(wildcard, 'swiftletcare/dev/#'))

  const publisher = await connect(deviceA, secretA)
  if (publisher) {
    publisher.publish(`${topicOfB}/telemetry`, JSON.stringify({ deviceId: deviceB }), { qos: 1 }, () => undefined)
    await new Promise(resolve => setTimeout(resolve, WAIT_MS))
    report('tin A gửi sang topic của B không tới nơi', !leaked)
  }

  report('sai mật khẩu không nối được', !(await connect(deviceA, `${secretA}-sai`)))
  report('không có tài khoản không nối được', !(await connect('', '')))
  report('tài khoản đã thu hồi không nối được', !(await connect(env('REVOKED_DEVICE'), env('REVOKED_SECRET'))))

  ;[listener, own, wildcard, publisher].forEach(client => client?.end(true))
  const failed = results.filter(r => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} kiểm tra đạt`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error((err as Error).message)
  process.exit(1)
})
