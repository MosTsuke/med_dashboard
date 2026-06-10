export interface DepartmentData {
  name: string;
  count: number;
  percentage?: number;
  pricePerUnit?: number;
  totalPrice?: number;
}

export interface ItemData {
  rank: number;
  name: string;
  department?: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
}

export interface SummaryStats {
  totalItems: number;
  totalDepartments: number;
  totalSets: number;
  pricePerUnit: number;
  totalPrice: number;
}

export interface DashboardData {
  period?: { from: string; to: string };
  reportName?: string;
  hospitalName?: string;
  fiscalYear?: string;
  logoUrl?: string;
  summary: SummaryStats;
  departments: DepartmentData[];
  items: ItemData[];
  reportType: "summary" | "items" | "unknown";
}
