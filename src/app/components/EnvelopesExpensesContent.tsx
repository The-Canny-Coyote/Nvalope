import { useState, useMemo, memo, useCallback, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useBudget } from '@/app/store/BudgetContext';
import { useAppStore } from '@/app/store/appStore';
import { formatMoney } from '@/app/utils/format';
import { todayISO } from '@/app/utils/date';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';
import { getAppData, setAppData } from '@/app/services/appDataIdb';
import { delayedToast } from '@/app/services/delayedToast';
import type { Envelope } from '@/app/store/budgetTypes';

function EnvelopeEditForm({
  envelope,
  onSave,
  onCancel,
  onDelete,
}: {
  envelope: Envelope;
  onSave: (name: string, limit: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(envelope.name);
  const [limit, setLimit] = useState(String(envelope.limit));
  const [showZeroLimitConfirm, setShowZeroLimitConfirm] = useState(false);
  const [showDeleteEnvelopeDialog, setShowDeleteEnvelopeDialog] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(limit);
    if (Number.isNaN(num) || num < 0 || !name.trim()) return;
    if (num === 0) {
      setShowZeroLimitConfirm(true);
      return;
    }
    onSave(name.trim(), num);
  };

  const handleZeroLimitChoice = useCallback(
    (choice: 'delete' | 'keep' | 'cancel') => {
      setShowZeroLimitConfirm(false);
      if (choice === 'delete' && onDelete) onDelete();
      if (choice === 'keep') onSave(name.trim(), 0);
    },
    [name, onDelete, onSave]
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 w-full"
        placeholder="Envelope name"
        required
        aria-label="Envelope name"
      />
      <input
        type="number"
        step="0.01"
        min="0"
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 w-full"
        placeholder="Limit"
        aria-label="Envelope limit"
      />
      <div className="flex gap-2 flex-wrap">
        <Button type="submit" className="min-h-[44px]">
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="min-h-[44px]">
          Cancel
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setShowDeleteEnvelopeDialog(true)}
            className="min-h-[44px]"
          >
            Delete
          </Button>
        )}
      </div>
    </form>

      <ConfirmDialog
        open={showDeleteEnvelopeDialog}
        onOpenChange={setShowDeleteEnvelopeDialog}
        title="Delete envelope?"
        description="Transactions in it will become uncategorized."
        confirmLabel="Delete envelope"
        onConfirm={() => {
          onDelete?.();
        }}
      />

      <Dialog open={showZeroLimitConfirm} onOpenChange={(open) => !open && setShowZeroLimitConfirm(false)}>
        <DialogContent className="max-w-sm" aria-describedby="zero-limit-desc">
          <DialogHeader>
            <DialogTitle>Maximum set to zero</DialogTitle>
          </DialogHeader>
          <p id="zero-limit-desc" className="text-sm text-muted-foreground mb-4">
            Setting the maximum to 0 removes the budget for this envelope. Do you want to delete the envelope instead? Transactions in it will become uncategorized.
          </p>
          <div className="flex flex-col gap-2">
            {onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleZeroLimitChoice('delete')}
                className="min-h-[44px] w-full justify-center"
              >
                Delete envelope
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleZeroLimitChoice('keep')}
              className="min-h-[44px] w-full justify-center"
            >
              Keep envelope with 0 limit
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleZeroLimitChoice('cancel')}
              className="min-h-[44px] w-full justify-center"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SavingsGoalsSection() {
  const { state, api } = useBudget();
  const goals = Array.isArray(state.savingsGoals) ? state.savingsGoals : [];
  const [open, setOpen] = useState(() => goals.length > 0);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showDeleteGoalDialog, setShowDeleteGoalDialog] = useState(false);
  const [deleteGoalTargetId, setDeleteGoalTargetId] = useState<string | null>(null);

  const [createName, setCreateName] = useState('');
  const [createTargetAmount, setCreateTargetAmount] = useState('');
  const [createCurrentAmount, setCreateCurrentAmount] = useState('');
  const [createTargetDate, setCreateTargetDate] = useState('');
  const [createMonthlyContribution, setCreateMonthlyContribution] = useState('');

  const [editName, setEditName] = useState('');
  const [editTargetAmount, setEditTargetAmount] = useState('');
  const [editCurrentAmount, setEditCurrentAmount] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editMonthlyContribution, setEditMonthlyContribution] = useState('');

  const startEdit = (id: string) => {
    const g = goals.find((x) => x.id === id);
    if (!g) return;
    setEditingGoalId(id);
    setEditName(g.name);
    setEditTargetAmount(String(g.targetAmount ?? 0));
    setEditCurrentAmount(String(g.currentAmount ?? 0));
    setEditTargetDate(g.targetDate ?? '');
    setEditMonthlyContribution(g.monthlyContribution != null ? String(g.monthlyContribution) : '');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = createName.trim();
    const targetAmount = parseFloat(createTargetAmount);
    const currentAmount = parseFloat(createCurrentAmount || '0');
    const monthlyContribution = createMonthlyContribution.trim() === '' ? undefined : parseFloat(createMonthlyContribution);
    const targetDate = createTargetDate.trim() === '' ? undefined : createTargetDate.trim();

    if (!name) {
      delayedToast.error('Enter a goal name.');
      return;
    }
    if (Number.isNaN(targetAmount) || targetAmount <= 0) {
      delayedToast.error('Enter a valid target amount.');
      return;
    }
    if (Number.isNaN(currentAmount) || currentAmount < 0) {
      delayedToast.error('Enter a valid current amount.');
      return;
    }
    if (monthlyContribution != null && (Number.isNaN(monthlyContribution) || monthlyContribution < 0)) {
      delayedToast.error('Enter a valid monthly contribution.');
      return;
    }
    try {
      api.createSavingsGoal({
        name,
        targetAmount,
        targetDate,
        monthlyContribution,
        currentAmount,
      });
      setCreateName('');
      setCreateTargetAmount('');
      setCreateCurrentAmount('');
      setCreateTargetDate('');
      setCreateMonthlyContribution('');
      if (!open) setOpen(true);
    } catch {
      delayedToast.error('Could not create savings goal. Please check the values and try again.');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoalId) return;
    const name = editName.trim();
    const targetAmount = parseFloat(editTargetAmount);
    const currentAmount = parseFloat(editCurrentAmount || '0');
    const monthlyContribution = editMonthlyContribution.trim() === '' ? undefined : parseFloat(editMonthlyContribution);
    const targetDate = editTargetDate.trim() === '' ? undefined : editTargetDate.trim();

    if (!name) {
      delayedToast.error('Enter a goal name.');
      return;
    }
    if (Number.isNaN(targetAmount) || targetAmount <= 0) {
      delayedToast.error('Enter a valid target amount.');
      return;
    }
    if (Number.isNaN(currentAmount) || currentAmount < 0) {
      delayedToast.error('Enter a valid current amount.');
      return;
    }
    if (monthlyContribution != null && (Number.isNaN(monthlyContribution) || monthlyContribution < 0)) {
      delayedToast.error('Enter a valid monthly contribution.');
      return;
    }
    try {
      api.updateSavingsGoal(editingGoalId, {
        name,
        targetAmount,
        targetDate,
        monthlyContribution,
        currentAmount,
      });
      setEditingGoalId(null);
    } catch {
      delayedToast.error('Could not update savings goal. Please try again.');
    }
  };

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-foreground flex items-center gap-2">
          🧰💰 Cache Savings Goals
        </span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {goals.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No goals yet. Create one below to start tracking progress.
            </p>
          ) : (
            <div className="space-y-2">
              {goals.map((g) => {
                const target = g.targetAmount ?? 0;
                const current = g.currentAmount ?? 0;
                const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                const isEditing = editingGoalId === g.id;
                return (
                  <div key={g.id} className="p-3 rounded-lg border border-border bg-card">
                    {isEditing ? (
                      <form onSubmit={handleSaveEdit} className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          placeholder="Goal name"
                          aria-label="Goal name"
                          required
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editCurrentAmount}
                            onChange={(e) => setEditCurrentAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            placeholder="Current"
                            aria-label="Current amount"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editTargetAmount}
                            onChange={(e) => setEditTargetAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            placeholder="Target"
                            aria-label="Target amount"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={editTargetDate}
                            onChange={(e) => setEditTargetDate(e.target.value)}
                            className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            aria-label="Target date (optional)"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editMonthlyContribution}
                            onChange={(e) => setEditMonthlyContribution(e.target.value)}
                            className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            placeholder="Monthly (optional)"
                            aria-label="Monthly contribution (optional)"
                          />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button type="submit" className="min-h-[44px]">Save</Button>
                          <Button type="button" variant="outline" onClick={() => setEditingGoalId(null)} className="min-h-[44px]">
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">🪙 {g.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {g.targetDate ? `Target date: ${g.targetDate}` : 'No target date.'}
                            </p>
                            {g.monthlyContribution != null && g.monthlyContribution > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Monthly contribution: <span className="font-mono">{formatMoney(g.monthlyContribution)}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => startEdit(g.id)}
                              aria-label={`Edit savings goal ${g.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteGoalTargetId(g.id);
                                setShowDeleteGoalDialog(true);
                              }}
                              aria-label={`Delete savings goal ${g.name}`}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-mono">{formatMoney(current)} / {formatMoney(target)}</span>
                            <span className="text-primary font-medium">{pct}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 mt-1">
                            <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
            <p className="text-sm font-medium text-primary mb-2">🗝️ Create goal</p>
            <form onSubmit={handleCreate} className="space-y-2" encType="application/x-www-form-urlencoded">
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                placeholder="Goal name"
                aria-label="Goal name"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createCurrentAmount}
                  onChange={(e) => setCreateCurrentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  placeholder="Current amount"
                  aria-label="Current amount"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createTargetAmount}
                  onChange={(e) => setCreateTargetAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  placeholder="Target amount"
                  aria-label="Target amount"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={createTargetDate}
                  onChange={(e) => setCreateTargetDate(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label="Target date (optional)"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createMonthlyContribution}
                  onChange={(e) => setCreateMonthlyContribution(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  placeholder="Monthly contribution (optional)"
                  aria-label="Monthly contribution (optional)"
                />
              </div>
              <Button type="submit" variant="outline" className="min-h-[44px] border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50">
                🧿 Create goal
              </Button>
            </form>
          </div>

          <ConfirmDialog
            open={showDeleteGoalDialog}
            onOpenChange={(next) => {
              setShowDeleteGoalDialog(next);
              if (!next) setDeleteGoalTargetId(null);
            }}
            title="Delete savings goal?"
            description="This goal will be removed. This does not delete any transactions."
            confirmLabel="Delete goal"
            onConfirm={() => {
              if (!deleteGoalTargetId) return;
              try {
                api.deleteSavingsGoal(deleteGoalTargetId);
                if (editingGoalId === deleteGoalTargetId) setEditingGoalId(null);
              } catch {
                delayedToast.error('Could not delete savings goal. Please try again.');
              } finally {
                setShowDeleteGoalDialog(false);
                setDeleteGoalTargetId(null);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

function EnvelopesExpensesContentInner() {
  const { state, api, getBudgetSummaryForCurrentPeriod } = useBudget();
  const budgetPeriodMode = useAppStore((s) => s.budgetPeriodMode);
  const setBudgetPeriodMode = useAppStore((s) => s.setBudgetPeriodMode);
  const setBudgetPeriodModeSwitchDate = useAppStore((s) => s.setBudgetPeriodModeSwitchDate);
  const biweeklyPeriod1StartDay = useAppStore((s) => s.biweeklyPeriod1StartDay) ?? 1;
  const biweeklyPeriod1EndDay = useAppStore((s) => s.biweeklyPeriod1EndDay) ?? 14;
  const setBiweeklyPeriod1StartDay = useAppStore((s) => s.setBiweeklyPeriod1StartDay);
  const setBiweeklyPeriod1EndDay = useAppStore((s) => s.setBiweeklyPeriod1EndDay);
  const weekStartDay = useAppStore((s) => s.weekStartDay) ?? 0;
  const setWeekStartDay = useAppStore((s) => s.setWeekStartDay);
  // Summary depends on state and period settings; listing them ensures recompute when budget/period change.
  // Wrap in try/catch so period logic (e.g. date/timezone on some mobile browsers) never throws and triggers section "unavailable".
  const { summary: periodSummary, periodLabel } = useMemo(() => {
    try {
      return getBudgetSummaryForCurrentPeriod();
    } catch {
      return {
        summary: {
          totalIncome: 0,
          totalBudgeted: 0,
          totalSpent: 0,
          uncategorizedSpent: 0,
          remaining: 0,
          envelopes: Array.isArray(state.envelopes)
            ? state.envelopes.map((e) => ({ id: e.id, name: e.name, limit: e.limit, spent: 0, remaining: e.limit }))
            : [],
          recentTransactions: [],
        },
        periodLabel: '',
        period: null,
        daysLeftInPeriod: 0,
      };
    }
  }, [getBudgetSummaryForCurrentPeriod, state, budgetPeriodMode, biweeklyPeriod1StartDay, biweeklyPeriod1EndDay, weekStartDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const envelopes = useMemo(
    () => (Array.isArray(state.envelopes) ? state.envelopes : []),
    [state.envelopes]
  );
  const [amount, setAmount] = useState('');
  const [envelopeId, setEnvelopeId] = useState(envelopes[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvLimit, setNewEnvLimit] = useState('');
  const [showSwitchToMonthlyDialog, setShowSwitchToMonthlyDialog] = useState(false);
  const [editingEnvelopeId, setEditingEnvelopeId] = useState<string | null>(null);
  const [showDeleteEnvelopeFromListDialog, setShowDeleteEnvelopeFromListDialog] = useState(false);
  const [deleteEnvelopeFromListTargetId, setDeleteEnvelopeFromListTargetId] = useState<string | null>(null);

  // Keep expense envelope selection valid when envelopes are deleted
  useEffect(() => {
    const ids = envelopes.map((e) => e.id);
    if (envelopeId && !ids.includes(envelopeId)) {
      setEnvelopeId(envelopes[0]?.id ?? '');
    }
  }, [envelopes, envelopeId]);

  const applyPeriodMode = useCallback((mode: 'monthly' | 'biweekly' | 'weekly', switchDate: string | null) => {
    setBudgetPeriodMode(mode);
    setBudgetPeriodModeSwitchDate(switchDate);
    getAppData().then((data) =>
      setAppData({ ...data, budgetPeriodMode: mode, budgetPeriodModeSwitchDate: switchDate }).catch(() => {})
    );
  }, [setBudgetPeriodMode, setBudgetPeriodModeSwitchDate]);

  const handleBiweeklyPeriod1StartDayChange = useCallback(
    (day: number) => {
      const clamped = Math.min(31, Math.max(1, day));
      setBiweeklyPeriod1StartDay(clamped);
      getAppData().then((data) =>
        setAppData({ ...data, biweeklyPeriod1StartDay: clamped }).catch(() => {})
      );
    },
    [setBiweeklyPeriod1StartDay]
  );

  const handleBiweeklyPeriod1EndDayChange = useCallback(
    (day: number) => {
      const clamped = Math.min(31, Math.max(1, day));
      setBiweeklyPeriod1EndDay(clamped);
      getAppData().then((data) =>
        setAppData({ ...data, biweeklyPeriod1EndDay: clamped }).catch(() => {})
      );
    },
    [setBiweeklyPeriod1EndDay]
  );

  const handleWeekStartDayChange = useCallback(
    (day: number) => {
      const value = day === 1 ? 1 : 0;
      setWeekStartDay(value);
      getAppData().then((data) =>
        setAppData({ ...data, weekStartDay: value }).catch(() => {})
      );
    },
    [setWeekStartDay]
  );

  const handlePeriodModeClick = useCallback((mode: 'monthly' | 'biweekly' | 'weekly') => {
    if (mode === budgetPeriodMode) return;
    if (mode === 'monthly' && (budgetPeriodMode === 'biweekly' || budgetPeriodMode === 'weekly')) {
      setShowSwitchToMonthlyDialog(true);
      return;
    }
    applyPeriodMode(mode, null);
  }, [budgetPeriodMode, applyPeriodMode]);

  const period2WouldBeEmpty = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].some((m) => {
      const lastDay = new Date(new Date().getFullYear(), m, 0).getDate();
      return biweeklyPeriod1EndDay >= lastDay;
    });
  }, [biweeklyPeriod1EndDay]);

  const handleSwitchToMonthlyForAll = useCallback(() => {
    applyPeriodMode('monthly', null);
    setShowSwitchToMonthlyDialog(false);
  }, [applyPeriodMode]);

  const handleSwitchToMonthlyFromNow = useCallback(() => {
    applyPeriodMode('monthly', todayISO());
    setShowSwitchToMonthlyDialog(false);
  }, [applyPeriodMode]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      delayedToast.error('Enter a valid amount.');
      return;
    }
    if (!envelopeId) {
      delayedToast.error('Select an envelope.');
      return;
    }
    if (!description.trim()) {
      delayedToast.error('Enter a description for this expense.');
      return;
    }
    try {
      api.addTransaction({ amount: num, envelopeId, description: description.trim(), date });
      setAmount('');
      setDescription('');
      setDate(todayISO());
    } catch {
      delayedToast.error('Could not add expense. Please check the amount and date, then try again.');
    }
  };

  const handleCreateEnvelope = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(newEnvLimit);
    if (!newEnvName.trim() || Number.isNaN(limit) || limit <= 0) return;
    try {
      const env = api.addEnvelope(newEnvName.trim(), limit);
      setNewEnvName('');
      setNewEnvLimit('');
      setEnvelopeId(env.id);
    } catch {
      delayedToast.error('Could not create envelope. Please check the name and amount, then try again.');
    }
  };

  const hasEnvelopes = envelopes.length > 0;


  return (
    <div className="space-y-4">
      {/* Budget period: Monthly | Biweekly | Weekly */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">Budget period</span>
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30" role="group" aria-label="Budget period">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handlePeriodModeClick('monthly')}
              className={`${budgetPeriodMode === 'monthly' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:text-foreground'}`}
              aria-pressed={budgetPeriodMode === 'monthly'}
            >
              Monthly
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handlePeriodModeClick('biweekly')}
              className={`${budgetPeriodMode === 'biweekly' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:text-foreground'}`}
              aria-pressed={budgetPeriodMode === 'biweekly'}
            >
              Biweekly
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handlePeriodModeClick('weekly')}
              className={`${budgetPeriodMode === 'weekly' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:text-foreground'}`}
              aria-pressed={budgetPeriodMode === 'weekly'}
            >
              Weekly
            </Button>
          </div>
        </div>
        {budgetPeriodMode === 'biweekly' && (
          <div className="mt-3 pt-3 border-t border-border">
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Two periods per month
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Period 1: start day through end day. Period 2: next day through month end.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-foreground">Period 1: from day</span>
              <select
                id="biweekly-period1-start"
                value={biweeklyPeriod1StartDay}
                onChange={(e) => handleBiweeklyPeriod1StartDayChange(Number(e.target.value))}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="First day of period 1 (1 to 31)"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <span className="text-sm text-foreground">to day</span>
              <select
                id="biweekly-period1-end"
                value={biweeklyPeriod1EndDay}
                onChange={(e) => handleBiweeklyPeriod1EndDayChange(Number(e.target.value))}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Last day of period 1 (1 to 31)"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">of the month</span>
            </div>
            {period2WouldBeEmpty && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                ⚠ Period 1 end day is ≥ the last day of some months (e.g. February). Period 2 will be empty in those months.
              </p>
            )}
          </div>
        )}
        {budgetPeriodMode === 'weekly' && (
          <div className="mt-3 pt-3 border-t border-border">
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Week start
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Choose which day starts your budget week.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleWeekStartDayChange(0)}
                className={`${weekStartDay === 0 ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : ''}`}
                aria-pressed={weekStartDay === 0}
              >
                Sunday
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleWeekStartDayChange(1)}
                className={`${weekStartDay === 1 ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : ''}`}
                aria-pressed={weekStartDay === 1}
              >
                Monday
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showSwitchToMonthlyDialog} onOpenChange={setShowSwitchToMonthlyDialog}>
        <DialogContent className="max-w-md" aria-describedby="switch-monthly-desc">
          <DialogHeader>
            <DialogTitle>Switch to monthly periods</DialogTitle>
          </DialogHeader>
          <p id="switch-monthly-desc" className="text-sm text-muted-foreground mb-4">
            You were using {budgetPeriodMode === 'weekly' ? 'weekly' : 'biweekly'} periods. How do you want to handle the change?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSwitchToMonthlyForAll}
              className="h-auto px-4 py-3 text-left justify-start whitespace-normal"
            >
              <span className="block font-medium text-foreground">Use monthly for all dates</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Spent and remaining will be shown per month everywhere, including the past.</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSwitchToMonthlyFromNow}
              className="h-auto px-4 py-3 text-left justify-start whitespace-normal"
            >
              <span className="block font-medium text-foreground">Use monthly from now on</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Past data stays in {budgetPeriodMode === 'weekly' ? 'weekly' : 'biweekly'} periods when you look back; going forward everything is monthly.</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!hasEnvelopes && (
        <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-center">
          <p className="text-sm text-muted-foreground mb-1">No envelopes yet</p>
          <p className="text-xs text-muted-foreground">
            Create your first envelope below.
          </p>
        </div>
      )}
      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <h3 className="text-lg text-primary">Your Envelopes</h3>
          {periodLabel && (
            <span className="text-xs text-muted-foreground font-medium" aria-label="Current period">
              {periodLabel}
            </span>
          )}
        </div>
        <div className="space-y-3">
          {envelopes.map((e) => {
            const periodEnv = periodSummary.envelopes.find((ev) => ev.id === e.id);
            const spent = periodEnv?.spent ?? 0;
            const remaining = periodEnv?.remaining ?? e.limit;
            const pct = e.limit > 0 ? Math.round((spent / e.limit) * 100) : 0;
            const isOverBudget = e.limit > 0 && pct > 100;
            const isEditing = editingEnvelopeId === e.id;
            return (
              <div
                key={e.id}
                className="p-4 bg-primary/5 border border-primary/20 rounded-lg hover:border-primary/40 transition-colors"
              >
                {isEditing ? (
                  <EnvelopeEditForm
                    envelope={e}
                    onSave={(name, limit) => {
                      try {
                        api.updateEnvelope(e.id, { name, limit });
                        setEditingEnvelopeId(null);
                      } catch {
                        delayedToast.error('Could not update envelope. Please try again.');
                      }
                    }}
                    onCancel={() => setEditingEnvelopeId(null)}
                    onDelete={() => {
                      api.deleteEnvelope(e.id);
                      setEditingEnvelopeId(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-primary">{e.name}</span>
                      <span className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground font-mono">
                          {formatMoney(-spent)} / {formatMoney(e.limit)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingEnvelopeId(e.id)}
                          aria-label={`Edit envelope ${e.name}`}
                          className="hover:bg-muted"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeleteEnvelopeFromListTargetId(e.id);
                            setShowDeleteEnvelopeFromListDialog(true);
                          }}
                          aria-label={`Delete envelope ${e.name}`}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`${isOverBudget ? 'bg-destructive' : 'bg-primary'} h-2 rounded-full`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs ${isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {isOverBudget ? `Over by ${formatMoney(Math.abs(remaining))}` : `${formatMoney(remaining)} remaining`}
                      </span>
                      <span className="text-xs text-primary">{pct}%</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <form onSubmit={handleCreateEnvelope} className="flex gap-2 flex-wrap items-end" encType="application/x-www-form-urlencoded">
            <input
              type="text"
              placeholder="New envelope name"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              className="flex-1 min-w-[120px] min-h-[44px] px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="New envelope name"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Limit"
              value={newEnvLimit}
              onChange={(e) => setNewEnvLimit(e.target.value)}
              className="w-24 min-h-[44px] px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Envelope limit (amount)"
            />
            <Button
              type="submit"
              variant="outline"
              className="min-h-[44px] py-2 px-4 border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"
            >
              + Create
            </Button>
          </form>
        </div>
      </div>

      <SavingsGoalsSection />

      <div className="p-4 bg-primary/10 border-2 border-primary/30 rounded-lg">
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-lg text-primary">Quick Add Expense</h3>
        </div>
        <form className="space-y-3" onSubmit={handleAddExpense} encType="application/x-www-form-urlencoded">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="exp-amount" className="block text-xs font-medium text-foreground mb-1">Amount</label>
              <input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-describedby={!hasEnvelopes ? 'exp-no-env' : undefined}
              />
            </div>
            <div>
              <label htmlFor="exp-envelope" className="block text-xs font-medium text-foreground mb-1">Envelope</label>
              <select
                id="exp-envelope"
                value={envelopeId}
                onChange={(e) => setEnvelopeId(e.target.value)}
                className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                disabled={!hasEnvelopes}
                aria-describedby={!hasEnvelopes ? 'exp-no-env' : undefined}
              >
                {envelopes.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div id="exp-no-env" className="sr-only">
            {!hasEnvelopes && 'Create an envelope in Your Envelopes above first.'}
          </div>
          <div>
            <label htmlFor="exp-desc" className="block text-xs font-medium text-foreground mb-1">Description *</label>
            <input
              id="exp-desc"
              type="text"
              placeholder="e.g. Groceries, Coffee"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>
          <div>
            <label htmlFor="exp-date" className="block text-xs font-medium text-foreground mb-1">Date</label>
            <input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>
          <Button
            type="submit"
            className="w-full min-h-[44px]"
            disabled={!hasEnvelopes || !amount || parseFloat(amount) <= 0 || !description.trim()}
          >
            Add Expense
          </Button>
        </form>
      </div>

      <ConfirmDialog
        open={showDeleteEnvelopeFromListDialog}
        onOpenChange={(open) => {
          setShowDeleteEnvelopeFromListDialog(open);
          if (!open) setDeleteEnvelopeFromListTargetId(null);
        }}
        title="Delete envelope?"
        description="Transactions in it will become uncategorized."
        confirmLabel="Delete envelope"
        onConfirm={() => {
          if (deleteEnvelopeFromListTargetId) {
            api.deleteEnvelope(deleteEnvelopeFromListTargetId);
            setEditingEnvelopeId(null);
          }
        }}
      />
    </div>
  );
}

export const EnvelopesExpensesContent = memo(EnvelopesExpensesContentInner);
