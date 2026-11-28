import { describe, expect, it } from 'vitest';

import { getApiErrorCode, getApiErrorGroup, getApiErrorReason, getRetryAfterSec } from '@/lib/apiError';
import { resolveApiErrorSentence } from '@/lib/apiErrorMessage';

interface FakeAxiosError {
  response: { status: number; data: { error: { code?: string; message: string; details?: unknown } } };
}

// Lỗi giả có mã HTTP như axios trả về
function errorWithStatus(status: number, code?: string, details?: unknown): FakeAxiosError {
  return { response: { status, data: { error: { code, message: 'raw backend message', details } } } };
}

describe('getApiErrorGroup', () => {
  it('gộp mã HTTP vào đúng nhóm', () => {
    const expected: Array<[number, string]> = [
      [400, 'invalid'], [422, 'invalid'], [401, 'session'], [403, 'forbidden'], [404, 'notFound'], [410, 'notFound'],
      [409, 'conflict'], [413, 'upload'], [415, 'upload'], [429, 'rateLimited'], [500, 'server'], [502, 'server'], [503, 'server'],
    ];
    for (const [status, group] of expected) expect(getApiErrorGroup(errorWithStatus(status))).toBe(group);
  });

  it('không có phản hồi thì là lỗi mạng', () => {
    expect(getApiErrorGroup(new Error('Network Error'))).toBe('network');
    expect(getApiErrorGroup(undefined)).toBe('network');
    expect(getApiErrorGroup('lỗi')).toBe('network');
  });
});

describe('getApiErrorCode, getRetryAfterSec', () => {
  it('đọc mã lỗi và số giây phải đợi', () => {
    expect(getApiErrorCode(errorWithStatus(409, 'HAS_ACTIVE_DEVICES'))).toBe('HAS_ACTIVE_DEVICES');
    expect(getApiErrorCode(errorWithStatus(500))).toBeUndefined();
    expect(getRetryAfterSec(errorWithStatus(429, 'RATE_LIMITED', { retryAfterSec: 12.2 }))).toBe(13);
  });

  it('bỏ qua giá trị không dùng được', () => {
    expect(getRetryAfterSec(errorWithStatus(429, 'RATE_LIMITED'))).toBeUndefined();
    expect(getRetryAfterSec(errorWithStatus(429, 'RATE_LIMITED', { retryAfterSec: 'ba' }))).toBeUndefined();
    expect(getRetryAfterSec(errorWithStatus(429, 'RATE_LIMITED', { retryAfterSec: -5 }))).toBeUndefined();
  });
});

describe('getApiErrorReason', () => {
  it('đọc lý do khoá tài khoản, bỏ qua giá trị rỗng hoặc sai kiểu', () => {
    expect(getApiErrorReason(errorWithStatus(403, 'ACCOUNT_DISABLED', { reason: ' Vi phạm điều khoản ' }))).toBe('Vi phạm điều khoản');
    expect(getApiErrorReason(errorWithStatus(403, 'ACCOUNT_DISABLED', { reason: null }))).toBeUndefined();
    expect(getApiErrorReason(errorWithStatus(403, 'ACCOUNT_DISABLED', { reason: '  ' }))).toBeUndefined();
    expect(getApiErrorReason(errorWithStatus(403))).toBeUndefined();
  });
});

describe('resolveApiErrorSentence', () => {
  it('lấy câu của nhóm lỗi, không bao giờ lấy câu của backend', () => {
    for (const status of [400, 401, 403, 404, 409, 413, 429, 500]) {
      expect(resolveApiErrorSentence(errorWithStatus(status), 'vi')).not.toContain('raw backend message');
    }
    expect(resolveApiErrorSentence(errorWithStatus(500), 'vi')).toBe('Máy chủ đang gặp sự cố. Thử lại sau ít phút.');
    expect(resolveApiErrorSentence(new Error('x'), 'en')).toBe('Could not reach the server. Check your connection and try again.');
  });

  it('429 nói số giây phải đợi, thiếu thì nói đợi một lát; không bao giờ là lỗi kết nối', () => {
    expect(resolveApiErrorSentence(errorWithStatus(429, 'RATE_LIMITED', { retryAfterSec: 20 }), 'vi'))
      .toBe('Bạn thao tác quá nhanh. Thử lại sau 20 giây.');
    expect(resolveApiErrorSentence(errorWithStatus(429), 'vi')).toBe('Bạn thao tác quá nhanh. Đợi một lát rồi thử lại.');
  });

  it('mã lỗi đã biết thắng nhóm', () => {
    expect(resolveApiErrorSentence(errorWithStatus(409, 'HAS_ACTIVE_DEVICES'), 'vi'))
      .toBe('Còn thiết bị đang dùng ở đây. Gỡ thiết bị trước rồi thử lại.');
    expect(resolveApiErrorSentence(errorWithStatus(400, 'INVALID_CURRENT_PASSWORD'), 'en')).toBe('The current password is not correct.');
  });

  it('overrides thắng cả mã lỗi: theo mã lỗi trước, theo mã HTTP sau', () => {
    const overrides = { 401: 'Sai email hoặc mật khẩu', ACCOUNT_DISABLED: 'Tài khoản đã khoá' };
    expect(resolveApiErrorSentence(errorWithStatus(401, 'UNAUTHORIZED'), 'vi', overrides)).toBe('Sai email hoặc mật khẩu');
    expect(resolveApiErrorSentence(errorWithStatus(403, 'ACCOUNT_DISABLED'), 'vi', overrides)).toBe('Tài khoản đã khoá');
    expect(resolveApiErrorSentence(errorWithStatus(403, 'FORBIDDEN'), 'vi', overrides)).toBe('Bạn không có quyền thực hiện thao tác này.');
  });

  it('tên thuộc tính của Object không bị coi là mã lỗi', () => {
    expect(resolveApiErrorSentence(errorWithStatus(400, 'constructor'), 'vi')).toBe(
      'Thông tin chưa hợp lệ. Kiểm tra các ô đã báo lỗi rồi thử lại.',
    );
  });
});
