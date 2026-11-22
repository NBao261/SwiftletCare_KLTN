import api from '@/lib/axios';
import type { ApiResponse, ComparisonSortKey, FarmOverview, HouseComparison } from '@/types';

export interface HouseComparisonQuery {
  from: string;
  to: string;
  sort: ComparisonSortKey;
  order: 'asc' | 'desc';
}

// tổng quan trại và so sánh nhà; Farm Owner, Domain Expert (đọc)
export const farmOverviewApi = {
  overview: (farmId: string) => api.get<ApiResponse<FarmOverview>>(`/farms/${farmId}/overview`),
  comparison: (farmId: string, query: HouseComparisonQuery) =>
    api.get<ApiResponse<HouseComparison>>(`/farms/${farmId}/comparison`, { params: query }),
};
