import type { SiteCause } from '@/types'

// Việc sửa chữa hay gặp, theo các nhóm nguyên nhân kỹ thuật viên ghi tại chỗ (ALERT-FR-018); xếp việc hay gặp lên đầu
export const REPAIR_JOB_CAUSES = ['NOZZLE', 'PUMP', 'FAN', 'SENSOR', 'SPEAKER', 'WATER', 'DOOR'] as const satisfies readonly SiteCause[]
export type RepairJobCause = (typeof REPAIR_JOB_CAUSES)[number]

// Tiêu đề lưu vào phiếu và kỹ thuật viên đọc: luôn tiếng Việt, không đổi theo ngôn ngữ giao diện của người tạo
export const REPAIR_JOB_TITLE: Record<RepairJobCause, string> = {
  NOZZLE: 'Kiểm tra và sửa béc phun',
  PUMP: 'Kiểm tra và sửa bơm phun sương',
  FAN: 'Kiểm tra và sửa quạt thông gió',
  SENSOR: 'Kiểm tra và sửa cảm biến',
  SPEAKER: 'Kiểm tra và sửa loa dẫn dụ',
  WATER: 'Kiểm tra nước và đường ống',
  DOOR: 'Kiểm tra cửa ra vào',
}

// '' = chưa chọn; OTHER = việc khác, người tạo tự nhập
export type RepairJobChoice = RepairJobCause | 'OTHER' | ''

// Tiêu đề phiếu từ lựa chọn trong dropdown; rỗng khi chưa chọn hoặc "Việc khác" chưa nhập
export function repairJobTitle(choice: RepairJobChoice, otherTitle: string): string {
  if (choice === '') return ''
  if (choice === 'OTHER') return otherTitle.trim()
  return REPAIR_JOB_TITLE[choice]
}
