import { describe, expect, it } from 'vitest';
import { roleMenu } from '@/components/layouts/menuCatalog';
import { MENU_ACCESS, canAccessPath } from '@/constants/roles';
import { isNavigationKey } from '@/constants/navigation.i18n';
import type { Role } from '@/types';

const ROLES: Role[] = ['ADMIN', 'FARM_OWNER', 'FARM_TECHNICIAN', 'DOMAIN_EXPERT'];

// Trang mở từ chỗ khác nên không có mục menu: chi tiết, lắp thiết bị (từ trang thiết bị), cài đặt (menu ảnh đại diện)
const OPENED_ELSEWHERE = ['/devices/detail', '/devices/onboarding', '/settings'];

// Vai trò vẫn mở được các trang này bằng đường dẫn nhưng menu cố ý không hiện: chuyên gia chỉ giữ việc chuyên môn và ba trang số liệu, kỹ thuật viên chỉ giữ việc tại nhà yến
const HIDDEN_FROM_MENU: Partial<Record<Role, string[]>> = {
  DOMAIN_EXPERT: ['/dashboard', '/work-orders', '/maintenance', '/recommendations', '/harvests', '/devices', '/farms'],
  FARM_TECHNICIAN: ['/analytics', '/recommendations', '/domain-expert/tuning', '/domain-expert/weather-rules', '/domain-expert/counting-schedule'],
};

function menuPaths(role: Role): string[] {
  return roleMenu(role).sections.flatMap(section => section.items.flatMap(item => [item.path, ...(item.tabs ?? []).map(tab => tab.path)]));
}

describe('menu theo vai trò từ danh mục chung', () => {
  for (const role of ROLES) {
    it(`${role}: mọi trang vào được đều có mục menu hoặc tab, và không mục nào trỏ tới trang bị chặn`, () => {
      const paths = new Set(menuPaths(role));
      const missing = MENU_ACCESS
        .filter(entry => entry.roles.includes(role) && !OPENED_ELSEWHERE.includes(entry.path) && !HIDDEN_FROM_MENU[role]?.includes(entry.path))
        .map(entry => entry.path)
        .filter(path => !paths.has(path));
      expect(missing).toEqual([]);
      expect([...paths].filter(path => !canAccessPath(role, path))).toEqual([]);
    });

    it(`${role}: dock điện thoại đủ 4 mục có trong menu; tiêu đề nhóm, mục, tab đều có bản dịch`, () => {
      const { sections, dock } = roleMenu(role);
      expect(dock).toHaveLength(4);
      const items = sections.flatMap(section => section.items);
      for (const item of dock) expect(items).toContain(item);
      const labels = [
        ...sections.map(section => section.title),
        ...items.flatMap(item => [item.label, ...(item.tabs ?? []).map(tab => tab.label)]),
      ];
      expect(labels.filter(label => !isNavigationKey(label))).toEqual([]);
    });
  }

  it('cùng một trang thì cùng tên và icon ở mọi vai trò', () => {
    const seen = new Map<string, { label: string; icon: unknown }>();
    for (const role of ROLES) {
      for (const item of roleMenu(role).sections.flatMap(section => section.items)) {
        const first = seen.get(item.path);
        if (first) expect({ label: item.label, icon: item.icon }).toEqual(first);
        else seen.set(item.path, { label: item.label, icon: item.icon });
      }
    }
  });

  it('một tab duy nhất thì mục mở thẳng trang đó, không hiện tab', () => {
    const expert = roleMenu('DOMAIN_EXPERT').sections.flatMap(section => section.items);
    // So sánh nhà nằm trong Phân tích, không còn mục riêng; chuyên gia không vào Điều khiển tay
    expect(expert.map(item => item.path)).not.toContain('/overview');
    expect(expert.map(item => item.path)).not.toContain('/relay-control');
    const technician = roleMenu('FARM_TECHNICIAN').sections.flatMap(section => section.items);
    // Thợ chỉ vẽ vòng đếm (lịch đếm ẩn): còn một tab nên mở thẳng trang vòng đếm
    expect(technician.find(item => item.label === 'Cài đặt đếm chim')).toMatchObject({ path: '/domain-expert/counting-ring', tabs: undefined });
    expect(technician.find(item => item.label === 'Công việc')?.tabs?.map(tab => tab.path)).toEqual(['/work-orders', '/maintenance']);
    expect(technician.map(item => item.label)).not.toContain('Tham số điều khiển');
  });
});
