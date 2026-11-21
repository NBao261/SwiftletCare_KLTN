// Test đổi 4 cấp giao diện sang mức backend cho bộ lọc /alerts (BR-15, ALERT-FR-007)
import { describe, expect, it } from 'vitest';
import { severityQueryOf } from '@/constants/severity';

describe('severityQueryOf', () => {
  it('mỗi cấp là đúng một mức backend', () => {
    expect(severityQueryOf('P1')).toBe('CRITICAL');
    expect(severityQueryOf('P2')).toBe('HIGH');
    expect(severityQueryOf('P3')).toBe('MEDIUM');
    expect(severityQueryOf('P4')).toBe('LOW');
  });
});
