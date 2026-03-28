export type ChartId =
  | 'spending-by-envelope'
  | 'spending-over-time'
  | 'income-vs-expenses'
  | 'envelope-usage'
  | 'top-envelopes'
  | 'income-by-source'
  | 'daily-spending'
  | 'savings-progress';

export type ChartDisplayType = 'pie' | 'bar' | 'area' | 'line';

export type SpendingOverTimeMonths = 3 | 6 | 12;

export type DailySpendingDays = 7 | 30 | 90;
