import { useState } from 'react';
import type { BillDueDate } from '@/app/store/budgetTypes';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = amount === '' ? undefined : parseFloat(amount);
    onSave({ name: name.trim(), dueDate, amount: Number.isNaN(num as number) ? undefined : num });
  };

  return (
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
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        placeholder="Amount (optional)"
        aria-label="Amount optional"
      />
      <div className="flex gap-2 flex-wrap">
        <button type="submit" className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm">
          Save
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1 rounded border text-sm">
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={() => { if (window.confirm('Delete this bill?')) onDelete(); }}
            className="px-3 py-1 rounded border border-destructive/50 text-destructive text-sm"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
