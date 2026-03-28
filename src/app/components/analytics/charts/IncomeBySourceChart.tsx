import { formatMoney } from '@/app/utils/format';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import type { ChartDisplayType } from '@/app/components/analyticsChartTypes';
import type { AnalyticsChartData } from '@/app/hooks/useAnalyticsData';
import { moneyTooltip, renderPieSegmentLabel, EmptyChart, type ChartThemeColors } from '@/app/components/analyticsChartUtils';

export function IncomeBySourceChart({
  data,
  effectiveDisplay,
  theme,
  isDefault,
  showChartNumbers,
}: {
  data: AnalyticsChartData['incomeBySource'];
  effectiveDisplay: ChartDisplayType;
  theme: ChartThemeColors;
  isDefault: boolean;
  showChartNumbers: boolean;
}) {
  const colors = theme.fill;
  const strokeColors = theme.stroke;
  if (data.length === 0) return <EmptyChart message="Add income to see breakdown by source." />;
  if (effectiveDisplay === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          label={showChartNumbers ? renderPieSegmentLabel(showChartNumbers, false) : false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} stroke={strokeColors[i % strokeColors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={moneyTooltip('Income')} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
