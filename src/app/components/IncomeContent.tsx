import { useState, useRef, memo, useMemo } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { formatMoney, formatDate } from '@/app/utils/format';
import { delayedToast } from '@/app/services/delayedToast';
import { IncomeEditForm } from '@/app/components/IncomeEditForm';
import { Button } from '@/app/components/ui/button';
import { Pencil } from 'lucide-react';
import { useAppStore } from '@/app/store/appStore';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function IncomeContentInner() {
  const { state, api, getBudgetSummaryForCurrentPeriod } = useBudget();
  const budgetPeriodMode = useAppStore((s) => s.budgetPeriodMode);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(todayISO());
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [showAllIncome, setShowAllIncome] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      delayedToast.error('Enter a positive amount for this income.');
      amountInputRef.current?.focus();
      return;
    }
    if (!source.trim()) {
      delayedToast.error('Enter a source (for example Salary or Freelance).');
      return;
    }
    try {
      api.addIncome({ amount: num, source: source.trim(), date });
      setAmount('');
      setSource('');
      setDate(todayISO());
      amountInputRef.current?.focus();
    } catch {
      delayedToast.error('Could not add income. Please check the amount and source, then try again.');
    }
  };

  const allIncome = state.income ?? [];
  const recent = showAllIncome ? allIncome : allIncome.slice(0, 5);

  const { summary, periodLabel } = useMemo(
    () => getBudgetSummaryForCurrentPeriod(),
    [getBudgetSummaryForCurrentPeriod, state, budgetPeriodMode] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <h3 className="text-lg text-primary">Income Tracking</h3>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit} encType="application/x-www-form-urlencoded">
        <div>
          <label htmlFor="inc-amount" className="block text-sm font-medium text-foreground mb-1">Income Amount</label>
          <input
            ref={amountInputRef}
            id="inc-amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 font-mono"
            aria-label="Income amount"
          />
        </div>
        <div>
          <label htmlFor="inc-source" className="block text-sm font-medium text-foreground mb-1">Source</label>
          <input
            id="inc-source"
            type="text"
            placeholder="Salary, Freelance, etc."
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Source"
          />
        </div>
        <div>
          <label htmlFor="inc-date" className="block text-sm font-medium text-foreground mb-1">Date</label>
          <input
            id="inc-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Date"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" className="min-h-[44px] flex-1">
            Add Income
          </Button>
        </div>
      </form>
      <div className="pt-4 border-t border-border">
        <div className="py-3 border-t border-border flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {periodLabel ? `Income this period (${periodLabel})` : 'Total income'}
          </span>
          <span className="text-sm font-bold text-primary tabular-nums font-mono">
            {formatMoney(summary.totalIncome)}
          </span>
        </div>
        <h4 className="text-sm font-medium text-foreground mb-2">Recent Income</h4>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No income recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((entry) => (
              <div key={entry.id} className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                {editingIncomeId === entry.id ? (
                  <IncomeEditForm
                    income={entry}
                    onSave={(updates) => {
                      try {
                        api.updateIncome(entry.id, updates);
                        setEditingIncomeId(null);
                      } catch {
                        delayedToast.error('Could not update income. Please try again.');
                      }
                    }}
                    onCancel={() => setEditingIncomeId(null)}
                    onDelete={() => {
                      api.deleteIncome(entry.id);
                      setEditingIncomeId(null);
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{entry.source}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-sm font-bold text-primary tabular-nums font-mono">
                        {formatMoney(entry.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingIncomeId(entry.id)}
                        className="p-1.5 rounded hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        aria-label="Edit income"
                      >
                        <Pencil className="w-3.5 h-3.5 text-primary" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {allIncome.length > 5 && (
          <div className="mt-2">
            {showAllIncome ? (
              <button
                type="button"
                onClick={() => setShowAllIncome(false)}
                className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Show less
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAllIncome(true)}
                className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Show all {allIncome.length}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const IncomeContent = memo(IncomeContentInner);
