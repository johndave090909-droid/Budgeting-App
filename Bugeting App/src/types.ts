export type TransactionType = 'income' | 'expense' | 'savings';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category: string;
}

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export const CATEGORIES: Record<TransactionType, Category[]> = {
  income: [
    { id: 'salary', name: 'Salary', icon: 'Briefcase', color: 'bg-emerald-500' },
    { id: 'freelance', name: 'Freelance', icon: 'Laptop', color: 'bg-blue-500' },
    { id: 'gift', name: 'Gift', icon: 'Gift', color: 'bg-purple-500' },
    { id: 'other-income', name: 'Other', icon: 'Plus', color: 'bg-gray-500' },
  ],
  expense: [
    { id: 'food', name: 'Food', icon: 'Utensils', color: 'bg-orange-500' },
    { id: 'transport', name: 'Transport', icon: 'Car', color: 'bg-blue-400' },
    { id: 'rent', name: 'Rent', icon: 'Home', color: 'bg-red-500' },
    { id: 'entertainment', name: 'Fun', icon: 'Gamepad', color: 'bg-pink-500' },
    { id: 'shopping', name: 'Shopping', icon: 'ShoppingBag', color: 'bg-yellow-500' },
    { id: 'health', name: 'Health', icon: 'HeartPulse', color: 'bg-rose-500' },
    { id: 'other-expense', name: 'Other', icon: 'MoreHorizontal', color: 'bg-gray-500' },
  ],
  savings: [
    { id: 'emergency', name: 'Emergency', icon: 'ShieldAlert', color: 'bg-amber-500' },
    { id: 'investment', name: 'Investment', icon: 'TrendingUp', color: 'bg-indigo-500' },
    { id: 'vacation', name: 'Vacation', icon: 'Plane', color: 'bg-cyan-500' },
    { id: 'other-savings', name: 'Other', icon: 'PiggyBank', color: 'bg-teal-500' },
  ],
};
