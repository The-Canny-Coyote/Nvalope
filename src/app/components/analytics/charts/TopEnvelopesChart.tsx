import { formatMoney } from '@/app/utils/format';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import type { ChartDisplayType } from '@/app/components/analyticsChartTypes';
import type { AnalyticsChartData } from '@/app/hooks/useAnalyticsData';
import { EnvelopeChartTooltip, renderPieSegmentLabel, EmptyChart, type ChartThemeColors } from '@/app/components/analyticsChartUtils';
import type { EnvelopeChartClickHandler } from './types';

export function TopEnvelopesChart({
  topEnvelopes,
  effectiveDisplay,
  theme,
  isDefault,
  showChartNumbers,
  onEnvelopeChartClick,
}: {
  topEnvelopes: AnalyticsChartData['topEnvelopes'];
  effectiveDisplay: ChartDisplayType;
  theme: ChartThemeColors;
  isDefault: boolean;
  showChartNumbers: boolean;
  onEnvelopeChartClick: EnvelopeChartClickHandler;
}) {
  const colors = theme.fill;
  const strokeColors = theme.stroke;
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
            onClick={onEnvelopeChartClick}
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
          onClick={onEnvelopeChartClick}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
