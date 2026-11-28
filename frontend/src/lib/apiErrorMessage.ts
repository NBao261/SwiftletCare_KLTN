import { errorCodeDict, errorDict, type ApiErrorCode } from '@/constants/error.i18n';
import { getApiErrorCode, getApiErrorGroup, getApiErrorStatus, getRetryAfterSec } from '@/lib/apiError';
import { translate } from '@/lib/i18n';
import type { Lang } from '@/stores/languageStore';

// Câu thay cho một mã lỗi backend hoặc một mã HTTP; màn đặt khi nghĩa mặc định không đúng
// (VD đăng nhập: 401 là "Sai email hoặc mật khẩu", không phải "phiên hết hạn")
export type ApiErrorOverrides = Partial<Record<string | number, string>>;

const isKnownCode = (code: string | undefined): code is ApiErrorCode =>
  code !== undefined && Object.prototype.hasOwnProperty.call(errorCodeDict.vi, code);

// Chọn câu cho một lỗi API: overrides theo mã lỗi → overrides theo mã HTTP → câu theo mã lỗi đã biết → câu của nhóm
export function resolveApiErrorSentence(error: unknown, lang: Lang, overrides?: ApiErrorOverrides): string {
  const code = getApiErrorCode(error);
  const status = getApiErrorStatus(error);
  const overridden = (code !== undefined && overrides?.[code]) || (status !== undefined && overrides?.[status]);
  if (overridden) return overridden;
  if (isKnownCode(code)) return translate(errorCodeDict, lang, code);

  const group = getApiErrorGroup(error);
  if (group === 'rateLimited') {
    const seconds = getRetryAfterSec(error);
    return seconds === undefined
      ? translate(errorDict, lang, 'rateLimitedNoWait')
      : translate(errorDict, lang, 'rateLimited', { n: seconds });
  }
  return translate(errorDict, lang, group);
}
