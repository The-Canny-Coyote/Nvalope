import { formatMoney } from '@/app/utils/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Area, AreaChart, LineChart, Line } from 'recharts';
import type { ChartDisplayType } from '@/app/components/analyticsChartTypes';
import type { AnalyticsChartData } from '@/app/hooks/useAnalyticsData';
import { moneyTooltip, type ChartThemeColors } from '@/app/components/analyticsChartUtils';

export function SpendingOverTimeChart({
  data,
  effectiveDisplay,
  theme,
  showChartNumbers,
}: {
  data: AnalyticsChartData['spendingOverTime'];
  effectiveDisplay: ChartDisplayType;
  theme: ChartThemeColors;
  showChartNumbers: boolean;
}) {
  const colors = theme.fill;
  const strokeColors = theme.stroke;
  if (effectiveDisplay === 'line') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
