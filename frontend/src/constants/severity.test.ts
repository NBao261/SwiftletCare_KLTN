// Test đổi 3 cấp giao diện sang mức backend cho bộ lọc /alerts (FE_Design 2.4, ALERT-FR-007)
import { describe, expect, it } from 'vitest';
import { severityQueryOf } from '@/constants/severity';

describe('severityQueryOf', () => {
  it('P1 gộp CRITICAL và HIGH, P2 là MEDIUM, P3 là LOW', () => {
    expect(severityQueryOf('P1')).toBe('CRITICAL,HIGH');
    expect(severityQueryOf('P2')).toBe('MEDIUM');
    expect(severityQueryOf('P3')).toBe('LOW');
  });
});
