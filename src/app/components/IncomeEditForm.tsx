import { useState } from 'react';
import type { IncomeEntry } from '@/app/store/budgetTypes';
import { Button } from '@/app/components/ui/button';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';

export interface IncomeEditFormProps {
  income: IncomeEntry;
  onSave: (updates: Partial<{ amount: number; source: string; date: string }>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function IncomeEditForm({ income, onSave, onCancel, onDelete }: IncomeEditFormProps) {
  const [amount, setAmount] = useState(String(income.amount));
  const [source, setSource] = useState(income.source);
  const [date, setDate] = useState(income.date);
  const [showDeleteIncomeEntryDialog, setShowDeleteIncomeEntryDialog] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0 || !source.trim()) return;
    onSave({ amount: num, source: source.trim(), date });
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full">
      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        placeholder="Amount"
        required
        aria-label="Income amount"
      />
      <input
        type="text"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        placeholder="Source"
        required
        aria-label="Source"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Date"
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
            onClick={() => setShowDeleteIncomeEntryDialog(true)}
            className="min-h-[44px]"
          >
            Delete
          </Button>
        )}
      </div>
    </form>

    <ConfirmDialog
      open={showDeleteIncomeEntryDialog}
      onOpenChange={setShowDeleteIncomeEntryDialog}
      title="Delete income entry?"
      description=""
      confirmLabel="Delete entry"
      onConfirm={() => {
        onDelete?.();
      }}
    />
    </>
  );
}
