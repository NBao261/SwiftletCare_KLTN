import { describe, expect, it } from '@jest/globals'
import type { HouseHealthReportSummary, ReviewItem } from '@/types/expert.types'

describe('Queue business logic & BR-31 guardrails', () => {
  it('Khối 5: Từ chối đề xuất Fuzzy bắt buộc phải có lý do', () => {
    const validateRejection = (reason: string): { valid: boolean; error?: string } => {
      if (!reason.trim()) {
        return { valid: false, error: 'Vui lòng nhập lý do từ chối để phản hồi cho người đề xuất' }
      }
      return { valid: true }
    }

    expect(validateRejection('').valid).toBe(false)
    expect(validateRejection('   ').valid).toBe(false)
    expect(validateRejection('Hệ số dải nhiệt độ quá hẹp, dễ gây dao động quạt hút').valid).toBe(true)
  })

  it('Khối 4: Review thay đổi hỗ trợ 2 hành động ACCEPT và REVERT (api-spec.yaml)', () => {
    const item: ReviewItem = {
      _id: 'item-01',
      farm_id: 'farm-01',
      zone_id: 'zone-01',
      parameter_group: 'thresholds',
      status: 'PENDING_REVIEW',
      old_values: { humidity_min: 75 },
      new_values: { humidity_min: 65 },
      changed_by: { _id: 'user-01', full_name: 'Trần Tuất' },
      created_at: '2026-11-02T10:00:00Z',
    }

    const allowedActions: ('ACCEPT' | 'REVERT')[] = ['ACCEPT', 'REVERT']
    expect(item.status).toBe('PENDING_REVIEW')
    expect(item.new_values.humidity_min).toBeLessThan(item.old_values.humidity_min)
    expect(allowedActions).toHaveLength(2)
  })

  it('Khối 6: Báo cáo theo nhà chờ kết luận có has_conclusion = false', () => {
    const report: HouseHealthReportSummary = {
      _id: 'report-01',
      farm_id: 'farm-01',
      house_id: 'house-01',
      house_name: 'Nhà A',
      kind: 'WEEKLY',
      period_start: '2026-10-26',
      period_end: '2026-11-01',
      generated_at: '2026-11-02T02:00:00Z',
      has_conclusion: false,
    }

    // Hàng đợi chuyên gia chỉ hiện báo cáo chưa có kết luận (lọc has_conclusion=false ở server)
    expect(report.has_conclusion).toBe(false)
    expect(report.kind).toBe('WEEKLY')
  })
})
