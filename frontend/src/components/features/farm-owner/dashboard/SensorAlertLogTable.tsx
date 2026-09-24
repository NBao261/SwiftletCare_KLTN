import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Card, DataTable, FilterChip, type BadgeTone, type DataTableColumn } from '@/components/ui'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { cn } from '@/lib/cn'

type SeverityGroup = 'CRITICAL' | 'HIGH_MED' | 'NORMAL'

interface LogRow {
  id: string
  time: string
  nodeId: string
  nodeLocation: string
  metricType: string
  reading: string
  readingWarn?: boolean
  threshold: string
  severityGroup: SeverityGroup
  statusLabel: string
  statusTone: BadgeTone
  action: string
  actionStyle: 'critical' | 'dark' | 'passive'
}

/** Dòng đệm khi lọc còn ít hơn FIXED_ROW_COUNT bản ghi — giữ khung bảng cao cố định thay vì co ngắn lại. */
interface PlaceholderRow {
  id: string
  placeholder: true
  /** Chỉ dòng đệm đầu tiên hiện chữ thông báo, các dòng đệm còn lại để trống hoàn toàn */
  showNotice?: boolean
}

type TableRow = LogRow | PlaceholderRow

function isPlaceholder(row: TableRow): row is PlaceholderRow {
  return 'placeholder' in row
}

const FIXED_ROW_COUNT = 6

/**
 * Luôn trả đủ FIXED_ROW_COUNT dòng — thiếu thì bù dòng trống, không rút ngắn
 * khung bảng theo bộ lọc. Chữ thông báo "không có bản ghi" chỉ hiện khi TOÀN
 * BẢNG rỗng (0 dòng thật); còn lọc ra được dù chỉ 1 dòng thì các dòng đệm còn
 * lại để trống hoàn toàn, không lặp lại chữ thông báo.
 */
function padRows(rows: LogRow[]): TableRow[] {
  if (rows.length >= FIXED_ROW_COUNT) return rows
  const missing = FIXED_ROW_COUNT - rows.length
  const isTableEmpty = rows.length === 0
  return [
    ...rows,
    ...Array.from({ length: missing }, (_, i): PlaceholderRow => ({ id: `placeholder-${i}`, placeholder: true, showNotice: isTableEmpty && i === 0 })),
  ]
}

/**
 * "Nhật Ký Cảnh Báo & Giám Sát Cảm Biến Realtime" — bảng lai giữa Alert
 * (`alerts.api.ts`, thật) và log thiết bị theo node, kèm cột "Hành động SCADA"
 * (relay tự động phản ứng) mà backend không ghi lại thành bản ghi riêng nào —
 * PID controller chỉ áp dụng ngưỡng, không log "đã làm gì" theo từng sự kiện.
 * Vì cột đó không tồn tại ở bất kỳ endpoint nào, toàn bảng dùng dữ liệu minh
 * hoạ cố định thay vì trộn nửa thật nửa giả gây hiểu nhầm.
 */
const MOCK_ROWS: LogRow[] = [
  {
    id: '1', time: '14:28:10', nodeId: 'Cam-AI-02 (Cửa thu)', nodeLocation: 'Tầng 2 · Zone Đông',
    metricType: 'Phát hiện Cú Mèo (Thiên địch)', reading: 'Confidence 94%', readingWarn: true, threshold: '0 cá thể',
    severityGroup: 'CRITICAL', statusLabel: 'CRITICAL', statusTone: 'critical',
    action: 'Kích còi đuổi', actionStyle: 'critical',
  },
  {
    id: '2', time: '14:15:22', nodeId: 'Sensor-TH-09', nodeLocation: 'Áp mái Zone D',
    metricType: 'Nhiệt độ phòng lượn', reading: '31.4 °C', readingWarn: true, threshold: '26.0 - 29.5 °C',
    severityGroup: 'HIGH_MED', statusLabel: 'MEDIUM', statusTone: 'warning',
    action: 'Bật quạt cấp tốc', actionStyle: 'dark',
  },
  {
    id: '3', time: '14:08:47', nodeId: 'Gas-NH3-05', nodeLocation: 'Zone C',
    metricType: 'Nồng độ khí NH3', reading: '27.8 ppm', readingWarn: true, threshold: '< 25 ppm',
    severityGroup: 'HIGH_MED', statusLabel: 'HIGH', statusTone: 'critical',
    action: 'Tăng chu kỳ thông gió', actionStyle: 'dark',
  },
  {
    id: '4', time: '14:02:45', nodeId: 'Humid-Pump-01', nodeLocation: 'Trạm bơm trung tâm',
    metricType: 'Độ ẩm tương đối RH', reading: '86.2 %', threshold: '82 - 90 %',
    severityGroup: 'NORMAL', statusLabel: 'CHUẨN', statusTone: 'positive',
    action: 'Tự động duy trì', actionStyle: 'passive',
  },
  {
    id: '5', time: '13:40:00', nodeId: 'Audio-Amp-3', nodeLocation: 'Loa ru tầng 2',
    metricType: 'Cường độ âm thanh loa ru', reading: '64 dB', threshold: '60 - 68 dB',
    severityGroup: 'NORMAL', statusLabel: 'CHUẨN', statusTone: 'positive',
    action: 'Auto timer: On', actionStyle: 'passive',
  },
  {
    id: '6', time: '13:22:18', nodeId: 'Sensor-CO2-04', nodeLocation: 'Tầng 1 · Zone B',
    metricType: 'Nồng độ CO2', reading: '1,120 ppm', threshold: '< 1500 ppm',
    severityGroup: 'NORMAL', statusLabel: 'CHUẨN', statusTone: 'positive',
    action: 'Ổn định', actionStyle: 'passive',
  },
]

const FILTERS: Array<{ value: SeverityGroup | undefined; label: string }> = [
  { value: undefined, label: 'Tất cả' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH_MED', label: 'High/Med' },
  { value: 'NORMAL', label: 'Normal' },
]

const ACTION_STYLE_CLASS: Record<LogRow['actionStyle'], string> = {
  critical: 'inline-flex whitespace-nowrap rounded-full bg-alertRed px-2.5 py-1 text-xs font-bold text-white',
  dark: 'inline-flex whitespace-nowrap rounded-full bg-charcoal px-2.5 py-1 text-xs font-bold text-white',
  passive: 'text-xs italic text-warmGray',
}

/**
 * Chữ dài trong 1 cột cố định width: thay vì cắt cụt bằng "…" (truncate), làm
 * mờ dần bằng mask-image rồi chừa khoảng trắng (pr-3) trước khi sang cột kế —
 * đỡ đột ngột hơn ellipsis, vẫn không tràn/đẩy layout cột sau.
 */
const FADE_TRUNCATE =
  'block overflow-hidden whitespace-nowrap pr-3 [mask-image:linear-gradient(to_right,black_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_82%,transparent_100%)]'

/**
 * Width cố định theo % (bảng `table-fixed`, xem DataTable.tsx) — mỗi cột giữ
 * đúng tỉ lệ ở mọi độ rộng màn hình thay vì co giãn tự do, tránh badge "Mức độ"
 * bị đẩy hẹp rồi wrap xuống 2 dòng. Tổng = 100%, cùng quy ước với userColumns.tsx.
 */
function buildColumns(onOpenAlert: (row: LogRow) => void): DataTableColumn<TableRow>[] {
  return [
    {
      key: 'time', header: 'Thời gian', className: 'w-[8%] whitespace-nowrap',
      render: row => (isPlaceholder(row) ? null : <span className="font-medium text-warmGray">{row.time}</span>),
    },
    {
      key: 'node', header: 'Node / Thiết bị', className: 'w-[16%]',
      render: row => {
        if (isPlaceholder(row)) {
          return row.showNotice ? <span className="text-xs italic text-warmGray">Không có thêm bản ghi ở mức lọc này</span> : null
        }
        return (
          <div className="min-w-0">
            <p className={cn(FADE_TRUNCATE, 'font-bold text-charcoal')}>{row.nodeId}</p>
            <p className={cn(FADE_TRUNCATE, 'text-xs text-warmGray')}>{row.nodeLocation}</p>
          </div>
        )
      },
    },
    {
      key: 'metricType', header: 'Loại thông số', className: 'w-[16%]',
      render: row => (isPlaceholder(row) ? null : <span className={FADE_TRUNCATE}>{row.metricType}</span>),
    },
    {
      key: 'reading', header: 'Giá trị đọc', className: 'w-[11%]',
      render: row => (isPlaceholder(row) ? null : <span className={cn('font-bold', row.readingWarn ? 'text-alertRed' : 'text-charcoal')}>{row.reading}</span>),
    },
    {
      key: 'threshold', header: 'Ngưỡng an toàn', className: 'w-[13%] whitespace-nowrap',
      render: row => (isPlaceholder(row) ? null : <span className="text-warmGray">{row.threshold}</span>),
    },
    {
      key: 'status', header: 'Mức độ', className: 'w-[11%]',
      render: row => (isPlaceholder(row) ? null : <Badge tone={row.statusTone} className="whitespace-nowrap px-2 py-0.5 text-[11px]">{row.statusLabel}</Badge>),
    },
    {
      key: 'action', header: 'Hành động SCADA', className: 'w-[15%]',
      render: row => (isPlaceholder(row) ? null : <span className={ACTION_STYLE_CLASS[row.actionStyle]}>{row.action}</span>),
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[10%] whitespace-nowrap',
      render: row => {
        if (isPlaceholder(row)) return null
        return (
          // stopPropagation — hàng đã bấm-được (onRowClick), không cho mở menu kích hoạt luôn điều hướng
          <div onClick={e => e.stopPropagation()}>
            <ActionsMenu items={buildActionItems(row, onOpenAlert)} />
          </div>
        )
      },
    },
  ]
}

function buildActionItems(row: LogRow, onOpenAlert: (row: LogRow) => void): ActionsMenuItem[] {
  return [{ label: 'Xem trên trang Cảnh báo', onClick: () => onOpenAlert(row) }]
}

/** "Nhật Ký Cảnh Báo & Giám Sát Cảm Biến Realtime" — bảng full-width cuối Dashboard (screenshot mục 5). */
export default function SensorAlertLogTable() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<SeverityGroup | undefined>(undefined)

  const rows = useMemo(
    () => padRows(filter ? MOCK_ROWS.filter(r => r.severityGroup === filter) : MOCK_ROWS),
    [filter],
  )
  const counts = useMemo(() => {
    const base: Record<'all' | SeverityGroup, number> = { all: MOCK_ROWS.length, CRITICAL: 0, HIGH_MED: 0, NORMAL: 0 }
    for (const row of MOCK_ROWS) base[row.severityGroup] += 1
    return base
  }, [])

  // Dữ liệu bảng là minh hoạ (xem comment MOCK_ROWS) nên id không khớp Alert._id thật —
  // điều hướng sang /alerts?highlight=<id> để đúng luồng UX (TechnicianAlertsPage đã đọc
  // sẵn query "highlight"), id không tìm thấy thì trang đó chỉ đơn giản không cuộn-tới đâu cả.
  function openAlert(row: LogRow) {
    navigate(`/alerts?highlight=${row.id}`)
  }

  const columns = useMemo(() => buildColumns(openAlert), [])

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-h2 text-charcoal">Nhật ký cảnh báo &amp; giám sát cảm biến realtime</h2>
          <p className="mt-1 text-sm text-warmGray">Tự động tổng hợp từ mạng lưới node IoT Mesh Zigbee + PLC</p>
        </div>
        <p className="text-[11px] font-medium italic text-warmGray">
          Cột "Hành động SCADA" là minh hoạ — PID controller không ghi log theo sự kiện
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-warmGray">Lọc theo mức độ:</span>
        {FILTERS.map(f => (
          <FilterChip
            key={f.label}
            active={filter === f.value}
            label={`${f.label} (${f.value ? counts[f.value] : counts.all})`}
            onClick={() => setFilter(f.value)}
          />
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={row => row.id}
        onRowClick={row => { if (!isPlaceholder(row)) openAlert(row) }}
        rowHeight={64}
      />
    </Card>
  )
}
