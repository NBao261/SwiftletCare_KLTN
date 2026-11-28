// Logic thuần của trang Work Order: thao tác theo trạng thái, bộ lọc, thợ có thể giao lại
import type { WorkOrderListQuery } from '@/apis/farm-owner/workOrders.api';
import type { BadgeTone } from '@/components/ui';
import type { AlertType, Farm, House, WorkOrder, WorkOrderStatus } from '@/types';

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

export type OwnerAction = 'start' | 'done' | 'approve' | 'reopen' | 'reassign' | 'cancel';

// Thao tác của Farm Owner theo trạng thái; phiếu phòng ngừa không huỷ được (backend 409)
export function ownerActions(workOrder: Pick<WorkOrder, 'status' | 'kind'>): OwnerAction[] {
  const { status } = workOrder;
  let actions: OwnerAction[] = [];
  if (status === 'AWAITING_APPROVAL') actions = ['approve', 'reopen'];
  if (status === 'OPEN') actions = ['start', 'reassign', 'cancel'];
  if (status === 'IN_PROGRESS') actions = ['done', 'reassign', 'cancel'];
  if (status === 'VERIFYING') actions = ['cancel'];
  return workOrder.kind === 'PREVENTIVE' ? actions.filter(action => action !== 'cancel') : actions;
}

// Ai thao tác trên phiếu: chủ nhà yến (mọi việc), kỹ thuật viên (làm phiếu), người chỉ đọc (chuyên gia)
export type WorkOrderActor = 'owner' | 'technician' | 'reader';

// Kỹ thuật viên chỉ bắt đầu và báo xong (backend 403 với duyệt, mở lại, huỷ, giao lại)
export function workOrderActions(workOrder: Pick<WorkOrder, 'status' | 'kind'>, actor: WorkOrderActor): OwnerAction[] {
  if (actor === 'owner') return ownerActions(workOrder);
  if (actor === 'reader') return [];
  if (workOrder.status === 'OPEN') return ['start'];
  return workOrder.status === 'IN_PROGRESS' ? ['done'] : [];
}

// Phòng ngừa kiểm bằng checklist, sửa chữa kiểm bằng dữ liệu
export function approvalDescriptionKey(
  workOrder: Pick<WorkOrder, 'kind' | 'alert_id' | 'alert_type' | 'device_left'>,
): 'approve.descPreventive' | 'approve.descUnverified' | 'approve.desc' {
  if (workOrder.kind === 'PREVENTIVE') return 'approve.descPreventive';
  return isRecoveryUnverified(workOrder) ? 'approve.descUnverified' : 'approve.desc';
}

// loại cảnh báo backend chưa có dữ liệu để kiểm phục hồi (UNVERIFIABLE_RECOVERY ở workOrder.service.ts)
const UNVERIFIABLE_ALERT_TYPES: AlertType[] = ['ACTUATOR_FAULT', 'SPEAKER_FAILURE', 'UNEXPECTED_RESTART'];

// Phiếu sang chờ duyệt mà chưa kiểm được dữ liệu: mở tay không gắn cảnh báo, cảnh báo thuộc loại trên,
// hoặc thiết bị của phiếu đã bị gỡ, thay, dời (cảnh báo đóng theo việc đó chứ không theo dữ liệu)
export function isRecoveryUnverified(workOrder: Pick<WorkOrder, 'alert_id' | 'alert_type' | 'device_left'>): boolean {
  if (workOrder.device_left) return true;
  return !workOrder.alert_id || (workOrder.alert_type !== null && UNVERIFIABLE_ALERT_TYPES.includes(workOrder.alert_type));
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
