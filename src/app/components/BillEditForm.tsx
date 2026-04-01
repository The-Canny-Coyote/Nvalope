import { useState } from 'react';
import type { BillDueDate } from '@/app/store/budgetTypes';
import { Button } from '@/app/components/ui/button';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';
import type { Envelope } from '@/app/store/budgetTypes';

export interface BillEditFormProps {
  bill: BillDueDate;
  envelopes: Envelope[];
  onSave: (updates: Partial<{ name: string; dueDate: string; amount: number; repeatMonthly: boolean; envelopeId: string }>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function BillEditForm({ bill, envelopes, onSave, onCancel, onDelete }: BillEditFormProps) {
  const [dueDate, setDueDate] = useState(bill.dueDate);
  const [name, setName] = useState(bill.name);
  const [amount, setAmount] = useState(bill.amount != null ? String(bill.amount) : '');
  const [repeatMonthly, setRepeatMonthly] = useState(bill.repeatMonthly ?? false);
  const [envelopeId, setEnvelopeId] = useState(bill.envelopeId ?? '');
  const [showDeleteBillDialog, setShowDeleteBillDialog] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = amount === '' ? undefined : parseFloat(amount);
    onSave({
      name: name.trim(),
      dueDate,
      amount: Number.isNaN(num as number) ? undefined : num,
      repeatMonthly,
      envelopeId,
    });
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        placeholder="Bill name"
        required
        aria-label="Bill name"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Due date"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm text-foreground flex items-center gap-2">
          <input
            type="checkbox"
            checked={repeatMonthly}
            onChange={(e) => setRepeatMonthly(e.target.checked)}
            className="accent-primary"
          />
          Repeat monthly
        </label>
        <select
          value={envelopeId}
          onChange={(e) => setEnvelopeId(e.target.value)}
          className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Envelope for bill (optional)"
        >
          <option value="">No envelope</option>
          {envelopes.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
      </div>
      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        placeholder="Amount (optional)"
        aria-label="Amount optional"
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
            onClick={() => setShowDeleteBillDialog(true)}
            className="min-h-[44px]"
          >
            Delete
          </Button>
        )}
      </div>
    </form>

    <ConfirmDialog
      open={showDeleteBillDialog}
      onOpenChange={setShowDeleteBillDialog}
      title="Delete bill?"
      description="This bill will be removed from the calendar. Any transactions already added to your budget will remain in Transaction history."
      confirmLabel="Delete bill"
      onConfirm={() => {
        onDelete?.();
      }}
    />
    </>
  );
}
