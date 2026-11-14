import { alertStatusDict, alertTypeDict, prefixLabels, siteCauseDict } from '@/constants/enumLabels.i18n';
import { levelDict } from '@/constants/severity.i18n';
import type { Dictionary } from '@/lib/i18n';

// Từ điển trang Thông báo của Farm Owner (/alerts) — ALERT-FR-007, 009, 018
const vi = {
  'page.noFarmTitle': 'Chưa có trang trại',
  'page.noFarmDesc': 'Tạo trang trại và nhà yến ở trang Trang trại trước.',
  'page.goFarms': 'Đi tới Trang trại',
  'page.retry': 'Thử lại',
  'page.loadFailed': 'Không tải được danh sách trang trại',

  'list.title': 'Cảnh báo',
  'list.subtitle': 'Cảnh báo môi trường, thiết bị và đàn chim của các nhà yến. Bạn xác nhận cảnh báo mới và ghi nguyên nhân khi đã kiểm tra tại nhà.',
  'list.subtitleTechnician': 'Cảnh báo của các nhà bạn được giao. Bạn xác nhận cảnh báo mới và ghi nguyên nhân tìm thấy tại chỗ.',
  'list.subtitleAdmin': 'Cảnh báo thiết bị của mọi trang trại: mất kết nối, cảm biến lỗi, khởi động lại bất thường. Chủ nhà yến và kỹ thuật viên xác nhận.',
  'list.filterStatus': 'Lọc trạng thái',
  'filter.all': 'Mọi trạng thái',
  'list.filterLevel': 'Lọc mức độ',
  'filter.allLevels': 'Mọi mức độ',
  'list.errorTitle': 'Không tải được cảnh báo',
  'list.emptyTitle': 'Không có cảnh báo nào',
  'list.emptyHint': 'Khi môi trường vượt ngưỡng, thiết bị lỗi hoặc mất kết nối, cảnh báo hiện ở đây.',

  'col.index': 'STT',
  'col.level': 'Mức',
  'col.alert': 'Cảnh báo',
  'col.location': 'Vị trí',
  'col.device': 'Thiết bị',
  'col.status': 'Trạng thái',
  'col.createdAt': 'Lúc',
  'col.actions': 'Thao tác',
  'cell.wholeHouse': 'Cả nhà yến',

  'action.view': 'Xem chi tiết',
  'action.acknowledge': 'Xác nhận',

  // Ngăn chi tiết
  'detail.title': 'Chi tiết cảnh báo',
  'detail.loadFailed': 'Không tải được cảnh báo',
  'detail.level': 'Mức',
  'detail.status': 'Trạng thái',
  'detail.createdAt': 'Tạo lúc',
  'detail.location': 'Vị trí',
  'detail.device': 'Thiết bị',
  'detail.content': 'Nội dung',
  'detail.cause': 'Nguyên nhân tại chỗ',
  'detail.causeAt': 'Ghi lúc {time}',
  'detail.acknowledgement': 'Tiếp nhận',
  'detail.acknowledgedAt': 'Xác nhận lúc {time}',
  'detail.note': 'Ghi chú: {note}',
  'detail.dismissed': 'Bác bỏ',
  'detail.dismissedBy': 'Chuyên gia bác bỏ lúc {time}',
  'detail.dismissedByOwner': 'Chủ nhà yến bác bỏ lúc {time}',
  'detail.reason': 'Lý do: {note}',

  // Popup xác nhận (ALERT-FR-009, 018)
  'ack.title': 'Xác nhận cảnh báo',
  'ack.cause': 'Nguyên nhân tìm thấy tại chỗ',
  'ack.causeHint': 'Không bắt buộc. Chọn nếu bạn đã kiểm tra tại nhà; bấm lại để bỏ chọn.',
  'ack.note': 'Ghi chú',
  'ack.notePlaceholder': 'VD: Báo động giả, đã kiểm tra tại chỗ...',
  'ack.cancel': 'Huỷ',
  'ack.submit': 'Xác nhận',
  'ack.done': 'Đã xác nhận cảnh báo',

  ...prefixLabels('type.', alertTypeDict.vi),
  ...prefixLabels('status.', alertStatusDict.vi),
  ...prefixLabels('cause.', siteCauseDict.vi),
  ...prefixLabels('level.', levelDict.vi),
};

export type AlertsKey = keyof typeof vi;

const en: Record<AlertsKey, string> = {
  'page.noFarmTitle': 'No farm yet',
  'page.noFarmDesc': 'Create a farm and a swiftlet house on the Farms page first.',
  'page.goFarms': 'Go to Farms',
  'page.retry': 'Retry',
  'page.loadFailed': 'Could not load the farm list',

  'list.title': 'Alerts',
  'list.subtitle': 'Environment, device and flock alerts of your swiftlet houses. Acknowledge new alerts and record the cause once you have checked at the house.',
  'list.subtitleTechnician': 'Alerts of the houses assigned to you. Acknowledge new alerts and record the cause you find on site.',
  'list.subtitleAdmin': 'Device alerts of every farm: offline devices, sensor faults, unexpected restarts. Farm owners and technicians acknowledge them.',
  'list.filterStatus': 'Filter by status',
  'filter.all': 'All statuses',
  'list.filterLevel': 'Filter by level',
  'filter.allLevels': 'All levels',
  'list.errorTitle': 'Could not load the alerts',
  'list.emptyTitle': 'No alerts',
  'list.emptyHint': 'Alerts show here when the environment leaves its range or a device fails or goes offline.',

  'col.index': 'No.',
  'col.level': 'Level',
  'col.alert': 'Alert',
  'col.location': 'Location',
  'col.device': 'Device',
  'col.status': 'Status',
  'col.createdAt': 'Time',
  'col.actions': 'Actions',
  'cell.wholeHouse': 'Whole house',

  'action.view': 'View details',
  'action.acknowledge': 'Acknowledge',

  'detail.title': 'Alert details',
  'detail.loadFailed': 'Could not load the alert',
  'detail.level': 'Level',
  'detail.status': 'Status',
  'detail.createdAt': 'Created at',
  'detail.location': 'Location',
  'detail.device': 'Device',
  'detail.content': 'Content',
  'detail.cause': 'Cause found on site',
  'detail.causeAt': 'Recorded at {time}',
  'detail.acknowledgement': 'Acknowledgement',
  'detail.acknowledgedAt': 'Acknowledged at {time}',
  'detail.note': 'Note: {note}',
  'detail.dismissed': 'Dismissed',
  'detail.dismissedBy': 'Dismissed by the expert at {time}',
  'detail.dismissedByOwner': 'Dismissed by the farm owner at {time}',
  'detail.reason': 'Reason: {note}',

  'ack.title': 'Acknowledge alert',
  'ack.cause': 'Cause found on site',
  'ack.causeHint': 'Optional. Choose it if you checked at the house; click again to clear.',
  'ack.note': 'Note',
  'ack.notePlaceholder': 'E.g. False alarm, checked on site...',
  'ack.cancel': 'Cancel',
  'ack.submit': 'Acknowledge',
  'ack.done': 'Alert acknowledged',

  ...prefixLabels('type.', alertTypeDict.en),
  ...prefixLabels('status.', alertStatusDict.en),
  ...prefixLabels('cause.', siteCauseDict.en),
  ...prefixLabels('level.', levelDict.en),
};

export const alertsDict: Dictionary<AlertsKey> = { vi, en };
