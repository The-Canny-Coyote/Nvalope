import { useState } from 'react';
import type { BillDueDate } from '@/app/store/budgetTypes';
import { Button } from '@/app/components/ui/button';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';

export interface BillEditFormProps {
  bill: BillDueDate;
  onSave: (updates: Partial<{ name: string; dueDate: string; amount: number }>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function BillEditForm({ bill, onSave, onCancel, onDelete }: BillEditFormProps) {
  const [dueDate, setDueDate] = useState(bill.dueDate);
  const [name, setName] = useState(bill.name);
  const [amount, setAmount] = useState(bill.amount != null ? String(bill.amount) : '');
  const [showDeleteBillDialog, setShowDeleteBillDialog] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = amount === '' ? undefined : parseFloat(amount);
    onSave({ name: name.trim(), dueDate, amount: Number.isNaN(num as number) ? undefined : num });
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
      description=""
      confirmLabel="Delete bill"
      onConfirm={() => {
        onDelete?.();
      }}
    />
    </>
  );
}
