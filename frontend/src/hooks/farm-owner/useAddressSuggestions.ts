import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { geocodingApi } from '@/apis/farm-owner/geocoding.api';
import type { Lang } from '@/stores/languageStore';

// Gõ xong 400 ms mới hỏi, từ 3 ký tự: không gọi Photon theo từng phím
const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

// FARM-FR-001 — gợi ý địa chỉ cho câu đang gõ. Chỉ hỏi khi isEnabled (người dùng đã gõ, không phải địa chỉ vừa chọn).
// isSettled: kết quả là của đúng chữ đang có trong ô; còn chờ debounce thì danh sách cũ không được dùng
export function useAddressSuggestions(text: string, lang: Lang, isEnabled: boolean) {
  const query = text.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const isLongEnough = query.length >= MIN_QUERY_LENGTH;
  const result = useQuery({
    queryKey: ['address-suggestions', debouncedQuery, lang],
    queryFn: ({ signal }) => geocodingApi.suggest(debouncedQuery, lang, signal),
    enabled: isEnabled && isLongEnough && debouncedQuery === query,
    staleTime: Infinity,
    retry: false,
  });

  return {
    suggestions: result.data ?? [],
    isActive: isEnabled && isLongEnough,
    isSettled: debouncedQuery === query && !result.isFetching,
    isError: result.isError,
  };
}
