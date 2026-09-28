import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { getUserStatus } from '@/hooks/admin/useUsers'
import { formatDate } from '@/lib/helpers'
import { STATUS_LABEL, STATUS_TONE } from '@/components/features/admin/users/users.constants'
import type { Farm, User } from '@/types'

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
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[6%]',
      render: (_farm, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      key: 'name', header: 'Trang trại', sortable: true, className: 'w-[28%]',
      render: (farm) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          {/* Giữ Link (mở tab mới bằng chuột giữa/Ctrl) — stopPropagation để không điều hướng 2 lần cùng onRowClick của dòng */}
          <Link to={`/system/farms/${farm._id}`} onClick={e => e.stopPropagation()} className="truncate font-semibold text-charcoal hover:underline">
            {farm.name}
          </Link>
          <p className="truncate text-xs text-warmGray" title={farm.address}>{farm.address}</p>
        </div>
      ),
    },
    {
      key: 'owner', header: 'Chủ sở hữu', sortable: true, className: 'w-[26%]',
      render: (farm) => {
        const owner = ownersById.get(farm.owner_id)
        if (!owner) return <span className="text-warmGray">—</span>
        const status = getUserStatus(owner)
        return (
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <p className="max-w-full truncate font-semibold text-charcoal">{owner.full_name}</p>
            <p className="max-w-full truncate text-xs text-warmGray">{owner.email}</p>
            {/* Chỉ gắn nhãn khi KHÔNG hoạt động — đa số chủ farm đang hoạt động, nhãn xanh ở mọi dòng chỉ thêm nhiễu */}
            {status !== 'ACTIVE' && (
              <Badge tone={STATUS_TONE[status]} className="whitespace-nowrap">{STATUS_LABEL[status]}</Badge>
            )}
          </div>
        )
      },
    },
    {
      key: 'region', header: 'Khu vực', sortable: true, className: 'w-[15%]',
      render: (farm) => farm.region
        ? <span className="text-charcoal">{farm.region}</span>
        // Technician được phân theo region (AUTH-FR-005c) — farm chưa gán thì không ai phụ trách
        : <Badge tone="warning" className="whitespace-nowrap" title="Kỹ thuật viên chỉ được phân công theo khu vực — farm này chưa có ai phụ trách">Chưa gán</Badge>,
    },
    {
      // Sắp theo ngày tạo bằng nút "Sắp xếp:" ở hàng bộ lọc (như trang Người dùng) — không lặp ở tiêu đề
      key: 'created_at', header: 'Ngày tạo', className: 'w-[15%] whitespace-nowrap',
      render: (farm) => <span className="text-warmGray">{formatDate(farm.created_at)}</span>,
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[10%]',
      render: (farm) => {
        const items: ActionsMenuItem[] = [{ label: 'Xem chi tiết', onClick: () => handlers.onView(farm) }]
        const owner = ownersById.get(farm.owner_id)
        if (owner) {
          const status = getUserStatus(owner)
          // Đã xoá theo yêu cầu thì backend từ chối khoá/mở khoá (409) — không hiện nút
          if (status === 'LOCKED') items.push({ label: 'Mở khoá chủ farm', onClick: () => handlers.onUnlockOwner(owner) })
          else if (status !== 'DELETED') items.push({ label: 'Khoá tài khoản chủ farm', danger: true, onClick: () => handlers.onLockOwner(owner) })
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
