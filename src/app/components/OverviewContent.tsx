import { useMemo, memo } from 'react';
import { motion } from 'motion/react';
import { useBudget } from '@/app/store/BudgetContext';
import { useAppStore } from '@/app/store/appStore';
import { formatMoney } from '@/app/utils/format';
const statVariantsWithMotion = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.07, type: 'spring' as const, stiffness: 320, damping: 30 },
  }),
};

const statVariantsNoMotion = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: () => ({ opacity: 1, y: 0, scale: 1, transition: { duration: 0 } }),
};

const containerVariantsWithMotion = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const containerVariantsNoMotion = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
};

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
  index: number;
  noMotion?: boolean;
}

function StatCard({ label, value, accent, danger, index, noMotion }: StatCardProps) {
  const statVariants = noMotion ? statVariantsNoMotion : statVariantsWithMotion;
  return (
    <motion.div
      custom={noMotion ? 0 : index}
      variants={statVariants}
      className="glass-stat p-4 flex flex-col gap-1"
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p
        className={`text-2xl font-bold font-nums leading-none ${
          danger ? 'text-destructive' : accent ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </motion.div>
  );
}

function OverviewContentInner() {
  const { state, getBudgetSummaryForCurrentPeriod } = useBudget();
  const budgetPeriodMode = useAppStore((s) => s.budgetPeriodMode);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const selectedMode = useAppStore((s) => s.selectedMode);
  const noMotion = reducedMotion || selectedMode === 'calm';
  const containerVariants = noMotion ? containerVariantsNoMotion : containerVariantsWithMotion;
  // Summary depends on state and period; listing them ensures recompute when budget/period change.
  const { summary, periodLabel, daysLeftInPeriod } = useMemo(() => {
    try {
      return getBudgetSummaryForCurrentPeriod();
    } catch {
      return {
        summary: {
          totalIncome: 0,
          totalBudgeted: 0,
          totalSpent: 0,
          remaining: 0,
          envelopes: [],
          recentTransactions: [],
        },
        periodLabel: '',
        period: null,
        daysLeftInPeriod: 0,
      };
    }
  }, [getBudgetSummaryForCurrentPeriod, state, budgetPeriodMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalBudgeted = Number.isFinite(summary.totalBudgeted) ? summary.totalBudgeted : 0;
  const totalSpent = Number.isFinite(summary.totalSpent) ? summary.totalSpent : 0;
  const pct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const isOverBudget = pct > 100;
  const daysLeft = Number.isFinite(daysLeftInPeriod) ? daysLeftInPeriod : 0;

  const envelopes = summary.envelopes ?? [];
  const isEmpty = (Number.isFinite(summary.totalIncome) ? summary.totalIncome : 0) === 0 && envelopes.length === 0;

  return (
    <motion.section
      className="space-y-4"
      role="region"
      aria-label="Budget overview"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={noMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="text-lg font-semibold text-primary tracking-tight">Budget Overview</h3>
        {periodLabel && (
          <span className="text-xs text-muted-foreground font-medium" aria-label="Current period">
            {periodLabel}
          </span>
        )}
      </div>

      {isEmpty && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={noMotion ? { duration: 0 } : undefined}
          className="p-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 text-center"
        >
          <p className="text-sm text-muted-foreground mb-1">Get started</p>
          <p className="text-xs text-muted-foreground">
            Add income and create envelopes in the sections below to see your budget here.
          </p>
        </motion.div>
      )}

      <motion.div
        className="grid grid-cols-2 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <StatCard label="Total Income"   value={formatMoney(summary.totalIncome)}   accent index={0} noMotion={noMotion} />
        <StatCard label="Total Budgeted" value={formatMoney(summary.totalBudgeted)} accent index={1} noMotion={noMotion} />
        <StatCard
          label="Total Spent"
          value={formatMoney(-summary.totalSpent)}
          danger={isOverBudget}
          index={2}
          noMotion={noMotion}
        />
        <StatCard label="Remaining" value={formatMoney(summary.remaining)} accent index={3} noMotion={noMotion} />
      </motion.div>

      {/* Budget Health card */}
      <motion.div
        className="glass-card p-4 rounded-2xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={noMotion ? { duration: 0 } : { delay: 0.3, duration: 0.35, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <h4 className="text-sm font-semibold text-foreground">Budget Health</h4>
        </div>
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Overall Progress</span>
              <span
                className={`text-xs font-nums font-semibold ${
                  isOverBudget ? 'text-destructive' : 'text-primary'
                }`}
              >
                {pct}%
              </span>
            </div>
            {/* Progress track */}
            <div
              className="w-full bg-muted rounded-full h-2.5 overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Overall spending progress"
            >
              <motion.div
                className={`h-2.5 rounded-full ${
                  isOverBudget
                    ? 'bg-destructive'
                    : 'bg-gradient-to-r from-primary to-accent'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pct)}%` }}
                transition={noMotion ? { duration: 0 } : { duration: 0.7, delay: 0.35, ease: 'easeOut' }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {envelopes.length} envelope{envelopes.length !== 1 ? 's' : ''} active
            {' '}•{' '}
            <span className="font-nums">{daysLeft}</span> days left in period
          </p>
        </div>
      </motion.div>
    </motion.section>
  );
}

export const OverviewContent = memo(OverviewContentInner);
