import { describe, expect, it } from '@jest/globals'
import {
  COORDINATE_RULES,
  DETECTION_TUNING_RULES,
  formatStoredNumber,
  FUZZY_TUNING_RULES,
  getZoneFloorRule,
  hasDraftErrors,
  HOUSE_FLOOR_RULE,
  isNumberDraftChanged,
  NAME_MAX_LENGTH,
  normalizeName,
  parseNumberDraft,
  parseNumberInput,
  THRESHOLD_RULES,
  toInputText,
  validateName,
  validateNumber,
  validateNumberDraft,
  validateThresholdDraft,
} from '@/utils/settingsValidation.utils'

// Bản nháp ngưỡng hợp lệ, test nào cần thì sửa một ô
const validThresholds = {
  temp_min: '26',
  temp_max: '31',
  humidity_min: '75',
  humidity_max: '95',
  light_max: '0,2',
  nh3_max: '25',
  co2_max: '1500',
}

describe('parseNumberInput', () => {
  it('nhận dấu phẩy và dấu chấm làm dấu thập phân, số âm', () => {
    expect(parseNumberInput('69,9')).toBe(69.9)
    expect(parseNumberInput(' 0.5 ')).toBe(0.5)
    expect(parseNumberInput('-40')).toBe(-40)
  })

  it('ô trống, chữ, ngăn hàng nghìn thì không phải số', () => {
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('abc')).toBeNull()
    expect(parseNumberInput('1.500,5')).toBeNull()
  })

  it('số có 3 chữ số thập phân vẫn là số: toạ độ 10.762, 106.660', () => {
    expect(parseNumberInput('10.762')).toBe(10.762)
    expect(parseNumberInput('106.660')).toBe(106.66)
    expect(parseNumberInput('0.125')).toBe(0.125)
  })
})

describe('validateNumber với số trông như có dấu ngăn nghìn', () => {
  it('toạ độ nhận 10.762; ô ánh sáng tối đa (tới 200.000) báo "1.500" là mơ hồ', () => {
    expect(validateNumber('10.762', COORDINATE_RULES.lat)).toBeNull()
    expect(validateNumber('106.660', COORDINATE_RULES.lng)).toBeNull()
    expect(validateNumber('1.500', THRESHOLD_RULES.light_max)).toBe('Nhập số không có dấu ngăn nghìn')
    expect(validateNumber('1500', THRESHOLD_RULES.light_max)).toBeNull()
  })
})

describe('toInputText', () => {
  it('số lẻ viết dấu phẩy, chưa có giá trị thì ô trống', () => {
    expect(toInputText(0.2)).toBe('0,2')
    expect(toInputText(undefined)).toBe('')
  })
})

describe('validateNumber', () => {
  it('ngoài khoảng, không phải số nguyên hoặc không phải số thì báo lỗi', () => {
    expect(validateNumber('25', FUZZY_TUNING_RULES.fuzzy_humidity_band)).toBe('Từ 2 đến 20')
    expect(validateNumber('120,5', FUZZY_TUNING_RULES.fuzzy_window_sec)).toBe('Nhập số nguyên')
    expect(validateNumber('', FUZZY_TUNING_RULES.fuzzy_temp_band)).toBe('Nhập một số')
    expect(validateNumber('0', HOUSE_FLOOR_RULE)).toBe('Từ 1 đến 10')
    expect(validateNumber('11', HOUSE_FLOOR_RULE)).toBe('Từ 1 đến 10')
    expect(validateNumber('2,5', HOUSE_FLOOR_RULE)).toBe('Nhập số nguyên')
  })

  it('đúng mép khoảng thì hợp lệ', () => {
    expect(validateNumber('0,5', DETECTION_TUNING_RULES.pump_dry_min_rise_pct)).toBeNull()
    expect(validateNumber('-90', COORDINATE_RULES.lat)).toBeNull()
  })
})

describe('validateThresholdDraft', () => {
  it('bản nháp hợp lệ thì không có lỗi', () => {
    expect(hasDraftErrors(validateThresholdDraft(validThresholds))).toBe(false)
  })

  it('mức thấp không nhỏ hơn mức cao thì báo ở ô mức cao', () => {
    expect(validateThresholdDraft({ ...validThresholds, temp_min: '31' })).toEqual({
      temp_max: 'Phải lớn hơn mức thấp',
    })
  })

  it('ngoài khoảng đo của cảm biến thì báo đúng ô', () => {
    expect(validateThresholdDraft({ ...validThresholds, co2_max: '6000' })).toEqual({ co2_max: 'Từ 0 đến 5.000' })
    expect(validateThresholdDraft({ ...validThresholds, humidity_max: '101' }).humidity_max).toBe('Từ 0 đến 100')
  })
})

describe('validateNumberDraft và parseNumberDraft', () => {
  it('toạ độ ngoài khoảng bị chặn', () => {
    expect(validateNumberDraft({ lat: '91', lng: '106,7' }, COORDINATE_RULES)).toEqual({ lat: 'Từ -90 đến 90' })
  })

  it('bản nháp hợp lệ thành số để gửi backend', () => {
    expect(parseNumberDraft({ lat: '10,7769', lng: '106.7009' }, ['lat', 'lng'])).toEqual({
      lat: 10.7769,
      lng: 106.7009,
    })
  })
})

describe('isNumberDraftChanged', () => {
  it('so theo số: "26,0" bằng 26, đổi một ô là có thay đổi', () => {
    expect(isNumberDraftChanged({ temp_min: '26,0' }, { temp_min: 26 }, ['temp_min'])).toBe(false)
    expect(isNumberDraftChanged({ temp_min: '27' }, { temp_min: 26 }, ['temp_min'])).toBe(true)
    expect(isNumberDraftChanged({ temp_min: '' }, {}, ['temp_min'])).toBe(false)
  })
})

describe('formatStoredNumber', () => {
  it('giữ đúng phần lẻ backend trả, có ngăn hàng nghìn', () => {
    expect(formatStoredNumber(0.2)).toBe('0,2')
    expect(formatStoredNumber(0.05)).toBe('0,05')
    expect(formatStoredNumber(1500)).toBe('1.500')
    expect(formatStoredNumber(26)).toBe('26')
  })
})

describe('getZoneFloorRule', () => {
  it('tầng của khu vực không vượt số tầng của nhà; nhà chưa có số tầng thì lấy mức 10', () => {
    expect(validateNumber('3', getZoneFloorRule(3))).toBeNull()
    expect(validateNumber('4', getZoneFloorRule(3))).toBe('Từ 1 đến 3')
    expect(getZoneFloorRule(undefined).max).toBe(HOUSE_FLOOR_RULE.max)
  })
})

describe('normalizeName', () => {
  it('bỏ khoảng trắng thừa và hoa thường, giữ dấu tiếng Việt', () => {
    expect(normalizeName('  nhà  A ')).toBe(normalizeName('Nhà a'))
    expect(normalizeName('Nhà Á')).not.toBe(normalizeName('Nhà A'))
  })
})

describe('validateName', () => {
  const houseNames = ['Nhà A', 'Nhà B']

  it('rỗng hoặc dài quá thì báo lỗi', () => {
    expect(validateName('   ')).toBe('Không được để trống')
    expect(validateName('a'.repeat(NAME_MAX_LENGTH))).toBeNull()
    expect(validateName('a'.repeat(NAME_MAX_LENGTH + 1))).toBe('Tối đa 50 ký tự')
  })

  it('trùng tên cùng cấp (khác hoa thường, thừa khoảng trắng) thì báo câu trùng', () => {
    expect(validateName(' nhà  a', houseNames, 'Trùng')).toBe('Trùng')
    expect(validateName('Nhà C', houseNames, 'Trùng')).toBeNull()
    expect(validateName('Nhà Á', houseNames, 'Trùng')).toBeNull()
  })
})
