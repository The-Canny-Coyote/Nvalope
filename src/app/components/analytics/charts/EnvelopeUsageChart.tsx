import { formatMoney } from '@/app/utils/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { AnalyticsChartData } from '@/app/hooks/useAnalyticsData';
import { EnvelopeChartTooltip, EmptyChart, type ChartThemeColors } from '@/app/components/analyticsChartUtils';

export function EnvelopeUsageChart({
  data,
  theme,
  showChartNumbers,
}: {
  data: AnalyticsChartData['envelopeUsage'];
  theme: ChartThemeColors;
  showChartNumbers: boolean;
}) {
  const colors = theme.fill;
  const strokeColors = theme.stroke;
  if (data.length === 0) return <EmptyChart message="Create envelopes to see usage." />;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
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
