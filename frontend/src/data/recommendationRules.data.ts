// EXPERT-FR-016…019 — dữ liệu mẫu cho luật khuyến nghị (mock đến khi backend G-24 sẵn)
// Nguồn: todo-final-scope.md §G-24; ít nhất 3 luật thật phải thay thế sau khi phỏng vấn chuyên gia.
import type { RecommendationRule, RecommendationEffect } from '@/types/expert.types'

export const MOCK_RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    _id: 'mock-rule-1',
    name: 'Tỷ lệ về thấp — Kiểm tra béc phun',
    metric: 'return_rate',
    window_days: 7,
    threshold: 60,
    action_type: 'WORK_ORDER',
    work_order_type: 'INSPECTION',
    active: true,
  },
  {
    _id: 'mock-rule-2',
    name: 'Tỷ lệ ngày GOOD thấp — Rà tham số phát hiện',
    metric: 'health_status_good_rate',
    window_days: 14,
    threshold: 50,
    action_type: 'PARAM_CHANGE',
    param_key: 'noise_margin_db',
    active: true,
  },
  {
    _id: 'mock-rule-3',
    name: 'Độ ẩm trong ngưỡng thấp — Bảo dưỡng bơm',
    metric: 'humidity_in_range',
    window_days: 7,
    threshold: 70,
    action_type: 'WORK_ORDER',
    work_order_type: 'MAINTENANCE',
    active: false,
  },
]

export const MOCK_RECOMMENDATION_EFFECTS: RecommendationEffect[] = [
  {
    rule_id: 'mock-rule-1',
    rule_name: 'Tỷ lệ về thấp — Kiểm tra béc phun',
    total_generated: 4,
    total_accepted: 3,
    total_improved: 2,
  },
  {
    rule_id: 'mock-rule-2',
    rule_name: 'Tỷ lệ ngày GOOD thấp — Rà tham số phát hiện',
    total_generated: 2,
    total_accepted: 1,
    total_improved: 1,
  },
  {
    rule_id: 'mock-rule-3',
    rule_name: 'Độ ẩm trong ngưỡng thấp — Bảo dưỡng bơm',
    total_generated: 1,
    total_accepted: 0,
    total_improved: 0,
  },
]
