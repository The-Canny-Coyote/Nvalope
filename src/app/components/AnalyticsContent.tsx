import { useState, useMemo, useCallback, memo } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { formatMoney, formatDate } from '@/app/utils/format';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { useTransactionFilter } from '@/app/contexts/TransactionFilterContext';
import type { AccessibilityMode } from '@/app/components/accessibilityMode';
import { useAnalyticsData } from '@/app/hooks/useAnalyticsData';
import { getChartColors } from '@/app/components/analyticsChartUtils';
import {
  SpendingByEnvelopeChart,
  SpendingOverTimeChart,
  DailySpendingChart,
  IncomeVsExpensesChart,
  EnvelopeUsageChart,
  TopEnvelopesChart,
  IncomeBySourceChart,
  SavingsProgressChart,
} from '@/app/components/analytics/charts';
import type { ChartId, ChartDisplayType, SpendingOverTimeMonths, DailySpendingDays } from '@/app/components/analyticsChartTypes';

export type { ChartId, ChartDisplayType, SpendingOverTimeMonths, DailySpendingDays } from '@/app/components/analyticsChartTypes';

function csvEscape(value: unknown): string {
  const str = String(value ?? '');
  // Prefix formula-triggering characters to prevent CSV injection in Excel/Sheets
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  // Wrap in quotes if the value contains commas, quotes, or newlines
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

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

export interface AnalyticsContentProps {
  selectedMode?: AccessibilityMode;
}

function AnalyticsContentInner({ selectedMode = 'standard' }: AnalyticsContentProps) {
  const { state } = useBudget();
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

  const {
    spendingByEnvelope,
    spendingOverTime,
    dailySpending,
    dailySpendingIsWeekly,
    incomeVsExpenses,
    envelopeUsage,
    incomeBySource,
    savingsProgress,
    topEnvelopes,
  } = useAnalyticsData(spendingOverTimeMonths, dailySpendingDays);

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
    switch (selectedChart) {
      case 'spending-by-envelope':
        return ['Envelope,Spent,Remaining', ...spendingByEnvelope.map((d) => `${csvEscape(d.name)},${csvEscape(d.value)},${csvEscape(typeof d.remaining === 'number' ? d.remaining : '')}`)].join('\n');
      case 'spending-over-time':
        return ['Month,Spent,Income', ...spendingOverTime.map((d) => `${csvEscape(d.month)},${csvEscape(d.spent)},${csvEscape(d.income)}`)].join('\n');
      case 'daily-spending':
        return ['Date,Spent', ...dailySpending.map((d) => `${csvEscape(d.date)},${csvEscape(d.spent)}`)].join('\n');
      case 'income-vs-expenses':
        return ['Category,Amount', ...incomeVsExpenses.map((d) => `${csvEscape(d.name)},${csvEscape(d.amount)}`)].join('\n');
      case 'envelope-usage':
        return ['Envelope,Spent,Limit,Remaining,Usage %', ...envelopeUsage.map((d) => `${csvEscape(d.name)},${csvEscape(d.spent)},${csvEscape(d.limit)},${csvEscape(d.remaining)},${csvEscape(d.usage.toFixed(0))}`)].join('\n');
      case 'top-envelopes': {
        return ['Envelope,Spent,Remaining', ...topEnvelopes.map((e) => `${csvEscape(e.name)},${csvEscape(e.spent)},${csvEscape((e.limit ?? 0) - e.spent)}`)].join('\n');
      }
      case 'income-by-source':
        return ['Source,Income', ...incomeBySource.map((d) => `${csvEscape(d.name)},${csvEscape(d.value)}`)].join('\n');
      case 'savings-progress':
        return ['Goal,Current,Target,Progress %', ...savingsProgress.map((d) => `${csvEscape(d.name)},${csvEscape(d.current)},${csvEscape(d.target)},${csvEscape(d.pct.toFixed(0))}`)].join('\n');
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
    switch (selectedChart) {
      case 'spending-by-envelope':
        return (
          <SpendingByEnvelopeChart
            data={spendingByEnvelope}
            effectiveDisplay={effectiveDisplay}
            theme={theme}
            isDefault={isDefault}
            showChartNumbers={showChartNumbers}
            onEnvelopeChartClick={handleEnvelopeChartClick}
          />
        );
      case 'spending-over-time':
        return (
          <SpendingOverTimeChart
            data={spendingOverTime}
            effectiveDisplay={effectiveDisplay}
            theme={theme}
            showChartNumbers={showChartNumbers}
          />
        );
      case 'daily-spending':
        return (
          <DailySpendingChart
            data={dailySpending}
            dailySpendingIsWeekly={dailySpendingIsWeekly}
            theme={theme}
            isDefault={isDefault}
            showChartNumbers={showChartNumbers}
          />
        );
      case 'income-vs-expenses':
        return (
          <IncomeVsExpensesChart
            data={incomeVsExpenses}
            theme={theme}
            isDefault={isDefault}
            showChartNumbers={showChartNumbers}
          />
        );
      case 'envelope-usage':
        return <EnvelopeUsageChart data={envelopeUsage} theme={theme} showChartNumbers={showChartNumbers} />;
      case 'top-envelopes':
        return (
          <TopEnvelopesChart
            topEnvelopes={topEnvelopes}
            effectiveDisplay={effectiveDisplay}
            theme={theme}
            isDefault={isDefault}
            showChartNumbers={showChartNumbers}
            onEnvelopeChartClick={handleEnvelopeChartClick}
          />
        );
      case 'income-by-source':
        return (
          <IncomeBySourceChart
            data={incomeBySource}
            effectiveDisplay={effectiveDisplay}
            theme={theme}
            isDefault={isDefault}
            showChartNumbers={showChartNumbers}
          />
        );
      case 'savings-progress':
        return <SavingsProgressChart data={savingsProgress} theme={theme} showChartNumbers={showChartNumbers} />;
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
                {filterContext && envelopeOverview && envelopeOverviewTransactions.length > 0 && (
                  <button
                    type="button"
                    className="mt-3 text-sm text-primary hover:underline"
                    onClick={() => {
                      filterContext.requestViewTransactions({ envelopeId: envelopeOverview.id });
                      setEnvelopeOverview(null);
                      // navigation to Transactions section is handled by the section wheel
                    }}
                  >
                    View all in {envelopeOverview.name} →
                  </button>
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
