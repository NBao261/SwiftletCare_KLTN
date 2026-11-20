import { describe, expect, it } from 'vitest'
import { AUDIT_ACTION_LABEL, USER_AUDIT_ACTIONS } from '@/constants/auditActions'

describe('USER_AUDIT_ACTIONS', () => {
  // Mã thiếu nhãn thì nhật ký hiện nguyên mã backend (FE_Design 13.16)
  it('mọi hành động tài khoản trong ô lọc đều có nhãn', () => {
    for (const action of USER_AUDIT_ACTIONS) expect(AUDIT_ACTION_LABEL[action], action).toBeTruthy()
  })
})
