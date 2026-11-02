import { describe, expect, it } from '@jest/globals'
import { EN_TRANSLATIONS } from '@/constants/i18n.en'
import { translate } from '@/utils/i18n.utils'

describe('translate', () => {
  it('tiếng Việt trả nguyên câu, có thay biến', () => {
    expect(translate('{count} nhà yến', 'vi', { count: 3 })).toBe('3 nhà yến')
  })

  it('tiếng Anh tra từ điển và thay biến', () => {
    expect(translate('{count} nhà yến', 'en', { count: 3 })).toBe('3 swiftlet houses')
  })

  it('thiếu bản dịch thì vẫn hiện tiếng Việt', () => {
    expect(translate('Câu chưa có bản dịch', 'en')).toBe('Câu chưa có bản dịch')
  })

  it('mỗi bản dịch giữ đúng các biến của câu tiếng Việt', () => {
    const variablesOf = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',')
    for (const [vietnamese, english] of Object.entries(EN_TRANSLATIONS)) {
      expect(variablesOf(english)).toBe(variablesOf(vietnamese))
    }
  })
})
