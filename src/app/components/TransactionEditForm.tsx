import { useState } from 'react';
import type { Transaction } from '@/app/store/budgetTypes';
import { Button } from '@/app/components/ui/button';

export interface TransactionEditFormProps {
  transaction: Transaction;
  envelopes: { id: string; name: string }[];
  onSave: (u: Partial<{ amount: number; envelopeId: string | undefined; description: string; date: string }>) => void | Promise<void>;
  onCancel: () => void;
  onDelete: () => void;
  /** When true, form is for adding a new transaction (no Delete button). */
  isNew?: boolean;
}

export function TransactionEditForm({
  transaction,
  envelopes,
  onSave,
  onCancel,
  onDelete,
  isNew = false,
}: TransactionEditFormProps) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [envelopeId, setEnvelopeId] = useState(transaction.envelopeId ?? '');
  const [description, setDescription] = useState(transaction.description);
  const [date, setDate] = useState(transaction.date);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) return;
    setSaving(true);
    try {
      const result = onSave({ amount: num, envelopeId: envelopeId || undefined, description: description.trim(), date });
      await (result instanceof Promise ? result : Promise.resolve());
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          placeholder="Amount"
          required
          aria-label="Amount"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Date"
        />
      </div>
      <select
        value={envelopeId}
        onChange={(e) => setEnvelopeId(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Envelope"
      >
        <option value="">Uncategorized</option>
        {envelopes.map((env) => (
          <option key={env.id} value={env.id}>{env.name}</option>
        ))}
      </select>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        placeholder="Description"
        aria-label="Description"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={saving}
          className="min-h-[44px]"
          aria-busy={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="min-h-[44px]">
          Cancel
        </Button>
        {!isNew && (
          <Button type="button" variant="destructive" onClick={onDelete} disabled={saving} className="min-h-[44px]">
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
