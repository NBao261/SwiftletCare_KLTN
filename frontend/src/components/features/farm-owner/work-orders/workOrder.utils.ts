// Logic thuần của trang Work Order: thao tác theo trạng thái (Report 3 §6.19), bộ lọc, thợ có thể giao lại
import type { WorkOrderListQuery } from '@/apis/farm-owner/workOrders.api';
import type { BadgeTone } from '@/components/ui';
import type { Farm, House, WorkOrderStatus } from '@/types';

export const WORK_ORDER_STATUSES: WorkOrderStatus[] = ['OPEN', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_APPROVAL', 'CLOSED', 'CANCELLED'];

// Màu nhãn trạng thái: chờ chủ nhà yến duyệt thì cam, chưa ai bắt đầu thì đỏ
export const WORK_ORDER_STATUS_TONE: Record<WorkOrderStatus, BadgeTone> = {
  OPEN: 'critical',
  IN_PROGRESS: 'info',
  VERIFYING: 'info',
  AWAITING_APPROVAL: 'warning',
  CLOSED: 'positive',
  CANCELLED: 'neutral',
};

export type OwnerAction = 'approve' | 'reopen' | 'reassign' | 'cancel';

// OPS-FR-004 — chờ duyệt: duyệt hoặc mở lại; chưa xong: giao lại hoặc huỷ; đang kiểm dữ liệu, đã đóng, đã huỷ: không có
export function ownerActions(status: WorkOrderStatus): OwnerAction[] {
  if (status === 'AWAITING_APPROVAL') return ['approve', 'reopen'];
  if (status === 'OPEN' || status === 'IN_PROGRESS') return ['reassign', 'cancel'];
  return [];
}

// Ô lọc trạng thái: 'open' = chưa đóng/huỷ (mặc định), 'all' = mọi Work Order, hoặc 1 trạng thái
export type StatusFilter = 'open' | 'all' | WorkOrderStatus;

export function statusFilterQuery(filter: StatusFilter): Pick<WorkOrderListQuery, 'status' | 'open'> {
  if (filter === 'open') return { open: 'true' };
  if (filter === 'all') return {};
  return { status: filter };
}

// Tên chủ farm và thành viên farm theo id (GET /farms/:id trả kèm full_name)
export function memberNames(farms: Farm[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const farm of farms) {
    if (farm.owner?.full_name) names.set(farm.owner_id, farm.owner.full_name);
    for (const member of farm.members ?? []) {
      if (member.full_name) names.set(member.user_id, member.full_name);
    }
  }
  return names;
}

// Thợ được giao nhà, trừ người đang nhận; thợ chính đứng đầu. Backend vẫn kiểm thợ còn hoạt động (400)
export function reassignCandidates(
  house: House | undefined,
  names: Map<string, string>,
  currentAssigneeId: string | undefined,
): { id: string; name: string }[] {
  return [...(house?.technicians ?? [])]
    .sort((left, right) => Number(right.primary) - Number(left.primary))
    .filter(technician => technician.user_id !== currentAssigneeId && names.has(technician.user_id))
    .map(technician => ({ id: technician.user_id, name: names.get(technician.user_id)! }));
}
