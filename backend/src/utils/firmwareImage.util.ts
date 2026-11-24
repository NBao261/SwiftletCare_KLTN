// Ảnh cài đặt (factory image) của bộ điều khiển: bootloader, bảng phân vùng, boot_app0 và firmware gộp, ghi từ 0x0
// (`pio run -e esp32prod -t factory`). Bố cục theo firmware/platformio.ini → min_spiffs.csv

export const BOOTLOADER_OFFSET = 0x1000
export const APP_OFFSET = 0x10000
// app0 rộng 0x1E0000: ảnh dài hơn thì firmware tràn phân vùng
export const MAX_FACTORY_IMAGE_BYTES = APP_OFFSET + 0x1E0000
// Byte đầu của mọi ảnh ESP32 (bootloader và firmware)
const ESP_IMAGE_MAGIC = 0xE9

export const FIRMWARE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/

// null khi dùng được; còn lại là câu báo cho Administrator
export function factoryImageProblem(image: Buffer, version: string): string | null {
  if (image.length <= APP_OFFSET) return 'File quá ngắn, không phải ảnh cài đặt (pio run -e esp32prod -t factory)'
  if (image.length > MAX_FACTORY_IMAGE_BYTES) return 'File lớn hơn phân vùng firmware của bộ điều khiển'
  if (image[BOOTLOADER_OFFSET] !== ESP_IMAGE_MAGIC || image[APP_OFFSET] !== ESP_IMAGE_MAGIC) {
    return 'File không phải ảnh cài đặt ESP32 ghi từ địa chỉ 0x0 (thiếu bootloader hoặc firmware)'
  }
  // Dòng chào khi khởi động in "Firmware v<phiên bản>": không có thì số phiên bản gõ sai hoặc nhầm file
  if (!image.includes(Buffer.from(`Firmware v${version} `, 'latin1')) && !image.includes(Buffer.from(`Firmware v${version}\0`, 'latin1'))) {
    return `File không phải firmware ${version} (không thấy phiên bản này trong file)`
  }
  return null
}
