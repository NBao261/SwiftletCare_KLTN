import { isInternalRequest } from '@/utils/requestLog.util'

describe('isInternalRequest', () => {
  it('skips the EMQX and MediaMTX calls that carry the key in the query', () => {
    expect(isInternalRequest({ originalUrl: '/internal/mqtt-auth?key=secret' })).toBe(true)
    expect(isInternalRequest({ originalUrl: '/internal/stream-auth?key=secret' })).toBe(true)
  })

  it('keeps every other request in the access log', () => {
    expect(isInternalRequest({ originalUrl: '/alerts?status=ACTIVE' })).toBe(false)
    expect(isInternalRequest({ originalUrl: '/internalize' })).toBe(false)
    expect(isInternalRequest({ originalUrl: '/health' })).toBe(false)
  })
})
