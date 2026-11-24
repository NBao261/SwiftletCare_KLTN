import { APP_OFFSET, BOOTLOADER_OFFSET, MAX_FACTORY_IMAGE_BYTES, factoryImageProblem, isFirmwareObjectPath } from '@/utils/firmwareImage.util'

// Ảnh giả: đủ dài, đầu bootloader và firmware đúng byte 0xE9, có dòng chào của phiên bản
function image(version = '2.4.0', length = APP_OFFSET + 4096): Buffer {
  const buffer = Buffer.alloc(length, 0xFF)
  buffer[BOOTLOADER_OFFSET] = 0xE9
  buffer[APP_OFFSET] = 0xE9
  buffer.write(`║   SwiftletCare ESP32 Firmware v${version}     ║`, APP_OFFSET + 100, 'utf8')
  return buffer
}

describe('factoryImageProblem — ảnh cài đặt cho trạm nạp', () => {
  it('nhận ảnh đúng bố cục và đúng phiên bản', () => {
    expect(factoryImageProblem(image(), '2.4.0')).toBeNull()
  })

  it('từ chối file ngắn, quá lớn, thiếu bootloader hoặc firmware', () => {
    expect(factoryImageProblem(Buffer.alloc(100), '2.4.0')).toMatch(/quá ngắn/)
    expect(factoryImageProblem(image('2.4.0', MAX_FACTORY_IMAGE_BYTES + 1), '2.4.0')).toMatch(/lớn hơn/)
    const noBootloader = image()
    noBootloader[BOOTLOADER_OFFSET] = 0xFF
    expect(factoryImageProblem(noBootloader, '2.4.0')).toMatch(/0x0/)
    // Chỉ là firmware.bin (ghi từ 0x10000), không phải ảnh gộp
    const appOnly = image()
    appOnly[APP_OFFSET] = 0x00
    expect(factoryImageProblem(appOnly, '2.4.0')).toMatch(/0x0/)
  })

  it('phiên bản gõ không khớp file thì báo; 2.4.1 không khớp file 2.4.10', () => {
    expect(factoryImageProblem(image('2.4.0'), '2.5.0')).toMatch(/không phải firmware 2\.5\.0/)
    expect(factoryImageProblem(image('2.4.10'), '2.4.1')).toMatch(/không phải firmware 2\.4\.1/)
  })
})

describe('isFirmwareObjectPath — /files không phục vụ kho firmware', () => {
  it('chặn mọi cách viết đường dẫn vào firmware/', () => {
    for (const urlPath of ['/firmware/2.4.0-x.bin', '/FIRMWARE/2.4.0-x.bin', '/%66irmware/a.bin', '/./firmware/a.bin', '//firmware/a.bin',
      '/audio/../firmware/a.bin', '/firmware', '/firmware%2Fa.bin', '/firmware%5Ca.bin', '/%E0%A4%A']) {
      expect([urlPath, isFirmwareObjectPath(urlPath)]).toEqual([urlPath, true])
    }
  })

  it('để yên file khác', () => {
    expect(isFirmwareObjectPath('/audio/track-1.mp3')).toBe(false)
    expect(isFirmwareObjectPath('/work-orders/firmware-photo.jpg')).toBe(false)
  })
})
