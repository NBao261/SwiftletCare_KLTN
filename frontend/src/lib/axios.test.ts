import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/lib/axios'
import { redirectToPasswordChange } from '@/lib/navigation'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

vi.mock('@/lib/navigation', () => ({ redirectToLogin: vi.fn(), redirectToPasswordChange: vi.fn() }))

// backend trả 403 PASSWORD_CHANGE_REQUIRED khi tài khoản còn mật khẩu tạm
const failWith = (status: number, code: string): AxiosAdapter => config => Promise.reject(new AxiosError(
  'fail', String(status), config, undefined,
  { status, statusText: '', headers: {}, config: config as InternalAxiosRequestConfig, data: { error: { code } } },
))

describe('api interceptor: temporary password', () => {
  beforeEach(() => {
    vi.mocked(redirectToPasswordChange).mockClear()
    useAuthStore.setState({ user: { _id: 'u1', must_change_password: false } as User })
  })

  it('flags the user and sends them to /change-password on PASSWORD_CHANGE_REQUIRED', async () => {
    await expect(api.get('/farms', { adapter: failWith(403, 'PASSWORD_CHANGE_REQUIRED') })).rejects.toThrow()
    expect(useAuthStore.getState().user?.must_change_password).toBe(true)
    expect(redirectToPasswordChange).toHaveBeenCalledOnce()
  })

  it('leaves any other 403 alone', async () => {
    await expect(api.get('/farms', { adapter: failWith(403, 'FORBIDDEN') })).rejects.toThrow()
    expect(useAuthStore.getState().user?.must_change_password).toBe(false)
    expect(redirectToPasswordChange).not.toHaveBeenCalled()
  })
})
