import { useState } from 'react';

export interface QuickAddIncomeFormProps {
  date: string;
  onAdd: (amount: number, source: string) => void;
  onCancel: () => void;
}

export function QuickAddIncomeForm({ onAdd, onCancel }: QuickAddIncomeFormProps) {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0 || !source.trim()) return;
    onAdd(num, source.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2 rounded-lg border border-green-500/30 bg-green-500/5">
      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        required
        aria-label="Income amount"
      />
      <input
        type="text"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Source (e.g. Salary, Freelance)"
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        required
        aria-label="Income source"
      />
      <div className="flex gap-2">
        <button type="submit" className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm">
          Add income
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1 rounded border text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
