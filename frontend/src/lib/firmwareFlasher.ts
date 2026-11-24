// Ghi ảnh cài đặt (ghi từ 0x0) vào ESP32 qua cổng USB bằng esptool-js, bản JavaScript chính thức của Espressif
import SparkMD5 from 'spark-md5'

// Vùng NVS (firmware/platformio.ini → min_spiffs.csv): mã thiết bị, Wi-Fi, mức dòng đã học. Ảnh gộp chỉ có 0xFF ở đây
export const NVS_START = 0x9000
export const NVS_END = 0xE000

export interface FlashSegment {
  address: number
  data: Uint8Array
}

// Bỏ vùng NVS để cập nhật firmware không xoá mã và Wi-Fi của bo đã nạp
export function factorySegments(image: Uint8Array): FlashSegment[] {
  if (image.length <= NVS_END) return [{ address: 0, data: image }]
  return [
    { address: 0, data: image.slice(0, NVS_START) },
    { address: NVS_END, data: image.slice(NVS_END) },
  ]
}

// So "x.y.z": âm khi a cũ hơn b
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(part => Number.parseInt(part, 10) || 0)
  const partsB = b.split('.').map(part => Number.parseInt(part, 10) || 0)
  for (let index = 0; index < 3; index++) {
    if ((partsA[index] ?? 0) !== (partsB[index] ?? 0)) return (partsA[index] ?? 0) - (partsB[index] ?? 0)
  }
  return 0
}

// Dòng chào khi khởi động in "Firmware vX.Y.Z " (backend kiểm cùng chuỗi): điền sẵn phiên bản khi chọn file
const BANNER = /Firmware v(\d+\.\d+\.\d+)[ \0]/

export function detectFirmwareVersion(image: Uint8Array): string | null {
  // latin1: mỗi byte một ký tự, không hỏng vì dữ liệu nhị phân
  return BANNER.exec(new TextDecoder('latin1').decode(image))?.[1] ?? null
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data.slice())
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

// esptool-js cần MD5 để đọc lại flash và so: ghi lỗi thì báo, không để bo chạy firmware hỏng
function md5Hex(data: Uint8Array): string {
  const spark = new SparkMD5.ArrayBuffer()
  spark.append(data.slice().buffer)
  return spark.end()
}

const FLASH_BAUD_RATE = 921600

// `port` đã đóng (DeviceSerial.detach): esptool-js tự mở, đưa chip vào chế độ nạp, ghi, rồi khởi động lại bo
export async function flashFactoryImage(
  port: unknown, image: Uint8Array, onProgress: (percent: number) => void,
): Promise<void> {
  // Nạp lười: esptool-js kèm stub flasher của mọi dòng chip, chỉ tải khi thật sự nạp
  const { ESPLoader, Transport } = await import('esptool-js')
  const transport = new Transport(port as ConstructorParameters<typeof Transport>[0], false)
  const loader = new ESPLoader({ transport, baudrate: FLASH_BAUD_RATE, romBaudrate: 115200 })
  const segments = factorySegments(image)
  const total = segments.reduce((sum, segment) => sum + segment.data.length, 0)
  const before = segments.map((_, index) => segments.slice(0, index).reduce((sum, segment) => sum + segment.data.length, 0))
  try {
    await loader.main()
    await loader.writeFlash({
      fileArray: segments,
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, size) => {
        const done = before[fileIndex] + (written / size) * segments[fileIndex].data.length
        onProgress(Math.min(100, Math.round((done / total) * 100)))
      },
      calculateMD5Hash: md5Hex,
    })
    await loader.after('hard_reset')
  } finally {
    await transport.disconnect().catch(() => undefined)
  }
}
