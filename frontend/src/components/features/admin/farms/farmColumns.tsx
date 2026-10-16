import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { getUserStatus } from '@/hooks/admin/useUsers'
import { formatDate, formatHM } from '@/lib/helpers'
import { STATUS_LABEL, STATUS_TONE } from '@/components/features/admin/users/users.constants'
import type { Farm, User } from '@/types'

const DAY_FORMAT = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

export interface FarmColumnHandlers {
  onView: (farm: Farm) => void
  /** AUTH-FR-011 — khoá/mở khoá tài khoản chủ farm ngay từ bảng trang trại */
  onLockOwner: (owner: User) => void
  onUnlockOwner: (owner: User) => void
}

/**
 * Cột bảng Trang trại (AdminFarmsPage) — cùng khuôn với userColumns.tsx. `ownersById`
 * tra từ /admin/users?role=FARM_OWNER vì GET /farms chỉ trả owner_id. Không có thao
 * tác sửa/xoá farm hay tạo farm: RACI §4.4 — Farm Owner là R, Admin chỉ A.
 */
export function buildFarmColumns(
  handlers: FarmColumnHandlers,
  startIndex: number,
  ownersById: Map<string, User>,
): DataTableColumn<Farm>[] {
  return [
    // Width % (table-fixed), tổng 100: 5+15+16+18+15+9+14+8 (Trang trại | Chủ sở hữu | Email | Địa chỉ …) — Ngày tạo 14% vừa "16/09/2026 · 22:42" (12% bị tràn),
    // Chủ sở hữu 16% vừa tên như "Demo Farm Owner", Địa chỉ/Khu vực bớt phần trống
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[5%]',
      render: (_farm, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      key: 'name', header: 'Trang trại', sortable: true, className: 'w-[15%]',
      // Giữ Link (mở tab mới bằng chuột giữa/Ctrl) — stopPropagation để không điều hướng 2 lần cùng onRowClick của dòng
      render: (farm) => (
        <Link to={`/system/farms/${farm._id}`} onClick={e => e.stopPropagation()} title={farm.name} className="block truncate font-semibold text-charcoal">
          {farm.name}
        </Link>
      ),
    },
    {
      key: 'owner', header: 'Chủ sở hữu', sortable: true, className: 'w-[16%]',
      render: (farm) => {
        const owner = ownersById.get(farm.owner_id)
        if (!owner) return <span className="text-warmGray">—</span>
        const status = getUserStatus(owner)
        return (
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <p className="max-w-full truncate font-semibold text-charcoal" title={owner.full_name}>{owner.full_name}</p>
            {/* Chỉ gắn nhãn khi KHÔNG hoạt động — đa số chủ farm đang hoạt động, nhãn xanh ở mọi dòng chỉ thêm nhiễu */}
            {status !== 'ACTIVE' && (
              <Badge tone={STATUS_TONE[status]} className="whitespace-nowrap">{STATUS_LABEL[status]}</Badge>
            )}
          </div>
        )
      },
    },
    {
      // Tách riêng khỏi cột Chủ sở hữu (như bảng Người dùng: Họ tên | Email)
      key: 'email', header: 'Email', className: 'w-[18%]',
      render: (farm) => {
        const email = ownersById.get(farm.owner_id)?.email
        return email ? <span className="block truncate text-charcoal" title={email}>{email}</span> : <span className="text-warmGray">—</span>
      },
    },
    {
      // Tách riêng khỏi cột Trang trại
      key: 'address', header: 'Địa chỉ', className: 'w-[15%]',
      render: (farm) => farm.address
        ? <span className="block truncate text-charcoal" title={farm.address}>{farm.address}</span>
        : <span className="text-warmGray">—</span>,
    },
    {
      key: 'region', header: 'Khu vực', sortable: true, className: 'w-[9%]',
      render: (farm) => farm.region
        ? <span className="text-charcoal">{farm.region}</span>
        // Technician được phân theo region (AUTH-FR-005c) — farm chưa gán thì không ai phụ trách
        : <Badge tone="warning" className="whitespace-nowrap" title="Kỹ thuật viên chỉ được phân công theo khu vực — farm này chưa có ai phụ trách">Chưa gán</Badge>,
    },
    {
      // Sắp theo ngày tạo bằng nút "Sắp xếp:" ở hàng bộ lọc (như trang Người dùng) — không lặp ở tiêu đề
      // 2 tầng như cột Heartbeat bảng Thiết bị: giờ:phút đậm trên, ngày xám dưới; đủ giây ở tooltip.
      // leading-tight + -my-1 (ăn bớt py-3 của ô) để 2 dòng vừa hàng 52px, bảng không cao thêm
      key: 'created_at', header: 'Ngày tạo', className: 'w-[14%] whitespace-nowrap',
      render: (farm) => (
        <div className="-my-1 flex flex-col leading-tight" title={formatDate(farm.created_at)}>
          <span className="font-semibold text-charcoal">{formatHM(farm.created_at)}</span>
          <span className="text-small text-warmGray">{DAY_FORMAT.format(new Date(farm.created_at))}</span>
        </div>
      ),
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[8%]',
      render: (farm) => {
        const items: ActionsMenuItem[] = [{ label: 'Xem chi tiết', onClick: () => handlers.onView(farm) }]
        const owner = ownersById.get(farm.owner_id)
        if (owner) {
          const status = getUserStatus(owner)
          // Đã xoá theo yêu cầu thì backend từ chối khoá/mở khoá (409) — không hiện nút
          if (status === 'LOCKED') items.push({ label: 'Mở khoá tài khoản', onClick: () => handlers.onUnlockOwner(owner) })
          else if (status !== 'DELETED') items.push({ label: 'Khoá tài khoản', danger: true, onClick: () => handlers.onLockOwner(owner) })
        }
        return (
          // stopPropagation — dòng đã bấm-được (onRowClick mở chi tiết), mở menu bằng chuột/bàn phím không được kéo theo
          <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <ActionsMenu items={items} />
          </div>
        )
      },
    },
  ]
}
