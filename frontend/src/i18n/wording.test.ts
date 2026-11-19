import { describe, expect, it } from 'vitest'

// Thuật ngữ FE_Design §6.2, §6.4: chữ hiển thị không dùng các biến thể dưới đây (bỏ file test và comment)
const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const VIETNAMESE = /[À-ỹđĐ]/
const STRING = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`|>([^<>{}\n]*[À-ỹđĐ][^<>{}\n]*)</g
const WORD_START = '(?<![\\w{.$/_-])'
const WORD_END = '(?![\\w}_(/-])(?!\\.\\w)'
const word = (term: string) => new RegExp(`${WORD_START}${term}${WORD_END}`)

// Chữ sai → chữ đúng (để câu báo lỗi chỉ luôn cách sửa)
const BANNED: Array<[RegExp, string]> = [
  [/khỏe|xóa|hủy|tùy|tọa|Khỏe|Xóa|Hủy|Tùy/, 'dấu đặt kiểu mới: khoẻ, xoá, huỷ, tuỳ, toạ'],
  [/[Tt]ỉ lệ/, 'tỷ lệ'],
  [/Farm Owner|[Cc]hủ trang trại|[Cc]hủ trại|[Cc]hủ farm/, 'chủ nhà yến'],
  [word('[Ff]arm'), 'trang trại'],
  [/[Kk]hu vực/, 'Zone'],
  [word('zone'), 'Zone (viết hoa)'],
  [word('[Tt]hợ'), 'kỹ thuật viên'],
  [/Domain Expert|Administrator|Primary Owner/, 'Chuyên gia, Quản trị viên, chủ chính'],
  [/SCADA/, 'Tình trạng vận hành / Điều khiển tay'],
  [/[Hh]eartbeat/, 'lần kết nối cuối, tín hiệu'],
  [/[Oo]ffline/, 'mất kết nối'],
  [/[Rr]ealtime|thời gian thực/, 'trực tiếp'],
  [word('[Ff]uzzy'), 'hệ số mờ'],
  [/[Pp]hán quyết|[Tt]hẩm định/, 'kết luận, kiểm chứng (cảnh báo), duyệt (tham số)'],
  [/[Vv]ui lòng/, 'câu mệnh lệnh bắt đầu bằng động từ'],
  [/[Nn]út AI|[Cc]amera AI|máy AI/, 'camera đếm chim'],
  [word('[Nn]ode'), 'bộ điều khiển'],
  [/[Bb]ộ kit/, 'bộ điều khiển'],
  [word('[Rr]elay'), 'rơ-le'],
  [/RS485|ESP32|MQTT|broker|\btoken\b|\bAPI\b|[Bb]ackend/, 'chữ thường của người dùng, không tên kỹ thuật'],
  [/ — /, 'dấu chấm, phẩy, hai chấm hoặc " · " thay cho gạch dài'],
]

// Chữ hiển thị không dấu trong JSX (VD nhãn badge) và thuộc tính chữ của component cũng không dùng tên kỹ thuật
const ASCII_JSX_TEXT = />\s*([A-Za-z][^<>{}\n]*?)\s*</g
const TEXT_PROP = /\b(?:label|title|placeholder|description|sub|aria-label)="([^"]*)"/g
const ASCII_BANNED = /SCADA|Heartbeat|Offline|\bLIVE\b|Device ID|OTA Firmware/
// Class in hoa, kể cả có tiền tố breakpoint hay trạng thái (sm:uppercase, group-hover:uppercase)
const UPPERCASE_CLASS = /["'`\s:]uppercase["'`\s]/

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}

function vietnameseStrings(source: string): string[] {
  return [...withoutComments(source).matchAll(STRING)]
    .map(match => match.slice(1).find(group => group !== undefined) ?? '')
    .filter(text => VIETNAMESE.test(text))
}

describe('thuật ngữ giao diện tiếng Việt (FE_Design §6.2)', () => {
  it('không dùng chữ đã bỏ trong bảng thuật ngữ', () => {
    const problems: string[] = []
    for (const [file, source] of Object.entries(sources)) {
      for (const text of vietnameseStrings(source)) {
        for (const [pattern, fix] of BANNED) {
          if (pattern.test(text)) problems.push(`${file}: "${text.slice(0, 90)}" → ${fix}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  // FE_Design §6.4 mục 4: không IN HOA chữ (trừ nhãn nhóm menu sidebar)
  it('không ép chữ in hoa bằng class uppercase', () => {
    const files = Object.entries(sources)
      .filter(([file, source]) => file.endsWith('.tsx') && !file.endsWith('/AppSidebar.tsx') && UPPERCASE_CLASS.test(withoutComments(source)))
      .map(([file]) => file)
    expect(files).toEqual([])
  })

  it('không có tên kỹ thuật trong chữ không dấu của JSX và thuộc tính chữ', () => {
    const problems = Object.entries(sources)
      .filter(([file]) => file.endsWith('.tsx'))
      .flatMap(([file, source]) => [...source.matchAll(ASCII_JSX_TEXT), ...source.matchAll(TEXT_PROP)].map(match => [file, match[1]] as const))
      .filter(([, text]) => ASCII_BANNED.test(text))
      .map(([file, text]) => `${file}: "${text}"`)
    expect(problems).toEqual([])
  })

  // Gạch dài trong JSX nhiều dòng hoặc chữ ghép với {…} không nằm gọn trong một chuỗi; file .tsx không chứa chữ tiếng Anh của từ điển
  it('không có gạch dài nối câu trong file giao diện', () => {
    const problems = Object.entries(sources)
      .filter(([file]) => file.endsWith('.tsx'))
      .flatMap(([file, source]) => withoutComments(source).split('\n').map((line, index) => [file, index + 1, line] as const))
      .filter(([, , line]) => line.includes(' — '))
      .map(([file, line, text]) => `${file}:${line}: ${text.trim().slice(0, 90)}`)
    expect(problems).toEqual([])
  })
})
