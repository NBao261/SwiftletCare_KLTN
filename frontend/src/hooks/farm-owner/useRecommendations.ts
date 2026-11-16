import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recommendationsApi, type RecommendationListQuery } from '@/apis/farm-owner/recommendations.api';
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery';

const RECOMMENDATIONS_KEY = 'recommendations';
// Số khuyến nghị mỗi trang, cũng là số dòng khung bảng
export const RECOMMENDATIONS_PAGE_SIZE = 10;

// EXPERT-FR-017 — khuyến nghị của nhà hoặc farm, mới mở trước
export function useRecommendations(query: RecommendationListQuery, enabled: boolean) {
  return usePaginatedListQuery(
    [RECOMMENDATIONS_KEY, query],
    () => recommendationsApi.list(query),
    query.page,
    query.limit,
    { enabled },
  );
}

// EXPERT-FR-018 — chấp nhận mở Work Order hoặc mục duyệt, nên làm mới cả phiếu công việc
export function useRecommendationActions() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [RECOMMENDATIONS_KEY] });
    void queryClient.invalidateQueries({ queryKey: ['work-orders'] });
  };
  return {
    accept: useMutation({ mutationFn: (id: string) => recommendationsApi.accept(id), onSuccess: refresh }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => recommendationsApi.reject(id, reason),
      onSuccess: refresh,
    }),
  };
}
