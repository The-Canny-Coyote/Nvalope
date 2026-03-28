import { formatMoney } from '@/app/utils/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { AnalyticsChartData } from '@/app/hooks/useAnalyticsData';
import { moneyTooltip, type ChartThemeColors } from '@/app/components/analyticsChartUtils';

export function DailySpendingChart({
  data,
  dailySpendingIsWeekly,
  theme,
  isDefault,
  showChartNumbers,
}: {
  data: AnalyticsChartData['dailySpending'];
  dailySpendingIsWeekly: boolean;
  theme: ChartThemeColors;
  isDefault: boolean;
  showChartNumbers: boolean;
}) {
  const colors = theme.fill;
  const strokeColors = theme.stroke;
  return (
    <>
      {dailySpendingIsWeekly && (
        <p className="text-xs text-muted-foreground mb-2" role="status">
          Showing weekly totals for clarity.
        </p>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
