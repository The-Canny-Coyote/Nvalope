import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { useBudget } from '@/app/store/BudgetContext';
import { useDebouncedValue } from '@/app/hooks/useDebouncedValue';
import { getAppData, setAppData } from '@/app/services/appDataIdb';
import { formatMoney } from '@/app/utils/format';
import { ChevronLeft, ChevronRight, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import type { Transaction, CalendarEvent } from '@/app/store/budgetTypes';
import { TransactionEditForm } from '@/app/components/TransactionEditForm';
import { BillEditForm } from '@/app/components/BillEditForm';
import { IncomeEditForm } from '@/app/components/IncomeEditForm';
import { QuickAddExpenseForm } from '@/app/components/QuickAddExpenseForm';
import { QuickAddIncomeForm } from '@/app/components/QuickAddIncomeForm';
import { AppErrorBoundary } from '@/app/components/AppErrorBoundary';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/app/components/ui/popover';
import { Dialog, DialogContent, DialogTitle } from '@/app/components/ui/dialog';
import { delayedToast } from '@/app/services/delayedToast';
import { ConfirmDialog } from '@/app/components/ui/ConfirmDialog';
import { useAppStore } from '@/app/store/appStore';

function toISO(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}

const CALENDAR_PERSIST_DELAY_MS = 400;
const MIN_CALENDAR_YEAR = 2000;
const MAX_CALENDAR_YEAR = 2100;

function parseCalendarViewState(currentDateStr: string, selectedDateStr: string | null): { currentDate: Date; selectedDate: string | null } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(currentDateStr);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (y < MIN_CALENDAR_YEAR || y > MAX_CALENDAR_YEAR || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== y || date.getMonth() !== m - 1) return null;
  let selected: string | null = selectedDateStr;
  if (selectedDateStr !== null && !/^\d{4}-\d{2}-\d{2}$/.test(selectedDateStr)) selected = null;
  return { currentDate: date, selectedDate: selected };
}

export interface CalendarContentProps {
  highContrast?: boolean;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function CalendarContentInner({ highContrast = false }: CalendarContentProps) {
  const { state, api } = useBudget();
  const budgetPeriodMode = useAppStore((s) => s.budgetPeriodMode);
  const biweeklyPeriod1StartDay = useAppStore((s) => s.biweeklyPeriod1StartDay) ?? 1;
  const biweeklyPeriod1EndDay = useAppStore((s) => s.biweeklyPeriod1EndDay) ?? 14;
  const weekStartDay = useAppStore((s) => s.weekStartDay) ?? 0;
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [yearPopoverOpen, setYearPopoverOpen] = useState(false);
  const [monthPopoverOpen, setMonthPopoverOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [addExpenseForDate, setAddExpenseForDate] = useState<string | null>(null);
  const [addIncomeForDate, setAddIncomeForDate] = useState<string | null>(null);
  const [addBillForDate, setAddBillForDate] = useState<string | null>(null);
  const [billDraftName, setBillDraftName] = useState('');
  const [billDraftAmount, setBillDraftAmount] = useState('');
  const [billDraftRepeatMonthly, setBillDraftRepeatMonthly] = useState(false);
  const [billDraftEnvelopeId, setBillDraftEnvelopeId] = useState('');
  const [showDeleteTransactionDialogEdit, setShowDeleteTransactionDialogEdit] = useState(false);
  const [deleteTransactionEditTargetId, setDeleteTransactionEditTargetId] = useState<string | null>(null);
  const [showDeleteTransactionDialogList, setShowDeleteTransactionDialogList] = useState(false);
  const [deleteTransactionListTargetId, setDeleteTransactionListTargetId] = useState<string | null>(null);
  const [showDeleteIncomeDialog, setShowDeleteIncomeDialog] = useState(false);
  const [deleteIncomeTargetId, setDeleteIncomeTargetId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteRef = useRef<string | null>(null);
  pendingDeleteRef.current = pendingDeleteId;

  useEffect(() => {
    return () => {
      const id = pendingDeleteRef.current;
      if (id) api.deleteTransaction(id);
    };
  }, [api]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayButtonRefsMap = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    getAppData().then((data) => {
      const viewState = data.calendarViewState;
      if (!viewState?.currentDate) return;
      const parsed = parseCalendarViewState(viewState.currentDate, viewState.selectedDate ?? null);
      if (parsed) {
        setCurrentDate(parsed.currentDate);
        setSelectedDate(parsed.selectedDate);
      }
    });
  }, []);

  useEffect(() => {
    if (saveTimeoutRef.current != null) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      getAppData()
        .then((data) =>
          setAppData({
            ...data,
            calendarViewState: { currentDate: toISO(currentDate), selectedDate },
          })
        )
        .catch(() => {});
    }, CALENDAR_PERSIST_DELAY_MS);
    return () => {
      if (saveTimeoutRef.current != null) clearTimeout(saveTimeoutRef.current);
    };
  }, [currentDate, selectedDate]);

  const envelopes = state.envelopes;
  const transactions = state.transactions;
  const income = state.income;
  const bills = state.bills;

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  const eventsForMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const list: CalendarEvent[] = [];

    transactions.forEach((t) => {
      const d = t.date;
      const [y, m] = d.split('-').map(Number);
      if (y === year && m === month + 1) {
        const env = t.envelopeId ? envelopes.find((e) => e.id === t.envelopeId) : undefined;
        list.push({
          type: 'transaction',
          id: t.id,
          date: d,
          amount: t.amount,
          description: t.description,
          envelopeId: t.envelopeId,
          envelopeName: env?.name ?? (t.envelopeId ? '—' : 'Uncategorized'),
        });
      }
    });

    income.forEach((i) => {
      const d = i.date;
      const [y, m] = d.split('-').map(Number);
      if (y === year && m === month + 1) {
        list.push({ type: 'income', id: i.id, date: d, amount: i.amount, source: i.source });
      }
    });

    const daysInMonth = getDaysInMonth(currentDate);
    bills.forEach((b) => {
      const [dueY, dueM, dueD] = b.dueDate.split('-').map(Number);
      if (b.repeatMonthly) {
        const dayOfMonth = dueD;
        if (dayOfMonth >= 1 && dayOfMonth <= daysInMonth) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
          list.push({ type: 'bill', id: `${b.id}-${dayOfMonth}`, billId: b.id, date: dateStr, name: b.name, amount: b.amount, envelopeId: b.envelopeId });
        }
      } else if (dueY === year && dueM === month + 1) {
        list.push({ type: 'bill', id: b.id, billId: b.id, date: b.dueDate, name: b.name, amount: b.amount, envelopeId: b.envelopeId });
      }
    });

    return list;
  }, [currentDate, transactions, income, bills, envelopes]);

  const searchLower = debouncedSearchQuery.trim().toLowerCase();
  const filteredEvents = useMemo(() => {
    if (!searchLower) return eventsForMonth;
    return eventsForMonth.filter((e) => {
      if (e.type === 'transaction') return e.description.toLowerCase().includes(searchLower) || e.envelopeName.toLowerCase().includes(searchLower);
      if (e.type === 'income') return e.source.toLowerCase().includes(searchLower);
      if (e.type === 'bill') return e.name.toLowerCase().includes(searchLower);
      return false;
    });
  }, [eventsForMonth, searchLower]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((e) => {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    });
    return map;
  }, [filteredEvents]);

  const getEventsForDay = (day: number): CalendarEvent[] => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return eventsByDate.get(dateStr) ?? [];
  };

  const getTotalExpenseForDay = (day: number): number => {
    return getEventsForDay(day)
      .filter((e): e is CalendarEvent & { type: 'transaction' } => e.type === 'transaction')
      .reduce((s, e) => s + e.amount, 0);
  };

  const getTotalIncomeForDay = (day: number): number => {
    return getEventsForDay(day)
      .filter((e): e is CalendarEvent & { type: 'income' } => e.type === 'income')
      .reduce((s, e) => s + e.amount, 0);
  };

  // Weekly view: current week dates and events for those dates (built from all events for the 7 days, then filtered by search)
  const { weekDates, eventsByDateWeek } = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const dayOfWeek = date.getDay();
    const offset = (dayOfWeek - weekStartDay + 7) % 7;
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - offset);
    const dates: string[] = [];
    const weekEvents: CalendarEvent[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dates.push(toISO(d));
    }
    const dateSet = new Set(dates);
    transactions.forEach((t) => {
      if (dateSet.has(t.date)) {
        const env = envelopes.find((en) => en.id === t.envelopeId);
        weekEvents.push({ type: 'transaction', id: t.id, date: t.date, amount: t.amount, description: t.description, envelopeId: t.envelopeId, envelopeName: env?.name ?? (t.envelopeId ? '—' : 'Uncategorized') });
      }
    });
    income.forEach((i) => {
      if (dateSet.has(i.date)) weekEvents.push({ type: 'income', id: i.id, date: i.date, amount: i.amount, source: i.source });
    });
    bills.forEach((b) => {
      if (dateSet.has(b.dueDate)) weekEvents.push({ type: 'bill', id: `${b.id}-${b.dueDate}`, billId: b.id, date: b.dueDate, name: b.name, amount: b.amount, envelopeId: b.envelopeId });
    });
    const q = (debouncedSearchQuery ?? '').trim().toLowerCase();
    const filtered = q ? weekEvents.filter((e) => (e.type === 'transaction' && (e.description?.toLowerCase().includes(q) || e.envelopeName?.toLowerCase().includes(q))) || (e.type === 'income' && e.source?.toLowerCase().includes(q)) || (e.type === 'bill' && e.name?.toLowerCase().includes(q))) : weekEvents;
    const map = new Map<string, CalendarEvent[]>();
    dates.forEach((d) => map.set(d, []));
    filtered.forEach((e) => {
      const list = map.get(e.date);
      if (list) list.push(e);
    });
    return { weekDates: dates, eventsByDateWeek: map };
  }, [currentDate, weekStartDay, transactions, income, bills, envelopes, debouncedSearchQuery]);

  const getEventsForDate = (dateStr: string): CalendarEvent[] => eventsByDateWeek.get(dateStr) ?? [];
  const getTotalExpenseForDate = (dateStr: string): number =>
    getEventsForDate(dateStr)
      .filter((e): e is CalendarEvent & { type: 'transaction' } => e.type === 'transaction')
      .reduce((s, e) => s + e.amount, 0);
  const getTotalIncomeForDate = (dateStr: string): number =>
    getEventsForDate(dateStr)
      .filter((e): e is CalendarEvent & { type: 'income' } => e.type === 'income')
      .reduce((s, e) => s + e.amount, 0);

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const goToYear = (year: number) => {
    setCurrentDate(new Date(year, currentDate.getMonth(), Math.min(currentDate.getDate(), getDaysInMonth(new Date(year, currentDate.getMonth(), 1)))));
    setYearPopoverOpen(false);
  };

  const goToMonth = (month: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), month, 1));
    setMonthPopoverOpen(false);
  };

  const visibleSelectedEvents = useMemo(() => {
    const se = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];
    return se.filter((e) => !(e.type === 'transaction' && e.id === pendingDeleteId));
  }, [selectedDate, eventsByDate, pendingDeleteId]);
  const hasEnvelopes = envelopes.length > 0;

  const handleDeleteIncome = useCallback(
    (incomeEntryId: string) => {
      const entry = state.income.find((i) => i.id === incomeEntryId);
      if (!entry) return;
      delayedToast.successWithUndo(
        'Income deleted',
        () => {
          api.deleteIncome(incomeEntryId);
          setSelectedDate(null);
          setEditingIncomeId(null);
        },
        () => {
          api.addIncome({ amount: entry.amount, source: entry.source, date: entry.date });
        }
      );
    },
    [api, state.income]
  );

  const handleDeleteBill = useCallback(
    (billId: string) => {
      const bill = bills.find((b) => b.id === billId);
      if (!bill) return;
      delayedToast.successWithUndo(
        'Bill deleted',
        () => {
          api.deleteBill(billId);
          setSelectedDate(null);
          setEditingBillId(null);
        },
        () => {
          api.addBill({
            name: bill.name,
            dueDate: bill.dueDate,
            amount: bill.amount,
            repeatMonthly: bill.repeatMonthly ?? false,
            envelopeId: bill.envelopeId,
          });
        }
      );
    },
    [api, bills]
  );

  useEffect(() => {
    if (!addBillForDate) return;
    setBillDraftName('');
    setBillDraftAmount('');
    setBillDraftRepeatMonthly(false);
    setBillDraftEnvelopeId('');
  }, [addBillForDate]);

  const handleDeleteTransaction = useCallback(
    (id: string) => {
      setPendingDeleteId(id);
      setEditingTransactionId((eid) => (eid === id ? null : eid));
      delayedToast.successWithUndo(
        'Transaction deleted',
        () => {
          api.deleteTransaction(id);
          setPendingDeleteId(null);
          setSelectedDate(null);
        },
        () => setPendingDeleteId(null),
      );
    },
    [api]
  );

  const handleCalendarKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const day = target.getAttribute('data-day');
      if (day == null) return;
      const dayNum = Number(day);
      if (Number.isNaN(dayNum) || dayNum < 1 || dayNum > daysInMonth) return;
      let nextDay: number | null = null;
      if (e.key === 'ArrowLeft') nextDay = Math.max(1, dayNum - 1);
      else if (e.key === 'ArrowRight') nextDay = Math.min(daysInMonth, dayNum + 1);
      else if (e.key === 'ArrowUp') nextDay = Math.max(1, dayNum - 7);
      else if (e.key === 'ArrowDown') nextDay = Math.min(daysInMonth, dayNum + 7);
      if (nextDay != null) {
        e.preventDefault();
        dayButtonRefsMap.current.get(nextDay)?.focus();
      }
    },
    [daysInMonth]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <h3 className="text-lg text-primary">Calendar</h3>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          placeholder="Search by description, envelope, or source…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Search calendar events"
        />
      </div>

      {/* Nav: month/year (monthly, biweekly) or week (weekly) */}
      <div className="flex items-center justify-between gap-2">
        {budgetPeriodMode === 'weekly' ? (
          <>
            <button type="button" onClick={prevWeek} className="p-2 hover:bg-primary/10 rounded-lg transition-colors shrink-0" aria-label="Previous week">
              <ChevronLeft className="w-5 h-5 text-primary" />
            </button>
            <span className="text-base font-medium text-foreground">
              {weekDates.length >= 7
                ? `Week of ${monthNames[new Date(weekDates[0]).getMonth()]} ${new Date(weekDates[0]).getDate()}–${new Date(weekDates[6]).getDate()}, ${new Date(weekDates[0]).getFullYear()}`
                : 'Week'}
            </span>
            <button type="button" onClick={nextWeek} className="p-2 hover:bg-primary/10 rounded-lg transition-colors shrink-0" aria-label="Next week">
              <ChevronRight className="w-5 h-5 text-primary" />
            </button>
          </>
        ) : (
          <>
        <button type="button" onClick={prevMonth} className="p-2 hover:bg-primary/10 rounded-lg transition-colors shrink-0" aria-label="Previous month">
          <ChevronLeft className="w-5 h-5 text-primary" />
        </button>
        <div className="flex items-center gap-1.5 flex-wrap justify-center min-w-0">
          <Popover open={monthPopoverOpen} onOpenChange={setMonthPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-base font-medium text-foreground px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                aria-label="Choose month"
                aria-haspopup="dialog"
                aria-expanded={monthPopoverOpen}
              >
                {monthNames[currentDate.getMonth()]}
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-56 p-2">
              <div className="grid grid-cols-2 gap-1" role="listbox" aria-label="Choose month">
                {monthNames.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={currentDate.getMonth() === i}
                    onClick={() => goToMonth(i)}
                    className={`px-3 py-2 text-sm rounded-md text-left transition-colors ${currentDate.getMonth() === i ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={yearPopoverOpen} onOpenChange={setYearPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-base font-medium text-foreground px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                aria-label="Choose year"
                aria-haspopup="dialog"
                aria-expanded={yearPopoverOpen}
              >
                {currentDate.getFullYear()}
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-52 p-2 max-h-[16rem] overflow-y-auto">
              <div className="grid grid-cols-3 gap-1" role="listbox" aria-label="Choose year">
                {Array.from({ length: MAX_CALENDAR_YEAR - MIN_CALENDAR_YEAR + 1 }, (_, i) => {
                  const y = MIN_CALENDAR_YEAR + i;
                  return (
                    <button
                      key={y}
                      type="button"
                      role="option"
                      aria-selected={currentDate.getFullYear() === y}
                      onClick={() => goToYear(y)}
                      className={`px-2 py-1.5 text-sm rounded-md tabular-nums transition-colors ${currentDate.getFullYear() === y ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <button type="button" onClick={nextMonth} className="p-2 hover:bg-primary/10 rounded-lg transition-colors shrink-0" aria-label="Next month">
          <ChevronRight className="w-5 h-5 text-primary" />
        </button>
          </>
        )}
      </div>

      {/* Day labels - monthly and weekly; biweekly has its own per period */}
      {(budgetPeriodMode === 'monthly' || budgetPeriodMode === 'weekly') && (
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground font-medium">
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid: monthly, weekly, or biweekly (two periods) based on Envelopes Budget period setting */}
      {budgetPeriodMode === 'weekly' ? (
        /* Weekly: one row of 7 days */
        (() => {
          const headerLabel = weekDates.length >= 7
            ? `Week of ${monthNames[new Date(weekDates[0]).getMonth()]} ${new Date(weekDates[0]).getDate()}–${new Date(weekDates[6]).getDate()}, ${new Date(weekDates[0]).getFullYear()}`
            : 'Week';
          return (
              <div role="grid" aria-label={headerLabel} className="grid grid-cols-7 gap-1 sm:gap-2" onKeyDown={handleCalendarKeyDown}>
                {weekDates.map((dateStr) => {
                  const expense = getTotalExpenseForDate(dateStr);
                  const incomeTotal = getTotalIncomeForDate(dateStr);
                  const net = incomeTotal - expense;
                  const events = getEventsForDate(dateStr);
                  const isSelected = selectedDate === dateStr;
                  const [, , d] = dateStr.split('-');
                  const dayNum = Number(d);
                  const ariaLabel = `${dateStr}, ${expense > 0 ? formatMoney(-expense) + ' expenses' : 'no expenses'}, ${incomeTotal > 0 ? formatMoney(incomeTotal) + ' income' : 'no income'}`;
                  const tooltipParts: string[] = [];
                  if (expense > 0) tooltipParts.push(`Expenses: ${formatMoney(-expense)}`);
                  if (incomeTotal > 0) tooltipParts.push(`Income: ${formatMoney(incomeTotal)}`);
                  if (net !== 0) tooltipParts.push(`Net: ${net > 0 ? '+' : ''}${formatMoney(net)}`);
                  tooltipParts.push(`${events.length} ${events.length === 1 ? 'event' : 'events'}`);
                  return (
                    <Tooltip key={dateStr}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          ref={(el) => { if (el) dayButtonRefsMap.current.set(dayNum, el); }}
                          data-day={dayNum}
                          data-date={dateStr}
                          role="gridcell"
                          aria-label={ariaLabel}
                          aria-selected={isSelected}
                          onClick={() => setSelectedDate(dateStr)}
                          className={`
                            aspect-square p-1.5 sm:p-2 border rounded-lg text-left transition-colors duration-200 overflow-hidden
                            flex flex-col items-start justify-start min-h-0 w-full
                            ${isSelected ? 'border-primary bg-primary/15 ring-2 ring-primary/50' : 'border-border hover:border-primary/50'}
                            ${net === 0 && (events.length > 0 ? 'bg-primary/10 border-primary/30' : 'bg-card')}
                            ${net > 0 ? 'bg-green-500/10 dark:bg-green-500/15 border-green-500/30' : ''}
                            ${net < 0 ? 'bg-red-500/10 dark:bg-red-500/15 border-red-500/30' : ''}
                            ${highContrast ? 'ring-2 ring-foreground/50 border-2' : ''}
                          `}
                        >
                          <span className="text-xs sm:text-sm text-foreground font-medium">{dayNum}</span>
                          {expense > 0 && <span className="text-[10px] sm:text-xs text-primary font-medium mt-0.5 font-mono truncate w-full block">{formatMoney(-expense)}</span>}
                          {incomeTotal > 0 && <span className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 font-medium mt-0.5 font-mono truncate w-full block">+{formatMoney(incomeTotal)}</span>}
                          {net !== 0 && <span className={`text-[10px] sm:text-xs font-medium mt-0.5 font-mono truncate w-full block ${net > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Net {net > 0 ? '+' : ''}{formatMoney(net)}</span>}
                          {events.length > 1 && <span className="text-[10px] text-muted-foreground mt-auto truncate w-full block">{events.length} items</span>}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={4}>{tooltipParts.join('. ')}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
          );
        })()
      ) : budgetPeriodMode === 'monthly' ? (
        <div
          role="grid"
          aria-label={`Calendar for ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          className="grid grid-cols-7 gap-1 sm:gap-2"
          onKeyDown={handleCalendarKeyDown}
        >
          {Array.from({ length: firstDayOfMonth }, (_, i) => (
            <div key={`empty-${i}`} className="aspect-square rounded-lg bg-muted/30" role="gridcell" aria-selected="false" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const expense = getTotalExpenseForDay(day);
            const incomeTotal = getTotalIncomeForDay(day);
            const net = incomeTotal - expense;
            const events = getEventsForDay(day);
            const isSelected = selectedDate === dateStr;
            const hasAny = events.length > 0;
            const expenseLabel = expense > 0 ? formatMoney(-expense) + ' expenses' : 'no expenses';
            const incomeLabel = incomeTotal > 0 ? formatMoney(incomeTotal) + ' income' : 'no income';
            const ariaLabel = `${day} ${monthNames[currentDate.getMonth()]}, ${expenseLabel}, ${incomeLabel}, ${events.length} events`;
            const tooltipParts: string[] = [];
            if (expense > 0) tooltipParts.push(`Expenses: ${formatMoney(-expense)}`);
            if (incomeTotal > 0) tooltipParts.push(`Income: ${formatMoney(incomeTotal)}`);
            if (net !== 0) tooltipParts.push(`Net: ${net > 0 ? '+' : ''}${formatMoney(net)}`);
            tooltipParts.push(`${events.length} ${events.length === 1 ? 'event' : 'events'}`);
            const tooltipText = tooltipParts.join('. ');

            return (
              <Tooltip key={day}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) dayButtonRefsMap.current.set(day, el);
                    }}
                    data-day={day}
                    role="gridcell"
                    aria-label={ariaLabel}
                    aria-selected={isSelected}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`
                      aspect-square p-1.5 sm:p-2 border rounded-lg text-left transition-colors duration-200 overflow-hidden
                      flex flex-col items-start justify-start min-h-0 w-full
                      ${isSelected ? 'border-primary bg-primary/15 ring-2 ring-primary/50' : 'border-border hover:border-primary/50'}
                      ${net === 0 && (hasAny ? 'bg-primary/10 border-primary/30' : 'bg-card')}
                      ${net > 0 ? 'bg-green-500/10 dark:bg-green-500/15 border-green-500/30' : ''}
                      ${net < 0 ? 'bg-red-500/10 dark:bg-red-500/15 border-red-500/30' : ''}
                      ${highContrast ? 'ring-2 ring-foreground/50 border-2' : ''}
                    `}
                  >
                    <span className="text-xs sm:text-sm text-foreground font-medium">{day}</span>
                    {expense > 0 && (
                      <span className="text-[10px] sm:text-xs text-primary font-medium mt-0.5 font-mono truncate w-full block">
                        {formatMoney(-expense)}
                      </span>
                    )}
                    {incomeTotal > 0 && (
                      <span className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 font-medium mt-0.5 font-mono truncate w-full block">
                        +{formatMoney(incomeTotal)}
                      </span>
                    )}
                    {net !== 0 && (
                      <span className={`text-[10px] sm:text-xs font-medium mt-0.5 font-mono truncate w-full block ${net > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        Net {net > 0 ? '+' : ''}{formatMoney(net)}
                      </span>
                    )}
                    {events.length > 1 && (
                      <span className="text-[10px] text-muted-foreground mt-auto truncate w-full block">{events.length} items</span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>{tooltipText}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ) : (
        /* Biweekly: one month split into Period 1 (period1Start–period1End) and Period 2 (period2Start–end) */
        (() => {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const lastDay = getDaysInMonth(currentDate);
          const p1End = Math.min(Math.max(biweeklyPeriod1StartDay, biweeklyPeriod1EndDay), lastDay);
          const p1Start = Math.min(biweeklyPeriod1StartDay, p1End);
          const period1End = p1End;
          const period1Start = p1Start;
          const period2Start = period1End + 1;
          const firstDayPeriod1 = new Date(year, month, period1Start).getDay();
          const firstDayPeriod2 = new Date(year, month, period2Start).getDay();

          const renderDayCell = (day: number) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const expense = getTotalExpenseForDay(day);
            const incomeTotal = getTotalIncomeForDay(day);
            const net = incomeTotal - expense;
            const events = getEventsForDay(day);
            const isSelected = selectedDate === dateStr;
            const hasAny = events.length > 0;
            const expenseLabel = expense > 0 ? formatMoney(-expense) + ' expenses' : 'no expenses';
            const incomeLabel = incomeTotal > 0 ? formatMoney(incomeTotal) + ' income' : 'no income';
            const ariaLabel = `${day} ${monthNames[month]}, ${expenseLabel}, ${incomeLabel}, ${events.length} events`;
            const tooltipParts: string[] = [];
            if (expense > 0) tooltipParts.push(`Expenses: ${formatMoney(-expense)}`);
            if (incomeTotal > 0) tooltipParts.push(`Income: ${formatMoney(incomeTotal)}`);
            if (net !== 0) tooltipParts.push(`Net: ${net > 0 ? '+' : ''}${formatMoney(net)}`);
            tooltipParts.push(`${events.length} ${events.length === 1 ? 'event' : 'events'}`);
            const tooltipText = tooltipParts.join('. ');
            return (
              <Tooltip key={day}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    ref={(el) => { if (el) dayButtonRefsMap.current.set(day, el); }}
                    data-day={day}
                    role="gridcell"
                    aria-label={ariaLabel}
                    aria-selected={isSelected}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`
                      aspect-square p-1.5 sm:p-2 border rounded-lg text-left transition-colors duration-200 overflow-hidden
                      flex flex-col items-start justify-start min-h-0 w-full
                      ${isSelected ? 'border-primary bg-primary/15 ring-2 ring-primary/50' : 'border-border hover:border-primary/50'}
                      ${net === 0 && (hasAny ? 'bg-primary/10 border-primary/30' : 'bg-card')}
                      ${net > 0 ? 'bg-green-500/10 dark:bg-green-500/15 border-green-500/30' : ''}
                      ${net < 0 ? 'bg-red-500/10 dark:bg-red-500/15 border-red-500/30' : ''}
                      ${highContrast ? 'ring-2 ring-foreground/50 border-2' : ''}
                    `}
                  >
                    <span className="text-xs sm:text-sm text-foreground font-medium">{day}</span>
                    {expense > 0 && <span className="text-[10px] sm:text-xs text-primary font-medium mt-0.5 font-mono truncate w-full block">{formatMoney(-expense)}</span>}
                    {incomeTotal > 0 && <span className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 font-medium mt-0.5 font-mono truncate w-full block">+{formatMoney(incomeTotal)}</span>}
                    {net !== 0 && <span className={`text-[10px] sm:text-xs font-medium mt-0.5 font-mono truncate w-full block ${net > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Net {net > 0 ? '+' : ''}{formatMoney(net)}</span>}
                    {events.length > 1 && <span className="text-[10px] text-muted-foreground mt-auto truncate w-full block">{events.length} items</span>}
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>{tooltipText}</TooltipContent>
              </Tooltip>
            );
          };

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" aria-label={`${monthNames[month]} ${year} in two periods`}>
              <section aria-labelledby="period1-heading" className="space-y-1">
                <h4 id="period1-heading" className="text-sm font-semibold text-primary">Period 1 ({period1Start}–{period1End})</h4>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="text-center text-xs text-muted-foreground font-medium">{d}</div>)}
                </div>
                <div role="grid" className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={`Period 1: days ${period1Start} to ${period1End}`} onKeyDown={handleCalendarKeyDown}>
                  {Array.from({ length: firstDayPeriod1 }, (_, i) => <div key={`p1-empty-${i}`} className="aspect-square rounded-lg bg-muted/30" role="gridcell" />)}
                  {Array.from({ length: Math.max(0, period1End - period1Start + 1) }, (_, i) => renderDayCell(period1Start + i))}
                </div>
              </section>
              <section aria-labelledby="period2-heading" className="space-y-1">
                <h4 id="period2-heading" className="text-sm font-semibold text-primary">Period 2 ({period2Start}–{lastDay})</h4>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="text-center text-xs text-muted-foreground font-medium">{d}</div>)}
                </div>
                <div role="grid" className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={`Period 2: days ${period2Start} to ${lastDay}`} onKeyDown={handleCalendarKeyDown}>
                  {Array.from({ length: firstDayPeriod2 }, (_, i) => <div key={`p2-empty-${i}`} className="aspect-square rounded-lg bg-muted/30" role="gridcell" />)}
                  {Array.from({ length: Math.max(0, lastDay - period2Start + 1) }, (_, i) => renderDayCell(period2Start + i))}
                </div>
              </section>
            </div>
          );
        })()
      )}

      {/* Empty state or discoverability hint */}
      {eventsForMonth.length === 0 && !searchLower ? (
        <p className="text-center text-sm text-muted-foreground py-2">
          No activity this month — tap any day to add a transaction, income, or bill.
        </p>
      ) : !selectedDate ? (
        <p className="text-center text-xs text-muted-foreground">
          Tap a day to view or add entries
        </p>
      ) : null}

      {/* Selected day detail: modal when user clicks a day */}
      <Dialog
        open={!!selectedDate}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDate(null);
            setEditingTransactionId(null);
            setEditingBillId(null);
            setAddExpenseForDate(null);
            setAddIncomeForDate(null);
            setAddBillForDate(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          {selectedDate && (
            <AppErrorBoundary
              fallback={
                <div className="space-y-3" role="alert">
                  <p className="text-sm text-foreground">Could not load day details. Close and try another day.</p>
                  <button
                    type="button"
                    onClick={() => { setSelectedDate(null); setEditingTransactionId(null); setEditingBillId(null); setEditingIncomeId(null); setAddExpenseForDate(null); setAddIncomeForDate(null); setAddBillForDate(null); }}
                    className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm"
                  >
                    Close
                  </button>
                </div>
              }
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <DialogTitle className="text-base">
                  {selectedDate} — {visibleSelectedEvents.length} {visibleSelectedEvents.length === 1 ? 'event' : 'events'}
                </DialogTitle>
              </div>
              <div className="space-y-3">
            <ul className="space-y-2">
            {visibleSelectedEvents.map((e) => {
              if (e.type === 'transaction') {
                const tx = state.transactions.find((t) => t.id === e.id) as Transaction | undefined;
                const isEditing = editingTransactionId === e.id;
                return (
                  <li key={e.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                    {isEditing && tx ? (
                      <TransactionEditForm
                        transaction={tx}
                        envelopes={envelopes}
                        onSave={(updates) => {
                          api.updateTransaction(tx.id, updates);
                          setEditingTransactionId(null);
                        }}
                        onCancel={() => setEditingTransactionId(null)}
                        onDelete={() => {
                          setDeleteTransactionEditTargetId(tx.id);
                          setShowDeleteTransactionDialogEdit(true);
                        }}
                      />
                    ) : (
                      <>
                        <span className="flex-1 min-w-0 text-sm">
                          <span className="text-primary font-medium">{e.envelopeName}</span>
                          {e.description && <span className="text-muted-foreground"> — {e.description}</span>}
                        </span>
                        <span className="text-sm font-medium tabular-nums">{e.amount < 0 ? `Refund ${formatMoney(Math.abs(e.amount))}` : formatMoney(-e.amount)}</span>
                        <button type="button" onClick={() => setEditingTransactionId(e.id)} className="p-1 rounded hover:bg-muted" aria-label="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTransactionListTargetId(e.id);
                            setShowDeleteTransactionDialogList(true);
                          }}
                          className="p-1 rounded hover:bg-destructive/20 text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </li>
                );
              }
              if (e.type === 'income') {
                const incomeEntry = state.income.find((i) => i.id === e.id);
                const isEditing = incomeEntry && editingIncomeId === e.id;
                return incomeEntry ? (
                  <li key={e.id} className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    {isEditing ? (
                      <IncomeEditForm
                        income={incomeEntry}
                        onSave={(updates) => {
                          api.updateIncome(incomeEntry.id, updates);
                          setEditingIncomeId(null);
                        }}
                        onCancel={() => setEditingIncomeId(null)}
                        onDelete={() => {
                          handleDeleteIncome(incomeEntry.id);
                          setEditingIncomeId(null);
                        }}
                      />
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-foreground">{e.source}</span>
                        <span className="text-sm font-medium text-green-600 dark:text-green-400 tabular-nums">+{formatMoney(e.amount)}</span>
                        <button type="button" onClick={() => setEditingIncomeId(e.id)} className="p-1 rounded hover:bg-muted" aria-label="Edit income">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteIncomeTargetId(incomeEntry.id);
                            setShowDeleteIncomeDialog(true);
                          }}
                          className="p-1 rounded hover:bg-destructive/20 text-destructive"
                          aria-label="Delete income"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </li>
                ) : null;
              }
              if (e.type === 'bill') {
                const bill = bills.find((b) => b.id === e.billId);
                const isEditing = bill ? editingBillId === bill.id : false;
                return bill ? (
                  <li key={e.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    {isEditing ? (
                      <BillEditForm
                        bill={bill}
                        envelopes={envelopes}
                        onSave={(updates) => { api.updateBill(bill.id, updates); setEditingBillId(null); }}
                        onCancel={() => setEditingBillId(null)}
                        onDelete={() => { handleDeleteBill(bill.id); setEditingBillId(null); }}
                      />
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-foreground">{bill.name}</span>
                        {bill.amount != null && <span className="text-sm tabular-nums">{formatMoney(-bill.amount)}</span>}
                        {!isEditing && bill.amount != null && bill.envelopeId && (
                          <button
                            type="button"
                            onClick={() => {
                              api.addTransaction({
                                amount: bill.amount!,
                                envelopeId: bill.envelopeId,
                                description: bill.name,
                                date: selectedDate!,
                              });
                              delayedToast.success(`${bill.name} marked as paid.`);
                            }}
                            className="text-xs px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10"
                            aria-label={`Mark ${bill.name} as paid`}
                          >
                            Pay
                          </button>
                        )}
                        <button type="button" onClick={() => setEditingBillId(bill.id)} className="p-1 rounded hover:bg-muted" aria-label="Edit bill">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </li>
                ) : null;
              }
              return null;
            })}
          </ul>

          {hasEnvelopes && (
            <>
              {addExpenseForDate === selectedDate ? (
                <QuickAddExpenseForm
                  date={selectedDate}
                  envelopeId={envelopes[0]?.id ?? ''}
                  envelopes={envelopes}
                  onAdd={(amount, envelopeId, description) => {
                    api.addTransaction({ amount, envelopeId, description, date: selectedDate });
                    setAddExpenseForDate(null);
                  }}
                  onCancel={() => setAddExpenseForDate(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddExpenseForDate(selectedDate)}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Plus className="w-4 h-4" /> Add expense for this day
                </button>
              )}
            </>
          )}

          {addIncomeForDate === selectedDate ? (
            <QuickAddIncomeForm
              date={selectedDate}
              onAdd={(amount, source) => {
                api.addIncome({ amount, source, date: selectedDate });
                setAddIncomeForDate(null);
              }}
              onCancel={() => setAddIncomeForDate(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddIncomeForDate(selectedDate)}
              className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 hover:underline"
            >
              <Plus className="w-4 h-4" /> Add income for this day
            </button>
          )}

          {addBillForDate === selectedDate ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = billDraftName.trim();
                if (!name) return;
                const num = billDraftAmount === '' ? undefined : parseFloat(billDraftAmount);
                api.addBill({
                  name,
                  dueDate: selectedDate,
                  amount: Number.isNaN(num as number) ? undefined : num,
                  repeatMonthly: billDraftRepeatMonthly,
                  envelopeId: billDraftEnvelopeId || undefined,
                });
                setAddBillForDate(null);
              }}
              className="flex flex-col gap-2 p-2 rounded-lg border border-border bg-card"
            >
              <input
                type="text"
                value={billDraftName}
                onChange={(e) => setBillDraftName(e.target.value)}
                className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                placeholder="Bill name"
                required
                aria-label="Bill name"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={billDraftAmount}
                onChange={(e) => setBillDraftAmount(e.target.value)}
                className="px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                placeholder="Amount (optional)"
                aria-label="Bill amount optional"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm text-foreground flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={billDraftRepeatMonthly}
                    onChange={(e) => setBillDraftRepeatMonthly(e.target.checked)}
                    className="accent-primary"
                  />
                  Repeat monthly
                </label>
                <select
                  value={billDraftEnvelopeId}
                  onChange={(e) => setBillDraftEnvelopeId(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              <div className="flex gap-2 flex-wrap">
                <button type="submit" className="min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                  Save bill
                </button>
                <button
                  type="button"
                  onClick={() => setAddBillForDate(null)}
                  className="min-h-[44px] px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddBillForDate(selectedDate)}
              className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:underline"
            >
              <Plus className="w-4 h-4" /> Add bill due on this day
            </button>
          )}
              </div>
            </AppErrorBoundary>
          )}
        </DialogContent>
      </Dialog>

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

      <ConfirmDialog
        open={showDeleteIncomeDialog}
        onOpenChange={(open) => {
          setShowDeleteIncomeDialog(open);
          if (!open) setDeleteIncomeTargetId(null);
        }}
        title="Delete income?"
        description="The income entry will be removed."
        confirmLabel="Delete income"
        onConfirm={() => {
          const id = deleteIncomeTargetId;
          if (id) handleDeleteIncome(id);
        }}
      />

      {debouncedSearchQuery.trim() && (
        <p className="text-xs text-muted-foreground">
          Showing {filteredEvents.length} events matching &quot;{debouncedSearchQuery.trim()}&quot;
        </p>
      )}
    </div>
  );
}

export const CalendarContent = memo(CalendarContentInner);
