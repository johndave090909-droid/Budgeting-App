import * as React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  History,
  Target,
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  BarChart2,
  PenLine,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Settings,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useBudget, getPersonIds } from './hooks/useBudget';
import { CATEGORIES, TransactionType, BudgetItem, Bill } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, subDays, startOfMonth, startOfYear, addMonths, subMonths } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type Tab = 'dashboard' | 'income' | 'expenses' | 'budget' | 'transactions' | 'goals';
type IncomePeriod = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

const GROUP_ORDER = ['Paying The Lord', 'Food and Hygiene', 'Savings and Others', 'Recreation'];

// "2026-04-15" → "2026-04"
const monthKey = (date: string) => date.substring(0, 7);

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const {
    transactions,
    goals,
    budgetItems,
    bills,
    personNames,
    updatePersonNames,
    seedMonthBudgetItems,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    addGoal,
    updateGoal,
    deleteGoal,
    updateBudgetItem,
    addBudgetItem,
    deleteBudgetItem,
    addBill,
    deleteBill,
    updateBill,
    toggleBillPaid,
  } = useBudget();

  // ── Person tabs ──────────────────────────────────────────────────
  const personIds = useMemo(() => getPersonIds(personNames.length), [personNames.length]);
  const [activePerson, setActivePerson] = useState<string>('p0');

  // ── Settings drawer ──────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editNames, setEditNames] = useState<string[]>([]);

  const openSettings = () => {
    setEditNames([...personNames]);
    setIsSettingsOpen(true);
  };
  const saveSettings = async () => {
    await updatePersonNames(editNames);
    setIsSettingsOpen(false);
  };

  // ── Active month ─────────────────────────────────────────────────
  const [activeMonth, setActiveMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const isCurrentMonth = activeMonth === format(new Date(), 'yyyy-MM');

  const prevMonth = () => setActiveMonth((m) => format(subMonths(new Date(m + '-02'), 1), 'yyyy-MM'));
  const nextMonth = () => setActiveMonth((m) => format(addMonths(new Date(m + '-02'), 1), 'yyyy-MM'));

  // Seed budget items for all persons when navigating to a new month
  useEffect(() => {
    if (budgetItems.length === 0) return;
    personIds.forEach((pid) => seedMonthBudgetItems(activeMonth, pid));
  }, [activeMonth, budgetItems.length, personIds.length]);

  // ── Monthly ledger computations ──────────────────────────────────
  //
  // startingBalance = all activity from months BEFORE activeMonth
  // endingBalance   = startingBalance + this month's activity
  //
  // "activity" = income − expense − savings − budget actual

  const startingBalance = useMemo(() => {
    const txContrib = transactions.reduce((acc, t) => {
      if (monthKey(t.date) >= activeMonth) return acc;
      if (t.type === 'income')  return acc + t.amount;
      return acc - t.amount; // expense | savings
    }, 0);

    const budgetContrib = budgetItems.reduce((acc, b) => {
      if (!b.month || b.month >= activeMonth) return acc;
      return acc - b.actual;
    }, 0);

    const billContrib = bills.reduce((acc, b) => {
      const pastPaid = Object.entries(b.paidAmounts ?? {})
        .filter(([m]) => m < activeMonth)
        .reduce((s, [, v]) => s + (Number(v) || 0), 0);
      return acc - pastPaid;
    }, 0);

    return txContrib + budgetContrib + billContrib;
  }, [transactions, budgetItems, bills, activeMonth]);

  const monthlyTransactions = useMemo(
    () => transactions.filter((t) => monthKey(t.date) === activeMonth),
    [transactions, activeMonth]
  );

  const [activeSalaryIdx, setActiveSalaryIdx] = useState(0);

  useEffect(() => { setActiveSalaryIdx(0); }, [activePerson, activeMonth]);

  // When switching to a salary tab that has no items yet, seed it from salary 0
  useEffect(() => {
    if (activeSalaryIdx === 0) return;
    const hasItems = budgetItems.some(
      (b) => b.month === activeMonth && (b.person ?? 'p0') === activePerson && (b.salaryIdx ?? 0) === activeSalaryIdx
    );
    if (hasItems) return;
    const salary0Items = budgetItems.filter(
      (b) => b.month === activeMonth && (b.person ?? 'p0') === activePerson && (b.salaryIdx ?? 0) === 0
    );
    salary0Items.forEach((b) => {
      addBudgetItem({ group: b.group, name: b.name, planned: 0, actual: 0, month: activeMonth, person: activePerson, salaryIdx: activeSalaryIdx });
    });
  }, [activeSalaryIdx, activeMonth, activePerson]);

  const monthlyBudgetItems = useMemo(
    () => budgetItems.filter(
      (b) => b.month === activeMonth && (b.person ?? 'p0') === activePerson && (b.salaryIdx ?? 0) === activeSalaryIdx
    ),
    [budgetItems, activeMonth, activePerson, activeSalaryIdx]
  );

  const monthlyTotals = useMemo(
    () =>
      monthlyTransactions.reduce(
        (acc, t) => {
          if (t.type === 'income')  acc.income  += t.amount;
          if (t.type === 'expense') acc.expense += t.amount;
          if (t.type === 'savings') acc.savings += t.amount;
          return acc;
        },
        { income: 0, expense: 0, savings: 0 }
      ),
    [monthlyTransactions]
  );

  // Total actual from ALL persons for this month (for balance computation)
  const monthlyBudgetActual = useMemo(
    () => budgetItems.filter((b) => b.month === activeMonth).reduce((s, b) => s + b.actual, 0),
    [budgetItems, activeMonth]
  );

  // Per-person budget actuals for dashboard breakdown
  const perPersonActual = useMemo(
    () =>
      personIds.map((pid, i) => ({
        name: personNames[i] ?? pid,
        actual: budgetItems
          .filter((b) => b.month === activeMonth && (b.person ?? 'p0') === pid)
          .reduce((s, b) => s + b.actual, 0),
      })),
    [budgetItems, activeMonth, personNames, personIds]
  );

  const monthlyBillPayments = useMemo(
    () => bills.reduce((s, b) => s + (Number(b.paidAmounts?.[activeMonth]) || 0), 0),
    [bills, activeMonth]
  );

  const endingBalance =
    startingBalance +
    monthlyTotals.income -
    monthlyTotals.expense -
    monthlyTotals.savings -
    monthlyBudgetActual -
    monthlyBillPayments;

  // ── Expense (bills) tab state ────────────────────────────────────
  const [isAddBillOpen, setIsAddBillOpen]             = useState(false);
  const [confirmBillDeleteId, setConfirmBillDeleteId] = useState<string | null>(null);
  const [payingBill, setPayingBill] = useState<{ bill: Bill; amount: string } | null>(null);
  const [payingSalaryIdx, setPayingSalaryIdx]         = useState(0);
  const [newBill, setNewBill] = useState({
    name: '',
    amount: '',
    dueDay: '1',
    type: 'fixed' as 'fixed' | 'variable',
    person: 'p0',
  });

  const handleAddBill = async () => {
    if (!newBill.name || !newBill.amount) return;
    await addBill({
      name: newBill.name,
      amount: parseFloat(newBill.amount) || 0,
      dueDay: parseInt(newBill.dueDay) || 1,
      type: newBill.type,
      person: newBill.person,
      paidAmounts: {},
    });
    setNewBill({ name: '', amount: '', dueDay: '1', type: 'fixed', person: 'p0' });
    setIsAddBillOpen(false);
  };

  const handleCheckBill = (bill: Bill) => {
    const isPaid = bill.paidAmounts?.[activeMonth] !== undefined;
    if (isPaid) {
      toggleBillPaid(bill.id, activeMonth);
    } else {
      setPayingSalaryIdx(0);
      setPayingBill({ bill, amount: String(bill.amount) });
    }
  };

  const confirmPayBill = async () => {
    if (!payingBill) return;
    await toggleBillPaid(
      payingBill.bill.id,
      activeMonth,
      parseFloat(payingBill.amount) || 0,
      payingSalaryIdx,
    );
    setPayingBill(null);
  };

  // Sort bills by due day
  const sortedBills = useMemo(
    () => [...bills].sort((a, b) => a.dueDay - b.dueDay),
    [bills]
  );

  const billTotals = useMemo(() => {
    const paid      = bills.reduce((s, b) => s + (Number(b.paidAmounts?.[activeMonth]) || 0), 0);
    const remaining = bills
      .filter((b) => b.paidAmounts?.[activeMonth] === undefined)
      .reduce((s, b) => s + (Number(b.amount) || 0), 0);
    return { paid, remaining };
  }, [bills, activeMonth]);

  // ── Add transaction ──────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [txError, setTxError]     = useState('');
  const [txLoading, setTxLoading] = useState(false);
  const [newTx, setNewTx] = useState({
    type: 'expense' as TransactionType,
    amount: '',
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    person: 'p0',
  });

  const handleAddTransaction = async () => {
    if (!newTx.amount)    { setTxError('Please enter an amount.');     return; }
    if (!newTx.category)  { setTxError('Please select a category.');   return; }
    setTxError('');
    setTxLoading(true);
    try {
      await addTransaction({
        type: newTx.type,
        amount: parseFloat(newTx.amount),
        category: newTx.category,
        description:
          newTx.description ||
          CATEGORIES[newTx.type].find((c) => c.id === newTx.category)?.name ||
          '',
        date: newTx.date,
        person: newTx.person,
      });
      setNewTx({ type: 'expense', amount: '', category: '', description: '', date: format(new Date(), 'yyyy-MM-dd'), person: 'p0' });
      setIsAddOpen(false);
    } catch {
      setTxError('Failed to save. Check your connection.');
    } finally {
      setTxLoading(false);
    }
  };

  // ── Income tab filter ────────────────────────────────────────────
  const [incomePeriod, setIncomePeriod] = useState<IncomePeriod>('monthly');

  const filteredIncome = useMemo(() => {
    const now = new Date();
    if (incomePeriod === 'monthly') {
      return transactions.filter((t) => t.type === 'income' && monthKey(t.date) === activeMonth);
    }
    let start: Date;
    if (incomePeriod === 'weekly')   start = subDays(now, 7);
    else if (incomePeriod === 'biweekly') start = subDays(now, 14);
    else start = startOfYear(now); // yearly
    return transactions.filter((t) => t.type === 'income' && new Date(t.date) >= start);
  }, [transactions, incomePeriod, activeMonth]);

  const filteredIncomeTotal = filteredIncome.reduce((s, t) => s + t.amount, 0);

  // ── Budget editing ───────────────────────────────────────────────
  const [editingItemId, setEditingItemId]   = useState<string | null>(null);
  const [editName, setEditName]             = useState('');
  const [editGroup, setEditGroup]           = useState('');
  const [editPlanned, setEditPlanned]       = useState('');
  const [editActual, setEditActual]         = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEdit = (item: BudgetItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditGroup(item.group);
    setEditPlanned(String(item.planned));
    setEditActual(String(item.actual));
  };

  const saveEdit = async () => {
    if (!editingItemId) return;
    await updateBudgetItem(editingItemId, {
      name: editName.trim() || 'Unnamed',
      group: editGroup,
      planned: parseFloat(editPlanned) || 0,
      actual: parseFloat(editActual) || 0,
    });
    setEditingItemId(null);
  };

  // ── Undo / Redo ──────────────────────────────────────────────────
  type HistoryAction = { undo: () => Promise<void>; redo: () => Promise<void> };
  const undoStack = useRef<HistoryAction[]>([]);
  const redoStack = useRef<HistoryAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = (action: HistoryAction) => {
    undoStack.current = [...undoStack.current, action];
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const handleUndo = useCallback(async () => {
    if (undoStack.current.length === 0) return;
    const action = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [...redoStack.current, action];
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    await action.undo();
  }, []);

  const handleRedo = useCallback(async () => {
    if (redoStack.current.length === 0) return;
    const action = redoStack.current[redoStack.current.length - 1];
    redoStack.current = redoStack.current.slice(0, -1);
    undoStack.current = [...undoStack.current, action];
    setCanRedo(redoStack.current.length > 0);
    setCanUndo(true);
    await action.redo();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // ── Bill editing ─────────────────────────────────────────────────
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editBill, setEditBill] = useState({
    name: '', amount: '', dueDay: '', type: 'fixed' as 'fixed' | 'variable', person: 'p0',
  });

  const startEditBill = (bill: Bill) => {
    setEditingBillId(bill.id);
    setEditBill({
      name: bill.name,
      amount: String(bill.amount),
      dueDay: String(bill.dueDay),
      type: bill.type,
      person: bill.person ?? 'p0',
    });
  };

  const saveEditBill = async () => {
    if (!editingBillId) return;
    await updateBill(editingBillId, {
      name: editBill.name.trim() || 'Unnamed',
      amount: parseFloat(editBill.amount) || 0,
      dueDay: parseInt(editBill.dueDay) || 1,
      type: editBill.type,
      person: editBill.person,
    });
    setEditingBillId(null);
  };

  // ── Add budget item ──────────────────────────────────────────────
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [newBudgetGroup, setNewBudgetGroup]   = useState('');
  const [newBudgetName, setNewBudgetName]     = useState('');

  const handleAddBudgetItem = async () => {
    if (!newBudgetName || !newBudgetGroup) return;
    const fields = { group: newBudgetGroup, name: newBudgetName, planned: 0, actual: 0, month: activeMonth, person: activePerson, salaryIdx: activeSalaryIdx };
    const docRef = await addBudgetItem(fields);
    let currentId = docRef.id;
    pushHistory({
      undo: async () => { await deleteBudgetItem(currentId); },
      redo: async () => { const ref = await addBudgetItem(fields); currentId = ref.id; },
    });
    setNewBudgetName('');
    setNewBudgetGroup('');
    setIsAddBudgetOpen(false);
  };

  // ── Grouped budget for active month ─────────────────────────────
  const budgetGroups = useMemo(() => {
    const groups: Record<string, BudgetItem[]> = {};
    monthlyBudgetItems.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [monthlyBudgetItems]);

  const budgetTotals = useMemo(
    () =>
      monthlyBudgetItems.reduce(
        (acc, i) => ({ planned: acc.planned + i.planned, actual: acc.actual + i.actual }),
        { planned: 0, actual: 0 }
      ),
    [monthlyBudgetItems]
  );

  // Balance if all planned budget amounts were followed exactly
  const allPersonsPlanned = useMemo(
    () => budgetItems.filter((b) => b.month === activeMonth).reduce((s, b) => s + b.planned, 0),
    [budgetItems, activeMonth]
  );
  const allBillsTotal = useMemo(
    () => bills.reduce((s, b) => s + b.amount, 0),
    [bills]
  );

  const balanceIfBudgeted =
    startingBalance + monthlyTotals.income - monthlyTotals.expense - monthlyTotals.savings - allPersonsPlanned - allBillsTotal;

  const chartData = [
    { name: 'Income',   value: monthlyTotals.income,  color: '#10b981' },
    { name: 'Expenses', value: monthlyTotals.expense, color: '#ef4444' },
    { name: 'Savings',  value: monthlyTotals.savings, color: '#f59e0b' },
  ];

  const monthLabel = format(new Date(activeMonth + '-02'), 'MMMM yyyy');

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-3">
        <div className="max-w-md mx-auto space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Wallet className="w-6 h-6 text-zinc-900" />
              Budgetly
            </h1>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Running Balance</p>
                {(() => {
                  const runningBalance = monthlyTotals.income - monthlyBudgetActual;
                  return (
                    <p className={`text-sm font-bold ${runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ${runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  );
                })()}
              </div>
              <button onClick={openSettings} className="p-2 rounded-xl hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-700">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Month navigator */}
          <div className="flex items-center justify-between bg-zinc-100 rounded-xl px-3 py-1.5">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-zinc-200 transition-colors">
              <ChevronLeft className="w-4 h-4 text-zinc-600" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-zinc-900">{monthLabel}</p>
              {!isCurrentMonth && (
                <p className="text-[10px] text-zinc-400">Past month — read-only balance</p>
              )}
            </div>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="p-1 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-6 space-y-6">
        <AnimatePresence mode="wait">

          {/* ── DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

              {/* Monthly balance card */}
              <Card className="border-none shadow-sm bg-zinc-900 text-white">
                <CardContent className="p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400">Starting Balance</p>
                      <p className="text-lg font-bold text-zinc-300">
                        ${startingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400">Ending Balance</p>
                      <p className={`text-lg font-bold ${endingBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${endingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">If budgeted:</p>
                      <p className={`text-sm font-bold ${balanceIfBudgeted >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        ${balanceIfBudgeted.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-zinc-700 pt-3 grid grid-cols-2 gap-y-2 gap-x-4">
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Income</p>
                      <p className="text-sm font-bold text-emerald-400">+${monthlyTotals.income.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Expenses</p>
                      <p className="text-sm font-bold text-red-400">−${monthlyTotals.expense.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Savings</p>
                      <p className="text-sm font-bold text-amber-400">−${monthlyTotals.savings.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Total Budget</p>
                      <p className="text-sm font-bold text-rose-400">−${monthlyBudgetActual.toLocaleString()}</p>
                    </div>
                    {perPersonActual.map((p) => (
                      <div key={p.name}>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{p.name}'s Budget</p>
                        <p className="text-sm font-bold text-rose-300">−${p.actual.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">{monthLabel} Overview</CardTitle>
                </CardHeader>
                <CardContent className="h-48 pt-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                      <Tooltip cursor={{ fill: '#f4f4f5' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent transactions for this month */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{monthLabel} Activity</h2>
                  <Button variant="ghost" size="sm" className="text-xs font-semibold" onClick={() => setActiveTab('transactions')}>
                    View All
                  </Button>
                </div>
                <div className="space-y-3">
                  {monthlyTransactions.slice(0, 4).map((tx) => (
                    <TxRow key={tx.id} tx={tx} onDelete={deleteTransaction} personNames={personNames} />
                  ))}
                  {monthlyTransactions.length === 0 && (
                    <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-zinc-200">
                      <p className="text-sm text-zinc-400">No transactions for {monthLabel}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── INCOME ── */}
          {activeTab === 'income' && (
            <motion.div key="income" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              <h2 className="text-lg font-bold">Income</h2>

              <div className="flex gap-2">
                {(['weekly', 'biweekly', 'monthly', 'yearly'] as IncomePeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setIncomePeriod(p)}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      incomePeriod === p ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200'
                    }`}
                  >
                    {p === 'biweekly' ? 'Bi-wkly' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>

              <Card className="border-none shadow-sm bg-emerald-50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      Total — {incomePeriod === 'monthly' ? monthLabel : incomePeriod}
                    </p>
                    <p className="text-2xl font-bold text-emerald-700">
                      ${filteredIncomeTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-emerald-300" />
                </CardContent>
              </Card>

              <div className="space-y-3">
                {filteredIncome.map((tx) => (
                  <TxRow key={tx.id} tx={tx} onDelete={deleteTransaction} onUpdate={(id, fields) => updateTransaction(id, fields)} personNames={personNames} />
                ))}
                {filteredIncome.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-zinc-200">
                    <TrendingUp className="w-10 h-10 text-zinc-200 mx-auto mb-2" />
                    <p className="text-sm text-zinc-400">No income for this period</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── EXPENSES (bills) ── */}
          {activeTab === 'expenses' && (
            <motion.div key="expenses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Bills &amp; Expenses</h2>
                <Drawer open={isAddBillOpen} onOpenChange={setIsAddBillOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full text-xs">+ Add Bill</Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-w-md mx-auto">
                    <DrawerHeader><DrawerTitle>Add Bill</DrawerTitle></DrawerHeader>
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Bill Name</Label>
                        <Input
                          value={newBill.name}
                          onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
                          placeholder="e.g. Rent, Netflix"
                          className="h-12 rounded-xl bg-zinc-50 border-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Amount</Label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                          <Input
                            type="number"
                            value={newBill.amount}
                            onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                            placeholder="0.00"
                            className="pl-8 h-12 rounded-xl bg-zinc-50 border-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Due Day</Label>
                          <Input
                            type="number"
                            min="1" max="31"
                            value={newBill.dueDay}
                            onChange={(e) => setNewBill({ ...newBill, dueDay: e.target.value })}
                            className="h-12 rounded-xl bg-zinc-50 border-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Type</Label>
                          <select
                            value={newBill.type}
                            onChange={(e) => setNewBill({ ...newBill, type: e.target.value as 'fixed' | 'variable' })}
                            className="w-full h-12 rounded-xl bg-zinc-50 border-none px-4 text-sm font-medium text-zinc-900 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-200"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="variable">Variable</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Who</Label>
                        <select
                          value={newBill.person}
                          onChange={(e) => setNewBill({ ...newBill, person: e.target.value })}
                          className="w-full h-12 rounded-xl bg-zinc-50 border-none px-4 text-sm font-medium text-zinc-900 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-200"
                        >
                          {personNames.map((name, i) => (
                            <option key={`p${i}`} value={`p${i}`}>{name}</option>
                          ))}
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <Button
                        className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-bold"
                        onClick={handleAddBill}
                      >
                        Add Bill
                      </Button>
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Paid</p>
                  <p className="text-sm font-bold text-emerald-700">${billTotals.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-rose-50 rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Remaining</p>
                  <p className="text-sm font-bold text-rose-600">${billTotals.remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Bill list */}
              <div className="space-y-2">
                {sortedBills.map((bill) => {
                  const isPaid    = bill.paidAmounts?.[activeMonth] !== undefined;
                  const paidAmt   = Number(bill.paidAmounts?.[activeMonth]) || 0;
                  const personLabel = bill.person === 'both'
                    ? 'Both'
                    : bill.person
                      ? personNames[parseInt(bill.person.replace('p', ''))] ?? bill.person
                      : null;
                  const dueDateStr = (() => {
                    try {
                      const d = new Date(`${activeMonth}-${String(bill.dueDay).padStart(2, '0')}T12:00:00`);
                      return format(d, 'MMM dd');
                    } catch { return `Day ${bill.dueDay}`; }
                  })();

                  return (
                    <div key={bill.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-opacity ${isPaid && editingBillId !== bill.id ? 'opacity-60' : ''}`}>
                      {editingBillId === bill.id ? (
                        /* ── Edit mode ── */
                        <div className="p-4 space-y-3">
                          <input
                            type="text"
                            value={editBill.name}
                            onChange={(e) => setEditBill({ ...editBill, name: e.target.value })}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => e.key === 'Enter' && saveEditBill()}
                            className="w-full text-sm font-bold bg-zinc-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200"
                            placeholder="Bill name"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Amount</p>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold">$</span>
                                <input
                                  type="number"
                                  value={editBill.amount}
                                  onChange={(e) => setEditBill({ ...editBill, amount: e.target.value })}
                                  onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) => e.key === 'Enter' && saveEditBill()}
                                  className="w-full pl-7 text-sm font-bold bg-zinc-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Due Day</p>
                              <input
                                type="number"
                                min="1" max="31"
                                value={editBill.dueDay}
                                onChange={(e) => setEditBill({ ...editBill, dueDay: e.target.value })}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => e.key === 'Enter' && saveEditBill()}
                                className="w-full text-sm font-bold bg-zinc-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200"
                              />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Type</p>
                              <select
                                value={editBill.type}
                                onChange={(e) => setEditBill({ ...editBill, type: e.target.value as 'fixed' | 'variable' })}
                                className="w-full text-sm font-medium bg-zinc-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200 appearance-none"
                              >
                                <option value="fixed">Fixed</option>
                                <option value="variable">Variable</option>
                              </select>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Who</p>
                              <select
                                value={editBill.person}
                                onChange={(e) => setEditBill({ ...editBill, person: e.target.value })}
                                className="w-full text-sm font-medium bg-zinc-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200 appearance-none"
                              >
                                {personNames.map((name, i) => (
                                  <option key={`p${i}`} value={`p${i}`}>{name}</option>
                                ))}
                                <option value="both">Both</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={saveEditBill}
                              className="flex-1 h-9 rounded-xl bg-zinc-900 text-white text-xs font-bold flex items-center justify-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Save
                            </button>
                            <button
                              onClick={() => setEditingBillId(null)}
                              className="flex-1 h-9 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-bold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── Display mode ── */
                        <div className="flex items-center gap-3 px-4 py-3">
                          {/* Checkbox */}
                          <button
                            onClick={() => handleCheckBill(bill)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isPaid
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-zinc-300 hover:border-emerald-400'
                            }`}
                          >
                            {isPaid && <Check className="w-3 h-3" />}
                          </button>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-bold truncate ${isPaid ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                                {bill.name}
                              </p>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                bill.type === 'fixed' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                              }`}>
                                {bill.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[10px] text-zinc-400">Due {dueDateStr}</p>
                              {personLabel && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-zinc-300 inline-block" />
                                  <span className="text-[10px] text-zinc-400 font-medium">{personLabel}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right">
                            {isPaid ? (
                              <>
                                <p className="text-sm font-bold text-emerald-600">${paidAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                {bill.paidSalary?.[activeMonth] !== undefined && (() => {
                                  const allIncome = monthlyTransactions.filter((t) => t.type === 'income');
                                  const idx = bill.paidSalary[activeMonth];
                                  const tx = allIncome[idx];
                                  if (!tx) return null;
                                  const pid = tx.person && tx.person !== 'both' ? tx.person : 'p0';
                                  const name = personNames[parseInt(pid.replace('p', ''))] ?? pid;
                                  const perPersonIdx = allIncome.slice(0, idx + 1).filter((t) => (t.person && t.person !== 'both' ? t.person : 'p0') === pid).length;
                                  return <p className="text-[10px] text-emerald-500 font-medium">{name} · Salary {perPersonIdx}</p>;
                                })()}
                              </>
                            ) : (
                              <p className="text-sm font-bold text-zinc-900">${bill.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                            )}
                          </div>

                          {/* Edit + Delete */}
                          <button
                            onClick={() => startEditBill(bill)}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-400 flex-shrink-0"
                          >
                            <PenLine className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setConfirmBillDeleteId(bill.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-zinc-300 hover:text-red-400 flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {sortedBills.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-zinc-200">
                    <TrendingDown className="w-10 h-10 text-zinc-200 mx-auto mb-2" />
                    <p className="text-sm text-zinc-400">No bills added yet</p>
                    <p className="text-xs text-zinc-300">Tap "+ Add Bill" to get started</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── BUDGET ── */}
          {activeTab === 'budget' && (
            <motion.div key="budget" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">Budget Plan</h2>
                    <button onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" className={`p-1.5 rounded-lg transition-colors ${canUndo ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-200 cursor-not-allowed'}`}>
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" className={`p-1.5 rounded-lg transition-colors ${canRedo ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-200 cursor-not-allowed'}`}>
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Person tabs — dynamic */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {personIds.map((pid, i) => (
                      <button
                        key={pid}
                        onClick={() => setActivePerson(pid)}
                        className={`px-3 py-0.5 rounded-full text-xs font-bold transition-colors ${
                          activePerson === pid
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                      >
                        {personNames[i] ?? pid}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{monthLabel}</p>
                </div>
                <Drawer open={isAddBudgetOpen} onOpenChange={setIsAddBudgetOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full text-xs">+ Add Item</Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-w-md mx-auto">
                    <DrawerHeader><DrawerTitle>Add Budget Item</DrawerTitle></DrawerHeader>
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Group</Label>
                        <select
                          value={newBudgetGroup}
                          onChange={(e) => setNewBudgetGroup(e.target.value)}
                          className="w-full h-12 rounded-xl bg-zinc-50 border-none px-4 text-sm font-medium text-zinc-900 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-200"
                        >
                          <option value="">Select group</option>
                          {GROUP_ORDER.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Item Name</Label>
                        <Input value={newBudgetName} onChange={(e) => setNewBudgetName(e.target.value)} placeholder="e.g. Groceries" className="h-12 rounded-xl bg-zinc-50 border-none" />
                      </div>
                      <Button className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-bold" onClick={handleAddBudgetItem}>
                        Add Item
                      </Button>
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>

              {/* Column headers */}
              <div className="flex items-center px-4 gap-2">
                <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Item</span>
                <span className="w-20 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-400">Budget</span>
                <span className="w-20 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-400">Actual</span>
                <span className="w-8" />
              </div>

              {/* Starting balance info */}
              <div className="flex items-center justify-between bg-zinc-100 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Carried from previous month</span>
                <span className={`text-sm font-bold ${startingBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ${startingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Salary tabs + remaining balance */}
              {(() => {
                const salaries = monthlyTransactions.filter(
                  (t) => t.type === 'income' && (t.person === activePerson || t.person === 'both')
                );
                const currentSalaryAmount = salaries[activeSalaryIdx]?.amount ?? 0;
                const salaryBillPayments = bills
                  .filter((b) => b.paidSalary?.[activeMonth] === activeSalaryIdx)
                  .reduce((s, b) => s + (Number(b.paidAmounts?.[activeMonth]) || 0), 0);
                const remaining = currentSalaryAmount - budgetTotals.actual - salaryBillPayments;
                return (
                  <>
                    {salaries.length > 0 && (
                      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
                        {salaries.map((t, i) => (
                          <button
                            key={t.id}
                            onClick={() => setActiveSalaryIdx(i)}
                            className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors ${
                              activeSalaryIdx === i
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-600'
                            }`}
                          >
                            Salary {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Remaining Balance</p>
                        {salaries.length > 0 && (
                          <p className="text-xs text-emerald-500 mt-0.5">
                            ${currentSalaryAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} salary
                          </p>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {salaries.length > 1 && (() => {
                      const totalIncome = salaries.reduce((s, t) => s + t.amount, 0);
                      const totalActual = budgetItems
                        .filter((b) => b.month === activeMonth && (b.person ?? 'p0') === activePerson)
                        .reduce((s, b) => s + b.actual, 0);
                      const totalBillPayments = bills
                        .filter((b) => b.paidSalary?.[activeMonth] !== undefined)
                        .reduce((s, b) => s + (Number(b.paidAmounts?.[activeMonth]) || 0), 0);
                      const totalRemaining = totalIncome - totalActual - totalBillPayments;
                      return (
                        <div className="flex items-center justify-between bg-emerald-100 rounded-xl px-4 py-2.5">
                          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Remaining (All Salaries)</p>
                          <span className={`text-sm font-bold ${totalRemaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            ${totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}

              {Object.keys(budgetGroups).map((group) => (
                <div key={group} className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-1">{group}</p>
                  <div className="space-y-1">
                    {budgetGroups[group].map((item) => (
                      <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                        {editingItemId === item.id ? (
                          <div className="p-3 space-y-2">
                            {/* Name + group row */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                className="flex-1 text-sm font-bold bg-zinc-50 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-zinc-200"
                                placeholder="Item name"
                              />
                              <select
                                value={editGroup}
                                onChange={(e) => setEditGroup(e.target.value)}
                                className="w-32 text-xs font-medium bg-zinc-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-zinc-200 appearance-none"
                              >
                                {GROUP_ORDER.map((g) => <option key={g} value={g}>{g}</option>)}
                              </select>
                            </div>
                            {/* Planned + actual + actions row */}
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editPlanned}
                                onChange={(e) => setEditPlanned(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                className="flex-1 w-0 text-right text-sm font-bold bg-emerald-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                                placeholder="Budget"
                              />
                              <input
                                type="number"
                                value={editActual}
                                onChange={(e) => setEditActual(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                className="flex-1 w-0 text-right text-sm font-bold bg-rose-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-rose-200"
                                placeholder="Actual"
                              />
                              <button onClick={saveEdit} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditingItemId(null)} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-3">
                            <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                            <span className="w-20 text-right text-sm font-bold text-zinc-400">${item.planned.toLocaleString()}</span>
                            <span className={`w-20 text-right text-sm font-bold ${item.actual > item.planned && item.planned > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              ${item.actual.toLocaleString()}
                            </span>
                            <div className="flex gap-1">
                              <button onClick={() => startEdit(item)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-400"><PenLine className="w-3 h-3" /></button>
                              <button onClick={() => setConfirmDeleteId(item.id)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-zinc-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Totals row */}
              <div className="flex items-center gap-2 bg-zinc-900 rounded-xl px-4 py-3 text-white">
                <span className="flex-1 text-sm font-bold uppercase tracking-wider">Total Spending</span>
                <span className="w-20 text-right text-sm font-bold text-emerald-400">${budgetTotals.planned.toLocaleString()}</span>
                <span className={`w-20 text-right text-sm font-bold ${budgetTotals.actual > budgetTotals.planned ? 'text-red-400' : 'text-emerald-400'}`}>
                  ${budgetTotals.actual.toLocaleString()}
                </span>
                <span className="w-8" />
              </div>

              {/* Ending balance */}
              <div className="flex items-center justify-between bg-zinc-900 rounded-xl px-4 py-3 text-white">
                <span className="text-sm font-bold uppercase tracking-wider">Ending Balance</span>
                <span className={`text-sm font-bold ${endingBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${endingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex gap-4 px-1">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /><span className="text-[10px] text-zinc-400">Budget (planned)</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /><span className="text-[10px] text-zinc-400">Over budget</span></div>
              </div>
            </motion.div>
          )}

          {/* ── TRANSACTIONS ── */}
          {activeTab === 'transactions' && (
            <motion.div key="transactions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <h2 className="text-lg font-bold">{monthLabel} Transactions</h2>
              <div className="space-y-3">
                {monthlyTransactions.map((tx) => (
                  <TxRow key={tx.id} tx={tx} onDelete={deleteTransaction} showDelete personNames={personNames} />
                ))}
                {monthlyTransactions.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-zinc-200">
                    <p className="text-sm text-zinc-400">No transactions for {monthLabel}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── GOALS ── */}
          {activeTab === 'goals' && (
            <motion.div key="goals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Financial Goals</h2>
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full text-xs">New Goal</Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-w-md mx-auto">
                    <DrawerHeader><DrawerTitle>Set a New Goal</DrawerTitle></DrawerHeader>
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Goal Name</Label>
                        <Input id="goal-name" placeholder="e.g. New Car, Emergency Fund" className="h-12 rounded-xl bg-zinc-50 border-none" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Target Amount</Label>
                        <Input id="goal-amount" type="number" placeholder="0.00" className="h-12 rounded-xl bg-zinc-50 border-none" />
                      </div>
                      <Button className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-bold"
                        onClick={() => {
                          const name = (document.getElementById('goal-name') as HTMLInputElement).value;
                          const amount = (document.getElementById('goal-amount') as HTMLInputElement).value;
                          if (name && amount) addGoal({ name, targetAmount: parseFloat(amount), currentAmount: 0, category: 'savings' });
                        }}>
                        Create Goal
                      </Button>
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
              <div className="space-y-4">
                {goals.map((goal) => (
                  <Card key={goal.id} className="border-none shadow-sm">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><Target className="w-5 h-5" /></div>
                          <div>
                            <p className="text-sm font-bold">{goal.name}</p>
                            <p className="text-[10px] text-zinc-500">Target: ${goal.targetAmount.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">${goal.currentAmount.toLocaleString()}</p>
                          <p className="text-[10px] text-zinc-500">{Math.round((goal.currentAmount / goal.targetAmount) * 100)}%</p>
                        </div>
                      </div>
                      <Progress value={(goal.currentAmount / goal.targetAmount) * 100} className="h-2" />
                      <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1 h-10 text-xs font-bold rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900"
                          onClick={() => { const amt = prompt('How much did you save?'); if (amt) updateGoal(goal.id, parseFloat(amt)); }}>
                          Add Savings
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-zinc-300 hover:text-red-500 hover:bg-red-50" onClick={() => deleteGoal(goal.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {goals.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-zinc-200">
                    <Target className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                    <p className="text-sm text-zinc-400">Set your first financial goal</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl text-red-600"><Trash2 className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-bold text-zinc-900">Delete item?</p>
                <p className="text-xs text-zinc-500">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 h-11 rounded-2xl bg-zinc-100 text-zinc-700 text-sm font-bold hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const item = budgetItems.find((b) => b.id === confirmDeleteId);
                  if (item) {
                    const { id: _id, ...fields } = item;
                    let currentId = confirmDeleteId;
                    await deleteBudgetItem(currentId);
                    pushHistory({
                      undo: async () => { const ref = await addBudgetItem(fields); currentId = ref.id; },
                      redo: async () => { await deleteBudgetItem(currentId); },
                    });
                  } else {
                    await deleteBudgetItem(confirmDeleteId);
                  }
                  setConfirmDeleteId(null);
                }}
                className="flex-1 h-11 rounded-2xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Delete Confirmation Modal */}
      {confirmBillDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmBillDeleteId(null)} />
          <div className="relative bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl text-red-600"><Trash2 className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-bold text-zinc-900">Delete bill?</p>
                <p className="text-xs text-zinc-500">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmBillDeleteId(null)}
                className="flex-1 h-11 rounded-2xl bg-zinc-100 text-zinc-700 text-sm font-bold hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => { await deleteBill(confirmBillDeleteId); setConfirmBillDeleteId(null); }}
                className="flex-1 h-11 rounded-2xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Bill Modal */}
      {payingBill && (() => {
        // Build a flat list of all salaries grouped by person, with per-person index
        const allSalaries = monthlyTransactions
          .filter((t) => t.type === 'income')
          .map((t) => {
            const pid = t.person && t.person !== 'both' ? t.person : 'p0';
            const name = personNames[parseInt(pid.replace('p', ''))] ?? pid;
            return { tx: t, personName: name, pid };
          });
        // Count how many salaries each person has seen so far to get per-person index
        const personCount: Record<string, number> = {};
        const salaryEntries = allSalaries.map((s, i) => {
          personCount[s.pid] = (personCount[s.pid] ?? 0) + 1;
          return { ...s, globalIdx: i, perPersonIdx: personCount[s.pid] };
        });

        // Group by person for display
        const grouped: Record<string, typeof salaryEntries> = {};
        salaryEntries.forEach((s) => {
          if (!grouped[s.pid]) grouped[s.pid] = [];
          grouped[s.pid].push(s);
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-black/40" onClick={() => setPayingBill(null)} />
            <div className="relative bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm space-y-4">
              <div>
                <p className="text-sm font-bold text-zinc-900">Mark as Paid — {payingBill.bill.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Choose which salary covers this bill.</p>
              </div>

              {/* Amount (editable for variable, locked for fixed) */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                <input
                  type="number"
                  value={payingBill.amount}
                  onChange={(e) => setPayingBill({ ...payingBill, amount: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  readOnly={payingBill.bill.type === 'fixed'}
                  className={`w-full pl-8 h-12 rounded-xl border text-lg font-bold focus:outline-none focus:ring-2 focus:ring-zinc-300 ${
                    payingBill.bill.type === 'fixed' ? 'bg-zinc-100 border-zinc-100 text-zinc-500' : 'bg-zinc-50 border-zinc-200'
                  }`}
                  autoFocus={payingBill.bill.type === 'variable'}
                />
              </div>

              {/* Salary selector grouped by person */}
              {salaryEntries.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Deduct from</p>
                  {Object.entries(grouped).map(([pid, entries]) => (
                    <div key={pid} className="space-y-1.5">
                      <p className="text-xs font-bold text-zinc-500">{entries[0].personName}</p>
                      <div className="flex gap-2">
                        {entries.map((s) => (
                          <button
                            key={s.tx.id}
                            onClick={() => setPayingSalaryIdx(s.globalIdx)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                              payingSalaryIdx === s.globalIdx
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'
                            }`}
                          >
                            Salary {s.perPersonIdx}
                            <span className="block text-xs font-medium mt-0.5">
                              ${s.tx.amount.toLocaleString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setPayingBill(null)} className="flex-1 h-11 rounded-2xl bg-zinc-100 text-zinc-700 text-sm font-bold">
                  Cancel
                </button>
                <button onClick={confirmPayBill} className="flex-1 h-11 rounded-2xl bg-zinc-900 text-white text-sm font-bold">
                  Mark Paid
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Settings Drawer */}
      <Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DrawerContent className="max-w-md mx-auto">
          <DrawerHeader><DrawerTitle>Settings</DrawerTitle></DrawerHeader>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Budget Tab Names</p>
              <div className="space-y-3">
                {editNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={name}
                      onChange={(e) => {
                        const next = [...editNames];
                        next[i] = e.target.value;
                        setEditNames(next);
                      }}
                      className="h-12 rounded-xl bg-zinc-50 border-none flex-1"
                      placeholder={`Person ${i + 1}`}
                    />
                    {editNames.length > 1 && (
                      <button
                        onClick={() => setEditNames(editNames.filter((_, j) => j !== i))}
                        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-50 text-zinc-300 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setEditNames([...editNames, ''])}
                className="mt-3 w-full h-10 rounded-xl border-2 border-dashed border-zinc-200 text-xs font-bold text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors"
              >
                + Add Person
              </button>
            </div>
            <Button className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-bold" onClick={saveSettings}>
              Save Changes
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* FAB */}
      <Drawer open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DrawerTrigger asChild>
          <Button className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-xl shadow-zinc-200 bg-zinc-900 hover:bg-zinc-800 text-white z-20" size="icon">
            <Plus className="w-6 h-6" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-w-md mx-auto">
          <DrawerHeader><DrawerTitle>Add Transaction</DrawerTitle></DrawerHeader>
          <div className="p-6 space-y-6">
            <Tabs value={newTx.type} onValueChange={(v) => setNewTx({ ...newTx, type: v as TransactionType, category: '' })}>
              <TabsList className="grid grid-cols-3 w-full bg-zinc-100 p-1 rounded-xl">
                <TabsTrigger value="expense" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-rose-600">Expense</TabsTrigger>
                <TabsTrigger value="income"  className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600">Income</TabsTrigger>
                <TabsTrigger value="savings" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-amber-600">Savings</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Amount</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                  <Input type="number" placeholder="0.00" className="pl-8 h-12 rounded-xl bg-zinc-50 border-none text-lg font-bold"
                    value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Category</Label>
                <select value={newTx.category} onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                  className="w-full h-12 rounded-xl bg-zinc-50 border-none px-4 text-sm font-medium text-zinc-900 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-200">
                  <option value="">Select category</option>
                  {CATEGORIES[newTx.type].map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Description (Optional)</Label>
                <Input placeholder="What was this for?" className="h-12 rounded-xl bg-zinc-50 border-none"
                  value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Date</Label>
                <Input type="date" className="h-12 rounded-xl bg-zinc-50 border-none"
                  value={newTx.date} onChange={(e) => setNewTx({ ...newTx, date: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Who</Label>
                <select
                  value={newTx.person}
                  onChange={(e) => setNewTx({ ...newTx, person: e.target.value })}
                  className="w-full h-12 rounded-xl bg-zinc-50 border-none px-4 text-sm font-medium text-zinc-900 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-200"
                >
                  {personNames.map((name, i) => (
                    <option key={`p${i}`} value={`p${i}`}>{name}</option>
                  ))}
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            {txError && <p className="text-xs text-red-500 font-medium text-center">{txError}</p>}
            <Button className="w-full h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-lg disabled:opacity-50"
              onClick={handleAddTransaction} disabled={txLoading}>
              {txLoading ? 'Saving...' : `Add ${newTx.type}`}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-zinc-200 px-6 py-3 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <NavButton active={activeTab === 'dashboard'}    onClick={() => setActiveTab('dashboard')}    icon={<LayoutDashboard className="w-5 h-5" />} label="Home" />
          <NavButton active={activeTab === 'income'}       onClick={() => setActiveTab('income')}       icon={<TrendingUp className="w-5 h-5" />}      label="Income" />
          <NavButton active={activeTab === 'expenses'}     onClick={() => setActiveTab('expenses')}     icon={<TrendingDown className="w-5 h-5" />}    label="Bills" />
          <NavButton active={activeTab === 'budget'}       onClick={() => setActiveTab('budget')}       icon={<BarChart2 className="w-5 h-5" />}       label="Budget" />
          <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History className="w-5 h-5" />}         label="History" />
        </div>
      </nav>
    </div>
  );
}

function TxRow({
  tx,
  onDelete,
  onUpdate,
  showDelete = true,
  personNames = [],
}: {
  tx: { id: string; type: string; description: string; date: string; amount: number; person?: string };
  onDelete: (id: string) => void;
  onUpdate?: (id: string, fields: { description: string; amount: number; date: string; person?: string }) => void;
  showDelete?: boolean;
  personNames?: string[];
}) {
  const [editing, setEditing] = React.useState(false);
  const [editDesc, setEditDesc] = React.useState('');
  const [editAmount, setEditAmount] = React.useState('');
  const [editDate, setEditDate] = React.useState('');
  const [editPerson, setEditPerson] = React.useState('');

  const startEdit = () => {
    setEditDesc(tx.description);
    setEditAmount(String(tx.amount));
    setEditDate(tx.date);
    setEditPerson(tx.person ?? '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!onUpdate) return;
    await onUpdate(tx.id, {
      description: editDesc.trim() || tx.description,
      amount: parseFloat(editAmount) || tx.amount,
      date: editDate,
      person: editPerson || undefined,
    });
    setEditing(false);
  };

  const personLabel = tx.person
    ? tx.person === 'both'
      ? 'Both'
      : personNames[parseInt(tx.person.replace('p', ''))] ?? tx.person
    : null;

  if (editing) {
    return (
      <div className="p-4 bg-white rounded-2xl shadow-sm space-y-3">
        <input
          type="text"
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
          className="w-full text-sm font-bold bg-zinc-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200"
          placeholder="Description"
          autoFocus
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
            className="flex-1 text-sm font-bold bg-emerald-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Amount"
          />
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="flex-1 text-sm bg-zinc-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </div>
        {personNames.length > 0 && (
          <select
            value={editPerson}
            onChange={(e) => setEditPerson(e.target.value)}
            className="w-full text-sm bg-zinc-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-200 appearance-none"
          >
            {personNames.map((name, i) => (
              <option key={i} value={`p${i}`}>{name}</option>
            ))}
            <option value="both">Both</option>
          </select>
        )}
        <div className="flex gap-2">
          <button onClick={saveEdit} className="flex-1 h-9 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1">
            <Check className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={() => setEditing(false)} className="flex-1 h-9 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-bold flex items-center justify-center gap-1">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : tx.type === 'expense' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
          {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : tx.type === 'expense' ? <ArrowDownRight className="w-5 h-5" /> : <PiggyBank className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-sm font-bold">{tx.description}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] text-zinc-500 font-medium">{format(new Date(tx.date + 'T12:00:00'), 'MMM dd, yyyy')}</p>
            {personLabel && (
              <>
                <span className="w-1 h-1 rounded-full bg-zinc-300 inline-block" />
                <span className="text-[10px] font-bold text-zinc-400">{personLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className={`text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-rose-600' : 'text-amber-600'}`}>
          {tx.type === 'expense' ? '−' : '+'}${tx.amount.toLocaleString()}
        </p>
        {onUpdate && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-zinc-600" onClick={startEdit}>
            <PenLine className="w-4 h-4" />
          </Button>
        )}
        {showDelete && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-red-500" onClick={() => onDelete(tx.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-zinc-900' : 'text-zinc-400'}`}>
      <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-zinc-100' : ''}`}>{icon}</div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
