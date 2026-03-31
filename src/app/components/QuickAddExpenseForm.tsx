import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';

export interface QuickAddExpenseFormProps {
  date: string;
  envelopeId: string;
  envelopes: { id: string; name: string }[];
  onAdd: (amount: number, envelopeId: string, description: string) => void;
  onCancel: () => void;
}

export function QuickAddExpenseForm({
  envelopeId,
  envelopes,
  onAdd,
  onCancel,
}: QuickAddExpenseFormProps) {
  const [amount, setAmount] = useState('');
  const [envId, setEnvId] = useState(envelopeId);
  const [description, setDescription] = useState('');

  // Keep selected envelope valid when list changes (e.g. envelope deleted)
  useEffect(() => {
    const valid = envelopes.some((e) => e.id === envId);
    if (!valid) setEnvId((envelopeId || envelopes[0]?.id) ?? '');
  }, [envelopes, envelopeId, envId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0 || !envId) return;
    onAdd(num, envId, description.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2 rounded-lg border border-border bg-muted/30">
      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        required
        aria-label="Amount"
      />
      <select
        value={envId}
        onChange={(e) => setEnvId(e.target.value)}
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Envelope"
      >
        {envelopes.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Description"
      />
      <div className="flex gap-2">
        <Button type="submit" className="min-h-[44px]">
          Add
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="min-h-[44px]">
          Cancel
        </Button>
      </div>
    </form>
  );
}
