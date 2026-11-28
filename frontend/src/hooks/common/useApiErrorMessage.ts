import { useCallback } from 'react';

import { resolveApiErrorSentence, type ApiErrorOverrides } from '@/lib/apiErrorMessage';
import { useLanguageStore } from '@/stores/languageStore';

// Hàm đổi lỗi API sang câu hiển thị, có thể kèm ngữ cảnh ngắn phía trước và câu thay cho mã lỗi, mã HTTP riêng của màn
export type ApiErrorMessage = (error: unknown, context?: string, overrides?: ApiErrorOverrides) => string;

// "Gửi yêu cầu thất bại. " + câu của nhóm lỗi (hoặc câu theo mã lỗi đã biết); không bao giờ hiện câu của backend
export function useApiErrorMessage(): ApiErrorMessage {
  const lang = useLanguageStore(state => state.lang);

  return useCallback(
    (error: unknown, context?: string, overrides?: ApiErrorOverrides) => {
      const sentence = resolveApiErrorSentence(error, lang, overrides);
      return context ? `${context}. ${sentence}` : sentence;
    },
    [lang],
  );
}
