import { useQuery } from '@tanstack/react-query';
import { disagreementsApi } from '@/apis/domain-expert/disagreements.api';
import type {
  HealthDisagreementsQueryParams,
  HealthDisagreementsResponse,
  HealthEvaluationResponse,
} from '@/types/expert/disagreements.types';

// Query key đồng bộ cho danh sách ngày đánh giá lệch (EXPERT-FR-022)
export const DISAGREEMENTS_QUERY_KEY = (
  params: Partial<HealthDisagreementsQueryParams>,
) => [
  'health-disagreements',
  params.farmId ?? '',
  params.houseId ?? '',
  params.from ?? '',
  params.to ?? '',
];

// Query key đồng bộ cho thống kê độ đồng thuận & tỷ lệ báo động giả (ANALYTICS-FR-014)
export const EVALUATION_QUERY_KEY = (
  params: Partial<HealthDisagreementsQueryParams>,
) => [
  'health-evaluation',
  params.farmId ?? '',
  params.houseId ?? '',
  params.from ?? '',
  params.to ?? '',
  params.role ?? '',
];

// EXPERT-FR-022 — ngày người chấm đánh giá lệch ảnh chụp hệ thống, kèm mức chỉ số của từng nhà (BR-28)
export function useHealthDisagreements(
  params: HealthDisagreementsQueryParams,
  options?: { enabled?: boolean },
) {
  const hasScope = Boolean(params.houseId || params.farmId);
  const query = useQuery<HealthDisagreementsResponse>({
    queryKey: DISAGREEMENTS_QUERY_KEY(params),
    queryFn: () =>
      disagreementsApi
        .listDisagreements(params)
        .then((response) => response.data.data),
    enabled: hasScope && (options?.enabled ?? true),
    staleTime: 30_000,
  });

  const days = query.data?.days ?? [];
  const houses = query.data?.houses ?? [];
  const totalDays = days.length;
  const totalDisagreements = days.reduce(
    (sum, day) => sum + day.disagreements.length,
    0,
  );

  return {
    ...query,
    days,
    houses,
    totalDays,
    totalDisagreements,
  };
}

// ANALYTICS-FR-014 — độ đồng thuận (CI 95%, Kappa, AC1) và tỷ lệ báo động giả theo nguồn (NFR-14)
export function useHealthEvaluation(
  params: HealthDisagreementsQueryParams,
  options?: { enabled?: boolean },
) {
  const hasScope = Boolean(params.houseId || params.farmId);
  return useQuery<HealthEvaluationResponse>({
    queryKey: EVALUATION_QUERY_KEY(params),
    queryFn: () =>
      disagreementsApi
        .getEvaluation(params)
        .then((response) => response.data.data),
    enabled: hasScope && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}
