import { parseTrustProxy } from '@/utils/trustProxy.util'

describe('parseTrustProxy', () => {
  it.each([undefined, '', '   ', 'false', 'FALSE', '0'])('disables trust proxy for %p', raw => {
    expect(parseTrustProxy(raw)).toBe(false)
  })

  it('reads a hop count', () => {
    expect(parseTrustProxy('1')).toBe(1)
    expect(parseTrustProxy(' 2 ')).toBe(2)
  })

  it.each(['loopback', 'uniquelocal', '10.0.0.0/8', '127.0.0.1, 10.0.0.5'])('passes %p through for Express to validate', raw => {
    expect(parseTrustProxy(raw)).toBe(raw)
  })

  it.each(['true', 'TRUE'])('refuses %p because it trusts a client-controlled X-Forwarded-For', raw => {
    expect(() => parseTrustProxy(raw)).toThrow(/không an toàn/)
  })

  it('produces values Express accepts, unlike the raw string "false" that crashed the server', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express')
    const app = express()
    expect(() => app.set('trust proxy', 'false')).toThrow('invalid IP address: false')
    for (const raw of ['1', 'loopback', '10.0.0.0/8']) {
      expect(() => app.set('trust proxy', parseTrustProxy(raw))).not.toThrow()
    }
  })
})
