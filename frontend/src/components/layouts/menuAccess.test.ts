import { describe, expect, it } from 'vitest';
import { MENU_ACCESS } from '@/constants/roles';
import type { Role } from '@/types';

/**
 * MENU_ACCESS (constants/roles.ts) và menu trong `<Role>Layout.tsx` phải khớp nhau, nhưng là hai
 * chỗ khai báo riêng (import vòng: layout → AppHeader → useAuth → canAccessPath). Test này nối hai
 * chỗ lại: một trang vào được mà không có mục menu hay tab là trang không ai mở tới được, còn một
 * mục menu trỏ tới trang role không có quyền thì bấm vào là văng sang /403.
 * Đọc nguyên văn file layout thay vì nạp component: menu viết thẳng trong file nên lấy path bằng
 * chuỗi là đủ, mà không phải dựng React trong môi trường test.
 */
const sources = import.meta.glob('/src/components/layouts/*Layout.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const LAYOUT_FILE: Record<Role, string> = {
  ADMIN: '/src/components/layouts/AdminLayout.tsx',
  FARM_OWNER: '/src/components/layouts/FarmOwnerLayout.tsx',
  FARM_TECHNICIAN: '/src/components/layouts/TechnicianLayout.tsx',
  DOMAIN_EXPERT: '/src/components/layouts/DomainExpertLayout.tsx',
};

// Trang mở từ chỗ khác, cố ý không có mục menu: chi tiết thiết bị mở từ danh sách, lắp thiết bị mở
// bằng nút trên trang thiết bị, cài đặt tài khoản mở từ menu ảnh đại diện (FE_Design §4)
const OPENED_ELSEWHERE = ['/devices/detail', '/devices/onboarding', '/settings'];

function menuPaths(role: Role): Set<string> {
  const source = sources[LAYOUT_FILE[role]];
  if (!source) throw new Error(`Không đọc được ${LAYOUT_FILE[role]}`);
  return new Set([...source.matchAll(/path:\s*'([^']+)'/g)].map(match => match[1]));
}

const ROLES = Object.keys(LAYOUT_FILE) as Role[];

describe('menu của layout khớp MENU_ACCESS', () => {
  for (const role of ROLES) {
    it(`${role}: mọi trang vào được đều có mục menu hoặc tab`, () => {
      const paths = menuPaths(role);
      const missing = MENU_ACCESS
        .filter(entry => entry.roles.includes(role) && !OPENED_ELSEWHERE.includes(entry.path))
        .map(entry => entry.path)
        .filter(path => !paths.has(path));
      expect(missing).toEqual([]);
    });

    it(`${role}: mục menu nào cũng trỏ tới trang role này có quyền`, () => {
      const allowed = new Set(
        MENU_ACCESS.filter(entry => entry.roles.includes(role)).map(entry => entry.path),
      );
      const forbidden = [...menuPaths(role)].filter(path => {
        const entry = MENU_ACCESS.find(candidate => path === candidate.path);
        return entry !== undefined && !allowed.has(path);
      });
      expect(forbidden).toEqual([]);
    });
  }
});
