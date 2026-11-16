import { useQuery } from '@tanstack/react-query';
import { farmOverviewApi, type HouseComparisonQuery } from '@/apis/farm-owner/farmOverview.api';

// ANALYTICS-FR-015 — mỗi nhà của trại: giai đoạn, trạng thái hôm nay, cảnh báo và phiếu đang mở, tỷ lệ về gần nhất
export function useFarmOverview(farmId: string | undefined) {
  return useQuery({
    queryKey: ['farm-overview', farmId],
    queryFn: () => farmOverviewApi.overview(farmId!).then(response => response.data.data),
    enabled: Boolean(farmId),
  });
}

// ANALYTICS-FR-016 — bảng so sánh nhà, backend sắp theo cột; giữ bảng cũ khi đổi cột của cùng trại, đổi trại thì chờ tải
export function useHouseComparison(farmId: string | undefined, query: HouseComparisonQuery) {
  return useQuery({
    queryKey: ['farm-comparison', farmId, query],
    queryFn: () => farmOverviewApi.comparison(farmId!, query).then(response => response.data.data),
    enabled: Boolean(farmId),
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === farmId ? previous : undefined),
  });
}
