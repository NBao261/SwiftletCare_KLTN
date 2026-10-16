import { useUsersPicker } from '@/hooks/admin/useUsers'
import { AUDIT_ACTION_LABEL, USER_AUDIT_ACTIONS } from '@/constants/auditActions'
import { ROLE_LABEL } from '@/constants/roles'
import { t } from '@/i18n'
import { ClearFiltersButton, SortChips } from '@/components/ui'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import { ALL, DATE_PRESETS, type AuditLogTableState } from '@/components/features/admin/audit-log/useAuditLogTable'

const DATE_OPTIONS: SelectMenuOption<string>[] = [
  { value: ALL, label: 'Tất cả thời gian' },
  ...DATE_PRESETS.map(({ value, label }) => ({ value, label })),
]

/**
 * Hàng bộ lọc (người thực hiện / hành động / thời gian) + sắp xếp theo thời gian + xoá bộ lọc của bảng nhật ký —
 * cùng 1 thanh ở trang Nhật ký hệ thống và card "Nhật ký hoạt động gần đây".
 */
export default function AuditLogFilters({ table }: { table: AuditLogTableState }) {
  const actors = useUsersPicker()
  // Dựng mỗi lần render (không phải hằng cấp module): AUDIT_ACTION_LABEL dịch lúc ĐỌC, dựng 1 lần lúc nạp module thì
  // nhãn bị đóng băng theo ngôn ngữ lúc import — đổi VI/EN không đổi theo
  const actionOptions: SelectMenuOption<string>[] = [
    { value: ALL, label: 'Tất cả hành động' },
    ...USER_AUDIT_ACTIONS.map(value => ({ value, label: AUDIT_ACTION_LABEL[value] ?? value })),
  ]
  const actorOptions: SelectMenuOption<string>[] = [
    { value: ALL, label: 'Tất cả người thực hiện' },
    ...actors.records.map(u => ({ value: u._id, label: `${u.full_name} · ${ROLE_LABEL[u.role]}` })),
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SelectMenu ariaLabel="Lọc theo người thực hiện" value={table.actorId} options={actorOptions} onChange={table.setActorId} className="max-w-[16rem]" />
        <SelectMenu ariaLabel="Lọc theo hành động" value={table.action} options={actionOptions} onChange={table.setAction} className="max-w-[16rem]" />
        <span className="label-caption">{t('Thời gian:')}</span>
        <SelectMenu ariaLabel="Lọc theo khoảng thời gian" value={table.datePreset} options={DATE_OPTIONS} onChange={table.setDatePreset} className="max-w-[16rem]" />
        {/* 1 trường duy nhất, luôn đang chọn — bấm chỉ đảo chiều mới nhất/cũ nhất */}
        <SortChips fields={[{ key: 'time', label: 'Thời gian' }]} sortBy="time" sortDir={table.sortDir} onChange={table.toggleSort} />
        {table.hasFilter && <ClearFiltersButton onClick={table.clearFilters} />}
      </div>
      {actors.truncated && (
        <p className="text-xs text-warmGray">
          {t('Ô "người thực hiện" chỉ liệt kê {{shown}}/{{total}} tài khoản đầu tiên (giới hạn 1 trang của /admin/users).', { shown: actors.records.length, total: actors.total })}
        </p>
      )}
    </div>
  )
}
