import { useState, useMemo, useCallback, memo } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { formatMoney, formatDate } from '@/app/utils/format';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { monthKeyFromYYYYMMDD, biweeklyPeriodKeyFromYYYYMMDD, weeklyPeriodKeyFromYYYYMMDD, isWithinLastDays } from '@/app/utils/date';
import { useTransactionFilter } from '@/app/contexts/TransactionFilterContext';
import { useAppStore } from '@/app/store/appStore';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Area,
  AreaChart,
  LineChart,
  Line,
} from 'recharts';
import type { AccessibilityMode } from '@/app/components/AccessibilityContent';

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

/** For each data category, which chart display types the user can choose. */
const CHART_DISPLAY_OPTIONS: Record<ChartId, ChartDisplayType[]> = {
  'spending-by-envelope': ['pie', 'bar'],
  'spending-over-time': ['area', 'line', 'bar'],
  'daily-spending': ['bar'],
  'income-vs-expenses': ['bar'],
  'envelope-usage': ['bar'],
  'top-envelopes': ['pie', 'bar'],
  'income-by-source': ['pie', 'bar'],
  'savings-progress': ['bar'],
};

const CHART_OPTIONS: { id: ChartId; label: string }[] = [
  { id: 'spending-by-envelope', label: 'Spending by envelope' },
  { id: 'spending-over-time', label: 'Spending over time' },
  { id: 'daily-spending', label: 'Daily spending' },
  { id: 'income-vs-expenses', label: 'Income vs expenses' },
  { id: 'envelope-usage', label: 'Envelope usage (spent vs limit)' },
  { id: 'top-envelopes', label: 'Top envelopes by spent' },
  { id: 'income-by-source', label: 'Income by source' },
  { id: 'savings-progress', label: 'Savings progress' },
];

const DISPLAY_LABELS: Record<ChartDisplayType, string> = {
  pie: 'Pie',
  bar: 'Bar',
  area: 'Area',
  line: 'Line',
};

/** Recharts Tooltip formatter: value as USD with a fixed label. Use negate for expense/spent so it displays with minus. */
function moneyTooltip(label: string, options?: { negate?: boolean }) {
  return (v: number | undefined) => [formatMoney(v != null ? (options?.negate ? -v : v) : 0), label] as [string, string];
}

/** Tooltip content for envelope charts: shows Spent, Left (remaining), and Limit when available. */
function EnvelopeChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value?: number; payload?: { name?: string; limit?: number; remaining?: number; value?: number; spent?: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const name = p?.name ?? label ?? '';
  const spent = p?.value ?? p?.spent ?? 0;
  const limit = p?.limit;
  const remaining = p?.remaining ?? (typeof limit === 'number' ? (limit ?? 0) - spent : undefined);
  const showRemaining = typeof remaining === 'number' && Number.isFinite(remaining);
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
      {name && <p className="font-medium text-foreground mb-1">{name}</p>}
      <p className="text-muted-foreground">Spent: {formatMoney(-spent)}</p>
      {showRemaining && <p className="text-muted-foreground">Left: {formatMoney(remaining)}</p>}
      {typeof limit === 'number' && Number.isFinite(limit) && <p className="text-muted-foreground">Limit: {formatMoney(limit)}</p>}
    </div>
  );
}

function getChartColors(mode: AccessibilityMode): { fill: string[]; stroke: string[]; gradient?: boolean; shadow?: boolean } {
  switch (mode) {
    case 'calm':
      return {
        fill: ['#94a3b8', '#b8c5d6', '#cbd5e1', '#e2e8f0', '#a5b4fc', '#c4b5fd', '#fbcfe8', '#bae6fd'],
        stroke: ['#64748b', '#94a3b8', '#94a3b8', '#cbd5e1', '#818cf8', '#a78bfa', '#f472b6', '#7dd3fc'],
        gradient: false,
        shadow: false,
      };
    case 'clear':
      return {
        fill: ['#0f766e', '#1e40af', '#9a3412', '#4c1d95', '#166534', '#1e3a8a', '#713f12', '#581c87'],
        stroke: ['#0d9488', '#2563eb', '#c2410c', '#6d28d9', '#16a34a', '#1d4ed8', '#a16207', '#7e22ce'],
        gradient: false,
        shadow: false,
      };
    case 'contrast':
      return {
        fill: ['#000000', '#404040', '#737373', '#a3a3a3', '#171717', '#525252', '#262626', '#737373'],
        stroke: ['#ffffff', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#fafafa', '#d4d4d4', '#e5e5e5', '#d4d4d4'],
        gradient: false,
        shadow: false,
      };
    case 'focus':
      return {
        fill: ['#15803d', '#1d4ed8', '#c2410c', '#7c2d12', '#14532d', '#1e3a8a', '#9a3412', '#4c1d95'],
        stroke: ['#22c55e', '#3b82f6', '#ea580c', '#c2410c', '#22c55e', '#2563eb', '#ea580c', '#7c3aed'],
        gradient: false,
        shadow: false,
      };
    case 'tactile':
      /* Same as standard; tactile only changes layout/touch targets */
      return {
        fill: ['#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#ec4899', '#3b82f6', '#f97316'],
        stroke: ['#14b8a6', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#f472b6', '#60a5fa', '#fb923c'],
        gradient: true,
        shadow: true,
      };
    default:
      return {
        fill: ['#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#ec4899', '#3b82f6', '#f97316'],
        stroke: ['#14b8a6', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#f472b6', '#60a5fa', '#fb923c'],
        gradient: true,
        shadow: true,
      };
  }
}

export interface AnalyticsContentProps {
  selectedMode?: AccessibilityMode;
}

export type SpendingOverTimeMonths = 3 | 6 | 12;
export type DailySpendingDays = 7 | 30 | 90;

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const RADIAN = Math.PI / 180;
/** Renders a value label inside a pie segment when showNumbers is true. */
function renderPieSegmentLabel(showNumbers: boolean, negate: boolean) {
  return (props: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; value?: number }) => {
    if (!showNumbers || props.value == null) return null;
    const { cx, cy, midAngle, innerRadius, outerRadius } = props;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const text = formatMoney(negate ? -(props.value) : props.value);
    return (
      <text x={x} y={y} fill="currentColor" textAnchor="middle" dominantBaseline="central" className="text-xs">
        {text}
      </text>
    );
  };
}

function AnalyticsContentInner({ selectedMode = 'standard' }: AnalyticsContentProps) {
  const { state, getBudgetSummaryForCurrentPeriod } = useBudget();
  const budgetPeriodMode = useAppStore((s) => s.budgetPeriodMode);
  const budgetPeriodModeSwitchDate = useAppStore((s) => s.budgetPeriodModeSwitchDate);
  const biweeklyPeriod1StartDay = useAppStore((s) => s.biweeklyPeriod1StartDay) ?? 1;
  const biweeklyPeriod1EndDay = useAppStore((s) => s.biweeklyPeriod1EndDay) ?? 14;
  const weekStartDay = useAppStore((s) => s.weekStartDay) ?? 0;
  // Summary depends on state and period settings; listing them ensures recompute when budget/period change.
  const { summary: periodSummary } = useMemo(() => getBudgetSummaryForCurrentPeriod(), [getBudgetSummaryForCurrentPeriod, state, budgetPeriodMode, biweeklyPeriod1StartDay, biweeklyPeriod1EndDay, weekStartDay]); // eslint-disable-line react-hooks/exhaustive-deps
  const filterContext = useTransactionFilter();
  const [selectedChart, setSelectedChart] = useState<ChartId>('spending-by-envelope');
  const [chartDisplayType, setChartDisplayType] = useState<ChartDisplayType>(() => CHART_DISPLAY_OPTIONS['spending-by-envelope'][0]);
  const [spendingOverTimeMonths, setSpendingOverTimeMonths] = useState<SpendingOverTimeMonths>(6);
  const [dailySpendingDays, setDailySpendingDays] = useState<DailySpendingDays>(30);
  const [showChartNumbers, setShowChartNumbers] = useState(true);
  const [envelopeOverview, setEnvelopeOverview] = useState<{ id: string; name: string } | null>(null);
  const handleEnvelopeChartClick = useCallback((data: { name?: string; envelopeId?: string }) => {
    if (data?.envelopeId && data?.name) setEnvelopeOverview({ id: data.envelopeId, name: data.name });
  }, []);
  const theme = getChartColors(selectedMode);
  const isDefault = selectedMode === 'standard';

  const allowedDisplays = CHART_DISPLAY_OPTIONS[selectedChart];
  const effectiveDisplay = allowedDisplays.includes(chartDisplayType) ? chartDisplayType : allowedDisplays[0];
  const setChartAndDisplay = (chart: ChartId) => {
    setSelectedChart(chart);
    setChartDisplayType(CHART_DISPLAY_OPTIONS[chart][0]);
  };

  const DAILY_SPENDING_WEEKLY_THRESHOLD = 500;

  const { spendingByEnvelope, spendingOverTime, dailySpending, dailySpendingIsWeekly, incomeVsExpenses, envelopeUsage, incomeBySource, savingsProgress, topEnvelopes } = useMemo(() => {
    const envelopes = state.envelopes;
    const usePeriodEnvelopes = (budgetPeriodMode === 'biweekly' || budgetPeriodMode === 'weekly') ? periodSummary.envelopes : null;
    const envelopeSource = usePeriodEnvelopes ?? envelopes.map((e) => ({ id: e.id, name: e.name, limit: e.limit, spent: e.spent, remaining: e.limit - e.spent }));
    const transactions = state.transactions;
    const income = state.income;
    const savingsGoals = state.savingsGoals;

    const byEnvelope = envelopeSource.map((e) => ({
      name: e.name,
      value: e.spent,
      limit: e.limit,
      remaining: e.limit - e.spent,
      fill: undefined as string | undefined,
      envelopeId: e.id,
    }));
    const totalSpent = envelopeSource.reduce((s, e) => s + e.spent, 0);
    const totalIncome = income.reduce((s, i) => s + i.amount, 0);

    const now = new Date();
    const monthCount = spendingOverTimeMonths;
    let spendingOverTimeData: { month: string; spent: number; income: number }[];

    const biweeklyOptions = { period1StartDay: biweeklyPeriod1StartDay, period1EndDay: biweeklyPeriod1EndDay };
    if (budgetPeriodMode === 'biweekly') {
      const thisPeriodKey = biweeklyPeriodKeyFromYYYYMMDD(now.toISOString().slice(0, 10), biweeklyOptions) ?? 0;
      const periodCount = monthCount * 2;
      const periodWindowStart = thisPeriodKey - (periodCount - 1);
      const byPeriod: Record<number, { spent: number; income: number }> = {};
      for (let i = 0; i < periodCount; i++) {
        byPeriod[thisPeriodKey - i] = { spent: 0, income: 0 };
      }
      for (const t of transactions) {
        const key = biweeklyPeriodKeyFromYYYYMMDD(t.date, biweeklyOptions);
        if (key == null || key < periodWindowStart || key > thisPeriodKey) continue;
        if (byPeriod[key] != null) byPeriod[key].spent += t.amount;
      }
      for (const i of income) {
        const key = biweeklyPeriodKeyFromYYYYMMDD(i.date, biweeklyOptions);
        if (key == null || key < periodWindowStart || key > thisPeriodKey) continue;
        if (byPeriod[key] != null) byPeriod[key].income += i.amount;
      }
      spendingOverTimeData = Object.entries(byPeriod)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([key]) => {
          const k = Number(key);
          const m = Math.floor((k % 24) / 2);
          const periodNum = (k % 24) % 2 === 0 ? 1 : 2;
          const label = `${MONTH_NAMES_SHORT[m]} P${periodNum}`;
          return { month: label, spent: byPeriod[k].spent, income: byPeriod[k].income };
        });
    } else if (budgetPeriodMode === 'weekly') {
      const thisWeekKey = weeklyPeriodKeyFromYYYYMMDD(now.toISOString().slice(0, 10), weekStartDay) ?? 0;
      const weekCount = Math.min(12, Math.max(4, monthCount * 4));
      const weekWindowStart = thisWeekKey - (weekCount - 1);
      const byWeek: Record<number, { spent: number; income: number }> = {};
      for (let i = 0; i < weekCount; i++) {
        byWeek[thisWeekKey - i] = { spent: 0, income: 0 };
      }
      for (const t of transactions) {
        const key = weeklyPeriodKeyFromYYYYMMDD(t.date, weekStartDay);
        if (key == null || key < weekWindowStart || key > thisWeekKey) continue;
        if (byWeek[key] != null) byWeek[key].spent += t.amount;
      }
      for (const i of income) {
        const key = weeklyPeriodKeyFromYYYYMMDD(i.date, weekStartDay);
        if (key == null || key < weekWindowStart || key > thisWeekKey) continue;
        if (byWeek[key] != null) byWeek[key].income += i.amount;
      }
      spendingOverTimeData = Object.entries(byWeek)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([key]) => {
          const k = Number(key);
          const weekMs = k * 7 * 24 * 60 * 60 * 1000;
          const weekStart = new Date(weekMs);
          const label = `Wk ${MONTH_NAMES_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`;
          return { month: label, spent: byWeek[k].spent, income: byWeek[k].income };
        });
    } else {
      const thisMonth = now.getFullYear() * 12 + now.getMonth();
      const monthWindowStart = thisMonth - (monthCount - 1);
      const switchDate = budgetPeriodModeSwitchDate;
      if (switchDate && monthKeyFromYYYYMMDD(switchDate) != null) {
        const switchMonthKey = monthKeyFromYYYYMMDD(switchDate)!;
        const byPeriod: Record<number, { spent: number; income: number }> = {};
        const byMonth: Record<number, { spent: number; income: number }> = {};
        for (let i = 0; i < monthCount; i++) {
          const mk = thisMonth - i;
          if (mk < switchMonthKey) {
            byPeriod[mk * 2] = { spent: 0, income: 0 };
            byPeriod[mk * 2 + 1] = { spent: 0, income: 0 };
          } else {
            byMonth[mk] = { spent: 0, income: 0 };
          }
        }
        for (const t of transactions) {
          const txMonthKey = monthKeyFromYYYYMMDD(t.date);
          if (txMonthKey == null || txMonthKey < monthWindowStart || txMonthKey > thisMonth) continue;
          if (txMonthKey < switchMonthKey) {
            const key = biweeklyPeriodKeyFromYYYYMMDD(t.date, biweeklyOptions);
            if (key != null && byPeriod[key] != null) byPeriod[key].spent += t.amount;
          } else if (byMonth[txMonthKey] != null) {
            byMonth[txMonthKey].spent += t.amount;
          }
        }
        for (const i of income) {
          const incMonthKey = monthKeyFromYYYYMMDD(i.date);
          if (incMonthKey == null || incMonthKey < monthWindowStart || incMonthKey > thisMonth) continue;
          if (incMonthKey < switchMonthKey) {
            const key = biweeklyPeriodKeyFromYYYYMMDD(i.date, biweeklyOptions);
            if (key != null && byPeriod[key] != null) byPeriod[key].income += i.amount;
          } else if (byMonth[incMonthKey] != null) {
            byMonth[incMonthKey].income += i.amount;
          }
        }
        const periodEntries = Object.entries(byPeriod)
          .map(([key]) => {
            const k = Number(key);
            const m = Math.floor((k % 24) / 2);
            const periodNum = (k % 24) % 2 === 0 ? 1 : 2;
            const y = Math.floor(k / 24);
            return { sortKey: y * 10000 + (m + 1) * 100 + (periodNum === 1 ? 1 : 15), month: `${MONTH_NAMES_SHORT[m]} P${periodNum}`, spent: byPeriod[k].spent, income: byPeriod[k].income };
          });
        const monthEntries = Object.entries(byMonth)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([key]) => {
            const m = Number(key) % 12;
            const y = Math.floor(Number(key) / 12);
            return { sortKey: y * 10000 + (m + 1) * 100 + 1, month: `${MONTH_NAMES_SHORT[m]} ${y}`, spent: byMonth[Number(key)].spent, income: byMonth[Number(key)].income };
          });
        spendingOverTimeData = [...periodEntries, ...monthEntries].sort((a, b) => a.sortKey - b.sortKey).map(({ month, spent, income }) => ({ month, spent, income }));
      } else {
        const byMonth: Record<number, { spent: number; income: number }> = {};
        for (let i = 0; i < monthCount; i++) {
          byMonth[thisMonth - i] = { spent: 0, income: 0 };
        }
        for (const t of transactions) {
          const key = monthKeyFromYYYYMMDD(t.date);
          if (key == null || key < monthWindowStart || key > thisMonth) continue;
          if (byMonth[key] != null) byMonth[key].spent += t.amount;
        }
        for (const i of income) {
          const key = monthKeyFromYYYYMMDD(i.date);
          if (key == null || key < monthWindowStart || key > thisMonth) continue;
          if (byMonth[key] != null) byMonth[key].income += i.amount;
        }
        spendingOverTimeData = Object.entries(byMonth)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([key]) => {
            const m = Number(key) % 12;
            const y = Math.floor(Number(key) / 12);
            const label = `${MONTH_NAMES_SHORT[m]} ${y}`;
            return { month: label, spent: byMonth[Number(key)].spent, income: byMonth[Number(key)].income };
          });
      }
    }

    const days = dailySpendingDays;
    const transactionsInWindow = transactions.filter((t) => isWithinLastDays(t.date, days, now));
    let dailySpendingData: { date: string; spent: number }[];
    let dailySpendingIsWeekly = false;

    if (transactionsInWindow.length > DAILY_SPENDING_WEEKLY_THRESHOLD) {
      dailySpendingIsWeekly = true;
      const weekStarts: Record<string, number> = {};
      for (let d = 0; d <= days; d += 7) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);
        const iso = date.toISOString().slice(0, 10);
        weekStarts[iso] = 0;
      }
      for (const t of transactionsInWindow) {
        const d = new Date(t.date);
        const day = d.getDay();
        const start = new Date(d);
        start.setDate(d.getDate() - day);
        const iso = start.toISOString().slice(0, 10);
        if (weekStarts[iso] != null) weekStarts[iso] += t.amount;
      }
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dailySpendingData = Object.entries(weekStarts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([iso, spent]) => {
          const [_y, m, day] = iso.split('-').map(Number);
          const label = `Week of ${monthNames[m - 1]} ${day}`;
          return { date: label, spent };
        });
    } else {
      const lastN: Record<string, number> = {};
      for (let d = days - 1; d >= 0; d--) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);
        lastN[date.toISOString().slice(0, 10)] = 0;
      }
      for (const t of transactionsInWindow) {
        if (lastN[t.date] != null) lastN[t.date] += t.amount;
      }
      dailySpendingData = Object.entries(lastN)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, spent]) => ({ date: date.slice(5), spent }));
    }

    const incomeVsExpensesData = [
      { name: 'Income', amount: totalIncome },
      { name: 'Expenses', amount: totalSpent },
    ];

    const envelopeUsageData = envelopeSource.map((e) => ({
      name: e.name,
      spent: e.spent,
      limit: e.limit,
      remaining: e.limit - e.spent,
      usage: e.limit > 0 ? Math.min(100, (e.spent / e.limit) * 100) : 0,
    }));

    const incomeBySourceData = income.reduce((acc, i) => {
      const existing = acc.find((x) => x.name === i.source);
      if (existing) existing.value += i.amount;
      else acc.push({ name: i.source, value: i.amount });
      return acc;
    }, [] as { name: string; value: number }[]);

    const savingsProgressData = savingsGoals.map((g) => ({
      name: g.name,
      current: g.currentAmount,
      target: g.targetAmount,
      pct: g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0,
    }));

    const topEnvelopes = [...envelopeSource].sort((a, b) => b.spent - a.spent).slice(0, 8);
    return {
      spendingByEnvelope: byEnvelope.filter((d) => d.value > 0),
      spendingOverTime: spendingOverTimeData,
      dailySpending: dailySpendingData,
      dailySpendingIsWeekly,
      incomeVsExpenses: incomeVsExpensesData,
      envelopeUsage: envelopeUsageData,
      incomeBySource: incomeBySourceData,
      savingsProgress: savingsProgressData,
      topEnvelopes,
    };
  }, [state.envelopes, state.transactions, state.income, state.savingsGoals, spendingOverTimeMonths, dailySpendingDays, budgetPeriodMode, budgetPeriodModeSwitchDate, biweeklyPeriod1StartDay, biweeklyPeriod1EndDay, weekStartDay, periodSummary]);

  const chartContainerClass = isDefault
    ? 'rounded-xl border border-border bg-card p-4 shadow-lg ring-1 ring-black/5'
    : 'rounded-lg border border-border bg-card p-4';

  const envelopeOverviewTransactions = useMemo(() => {
    if (!envelopeOverview) return [];
    return state.transactions
      .filter((t) => t.envelopeId === envelopeOverview.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  }, [state.transactions, envelopeOverview]);

  const envelopeListItems = useMemo(() => {
    if (selectedChart === 'spending-by-envelope') return spendingByEnvelope.filter((d): d is typeof d & { envelopeId: string } => !!d.envelopeId);
    if (selectedChart === 'top-envelopes') return topEnvelopes.map((e) => ({ name: e.name, value: e.spent, envelopeId: e.id }));
    return [];
  }, [selectedChart, spendingByEnvelope, topEnvelopes]);

  const chartAriaLabel = useMemo(() => {
    const opt = CHART_OPTIONS.find((o) => o.id === selectedChart);
    return opt ? `${opt.label} chart` : 'Analytics chart';
  }, [selectedChart]);

  const csvContent = useMemo(() => {
    const escape = (v: string | number) => {
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    switch (selectedChart) {
      case 'spending-by-envelope':
        return ['Envelope,Spent,Remaining', ...spendingByEnvelope.map((d) => `${escape(d.name)},${escape(d.value)},${escape(typeof d.remaining === 'number' ? d.remaining : '')}`)].join('\n');
      case 'spending-over-time':
        return ['Month,Spent,Income', ...spendingOverTime.map((d) => `${escape(d.month)},${escape(d.spent)},${escape(d.income)}`)].join('\n');
      case 'daily-spending':
        return ['Date,Spent', ...dailySpending.map((d) => `${escape(d.date)},${escape(d.spent)}`)].join('\n');
      case 'income-vs-expenses':
        return ['Category,Amount', ...incomeVsExpenses.map((d) => `${escape(d.name)},${escape(d.amount)}`)].join('\n');
      case 'envelope-usage':
        return ['Envelope,Spent,Limit,Remaining,Usage %', ...envelopeUsage.map((d) => `${escape(d.name)},${escape(d.spent)},${escape(d.limit)},${escape(d.remaining)},${escape(d.usage.toFixed(0))}`)].join('\n');
      case 'top-envelopes': {
        return ['Envelope,Spent,Remaining', ...topEnvelopes.map((e) => `${escape(e.name)},${escape(e.spent)},${escape((e.limit ?? 0) - e.spent)}`)].join('\n');
      }
      case 'income-by-source':
        return ['Source,Income', ...incomeBySource.map((d) => `${escape(d.name)},${escape(d.value)}`)].join('\n');
      case 'savings-progress':
        return ['Goal,Current,Target,Progress %', ...savingsProgress.map((d) => `${escape(d.name)},${escape(d.current)},${escape(d.target)},${escape(d.pct.toFixed(0))}`)].join('\n');
      default:
        return '';
    }
  }, [
    selectedChart,
    spendingByEnvelope,
    spendingOverTime,
    dailySpending,
    incomeVsExpenses,
    envelopeUsage,
    incomeBySource,
    savingsProgress,
    topEnvelopes,
  ]);

  const handleDownloadCsv = () => {
    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${selectedChart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartSummaryText = useMemo(() => {
    switch (selectedChart) {
      case 'spending-by-envelope': {
        if (spendingByEnvelope.length === 0) return 'No spending by envelope yet.';
        const n = spendingByEnvelope.length;
        const totalSpent = spendingByEnvelope.reduce((s, d) => s + d.value, 0);
        const totalLeft = spendingByEnvelope.reduce((s, d) => s + (typeof d.remaining === 'number' ? d.remaining : 0), 0);
        return `${n} envelope${n !== 1 ? 's' : ''}, total spent ${formatMoney(-totalSpent)}, total left ${formatMoney(totalLeft)}.`;
      }
      case 'spending-over-time':
        return `Last ${spendingOverTimeMonths} months spending trend. ${spendingOverTime.length} months shown.`;
      case 'daily-spending':
        return `Daily spending for the last ${dailySpendingDays} days.`;
      case 'income-vs-expenses':
        return `Income ${formatMoney(incomeVsExpenses[0]?.amount ?? 0)}, expenses ${formatMoney(-(incomeVsExpenses[1]?.amount ?? 0))}.`;
      case 'envelope-usage':
        if (envelopeUsage.length === 0) return 'No envelopes to show usage.';
        return `${envelopeUsage.length} envelopes, spent versus limit; tooltips show spent, left, and limit.`;
      case 'top-envelopes':
        if (topEnvelopes.length === 0) return 'No envelope spending yet.';
        return `Top ${Math.min(8, topEnvelopes.length)} envelopes by amount spent; tooltips show spent and left.`;
      case 'income-by-source':
        if (incomeBySource.length === 0) return 'No income by source yet.';
        return `${incomeBySource.length} income source${incomeBySource.length !== 1 ? 's' : ''}.`;
      case 'savings-progress':
        if (savingsProgress.length === 0) return 'No savings goals yet.';
        return `${savingsProgress.length} savings goal${savingsProgress.length !== 1 ? 's' : ''}, current versus target.`;
      default:
        return 'Chart data summary.';
    }
  }, [
    selectedChart,
    spendingByEnvelope,
    spendingOverTime.length,
    spendingOverTimeMonths,
    dailySpendingDays,
    incomeVsExpenses,
    envelopeUsage.length,
    incomeBySource.length,
    savingsProgress.length,
    topEnvelopes.length,
  ]);

  const renderChart = () => {
    const colors = theme.fill;
    const strokeColors = theme.stroke;

    switch (selectedChart) {
      case 'spending-by-envelope': {
        if (spendingByEnvelope.length === 0) return <EmptyChart message="Add expenses to envelopes to see spending by category." />;
        if (effectiveDisplay === 'bar') {
          const barData = spendingByEnvelope.filter((d): d is typeof d & { envelopeId: string } => !!d.envelopeId);
          return (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
                <Tooltip content={<EnvelopeChartTooltip />} />
                <Bar
                  dataKey="value"
                  name="Spent"
                  fill={colors[0]}
                  stroke={strokeColors[0]}
                  radius={isDefault ? [4, 4, 0, 0] : [2, 2, 0, 0]}
                  label={showChartNumbers ? { position: 'top' as const, formatter: (v: number) => formatMoney(-v) } : false}
                  onClick={handleEnvelopeChartClick}
                />
              </BarChart>
            </ResponsiveContainer>
          );
        }
        return (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Pie
                data={spendingByEnvelope}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={isDefault ? 110 : 100}
                innerRadius={isDefault ? 50 : 0}
                paddingAngle={isDefault ? 2 : 0}
                stroke={isDefault ? 'rgba(255,255,255,0.4)' : undefined}
                strokeWidth={isDefault ? 1.5 : 1}
                label={showChartNumbers ? renderPieSegmentLabel(showChartNumbers, true) : false}
                onClick={handleEnvelopeChartClick}
              >
                {spendingByEnvelope.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} stroke={strokeColors[i % strokeColors.length]} />
                ))}
              </Pie>
              <Tooltip content={<EnvelopeChartTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      }

      case 'spending-over-time': {
        if (effectiveDisplay === 'line') {
          return (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={spendingOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={moneyTooltip('Spent', { negate: true })} />
                <Legend />
                <Line type="monotone" dataKey="spent" name="Spent" stroke={strokeColors[0]} strokeWidth={2} dot={{ fill: colors[0] }} />
              </LineChart>
            </ResponsiveContainer>
          );
        }
        if (effectiveDisplay === 'bar') {
          return (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={spendingOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={moneyTooltip('Spent', { negate: true })} />
                <Bar
                  dataKey="spent"
                  name="Spent"
                  fill={colors[0]}
                  stroke={strokeColors[0]}
                  radius={[4, 4, 0, 0]}
                  label={showChartNumbers ? { position: 'top' as const, formatter: (v: number) => formatMoney(-v) } : false}
                />
              </BarChart>
            </ResponsiveContainer>
          );
        }
        return (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={spendingOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {theme.gradient && (
                  <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors[0]} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={colors[0]} stopOpacity={0} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={moneyTooltip('Spent', { negate: true })} />
              <Legend />
              <Area
                type="monotone"
                dataKey="spent"
                name="Spent"
                stroke={strokeColors[0]}
                fill={theme.gradient ? 'url(#spentGrad)' : colors[0]}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      }

      case 'daily-spending': {
        return (
          <>
            {dailySpendingIsWeekly && (
              <p className="text-xs text-muted-foreground mb-2" role="status">
                Showing weekly totals for clarity.
              </p>
            )}
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dailySpending} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={moneyTooltip('Spent', { negate: true })} />
              <Bar
                dataKey="spent"
                name="Spent"
                fill={colors[0]}
                stroke={strokeColors[0]}
                radius={isDefault ? [4, 4, 0, 0] : [2, 2, 0, 0]}
                strokeWidth={isDefault ? 1 : 0}
                label={showChartNumbers ? { position: 'top' as const, formatter: (v: number) => formatMoney(-v) } : false}
              />
            </BarChart>
          </ResponsiveContainer>
          </>
        );
      }

      case 'income-vs-expenses': {
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={incomeVsExpenses} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: number | undefined, _name: string | undefined, props: { payload?: { name: string } }) =>
                  [formatMoney(props.payload?.name === 'Expenses' ? -(v ?? 0) : (v ?? 0)), props.payload?.name ?? ''] as [string, string]}
              />
              <Bar
                dataKey="amount"
                name="Amount"
                fill={colors[0]}
                stroke={strokeColors[0]}
                radius={isDefault ? [6, 6, 0, 0] : [2, 2, 0, 0]}
                strokeWidth={isDefault ? 1 : 0}
                label={showChartNumbers ? { position: 'top' as const, formatter: (v: number, _n: string, props: { payload?: { name: string } }) => formatMoney(props.payload?.name === 'Expenses' ? -(v ?? 0) : (v ?? 0)) } : false}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      }

      case 'envelope-usage': {
        if (envelopeUsage.length === 0) return <EmptyChart message="Create envelopes to see usage." />;
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={envelopeUsage} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 11 }} />
              <Tooltip content={<EnvelopeChartTooltip />} />
              <Bar
                dataKey="spent"
                name="Spent"
                fill={colors[0]}
                stroke={strokeColors[0]}
                radius={[0, 4, 4, 0]}
                label={showChartNumbers ? { position: 'right' as const, formatter: (v: number) => formatMoney(-v) } : false}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      }

      case 'top-envelopes': {
        if (topEnvelopes.length === 0) return <EmptyChart message="No envelope spending yet." />;
        const data = topEnvelopes.map((e) => ({
          name: e.name,
          value: e.spent,
          spent: e.spent,
          envelopeId: e.id,
          limit: e.limit,
          remaining: (e.limit ?? 0) - e.spent,
        }));
        if (effectiveDisplay === 'pie') {
          return (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={isDefault ? 110 : 100}
                  innerRadius={isDefault ? 50 : 0}
                  paddingAngle={isDefault ? 2 : 0}
                  stroke={isDefault ? 'rgba(255,255,255,0.4)' : undefined}
                  strokeWidth={isDefault ? 1.5 : 1}
                  label={showChartNumbers ? renderPieSegmentLabel(showChartNumbers, true) : false}
                  onClick={handleEnvelopeChartClick}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} stroke={strokeColors[i % strokeColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<EnvelopeChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          );
        }
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
              <Tooltip content={<EnvelopeChartTooltip />} />
              <Bar
                dataKey="spent"
                name="Spent"
                fill={colors[0]}
                stroke={strokeColors[0]}
                radius={isDefault ? [4, 4, 0, 0] : [2, 2, 0, 0]}
                label={showChartNumbers ? { position: 'top' as const, formatter: (v: number) => formatMoney(-v) } : false}
                onClick={handleEnvelopeChartClick}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      }

      case 'income-by-source': {
        if (incomeBySource.length === 0) return <EmptyChart message="Add income to see breakdown by source." />;
        if (effectiveDisplay === 'bar') {
          return (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={incomeBySource} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={moneyTooltip('Income')} />
                <Bar
                  dataKey="value"
                  name="Income"
                  fill={colors[0]}
                  stroke={strokeColors[0]}
                  radius={[4, 4, 0, 0]}
                  label={showChartNumbers ? { position: 'top' as const, formatter: (v: number) => formatMoney(v) } : false}
                />
              </BarChart>
            </ResponsiveContainer>
          );
        }
        return (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Pie
                data={incomeBySource}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={isDefault ? 110 : 100}
                innerRadius={isDefault ? 50 : 0}
                paddingAngle={isDefault ? 2 : 0}
                stroke={isDefault ? 'rgba(255,255,255,0.4)' : undefined}
                strokeWidth={isDefault ? 1.5 : 1}
                label={showChartNumbers ? renderPieSegmentLabel(showChartNumbers, false) : false}
              >
                {incomeBySource.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} stroke={strokeColors[i % strokeColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={moneyTooltip('Income')} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      }

      case 'savings-progress': {
        if (savingsProgress.length === 0) return <EmptyChart message="Add savings goals to track progress." />;
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={savingsProgress} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: number | undefined, name: string | undefined, props: { payload?: { current: number; target: number; pct: number } }) =>
                  [formatMoney(props.payload?.current ?? 0) + ' / ' + formatMoney(props.payload?.target ?? 0) + ` (${(props.payload?.pct ?? 0).toFixed(0)}%)`, 'Progress']}
              />
              <Bar
                dataKey="current"
                name="Current"
                fill={colors[0]}
                stroke={strokeColors[0]}
                radius={[4, 4, 0, 0]}
                label={showChartNumbers ? { position: 'top' as const, formatter: (v: number) => formatMoney(v) } : false}
              />
              <Bar dataKey="target" name="Target" fill="transparent" stroke={strokeColors[1]} strokeDasharray="4 2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-primary">Analytics</h3>
      <p className="text-sm text-muted-foreground">
        One chart at a time. Choose a chart below; styling adapts to your accessibility mode.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer" htmlFor="analytics-show-numbers">
          <Checkbox
            id="analytics-show-numbers"
            checked={showChartNumbers}
            onCheckedChange={setShowChartNumbers}
            aria-describedby="analytics-show-numbers-desc"
            className="size-5 shrink-0 rounded"
          />
          <span className="text-sm font-medium text-foreground">Show numbers on charts</span>
        </label>
        <span id="analytics-show-numbers-desc" className="sr-only">
          When checked, values appear on pie segments and bars; when unchecked, numbers are hidden.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label htmlFor="analytics-chart-select" className="text-sm font-medium text-foreground">
              Data category
            </label>
          </div>
          <select
            id="analytics-chart-select"
            value={selectedChart}
            onChange={(e) => setChartAndDisplay(e.target.value as ChartId)}
            className="w-full max-w-xs px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Select data category"
          >
            {CHART_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {allowedDisplays.length > 1 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label htmlFor="analytics-display-select" className="text-sm font-medium text-foreground">
                Display as
              </label>
            </div>
            <select
              id="analytics-display-select"
              value={effectiveDisplay}
              onChange={(e) => setChartDisplayType(e.target.value as ChartDisplayType)}
              className="w-full max-w-[8rem] px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Select chart display type"
            >
              {allowedDisplays.map((d) => (
                <option key={d} value={d}>
                  {DISPLAY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {csvContent && (
        <button
          type="button"
          onClick={handleDownloadCsv}
          className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Download current chart as CSV"
        >
          Download CSV
        </button>
      )}

      {selectedChart === 'spending-over-time' && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="analytics-spending-over-time-range" className="text-sm font-medium text-foreground">
            Range
          </label>
          <select
            id="analytics-spending-over-time-range"
            value={spendingOverTimeMonths}
            onChange={(e) => setSpendingOverTimeMonths(Number(e.target.value) as SpendingOverTimeMonths)}
            className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Spending over time range in months"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        </div>
      )}

      {selectedChart === 'daily-spending' && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="analytics-daily-spending-range" className="text-sm font-medium text-foreground">
            Range
          </label>
          <select
            id="analytics-daily-spending-range"
            value={dailySpendingDays}
            onChange={(e) => setDailySpendingDays(Number(e.target.value) as DailySpendingDays)}
            className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Daily spending range in days"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      )}

      {(selectedChart === 'spending-by-envelope' || selectedChart === 'top-envelopes') && envelopeListItems.length > 0 && filterContext && (
        <>
          <p className="text-xs text-muted-foreground" id="analytics-envelope-list-desc">
            Select an envelope below to view its transactions, or click a chart segment.
          </p>
          <div className="flex flex-wrap gap-1.5" role="list" aria-describedby="analytics-envelope-list-desc">
            {envelopeListItems.map((item) => (
              <button
                key={item.envelopeId}
                type="button"
                onClick={() => handleEnvelopeChartClick({ envelopeId: item.envelopeId, name: item.name })}
                className="px-2 py-1 text-xs border border-border rounded bg-card text-foreground hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label={`View transactions for ${item.name}`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </>
      )}
      <Dialog open={envelopeOverview != null} onOpenChange={(open) => !open && setEnvelopeOverview(null)}>
        <DialogContent className="max-w-[min(28rem,100%)] max-h-[85vh] flex flex-col p-0 gap-0" aria-describedby={envelopeOverview ? 'envelope-overview-desc' : undefined}>
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle id="envelope-overview-title">
              {envelopeOverview ? `${envelopeOverview.name} — transactions` : ''}
            </DialogTitle>
          </DialogHeader>
          <div id="envelope-overview-desc" className="px-4 pb-4 overflow-y-auto min-h-0 text-sm">
            {envelopeOverview && (
              <>
                <p className="text-muted-foreground mb-3">
                  Brief overview. Last {envelopeOverviewTransactions.length} transaction{envelopeOverviewTransactions.length !== 1 ? 's' : ''} (newest first).
                </p>
                {envelopeOverviewTransactions.length === 0 ? (
                  <p className="text-muted-foreground">No transactions in this envelope yet.</p>
                ) : (
                  <ul className="space-y-2 list-none p-0 m-0">
                    {envelopeOverviewTransactions.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/60 pb-2 last:border-0">
                        <span className="text-muted-foreground shrink-0">{formatDate(t.date)}</span>
                        <span className="font-nums font-medium">{formatMoney(-t.amount)}</span>
                        {t.description && <span className="text-foreground break-words">{t.description}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <figure
        className={chartContainerClass}
        role="figure"
        aria-label={chartAriaLabel}
        aria-describedby="analytics-chart-summary"
      >
        <p id="analytics-chart-summary" className="sr-only">
          {chartSummaryText}
        </p>
        {renderChart()}
      </figure>
    </div>
  );
}

export const AnalyticsContent = memo(AnalyticsContentInner);

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm" role="status">
      {message}
    </div>
  );
}
