import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workOrderApi, type CreateWorkOrderInput, type WorkOrderListQuery } from '@/apis/farm-owner/workOrders.api';
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery';
import type { WorkOrder } from '@/types';

// Khoá gốc của danh sách, chi tiết, số đếm và MTTA/MTTR: thao tác ghi làm mới tất cả
const WORK_ORDERS_KEY = 'work-orders';
// Số Work Order mỗi trang, cũng là số dòng khung bảng
export const WORK_ORDER_PAGE_SIZE = 10;
// Khoảng tính MTTA, MTTR trên trang nhà
const METRICS_DAYS = 30;

// OPS-FR-001…004 — danh sách mới mở trước, phân trang server
export function useWorkOrders(query: Omit<WorkOrderListQuery, 'page' | 'limit'>, page: number) {
  return usePaginatedListQuery(
    [WORK_ORDERS_KEY, 'list', query, page],
    () => workOrderApi.list({ ...query, page, limit: WORK_ORDER_PAGE_SIZE }),
    page,
    WORK_ORDER_PAGE_SIZE,
  );
}

// Chi tiết kèm ảnh (URL tạm 1 giờ); null = chưa mở
export function useWorkOrder(id: string | null) {
  return useQuery({
    queryKey: [WORK_ORDERS_KEY, 'detail', id],
    queryFn: () => workOrderApi.getOne(id!).then(response => response.data.data),
    enabled: Boolean(id),
  });
}

// Số Work Order chưa đóng của 1 nhà — chỉ đọc meta.total
export function useOpenWorkOrderCount(houseId: string) {
  return useQuery({
    queryKey: [WORK_ORDERS_KEY, 'open-count', houseId],
    queryFn: () => workOrderApi.list({ houseId, open: 'true', limit: 1 }).then(response => response.data.meta?.total ?? 0),
    enabled: Boolean(houseId),
  });
}

// OPS-FR-009 — MTTA, MTTR của 1 nhà trong 30 ngày tới lúc mở trang (khoảng giữ nguyên để khoá truy vấn không đổi mỗi lần vẽ)
export function useHouseOpsMetrics(farmId: string, houseId: string) {
  const [range] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - METRICS_DAYS * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  return useQuery({
    queryKey: [WORK_ORDERS_KEY, 'metrics', farmId, houseId, range],
    queryFn: () => workOrderApi.metrics({ farmId, houseId, ...range }).then(response => response.data.data),
    enabled: Boolean(farmId && houseId),
  });
}

// Thao tác của Farm Owner (OPS-FR-001, 004); xong hay lỗi (409: trạng thái đã đổi) đều tải lại Work Order và cảnh báo, vì duyệt đóng luôn cảnh báo
export function useWorkOrderActions() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [WORK_ORDERS_KEY] });
    void queryClient.invalidateQueries({ queryKey: ['alerts'] });
  };
  const options = { onSettled: refresh };
  return {
    create: useMutation({
      mutationFn: (input: CreateWorkOrderInput) => workOrderApi.create(input).then(response => response.data.data),
      ...options,
    }),
    approve: useMutation({
      mutationFn: (workOrder: WorkOrder) => workOrderApi.approve(workOrder._id),
      ...options,
    }),
    reopen: useMutation({
      mutationFn: ({ workOrder, note }: { workOrder: WorkOrder; note: string }) => workOrderApi.reopen(workOrder._id, note),
      ...options,
    }),
    cancel: useMutation({
      mutationFn: ({ workOrder, reason }: { workOrder: WorkOrder; reason: string }) => workOrderApi.cancel(workOrder._id, reason),
      ...options,
    }),
    reassign: useMutation({
      mutationFn: ({ workOrder, assigneeId }: { workOrder: WorkOrder; assigneeId: string }) =>
        workOrderApi.reassign(workOrder._id, assigneeId),
      ...options,
    }),
  };
}
