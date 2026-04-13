import { useState, useEffect } from 'react';
import { Transaction, Goal } from '../types';

export function useBudget() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('budgetly_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('budgetly_goals');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('budgetly_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('budgetly_goals', JSON.stringify(goals));
  }, [goals]);

  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };
    setTransactions((prev) => [newTransaction, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const addGoal = (goal: Omit<Goal, 'id'>) => {
    const newGoal = {
      ...goal,
      id: crypto.randomUUID(),
    };
    setGoals((prev) => [...prev, newGoal]);
  };

  const updateGoal = (id: string, amount: number) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g
      )
    );
  };

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      if (t.type === 'expense') acc.expense += t.amount;
      if (t.type === 'savings') acc.savings += t.amount;
      return acc;
    },
    { income: 0, expense: 0, savings: 0 }
  );

  const balance = totals.income - totals.expense - totals.savings;

  return {
    transactions,
    goals,
    addTransaction,
    deleteTransaction,
    addGoal,
    updateGoal,
    deleteGoal,
    totals,
    balance,
  };
}
