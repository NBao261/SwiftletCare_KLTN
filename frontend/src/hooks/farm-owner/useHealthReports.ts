import { useQuery } from '@tanstack/react-query';

import { healthReportApi } from '@/apis/farm-owner/healthReports.api';

// EXPERT-FR-005/006 — báo cáo sức khỏe mới nhất của Zone kèm kết luận chuyên gia
export function useLatestHealthReport(zoneId: string | undefined) {
  return useQuery({
    queryKey: ['health-reports', zoneId, 'latest'],
    queryFn: () => healthReportApi.list(zoneId!, { limit: 1 }).then(response => response.data.data[0] ?? null),
    enabled: !!zoneId,
  });
}
