// ADMIN — Kho thiết bị (FARM-FR-010, Report 3 §6.16). Thêm thiết bị → in nhãn QR (device ID + mã kích hoạt) và chép
// mật khẩu broker để flash, cả hai chỉ hiện 1 lần. Cấp lại mã kích hoạt / thu hồi khi thiết bị không đang dùng ở farm;
// cấp lại mật khẩu broker khi chưa thu hồi. Thiết bị đang chạy xem ở /devices.
// Cùng khuôn trang Người dùng: tìm kiếm + nút thêm → bộ lọc + sắp xếp → bảng → phân trang (client-side, xem useDeviceStock).
import { useMemo, useState } from 'react'
import { PlusIcon, WarningCircleIcon } from '@phosphor-icons/react'
import {
  Badge, Button, ClearFiltersButton, ConfirmModal, DataTable, EmptyState, NoteActionModal, Pagination, SearchInput,
  SectionCard, SelectMenu, SortChips,
} from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import SimulatedBadge from '@/components/common/SimulatedBadge'
import { formatDateOnly } from '@/lib/helpers'
import { STOCK_STATUS, buildStockColumns, type StockAction } from '@/components/features/admin/device-stock/stockColumns'
import AddStockDeviceModal from '@/components/features/admin/device-stock/AddStockDeviceModal'
import IssuedSecretsModal from '@/components/features/admin/device-stock/IssuedSecretsModal'
import {
  useDeviceStock, useRevokeStockDevice, useRotateBrokerSecret, useRotateStockKey,
} from '@/hooks/admin/useDeviceStock'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import type { IssuedDeviceSecrets, ProvisionedDevice, ProvisionedDeviceKind, SortDirection, StockStatus } from '@/types'

const PAGE_SIZE = 10
const ROW_HEIGHT = 56

const KIND_OPTIONS: { value: ProvisionedDeviceKind | ''; label: string }[] = [
  { value: '', label: 'Tất cả loại' },
  { value: 'SENSOR', label: 'Bộ điều khiển' },
  { value: 'CAMERA', label: 'Camera đếm chim' },
]
const STATUS_OPTIONS: { value: StockStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái nhãn' },
  ...(Object.keys(STOCK_STATUS) as StockStatus[]).map(s => ({ value: s, label: STOCK_STATUS[s].label })),
]

type StockSortKey = 'device_id' | 'created_at'
const SORT_FIELDS: { key: StockSortKey; label: string }[] = [
  { key: 'device_id', label: 'Thiết bị' },
  { key: 'created_at', label: 'Ngày nhập' },
]
const DEFAULT_SORT_BY: StockSortKey = 'created_at'
const DEFAULT_SORT_DIR: SortDirection = 'desc'

const ROTATE_TEXT = {
  'rotate-key': {
    title: 'Cấp lại mã kích hoạt cho {{id}}?',
    description: 'Nhãn cũ bị từ chối ngay khi cấp. In nhãn mới và dán đè lên nhãn cũ.',
  },
  'rotate-broker': {
    title: 'Cấp lại mật khẩu kết nối cho {{id}}?',
    description: 'Mật khẩu cũ hết hiệu lực. Thiết bị chỉ kết nối lại được sau khi nạp mật khẩu mới.',
  },
} as const

export default function AdminDeviceStockPage() {
  const { data, isLoading, isError, refetch } = useDeviceStock()
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<ProvisionedDeviceKind | ''>('')
  const [status, setStatus] = useState<StockStatus | ''>('')
  const [sortBy, setSortBy] = useState<StockSortKey>(DEFAULT_SORT_BY)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR)
  const [page, setPage] = useState(1)

  const [adding, setAdding] = useState(false)
  const [issued, setIssued] = useState<IssuedDeviceSecrets | null>(null)
  const [pending, setPending] = useState<{ action: StockAction; device: ProvisionedDevice } | null>(null)

  const rotateKey = useRotateStockKey()
  const rotateBroker = useRotateBrokerSecret()
  const revoke = useRevokeStockDevice()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const dir = sortDir === 'asc' ? 1 : -1
    return (data ?? [])
      .filter(d => (!kind || d.kind === kind) && (!status || d.stock_status === status))
      .filter(d => !q || d.device_id.toLowerCase().includes(q))
      .sort((a, b) => (sortBy === 'device_id'
        ? a.device_id.localeCompare(b.device_id, undefined, { numeric: true })
        : a.created_at.localeCompare(b.created_at)) * dir)
  }, [data, search, kind, status, sortBy, sortDir])
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /** Đổi bộ lọc/tìm kiếm thì về trang 1 */
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1) }
  }

  function handleSortChange(key: StockSortKey) {
    if (key === sortBy) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir(key === 'created_at' ? 'desc' : 'asc') }
    setPage(1)
  }

  const hasActiveFilters = !!(search || kind || status) || sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR
  function clearFilters() {
    setSearch(''); setKind(''); setStatus(''); setSortBy(DEFAULT_SORT_BY); setSortDir(DEFAULT_SORT_DIR); setPage(1)
  }

  const onError = (err: unknown) => push(apiErrorMessage(err, t('Thao tác thất bại')), 'error')
  const showIssued = (result: IssuedDeviceSecrets) => { setPending(null); setIssued(result) }

  function confirmRotate() {
    if (!pending) return
    const mutation = pending.action === 'rotate-key' ? rotateKey : rotateBroker
    mutation.mutate(pending.device._id, { onSuccess: showIssued, onError })
  }

  function submitRevoke(reason: string) {
    if (!pending) return
    revoke.mutate({ id: pending.device._id, reason }, {
      onSuccess: () => { push(t('Đã thu hồi {{id}}', { id: pending.device.device_id })); setPending(null) },
      onError,
    })
  }

  if (isLoading) return <LoadingSkeleton count={5} className="h-14 w-full" />
  if (isError || !data) {
    return (
      <EmptyState
        icon={<WarningCircleIcon size={32} />}
        title="Không tải được kho thiết bị"
        description="Kiểm tra kết nối tới máy chủ rồi thử lại."
        action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Thử lại</Button>}
      />
    )
  }

  const rotateText = pending && pending.action !== 'revoke' ? ROTATE_TEXT[pending.action] : null
  const columns = buildStockColumns((action, device) => setPending({ action, device }))

  return (
    <div className="flex flex-col gap-5">
      <SectionCard description="Thiết bị đã nhập và nhãn QR" help="In nhãn QR ngay khi thêm: mã kích hoạt và mật khẩu kết nối chỉ hiện một lần.">
        {/* Hàng 1: tìm kiếm + thêm thiết bị */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput placeholder="Tìm mã thiết bị..." value={search} onChange={withReset(setSearch)} />
          </div>
          <Button onClick={() => setAdding(true)}><PlusIcon size={14} weight="bold" aria-hidden />Thêm thiết bị</Button>
        </div>

        {/* Hàng 2: bộ lọc + sắp xếp */}
        <div className="flex flex-wrap items-center gap-3">
          <SelectMenu ariaLabel="Lọc theo loại thiết bị" value={kind} options={KIND_OPTIONS} onChange={withReset(setKind)} />
          <SelectMenu ariaLabel="Lọc theo trạng thái nhãn" value={status} options={STATUS_OPTIONS} onChange={withReset(setStatus)} />
          <SortChips fields={SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={handleSortChange} />
          {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={d => d._id}
          rowHeight={ROW_HEIGHT}
          minRows={filtered.length > PAGE_SIZE ? PAGE_SIZE : 0}
          emptyMessage={hasActiveFilters
            ? 'Không có thiết bị nào khớp bộ lọc. Thử đổi bộ lọc hoặc từ khoá tìm kiếm.'
            : 'Kho chưa có thiết bị nào, bấm "Thêm thiết bị" để nhập và in nhãn.'}
          mobileCard={device => (
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex min-w-0 items-center gap-2 text-body font-semibold text-charcoal">
                  <span className="truncate">{device.device_id}</span>
                  <SimulatedBadge simulated={device.simulated} />
                </p>
                <p className="text-small text-warmGray">
                  {t(device.kind === 'SENSOR' ? 'Bộ điều khiển' : 'Camera đếm chim')} · {t('Nhập {{date}}', { date: formatDateOnly(device.created_at) })}
                </p>
                <div><Badge tone={STOCK_STATUS[device.stock_status].tone}>{STOCK_STATUS[device.stock_status].label}</Badge></div>
              </div>
              {/* Menu ⋯ dùng chung với cột Thao tác */}
              {columns[columns.length - 1].render(device, 0)}
            </div>
          )}
        />

        {/* total = số thiết bị SAU khi lọc + tìm kiếm */}
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onChange={setPage} variant="full" />
      </SectionCard>

      <AddStockDeviceModal open={adding} onClose={() => setAdding(false)} onAdded={result => { setAdding(false); setIssued(result) }} />
      <IssuedSecretsModal issued={issued} onClose={() => setIssued(null)} />

      <ConfirmModal
        open={!!rotateText}
        title={rotateText ? t(rotateText.title, { id: pending!.device.device_id }) : ''}
        description={rotateText?.description}
        confirmLabel="Cấp lại"
        loading={rotateKey.isPending || rotateBroker.isPending}
        onConfirm={confirmRotate}
        onCancel={() => setPending(null)}
      />
      <NoteActionModal
        open={pending?.action === 'revoke'}
        onClose={() => setPending(null)}
        title={pending ? t('Thu hồi {{id}}', { id: pending.device.device_id }) : ''}
        label="Lý do"
        placeholder="VD: mất nhãn trước khi lắp, hàng lỗi"
        hint="Thiết bị đã thu hồi không kích hoạt và không kết nối được nữa. Không hoàn tác được."
        submitLabel="Thu hồi"
        required
        danger
        loading={revoke.isPending}
        onSubmit={submitRevoke}
      />
    </div>
  )
}
