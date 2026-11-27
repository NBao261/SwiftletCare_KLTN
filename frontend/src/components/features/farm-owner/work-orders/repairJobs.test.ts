import { describe, expect, it } from 'vitest'

import { REPAIR_JOB_CAUSES, REPAIR_JOB_TITLE, repairJobTitle } from '@/components/features/farm-owner/work-orders/repairJobs'
import { workOrderDict } from '@/constants/workOrders.i18n'

describe('chọn việc cần làm của phiếu công việc', () => {
  it('chọn một việc có sẵn thì tiêu đề là câu của việc đó, không cần nhập', () => {
    expect(repairJobTitle('PUMP', '')).toBe('Kiểm tra và sửa bơm phun sương')
    expect(repairJobTitle('PUMP', 'bỏ qua chữ nhập tay')).toBe('Kiểm tra và sửa bơm phun sương')
  })

  it('chưa chọn thì không có tiêu đề; "Việc khác" lấy chữ tự nhập đã cắt khoảng trắng', () => {
    expect(repairJobTitle('', 'abc')).toBe('')
    expect(repairJobTitle('OTHER', '')).toBe('')
    expect(repairJobTitle('OTHER', '  Thay bóng đèn  ')).toBe('Thay bóng đèn')
  })

  it('mỗi nhóm trong dropdown có đúng một tiêu đề, trong giới hạn 200 ký tự của API', () => {
    expect(Object.keys(REPAIR_JOB_TITLE).sort()).toEqual([...REPAIR_JOB_CAUSES].sort())
    for (const title of Object.values(REPAIR_JOB_TITLE)) expect(title.length).toBeLessThanOrEqual(200)
  })

  // Nhãn dropdown (bản tiếng Việt) và tiêu đề lưu vào phiếu nằm ở hai nơi: lệch nhau thì người tạo chọn một câu mà phiếu ghi câu khác
  it('nhãn tiếng Việt của dropdown trùng tiêu đề lưu vào phiếu', () => {
    for (const cause of REPAIR_JOB_CAUSES) expect(workOrderDict.vi[`create.job.${cause}`]).toBe(REPAIR_JOB_TITLE[cause])
  })
})
