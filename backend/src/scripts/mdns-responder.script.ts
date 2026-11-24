// npm run mdns: phát swiftletcare-broker.local cho ESP32. Chạy trên host, không trong container (multicast không lọt vào WSL2)
import mdns from 'multicast-dns'
import { networkInterfaces } from 'os'

const HOSTNAME = 'swiftletcare-broker.local'

// Bỏ adapter ảo để không phát nhầm IP mà ESP32 trên WiFi thật không tới được
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
