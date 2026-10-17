import { describe, expect, it } from 'vitest';

import { getApiErrorGroup } from '@/lib/apiError';

interface FakeAxiosError {
  response: { status: number; data: { error: { message: string } } };
}

// Lỗi giả có mã HTTP như axios trả về
function errorWithStatus(status: number): FakeAxiosError {
  return { response: { status, data: { error: { message: 'raw backend message' } } } };
}

describe('getApiErrorGroup', () => {
  it('gộp mã HTTP vào đúng 4 nhóm', () => {
    expect(getApiErrorGroup(errorWithStatus(401))).toBe('permission');
    expect(getApiErrorGroup(errorWithStatus(403))).toBe('permission');
    expect(getApiErrorGroup(errorWithStatus(404))).toBe('notFound');
    expect(getApiErrorGroup(errorWithStatus(410))).toBe('notFound');
    expect(getApiErrorGroup(errorWithStatus(400))).toBe('invalid');
    expect(getApiErrorGroup(errorWithStatus(409))).toBe('invalid');
    expect(getApiErrorGroup(errorWithStatus(422))).toBe('invalid');
    expect(getApiErrorGroup(errorWithStatus(429))).toBe('system');
    expect(getApiErrorGroup(errorWithStatus(500))).toBe('system');
  });

  it('không có phản hồi thì là lỗi hệ thống / mạng', () => {
    expect(getApiErrorGroup(new Error('Network Error'))).toBe('system');
    expect(getApiErrorGroup(undefined)).toBe('system');
  });
});
