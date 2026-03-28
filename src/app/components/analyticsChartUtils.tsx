import { formatMoney } from '@/app/utils/format';
import type { AccessibilityMode } from '@/app/components/accessibilityMode';

/** Recharts Tooltip formatter: value as USD with a fixed label. Use negate for expense/spent so it displays with minus. */
export function moneyTooltip(label: string, options?: { negate?: boolean }) {
  return (v: number | undefined) => [formatMoney(v != null ? (options?.negate ? -v : v) : 0), label] as [string, string];
}

/** Tooltip content for envelope charts: shows Spent, Left (remaining), and Limit when available. */
export function EnvelopeChartTooltip({
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

export type ChartThemeColors = { fill: string[]; stroke: string[]; gradient?: boolean; shadow?: boolean };

export function getChartColors(mode: AccessibilityMode): ChartThemeColors {
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

const RADIAN = Math.PI / 180;

/** Renders a value label inside a pie segment when showNumbers is true. */
export function renderPieSegmentLabel(showNumbers: boolean, negate: boolean) {
  function PieSegmentLabel(props: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    value?: number;
  }) {
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
  }
  PieSegmentLabel.displayName = 'PieSegmentLabel';
  return PieSegmentLabel;
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm" role="status">
      {message}
    </div>
  );
}
