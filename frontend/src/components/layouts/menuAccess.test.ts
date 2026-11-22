import { describe, expect, it } from 'vitest';
import { MENU_ACCESS } from '@/constants/roles';
import type { Role } from '@/types';

// MENU_ACCESS và menu của <Role>Layout khai riêng (tránh import vòng): đọc nguyên văn file layout để hai chỗ luôn khớp
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

// Trang mở từ chỗ khác nên không có mục menu: chi tiết, lắp thiết bị (từ trang thiết bị), cài đặt (menu ảnh đại diện)
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
