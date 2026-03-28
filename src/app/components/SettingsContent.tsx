import React, { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { AppearanceSettings } from '@/app/components/settings/AppearanceSettings';
import { FeatureToggles } from '@/app/components/settings/FeatureToggles';
import { BackupSettings } from '@/app/components/settings/BackupSettings';

export interface SettingsContentProps {
  enabledModules: string[];
  enableModule: (moduleId: string) => void;
  disableModule: (moduleId: string) => void;
  enableCache: () => void;
  onEnableAdvancedAICache: () => void;
  onChooseBackupFolder: () => void;
  /** Download full backup (budget + settings + app data). Pass optional password to encrypt. */
  onDownloadFullBackup?: (password?: string) => void;
  encryptBackups?: boolean;
  setEncryptBackups?: (v: boolean) => void;
  getBackupPasswordRef?: MutableRefObject<string | null>;
  setBackupPassword?: (p: string | null) => void;
  onCheckForUpdates: () => void;
  checkingForUpdate: boolean;
  /** Called after a successful backup import with layout/wheel scale from the backup (if present). */
  onApplySettingsFromBackup?: (settings: {
    layoutScale?: number;
    wheelScale?: number;
    cardBarRows?: number;
    cardBarColumns?: number;
    cardBarPosition?: 'bottom' | 'left' | 'right';
    cardBarSectionOrder?: number[] | null;
    showCardBarRowSelector?: boolean;
    cardsSectionWidthPercent?: number;
    uiMode?: 'normal';
  }) => void;
  uiMode?: 'normal';
  setUiMode?: (v: 'normal') => void;
  /** When true, optional-upgrade modules (e.g. Advanced AI) can be enabled. */
  isPremium?: boolean;
  /** Optional features collapsible open state (controlled from App so it survives remounts). */
  optionalFeaturesOpen?: boolean;
  onOptionalFeaturesOpenChange?: (open: boolean) => void;
  /** Core features / Data Management collapsibles: lifted so they stay open when toggling. */
  coreFeaturesOpen?: boolean;
  onCoreFeaturesOpenChange?: (open: boolean) => void;
  dataMgmtOpen?: boolean;
  onDataMgmtOpenChange?: (open: boolean) => void;
  /** When true, user has chosen a backup folder; show status in Data Management. */
  hasBackupFolder?: boolean | null;
  /** Call before opening a collapsible so main scroll can be restored after layout. */
  saveScrollForRestore?: () => void;
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
  encryptBackups = false,
  setEncryptBackups,
  getBackupPasswordRef,
  setBackupPassword,
  onCheckForUpdates,
  checkingForUpdate,
  onApplySettingsFromBackup,
  uiMode: _uiMode,
  setUiMode: _setUiMode,
  isPremium: _isPremium = false,
  optionalFeaturesOpen = false,
  onOptionalFeaturesOpenChange,
  coreFeaturesOpen = false,
  onCoreFeaturesOpenChange,
  dataMgmtOpen = false,
  onDataMgmtOpenChange,
  hasBackupFolder = null,
  saveScrollForRestore,
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
        optionalFeaturesOpen={optionalFeaturesOpen}
        onOptionalFeaturesOpenChange={onOptionalFeaturesOpenChange}
        coreFeaturesOpen={coreFeaturesOpen}
        onCoreFeaturesOpenChange={onCoreFeaturesOpenChange}
        saveScrollForRestore={saveScrollForRestore}
        restoreScrollAfterLayout={restoreScrollAfterLayout}
        jumpToDataRef={jumpToDataRef}
      />
      <BackupSettings
        enabledModules={enabledModules}
        onChooseBackupFolder={onChooseBackupFolder}
        onDownloadFullBackup={onDownloadFullBackup}
        encryptBackups={encryptBackups}
        setEncryptBackups={setEncryptBackups}
        getBackupPasswordRef={getBackupPasswordRef}
        setBackupPassword={setBackupPassword}
        onCheckForUpdates={onCheckForUpdates}
        checkingForUpdate={checkingForUpdate}
        onApplySettingsFromBackup={onApplySettingsFromBackup}
        dataMgmtOpen={dataMgmtOpen}
        onDataMgmtOpenChange={onDataMgmtOpenChange}
        hasBackupFolder={hasBackupFolder}
        saveScrollForRestore={saveScrollForRestore}
        restoreScrollAfterLayout={restoreScrollAfterLayout}
        jumpToDataRef={jumpToDataRef}
      />
    </div>
  );
}
