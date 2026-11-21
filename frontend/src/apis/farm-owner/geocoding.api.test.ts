import { describe, it, expect } from 'vitest';
import { suggestionLabel } from '@/apis/farm-owner/geocoding.api';

describe('suggestionLabel', () => {
  it('ghép tên, số nhà + đường và đơn vị hành chính, bỏ phần trống và phần trùng', () => {
    expect(suggestionLabel({
      name: 'Chợ Bến Thành',
      housenumber: '1',
      street: 'Lê Lợi',
      district: 'Quận 1',
      city: 'Thành phố Hồ Chí Minh',
      state: 'Thành phố Hồ Chí Minh',
      country: 'Việt Nam',
      locality: ' ',
    })).toBe('Chợ Bến Thành, 1 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh, Việt Nam');
  });

  it('không có tên thì bắt đầu bằng đường', () => {
    expect(suggestionLabel({ street: 'Nguyễn Huệ', city: 'Huế' })).toBe('Nguyễn Huệ, Huế');
  });
});
