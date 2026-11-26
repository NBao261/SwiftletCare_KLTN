import { describe, expect, it } from '@jest/globals'
import {
  buildLocationMapHtml,
  buildSetPinScript,
  isSameCoordinates,
  parseLocationMapMessage,
} from '@/utils/locationMap.utils'
import { parseCoordinatesDraft } from '@/utils/settingsValidation.utils'

describe('buildLocationMapHtml', () => {
  it('có toạ độ thì mở bản đồ tại đó với ghim map-pin cố định ở giữa; Leaflet tải kèm mã kiểm tra SRI', () => {
    const html = buildLocationMapHtml({
      coordinates: { lat: 10.762622, lng: 106.660172 },
      isInteractive: true,
      pinColor: '#0B0B0C',
      pinShadowColor: '#0B0B0C59',
    })
    expect(html).toContain('var initial = [10.762622,106.660172]')
    expect(html).toContain('var interactive = true')
    expect(html).toContain('integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="')
    expect(html).toContain('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(html).toContain('<svg id="pin"')
    expect(html).toContain('fill="#0B0B0C"/>')
    expect(html).not.toContain('stroke=')
    expect(html).toContain('display:block')
    // Không còn ghim kéo được hay chạm để đặt ghim: vị trí chọn là tâm bản đồ khi dừng kéo
    expect(html).not.toContain('L.marker')
    expect(html).toContain("map.on('moveend'")
  })

  it('xem trước chưa có toạ độ: ẩn ghim, không nhận chạm; màn ghim chưa có toạ độ vẫn hiện ghim ở giữa', () => {
    const preview = buildLocationMapHtml({ coordinates: null, isInteractive: false, pinColor: '#000', pinShadowColor: '#0B0B0C59' })
    expect(preview).toContain('var initial = null')
    expect(preview).toContain('var interactive = false')
    expect(preview).toContain('display:none')
    const picker = buildLocationMapHtml({ coordinates: null, isInteractive: true, pinColor: '#000', pinShadowColor: '#0B0B0C59' })
    expect(picker).toContain('display:block')
    // Có vị trí sau (GPS, gõ tay) thì setPin hiện lại ghim của bản đồ xem trước
    expect(preview).toContain("document.getElementById('pin').style.display = 'block'")
  })

  it('lệnh đặt ghim từ app', () => {
    expect(buildSetPinScript({ lat: 1.5, lng: 2.5 })).toBe('window.setPin && window.setPin(1.5, 2.5); true;')
  })
})

describe('parseLocationMapMessage', () => {
  it('đọc toạ độ vừa ghim, làm tròn 6 chữ số lẻ, đưa kinh độ về -180…180', () => {
    expect(parseLocationMapMessage('{"kind":"pick","lat":10.1234567,"lng":106.7654321}')).toEqual({
      kind: 'pick',
      coordinates: { lat: 10.123457, lng: 106.765432 },
    })
    expect(parseLocationMapMessage('{"kind":"pick","lat":10,"lng":466}')).toEqual({
      kind: 'pick',
      coordinates: { lat: 10, lng: 106 },
    })
  })

  it('báo không tải được bản đồ; tin lạ hoặc vĩ độ sai thì bỏ qua', () => {
    expect(parseLocationMapMessage('{"kind":"load-error"}')).toEqual({ kind: 'load-error' })
    expect(parseLocationMapMessage('không phải JSON')).toBeNull()
    expect(parseLocationMapMessage('{"kind":"pick","lat":95,"lng":10}')).toBeNull()
    expect(parseLocationMapMessage('{"kind":"other"}')).toBeNull()
  })

  it('so toạ độ sau khi làm tròn', () => {
    expect(isSameCoordinates({ lat: 1.0000001, lng: 2 }, { lat: 1, lng: 2 })).toBe(true)
    expect(isSameCoordinates({ lat: 1, lng: 2 }, null)).toBe(false)
    expect(isSameCoordinates(null, null)).toBe(true)
  })
})

describe('parseCoordinatesDraft', () => {
  it('hai ô hợp lệ thì thành toạ độ (nhận dấu phẩy thập phân), còn trống hoặc sai thì null', () => {
    expect(parseCoordinatesDraft({ lat: '10,5', lng: '106.25' })).toEqual({ lat: 10.5, lng: 106.25 })
    expect(parseCoordinatesDraft({ lat: '', lng: '106' })).toBeNull()
    expect(parseCoordinatesDraft({ lat: '95', lng: '106' })).toBeNull()
  })
})
