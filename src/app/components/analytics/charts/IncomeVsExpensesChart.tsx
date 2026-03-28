import { formatMoney } from '@/app/utils/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { AnalyticsChartData } from '@/app/hooks/useAnalyticsData';
import { type ChartThemeColors } from '@/app/components/analyticsChartUtils';

export function IncomeVsExpensesChart({
  data,
  theme,
  isDefault,
  showChartNumbers,
}: {
  data: AnalyticsChartData['incomeVsExpenses'];
  theme: ChartThemeColors;
  isDefault: boolean;
  showChartNumbers: boolean;
}) {
  const colors = theme.fill;
  const strokeColors = theme.stroke;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          label={
            showChartNumbers
              ? {
                  position: 'top' as const,
                  formatter: (v: number, _n: string, props: { payload?: { name: string } }) =>
                    formatMoney(props.payload?.name === 'Expenses' ? -(v ?? 0) : (v ?? 0)),
                }
              : false
          }
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
