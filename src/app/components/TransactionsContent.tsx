import { useState, useMemo, useEffect, memo } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { formatMoney, formatDate } from '@/app/utils/format';
import { useTransactionFilter } from '@/app/contexts/TransactionFilterContext';
import { TransactionEditForm } from '@/app/components/TransactionEditForm';
import { delayedToast } from '@/app/services/delayedToast';

function TransactionsContentInner() {
  const { state, api } = useBudget();
  const filterContext = useTransactionFilter();
  const [search, setSearch] = useState('');
  const [filterEnvelopeId, setFilterEnvelopeId] = useState<string>('');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  useEffect(() => {
    const initial = filterContext?.initialFilter;
    if (initial?.envelopeId) {
      setFilterEnvelopeId(initial.envelopeId);
      filterContext?.clearInitialFilter();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount when coming from envelope link
  }, [filterContext?.initialFilter]);

  const transactions = useMemo(() => state.transactions ?? [], [state.transactions]);
  const envelopes = useMemo(() => state.envelopes ?? [], [state.envelopes]);

  // Clear filter if the selected envelope was deleted (e.g. from Envelopes tab)
  const envelopeIds = useMemo(() => new Set(envelopes.map((e) => e.id)), [envelopes]);
  useEffect(() => {
    if (filterEnvelopeId && filterEnvelopeId !== '__uncategorized__' && !envelopeIds.has(filterEnvelopeId)) {
      setFilterEnvelopeId('');
    }
  }, [envelopeIds, filterEnvelopeId]);
  const filtered = useMemo(() => {
    let list = transactions;
    if (filterEnvelopeId !== '') {
      if (filterEnvelopeId === '__uncategorized__') {
        list = list.filter((t) => t.envelopeId == null || t.envelopeId === '');
      } else {
        list = list.filter((t) => t.envelopeId === filterEnvelopeId);
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          (t.envelopeId
            ? envelopes.find((e) => e.id === t.envelopeId)?.name.toLowerCase().includes(q)
            : 'uncategorized'.includes(q))
      );
    }
    return list;
  }, [transactions, envelopes, filterEnvelopeId, search]);

  const getEnvelopeName = (id: string | undefined) =>
    id ? (envelopes.find((e) => e.id === id)?.name ?? id) : 'Uncategorized';

  const ADD_TRANSACTION_ID = '__new__';
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const newTransactionDummy = {
    id: ADD_TRANSACTION_ID,
    amount: 0,
    description: '',
    date: todayISO(),
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg text-primary">Transaction History</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingTransactionId(ADD_TRANSACTION_ID)}
            className="px-3 py-1.5 min-h-[44px] rounded-lg bg-primary text-primary-foreground text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 hover:opacity-90 transition-opacity"
            aria-label="Add transaction"
          >
            Add transaction
          </button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="search"
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[140px] min-h-[44px] px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Search transactions"
        />
        <select
          value={filterEnvelopeId}
          onChange={(e) => setFilterEnvelopeId(e.target.value)}
          className="min-h-[44px] px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Filter by envelope"
        >
          <option value="">All Envelopes</option>
          <option value="__uncategorized__">Uncategorized</option>
          {envelopes.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {editingTransactionId === ADD_TRANSACTION_ID && (
        <div className="p-3 bg-card border border-primary/30 rounded-lg">
          <TransactionEditForm
            transaction={newTransactionDummy}
            envelopes={envelopes}
            isNew
            onSave={(updates) => {
              try {
                const num = updates.amount ?? 0;
                if (Number.isNaN(num) || num <= 0) {
                  delayedToast.error('Enter a valid amount.');
                  return;
                }
                api.addTransaction({
                  amount: num,
                  envelopeId: updates.envelopeId,
                  description: (updates.description ?? '').trim() || 'Transaction',
                  date: updates.date ?? todayISO(),
                });
                setEditingTransactionId(null);
              } catch (err) {
                delayedToast.error(err instanceof Error ? err.message : 'Could not add transaction.');
              }
            }}
            onCancel={() => setEditingTransactionId(null)}
            onDelete={() => {}}
          />
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-center">
            {transactions.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-1">No transactions yet</p>
                <p className="text-xs text-muted-foreground">
                  Add expenses from Envelopes &amp; Expenses to see them here.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No transactions match your search or filter.</p>
            )}
          </div>
        ) : (
          filtered.map((tx) => (
            <div
              key={tx.id}
              className="p-3 bg-card border border-border rounded-lg transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
            >
              {editingTransactionId === tx.id ? (
                <TransactionEditForm
                  transaction={tx}
                  envelopes={envelopes}
                  onSave={(updates) => {
                    try {
                      api.updateTransaction(tx.id, updates);
                      setEditingTransactionId(null);
                    } catch (err) {
                      delayedToast.error(err instanceof Error ? err.message : 'Could not update transaction.');
                    }
                  }}
                  onCancel={() => setEditingTransactionId(null)}
                  onDelete={() => {
                    if (window.confirm('Delete this transaction? This cannot be undone.')) {
                      api.deleteTransaction(tx.id);
                      setEditingTransactionId(null);
                    }
                  }}
                />
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{tx.description}</span>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                        {getEnvelopeName(tx.envelopeId ?? undefined)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground" style={{ fontFamily: 'Courier New, monospace' }}>
                      {tx.amount < 0 ? `Refund ${formatMoney(Math.abs(tx.amount))}` : formatMoney(-tx.amount)}
                    </p>
                    <div className="flex gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => setEditingTransactionId(tx.id)}
                        className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        aria-label="Edit transaction"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Delete this transaction? This cannot be undone.')) {
                            api.deleteTransaction(tx.id);
                          }
                        }}
                        className="text-xs text-destructive hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        aria-label="Delete transaction"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="pt-3 border-t border-border flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

export const TransactionsContent = memo(TransactionsContentInner);
