/**
 * Budget store: envelopes, transactions, income, savings goals.
 * Persisted to IndexedDB (injected saveState). All data stays on-device.
 */

import type {
  BudgetState,
  Envelope,
  Transaction,
  IncomeEntry,
  SavingsGoal,
  BillDueDate,
} from './budgetTypes';
import { DEFAULT_ENVELOPES } from './budgetTypes';
import { isDateInPeriod, parseYYYYMMDD } from '@/app/utils/date';

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_AMOUNT_ABS = 1_000_000_000;

function validateTransactionParams(params: { amount: number; description: string; date: string }): void {
  if (!Number.isFinite(params.amount) || params.amount <= 0 || Math.abs(params.amount) > MAX_AMOUNT_ABS) {
    throw new Error('Please enter a valid amount.');
  }
  if (typeof params.description !== 'string' || params.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error('Description is too long. Shorten it and try again.');
  }
  if (typeof params.date !== 'string' || parseYYYYMMDD(params.date) === null) {
    throw new Error('Please enter a date (e.g. 2025-01-15).');
  }
}

function validateEnvelopeParams(name: string, limit: number): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Please enter a name for the envelope.');
  }
  if (!Number.isFinite(limit) || limit < 0 || limit > MAX_AMOUNT_ABS) {
    throw new Error('Please enter a valid amount for the envelope limit.');
  }
}

function validateIncomeParams(params: { amount: number; source: string; date: string }): void {
  if (!Number.isFinite(params.amount) || params.amount < 0 || params.amount > MAX_AMOUNT_ABS) {
    throw new Error('Please enter a valid income amount.');
  }
  if (typeof params.source !== 'string' || params.source.trim().length === 0) {
    throw new Error('Please enter a source for the income.');
  }
  if (typeof params.date !== 'string' || parseYYYYMMDD(params.date) === null) {
    throw new Error('Please enter a date (e.g. 2025-01-15).');
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Default state for new users or when no persisted state exists. */
export function getDefaultBudgetState(): BudgetState {
  return {
    envelopes: [...DEFAULT_ENVELOPES],
    transactions: [],
    income: [],
    savingsGoals: [],
    bills: [],
  };
}

/** Return type of getBudgetSummary(); used by Overview and other consumers. */
export interface BudgetSummary {
  totalIncome: number;
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  envelopes: Array<{ id: string; name: string; limit: number; spent: number; remaining: number }>;
  recentTransactions: Transaction[];
}

export interface BudgetStoreApi {
  getState: () => BudgetState;
  /** Replace all budget data with imported state (e.g. from backup). Validate with parseBudgetBackup first. */
  importData: (state: BudgetState) => void;
  addTransaction: (params: {
    amount: number;
    envelopeId?: string;
    description: string;
    date: string;
    importHash?: string;
    importSourceFile?: string;
    importConfidence?: number;
    payeeNormalized?: string;
    matchedReceiptId?: string;
  }) => Transaction;
  /** Add multiple transactions in one state update (e.g. receipt scanner). Envelope spent is correct and only one persist. */
  addTransactions: (params: Array<{
    amount: number;
    envelopeId?: string;
    description: string;
    date: string;
    importHash?: string;
    importSourceFile?: string;
    importConfidence?: number;
    payeeNormalized?: string;
    matchedReceiptId?: string;
  }>) => Transaction[];
  deleteTransaction: (id: string) => void;
  updateTransactionEnvelope: (transactionId: string, envelopeId: string) => void;
  /** Update transaction amount, date, description, and/or envelope. Adjusts envelope spent when amount or envelopeId changes. Pass envelopeId: undefined for uncategorized. */
  updateTransaction: (transactionId: string, params: Partial<{ amount: number; envelopeId: string | undefined; description: string; date: string }>) => void;
  setEnvelopeLimit: (envelopeId: string, limit: number) => void;
  updateEnvelope: (envelopeId: string, params: Partial<{ name: string; limit: number }>) => void;
  deleteEnvelope: (envelopeId: string) => void;
  addEnvelope: (name: string, limit: number) => Envelope;
  addIncome: (params: { amount: number; source: string; date: string }) => IncomeEntry;
  updateIncome: (id: string, params: Partial<{ amount: number; source: string; date: string }>) => void;
  deleteIncome: (id: string) => void;
  createSavingsGoal: (params: {
    name: string;
    targetAmount: number;
    targetDate?: string;
    monthlyContribution?: number;
  }) => SavingsGoal;
  updateSavingsGoal: (id: string, params: Partial<{ name: string; targetAmount: number; targetDate: string; monthlyContribution: number; currentAmount: number }>) => void;
  deleteSavingsGoal: (id: string) => void;
  addBill: (params: { name: string; dueDate: string; amount?: number; repeatMonthly?: boolean; envelopeId?: string }) => BillDueDate;
  updateBill: (id: string, params: Partial<{ name: string; dueDate: string; amount: number; repeatMonthly: boolean; envelopeId: string }>) => void;
  deleteBill: (id: string) => void;
  getBudgetSummary: () => BudgetSummary;
  /** Summary for a date range: spent and income computed from transactions/income in [period.start, period.end]. */
  getBudgetSummaryForPeriod: (period: { start: string; end: string }) => BudgetSummary;
}

export interface BudgetStoreOptions {
  /** Persist state to storage (e.g. IndexedDB). Required. */
  saveState: (state: BudgetState) => void;
  /** Called after each successful persist (for backup / external sync). */
  afterPersist?: (state: BudgetState) => void;
}

export function createBudgetStore(
  getState: () => BudgetState,
  setState: (state: BudgetState | ((prev: BudgetState) => BudgetState)) => void,
  options: BudgetStoreOptions
): BudgetStoreApi {
  const withRecomputedEnvelopeSpent = (state: BudgetState): BudgetState => {
    const spentByEnvelope: Record<string, number> = {};
    for (const envelope of state.envelopes) {
      spentByEnvelope[envelope.id] = 0;
    }
    for (const tx of state.transactions) {
      if (!tx.envelopeId || !Number.isFinite(tx.amount) || tx.amount <= 0) continue;
      if (tx.envelopeId in spentByEnvelope) {
        spentByEnvelope[tx.envelopeId] += tx.amount;
      }
    }
    return {
      ...state,
      envelopes: state.envelopes.map((envelope) => ({
        ...envelope,
        spent: Math.max(0, spentByEnvelope[envelope.id] ?? 0),
      })),
    };
  };

  /** Persist a full state (e.g. import). */
  const persist = (next: BudgetState) => {
    setState(next);
    options.saveState(next);
    options.afterPersist?.(next);
  };

  /** Apply an update using latest state; avoids stale closures. */
  const updateState = (fn: (prev: BudgetState) => BudgetState) => {
    setState((prev) => {
      const next = fn(prev);
      options.saveState(next);
      options.afterPersist?.(next);
      return next;
    });
  };

  return {
    getState,

    importData(state) {
      persist(withRecomputedEnvelopeSpent(state));
    },

    addTransaction(params) {
      validateTransactionParams(params);
      let created: Transaction | null = null;
      updateState((state) => {
        // Normalize envelopeId: if it doesn't exist (e.g. envelope was deleted), treat as uncategorized
        const validEnvelopeId =
          params.envelopeId != null && params.envelopeId !== '' && state.envelopes.some((e) => e.id === params.envelopeId)
            ? params.envelopeId
            : undefined;

        const tx: Transaction = {
          id: generateId(),
          amount: params.amount,
          envelopeId: validEnvelopeId,
          description: params.description,
          date: params.date,
          createdAt: new Date().toISOString(),
          ...(params.importHash !== undefined ? { importHash: params.importHash } : {}),
          ...(params.importSourceFile !== undefined ? { importSourceFile: params.importSourceFile } : {}),
          ...(params.importConfidence !== undefined ? { importConfidence: params.importConfidence } : {}),
          ...(params.payeeNormalized !== undefined ? { payeeNormalized: params.payeeNormalized } : {}),
          ...(params.matchedReceiptId !== undefined ? { matchedReceiptId: params.matchedReceiptId } : {}),
        };
        created = tx;

        const newEnvelopes =
          validEnvelopeId != null
            ? state.envelopes.map((e) =>
                e.id === validEnvelopeId ? { ...e, spent: e.spent + params.amount } : e
              )
            : state.envelopes;
        return {
          ...state,
          envelopes: newEnvelopes,
          transactions: [tx, ...state.transactions],
        };
      });
      return created!;
    },

    addTransactions(paramsList) {
      if (!Array.isArray(paramsList) || paramsList.length === 0) return [];
      paramsList.forEach((p) => validateTransactionParams(p));
      const created: Transaction[] = [];
      updateState((state) => {
        const envelopeSpendDeltas: Record<string, number> = {};
        const newTxs: Transaction[] = [];
        for (const params of paramsList) {
          const validEnvelopeId =
            params.envelopeId != null && params.envelopeId !== '' && state.envelopes.some((e) => e.id === params.envelopeId)
              ? params.envelopeId
              : undefined;
          const tx: Transaction = {
            id: generateId(),
            amount: params.amount,
            envelopeId: validEnvelopeId,
            description: params.description,
            date: params.date,
            createdAt: new Date().toISOString(),
            ...(params.importHash !== undefined ? { importHash: params.importHash } : {}),
            ...(params.importSourceFile !== undefined ? { importSourceFile: params.importSourceFile } : {}),
            ...(params.importConfidence !== undefined ? { importConfidence: params.importConfidence } : {}),
            ...(params.payeeNormalized !== undefined ? { payeeNormalized: params.payeeNormalized } : {}),
            ...(params.matchedReceiptId !== undefined ? { matchedReceiptId: params.matchedReceiptId } : {}),
          };
          created.push(tx);
          newTxs.push(tx);
          if (validEnvelopeId != null) {
            envelopeSpendDeltas[validEnvelopeId] = (envelopeSpendDeltas[validEnvelopeId] ?? 0) + params.amount;
          }
        }
        return {
          ...state,
          envelopes: state.envelopes.map((envelope) => {
            const delta = envelopeSpendDeltas[envelope.id];
            if (!delta) return envelope;
            return { ...envelope, spent: envelope.spent + delta };
          }),
          transactions: [...newTxs, ...state.transactions],
        };
      });
      return created;
    },

    deleteTransaction(id) {
      updateState((state) => {
        const tx = state.transactions.find((t) => t.id === id);
        if (!tx) return state;

        const newEnvelopes =
          tx.envelopeId != null && tx.envelopeId !== ''
            ? state.envelopes.map((e) =>
                e.id === tx.envelopeId ? { ...e, spent: Math.max(0, e.spent - tx.amount) } : e
              )
            : state.envelopes;
        return {
          ...state,
          envelopes: newEnvelopes,
          transactions: state.transactions.filter((t) => t.id !== id),
        };
      });
    },

    updateTransactionEnvelope(transactionId, envelopeId) {
      updateState((state) => {
        const tx = state.transactions.find((t) => t.id === transactionId);
        if (!tx) return state;
        const hadEnvelope = tx.envelopeId != null && tx.envelopeId !== '';
        const newEnv = envelopeId != null && envelopeId !== '' ? state.envelopes.find((e) => e.id === envelopeId) : null;
        if (newEnv === undefined && (envelopeId ?? '') !== '') return state; // invalid new envelope id

        const newEnvelopes = state.envelopes.map((e) => {
          if (hadEnvelope && e.id === tx.envelopeId) return { ...e, spent: Math.max(0, e.spent - tx.amount) };
          if (newEnv && e.id === envelopeId) return { ...e, spent: e.spent + tx.amount };
          return e;
        });
        const newTransactions = state.transactions.map((t) =>
          t.id === transactionId ? { ...t, envelopeId: envelopeId && envelopeId !== '' ? envelopeId : undefined } : t
        );
        return { ...state, envelopes: newEnvelopes, transactions: newTransactions };
      });
    },

    updateTransaction(transactionId, params) {
      if (params.amount !== undefined && (!Number.isFinite(params.amount) || params.amount <= 0 || Math.abs(params.amount) > MAX_AMOUNT_ABS)) {
        throw new Error('Please enter a valid amount.');
      }
      if (params.date !== undefined && (typeof params.date !== 'string' || parseYYYYMMDD(params.date) === null)) {
        throw new Error('Please enter a date (e.g. 2025-01-15).');
      }
      if (params.description !== undefined && (typeof params.description !== 'string' || params.description.length > MAX_DESCRIPTION_LENGTH)) {
        throw new Error('Description is too long. Shorten it and try again.');
      }
      updateState((state) => {
        const tx = state.transactions.find((t) => t.id === transactionId);
        if (!tx) return state;
        let nextEnvelopeId = params.envelopeId !== undefined ? (params.envelopeId && params.envelopeId !== '' ? params.envelopeId : undefined) : tx.envelopeId;
        if (nextEnvelopeId != null && !state.envelopes.some((e) => e.id === nextEnvelopeId)) nextEnvelopeId = undefined;
        const nextTx = { ...tx, ...params, envelopeId: nextEnvelopeId };
        const amountDelta = (params.amount ?? tx.amount) - tx.amount;
        const envelopeChanged = nextEnvelopeId !== tx.envelopeId;
        const hadEnvelope = tx.envelopeId != null && tx.envelopeId !== '';
        const hasEnvelope = nextEnvelopeId != null && nextEnvelopeId !== '';
        const newEnvelopes = state.envelopes.map((e) => {
          if (envelopeChanged) {
            if (hadEnvelope && e.id === tx.envelopeId) return { ...e, spent: Math.max(0, e.spent - tx.amount) };
            if (hasEnvelope && e.id === nextEnvelopeId) return { ...e, spent: e.spent + (params.amount ?? tx.amount) };
            return e;
          }
          if (hadEnvelope && e.id === tx.envelopeId && amountDelta !== 0) return { ...e, spent: Math.max(0, e.spent + amountDelta) };
          return e;
        });
        const newTransactions = state.transactions.map((t) => (t.id === transactionId ? nextTx : t));
        return { ...state, envelopes: newEnvelopes, transactions: newTransactions };
      });
    },

    setEnvelopeLimit(envelopeId, limit) {
      updateState((state) => ({
        ...state,
        envelopes: state.envelopes.map((e) =>
          e.id === envelopeId ? { ...e, limit } : e
        ),
      }));
    },

    updateEnvelope(envelopeId, params) {
      updateState((state) => {
        const idx = state.envelopes.findIndex((e) => e.id === envelopeId);
        if (idx === -1) return state;
        const existing = state.envelopes[idx];
        let name = existing.name;
        let limit = existing.limit;
        if (params.name !== undefined) {
          const t = params.name.trim();
          if (t.length === 0) throw new Error('Envelope name is required.');
          name = t;
        }
        if (params.limit !== undefined) {
          if (!Number.isFinite(params.limit) || params.limit < 0 || params.limit > MAX_AMOUNT_ABS) {
            throw new Error('Envelope limit is invalid.');
          }
          limit = params.limit;
        }
        return {
          ...state,
          envelopes: state.envelopes.map((e) =>
            e.id === envelopeId ? { ...e, name, limit } : e
          ),
        };
      });
    },

    deleteEnvelope(envelopeId) {
      updateState((state) => {
        if (!state.envelopes.some((e) => e.id === envelopeId)) return state;
        return {
          ...state,
          envelopes: state.envelopes.filter((e) => e.id !== envelopeId),
          transactions: state.transactions.map((t) =>
            t.envelopeId === envelopeId ? { ...t, envelopeId: undefined } : t
          ),
          bills: state.bills.map((b) =>
            b.envelopeId === envelopeId ? { ...b, envelopeId: undefined } : b
          ),
        };
      });
    },

    addEnvelope(name, limit) {
      validateEnvelopeParams(name, limit);
      let created: Envelope | null = null;
      updateState((state) => {
        const env: Envelope = {
          id: `env-${generateId()}`,
          name,
          limit,
          spent: 0,
        };
        created = env;
        return { ...state, envelopes: [...state.envelopes, env] };
      });
      return created!;
    },

    addIncome(params) {
      validateIncomeParams(params);
      let created: IncomeEntry | null = null;
      updateState((state) => {
        const entry: IncomeEntry = {
          id: generateId(),
          amount: params.amount,
          source: params.source,
          date: params.date,
          createdAt: new Date().toISOString(),
        };
        created = entry;
        return { ...state, income: [entry, ...state.income] };
      });
      return created!;
    },

    updateIncome(id, params) {
      updateState((state) => {
        const idx = state.income.findIndex((i) => i.id === id);
        if (idx === -1) return state;
        const existing = state.income[idx];
        const next = { ...existing };
        if (params.amount !== undefined) {
          if (!Number.isFinite(params.amount) || params.amount < 0 || params.amount > MAX_AMOUNT_ABS) {
            throw new Error('Income amount is invalid.');
          }
          next.amount = params.amount;
        }
        if (params.source !== undefined) {
          if (typeof params.source !== 'string' || params.source.trim().length === 0) {
            throw new Error('Income source is required.');
          }
          next.source = params.source.trim();
        }
        if (params.date !== undefined) {
          if (parseYYYYMMDD(params.date) === null) {
            throw new Error('Date is invalid. Use YYYY-MM-DD.');
          }
          next.date = params.date;
        }
        return {
          ...state,
          income: state.income.map((i) => (i.id === id ? next : i)),
        };
      });
    },

    deleteIncome(id) {
      updateState((state) => ({
        ...state,
        income: state.income.filter((i) => i.id !== id),
      }));
    },

    createSavingsGoal(params) {
      let created: SavingsGoal | null = null;
      updateState((state) => {
        const goal: SavingsGoal = {
          id: generateId(),
          name: params.name,
          targetAmount: params.targetAmount,
          targetDate: params.targetDate ?? '',
          monthlyContribution: params.monthlyContribution ?? 0,
          currentAmount: 0,
          createdAt: new Date().toISOString(),
        };
        created = goal;
        return { ...state, savingsGoals: [...state.savingsGoals, goal] };
      });
      return created!;
    },

    updateSavingsGoal(id, params) {
      updateState((state) => {
        const idx = state.savingsGoals.findIndex((g) => g.id === id);
        if (idx === -1) return state;
        const existing = state.savingsGoals[idx];
        const next = { ...existing };
        if (params.name !== undefined) next.name = params.name.trim() || existing.name;
        if (params.targetAmount !== undefined) next.targetAmount = Math.max(0, params.targetAmount);
        if (params.targetDate !== undefined) next.targetDate = params.targetDate;
        if (params.monthlyContribution !== undefined) next.monthlyContribution = Math.max(0, params.monthlyContribution);
        if (params.currentAmount !== undefined) next.currentAmount = Math.max(0, params.currentAmount);
        return {
          ...state,
          savingsGoals: state.savingsGoals.map((g) => (g.id === id ? next : g)),
        };
      });
    },

    deleteSavingsGoal(id) {
      updateState((state) => ({
        ...state,
        savingsGoals: state.savingsGoals.filter((g) => g.id !== id),
      }));
    },

    addBill(params) {
      let created: BillDueDate | null = null;
      updateState((state) => {
        const bill: BillDueDate = {
          id: generateId(),
          name: params.name,
          dueDate: params.dueDate,
          amount: params.amount,
          repeatMonthly: params.repeatMonthly ?? false,
          envelopeId: params.envelopeId,
        };
        created = bill;
        return { ...state, bills: [...state.bills, bill] };
      });
      return created!;
    },

    updateBill(id, params) {
      updateState((state) => {
        const idx = state.bills.findIndex((b) => b.id === id);
        if (idx === -1) return state;
        return {
          ...state,
          bills: state.bills.map((b) =>
            b.id === id ? { ...b, ...params } : b
          ),
        };
      });
    },

    deleteBill(id) {
      updateState((state) => ({
        ...state,
        bills: state.bills.filter((b) => b.id !== id),
      }));
    },

    getBudgetSummary() {
      const state = getState();
      const totalIncome = state.income.reduce((s, i) => s + i.amount, 0);
      const totalBudgeted = state.envelopes.reduce((s, e) => s + e.limit, 0);
      const totalSpent = state.envelopes.reduce((s, e) => s + e.spent, 0);
      const remaining = totalIncome - totalSpent;
      const envelopes = state.envelopes.map((e) => ({
        id: e.id,
        name: e.name,
        limit: e.limit,
        spent: e.spent,
        remaining: e.limit - e.spent,
      }));
      const recentTransactions = state.transactions.slice(0, 20);
      return {
        totalIncome,
        totalBudgeted,
        totalSpent,
        remaining,
        envelopes,
        recentTransactions,
      };
    },

    getBudgetSummaryForPeriod(period) {
      const state = getState();
      const { start, end } = period;
      const totalIncome = state.income
        .filter((i) => isDateInPeriod(i.date, start, end))
        .reduce((s, i) => s + i.amount, 0);
      const totalBudgeted = state.envelopes.reduce((s, e) => s + e.limit, 0);
      const spentByEnvelope: Record<string, number> = {};
      for (const e of state.envelopes) spentByEnvelope[e.id] = 0;
      for (const tx of state.transactions) {
        if (tx.envelopeId && isDateInPeriod(tx.date, start, end)) {
          spentByEnvelope[tx.envelopeId] = (spentByEnvelope[tx.envelopeId] ?? 0) + tx.amount;
        }
      }
      const envelopes = state.envelopes.map((e) => {
        const spent = spentByEnvelope[e.id] ?? 0;
        return {
          id: e.id,
          name: e.name,
          limit: e.limit,
          spent,
          remaining: e.limit - spent,
        };
      });
      const totalSpent = envelopes.reduce((s, e) => s + e.spent, 0);
      const remaining = totalIncome - totalSpent;
      const recentTransactions = state.transactions
        .filter((t) => isDateInPeriod(t.date, start, end))
        .slice(0, 20);
      return {
        totalIncome,
        totalBudgeted,
        totalSpent,
        remaining,
        envelopes,
        recentTransactions,
      };
    },
  };
}
