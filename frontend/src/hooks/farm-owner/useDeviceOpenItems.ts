import { useQueries } from '@tanstack/react-query';

import { workOrderApi } from '@/apis/farm-owner/workOrders.api';
import { alertApi } from '@/apis/shared/alerts.api';
import { groupOpenItemsByDevice } from '@/components/features/farm-owner/devices/deviceWork';

// Số việc mở tối đa lấy mỗi nhà (trần của backend); một nhà yến ít khi có tới ngần này việc còn mở
const OPEN_ITEMS_LIMIT = 100;

// Cảnh báo thiết bị và Work Order còn mở của các nhà, gom theo thiết bị; 1 lượt gọi mỗi nhà, không gọi theo từng thiết bị
// Lỗi tải: trang Thiết bị vẫn dùng được, nhưng nơi gọi phải nói là việc đang mở chưa tải được (isError), không để người dùng tưởng không còn việc
export function useDeviceOpenItems(houseIds: string[], includeWorkOrders: boolean) {
  const alertQueries = useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['alerts', 'device-open', houseId],
      queryFn: () => alertApi.list({ houseId, open: 'true', limit: String(OPEN_ITEMS_LIMIT) }).then(response => response.data.data),
    })),
  });
  const workOrderQueries = useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['work-orders', 'device-open', houseId],
      queryFn: () => workOrderApi.list({ houseId, open: 'true', limit: OPEN_ITEMS_LIMIT }).then(response => response.data.data),
      enabled: includeWorkOrders,
    })),
  });

  // Gom lại mỗi lượt render: O(số việc mở), đủ nhỏ để khỏi ghi nhớ
  const itemsByDevice = groupOpenItemsByDevice(
    alertQueries.flatMap(query => query.data ?? []),
    workOrderQueries.flatMap(query => query.data ?? []),
  );
  const failed = [...alertQueries, ...workOrderQueries].filter(query => query.isError);
  return {
    itemsByDevice,
    isLoading: alertQueries.some(query => query.isLoading) || (includeWorkOrders && workOrderQueries.some(query => query.isLoading)),
    isError: failed.length > 0,
    error: failed[0]?.error,
    // Chỉ tải lại các lượt đã lỗi
    refetch: () => failed.forEach(query => void query.refetch()),
  };
}
