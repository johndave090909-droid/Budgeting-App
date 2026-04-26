import { useState, useEffect, useRef } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Goal, BudgetItem, Bill } from '../types';
import { format } from 'date-fns';

const DEFAULT_BUDGET_TEMPLATE = [
  { group: 'Paying The Lord',    name: 'Tithing',             planned: 0 },
  { group: 'Paying The Lord',    name: 'Fast Offering',       planned: 0 },
  { group: 'Food and Hygiene',   name: 'Foods',               planned: 0 },
  { group: 'Food and Hygiene',   name: 'Personal Hygiene',    planned: 0 },
  { group: 'Food and Hygiene',   name: 'Restaurant Expenses', planned: 0 },
  { group: 'Savings and Others', name: 'Wedding',             planned: 0 },
  { group: 'Savings and Others', name: 'Holocard',            planned: 0 },
  { group: 'Savings and Others', name: 'Washconnect',         planned: 0 },
  { group: 'Savings and Others', name: 'Family',              planned: 0 },
  { group: 'Savings and Others', name: 'Discover',            planned: 0 },
  { group: 'Recreation',         name: 'Car Rental/Fees',     planned: 0 },
  { group: 'Recreation',         name: 'US Mobile',           planned: 0 },
  { group: 'Recreation',         name: 'Personal Expenses',   planned: 0 },
];

const GROUP_ORDER = ['Paying The Lord', 'Food and Hygiene', 'Savings and Others', 'Recreation'];

// Derives stable person IDs from the count of persons in settings
export const getPersonIds = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `p${i}`);

export function useBudget() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals]               = useState<Goal[]>([]);
  const [budgetItems, setBudgetItems]   = useState<BudgetItem[]>([]);
  const [bills, setBills]               = useState<Bill[]>([]);
  const [personNames, setPersonNames]   = useState<string[]>(['Dave', 'Jovy']);

  // Deduplication guard: tracks in-flight seed operations
  const seedingRef = useRef<Set<string>>(new Set());

  // ── Transactions ─────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    return onSnapshot(q, (snap) =>
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)))
    );
  }, []);

  // ── Goals ────────────────────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, 'goals'), (snap) =>
      setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal)))
    );
  }, []);

  // ── Budget items ─────────────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, 'budgetItems'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BudgetItem));
      data.sort((a, b) => {
        const gd = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
        return gd !== 0 ? gd : a.name.localeCompare(b.name);
      });
      setBudgetItems(data);
    });
  }, []);

  // ── Bills ────────────────────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, 'bills'), (snap) =>
      setBills(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bill)))
    );
  }, []);

  // ── Settings (person names) ──────────────────────────────────────
  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'app'), (snap) => {
      if (snap.exists() && snap.data().personNames?.length >= 2) {
        setPersonNames(snap.data().personNames);
      }
    });
  }, []);

  const updatePersonNames = async (names: string[]) => {
    await setDoc(doc(db, 'settings', 'app'), { personNames: names }, { merge: true });
  };

  // ── Migration: add month + person to old items ───────────────────
  useEffect(() => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    budgetItems
      .filter((b) => !b.month || !b.person)
      .forEach((item) => {
        const patch: Record<string, string> = {};
        if (!item.month)  patch.month  = currentMonth;
        if (!item.person) patch.person = 'p0';
        updateDoc(doc(db, 'budgetItems', item.id), patch);
      });
  }, [budgetItems]);

  // ── Seed budget items for a month + person (idempotent) ──────────
  const seedMonthBudgetItems = async (month: string, personId: string) => {
    const key = `${month}-${personId}`;
    if (seedingRef.current.has(key)) return;
    seedingRef.current.add(key);

    try {
      // Check Firestore directly to avoid stale local state
      const existing = await getDocs(
        query(collection(db, 'budgetItems'), where('month', '==', month), where('person', '==', personId))
      );
      if (!existing.empty) return;

      // Get templates from most recent previous month for this person
      const allPrev = await getDocs(
        query(collection(db, 'budgetItems'), where('person', '==', personId))
      );
      const prevItems = allPrev.docs
        .map((d) => d.data() as Omit<BudgetItem, 'id'>)
        .filter((b) => b.month && b.month < month);

      let templates: Array<{ group: string; name: string; planned: number }>;
      if (prevItems.length > 0) {
        const latestMonth = prevItems.reduce((max, b) => (b.month > max ? b.month : max), '');
        templates = prevItems
          .filter((b) => b.month === latestMonth)
          .map((b) => ({ group: b.group, name: b.name, planned: b.planned }));
      } else {
        templates = DEFAULT_BUDGET_TEMPLATE;
      }

      for (const t of templates) {
        await addDoc(collection(db, 'budgetItems'), { ...t, actual: 0, month, person: personId });
      }
    } finally {
      seedingRef.current.delete(key);
    }
  };

  // ── Transaction CRUD ─────────────────────────────────────────────
  const addTransaction    = (t: Omit<Transaction, 'id'>) => addDoc(collection(db, 'transactions'), t);
  const deleteTransaction = (id: string) => deleteDoc(doc(db, 'transactions', id));
  const updateTransaction = (id: string, fields: Partial<Omit<Transaction, 'id'>>) =>
    updateDoc(doc(db, 'transactions', id), fields as Record<string, unknown>);

  // ── Goal CRUD ────────────────────────────────────────────────────
  const addGoal    = (goal: Omit<Goal, 'id'>) => addDoc(collection(db, 'goals'), goal);
  const updateGoal = async (id: string, amount: number) => {
    const goal = goals.find((g) => g.id === id);
    if (goal) await updateDoc(doc(db, 'goals', id), { currentAmount: goal.currentAmount + amount });
  };
  const deleteGoal = (id: string) => deleteDoc(doc(db, 'goals', id));

  // ── Budget item CRUD ─────────────────────────────────────────────
  const updateBudgetItem = (
    id: string,
    fields: { planned: number; actual: number; name?: string; group?: string }
  ) => updateDoc(doc(db, 'budgetItems', id), fields as Record<string, unknown>);
  const addBudgetItem    = (item: Omit<BudgetItem, 'id'>) => addDoc(collection(db, 'budgetItems'), item);
  const deleteBudgetItem = (id: string) => deleteDoc(doc(db, 'budgetItems', id));

  // ── Bill CRUD ────────────────────────────────────────────────────
  const addBill    = (bill: Omit<Bill, 'id'>) => addDoc(collection(db, 'bills'), bill);
  const deleteBill = (id: string) => deleteDoc(doc(db, 'bills', id));
  const updateBill = (id: string, fields: Partial<Omit<Bill, 'id'>>) =>
    updateDoc(doc(db, 'bills', id), fields as Record<string, unknown>);

  const toggleBillPaid = async (billId: string, month: string, amount?: number, salaryIdx?: number) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;
    const paidAmounts = { ...(bill.paidAmounts ?? {}) };
    const paidSalary  = { ...(bill.paidSalary  ?? {}) };
    if (paidAmounts[month] !== undefined) {
      delete paidAmounts[month];
      delete paidSalary[month];
    } else {
      paidAmounts[month] = Number(amount ?? bill.amount) || 0;
      if (salaryIdx !== undefined) paidSalary[month] = salaryIdx;
    }
    await updateDoc(doc(db, 'bills', billId), { paidAmounts, paidSalary });
  };

  return {
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
  };
}
