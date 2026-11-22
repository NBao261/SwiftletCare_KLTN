import type { Dictionary } from '@/lib/i18n'

// Từ điển màn Kết luận mùa vụ của Domain Expert
const vi = {
  // Tab
  'tab.label': 'Kết luận mùa vụ',

  // Tiêu đề & mô tả
  'section.title': 'Chu kỳ thu hoạch',
  'section.subtitle': 'Viết kết luận cho các chu kỳ đã đóng',
  'section.noScope': 'Chọn trang trại hoặc nhà yến để xem chu kỳ thu hoạch',

  // Bộ lọc
  'filter.status': 'Trạng thái chu kỳ',
  'filter.all': 'Tất cả',

  // Cột bảng
  'col.period': 'Thời gian',
  'col.yield': 'Sản lượng',
  'col.comparison': 'So với trước',
  'col.status': 'Trạng thái',
  'col.conclusion': 'Kết luận',
  'col.actions': 'Thao tác',

  // Nhãn ô bảng
  'cell.nests': '{n} tổ',
  'cell.kg': '{kg} kg',
  'cell.yieldSummary': '{n} tổ · {kg} kg',
  'cell.period': '{from} – {to}',
  'cell.periodOpen': 'Từ {from}',
  'cell.change': '{sign}{pct}%',
  'cell.noComparison': '—',
  'cell.hasConclusion': 'Đã kết luận',
  'cell.noConclusion': 'Chưa có',
  'cell.incomplete': 'Thiếu dữ liệu',

  // Trạng thái badge
  'status.OPEN': 'Đang mở',
  'status.CLOSED': 'Đã đóng',
  'status.CONCLUDED': 'Đã kết luận',

  // Nút thao tác
  'action.write': 'Viết kết luận',
  'action.edit': 'Xem / Sửa',

  // Empty state
  'empty.title': 'Chưa có chu kỳ thu hoạch',
  'empty.desc': 'Các chu kỳ sẽ được tạo tự động khi lô thu hoạch được xác nhận.',
  'empty.filteredTitle': 'Không có chu kỳ nào khớp bộ lọc',
  'empty.filteredDesc': 'Thử chọn trạng thái khác hoặc bỏ bộ lọc.',
  'error.title': 'Không tải được chu kỳ thu hoạch',
  'error.retry': 'Thử lại',

  // Drawer: tiêu đề
  'drawer.title': 'Kết luận mùa vụ',
  'drawer.titleEdit': 'Sửa kết luận mùa vụ',
  'drawer.subtitle': '{from} – {to}',
  'drawer.subtitleOpen': 'Từ {from}',

  // Drawer: thông tin chu kỳ
  'drawer.yieldLabel': 'Sản lượng thu hoạch',
  'drawer.yieldValue': '{n} tổ · {kg} kg ({date})',
  'drawer.yieldNone': 'Chưa có thông tin sản lượng',
  'drawer.compLabel': 'So sánh',
  'drawer.compPrev': 'Chu kỳ trước',
  'drawer.compSameYear': 'Cùng kỳ năm ngoái',
  'drawer.compNoData': 'Không có chu kỳ để so sánh',
  'drawer.healthLabel': 'Chỉ số sức khoẻ',
  'drawer.healthGoodDays': '% ngày tốt',
  'drawer.healthReturnRate': 'Tỷ lệ chim về TB',
  'drawer.healthTimeInRange': 'Thời gian trong ngưỡng',
  'drawer.healthNone': 'Chưa có dữ liệu sức khoẻ',
  'drawer.incomplete': 'Chu kỳ thiếu dữ liệu (<80% ngày được đánh giá)',
  'drawer.openWarning': 'Chu kỳ đang mở, chưa thể viết kết luận',

  // Drawer: form kết luận
  'drawer.existingTitle': 'Kết luận hiện tại',
  'drawer.existingBy': 'Viết bởi {role} · {date}',
  'drawer.roleExpert': 'Chuyên gia',
  'drawer.roleOwner': 'Chủ nhà yến',
  'drawer.formTitle': 'Nhận xét & Khuyến nghị',
  'drawer.textLabel': 'Nhận xét tổng quát mùa vụ *',
  'drawer.textPlaceholder': 'Nhận xét tổng quát mùa vụ...',
  'drawer.textHint': '{count}/2000 ký tự',
  'drawer.recsLabel': 'Khuyến nghị cho mùa sau (tuỳ chọn)',
  'drawer.recsPlaceholder': 'Khuyến nghị cho mùa sau (tuỳ chọn)...',
  'drawer.recsHint': '{count}/2000 ký tự',

  // Drawer: footer
  'drawer.cancel': 'Huỷ',
  'drawer.save': 'Lưu kết luận',
  'drawer.saving': 'Đang lưu...',
  'drawer.saveSuccess': 'Đã lưu kết luận mùa vụ',
  'drawer.saveError': 'Không lưu được kết luận',
}

export type HarvestCyclesKey = keyof typeof vi

const en: Record<HarvestCyclesKey, string> = {
  'tab.label': 'Season conclusions',

  'section.title': 'Harvest cycles',
  'section.subtitle': 'Write conclusions for closed harvest cycles (EXPERT-FR-020)',
  'section.noScope': 'Select a farm or house to view harvest cycles',

  'filter.status': 'Cycle status',
  'filter.all': 'All',

  'col.period': 'Period',
  'col.yield': 'Yield',
  'col.comparison': 'vs. previous',
  'col.status': 'Status',
  'col.conclusion': 'Conclusion',
  'col.actions': 'Actions',

  'cell.nests': '{n} nests',
  'cell.kg': '{kg} kg',
  'cell.yieldSummary': '{n} nests · {kg} kg',
  'cell.period': '{from} – {to}',
  'cell.periodOpen': 'Since {from}',
  'cell.change': '{sign}{pct}%',
  'cell.noComparison': '—',
  'cell.hasConclusion': 'Concluded',
  'cell.noConclusion': 'None',
  'cell.incomplete': 'Incomplete data',

  'status.OPEN': 'Open',
  'status.CLOSED': 'Closed',
  'status.CONCLUDED': 'Concluded',

  'action.write': 'Write conclusion',
  'action.edit': 'View / Edit',

  'empty.title': 'No harvest cycles yet',
  'empty.desc': 'Cycles are created automatically when a harvest batch is confirmed.',
  'empty.filteredTitle': 'No cycles match the filter',
  'empty.filteredDesc': 'Try a different status filter.',
  'error.title': 'Could not load the harvest cycles',
  'error.retry': 'Retry',

  'drawer.title': 'Season conclusion',
  'drawer.titleEdit': 'Edit season conclusion',
  'drawer.subtitle': '{from} – {to}',
  'drawer.subtitleOpen': 'Since {from}',

  'drawer.yieldLabel': 'Closing harvest yield',
  'drawer.yieldValue': '{n} nests · {kg} kg ({date})',
  'drawer.yieldNone': 'No yield data',
  'drawer.compLabel': 'Comparison',
  'drawer.compPrev': 'Previous cycle',
  'drawer.compSameYear': 'Same period last year',
  'drawer.compNoData': 'No cycle to compare',
  'drawer.healthLabel': 'Health indicators',
  'drawer.healthGoodDays': '% good days',
  'drawer.healthReturnRate': 'Avg return rate',
  'drawer.healthTimeInRange': 'Time in range',
  'drawer.healthNone': 'No health data',
  'drawer.incomplete': 'Incomplete cycle (<80% of days rated)',
  'drawer.openWarning': 'Cycle still open — cannot write conclusion yet',

  'drawer.existingTitle': 'Current conclusion',
  'drawer.existingBy': 'Written by {role} · {date}',
  'drawer.roleExpert': 'Domain Expert',
  'drawer.roleOwner': 'Farm Owner',
  'drawer.formTitle': 'Review & Recommendations',
  'drawer.textLabel': 'Overall season review *',
  'drawer.textPlaceholder': 'Overall season review...',
  'drawer.textHint': '{count}/2000 characters',
  'drawer.recsLabel': 'Recommendations for next season (optional)',
  'drawer.recsPlaceholder': 'Recommendations for next season (optional)...',
  'drawer.recsHint': '{count}/2000 characters',

  'drawer.cancel': 'Cancel',
  'drawer.save': 'Save conclusion',
  'drawer.saving': 'Saving...',
  'drawer.saveSuccess': 'Season conclusion saved',
  'drawer.saveError': 'Could not save conclusion',
}

export const harvestCyclesDict: Dictionary<HarvestCyclesKey> = { vi, en }
