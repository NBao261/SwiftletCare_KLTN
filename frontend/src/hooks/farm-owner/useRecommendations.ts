import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recommendationsApi, type RecommendationListQuery } from '@/apis/farm-owner/recommendations.api';
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery';

const RECOMMENDATIONS_KEY = 'recommendations';
// Số khuyến nghị mỗi trang, cũng là số dòng khung bảng
export const RECOMMENDATIONS_PAGE_SIZE = 10;

// khuyến nghị của nhà hoặc farm, mới mở trước
export function useRecommendations(query: RecommendationListQuery, enabled: boolean) {
  return usePaginatedListQuery(
    [RECOMMENDATIONS_KEY, query],
    () => recommendationsApi.list(query),
    query.page,
    query.limit,
    { enabled },
  );
}

// xong hay lỗi (409: đã quyết định nơi khác hoặc vừa hết hạn) đều tải lại danh sách và phiếu công việc
export function useRecommendationActions() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [RECOMMENDATIONS_KEY] });
    void queryClient.invalidateQueries({ queryKey: ['work-orders'] });
  };
  // Chấp nhận đổi tham số sửa ngưỡng hoặc hệ số mờ của mọi zone trong nhà: cùng các key như khi tự sửa ngưỡng và hệ số
  const refreshZones = () => {
    for (const key of ['zones', 'zone', 'all-zones']) void queryClient.invalidateQueries({ queryKey: [key] });
    void queryClient.invalidateQueries({ queryKey: ['analytics', 'control-performance'] });
  };
  return {
    accept: useMutation({ mutationFn: (id: string) => recommendationsApi.accept(id), onSuccess: refreshZones, onSettled: refresh }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => recommendationsApi.reject(id, reason),
      onSettled: refresh,
    }),
  };
}
