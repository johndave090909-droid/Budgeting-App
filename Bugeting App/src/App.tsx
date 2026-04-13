import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { useBudget, PERSON_IDS } from './hooks/useBudget';
import { CATEGORIES, TransactionType, BudgetItem } from './types';
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

type Tab = 'dashboard' | 'income' | 'budget' | 'transactions' | 'goals';
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
    personNames,
    updatePersonNames,
    seedMonthBudgetItems,
    addTransaction,
    deleteTransaction,
    addGoal,
    updateGoal,
    deleteGoal,
    updateBudgetItem,
    addBudgetItem,
    deleteBudgetItem,
  } = useBudget();

  // ── Person tabs ──────────────────────────────────────────────────
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
    PERSON_IDS.forEach((pid) => seedMonthBudgetItems(activeMonth, pid));
  }, [activeMonth, budgetItems.length]);

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

    return txContrib + budgetContrib;
  }, [transactions, budgetItems, activeMonth]);

  const monthlyTransactions = useMemo(
    () => transactions.filter((t) => monthKey(t.date) === activeMonth),
    [transactions, activeMonth]
  );

  const monthlyBudgetItems = useMemo(
    () => budgetItems.filter((b) => b.month === activeMonth && (b.person ?? 'p0') === activePerson),
    [budgetItems, activeMonth, activePerson]
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
      PERSON_IDS.map((pid, i) => ({
        name: personNames[i] ?? pid,
        actual: budgetItems
          .filter((b) => b.month === activeMonth && (b.person ?? 'p0') === pid)
          .reduce((s, b) => s + b.actual, 0),
      })),
    [budgetItems, activeMonth, personNames]
  );

  const endingBalance =
    startingBalance +
    monthlyTotals.income -
    monthlyTotals.expense -
    monthlyTotals.savings -
    monthlyBudgetActual;

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
      });
      setNewTx({ type: 'expense', amount: '', category: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPlanned, setEditPlanned]     = useState('');
  const [editActual, setEditActual]       = useState('');

  const startEdit = (item: BudgetItem) => {
    setEditingItemId(item.id);
    setEditPlanned(String(item.planned));
    setEditActual(String(item.actual));
  };

  const saveEdit = async () => {
    if (!editingItemId) return;
    await updateBudgetItem(editingItemId, parseFloat(editPlanned) || 0, parseFloat(editActual) || 0);
    setEditingItemId(null);
  };

  // ── Add budget item ──────────────────────────────────────────────
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [newBudgetGroup, setNewBudgetGroup]   = useState('');
  const [newBudgetName, setNewBudgetName]     = useState('');

  const handleAddBudgetItem = async () => {
    if (!newBudgetName || !newBudgetGroup) return;
    await addBudgetItem({ group: newBudgetGroup, name: newBudgetName, planned: 0, actual: 0, month: activeMonth, person: activePerson });
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
                <p className={`text-sm font-bold ${endingBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ${endingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
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
                    <TxRow key={tx.id} tx={tx} onDelete={deleteTransaction} />
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
                  <TxRow key={tx.id} tx={tx} onDelete={deleteTransaction} />
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

          {/* ── BUDGET ── */}
          {activeTab === 'budget' && (
            <motion.div key="budget" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Budget Plan</h2>
                  {/* Person tabs */}
                  <div className="flex gap-1 mt-1">
                    {PERSON_IDS.map((pid, i) => (
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

              {Object.keys(budgetGroups).map((group) => (
                <div key={group} className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-1">{group}</p>
                  <div className="space-y-1">
                    {budgetGroups[group].map((item) => (
                      <div key={item.id} className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 shadow-sm">
                        {editingItemId === item.id ? (
                          <>
                            <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                            <input type="number" value={editPlanned} onChange={(e) => setEditPlanned(e.target.value)}
                              className="w-20 text-right text-sm font-bold bg-emerald-50 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="0" />
                            <input type="number" value={editActual} onChange={(e) => setEditActual(e.target.value)}
                              className="w-20 text-right text-sm font-bold bg-rose-50 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-rose-200" placeholder="0" />
                            <div className="flex gap-1">
                              <button onClick={saveEdit} className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check className="w-3 h-3" /></button>
                              <button onClick={() => setEditingItemId(null)} className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><X className="w-3 h-3" /></button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                            <span className="w-20 text-right text-sm font-bold text-zinc-400">${item.planned.toLocaleString()}</span>
                            <span className={`w-20 text-right text-sm font-bold ${item.actual > item.planned && item.planned > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              ${item.actual.toLocaleString()}
                            </span>
                            <div className="flex gap-1">
                              <button onClick={() => startEdit(item)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-400"><PenLine className="w-3 h-3" /></button>
                              <button onClick={() => deleteBudgetItem(item.id)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-zinc-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </>
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
                  <TxRow key={tx.id} tx={tx} onDelete={deleteTransaction} showDelete />
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

      {/* Settings Drawer */}
      <Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DrawerContent className="max-w-md mx-auto">
          <DrawerHeader><DrawerTitle>Settings</DrawerTitle></DrawerHeader>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Budget Tab Names</p>
              <div className="space-y-3">
                {PERSON_IDS.map((pid, i) => (
                  <div key={pid} className="space-y-1">
                    <Label className="text-xs text-zinc-400">Tab {i + 1}</Label>
                    <Input
                      value={editNames[i] ?? ''}
                      onChange={(e) => {
                        const next = [...editNames];
                        next[i] = e.target.value;
                        setEditNames(next);
                      }}
                      className="h-12 rounded-xl bg-zinc-50 border-none"
                      placeholder={`Person ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
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
          <div className="w-14" />
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
  showDelete = true,
}: {
  tx: { id: string; type: string; description: string; date: string; amount: number };
  onDelete: (id: string) => void;
  showDelete?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : tx.type === 'expense' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
          {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : tx.type === 'expense' ? <ArrowDownRight className="w-5 h-5" /> : <PiggyBank className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-sm font-bold">{tx.description}</p>
          <p className="text-[10px] text-zinc-500 font-medium">{format(new Date(tx.date + 'T12:00:00'), 'MMM dd, yyyy')}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className={`text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-rose-600' : 'text-amber-600'}`}>
          {tx.type === 'expense' ? '−' : '+'}${tx.amount.toLocaleString()}
        </p>
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
