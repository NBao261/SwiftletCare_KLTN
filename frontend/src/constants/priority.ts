import type { TicketPriority } from '@/types';
import { LEVEL_BADGE_CLASS, LEVELS } from '@/constants/severity';
import { levelDict } from '@/constants/severity.i18n';

// Thứ tự ưu tiên ticket, khớp backend PRIORITIES
export const PRIORITIES: TicketPriority[] = LEVELS;

interface PriorityStyle {
  label: string;
  badge: string;
  tint: string;
  solid: string;
  dot: string;
  rowTint: string;
  headerTint: string;
}

// Màu và nhãn theo mức ưu tiên
export const PRIORITY: Record<TicketPriority, PriorityStyle> = {
  P1: {
    label: levelDict.vi.P1,
    badge: LEVEL_BADGE_CLASS.P1,
    tint: 'bg-safetyOrange/10 text-safetyOrange',
    solid: 'bg-safetyOrange text-white',
    dot: 'bg-safetyOrange',
    rowTint: 'bg-safetyOrange/5',
    headerTint: 'from-safetyOrange/[0.09]',
  },
  P2: {
    label: levelDict.vi.P2,
    badge: LEVEL_BADGE_CLASS.P2,
    tint: 'bg-orange-100 text-orange-800',
    solid: 'bg-orange-500 text-white',
    dot: 'bg-orange-500',
    rowTint: 'bg-orange-50',
    headerTint: 'from-orange-500/[0.09]',
  },
  P3: {
    label: levelDict.vi.P3,
    badge: LEVEL_BADGE_CLASS.P3,
    tint: 'bg-warmGray/15 text-warmGray',
    solid: 'bg-graphite text-white',
    dot: 'bg-warmGray',
    rowTint: 'bg-warmGray/10',
    headerTint: 'from-warmGray/[0.07]',
  },
};
