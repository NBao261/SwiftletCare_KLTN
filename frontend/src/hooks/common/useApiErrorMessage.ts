import { useCallback } from 'react';

import { errorDict } from '@/constants/error.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { getApiErrorGroup } from '@/lib/apiError';

// Hàm đổi lỗi API sang câu hiển thị, có thể kèm ngữ cảnh ngắn phía trước
export type ApiErrorMessage = (error: unknown, context?: string) => string;

// Câu lỗi API theo nhóm: "Gửi yêu cầu thất bại. " + câu của nhóm lỗi
export function useApiErrorMessage(): ApiErrorMessage {
  const { t } = useTranslation(errorDict);

  return useCallback(
    (error: unknown, context?: string) => {
      const groupSentence = t(getApiErrorGroup(error));
      if (!context) return groupSentence;
      return `${context}. ${groupSentence}`;
    },
    [t],
  );
}
