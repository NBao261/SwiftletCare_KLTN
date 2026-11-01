import { describe, expect, it } from '@jest/globals'
import { sortByCreationOrder } from '@/utils/sort.utils'

describe('sortByCreationOrder', () => {
  it('mã ObjectId nhỏ hơn (tạo trước) đứng đầu, không đổi mảng gốc', () => {
    const items = [{ _id: '6adb72d7d763c8a35e475a6b' }, { _id: '6aaab8e74f820fe52febb5ad' }, { _id: '6ab0000000000000000000aa' }]
    expect(sortByCreationOrder(items).map(item => item._id)).toEqual([
      '6aaab8e74f820fe52febb5ad',
      '6ab0000000000000000000aa',
      '6adb72d7d763c8a35e475a6b',
    ])
    expect(items[0]._id).toBe('6adb72d7d763c8a35e475a6b')
  })
})
