/**
 * mdns-responder.script.ts – Phát mDNS hostname "swiftletcare-broker.local"
 * trỏ về IP LAN hiện tại của máy đang chạy `docker compose up -d` (EMQX).
 *
 * Vấn đề: ESP32 kết nối MQTT qua IP LAN của máy này; mỗi lần đổi mạng WiFi, IP
 * đó đổi theo (DHCP), phải tra lại bằng `ipconfig` rồi nhập tay. mDNS giải
 * quyết triệt để: ESP32 tự hỏi "swiftletcare-broker.local là IP nào?" qua
 * multicast (224.0.0.251:5353) mỗi lần cần, không ai phải biết/nhập IP nữa —
 * xem firmware/src/mqtt/MQTTManager.cpp (resolveBrokerViaMdns via ESPmDNS).
 *
 * CHỈ chạy trên máy host (Windows/macOS/Linux) đang chạy docker-compose, KHÔNG
 * chạy trong container: Docker Desktop for Windows dùng WSL2 VM, traffic
 * multicast của LAN thật không lọt vào network namespace của container nếu
 * không có `network_mode: host` (không ổn định trên Windows) — nên đây là 1
 * script Node độc lập, chạy song song `docker compose up -d` trong terminal
 * khác (`npm run mdns`), không phải 1 service trong docker-compose.yml.
 */
import mdns from 'multicast-dns'
import { networkInterfaces } from 'os'

const HOSTNAME = 'swiftletcare-broker.local'

// Bỏ qua các adapter ảo (Docker/WSL/Hyper-V/VPN...) thường có nhiều trên máy
// dev, để không vô tình phát nhầm 1 IP mà ESP32 (nằm trên WiFi thật) không
// bao giờ tới được.
const VIRTUAL_ADAPTER_PATTERN = /vethernet|virtualbox|vmware|docker|wsl|loopback|bluetooth|tailscale|zerotier/i

function getLanIPv4(): string | null {
  const ifaces = networkInterfaces()
  const candidates: string[] = []
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs || VIRTUAL_ADAPTER_PATTERN.test(name)) continue
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) candidates.push(addr.address)
    }
  }
  if (candidates.length > 1) {
    console.warn(`[mDNS] Tìm thấy nhiều IP LAN khả dụng: ${candidates.join(', ')} — đang dùng "${candidates[0]}". Nếu ESP32 không kết nối được, kiểm tra lại đây có đúng IP của adapter WiFi/Ethernet đang dùng không.`)
  }
  return candidates[0] ?? null
}

const responder = mdns()

responder.on('query', (query) => {
  const asksForBroker = query.questions.some(q => q.type === 'A' && q.name.toLowerCase() === HOSTNAME)
  if (!asksForBroker) return

  const ip = getLanIPv4()
  if (!ip) {
    console.warn('[mDNS] Có thiết bị hỏi broker ở đâu nhưng không tìm được IP LAN nào để trả lời — kiểm tra kết nối mạng của máy này.')
    return
  }

  responder.respond({ answers: [{ name: HOSTNAME, type: 'A', ttl: 120, data: ip }] })
  console.log(`[mDNS] Trả lời "${HOSTNAME}" -> ${ip}`)
})

const startIp = getLanIPv4()
console.log(`[mDNS] Đang phát "${HOSTNAME}" -> ${startIp ?? '(chưa xác định được IP LAN)'}`)
console.log('[mDNS] Giữ terminal này mở song song với `docker compose up -d`. Ctrl+C để dừng.')
