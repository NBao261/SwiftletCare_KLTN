import { useUsersPicker } from '@/hooks/admin/useUsers'
import { AUDIT_ACTION_LABEL, USER_AUDIT_ACTIONS } from '@/constants/auditActions'
import { ROLE_LABEL } from '@/constants/roles'
import { t } from '@/i18n'
import { ClearFiltersButton, SearchInput } from '@/components/ui'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import { ALL, DATE_PRESETS, type AuditLogTableState } from '@/components/features/admin/audit-log/useAuditLogTable'

const DATE_OPTIONS: SelectMenuOption<string>[] = [
  { value: ALL, label: 'Tất cả thời gian' },
  ...DATE_PRESETS.map(({ value, label }) => ({ value, label })),
]

// Tìm kiếm và bộ lọc của bảng nhật ký, một hàng; sắp xếp bấm ở tiêu đề cột Thời gian
export default function AuditLogFilters({ table }: { table: AuditLogTableState }) {
  const actors = useUsersPicker()
  // Dựng mỗi lần render: dựng ở cấp module thì nhãn đóng băng theo ngôn ngữ lúc import
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1 sm:max-w-sm">
          <SearchInput
            placeholder="Tìm theo hành động, tên tài khoản..."
            aria-label="Tìm nhật ký"
            value={table.search}
            // Tìm trên toàn bộ nhật ký → gõ từ khoá thì về trang 1
            onChange={table.setSearch}
          />
        </div>
        <SelectMenu ariaLabel="Lọc theo người thực hiện" value={table.actorId} options={actorOptions} onChange={table.setActorId} className="max-w-[16rem]" />
        <SelectMenu ariaLabel="Lọc theo hành động" value={table.action} options={actionOptions} onChange={table.setAction} className="max-w-[16rem]" />
        <SelectMenu ariaLabel="Lọc theo khoảng thời gian" value={table.datePreset} options={DATE_OPTIONS} onChange={table.setDatePreset} className="max-w-[16rem]" />
        {table.hasFilter && <ClearFiltersButton onClick={table.clearFilters} />}
      </div>
      {actors.truncated && (
        <p className="text-xs text-warmGray">
          {t('Danh sách chỉ hiện {{shown}} trong {{total}} tài khoản đầu tiên.', { shown: actors.records.length, total: actors.total })}
        </p>
      )}
    </div>
  )
}
