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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PersonIncome, BudgetItem } from '../types';

const DEFAULT_BUDGET_TEMPLATE = [
  { group: 'Paying The Lord',    name: 'Tithing',             planned: 0 },
  { group: 'Paying The Lord',    name: 'Fast Offering',       planned: 0 },
  { group: 'Food and Hygiene',   name: 'Foods',               planned: 0 },
  { group: 'Food and Hygiene',   name: 'Personal Hygiene',    planned: 0 },
  { group: 'Food and Hygiene',   name: 'Restaurant Expenses', planned: 0 },
  { group: 'Savings and Others', name: 'AMEX',                planned: 0 },
  { group: 'Savings and Others', name: 'Discover (US Mobile)', planned: 0 },
  { group: 'Savings and Others', name: 'Family',              planned: 0 },
  { group: 'Savings and Others', name: 'Holocard',            planned: 0 },
  { group: 'Recreation',         name: 'Car Rental/Fees',     planned: 0 },
  { group: 'Recreation',         name: 'US Mobile',           planned: 0 },
  { group: 'Recreation',         name: 'Personal Expenses',   planned: 0 },
];

export const getPersonIds = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `p${i}`);

export function useBudget() {
  const [income, setIncome]           = useState<PersonIncome[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [personNames, setPersonNames] = useState<string[]>(['Jovy', 'Dave']);
  const seedingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return onSnapshot(collection(db, 'personIncome'), (snap) =>
      setIncome(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PersonIncome)))
    );
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'budgetItems'), (snap) =>
      setBudgetItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BudgetItem)))
    );
  }, []);

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

  const upsertIncome = async (
    person: string,
    month: string,
    fields: Partial<Omit<PersonIncome, 'id' | 'person' | 'month'>>
  ) => {
    const docId = `${person}_${month}`;
    const existing = income.find((i) => i.person === person && i.month === month);
    if (existing) {
      await updateDoc(doc(db, 'personIncome', docId), fields as Record<string, unknown>);
    } else {
      await setDoc(doc(db, 'personIncome', docId), {
        person,
        month,
        wage1: 0,
        wage2: 0,
        scholarships: 0,
        previousBalance: 0,
        others: 0,
        currentBalance1: 0,
        currentBalance2: 0,
        savings: 0,
        ...fields,
      });
    }
  };

  const seedMonthBudgetItems = async (month: string, personId: string) => {
    const key = `${month}-${personId}`;
    if (seedingRef.current.has(key)) return;
    seedingRef.current.add(key);

    try {
      const existing = await getDocs(
        query(
          collection(db, 'budgetItems'),
          where('month', '==', month),
          where('person', '==', personId)
        )
      );
      if (!existing.empty) return;

      const allPrev = await getDocs(
        query(collection(db, 'budgetItems'), where('person', '==', personId))
      );
      const prevItems = allPrev.docs
        .map((d) => d.data() as Omit<BudgetItem, 'id'>)
        .filter((b) => b.month && b.month < month);

      let templates: Array<{ group: string; name: string; planned: number; salaryIdx: number }>;

      if (prevItems.length > 0) {
        const latestMonth = prevItems.reduce(
          (max, b) => (b.month > max ? b.month : max),
          ''
        );
        templates = prevItems
          .filter((b) => b.month === latestMonth)
          .map((b) => ({
            group: b.group,
            name: b.name,
            planned: b.planned,
            salaryIdx: b.salaryIdx ?? 0,
          }));
      } else {
        templates = [
          ...DEFAULT_BUDGET_TEMPLATE.map((t) => ({ ...t, salaryIdx: 0 })),
          ...DEFAULT_BUDGET_TEMPLATE.map((t) => ({ ...t, salaryIdx: 1 })),
        ];
      }

      for (const t of templates) {
        await addDoc(collection(db, 'budgetItems'), {
          ...t,
          actual: 0,
          status: '',
          month,
          person: personId,
        });
      }
    } finally {
      seedingRef.current.delete(key);
    }
  };

  const updateBudgetItem = (id: string, fields: Partial<Omit<BudgetItem, 'id'>>) =>
    updateDoc(doc(db, 'budgetItems', id), fields as Record<string, unknown>);

  const addBudgetItem = (item: Omit<BudgetItem, 'id'>) =>
    addDoc(collection(db, 'budgetItems'), item);

  const deleteBudgetItem = (id: string) =>
    deleteDoc(doc(db, 'budgetItems', id));

  return {
    income,
    budgetItems,
    personNames,
    updatePersonNames,
    upsertIncome,
    seedMonthBudgetItems,
    updateBudgetItem,
    addBudgetItem,
    deleteBudgetItem,
  };
}
