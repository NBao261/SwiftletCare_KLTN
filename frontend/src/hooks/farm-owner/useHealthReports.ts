import { useQuery } from '@tanstack/react-query';

import { healthDayApi } from '@/apis/shared/healthDays.api';

// EXPERT-FR-005/006 — báo cáo tuần mới nhất của nhà (BR-33) kèm kết luận chuyên gia; thẻ lấy mục của Zone đang xem
export function useLatestHouseWeeklyReport(houseId: string | undefined) {
  return useQuery({
    queryKey: ['health-reports', 'house', houseId, 'weekly-latest'],
    queryFn: async () => {
      const list = await healthDayApi.listReports({ houseId, kind: 'WEEKLY', limit: 1 });
      const latest = list.data.data[0];
      if (!latest) return null;
      return (await healthDayApi.getReport(latest._id)).data.data;
    },
    enabled: !!houseId,
  });
}
