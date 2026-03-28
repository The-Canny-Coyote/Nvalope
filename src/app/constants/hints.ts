/**
 * Hint IDs and short labels for the "re-enable hints" list in Settings.
 * Label is shown in Settings when a hint is disabled; keep labels short.
 */
export const HINT_LABELS: Record<string, string> = {
  'receipt-intro': 'Receipt scanner intro',
  'receipt-upload': 'Upload image',
  'receipt-camera': 'Take photo',
  'receipt-glossary': 'Glossary',
  'receipt-totals': 'Subtotal, tax, total',
  'receipt-save': 'Save receipt',
  'receipt-add-envelope': 'Add to envelope',
  'overview-stats': 'Overview numbers',
  'overview-health': 'Budget health',
  'income-sources': 'Income sources',
  'income-add': 'Add income',
  'envelopes-list': 'Envelope list',
  'envelopes-add-expense': 'Add expense',
  'transactions-search': 'Search transactions',
  'transactions-filter': 'Filter',
  'transactions-edit': 'Edit transaction',
  'calendar-picker': 'Month/year',
  'calendar-day': 'Day events',
  'calendar-add': 'Add expense/income',
  'analytics-chart': 'Chart type',
  'analytics-category': 'Data category',
  'accessibility-modes': 'Preset modes',
  'accessibility-sliders': 'Sliders',
  'settings-core': 'Core features',
  'settings-added': 'Added features',
  'settings-data': 'Data management',
  'settings-data-choose-folder': 'Choose backup folder',
  'settings-data-download': 'Download full backup',
  'settings-data-export': 'Export budget data only',
  'settings-data-import': 'Import from file',
  'settings-data-updates': 'Check for updates',
  'main-wheel': 'Wheel menu',
  'main-support': 'Support',
  'main-theme': 'Light/dark theme',
  'main-glossary': 'Glossary',
  'main-storage': 'Storage usage',
  'accessibility-card-bar': 'Card bar rows',
  'accessibility-chonkiness': 'Chonkiness',
  'envelopes-budget-period': 'Budget period',
};

export function getHintLabel(id: string): string {
  return HINT_LABELS[id] ?? id;
}
