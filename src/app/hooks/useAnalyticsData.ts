import { useMemo } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { useAppStore } from '@/app/store/appStore';
import { monthKeyFromYYYYMMDD, biweeklyPeriodKeyFromYYYYMMDD, weeklyPeriodKeyFromYYYYMMDD, isWithinLastDays } from '@/app/utils/date';
import type { SpendingOverTimeMonths, DailySpendingDays } from '@/app/components/analyticsChartTypes';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAILY_SPENDING_WEEKLY_THRESHOLD = 500;

export type AnalyticsChartData = {
  spendingByEnvelope: Array<{
    name: string;
    value: number;
    limit: number;
    remaining: number;
    fill?: string;
    envelopeId: string;
  }>;
  spendingOverTime: Array<{ month: string; spent: number; income: number }>;
  dailySpending: Array<{ date: string; spent: number }>;
  dailySpendingIsWeekly: boolean;
  incomeVsExpenses: Array<{ name: string; amount: number }>;
  envelopeUsage: Array<{ name: string; spent: number; limit: number; remaining: number; usage: number }>;
  incomeBySource: Array<{ name: string; value: number }>;
  savingsProgress: Array<{ name: string; current: number; target: number; pct: number }>;
  topEnvelopes: Array<{ id: string; name: string; limit: number; spent: number; remaining: number }>;
};

export function useAnalyticsData(
  spendingOverTimeMonths: SpendingOverTimeMonths,
  dailySpendingDays: DailySpendingDays
): AnalyticsChartData {
  const { state, getBudgetSummaryForCurrentPeriod } = useBudget();
  const budgetPeriodMode = useAppStore((s) => s.budgetPeriodMode);
  const budgetPeriodModeSwitchDate = useAppStore((s) => s.budgetPeriodModeSwitchDate);
  const biweeklyPeriod1StartDay = useAppStore((s) => s.biweeklyPeriod1StartDay) ?? 1;
  const biweeklyPeriod1EndDay = useAppStore((s) => s.biweeklyPeriod1EndDay) ?? 14;
  const weekStartDay = useAppStore((s) => s.weekStartDay) ?? 0;
  // Summary depends on state and period settings; listing them ensures recompute when budget/period change.
  const { summary: periodSummary } = useMemo(
    () => getBudgetSummaryForCurrentPeriod(),
    [getBudgetSummaryForCurrentPeriod, state, budgetPeriodMode, biweeklyPeriod1StartDay, biweeklyPeriod1EndDay, weekStartDay] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return useMemo(() => {
    const envelopes = state.envelopes;
    const usePeriodEnvelopes = budgetPeriodMode === 'biweekly' || budgetPeriodMode === 'weekly' ? periodSummary.envelopes : null;
    const envelopeSource =
      usePeriodEnvelopes ?? envelopes.map((e) => ({ id: e.id, name: e.name, limit: e.limit, spent: e.spent, remaining: e.limit - e.spent }));
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
        const periodEntries = Object.entries(byPeriod).map(([key]) => {
          const k = Number(key);
          const m = Math.floor((k % 24) / 2);
          const periodNum = (k % 24) % 2 === 0 ? 1 : 2;
          const y = Math.floor(k / 24);
          return {
            sortKey: y * 10000 + (m + 1) * 100 + (periodNum === 1 ? 1 : 15),
            month: `${MONTH_NAMES_SHORT[m]} P${periodNum}`,
            spent: byPeriod[k].spent,
            income: byPeriod[k].income,
          };
        });
        const monthEntries = Object.entries(byMonth)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([key]) => {
            const m = Number(key) % 12;
            const y = Math.floor(Number(key) / 12);
            return {
              sortKey: y * 10000 + (m + 1) * 100 + 1,
              month: `${MONTH_NAMES_SHORT[m]} ${y}`,
              spent: byMonth[Number(key)].spent,
              income: byMonth[Number(key)].income,
            };
          });
        spendingOverTimeData = [...periodEntries, ...monthEntries]
          .sort((a, b) => a.sortKey - b.sortKey)
          .map(({ month, spent, income }) => ({ month, spent, income }));
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

    // incomeVsExpenses should use the same scope as totalSpent —
    // period-filtered for biweekly/weekly, all-time for monthly.
    const totalIncomeForChart =
      (budgetPeriodMode === 'biweekly' || budgetPeriodMode === 'weekly')
        ? periodSummary.totalIncome
        : income.reduce((s, i) => s + i.amount, 0);

    const incomeVsExpensesData = [
      { name: 'Income', amount: totalIncomeForChart },
      { name: 'Expenses', amount: totalSpent },
    ];

    const envelopeUsageData = envelopeSource.map((e) => ({
      name: e.name,
      spent: e.spent,
      limit: e.limit,
      remaining: e.limit - e.spent,
      usage: e.limit > 0 ? Math.min(100, (e.spent / e.limit) * 100) : 0,
    }));

    const incomeBySourceData = income.reduce(
      (acc, i) => {
        const existing = acc.find((x) => x.name === i.source);
        if (existing) existing.value += i.amount;
        else acc.push({ name: i.source, value: i.amount });
        return acc;
      },
      [] as { name: string; value: number }[]
    );

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
  }, [
    state.envelopes,
    state.transactions,
    state.income,
    state.savingsGoals,
    spendingOverTimeMonths,
    dailySpendingDays,
    budgetPeriodMode,
    budgetPeriodModeSwitchDate,
    biweeklyPeriod1StartDay,
    biweeklyPeriod1EndDay,
    weekStartDay,
    periodSummary,
  ]);
}
