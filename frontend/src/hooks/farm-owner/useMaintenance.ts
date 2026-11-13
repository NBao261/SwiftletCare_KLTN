import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  maintenanceApi, type CreateMaintenancePlanInput, type MaintenancePlanListQuery, type UpdateMaintenancePlanInput,
} from '@/apis/farm-owner/maintenance.api';
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery';

// Khoá gốc của danh sách kế hoạch và danh sách đến hạn: thao tác ghi làm mới cả hai
const MAINTENANCE_KEY = 'maintenance';
// Số kế hoạch mỗi trang, cũng là số dòng khung bảng
export const MAINTENANCE_PAGE_SIZE = 10;

// OPS-FR-005 — kế hoạch mới tạo trước, phân trang server
export function useMaintenancePlans(query: Omit<MaintenancePlanListQuery, 'page' | 'limit'>, page: number) {
  return usePaginatedListQuery(
    [MAINTENANCE_KEY, 'plans', query, page],
    () => maintenanceApi.listPlans({ ...query, page, limit: MAINTENANCE_PAGE_SIZE }),
    page,
    MAINTENANCE_PAGE_SIZE,
  );
}

// OPS-FR-006 — kế hoạch đến hạn và quá hạn, quá hạn trước (không phân trang)
export function useDueMaintenancePlans(query: { farmId?: string; houseId?: string }) {
  return useQuery({
    queryKey: [MAINTENANCE_KEY, 'due', query],
    queryFn: () => maintenanceApi.listDue(query).then(response => response.data.data),
  });
}

// Thao tác trên kế hoạch; xong thì tải lại mọi truy vấn bảo trì
export function useMaintenancePlanActions() {
  const queryClient = useQueryClient();
  const options = { onSuccess: () => void queryClient.invalidateQueries({ queryKey: [MAINTENANCE_KEY] }) };
  return {
    create: useMutation({ mutationFn: (input: CreateMaintenancePlanInput) => maintenanceApi.create(input), ...options }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateMaintenancePlanInput }) => maintenanceApi.update(id, input),
      ...options,
    }),
    retire: useMutation({ mutationFn: (id: string) => maintenanceApi.retire(id), ...options }),
    comment: useMutation({
      mutationFn: ({ id, text }: { id: string; text: string }) => maintenanceApi.comment(id, text),
      ...options,
    }),
  };
}
