// Nhóm lỗi API hiển thị cho người dùng, mỗi nhóm một câu chung (constants/error.i18n.ts)
export type ApiErrorGroup =
  | 'network'
  | 'server'
  | 'rateLimited'
  | 'session'
  | 'forbidden'
  | 'notFound'
  | 'invalid'
  | 'conflict'
  | 'upload';

interface ErrorBody {
  response?: { status?: number; data?: { error?: { code?: unknown; details?: unknown } } };
}

const asErrorBody = (error: unknown): ErrorBody | undefined =>
  error && typeof error === 'object' ? (error as ErrorBody) : undefined;

export function getApiErrorStatus(error: unknown): number | undefined {
  return asErrorBody(error)?.response?.status;
}

// Mã lỗi backend (error.code), chỉ để chọn câu; không bao giờ hiện ra màn hình
export function getApiErrorCode(error: unknown): string | undefined {
  const code = asErrorBody(error)?.response?.data?.error?.code;
  return typeof code === 'string' ? code : undefined;
}

// Lý do Administrator đã nhập khi khoá tài khoản (error.details.reason): dữ liệu của người dùng, không phải câu hệ thống
export function getApiErrorReason(error: unknown): string | undefined {
  const details = asErrorBody(error)?.response?.data?.error?.details;
  const reason = (details as { reason?: unknown } | undefined)?.reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;
}

// Số giây phải đợi của lỗi 429 (error.details.retryAfterSec)
export function getRetryAfterSec(error: unknown): number | undefined {
  const details = asErrorBody(error)?.response?.data?.error?.details;
  const seconds = (details as { retryAfterSec?: unknown } | undefined)?.retryAfterSec;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

// Đổi lỗi axios sang nhóm lỗi; không có phản hồi (mất mạng, bị chặn) là `network`
export function getApiErrorGroup(error: unknown): ApiErrorGroup {
  const status = getApiErrorStatus(error);
  if (status === undefined) return 'network';
  if (status === 401) return 'session';
  if (status === 403) return 'forbidden';
  if (status === 404 || status === 410) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 413 || status === 415) return 'upload';
  if (status === 429) return 'rateLimited';
  if (status >= 500) return 'server';
  return 'invalid';
}
