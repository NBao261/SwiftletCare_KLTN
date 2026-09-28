import { Play } from 'lucide-react'
import { Badge, Button, Card, DataTable, type BadgeTone, type DataTableColumn } from '@/components/ui'

interface MockEvent {
  id: string
  title: string
  location: string
  recordedAt: string
  detection: string
  confidence: number
  tone: BadgeTone
  duration: string
}

// SavedEventsTable – bảng video sự kiện đã lưu (bầy đàn/thiên địch) — MOCK, chưa có API thật
const MOCK_EVENTS: MockEvent[] = [
  {
    id: '1', title: 'Đàn về tổ buổi chiều', location: 'Cửa B · Tầng 2 Đông Nam',
    recordedAt: '18:05:22 Hôm nay', detection: 'Bầy đàn đông', confidence: 98.4,
    tone: 'positive', duration: '02:15',
  },
  {
    id: '2', title: 'Chim xuất đàn rộ sáng sớm', location: 'Cửa A · Tầng 1 Chính diện',
    recordedAt: '05:42:10 Hôm nay', detection: 'Xuất đàn', confidence: 96.1,
    tone: 'positive', duration: '01:45',
  },
  {
    id: '3', title: 'Chuyển động bất thường ban đêm', location: 'Góc Tây · Cửa thông tầng',
    recordedAt: '23:14:05 Hôm qua', detection: 'Cảnh báo cú/thiên địch', confidence: 88.5,
    tone: 'critical', duration: '00:48',
  },
  {
    id: '4', title: 'Kiểm tra luồng gió & hướng bay', location: 'Cửa B · Tầng 2',
    recordedAt: '12:30:00 18/09', detection: 'Bình thường', confidence: 94.0,
    tone: 'neutral', duration: '03:10',
  },
]

const COLUMNS: DataTableColumn<MockEvent>[] = [
  {
    key: 'preview', header: 'Xem trước', className: 'w-[10%]',
    render: () => (
      <span className="flex h-10 w-14 items-center justify-center rounded-lg bg-graphite text-white">
        <Play width={14} height={14} />
      </span>
    ),
  },
  {
    key: 'title', header: 'Tên sự kiện & Vị trí', className: 'w-[26%]',
    render: row => (
      <div className="min-w-0">
        <p className="font-semibold text-charcoal">{row.title}</p>
        <p className="text-xs text-warmGray">{row.location}</p>
      </div>
    ),
  },
  {
    key: 'recordedAt', header: 'Thời điểm ghi nhận', className: 'w-[16%] whitespace-nowrap',
    render: row => <span className="text-warmGray">{row.recordedAt}</span>,
  },
  {
    key: 'detection', header: 'Phát hiện & Độ tin cậy', className: 'w-[22%]',
    render: row => <Badge tone={row.tone}>{row.detection} ({row.confidence.toFixed(1)}%)</Badge>,
  },
  {
    key: 'duration', header: 'Thời lượng', className: 'w-[10%] whitespace-nowrap',
    render: row => <span className="text-warmGray">{row.duration}</span>,
  },
  {
    key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[10%] whitespace-nowrap',
    render: () => <Button variant="secondary" size="sm" disabled>Xem</Button>,
  },
]

export default function SavedEventsTable() {
  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-h2 text-charcoal">Video sự kiện đã lưu</h2>
          <p className="mt-1 text-sm text-warmGray">
            Trích xuất tự động khi phát hiện chuyển động bầy đàn đột biến hoặc thiên địch
          </p>
        </div>
        <p className="text-[11px] font-medium italic text-warmGray">Dữ liệu minh hoạ, chưa nối API thật</p>
      </div>

      <DataTable columns={COLUMNS} rows={MOCK_EVENTS} getRowKey={row => row.id} rowHeight={64} />

      <p className="text-xs text-warmGray">Hiển thị {MOCK_EVENTS.length} sự kiện gần nhất</p>
    </Card>
  )
}
