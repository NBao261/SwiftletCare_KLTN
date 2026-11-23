import { describe, expect, it } from 'vitest'
import { parseTypedValue } from '@/components/features/domain-expert/tuning/StepperValueInput'

const clamp = (value: number) => Math.min(95, Math.max(40, Math.round(value * 10) / 10))

describe('parseTypedValue', () => {
  it('nhận số gõ thẳng, kể cả dấu phẩy thập phân, và làm tròn theo bước', () => {
    expect(parseTypedValue('82', clamp)).toBe(82)
    expect(parseTypedValue(' 81,25 ', clamp)).toBe(81.3)
  })

  it('số ngoài phạm vi được kẹp về biên', () => {
    expect(parseTypedValue('120', clamp)).toBe(95)
    expect(parseTypedValue('-5', clamp)).toBe(40)
  })

  it('ô trống hoặc chữ thì giữ số cũ', () => {
    expect(parseTypedValue('', clamp)).toBeNull()
    expect(parseTypedValue('abc', clamp)).toBeNull()
  })
})
