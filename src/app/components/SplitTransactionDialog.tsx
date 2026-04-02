import { useEffect, useMemo, useState } from 'react';
import type { Envelope, Transaction } from '@/app/store/budgetTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { formatMoney, formatDate } from '@/app/utils/format';
import { inputCls, selectCls } from '@/app/utils/classNames';
import { delayedToast } from '@/app/services/delayedToast';

type SplitDraft = {
  amount: number;
  envelopeId: string;
  description: string;
};

export function SplitTransactionDialog({
  open,
  onOpenChange,
  transaction,
  envelopes,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  envelopes: Envelope[];
  onConfirm: (splits: Array<{ amount: number; envelopeId?: string; description: string }>) => void;
}) {
  const originalAmount = transaction?.amount ?? 0;
  const [rows, setRows] = useState<SplitDraft[]>([]);

  useEffect(() => {
    if (!open || !transaction) return;
    const baseDesc = (transaction.description ?? '').trim();
    const baseEnvelope = transaction.envelopeId ?? '';
    const half = originalAmount / 2;
    setRows([
      { amount: Number.isFinite(half) ? half : 0, envelopeId: baseEnvelope, description: baseDesc },
      { amount: Number.isFinite(half) ? originalAmount - half : 0, envelopeId: baseEnvelope, description: baseDesc },
    ]);
  }, [open, transaction, originalAmount]);

  const splitsSum = useMemo(() => rows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0), [rows]);
  const remaining = useMemo(() => originalAmount - splitsSum, [originalAmount, splitsSum]);
  const canConfirm = useMemo(() => {
    if (!transaction) return false;
    if (rows.length < 2) return false;
    const allValid = rows.every((r) => Number.isFinite(r.amount) && r.amount > 0 && r.description.trim().length > 0);
    if (!allValid) return false;
    // must balance exactly to original
    return Math.round(remaining * 100) === 0;
  }, [rows, remaining, transaction]);

  const updateRow = (idx: number, next: Partial<SplitDraft>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...next } : r)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { amount: 0, envelopeId: '', description: transaction?.description ?? '' },
    ]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    if (!transaction) return;
    if (!canConfirm) {
      delayedToast.error('Splits must add up exactly to the original amount.');
      return;
    }
    onConfirm(
      rows.map((r) => ({
        amount: r.amount,
        envelopeId: r.envelopeId || undefined,
        description: r.description.trim(),
      }))
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Split transaction</DialogTitle>
        </DialogHeader>

        {!transaction ? (
          <p className="text-sm text-muted-foreground">No transaction selected.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground mb-1">Original</p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{transaction.description}</span>
                  <span className="font-mono shrink-0">{formatMoney(-transaction.amount)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{transaction.envelopeId ? envelopes.find((e) => e.id === transaction.envelopeId)?.name ?? 'Envelope' : 'Uncategorized'}</span>
                  <span>{formatDate(transaction.date)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {rows.map((r, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={Number.isFinite(r.amount) ? r.amount : 0}
                      onChange={(e) => updateRow(idx, { amount: parseFloat(e.target.value || '0') })}
                      className={`${inputCls} font-mono`}
                      aria-label={`Split amount ${idx + 1}`}
                    />
                    <select
                      className={selectCls}
                      value={r.envelopeId}
                      onChange={(e) => updateRow(idx, { envelopeId: e.target.value })}
                      aria-label={`Split envelope ${idx + 1}`}
                    >
                      <option value="">Uncategorized</option>
                      {envelopes.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length <= 2}
                      className="min-h-[44px]"
                    >
                      Remove
                    </Button>
                  </div>
                  <input
                    type="text"
                    value={r.description}
                    onChange={(e) => updateRow(idx, { description: e.target.value })}
                    className={inputCls}
                    aria-label={`Split description ${idx + 1}`}
                    placeholder="Description"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={addRow}>
                Add row
              </Button>
              <div className="text-sm text-muted-foreground">
                Remaining:{' '}
                <span className={`font-mono ${Math.round(remaining * 100) === 0 ? 'text-primary' : 'text-amber-600 dark:text-amber-400'}`}>
                  {formatMoney(-remaining)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
                Confirm split
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

