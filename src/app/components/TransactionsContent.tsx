import { useState, useMemo, useEffect, memo, useCallback, useRef } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { formatMoney, formatDate } from '@/app/utils/format';
import { todayISO } from '@/app/utils/date';
import { useTransactionFilter } from '@/app/contexts/TransactionFilterContext';
import { TransactionEditForm } from '@/app/components/TransactionEditForm';
import { delayedToast } from '@/app/services/delayedToast';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';
import { inputCls, selectCls } from '@/app/utils/classNames';
import { SplitTransactionDialog } from '@/app/components/SplitTransactionDialog';

function TransactionsContentInner() {
  const { state, api } = useBudget();
  const filterContext = useTransactionFilter();
  const [search, setSearch] = useState('');
  const [filterEnvelopeId, setFilterEnvelopeId] = useState<string>('');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [showDeleteTransactionDialogEdit, setShowDeleteTransactionDialogEdit] = useState(false);
  const [deleteTransactionEditTargetId, setDeleteTransactionEditTargetId] = useState<string | null>(null);
  const [showDeleteTransactionDialogList, setShowDeleteTransactionDialogList] = useState(false);
  const [deleteTransactionListTargetId, setDeleteTransactionListTargetId] = useState<string | null>(null);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitTargetId, setSplitTargetId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteRef = useRef<string | null>(null);
  pendingDeleteRef.current = pendingDeleteId;

  useEffect(() => {
    return () => {
      const id = pendingDeleteRef.current;
      if (id) api.deleteTransaction(id);
    };
  }, [api]);

  useEffect(() => {
    const initial = filterContext?.initialFilter;
    if (initial?.envelopeId) {
      setFilterEnvelopeId(initial.envelopeId);
      filterContext?.clearInitialFilter();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount when coming from envelope link
  }, [filterContext?.initialFilter]);

  const transactions = state.transactions;
  const envelopes = state.envelopes;
  const envelopeNameById = useMemo(
    () => new Map(envelopes.map((envelope) => [envelope.id, envelope.name])),
    [envelopes]
  );

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
            ? (envelopeNameById.get(t.envelopeId) ?? '').toLowerCase().includes(q)
            : 'uncategorized'.includes(q))
      );
    }
    return list;
  }, [transactions, envelopeNameById, filterEnvelopeId, search]);

  const visibleFiltered = useMemo(
    () => filtered.filter((t) => t.id !== pendingDeleteId),
    [filtered, pendingDeleteId]
  );

  const handleDeleteTransaction = useCallback((id: string) => {
    setPendingDeleteId(id);
    setEditingTransactionId((eid) => (eid === id ? null : eid));
    delayedToast.successWithUndo(
      'Transaction deleted',
      () => {
        api.deleteTransaction(id);
        setPendingDeleteId(null);
      },
      () => setPendingDeleteId(null),
    );
  }, [api]);

  const getEnvelopeName = (id: string | undefined) =>
    id ? (envelopeNameById.get(id) ?? id) : 'Uncategorized';

  const ADD_TRANSACTION_ID = '__new__';
  const newTransactionDummy = {
    id: ADD_TRANSACTION_ID,
    amount: 0,
    envelopeId: envelopes[0]?.id ?? '',
    description: '',
    date: todayISO(),
    createdAt: new Date().toISOString(),
  };

  const countLabel = useMemo(() => {
    const total = transactions.length;
    const shown = visibleFiltered.length;
    const hasSearch = search.trim().length > 0;
    const hasEnvFilter = filterEnvelopeId !== '';
    if (!hasSearch && !hasEnvFilter) return `${total} transaction${total !== 1 ? 's' : ''}`;
    const filterDesc = hasEnvFilter
      ? filterEnvelopeId === '__uncategorized__'
        ? 'uncategorized'
        : (envelopeNameById.get(filterEnvelopeId) ?? 'selected envelope')
      : '';
    if (hasSearch && hasEnvFilter) return `${shown} matching "${search.trim()}" in ${filterDesc}`;
    if (hasSearch) return `${shown} matching "${search.trim()}"`;
    return `${shown} of ${
      transactions.filter((t) =>
        filterEnvelopeId === '__uncategorized__' ? !t.envelopeId : t.envelopeId === filterEnvelopeId
      ).length
    } in ${filterDesc}`;
  }, [visibleFiltered.length, transactions, search, filterEnvelopeId, envelopeNameById]);

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
          className={`flex-1 min-w-[140px] ${inputCls}`}
          aria-label="Search transactions"
        />
        <select
          value={filterEnvelopeId}
          onChange={(e) => setFilterEnvelopeId(e.target.value)}
          className={selectCls}
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
                const desc = (updates.description ?? '').trim();
                if (!desc) {
                  delayedToast.error('Enter a description for this transaction.');
                  return;
                }
                api.addTransaction({
                  amount: num,
                  envelopeId: updates.envelopeId,
                  description: desc,
                  date: updates.date ?? todayISO(),
                });
                setEditingTransactionId(null);
              } catch {
                delayedToast.error('Could not add transaction. Please check the amount and date, then try again.');
              }
            }}
            onCancel={() => setEditingTransactionId(null)}
            onDelete={() => {}}
          />
        </div>
      )}

      <div className="space-y-2">
        {visibleFiltered.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-center">
            {transactions.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-1">No transactions yet</p>
                <p className="text-xs text-muted-foreground">
                  Add expenses from Envelopes &amp; Expenses to see them here.
                </p>
              </>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions match your search or filter.</p>
            ) : null}
          </div>
        ) : (
          visibleFiltered.map((tx) => (
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
                    } catch {
                      delayedToast.error('Could not update transaction. Please try again.');
                    }
                  }}
                  onCancel={() => setEditingTransactionId(null)}
                  onDelete={() => {
                    setDeleteTransactionEditTargetId(tx.id);
                    setShowDeleteTransactionDialogEdit(true);
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
                    <p className="text-sm font-bold text-foreground font-mono">
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
                          setSplitTargetId(tx.id);
                          setShowSplitDialog(true);
                        }}
                        className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        aria-label="Split transaction"
                      >
                        Split
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTransactionListTargetId(tx.id);
                          setShowDeleteTransactionDialogList(true);
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
          {countLabel}
        </p>
      </div>

      <ConfirmDialog
        open={showDeleteTransactionDialogEdit}
        onOpenChange={(open) => {
          setShowDeleteTransactionDialogEdit(open);
          if (!open) setDeleteTransactionEditTargetId(null);
        }}
        title="Delete transaction?"
        description="The transaction will disappear immediately. You'll have a moment to undo."
        confirmLabel="Delete transaction"
        onConfirm={() => {
          const id = deleteTransactionEditTargetId;
          if (id) handleDeleteTransaction(id);
        }}
      />

      <ConfirmDialog
        open={showDeleteTransactionDialogList}
        onOpenChange={(open) => {
          setShowDeleteTransactionDialogList(open);
          if (!open) setDeleteTransactionListTargetId(null);
        }}
        title="Delete transaction?"
        description="The transaction will disappear immediately. You'll have a moment to undo."
        confirmLabel="Delete transaction"
        onConfirm={() => {
          const id = deleteTransactionListTargetId;
          if (id) handleDeleteTransaction(id);
        }}
      />

      <SplitTransactionDialog
        open={showSplitDialog}
        onOpenChange={(open) => {
          setShowSplitDialog(open);
          if (!open) setSplitTargetId(null);
        }}
        transaction={splitTargetId ? (transactions.find((t) => t.id === splitTargetId) ?? null) : null}
        envelopes={envelopes}
        onConfirm={(splits) => {
          const tx = splitTargetId ? transactions.find((t) => t.id === splitTargetId) : undefined;
          if (!tx) return;
          try {
            api.deleteTransaction(tx.id);
            api.addTransactions(
              splits.map((s) => ({
                amount: s.amount,
                envelopeId: s.envelopeId,
                description: s.description,
                date: tx.date,
              }))
            );
            delayedToast.success('Transaction split.');
          } catch {
            delayedToast.error('Could not split transaction. Please try again.');
          }
        }}
      />
    </div>
  );
}

export const TransactionsContent = memo(TransactionsContentInner);
