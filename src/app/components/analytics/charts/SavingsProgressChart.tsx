import { formatMoney } from '@/app/utils/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { AnalyticsChartData } from '@/app/hooks/useAnalyticsData';
import { EmptyChart, type ChartThemeColors } from '@/app/components/analyticsChartUtils';

export function SavingsProgressChart({
  data,
  theme,
  showChartNumbers,
}: {
  data: AnalyticsChartData['savingsProgress'];
  theme: ChartThemeColors;
  showChartNumbers: boolean;
}) {
  const colors = theme.fill;
  const strokeColors = theme.stroke;
  if (data.length === 0) return <EmptyChart message="Add savings goals to track progress." />;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(
            v: number | undefined,
            _name: string | undefined,
            props: { payload?: { current: number; target: number; pct: number } }
          ) =>
            [
              `${formatMoney(props.payload?.current ?? 0)} / ${formatMoney(props.payload?.target ?? 0)} (${(props.payload?.pct ?? 0).toFixed(0)}%)`,
              'Progress',
            ] as [string, string]}
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
