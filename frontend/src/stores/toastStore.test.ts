import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOAST_DURATION_MS, useToastStore } from './toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => { vi.useRealTimers() })

  it('merges the same message with the same tone', () => {
    useToastStore.getState().push('Lưu thất bại', 'error')
    useToastStore.getState().push('Lưu thất bại', 'error')
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('keeps the same message when the tone differs', () => {
    useToastStore.getState().push('Xong', 'success')
    useToastStore.getState().push('Xong', 'error')
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })

  it('removes a success after 4 s and an error after 8 s', () => {
    useToastStore.getState().push('ok')
    useToastStore.getState().push('lỗi', 'error')
    vi.advanceTimersByTime(TOAST_DURATION_MS.success)
    expect(useToastStore.getState().toasts.map(toast => toast.message)).toEqual(['lỗi'])
    vi.advanceTimersByTime(TOAST_DURATION_MS.error - TOAST_DURATION_MS.success)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('shows a success again once the first one is gone', () => {
    useToastStore.getState().push('ok')
    vi.advanceTimersByTime(TOAST_DURATION_MS.success)
    useToastStore.getState().push('ok')
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })
})
