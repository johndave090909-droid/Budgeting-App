import * as React from 'react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Settings, ChevronLeft, ChevronRight, ChevronDown, Trash2, Plus, Check, X, Wallet, MoreHorizontal } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { useBudget, getPersonIds } from './hooks/useBudget';
import { BudgetItem, PersonIncome } from './types';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const GROUP_ORDER = ['Paying The Lord', 'Food and Hygiene', 'Savings and Others', 'Recreation'];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);

type IncomeField = keyof Omit<PersonIncome, 'id' | 'person' | 'month'>;

const INCOME_FIELDS: { key: IncomeField; label: string }[] = [
  { key: 'wage1',           label: 'Wage Earned 1' },
  { key: 'wage2',           label: 'Wage Earned 2' },
  { key: 'scholarships',    label: 'Scholarships' },
  { key: 'previousBalance', label: 'Previous Balance' },
  { key: 'others',          label: 'Others' },
];

const MANUAL_FIELDS: { key: IncomeField; label: string }[] = [
  { key: 'currentBalance1', label: 'Bal. Sal. 1' },
  { key: 'currentBalance2', label: 'Bal. Sal. 2' },
  { key: 'savings',         label: 'Savings' },
];

// ── Editable amount (click → number input) ───────────────────────────────────
function EditableAmt({
  value,
  onSave,
  className = '',
}: {
  value: number;
  onSave: (v: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const start = () => {
    setDraft(value === 0 ? '' : String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const n = parseFloat(draft);
    onSave(isNaN(n) ? 0 : n);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-20 bg-zinc-800 rounded px-1 py-0.5 text-right text-base font-mono outline-none border border-emerald-500"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:text-emerald-400 text-sm font-mono text-right transition-colors ${className}`}
      onClick={start}
    >
      {fmt(value)}
    </span>
  );
}

// ── Editable text (click → text input) ───────────────────────────────────────
function EditableText({
  value,
  onSave,
  placeholder = '',
  className = '',
  emptyClass = 'text-zinc-600',
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  emptyClass?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const start = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`bg-zinc-800 rounded px-1 py-0.5 text-base outline-none border border-emerald-500 w-full ${className}`}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:text-emerald-400 text-sm transition-colors ${!value ? emptyClass : ''} ${className}`}
      onClick={start}
    >
      {value || placeholder}
    </span>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeMonth, setActiveMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [activePerson, setActivePerson] = useState('p0');
  const [activeSalary, setActiveSalary] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editNames, setEditNames] = useState<string[]>([]);
  const [newItemGroup, setNewItemGroup] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [itemDrawerId, setItemDrawerId] = useState<string | null>(null);

  const {
    income,
    budgetItems,
    personNames,
    updatePersonNames,
    upsertIncome,
    seedMonthBudgetItems,
    seedMonthIncome,
    updateBudgetItem,
    addBudgetItem,
    deleteBudgetItem,
  } = useBudget();

  const personIds = useMemo(() => getPersonIds(personNames.length), [personNames.length]);

  // Seed budget items and income whenever month or persons change
  useEffect(() => {
    personIds.forEach((pid) => {
      seedMonthBudgetItems(activeMonth, pid);
      seedMonthIncome(activeMonth, pid);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth, personIds.length]);

  // ── Derived: income for current person/month ─────────────────────────────
  const personIncome = useMemo<Omit<PersonIncome, 'id'>>(() => {
    return (
      income.find((i) => i.person === activePerson && i.month === activeMonth) ?? {
        person: activePerson,
        month: activeMonth,
        wage1: 0,
        wage2: 0,
        scholarships: 0,
        previousBalance: 0,
        others: 0,
        currentBalance1: 0,
        currentBalance2: 0,
        savings: 0,
      }
    );
  }, [income, activePerson, activeMonth]);

  const totalSalary =
    (personIncome.wage1           ?? 0) +
    (personIncome.wage2           ?? 0) +
    (personIncome.scholarships    ?? 0) +
    (personIncome.previousBalance ?? 0) +
    (personIncome.others          ?? 0);

  // ── Derived: budget items for current person/month ───────────────────────
  const personItems = useMemo(
    () => budgetItems.filter((b) => b.person === activePerson && b.month === activeMonth),
    [budgetItems, activePerson, activeMonth]
  );

  // Running Balance = Total Income − all actual (both salary panels)
  const totalActualAll  = personItems.reduce((s, b) => s + (b.actual  ?? 0), 0);
  const totalPlannedAll = personItems.reduce((s, b) => s + (b.planned ?? 0), 0);
  const runningBalance  = totalSalary + (personIncome.savings ?? 0) - totalActualAll;
  const budgetBalance   = totalSalary - totalPlannedAll;

  // Others bucket — actuals from items flagged useOthers come out of personIncome.others
  const othersUsed      = personItems.reduce((s, b) => s + (b.useOthers ? (b.actual ?? 0) : 0), 0);
  const othersRemaining = (personIncome.others ?? 0) - othersUsed;

  // Items for the active salary panel
  const activeItems = useMemo(
    () => personItems.filter((b) => (b.salaryIdx ?? 0) === activeSalary),
    [personItems, activeSalary]
  );

  const panelBudget       = activeItems.reduce((s, b) => s + (b.planned ?? 0), 0);
  const panelActual       = activeItems.reduce((s, b) => s + (b.actual  ?? 0), 0);
  // Actuals charged to the wage panel exclude items paid from the Others pool
  const panelActualFromWage = activeItems.reduce(
    (s, b) => s + (b.useOthers ? 0 : (b.actual ?? 0)),
    0
  );

  // Wage tied to each salary panel
  const panelWage      = activeSalary === 0 ? (personIncome.wage1 ?? 0) : (personIncome.wage2 ?? 0);
  const panelRemaining = panelWage - panelActualFromWage;

  const drawerItem = itemDrawerId
    ? personItems.find((b) => b.id === itemDrawerId) ?? null
    : null;

  // Group items → sorted by GROUP_ORDER
  const groups = useMemo(() => {
    const map = new Map<string, BudgetItem[]>();
    for (const item of activeItems) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = GROUP_ORDER.indexOf(a);
      const bi = GROUP_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [activeItems]);

  // ── Month navigation ─────────────────────────────────────────────────────
  const parseActiveMonth = () => {
    const [y, m] = activeMonth.split('-').map(Number);
    return new Date(y, m - 1, 1); // local time — avoids UTC midnight → prev-day shift
  };
  const prevMonth = () => setActiveMonth(format(subMonths(parseActiveMonth(), 1), 'yyyy-MM'));
  const nextMonth = () => setActiveMonth(format(addMonths(parseActiveMonth(), 1), 'yyyy-MM'));
  const monthLabel = format(parseActiveMonth(), 'MMMM yyyy');

  // ── Actions ──────────────────────────────────────────────────────────────
  const updateIncome = (field: IncomeField, value: number) =>
    upsertIncome(activePerson, activeMonth, { [field]: value });

  const deleteGroup = (group: string) => {
    activeItems.filter((i) => i.group === group).forEach((i) => deleteBudgetItem(i.id));
    setConfirmDeleteGroup(null);
  };

  const addItem = (group: string) => {
    if (!newItemName.trim()) return;
    const base = {
      group,
      name: newItemName.trim(),
      planned: 0,
      actual: 0,
      status: '',
      month: activeMonth,
      person: activePerson,
    };
    // Mirror to both salary panels
    addBudgetItem({ ...base, salaryIdx: 0 });
    addBudgetItem({ ...base, salaryIdx: 1 });
    setNewItemName('');
    setNewItemGroup(null);
  };

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const base = {
      group: newGroupName.trim(),
      name: 'New Item',
      planned: 0,
      actual: 0,
      status: '',
      month: activeMonth,
      person: activePerson,
    };
    // Mirror to both salary panels
    addBudgetItem({ ...base, salaryIdx: 0 });
    addBudgetItem({ ...base, salaryIdx: 1 });
    setNewGroupName('');
    setIsAddingGroup(false);
  };

  const copySalary1ToSalary2 = () => {
    const sal1 = personItems.filter((b) => (b.salaryIdx ?? 0) === 0);
    const sal2 = personItems.filter((b) => (b.salaryIdx ?? 0) === 1);
    const sal2Keys = new Set(sal2.map((b) => `${b.group}||${b.name}`));
    sal1
      .filter((b) => !sal2Keys.has(`${b.group}||${b.name}`))
      .forEach((b) =>
        addBudgetItem({ group: b.group, name: b.name, planned: 0, actual: 0, status: '', month: activeMonth, person: activePerson, salaryIdx: 1 })
      );
  };

  const openSettings = () => {
    setEditNames([...personNames]);
    setIsSettingsOpen(true);
  };

  const saveSettings = async () => {
    await updatePersonNames(editNames);
    setIsSettingsOpen(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      <div className="max-w-md mx-auto px-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between pt-6 pb-4">
          <h1 className="text-base font-bold tracking-tight text-zinc-100">Budget</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-zinc-200 w-28 text-center">{monthLabel}</span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={openSettings}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* ── Person tabs ── */}
        <div className="flex rounded-xl overflow-hidden bg-zinc-900 mb-4">
          {personIds.map((pid, i) => (
            <button
              key={pid}
              onClick={() => setActivePerson(pid)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                activePerson === pid
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {personNames[i]}
            </button>
          ))}
        </div>

        {/* ── Income section ── */}
        <div className="bg-zinc-900 rounded-xl mb-3 overflow-hidden">
          {/* Header row — always visible */}
          <button
            onClick={() => setIncomeOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Income</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold font-mono text-zinc-100">{fmt(totalSalary)}</span>
              <ChevronDown
                size={15}
                className={`text-zinc-500 transition-transform duration-200 ${incomeOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {/* Collapsible body */}
          {incomeOpen && (
            <div className="px-4 pb-4 border-t border-zinc-800">
              <div className="space-y-1.5 mt-3">
                {INCOME_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">{label}</span>
                    <div className="flex items-center gap-2">
                      {key === 'others' && othersUsed > 0 && (
                        <span
                          className={`text-[10px] font-mono ${
                            othersRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                          title={`Used ${fmt(othersUsed)} of ${fmt(personIncome.others ?? 0)}`}
                        >
                          {fmt(othersRemaining)} left
                        </span>
                      )}
                      <EditableAmt
                        value={((personIncome as Record<string, number>)[key] ?? 0)}
                        onSave={(v) => updateIncome(key, v)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-700 mt-3 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-zinc-100">Total Salary</span>
                <span className="text-sm font-bold font-mono text-zinc-100">{fmt(totalSalary)}</span>
              </div>
              <div className="border-t border-zinc-800 mt-3 pt-3 grid grid-cols-3 gap-2 text-center">
                {MANUAL_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</span>
                    <EditableAmt
                      value={((personIncome as Record<string, number>)[key] ?? 0)}
                      onSave={(v) => updateIncome(key, v)}
                      className="text-zinc-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Summary ── */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div
            className={`rounded-xl p-3 border ${
              runningBalance >= 0
                ? 'bg-emerald-900/30 border-emerald-800'
                : 'bg-rose-900/30 border-rose-800'
            }`}
          >
            <div className="text-[10px] text-zinc-400 mb-1">Running Balance</div>
            <div
              className={`text-base font-bold font-mono ${
                runningBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {fmt(runningBalance)}
            </div>
          </div>
          <div
            className={`rounded-xl p-3 border ${
              budgetBalance >= 0
                ? 'bg-blue-900/30 border-blue-800'
                : 'bg-rose-900/30 border-rose-800'
            }`}
          >
            <div className="text-[10px] text-zinc-400 mb-1">Budget Balance</div>
            <div
              className={`text-base font-bold font-mono ${
                budgetBalance >= 0 ? 'text-blue-400' : 'text-rose-400'
              }`}
            >
              {fmt(budgetBalance)}
            </div>
          </div>
        </div>


        {/* ── Salary tabs ── */}
        <div className="flex rounded-xl overflow-hidden bg-zinc-900 mb-0">
          {[0, 1].map((idx) => (
            <button
              key={idx}
              onClick={() => setActiveSalary(idx)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                activeSalary === idx
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Salary {idx + 1}
            </button>
          ))}
        </div>

        {/* ── Per-salary remaining ── */}
        <div className="bg-zinc-800 rounded-b-xl px-4 py-3 mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
              Wage Earned {activeSalary + 1}
            </span>
            <div className="text-sm font-mono text-zinc-300">{fmt(panelWage)}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Remaining</span>
            <div className={`text-sm font-bold font-mono ${panelRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmt(panelRemaining)}
            </div>
          </div>
        </div>

        {/* ── Copy from Salary 1 (Salary 2 only, when empty) ── */}
        {activeSalary === 1 && activeItems.length === 0 && (
          <button
            onClick={copySalary1ToSalary2}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-zinc-900 border border-dashed border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-700 transition-colors text-sm mb-4"
          >
            Copy items from Salary 1
          </button>
        )}

        {/* ── Table header ── */}
        <div className="grid grid-cols-[1fr_5rem_5rem_4.5rem_2.5rem] gap-1 px-3 mb-1">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wide">Item</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wide text-right">Budget</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wide text-right">Actual</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wide text-center">Status</span>
          <span />
        </div>

        {/* ── Category groups ── */}
        {groups.map(([group, items]) => {
          const groupBudget = items.reduce((s, i) => s + (i.planned ?? 0), 0);
          const groupActual = items.reduce((s, i) => s + (i.actual  ?? 0), 0);

          return (
            <div key={group} className="bg-zinc-900 rounded-xl mb-3 overflow-hidden">
              {/* Group header */}
              {confirmDeleteGroup === group ? (
                <div className="flex items-center justify-between px-3 py-2 bg-rose-900/30">
                  <span className="text-xs text-zinc-300">Delete <strong>{group}</strong> and all its items?</span>
                  <div className="flex gap-3">
                    <button onClick={() => deleteGroup(group)} className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors">Delete</button>
                    <button onClick={() => setConfirmDeleteGroup(null)} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2 bg-zinc-800">
                  <span className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase">
                    {group}
                  </span>
                  <button
                    onClick={() => setConfirmDeleteGroup(group)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}

              {/* Line items */}
              <div className="divide-y divide-zinc-800/60">
                {items.map((item) =>
                  confirmDeleteItem === item.id ? (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-rose-900/20">
                      <span className="text-xs text-zinc-300">Delete <strong>{item.name}</strong>?</span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { deleteBudgetItem(item.id); setConfirmDeleteItem(null); }}
                          className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteItem(null)}
                          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1fr_5rem_5rem_4.5rem_2.5rem] gap-1 px-3 py-2 items-center"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {item.useOthers && (
                          <Wallet
                            size={11}
                            className="text-sky-400 shrink-0"
                            aria-label="Paid from Others"
                          />
                        )}
                        <EditableText
                          value={item.name}
                          onSave={(v) => updateBudgetItem(item.id, { name: v })}
                          className="text-zinc-200 min-w-0 truncate"
                        />
                      </div>
                      <EditableAmt
                        value={item.planned}
                        onSave={(v) => updateBudgetItem(item.id, { planned: v })}
                      />
                      <EditableAmt
                        value={item.actual}
                        onSave={(v) => updateBudgetItem(item.id, { actual: v })}
                      />
                      <EditableText
                        value={item.status ?? ''}
                        onSave={(v) => updateBudgetItem(item.id, { status: v })}
                        placeholder="—"
                        className="text-center text-[11px] text-amber-400 truncate"
                        emptyClass="text-zinc-700"
                      />
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setItemDrawerId(item.id)}
                          className="text-zinc-700 hover:text-emerald-400 transition-colors"
                          aria-label="Item options"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteItem(item.id)}
                          className="text-zinc-700 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Add item row */}
              {newItemGroup === group ? (
                <div className="flex items-center gap-2 px-3 py-2 border-t border-zinc-800">
                  <input
                    autoFocus
                    className="flex-1 bg-zinc-800 rounded px-2 py-1 text-base outline-none border border-emerald-500 text-zinc-100 placeholder-zinc-600"
                    placeholder="Item name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addItem(group);
                      if (e.key === 'Escape') {
                        setNewItemGroup(null);
                        setNewItemName('');
                      }
                    }}
                  />
                  <button
                    onClick={() => addItem(group)}
                    className="text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => { setNewItemGroup(null); setNewItemName(''); }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setNewItemGroup(group); setNewItemName(''); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-zinc-600 hover:text-emerald-400 transition-colors border-t border-zinc-800/60 w-full"
                >
                  <Plus size={11} /> Add item
                </button>
              )}

              {/* Group subtotal */}
              <div className="grid grid-cols-[1fr_5rem_5rem_4.5rem_2.5rem] gap-1 px-3 py-2 border-t border-zinc-700 bg-zinc-800/40">
                <span className="text-[11px] text-zinc-500 italic">Subtotal</span>
                <span className="text-[11px] font-mono text-right text-zinc-400">{fmt(groupBudget)}</span>
                <span className="text-[11px] font-mono text-right text-zinc-400">{fmt(groupActual)}</span>
                <span /><span />
              </div>
            </div>
          );
        })}

        {/* ── Add category ── */}
        {isAddingGroup ? (
          <div className="flex items-center gap-2 mb-4">
            <input
              autoFocus
              className="flex-1 bg-zinc-900 rounded-xl px-3 py-2 text-base outline-none border border-emerald-500 text-zinc-100 placeholder-zinc-600"
              placeholder="Category name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addGroup();
                if (e.key === 'Escape') { setIsAddingGroup(false); setNewGroupName(''); }
              }}
            />
            <button
              onClick={addGroup}
              className="text-emerald-500 hover:text-emerald-400 transition-colors px-1"
            >
              <Check size={18} />
            </button>
            <button
              onClick={() => { setIsAddingGroup(false); setNewGroupName(''); }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors px-1"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingGroup(true)}
            className="flex items-center gap-2 w-full py-3 px-4 rounded-xl bg-zinc-900 text-zinc-500 hover:text-emerald-400 transition-colors text-sm mb-4"
          >
            <Plus size={15} /> Add Category
          </button>
        )}

        {/* ── Grand total ── */}
        <div className="bg-zinc-800 rounded-xl px-3 py-3 grid grid-cols-[1fr_5rem_5rem_4.5rem_2.5rem] gap-1 items-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">Total</span>
          <span className="text-sm font-bold font-mono text-right text-zinc-100">{fmt(panelBudget)}</span>
          <span className="text-sm font-bold font-mono text-right text-zinc-100">{fmt(panelActual)}</span>
          <span /><span />
        </div>

      </div>

      {/* ── Item detail drawer ── */}
      <Drawer open={itemDrawerId !== null} onOpenChange={(o) => !o && setItemDrawerId(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{drawerItem?.name || 'Item'}</DrawerTitle>
          </DrawerHeader>
          {drawerItem && (
            <div className="px-4 pb-10 space-y-5 overflow-y-auto">
              <div>
                <Label className="text-xs text-zinc-400 mb-2 block uppercase tracking-wide">
                  Name
                </Label>
                <Input
                  value={drawerItem.name}
                  onChange={(e) => updateBudgetItem(drawerItem.id, { name: e.target.value })}
                  className="w-full"
                />
              </div>

              <button
                onClick={() =>
                  updateBudgetItem(drawerItem.id, { useOthers: !drawerItem.useOthers })
                }
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  drawerItem.useOthers
                    ? 'bg-sky-900/30 border-sky-700'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3 text-left">
                  <Wallet
                    size={18}
                    className={drawerItem.useOthers ? 'text-sky-400' : 'text-zinc-500'}
                  />
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">Pay from Others</div>
                    <div className="text-[11px] text-zinc-400">
                      Deduct this item's actual from the Income "Others" pool
                      {drawerItem.useOthers
                        ? ` — ${fmt(othersRemaining)} left`
                        : ''}
                    </div>
                  </div>
                </div>
                <div
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                    drawerItem.useOthers ? 'bg-sky-500' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      drawerItem.useOthers ? 'translate-x-4' : ''
                    }`}
                  />
                </div>
              </button>

              <Button
                onClick={() => {
                  setConfirmDeleteItem(drawerItem.id);
                  setItemDrawerId(null);
                }}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white"
              >
                Delete item
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* ── Settings drawer ── */}
      <Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Settings</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-10 space-y-4 overflow-y-auto">
            <div>
              <Label className="text-xs text-zinc-400 mb-3 block uppercase tracking-wide">
                Person Names
              </Label>
              {editNames.map((name, i) => (
                <div key={i} className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-zinc-500 w-16">Person {i + 1}</span>
                  <Input
                    value={name}
                    onChange={(e) => {
                      const n = [...editNames];
                      n[i] = e.target.value;
                      setEditNames(n);
                    }}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
            <Button onClick={saveSettings} className="w-full">
              Save
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
