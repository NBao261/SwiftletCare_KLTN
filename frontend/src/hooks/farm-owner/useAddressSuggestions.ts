import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { geocodingApi, type AddressSuggestion } from '@/apis/farm-owner/geocoding.api';
import type { Lang } from '@/stores/languageStore';

// Gõ xong 400 ms mới hỏi, từ 3 ký tự: không gọi Photon theo từng phím
const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

export interface AddressSuggestionsResult {
  suggestions: AddressSuggestion[];
  // Người dùng đã gõ đủ dài: có danh sách để hiện
  isActive: boolean;
  isSettled: boolean;
  isError: boolean;
}

// isSettled: kết quả của đúng chữ đang có; còn chờ debounce thì không dùng danh sách cũ
export function useAddressSuggestions(text: string, lang: Lang, isEnabled: boolean): AddressSuggestionsResult {
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
    // Không hỏi lại, không thử lại: Photon dùng miễn phí theo kiểu fair use
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
