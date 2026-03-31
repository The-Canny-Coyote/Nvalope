import type { ColorblindMode } from '@/app/store/appStore';

export type BackupSettingsSnapshot = {
  layoutScale?: number;
  wheelScale?: number;
  cardBarRows?: number;
  cardBarColumns?: number;
  cardBarPosition?: 'bottom' | 'left' | 'right';
  cardBarSectionOrder?: number[] | null;
  showCardBarRowSelector?: boolean;
  cardsSectionWidthPercent?: number;
  colorblindMode?: ColorblindMode;
};
