export interface PersonIncome {
  id: string;
  person: string;   // 'p0' | 'p1'
  month: string;    // 'YYYY-MM'
  wage1: number;
  wage2: number;
  scholarships: number;
  previousBalance: number;
  others: number;
  currentBalance1: number;
  currentBalance2: number;
  savings: number;
}

export interface BudgetItem {
  id: string;
  group: string;
  name: string;
  planned: number;
  actual: number;
  status: string;
  month: string;    // 'YYYY-MM'
  person: string;   // 'p0' | 'p1'
  salaryIdx: number; // 0 = Salary 1, 1 = Salary 2
  useOthers?: boolean; // when true, item's actual is paid from the Income "Others" pool
}
