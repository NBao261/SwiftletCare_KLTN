import { describe, expect, it } from 'vitest'
import { buildSetCommand, parseReplyLine, splitLines, suggestDeviceId } from '@/lib/deviceSerial'

describe('đọc trả lời của bo mạch qua cổng USB', () => {
  it('chỉ nhận dòng có dấu SC>, kể cả khi log chen phía trước', () => {
    expect(parseReplyLine('[WiFi] Connected')).toBeNull()
    expect(parseReplyLine('SC> {"ok":true,"mac":"A1B2C3D4E5F6","fw":"2.4.0","kind":"SENSOR","deviceId":null}'))
      .toEqual({ ok: true, mac: 'A1B2C3D4E5F6', fw: '2.4.0', kind: 'SENSOR', deviceId: null })
    expect(parseReplyLine('[MQTT] retrySC> {"ok":false,"error":"PROVISIONED"}')).toEqual({ ok: false, error: 'PROVISIONED' })
    expect(parseReplyLine('SC> {hỏng')).toBeNull()
    expect(parseReplyLine('SC> {"no":"ok field"}')).toBeNull()
  })

  it('ghép mảnh dữ liệu thành dòng, giữ phần dở và bỏ \\r', () => {
    const first = splitLines('', 'SC> {"ok":tr')
    expect(first).toEqual({ lines: [], rest: 'SC> {"ok":tr' })
    expect(splitLines(first.rest, 'ue}\r\nboot')).toEqual({ lines: ['SC> {"ok":true}'], rest: 'boot' })
  })

  it('đề xuất mã từ 3 byte cuối của MAC; lệnh ghi là một dòng JSON', () => {
    expect(suggestDeviceId('A1B2C3D4E5F6')).toBe('ctl-d4e5f6')
    expect(buildSetCommand({ deviceId: 'ctl-d4e5f6', brokerSecret: 's', broker: null }))
      .toBe('SC SET {"deviceId":"ctl-d4e5f6","brokerSecret":"s","broker":"","force":false}\n')
    expect(buildSetCommand({ deviceId: 'n1', brokerSecret: 's', broker: 'mqtt.x.vn', force: true }))
      .toContain('"broker":"mqtt.x.vn","force":true')
  })
})
