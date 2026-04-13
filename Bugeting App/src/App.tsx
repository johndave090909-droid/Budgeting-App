import * as React from 'react';
import { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { useBudget } from './hooks/useBudget';
import { CATEGORIES, TransactionType } from './types';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

type Tab = 'dashboard' | 'transactions' | 'goals';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { 
    transactions, 
    goals, 
    addTransaction, 
    deleteTransaction, 
    addGoal, 
    updateGoal, 
    deleteGoal,
    totals,
    balance 
  } = useBudget();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTx, setNewTx] = useState({
    type: 'expense' as TransactionType,
    amount: '',
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const handleAddTransaction = () => {
    if (!newTx.amount || !newTx.category) return;
    addTransaction({
      type: newTx.type,
      amount: parseFloat(newTx.amount),
      category: newTx.category,
      description: newTx.description || CATEGORIES[newTx.type].find(c => c.id === newTx.category)?.name || '',
      date: newTx.date
    });
    setNewTx({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd')
    });
    setIsAddOpen(false);
  };

  const chartData = [
    { name: 'Income', value: totals.income, color: '#10b981' },
    { name: 'Expenses', value: totals.expense, color: '#ef4444' },
    { name: 'Savings', value: totals.savings, color: '#f59e0b' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-zinc-900" />
            Budgetly
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Balance</p>
              <p className={`text-sm font-bold ${balance >= 0 ? 'text-zinc-900' : 'text-red-600'}`}>
                ${balance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-6 space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-none shadow-sm bg-emerald-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-emerald-600 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Income</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-700">${totals.income.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-rose-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-rose-600 mb-1">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Expenses</span>
                    </div>
                    <p className="text-lg font-bold text-rose-700">${totals.expense.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Chart */}
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Overview</CardTitle>
                </CardHeader>
                <CardContent className="h-48 pt-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#71717a' }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f4f4f5' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Recent Activity</h2>
                  <Button variant="ghost" size="sm" className="text-xs font-semibold" onClick={() => setActiveTab('transactions')}>
                    View All
                  </Button>
                </div>
                <div className="space-y-3">
                  {transactions.slice(0, 4).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${
                          tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 
                          tx.type === 'expense' ? 'bg-rose-100 text-rose-600' : 
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : 
                           tx.type === 'expense' ? <ArrowDownRight className="w-5 h-5" /> : 
                           <PiggyBank className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{tx.description}</p>
                          <p className="text-[10px] text-zinc-500 font-medium">{format(new Date(tx.date), 'MMM dd, yyyy')}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${
                        tx.type === 'income' ? 'text-emerald-600' : 
                        tx.type === 'expense' ? 'text-rose-600' : 
                        'text-amber-600'
                      }`}>
                        {tx.type === 'expense' ? '-' : '+'}${tx.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-zinc-200">
                      <p className="text-sm text-zinc-400">No transactions yet</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'transactions' && (
            <motion.div
              key="transactions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-bold">All Transactions</h2>
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm group">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${
                        tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 
                        tx.type === 'expense' ? 'bg-rose-100 text-rose-600' : 
                        'bg-amber-100 text-amber-600'
                      }`}>
                        {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : 
                         tx.type === 'expense' ? <ArrowDownRight className="w-5 h-5" /> : 
                         <PiggyBank className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{tx.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400 font-medium">{format(new Date(tx.date), 'MMM dd')}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-200" />
                          <span className="text-[10px] text-zinc-400 font-medium capitalize">{tx.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`text-sm font-bold ${
                        tx.type === 'income' ? 'text-emerald-600' : 
                        tx.type === 'expense' ? 'text-rose-600' : 
                        'text-amber-600'
                      }`}>
                        {tx.type === 'expense' ? '-' : '+'}${tx.amount.toLocaleString()}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-300 hover:text-red-500"
                        onClick={() => deleteTransaction(tx.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'goals' && (
            <motion.div
              key="goals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Financial Goals</h2>
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full text-xs">
                      New Goal
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-w-md mx-auto">
                    <DrawerHeader>
                      <DrawerTitle>Set a New Goal</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Goal Name</Label>
                        <Input id="goal-name" placeholder="e.g. New Car, Emergency Fund" className="h-12 rounded-xl bg-zinc-50 border-none" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Target Amount</Label>
                        <Input id="goal-amount" type="number" placeholder="0.00" className="h-12 rounded-xl bg-zinc-50 border-none" />
                      </div>
                      <Button 
                        className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-bold"
                        onClick={() => {
                          const name = (document.getElementById('goal-name') as HTMLInputElement).value;
                          const amount = (document.getElementById('goal-amount') as HTMLInputElement).value;
                          if (name && amount) {
                            addGoal({
                              name,
                              targetAmount: parseFloat(amount),
                              currentAmount: 0,
                              category: 'savings'
                            });
                          }
                        }}
                      >
                        Create Goal
                      </Button>
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>

              <div className="space-y-4">
                {goals.map((goal) => (
                  <Card key={goal.id} className="border-none shadow-sm overflow-hidden">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                            <Target className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{goal.name}</p>
                            <p className="text-[10px] text-zinc-500 font-medium">Target: ${goal.targetAmount.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">${goal.currentAmount.toLocaleString()}</p>
                          <p className="text-[10px] text-zinc-500 font-medium">{Math.round((goal.currentAmount / goal.targetAmount) * 100)}%</p>
                        </div>
                      </div>
                      <Progress value={(goal.currentAmount / goal.targetAmount) * 100} className="h-2" />
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          className="flex-1 h-10 text-xs font-bold rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900"
                          onClick={() => {
                            const amt = prompt('How much did you save today?');
                            if (amt) updateGoal(goal.id, parseFloat(amt));
                          }}
                        >
                          Add Savings
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-xl text-zinc-300 hover:text-red-500 hover:bg-red-50"
                          onClick={() => deleteGoal(goal.id)}
                        >
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

      {/* Floating Action Button */}
      <Drawer open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DrawerTrigger asChild>
          <Button 
            className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-xl shadow-zinc-200 bg-zinc-900 hover:bg-zinc-800 text-white z-20"
            size="icon"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-w-md mx-auto">
          <DrawerHeader>
            <DrawerTitle>Add Transaction</DrawerTitle>
          </DrawerHeader>
          <div className="p-6 space-y-6">
            <Tabs value={newTx.type} onValueChange={(v) => setNewTx({ ...newTx, type: v as TransactionType, category: '' })}>
              <TabsList className="grid grid-cols-3 w-full bg-zinc-100 p-1 rounded-xl">
                <TabsTrigger value="expense" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-rose-600">Expense</TabsTrigger>
                <TabsTrigger value="income" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600">Income</TabsTrigger>
                <TabsTrigger value="savings" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-amber-600">Savings</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-zinc-500">Amount</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                  <Input 
                    id="amount" 
                    type="number" 
                    placeholder="0.00" 
                    className="pl-8 h-12 rounded-xl bg-zinc-50 border-none text-lg font-bold focus-visible:ring-zinc-200"
                    value={newTx.amount}
                    onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-zinc-500">Category</Label>
                <Select value={newTx.category} onValueChange={(v) => setNewTx({ ...newTx, category: v })}>
                  <SelectTrigger className="h-12 rounded-xl bg-zinc-50 border-none focus:ring-zinc-200">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-zinc-100">
                    {CATEGORIES[newTx.type].map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-zinc-500">Description (Optional)</Label>
                <Input 
                  id="description" 
                  placeholder="What was this for?" 
                  className="h-12 rounded-xl bg-zinc-50 border-none focus-visible:ring-zinc-200"
                  value={newTx.description}
                  onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date" className="text-xs font-bold uppercase tracking-wider text-zinc-500">Date</Label>
                <Input 
                  id="date" 
                  type="date" 
                  className="h-12 rounded-xl bg-zinc-50 border-none focus-visible:ring-zinc-200"
                  value={newTx.date}
                  onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                />
              </div>
            </div>

            <Button 
              className="w-full h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-lg mt-4"
              onClick={handleAddTransaction}
            >
              Add {newTx.type}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-zinc-200 px-6 py-3 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Home"
          />
          <NavButton 
            active={activeTab === 'transactions'} 
            onClick={() => setActiveTab('transactions')}
            icon={<History className="w-5 h-5" />}
            label="History"
          />
          <div className="w-12" /> {/* Spacer for FAB */}
          <NavButton 
            active={activeTab === 'goals'} 
            onClick={() => setActiveTab('goals')}
            icon={<Target className="w-5 h-5" />}
            label="Goals"
          />
          <NavButton 
            active={false} 
            onClick={() => {}}
            icon={<ChevronRight className="w-5 h-5" />}
            label="More"
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-zinc-900' : 'text-zinc-400'}`}
    >
      <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-zinc-100' : 'bg-transparent'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

