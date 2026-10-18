import { REGIONS, assertRegionCode, listRegions, toRegionCode } from '@/utils/regions.util'

describe('regions.util', () => {
  it('has the 34 provinces/cities with unique codes', () => {
    expect(REGIONS).toHaveLength(34)
    expect(new Set(REGIONS.map(r => r.code)).size).toBe(34)
    expect(listRegions()[0]).toEqual({ code: expect.any(String), name: expect.any(String) })
  })

  it('maps every code, name and alias back to its own region (no key collides with another region)', () => {
    for (const region of REGIONS) {
      for (const key of [region.code, region.name, ...region.aliases]) expect([key, toRegionCode(key)]).toEqual([key, region.code])
    }
  })

  it.each([
    ['hcmc', 'HCMC'], ['TP. Hồ Chí Minh', 'HCMC'], ['Thành phố Hồ Chí Minh', 'HCMC'], ['tphcm', 'HCMC'],
    ['ha noi', 'HA_NOI'], ['Hanoi', 'HA_NOI'], ['HANOI', 'HA_NOI'],
    ['Long An', 'TAY_NINH'], ['tỉnh Kiên Giang', 'AN_GIANG'], ['Bình Định', 'GIA_LAI'], ['Hoà Bình', 'PHU_THO'],
  ])('reads %p as %p (no diacritics, case, prefix or merged-province name needed)', (input, code) => {
    expect(toRegionCode(input)).toBe(code)
  })

  it('returns null for unknown or empty input and assertRegionCode explains the 400', () => {
    expect(toRegionCode('Sao Hỏa')).toBeNull()
    expect(toRegionCode('   ')).toBeNull()
    expect(() => assertRegionCode('Sao Hỏa')).toThrow(expect.objectContaining({ statusCode: 400 }))
  })
})
