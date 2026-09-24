import { describe, it, expect } from 'vitest'
import {
  validateHouseName, validateRoomName, validateHouseFloors, HOUSE_NAME_MAX, HOUSE_FLOORS_MAX,
} from '@/validations/admin/house.validation'

describe('validateHouseName', () => {
  it('chặn tên rỗng / chỉ khoảng trắng', () => {
    expect(validateHouseName('   ', [])).toMatch(/Chưa nhập/)
  })
  it('chặn tên quá dài', () => {
    expect(validateHouseName('a'.repeat(HOUSE_NAME_MAX + 1), [])).toMatch(/tối đa/)
  })
  it('chặn trùng tên không phân biệt hoa/thường và khoảng trắng thừa', () => {
    expect(validateHouseName('  nhà CHÍNH ', ['Nhà chính'])).toMatch(/đã có nhà/)
  })
  it('cho qua tên hợp lệ', () => {
    expect(validateHouseName('Nhà phụ', ['Nhà chính'])).toBeUndefined()
  })
})

describe('validateRoomName', () => {
  it('chặn trùng tên phòng trong cùng nhà, thông báo nói về phòng', () => {
    expect(validateRoomName('phòng 1', ['Phòng 1'])).toMatch(/Nhà này đã có phòng/)
  })
})

describe('validateHouseFloors', () => {
  it('chặn rỗng, 0, số lẻ, vượt trần; cho qua số nguyên hợp lệ', () => {
    expect(validateHouseFloors('')).toMatch(/Chưa nhập/)
    expect(validateHouseFloors('0')).toMatch(/từ 1/)
    expect(validateHouseFloors('2.5')).toMatch(/số nguyên/)
    expect(validateHouseFloors(String(HOUSE_FLOORS_MAX + 1))).toMatch(/tối đa/)
    expect(validateHouseFloors('3')).toBeUndefined()
  })
})
