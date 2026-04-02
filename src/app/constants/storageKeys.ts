/**
 * All localStorage keys used by the app, in one place.
 * Convention: nvalope-kebab-case
 * Import from here rather than duplicating string literals across files.
 */
export const STORAGE_KEYS = {
  /** Zustand appStore persistence (layout mode, accessibility, etc.) */
  APP_PERSIST: 'nvalope-app-persist',
  /** Colorblind mode setting (managed outside Zustand persist for immediate reads) */
  COLORBLIND_MODE: 'nvalope-colorblind-mode',
  /** Layout scale preference (read before Zustand hydrates) */
  LAYOUT_SCALE: 'nvalope-layout-scale',
  /** Wheel scale preference (read before Zustand hydrates) */
  WHEEL_SCALE: 'nvalope-wheel-scale',
  /** Legacy premium flag (read before Zustand hydrates) */
  PREMIUM: 'nvalope-premium',
  /** Whether the app is installed as a PWA */
  PWA_INSTALLED: 'nvalope-pwa-installed',
  /** TTS (text-to-speech) enabled flag */
  TTS_ENABLED: 'nvalope-tts-enabled',
  /** Master toggle for contextual hints */
  HINTS_MASTER: 'nvalope-hints-master',
  /** List of individually dismissed hint IDs */
  HINTS_DISABLED: 'nvalope-hints-disabled',
  /** Whether the backup folder prompt has been seen */
  BACKUP_PROMPT_SEEN: 'nvalope-backup-prompt-seen',
  /** Whether the premium AI download notice has been seen */
  PREMIUM_AI_DOWNLOAD_NOTICE_SEEN: 'nvalope-premium-ai-download-notice-seen',
  /** Prefix for entitlement flags (append the entitlement key) */
  ENTITLEMENT_PREFIX: 'nvalope-entitlement-',
  /** Light/dark theme preference (next-themes compatible key) */
  THEME: 'theme',
} as const;
