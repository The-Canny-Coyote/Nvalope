import React, { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { AppearanceSettings } from '@/app/components/settings/AppearanceSettings';
import { FeatureToggles } from '@/app/components/settings/FeatureToggles';
import { BackupSettings } from '@/app/components/settings/BackupSettings';
import type { BackupSettingsSnapshot } from '@/app/constants/settings';

export interface SettingsContentProps {
  enabledModules: string[];
  enableModule: (moduleId: string) => void;
  disableModule: (moduleId: string) => void;
  enableCache: () => void;
  onEnableAdvancedAICache: () => void;
  onChooseBackupFolder: () => void;
  /** Download full backup (budget + settings + app data). Pass optional password to encrypt. */
  onDownloadFullBackup?: (password?: string) => void;
  getBackupPasswordRef?: MutableRefObject<string | null>;
  setBackupPassword?: (p: string | null) => void;
  onCheckForUpdates: () => void;
  checkingForUpdate: boolean;
  /** Called after a successful backup import with layout/wheel scale from the backup (if present). */
  onApplySettingsFromBackup?: (settings: BackupSettingsSnapshot) => void;
  uiMode?: 'normal';
  setUiMode?: (v: 'normal') => void;
  /** When true, optional-upgrade modules (e.g. Advanced AI) can be enabled. */
  isPremium?: boolean;
  /** When true, user has chosen a backup folder; show status in Data Management. */
  hasBackupFolder?: boolean | null;
  /** Before opening Feature toggles collapsibles (Core / Optional). */
  onBeforeOpenFeatureCollapsibles?: () => void;
  /** Before opening Data Management collapsible. */
  onBeforeOpenDataMgmt?: () => void;
  /** Call after collapsible content has expanded to restore main scroll position. */
  restoreScrollAfterLayout?: () => void;
  /** When true, the app is in card layout; show option at top to switch back to section wheel. */
  useCardLayout?: boolean;
  /** Switch from card layout back to section wheel. */
  setUseCardLayout?: (v: boolean) => void;
}

export function SettingsContent({
  enabledModules,
  enableModule,
  disableModule,
  enableCache,
  onEnableAdvancedAICache: _onEnableAdvancedAICache,
  onChooseBackupFolder,
  onDownloadFullBackup,
  getBackupPasswordRef,
  setBackupPassword,
  onCheckForUpdates,
  checkingForUpdate,
  onApplySettingsFromBackup,
  uiMode: _uiMode,
  setUiMode: _setUiMode,
  isPremium: _isPremium = false,
  hasBackupFolder = null,
  onBeforeOpenFeatureCollapsibles,
  onBeforeOpenDataMgmt,
  restoreScrollAfterLayout,
  useCardLayout = false,
  setUseCardLayout,
}: SettingsContentProps) {
  const jumpToDataRef = useRef<(() => void) | null>(null);

  return (
    <div className="space-y-4">
      <AppearanceSettings useCardLayout={useCardLayout} setUseCardLayout={setUseCardLayout} />
      <FeatureToggles
        enabledModules={enabledModules}
        enableModule={enableModule}
        disableModule={disableModule}
        enableCache={enableCache}
        onBeforeOpen={onBeforeOpenFeatureCollapsibles}
        restoreScrollAfterLayout={restoreScrollAfterLayout}
        jumpToDataRef={jumpToDataRef}
      />
      <BackupSettings
        enabledModules={enabledModules}
        onChooseBackupFolder={onChooseBackupFolder}
        onDownloadFullBackup={onDownloadFullBackup}
        getBackupPasswordRef={getBackupPasswordRef}
        setBackupPassword={setBackupPassword}
        onCheckForUpdates={onCheckForUpdates}
        checkingForUpdate={checkingForUpdate}
        onApplySettingsFromBackup={onApplySettingsFromBackup}
        hasBackupFolder={hasBackupFolder}
        onBeforeOpen={onBeforeOpenDataMgmt}
        restoreScrollAfterLayout={restoreScrollAfterLayout}
        jumpToDataRef={jumpToDataRef}
      />
    </div>
  );
}
