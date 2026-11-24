// Nạp mã thiết bị và mật khẩu broker vào ESP32 qua cổng USB (Web Serial, Chrome/Edge máy tính), firmware ≥ 2.4.0.
// Giao thức: docs/reports/todo-device-flashing-1124.md §2 — gửi `SC INFO` / `SC SET {json}`, chip trả một dòng `SC> {json}`

export interface ChipInfo {
  mac: string
  fw: string
  kind: string
  deviceId: string | null
}

export interface ChipReply {
  ok: boolean
  error?: string
  mac?: string
  fw?: string
  kind?: string
  deviceId?: string | null
}

export interface IdentityPayload {
  deviceId: string
  brokerSecret: string
  broker?: string | null
  force?: boolean
}

const REPLY_MARK = 'SC> '

// Log của firmware đi chung cổng: chỉ dòng có dấu `SC> ` là trả lời (có thể bị log chen phía trước)
export function parseReplyLine(line: string): ChipReply | null {
  const at = line.indexOf(REPLY_MARK)
  if (at < 0) return null
  try {
    const parsed: unknown = JSON.parse(line.slice(at + REPLY_MARK.length).trim())
    return typeof parsed === 'object' && parsed !== null && typeof (parsed as ChipReply).ok === 'boolean' ? parsed as ChipReply : null
  } catch {
    return null
  }
}

// Dữ liệu serial đến từng mảnh: tách thành dòng hoàn chỉnh, giữ phần dở cho lần sau
export function splitLines(pending: string, chunk: string): { lines: string[]; rest: string } {
  const parts = (pending + chunk).split('\n')
  const rest = parts.pop() ?? ''
  return { lines: parts.map(line => line.replace(/\r$/, '')), rest }
}

// Mã đề xuất từ 3 byte cuối của MAC: không phải gõ, hai chip không trùng
export function suggestDeviceId(mac: string): string {
  return `ctl-${mac.slice(-6).toLowerCase()}`
}

// Mã đã thu hồi vẫn nằm trong kho: đề xuất mã kế tiếp (ctl-a1b2c3 → ctl-a1b2c3-2 → ctl-a1b2c3-3), trong 40 ký tự
export function nextDeviceId(revokedId: string): string {
  const match = /^(.*)-(\d+)$/.exec(revokedId)
  const [base, next] = match && Number(match[2]) >= 2 ? [match[1], Number(match[2]) + 1] : [revokedId, 2]
  const suffix = `-${next}`
  return `${base.slice(0, 40 - suffix.length)}${suffix}`
}

export function buildSetCommand(payload: IdentityPayload): string {
  const body = { deviceId: payload.deviceId, brokerSecret: payload.brokerSecret, broker: payload.broker ?? '', force: payload.force === true }
  return `SC SET ${JSON.stringify(body)}\n`
}

// Câu tiếng Việt cho mã lỗi của chip
export const CHIP_ERROR_TEXT: Record<string, string> = {
  BAD_JSON: 'Bo mạch không đọc được lệnh. Thử nạp lại.',
  BAD_DEVICE_ID: 'Mã thiết bị chỉ gồm chữ, số, "_", "-", tối đa 40 ký tự.',
  BAD_SECRET: 'Mật khẩu kết nối không hợp lệ. Thử nạp lại.',
  BAD_BROKER: 'Địa chỉ máy chủ kết nối của thiết bị không hợp lệ. Kiểm tra cấu hình máy chủ.',
  PROVISIONED: 'Bo mạch đã có mã. Xác nhận ghi đè rồi nạp lại.',
  WRITE_FAILED: 'Bo mạch không ghi được vào bộ nhớ. Cắm lại rồi nạp lại.',
  UNKNOWN_COMMAND: 'Firmware trên bo mạch không hiểu lệnh nạp. Nạp firmware từ 2.4.0 trước.',
}

// Web Serial chưa có trong lib.dom của TypeScript: khai phần đang dùng
export interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>
}

function serialApi(): SerialLike | undefined {
  return (navigator as Navigator & { serial?: SerialLike }).serial
}

export const isWebSerialSupported = (): boolean => typeof navigator !== 'undefined' && serialApi() !== undefined

const BAUD_RATE = 115200
// Mở cổng làm bo khởi động lại; firmware trả lời sau khi xong setup (thử Wi-Fi đã lưu có thể mất ~20 giây)
const INFO_TIMEOUT_MS = 30_000
const INFO_RETRY_MS = 500
const SET_TIMEOUT_MS = 8_000

export class SerialError extends Error {
  constructor(public readonly code: 'NO_PORT' | 'TIMEOUT' | 'DISCONNECTED' | 'UNSUPPORTED' | 'ABORTED', message: string) {
    super(message)
  }
}

// Một cổng đang mở với một bo mạch; đọc liên tục và chuyển từng dòng trả lời cho lệnh đang chờ
export class DeviceSerial {
  private port: SerialPortLike | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private waiters: Array<(reply: ChipReply) => void> = []
  private closed = false

  // `port`: cổng vừa trả lại sau khi nạp firmware (detach), không hỏi chọn cổng lần nữa
  async connect(port?: SerialPortLike): Promise<void> {
    const serial = serialApi()
    if (!serial) throw new SerialError('UNSUPPORTED', 'Trình duyệt không hỗ trợ kết nối USB. Dùng Chrome hoặc Edge trên máy tính.')
    if (port) this.port = port
    else {
      try {
        this.port = await serial.requestPort()
      } catch {
        throw new SerialError('NO_PORT', 'Chưa chọn cổng. Cắm bo mạch rồi chọn cổng của nó (thường là CP210x hoặc CH340).')
      }
    }
    this.closed = false
    await this.port.open({ baudRate: BAUD_RATE })
    // Thả chân EN/IO0 như esptool để bo chạy firmware, không kẹt ở chế độ nạp
    await this.port.setSignals?.({ dataTerminalReady: false, requestToSend: false })
    void this.readLoop()
  }

  private async readLoop(): Promise<void> {
    const decoder = new TextDecoder()
    let pending = ''
    try {
      while (this.port?.readable && !this.closed) {
        this.reader = this.port.readable.getReader()
        for (;;) {
          const { value, done } = await this.reader.read()
          if (done) break
          const { lines, rest } = splitLines(pending, decoder.decode(value, { stream: true }))
          pending = rest
          for (const line of lines) {
            const reply = parseReplyLine(line)
            if (reply) this.waiters.splice(0).forEach(resolve => resolve(reply))
          }
        }
        this.reader.releaseLock()
      }
    } catch {
      // Rút cáp hoặc đóng cổng: lệnh đang chờ tự hết hạn
    }
  }

  private async send(line: string): Promise<void> {
    if (!this.port?.writable) throw new SerialError('DISCONNECTED', 'Mất kết nối với bo mạch. Cắm lại rồi kết nối lại.')
    const writer = this.port.writable.getWriter()
    try {
      await writer.write(new TextEncoder().encode(line))
    } finally {
      writer.releaseLock()
    }
  }

  private nextReply(timeoutMs: number): Promise<ChipReply | null> {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(waiter => waiter !== done)
        resolve(null)
      }, timeoutMs)
      const done = (reply: ChipReply) => {
        clearTimeout(timer)
        resolve(reply)
      }
      this.waiters.push(done)
    })
  }

  // Hỏi lại mỗi 0,5 giây tới khi bo khởi động xong và trả lời; `signal` dừng chờ khi Admin chọn nạp firmware
  async info(timeoutMs = INFO_TIMEOUT_MS, signal?: AbortSignal): Promise<ChipInfo> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new SerialError('ABORTED', 'Đã dừng chờ bo mạch')
      await this.send('SC INFO\n')
      const reply = await this.nextReply(INFO_RETRY_MS)
      if (reply?.ok && typeof reply.mac === 'string') {
        return { mac: reply.mac, fw: reply.fw ?? '', kind: reply.kind ?? 'SENSOR', deviceId: reply.deviceId ?? null }
      }
    }
    throw new SerialError('TIMEOUT', 'Bo mạch không trả lời. Kiểm tra cáp USB có truyền dữ liệu, firmware từ 2.4.0, rồi cắm lại.')
  }

  async writeIdentity(payload: IdentityPayload): Promise<ChipReply> {
    await this.send(buildSetCommand(payload))
    const reply = await this.nextReply(SET_TIMEOUT_MS)
    if (!reply) throw new SerialError('TIMEOUT', 'Bo mạch không xác nhận đã ghi. Cắm lại rồi nạp lại.')
    return reply
  }

  // Đóng cổng nhưng trả lại đối tượng cổng cho esptool-js (nạp firmware), rồi connect(port) để nói chuyện tiếp
  async detach(): Promise<SerialPortLike | null> {
    const port = this.port
    await this.close()
    return port
  }

  async close(): Promise<void> {
    this.closed = true
    try {
      await this.reader?.cancel()
      await this.port?.close()
    } catch {
      // Cổng đã mất (rút cáp): không còn gì để đóng
    }
    this.port = null
  }
}
