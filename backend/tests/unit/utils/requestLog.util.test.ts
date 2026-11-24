import { isInternalRequest, loggablePath } from '@/utils/requestLog.util'

describe('isInternalRequest', () => {
  it('skips the EMQX and MediaMTX calls that carry the key in the query', () => {
    expect(isInternalRequest({ originalUrl: '/internal/mqtt-auth?key=secret' })).toBe(true)
    expect(isInternalRequest({ originalUrl: '/internal/stream-auth?key=secret' })).toBe(true)
    expect(isInternalRequest({ originalUrl: `/firmware/ota/${'a'.repeat(64)}` })).toBe(true)
    expect(isInternalRequest({ originalUrl: `/Firmware/OTA/${'a'.repeat(64)}` })).toBe(true)
  })

  it('keeps every other request in the access log', () => {
    expect(isInternalRequest({ originalUrl: '/alerts?status=ACTIVE' })).toBe(false)
    expect(isInternalRequest({ originalUrl: '/internalize' })).toBe(false)
    expect(isInternalRequest({ originalUrl: '/health' })).toBe(false)
  })
})

describe('loggablePath', () => {
  it('che token tải firmware và bỏ query', () => {
    expect(loggablePath({ originalUrl: `/firmware/ota/${'a'.repeat(64)}` })).toBe('/firmware/ota/***')
    expect(loggablePath({ originalUrl: `/FIRMWARE/ota/${'b'.repeat(64)}` })).toBe('/FIRMWARE/ota/***')
    expect(loggablePath({ originalUrl: '/internal/mqtt-auth?key=secret' })).toBe('/internal/mqtt-auth')
    expect(loggablePath({ originalUrl: '/alerts/123' })).toBe('/alerts/123')
  })
})
